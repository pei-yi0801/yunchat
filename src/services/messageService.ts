/**
 * 消息服务
 * 管理消息的存储、发送和接收功能
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message, SyncStatus, WSMessage } from '../types';
import { WebSocketService, useWebSocket } from './websocket';
import { nanoid } from 'nanoid';
import 'react-native-get-random-values';
import NetInfo from '@react-native-community/netinfo';

// 存储键前缀
const MESSAGE_STORAGE_PREFIX = 'message_cache_';
const OFFLINE_MESSAGES_KEY = 'offline_messages';

/**
 * 消息管理服务类
 */
export class MessageService {
    private static instance: MessageService;
    private messageCache: Map<string, Message> = new Map();
    private offlineMessages: string[] = [];
    private wsService: WebSocketService;
    private isNetworkConnected: boolean = true;

    /**
     * 获取消息服务实例（单例模式）
     */
    public static getInstance(): MessageService {
        if (!MessageService.instance) {
            MessageService.instance = new MessageService();
        }
        return MessageService.instance;
    }

    /**
     * 构造函数
     */
    private constructor() {
        this.wsService = WebSocketService.getInstance();
        this.initNetworkListeners();
        this.loadOfflineMessages();
    }

    /**
     * 初始化网络状态监听
     */
    private initNetworkListeners(): void {
        NetInfo.addEventListener(state => {
            const isConnected = state.isConnected ?? false;

            // 网络状态变化
            if (!this.isNetworkConnected && isConnected) {
                // 从离线变为在线，尝试同步离线消息
                this.syncOfflineMessages();
            }

            this.isNetworkConnected = isConnected;
        });
    }

    /**
     * 加载离线消息
     */
    private async loadOfflineMessages(): Promise<void> {
        try {
            const offlineMessagesJson = await AsyncStorage.getItem(OFFLINE_MESSAGES_KEY);
            if (offlineMessagesJson) {
                this.offlineMessages = JSON.parse(offlineMessagesJson);
            }
        } catch (error) {
            console.error('加载离线消息失败:', error);
        }
    }

    /**
     * 保存离线消息
     */
    private async saveOfflineMessages(): Promise<void> {
        try {
            await AsyncStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(this.offlineMessages));
        } catch (error) {
            console.error('保存离线消息失败:', error);
        }
    }

    /**
     * 同步离线消息
     */
    public async syncOfflineMessages(): Promise<void> {
        if (!this.isNetworkConnected || !this.wsService.isConnected() || this.offlineMessages.length === 0) {
            return;
        }

        const messageIds = [...this.offlineMessages];

        for (const messageId of messageIds) {
            try {
                // 获取离线消息
                const messageJson = await AsyncStorage.getItem(`${MESSAGE_STORAGE_PREFIX}${messageId}`);
                if (messageJson) {
                    const message = JSON.parse(messageJson) as Message;

                    // 更新消息状态为同步中
                    message.syncStatus = 'syncing';
                    await this.updateMessageInStorage(message);

                    // 发送消息
                    const wsMessage: WSMessage = {
                        type: 'message',
                        payload: message,
                        timestamp: Date.now(),
                    };

                    this.wsService.sendMessage(wsMessage);

                    // 从离线消息列表中移除
                    this.offlineMessages = this.offlineMessages.filter(id => id !== messageId);
                    await this.saveOfflineMessages();

                    // 更新消息状态为已同步
                    message.syncStatus = 'synced';
                    await this.updateMessageInStorage(message);
                }
            } catch (error) {
                console.error(`同步离线消息 ${messageId} 失败:`, error);
            }
        }
    }

    /**
     * 更新存储中的消息
     * @param message 要更新的消息
     */
    private async updateMessageInStorage(message: Message): Promise<void> {
        try {
            // 更新缓存
            this.messageCache.set(message.id, message);

            // 更新存储
            await AsyncStorage.setItem(`${MESSAGE_STORAGE_PREFIX}${message.id}`, JSON.stringify(message));
        } catch (error) {
            console.error('更新消息失败:', error);
        }
    }

    /**
     * 发送消息
     * @param content 消息内容
     * @param sessionId 会话ID
     * @param contentType 消息类型
     */
    public async sendMessage(content: string, sessionId: string, contentType: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system' = 'text'): Promise<Message> {
        // 创建消息对象
        const messageId = `msg_${nanoid(10)}`;
        const now = new Date();

        const message: Message = {
            id: messageId,
            sessionId,
            content,
            contentType,
            senderType: 'agent',
            timestamp: now.toISOString(),
            status: 'sending',
            isOffline: !this.isNetworkConnected,
            syncStatus: this.isNetworkConnected ? 'synced' : 'pending',
        };

        // 保存到缓存和存储
        this.messageCache.set(messageId, message);
        await AsyncStorage.setItem(`${MESSAGE_STORAGE_PREFIX}${messageId}`, JSON.stringify(message));

        if (this.isNetworkConnected && this.wsService.isConnected()) {
            // 在线状态，直接发送
            const wsMessage: WSMessage = {
                type: 'message',
                payload: message,
                timestamp: Date.now(),
            };

            this.wsService.sendMessage(wsMessage);

            // 更新消息状态
            message.status = 'sent';
            await this.updateMessageInStorage(message);

        } else {
            // 离线状态，添加到离线消息队列
            message.isOffline = true;
            message.syncStatus = 'pending';
            await this.updateMessageInStorage(message);

            this.offlineMessages.push(messageId);
            await this.saveOfflineMessages();
        }

        return message;
    }

    /**
     * 加载会话消息
     * @param sessionId 会话ID
     */
    public async loadSessionMessages(sessionId: string): Promise<Message[]> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const messageKeys = keys.filter(key =>
                key.startsWith(MESSAGE_STORAGE_PREFIX) &&
                key.includes(sessionId)
            );

            const messageJsons = await AsyncStorage.multiGet(messageKeys);
            const messages: Message[] = [];

            for (const [, value] of messageJsons) {
                if (value) {
                    const message = JSON.parse(value) as Message;
                    if (message.sessionId === sessionId) {
                        messages.push(message);
                        this.messageCache.set(message.id, message);
                    }
                }
            }

            // 按时间戳排序
            return messages.sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

        } catch (error) {
            console.error('加载会话消息失败:', error);
            return [];
        }
    }

    /**
     * 更新消息状态
     * @param messageId 消息ID
     * @param status 新状态
     */
    public async updateMessageStatus(messageId: string, status: Message['status']): Promise<void> {
        const message = this.messageCache.get(messageId);

        if (message) {
            message.status = status;
            await this.updateMessageInStorage(message);
        }
    }

    /**
     * 删除消息
     * @param messageId 消息ID
     */
    public async deleteMessage(messageId: string): Promise<void> {
        try {
            // 从缓存中移除
            this.messageCache.delete(messageId);

            // 从存储中移除
            await AsyncStorage.removeItem(`${MESSAGE_STORAGE_PREFIX}${messageId}`);

            // 如果是离线消息，也从离线消息列表中移除
            if (this.offlineMessages.includes(messageId)) {
                this.offlineMessages = this.offlineMessages.filter(id => id !== messageId);
                await this.saveOfflineMessages();
            }
        } catch (error) {
            console.error('删除消息失败:', error);
        }
    }

    /**
     * 清除会话消息
     * @param sessionId 会话ID
     */
    public async clearSessionMessages(sessionId: string): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const messageKeys = keys.filter(key =>
                key.startsWith(MESSAGE_STORAGE_PREFIX) &&
                key.includes(sessionId)
            );

            // 从存储中删除
            await AsyncStorage.multiRemove(messageKeys);

            // 从缓存中删除
            for (const [id, message] of this.messageCache.entries()) {
                if (message.sessionId === sessionId) {
                    this.messageCache.delete(id);
                }
            }

            // 更新离线消息列表
            this.offlineMessages = this.offlineMessages.filter(messageId => {
                const message = this.messageCache.get(messageId);
                return !message || message.sessionId !== sessionId;
            });

            await this.saveOfflineMessages();

        } catch (error) {
            console.error('清除会话消息失败:', error);
        }
    }

    /**
     * 获取消息
     * @param messageId 消息ID
     */
    public async getMessage(messageId: string): Promise<Message | null> {
        // 先从缓存中获取
        if (this.messageCache.has(messageId)) {
            return this.messageCache.get(messageId) || null;
        }

        // 如果缓存中没有，从存储中获取
        try {
            const messageJson = await AsyncStorage.getItem(`${MESSAGE_STORAGE_PREFIX}${messageId}`);
            if (messageJson) {
                const message = JSON.parse(messageJson) as Message;
                this.messageCache.set(messageId, message);
                return message;
            }
        } catch (error) {
            console.error('获取消息失败:', error);
        }

        return null;
    }

    /**
     * 处理接收到的消息
     * @param message 收到的消息
     */
    public async processReceivedMessage(message: Message): Promise<void> {
        // 更新到缓存和存储
        this.messageCache.set(message.id, message);
        await AsyncStorage.setItem(`${MESSAGE_STORAGE_PREFIX}${message.id}`, JSON.stringify(message));
    }
}

/**
 * 使用消息服务的Hook
 */
export function useMessageService() {
    const messageService = MessageService.getInstance();
    const webSocket = useWebSocket();

    return {
        sendMessage: (content: string, sessionId: string, contentType: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system' = 'text') =>
            messageService.sendMessage(content, sessionId, contentType),
        loadMessages: (sessionId: string) =>
            messageService.loadSessionMessages(sessionId),
        updateMessageStatus: (messageId: string, status: Message['status']) =>
            messageService.updateMessageStatus(messageId, status),
        deleteMessage: (messageId: string) =>
            messageService.deleteMessage(messageId),
        clearSessionMessages: (sessionId: string) =>
            messageService.clearSessionMessages(sessionId),
        getMessage: (messageId: string) =>
            messageService.getMessage(messageId),
        syncOfflineMessages: () =>
            messageService.syncOfflineMessages(),
    };
}