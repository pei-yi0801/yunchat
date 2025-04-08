import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '../types';
import { WebSocketConfig } from '../config/websocket.config';

const { OFFLINE_QUEUE: { MAX_QUEUE_SIZE, STORAGE_KEY, AUTO_SYNC_INTERVAL, SYNC_RETRY_DELAY } } = WebSocketConfig;

// 存储键
const OFFLINE_QUEUE_KEY = STORAGE_KEY;
const LAST_SYNC_TIME_KEY = WebSocketConfig.STORAGE_KEYS.LAST_SYNC_TIME;

export interface QueuedMessage extends Message {
    queuedAt: number;
    attempts: number;
    priority: number; // 1-10, 10为最高优先级
}

/**
 * 离线消息队列管理器
 * 负责存储、排序和同步离线消息
 */
export class OfflineQueueManager {
    private queue: QueuedMessage[] = [];
    private maxQueueSize: number = MAX_QUEUE_SIZE;
    private isLoaded: boolean = false;
    private isSyncing: boolean = false;
    private syncListeners: Array<(success: boolean, error?: Error) => void> = [];
    private queueChangedListeners: Array<(queueSize: number) => void> = [];
    private syncInProgress: boolean = false;
    private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
    private syncRetryDelay: number = SYNC_RETRY_DELAY;
    private lastSyncAttempt: number = 0;

    constructor() {
        this.loadQueue();
        // 初始化时不启动自动同步，需要外部调用startAutoSync并提供同步函数
    }

    /**
     * 从存储加载队列
     */
    private async loadQueue(): Promise<void> {
        try {
            const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
            if (queueJson) {
                this.queue = JSON.parse(queueJson);
                // 根据优先级和队列时间排序
                this.sortQueue();
            }
            this.isLoaded = true;
            this.notifyQueueChanged();
        } catch (error) {
            console.error('加载离线队列失败:', error);
            this.isLoaded = true;
            this.queue = [];
        }
    }

    /**
     * 保存队列到存储
     */
    private async saveQueue(): Promise<void> {
        try {
            await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
        } catch (error) {
            console.error('保存离线队列失败:', error);
        }
    }

    /**
     * 根据优先级和队列时间排序
     */
    private sortQueue(): void {
        this.queue.sort((a, b) => {
            // 先按优先级排序（降序）
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            // 同等优先级按重试次数排序（升序）
            if (a.attempts !== b.attempts) {
                return a.attempts - b.attempts;
            }
            // 最后按队列时间排序（升序）
            return a.queuedAt - b.queuedAt;
        });
    }

    /**
     * 添加消息到队列
     * @param message 要添加的消息
     * @param priority 消息优先级（1-10）
     * @returns 成功添加返回true，失败返回false
     */
    public async addMessage(message: Message, priority: number = 5): Promise<boolean> {
        // 验证优先级范围
        if (priority < 1 || priority > 10) {
            throw new Error('消息优先级必须在1-10之间');
        }

        if (!this.isLoaded) {
            await this.waitForLoad();
        }

        // 检查队列是否已满
        if (this.queue.length >= this.maxQueueSize) {
            console.warn('离线队列已满，无法添加更多消息');
            return false;
        }

        const queuedMessage: QueuedMessage = {
            ...message,
            queuedAt: Date.now(),
            attempts: 0,
            priority: Math.max(1, Math.min(10, priority)) // 确保优先级在1-10之间
        };

        this.queue.push(queuedMessage);
        this.sortQueue();
        this.notifyQueueChanged();
        await this.saveQueue();

        return true;
    }

    /**
     * 获取队列消息数量
     */
    public getQueueSize(): number {
        return this.queue.length;
    }

    /**
     * 清空队列
     */
    public async clearQueue(): Promise<void> {
        this.queue = [];
        this.notifyQueueChanged();
        await this.saveQueue();
    }

    /**
     * 同步队列中的消息
     * @param syncFn 同步函数，接收消息并返回Promise
     * @param batchSize 每批同步的消息数量
     */
    public async syncQueue(
        syncFn: (message: Message) => Promise<boolean>,
        batchSize: number = 10
    ): Promise<{ success: boolean; processed: number; failed: number; remaining: number }> {
        if (this.syncInProgress) {
            return { success: false, processed: 0, failed: 0, remaining: this.queue.length };
        }

        this.syncInProgress = true;
        let processed = 0;
        let failed = 0;
        let succeeded = 0;

        try {
            // 获取当前批次要处理的消息
            const batch = this.queue.slice(0, batchSize);

            if (batch.length === 0) {
                this.syncInProgress = false;
                return { success: true, processed: 0, failed: 0, remaining: 0 };
            }

            // 逐个处理消息
            for (const message of batch) {
                try {
                    message.attempts += 1;
                    const success = await syncFn(message);
                    processed++;

                    if (success) {
                        // 成功同步，从队列中移除
                        this.queue = this.queue.filter(m => m !== message);
                        succeeded++;
                    } else {
                        // 同步失败但无错误，保留在队列中
                        failed++;

                        // 如果尝试次数过多，降低优先级
                        if (message.attempts > 3) {
                            message.priority = Math.max(1, message.priority - 1);
                        }
                    }
                } catch (error) {
                    console.error('同步消息失败:', error);
                    failed++;

                    // 如果尝试次数过多，降低优先级
                    if (message.attempts > 5) {
                        message.priority = Math.max(1, message.priority - 2);
                    }
                }
            }

            // 重新排序队列
            this.sortQueue();

            // 保存更新后的队列
            await this.saveQueue();

            // 记录最后同步时间
            if (succeeded > 0) {
                await AsyncStorage.setItem(LAST_SYNC_TIME_KEY, Date.now().toString());
            }

            // 通知队列变化
            this.notifyQueueChanged();

            // 通知同步监听器
            this.notifySyncListeners(true);

            return {
                success: failed === 0,
                processed,
                failed,
                remaining: this.queue.length
            };
        } catch (error) {
            console.error('同步队列失败:', error);
            this.notifySyncListeners(false, error as Error);
            return {
                success: false,
                processed,
                failed,
                remaining: this.queue.length
            };
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * 获取上次同步时间
     */
    public async getLastSyncTime(): Promise<number | null> {
        try {
            const timeStr = await AsyncStorage.getItem(LAST_SYNC_TIME_KEY);
            return timeStr ? parseInt(timeStr, 10) : null;
        } catch (error) {
            console.error('获取上次同步时间失败:', error);
            return null;
        }
    }

    /**
     * 启动自动同步
     * @param syncFn 同步函数
     * @param interval 同步间隔（毫秒）
     * @param batchSize 每批同步的消息数量
     */
    public startAutoSync(
        syncFn: (message: Message) => Promise<boolean>,
        interval: number = 30000,
        batchSize: number = 10
    ): void {
        this.stopAutoSync();

        this.autoSyncInterval = setInterval(async () => {
            if (this.queue.length > 0 && !this.syncInProgress) {
                try {
                    await this.syncQueue(syncFn, batchSize);
                } catch (error) {
                    console.error('自动同步失败:', error);
                }
            }
        }, interval);
    }

    /**
     * 停止自动同步
     */
    public stopAutoSync(): void {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    }

    /**
     * 注册同步监听器
     * @param listener 监听器函数
     */
    public registerSyncListener(listener: (success: boolean, error?: Error) => void): void {
        this.syncListeners.push(listener);
    }

    /**
     * 注销同步监听器
     * @param listener 监听器函数
     */
    public unregisterSyncListener(listener: (success: boolean, error?: Error) => void): void {
        this.syncListeners = this.syncListeners.filter(l => l !== listener);
    }

    /**
     * 注册队列变化监听器
     * @param listener 监听器函数
     */
    public registerQueueChangedListener(listener: (queueSize: number) => void): void {
        this.queueChangedListeners.push(listener);
        // 立即通知当前状态
        listener(this.queue.length);
    }

    /**
     * 注销队列变化监听器
     * @param listener 监听器函数
     */
    public unregisterQueueChangedListener(listener: (queueSize: number) => void): void {
        this.queueChangedListeners = this.queueChangedListeners.filter(l => l !== listener);
    }

    /**
     * 通知同步监听器
     */
    private notifySyncListeners(success: boolean, error?: Error): void {
        this.syncListeners.forEach(listener => {
            try {
                listener(success, error);
            } catch (listenerError) {
                console.error('同步监听器执行出错:', listenerError);
            }
        });
    }

    /**
     * 通知队列变化监听器
     */
    private notifyQueueChanged(): void {
        const queueSize = this.queue.length;
        this.queueChangedListeners.forEach(listener => {
            try {
                listener(queueSize);
            } catch (error) {
                console.error('队列变化监听器执行出错:', error);
            }
        });
    }

    /**
     * 等待队列加载完成
     */
    private async waitForLoad(): Promise<void> {
        if (this.isLoaded) {
            return;
        }

        return new Promise<void>(resolve => {
            const checkLoaded = () => {
                if (this.isLoaded) {
                    resolve();
                } else {
                    setTimeout(checkLoaded, 100);
                }
            };
            checkLoaded();
        });
    }
}