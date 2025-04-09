import { webSocketManager } from './socketService';
import { isOnline, registerNetworkStatusCallback, ConnectionQuality } from './networkService';
import { OfflineQueueManager } from './offlineQueue';
import {
    ConnectionStatus,
    Message,
    MessageStatus,
    SyncStatus
} from '../types';
import {
    getMessages,
    getSessions,
    updateMessage
} from './storageService';

// 同步错误接口
export interface SyncError {
    id: string;
    messageId?: string;
    error: any;
    timestamp: number;
    details?: string;
    attempts?: number;
}

// 同步状态
export interface SyncManagerState {
    isInitialSyncComplete: boolean;
    isSyncing: boolean;
    lastSyncTime: number | null;
    errors: SyncError[];
    queueSize: number;
    networkStatus: ConnectionStatus;
    networkQuality: ConnectionQuality;
}

// 同步观察者
export type SyncObserver = (state: SyncManagerState) => void;

/**
 * 同步管理器类
 * 管理离线消息队列、同步状态和网络连接
 */
export class SyncManager {
    private state: SyncManagerState = {
        isInitialSyncComplete: false,
        isSyncing: false,
        lastSyncTime: null,
        errors: [],
        queueSize: 0,
        networkStatus: ConnectionStatus.DISCONNECTED,
        networkQuality: ConnectionQuality.UNKNOWN
    };

    private observers: SyncObserver[] = [];
    private queueManager: OfflineQueueManager;
    private autoSyncInterval: NodeJS.Timeout | null = null;
    private errorRetryInterval: NodeJS.Timeout | null = null;
    private isWSConnected: boolean = false;

    constructor() {
        // 初始化离线队列
        this.queueManager = new OfflineQueueManager();

        // 监听队列变化
        this.queueManager.registerQueueChangedListener(this.handleQueueSizeChange);

        // 监听网络状态变化
        registerNetworkStatusCallback(this.handleNetworkStatusChange);

        // 监听WebSocket连接状态
        if (webSocketManager && typeof webSocketManager.registerConnectionStateHandler === 'function') {
            webSocketManager.registerConnectionStateHandler(this.handleWebSocketConnection);
        } else {
            console.warn('无法注册WebSocket连接状态处理程序');
        }

        // 获取上次同步时间
        this.initLastSyncTime();
    }

    /**
     * 初始化上次同步时间
     */
    private async initLastSyncTime(): Promise<void> {
        try {
            const lastSyncTime = await this.queueManager.getLastSyncTime();
            this.updateState({ lastSyncTime });
        } catch (error) {
            console.error('获取上次同步时间出错:', error);
        }
    }

    /**
     * 处理队列大小变化
     */
    private handleQueueSizeChange = (queueSize: number): void => {
        this.updateState({ queueSize });
    };

    /**
     * 处理网络状态变化
     */
    private handleNetworkStatusChange = async (status: ConnectionStatus): Promise<void> => {
        this.updateState({ networkStatus: status });

        if (status === ConnectionStatus.CONNECTED) {
            // 网络恢复时，尝试同步离线数据
            await this.syncOfflineQueue();
        }
    };

    /**
     * 处理WebSocket连接状态变化
     */
    private handleWebSocketConnection = (isConnected: boolean): void => {
        this.isWSConnected = isConnected;

        if (isConnected) {
            // WebSocket连接恢复时，尝试同步离线数据
            this.syncOfflineQueue();
        }
    };

    /**
     * 注册同步状态观察者
     */
    public registerObserver(observer: SyncObserver): () => void {
        this.observers.push(observer);

        // 立即通知当前状态
        observer({ ...this.state });

        // 返回取消注册的函数
        return () => {
            const index = this.observers.indexOf(observer);
            if (index !== -1) {
                this.observers.splice(index, 1);
            }
        };
    }

    /**
     * 更新状态并通知观察者
     */
    private updateState(updates: Partial<SyncManagerState>): void {
        this.state = { ...this.state, ...updates };

        // 通知所有观察者
        this.notifyObservers();
    }

    /**
     * 通知所有观察者
     */
    private notifyObservers(): void {
        this.observers.forEach(observer => {
            try {
                observer({ ...this.state });
            } catch (error) {
                console.error('通知同步观察者失败:', error);
            }
        });
    }

    /**
     * 同步离线队列
     */
    public async syncOfflineQueue(): Promise<boolean> {
        // 如果已经在同步、网络断开或WebSocket未连接，直接返回
        if (
            this.state.isSyncing ||
            this.state.networkStatus !== ConnectionStatus.CONNECTED ||
            !this.isWSConnected
        ) {
            return false;
        }

        this.updateState({
            isSyncing: true,
            errors: this.state.errors.filter(e => e.messageId !== undefined) // 保留消息相关的错误
        });

        try {
            // 使用队列管理器同步消息
            const result = await this.queueManager.syncQueue(this.syncMessageToServer);

            this.updateState({
                isSyncing: false,
                lastSyncTime: result.success ? Date.now() : this.state.lastSyncTime,
                isInitialSyncComplete: true
            });

            return result.success;
        } catch (error) {
            // 添加同步错误
            const syncError: SyncError = {
                id: `err_${Date.now()}`,
                error,
                timestamp: Date.now(),
                details: '同步队列失败'
            };

            this.updateState({
                isSyncing: false,
                errors: [...this.state.errors, syncError]
            });

            return false;
        }
    }

    /**
     * 同步单条消息到服务器
     */
    private syncMessageToServer = async (message: Message): Promise<boolean> => {
        try {
            if (!webSocketManager || !webSocketManager.isConnected()) {
                return false;
            }

            // 发送消息
            webSocketManager.sendMessage({
                type: 'message',
                payload: {
                    ...message,
                    isOffline: false,
                    syncStatus: 'synced',
                },
                timestamp: Date.now(),
                metadata: {
                    sender: 'agent',
                    messageType: 'new_message'
                }
            });

            // 更新本地消息状态
            await updateMessage(message.sessionId, message.id, {
                isOffline: false,
                syncStatus: 'synced',
                status: 'sent' as MessageStatus
            });

            return true;
        } catch (error) {
            // 创建消息同步错误
            const syncError: SyncError = {
                id: `err_${Date.now()}`,
                messageId: message.id,
                error,
                timestamp: Date.now(),
                details: `同步消息 ${message.id} 失败`,
                attempts: (message as any).attempts || 1
            };

            this.updateState({
                errors: [...this.state.errors, syncError]
            });

            return false;
        }
    };

    /**
     * 添加消息到离线队列
     */
    public async addToQueue(message: Message, priority: number = 5): Promise<boolean> {
        try {
            const result = await this.queueManager.addMessage(message, priority);
            return result;
        } catch (error) {
            console.error('添加消息到队列失败:', error);
            return false;
        }
    }

    /**
     * 重新发送失败的消息
     */
    public async resendMessage(sessionId: string, messageId: string): Promise<boolean> {
        try {
            // 获取会话的所有消息
            const messages = await getMessages(sessionId);

            // 查找指定消息
            const message = messages.find(m => m.id === messageId);

            if (!message) {
                throw new Error(`消息不存在: ${messageId}`);
            }

            // 如果不是失败或待处理状态，则无需重发
            if (message.status !== 'failed' && message.syncStatus !== 'pending') {
                return false;
            }

            // 更新消息状态
            await updateMessage(sessionId, messageId, {
                status: 'sending' as MessageStatus,
                syncStatus: 'syncing' as SyncStatus,
            });

            // 如果当前在线，尝试直接发送
            if (await isOnline() && this.isWSConnected) {
                return this.syncMessageToServer(message);
            } else {
                // 离线状态，添加到队列等待自动同步
                return this.addToQueue(message, 8); // 使用较高优先级
            }
        } catch (error) {
            // 添加重发错误
            const syncError: SyncError = {
                id: `err_${Date.now()}`,
                messageId,
                error,
                timestamp: Date.now(),
                details: `重发消息 ${messageId} 失败`
            };

            this.updateState({
                errors: [...this.state.errors, syncError]
            });

            return false;
        }
    }

    /**
     * 启动自动同步
     */
    public startAutoSync(interval: number = 30000): void {
        this.stopAutoSync();

        this.autoSyncInterval = setInterval(() => {
            if (this.state.queueSize > 0) {
                this.syncOfflineQueue().catch(error => {
                    console.error('自动同步失败:', error);
                });
            }
        }, interval);

        // 启动错误重试
        this.startErrorRetry();
    }

    /**
     * 停止自动同步
     */
    public stopAutoSync(): void {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }

        this.stopErrorRetry();
    }

    /**
     * 启动错误重试
     */
    private startErrorRetry(): void {
        this.stopErrorRetry();

        this.errorRetryInterval = setInterval(() => {
            // 尝试重新发送错误消息
            this.retryFailedMessages();
        }, 60000); // 每分钟重试一次
    }

    /**
     * 停止错误重试
     */
    private stopErrorRetry(): void {
        if (this.errorRetryInterval) {
            clearInterval(this.errorRetryInterval);
            this.errorRetryInterval = null;
        }
    }

    /**
     * 重试失败的消息
     */
    private async retryFailedMessages(): Promise<void> {
        // 获取消息相关的错误
        const messageErrors = this.state.errors.filter(e => e.messageId && e.attempts && e.attempts < 5);

        if (messageErrors.length === 0) {
            return;
        }

        for (const error of messageErrors) {
            if (error.messageId && await isOnline() && this.isWSConnected) {
                try {
                    // 查找消息所属的会话
                    const sessions = await getSessions();
                    for (const session of sessions) {
                        const messages = await getMessages(session.id);
                        const message = messages.find(m => m.id === error.messageId);

                        if (message) {
                            // 尝试重新发送
                            await this.resendMessage(session.id, message.id);
                            break;
                        }
                    }
                } catch (retryError) {
                    console.error(`重试消息 ${error.messageId} 失败:`, retryError);
                }
            }
        }
    }

    /**
     * 清除错误
     */
    public clearErrors(): void {
        this.updateState({ errors: [] });
    }

    /**
     * 清除特定错误
     */
    public clearError(errorId: string): void {
        this.updateState({
            errors: this.state.errors.filter(e => e.id !== errorId)
        });
    }

    /**
     * 获取当前状态
     */
    public getState(): SyncManagerState {
        return { ...this.state };
    }

    /**
     * 销毁同步管理器
     */
    public destroy(): void {
        this.stopAutoSync();
        this.observers = [];
        this.queueManager.unregisterQueueChangedListener(this.handleQueueSizeChange);
    }
}

// 创建单例实例
let syncManagerInstance: SyncManager | null = null;

/**
 * 获取同步管理器实例
 */
export const getSyncManager = (): SyncManager => {
    if (!syncManagerInstance) {
        syncManagerInstance = new SyncManager();
    }
    return syncManagerInstance;
};

/**
 * 注册同步观察者函数
 */
export const registerSyncObserver = (observer: SyncObserver): () => void => {
    return getSyncManager().registerObserver(observer);
};

/**
 * 同步离线队列
 */
export const syncOfflineQueue = async (): Promise<boolean> => {
    return getSyncManager().syncOfflineQueue();
};

/**
 * 重发消息
 */
export const resendMessage = async (sessionId: string, messageId: string): Promise<boolean> => {
    return getSyncManager().resendMessage(sessionId, messageId);
};