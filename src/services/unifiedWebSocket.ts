/**
 * 统一WebSocket服务
 * 管理实时通信连接、消息发送接收和状态监控
 * 整合了原有的socket.ts、socketService.ts和websocket.ts的功能
 */

import { io, Socket } from 'socket.io-client';
import { WSMessage, ConnectionStatus, Message } from '../types';
import { API_CONFIG } from './config';
import { useAuth } from '../contexts/AuthContext';
import { nanoid } from 'nanoid';
import 'react-native-get-random-values';
import { useEffect } from 'react';
import { registerNetworkStatusCallback, getCurrentConnectionQuality, ConnectionQuality } from './networkService';
// @ts-ignore
import * as SecureStore from '../adapters/SecureStoreBridge';
import { WebSocketConfig } from '../config/websocket.config';

// 重新导出ConnectionQuality枚举，以便其他模块可以导入
export { ConnectionQuality };

// WebSocket服务单例
let wsInstance: UnifiedWebSocketService | null = null;

// WebSocket状态监听器接口
export interface WSStatusListener {
    onStatusChange: (status: ConnectionStatus) => void;
    onConnectionQualityChange?: (quality: ConnectionQuality) => void;
    onOfflineMode?: () => void;
}

// 事件监听器类型
type EventCallback = (data: any) => void;

// 事件监听器存储
const eventListeners: { [event: string]: EventCallback[] } = {};

// WebSocket消息监听器接口
export interface WSMessageListener {
    onMessage: (message: WSMessage) => void;
    onMessageError?: (error: any, message?: WSMessage) => void;
}

// WebSocket连接配置
interface WSConnectionConfig {
    // 基础重连间隔 (毫秒)
    baseReconnectInterval: number;
    // 最大重连间隔 (毫秒)
    maxReconnectInterval: number;
    // 最大重连尝试次数 (0表示无限尝试)
    maxReconnectAttempts: number;
    // 退避系数 (每次失败后重连间隔增加的倍数)
    backoffFactor: number;
    // 是否使用指数退避策略
    useExponentialBackoff: boolean;
    // ping间隔 (毫秒)
    pingInterval: number;
    // 超时时间 (毫秒)
    connectionTimeout: number;
}

// 默认连接配置
const DEFAULT_CONNECTION_CONFIG: WSConnectionConfig = {
    baseReconnectInterval: WebSocketConfig.CONNECTION.INITIAL_RECONNECT_DELAY,
    maxReconnectInterval: WebSocketConfig.CONNECTION.MAX_RECONNECT_DELAY,
    maxReconnectAttempts: WebSocketConfig.CONNECTION.MAX_RECONNECT_ATTEMPTS,
    backoffFactor: WebSocketConfig.CONNECTION.RECONNECT_FACTOR,
    useExponentialBackoff: true,
    pingInterval: WebSocketConfig.HEARTBEAT.PING_INTERVAL,
    connectionTimeout: 15000,
};

/**
 * 连接指数退避算法
 * 计算下一次重连等待时间
 */
const calculateBackoffDelay = (
    attempt: number,
    baseInterval: number,
    maxInterval: number,
    factor: number,
    useExponential: boolean
): number => {
    // 线性退避
    if (!useExponential) {
        return Math.min(baseInterval * attempt, maxInterval);
    }

    // 指数退避: baseInterval * (factor ^ attempt)
    // 添加一点随机性，避免连接风暴
    const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
    const delay = baseInterval * Math.pow(factor, attempt) * jitter;

    // 确保不超过最大间隔
    return Math.min(delay, maxInterval);
};

/**
 * 统一WebSocket服务类
 */
export class UnifiedWebSocketService {
    private socket: Socket | null = null;
    private statusListeners: WSStatusListener[] = [];
    private messageListeners: WSMessageListener[] = [];
    private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
    private reconnectAttempts: number = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private token: string | null = null;
    private messageQueue: WSMessage[] = [];
    private maxRetries: number = WebSocketConfig.MESSAGE.MAX_RETRY_ATTEMPTS;
    private retryInterval: number = WebSocketConfig.MESSAGE.RETRY_DELAY;
    private retryTimer: NodeJS.Timeout | null = null;
    private pingHistory: number[] = [];
    private maxPingHistory: number = 10;
    private currentLatency: number = 0;
    private packetLoss: number = 0;
    private connectionQuality: ConnectionQuality = ConnectionQuality.UNKNOWN;
    private qualityCheckInterval: NodeJS.Timeout | null = null;
    private deviceId: string | null = null;
    private connectionConfig: WSConnectionConfig;
    private networkAvailable: boolean = true;
    private reconnectTimeoutId: NodeJS.Timeout | null = null;
    private lastConnectionTime: number = 0;
    private lastPingSentTime: number = 0;
    private pingTimeoutId: NodeJS.Timeout | null = null;
    private pingTimer: NodeJS.Timeout | null = null;
    private debug: boolean = false;
    private eventEmitter: any;
    private typingStatus: { [sessionId: string]: boolean } = {};
    private agentId: string | null = null;
    private missedHeartbeats: number = 0;
    private pongTimeout: NodeJS.Timeout | null = null;

    /**
     * 构造函数
     * @param customConfig 自定义连接配置
     */
    constructor(customConfig?: Partial<WSConnectionConfig>) {
        // 合并默认配置和自定义配置
        this.connectionConfig = {
            ...DEFAULT_CONNECTION_CONFIG,
            ...customConfig
        };

        // 监听网络状态变化
        registerNetworkStatusCallback((status) => {
            const online = status === ConnectionStatus.CONNECTED;
            this.networkAvailable = online;

            if (online && this.connectionStatus === ConnectionStatus.DISCONNECTED) {
                // 网络恢复，尝试重连
                console.log('网络已恢复，尝试重新连接WebSocket');
                this.reconnectAttempts = 0; // 重置重连次数
                this.attemptReconnect();
            } else if (!online && this.connectionStatus === ConnectionStatus.CONNECTED) {
                // 网络断开，记录断开状态
                console.log('网络已断开，WebSocket连接将受到影响');
                this.updateStatus(ConnectionStatus.DISCONNECTED);
            }
        });
    }

    /**
     * 获取WebSocket服务实例（单例模式）
     */
    public static getInstance(): UnifiedWebSocketService {
        if (!wsInstance) {
            wsInstance = new UnifiedWebSocketService();
        }
        return wsInstance;
    }

    /**
     * 初始化WebSocket连接
     * @param token 认证token
     * @param agentId 客服ID
     */
    public init(token: string, agentId?: string): void {
        // 如果token相同并且已连接，无需重新连接
        if (this.token === token && this.isConnected()) {
            return;
        }

        this.token = token;
        if (agentId) {
            this.agentId = agentId;
        }
        this.connect();
    }

    /**
     * 更新认证令牌并重新连接
     * @param token 新的认证令牌
     */
    public updateToken(token: string | null): void {
        // 如果token为空，断开连接
        if (!token) {
            this.disconnect();
            this.token = null;
            return;
        }

        // 如果token变化，更新并重新连接
        if (this.token !== token) {
            this.token = token;
            this.connect();
        }
    }

    /**
     * 连接WebSocket服务器
     */
    private connect(): void {
        // 如果已经在连接中，则忽略
        if (this.connectionStatus === ConnectionStatus.CONNECTING) {
            return;
        }

        this.updateStatus(ConnectionStatus.CONNECTING);

        try {
            // 从环境变量获取WebSocket URL
            const wsUrl = process.env.WS_URL || API_CONFIG.WS_URL || 'ws://localhost:3001';

            // 添加调试信息
            console.log(`正在连接WebSocket服务器: ${wsUrl}`);

            // 检查服务器可用性
            this.checkServerAvailability(wsUrl)
                .then(available => {
                    if (!available) {
                        console.log('WebSocket服务器不可用，将使用离线模式');
                        this.fallbackToOfflineMode();
                        return;
                    }

                    // 创建Socket.io连接
                    this.socket = io(wsUrl, {
                        transports: ['websocket', 'polling'], // 优先使用WebSocket，但允许降级到polling
                        reconnection: false, // 我们自己处理重连
                        query: {
                            token: this.token || '',
                            deviceId: this.deviceId || nanoid(10),
                            version: process.env.API_VERSION || 'v1',
                            agentId: this.agentId || ''
                        },
                        auth: { token: this.token || '' }, // 使用auth字段传递token，提高兼容性
                        timeout: this.connectionConfig.connectionTimeout,
                    });

                    // 添加调试信息
                    console.log('Socket.io实例已创建，正在建立连接...');

                    // 设置Socket.io事件处理器
                    this.setupSocketEventHandlers();
                })
                .catch(error => {
                    console.error('检查服务器可用性时出错:', error);
                    this.fallbackToOfflineMode();
                });
        } catch (error) {
            console.error('初始化WebSocket连接时出错:', error);
            this.attemptReconnect();
        }
    }

    /**
     * 检查服务器可用性
     */
    private async checkServerAvailability(url: string): Promise<boolean> {
        try {
            // 从WebSocket URL创建HTTP URL以进行健康检查
            const httpUrl = url.replace('ws:', 'http:').replace('wss:', 'https:');
            const healthUrl = `${httpUrl}/health`;

            // 使用fetch进行健康检查，并添加超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 增加到 15 秒超时

            const response = await fetch(healthUrl, {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return true; // 如果请求没有抛出错误，认为服务器可用
        } catch (error) {
            console.warn('服务器健康检查失败:', error);
            return false;
        }
    }

    /**
     * 设置Socket.io事件处理器
     */
    private setupSocketEventHandlers(): void {
        if (!this.socket) return;

        // 连接成功
        this.socket.on('connect', () => {
            console.log('WebSocket连接成功');
            this.reconnectAttempts = 0;
            this.lastConnectionTime = Date.now();
            this.updateStatus(ConnectionStatus.CONNECTED);
            this.startPingTimer();
            this.startQualityCheck();

            // 发送一条测试消息以验证连接是否正常工作
            this.sendPingMessage();
        });

        // 连接错误 - 提供更多详细的错误信息
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket连接错误:', error);
            console.error('错误详情:', JSON.stringify(error, null, 2));

            // 检查是否是认证错误
            if (error.message && (error.message.includes('auth') || error.message.includes('jwt') || error.message.includes('token'))) {
                console.error('认证错误，请检查JWT Token是否有效');
            }

            this.updateStatus(ConnectionStatus.DISCONNECTED);
            this.attemptReconnect();
        });

        // 连接超时
        this.socket.on('connect_timeout', () => {
            console.error('WebSocket连接超时');
            this.updateStatus(ConnectionStatus.DISCONNECTED);
            this.attemptReconnect();
        });

        // 断开连接
        this.socket.on('disconnect', (reason) => {
            console.log(`WebSocket断开连接: ${reason}`);
            this.updateStatus(ConnectionStatus.DISCONNECTED);

            // 如果是服务器主动断开，尝试重连
            if (reason === 'io server disconnect') {
                this.attemptReconnect();
            }
        });

        // 接收消息
        this.socket.on('message', (message: any) => {
            try {
                const wsMessage = message as WSMessage;
                this.notifyMessageListeners(wsMessage);
                // 通知事件监听器
                // 遍历事件监听器并触发消息事件
                if (eventListeners['message']) {
                    eventListeners['message'].forEach(callback => {
                        try {
                            callback(wsMessage);
                        } catch (error) {
                            console.error('执行消息事件回调时出错:', error);
                        }
                    });
                }
            } catch (error) {
                console.error('解析WebSocket消息时出错:', error);
            }
        });

        // 接收状态更新
        this.socket.on('status_update', (status: any) => {
            console.log('收到状态更新:', status);
            this.handleEvent('status_update', status);
        });

        // 接收新会话
        this.socket.on('new_session', (data: any) => {
            this.handleEvent('new_session', data);
        });

        // 接收会话关闭
        this.socket.on('session_closed', (data: any) => {
            this.handleEvent('session_closed', data);
        });

        // 接收typing状态
        this.socket.on('typing', (data: any) => {
            this.handleEvent('typing', data);
        });

        // 接收pong响应
        this.socket.on('pong', (data: any) => {
            this.handlePong(data);
        });

        // 错误处理
        this.socket.on('error', (error: any) => {
            console.error('WebSocket错误:', error);
        });
    }

    /**
     * 检查连接是否正常
     */
    public isConnected(): boolean {
        return this.connectionStatus === ConnectionStatus.CONNECTED;
    }

    /**
     * 更新连接状态并通知监听器
     * @param status 新的连接状态
     */
    private updateStatus(status: ConnectionStatus): void {
        if (this.connectionStatus !== status) {
            this.connectionStatus = status;
            this.notifyStatusListeners();
        }
    }

    /**
     * 断开WebSocket连接
     */
    public disconnect(): void {
        this.clearPingTimer();
        this.clearQualityCheck();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        // 重置重连相关状态
        this.reconnectAttempts = 0;

        // 清空消息队列
        this.messageQueue = [];

        this.updateStatus(ConnectionStatus.DISCONNECTED);
    }

    /**
     * 尝试重新连接
     */
    private attemptReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // 如果没有网络连接，不尝试重连
        if (!this.networkAvailable) {
            console.log('网络未连接，不尝试重连');
            this.fallbackToOfflineMode();
            return;
        }
        if (this.reconnectAttempts < this.connectionConfig.maxReconnectAttempts ||
            this.connectionConfig.maxReconnectAttempts === 0) {

            this.reconnectAttempts++;

            // 计算指数退避延迟
            const delay = calculateBackoffDelay(
                this.reconnectAttempts,
                this.connectionConfig.baseReconnectInterval,
                this.connectionConfig.maxReconnectInterval,
                this.connectionConfig.backoffFactor,
                this.connectionConfig.useExponentialBackoff
            );

            console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.connectionConfig.maxReconnectAttempts || '无限'})，延迟: ${delay}ms...`);

            this.reconnectTimer = setTimeout(() => {
                this.connect();
            }, delay);
        } else if (this.connectionConfig.maxReconnectAttempts > 0) {
            console.log('达到最大重连次数，放弃重连并切换到离线模式');
            this.fallbackToOfflineMode();
        }
    }

    /**
     * 切换到离线模式
     */
    private fallbackToOfflineMode(): void {
        this.updateStatus(ConnectionStatus.DISCONNECTED);

        // 通知所有监听器连接断开并切换至离线模式
        this.notifyStatusListeners();

        // 触发离线模式事件，应用可以在这里进行特殊处理
        if (this.eventEmitter) {
            this.eventEmitter.emit('offlineMode', {
                lastConnectionTime: this.lastConnectionTime,
                reconnectAttempts: this.reconnectAttempts,
                reason: 'max_reconnect_attempts_reached'
            });
        }

        console.log('已切换到离线模式，消息将存储在本地队列');
    }

    /**
     * 启动ping保活机制
     */
    private startPingTimer(): void {
        // 清除现有的ping定时器
        this.clearPingTimer();

        if (!this.connectionConfig.pingInterval) {
            return;
        }

        this.pingTimer = setInterval(() => {
            if (this.connectionStatus === ConnectionStatus.CONNECTED && this.socket) {
                try {
                    // 记录发送ping的时间
                    this.lastPingSentTime = Date.now();

                    // 发送ping消息
                    const pingMessage = {
                        type: 'ping',
                        id: this.generateMessageId(),
                        timestamp: this.lastPingSentTime
                    };

                    this.socket.emit('ping', pingMessage);
                    this.missedHeartbeats++;

                    // 如果超过2秒没收到pong，认为可能丢包
                    this.pingTimeoutId = setTimeout(() => {
                        // 未收到pong响应
                        console.warn('未收到pong响应，增加丢包计数');
                        this.packetLoss += 1;

                        // 如果连续多次未收到pong，可能连接有问题
                        if (this.packetLoss > WebSocketConfig.HEARTBEAT.MAX_MISSED_HEARTBEATS) {
                            console.warn(`连续${this.packetLoss}次未收到pong响应，检查连接`);
                            this.checkConnectionHealth();
                        }
                    }, WebSocketConfig.HEARTBEAT.PONG_TIMEOUT);
                } catch (error) {
                    console.error('发送ping消息失败:', error);
                }
            }
        }, this.connectionConfig.pingInterval);
    }

    /**
     * 清除ping定时器
     */
    private clearPingTimer(): void {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }

        if (this.pingTimeoutId) {
            clearTimeout(this.pingTimeoutId);
            this.pingTimeoutId = null;
        }

        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
    }

    /**
     * 检查连接健康状况
     */
    private checkConnectionHealth(): void {
        if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
            return;
        }

        // 如果丢包率过高或延迟过大，尝试重连
        if (this.packetLoss > 5 || this.currentLatency > 1000) {
            console.warn('连接质量差，尝试重新建立连接');
            this.disconnect();
            this.attemptReconnect();
        }
    }

    /**
     * 处理收到的pong消息
     */
    private handlePong(data: any): void {
        if (this.lastPingSentTime) {
            // 计算往返延迟
            const now = Date.now();
            this.currentLatency = now - this.lastPingSentTime;

            // 清除ping超时计时器
            if (this.pingTimeoutId) {
                clearTimeout(this.pingTimeoutId);
                this.pingTimeoutId = null;
            }

            // 收到pong意味着连接正常，重置丢包计数和心跳计数
            this.packetLoss = 0;
            this.missedHeartbeats = 0;

            // 记录ping历史
            this.pingHistory.push(this.currentLatency);
            if (this.pingHistory.length > this.maxPingHistory) {
                this.pingHistory.shift();
            }

            // 更新连接质量
            this.updateConnectionQuality();
        }
    }

    // notifyConnectionQualityChange 方法已移至下方实现

    /**
     * 启动连接质量检查
     */
    private startQualityCheck(): void {
        this.clearQualityCheck();

        // 每30秒检查一次连接质量
        this.qualityCheckInterval = setInterval(() => {
            if (this.connectionStatus === ConnectionStatus.CONNECTED) {
                this.sendPingMessage();
            }
        }, 30000);
    }

    /**
     * 清除质量检查定时器
     */
    private clearQualityCheck(): void {
        if (this.qualityCheckInterval) {
            clearInterval(this.qualityCheckInterval);
            this.qualityCheckInterval = null;
        }
    }

    /**
     * 发送ping消息
     */
    private sendPingMessage(): void {
        if (!this.socket || !this.isConnected()) {
            return;
        }

        try {
            const pingMessage = {
                type: 'ping',
                id: this.generateMessageId(),
                timestamp: Date.now()
            };

            this.socket.emit('ping', pingMessage);
        } catch (error) {
            console.error('发送ping消息失败:', error);
        }
    }

    /**
     * 生成唯一消息ID
     */
    private generateMessageId(): string {
        return `msg_${nanoid(10)}`;
    }

    /**
     * 通知状态监听器
     */
    private notifyStatusListeners(): void {
        for (const listener of this.statusListeners) {
            try {
                listener.onStatusChange(this.connectionStatus);
            } catch (error) {
                console.error('通知状态监听器时出错:', error);
            }
        }
    }

    /**
     * 通知连接质量变化
     */
    private notifyConnectionQualityChange(): void {
        for (const listener of this.statusListeners) {
            if (listener.onConnectionQualityChange) {
                try {
                    listener.onConnectionQualityChange(this.connectionQuality);
                } catch (error) {
                    console.error('通知连接质量变化时出错:', error);
                }
            }
        }
    }

    /**
     * 通知离线模式
     */
    private notifyOfflineMode(): void {
        for (const listener of this.statusListeners) {
            if (listener.onOfflineMode) {
                try {
                    listener.onOfflineMode();
                } catch (error) {
                    console.error('通知离线模式时出错:', error);
                }
            }
        }
    }

    /**
     * 通知消息监听器
     */
    private notifyMessageListeners(message: WSMessage): void {
        for (const listener of this.messageListeners) {
            try {
                listener.onMessage(message);
            } catch (error) {
                console.error('通知消息监听器时出错:', error);
                if (listener.onMessageError) {
                    try {
                        listener.onMessageError(error, message);
                    } catch (innerError) {
                        console.error('处理消息错误回调时出错:', innerError);
                    }
                }
            }
        }
    }

    /**
     * 添加状态监听器
     * @param listener 状态监听器
     */
    public addStatusListener(listener: WSStatusListener): void {
        this.statusListeners.push(listener);

        // 立即通知当前状态
        try {
            listener.onStatusChange(this.connectionStatus);
            if (listener.onConnectionQualityChange) {
                listener.onConnectionQualityChange(this.connectionQuality);
            }
        } catch (error) {
            console.error('通知新添加的状态监听器时出错:', error);
        }
    }

    /**
     * 移除状态监听器
     * @param listener 状态监听器
     */
    public removeStatusListener(listener: WSStatusListener): void {
        const index = this.statusListeners.indexOf(listener);
        if (index !== -1) {
            this.statusListeners.splice(index, 1);
        }
    }

    /**
     * 添加消息监听器
     * @param listener 消息监听器
     */
    public addMessageListener(listener: WSMessageListener): void {
        this.messageListeners.push(listener);
    }

    /**
     * 移除消息监听器
     * @param listener 消息监听器
     */
    public removeMessageListener(listener: WSMessageListener): void {
        const index = this.messageListeners.indexOf(listener);
        if (index !== -1) {
            this.messageListeners.splice(index, 1);
        }
    }

    /**
     * 添加事件监听器
     * @param event 事件名称
     * @param callback 回调函数
     */
    public addEventListener(event: string, callback: EventCallback): void {
        if (!eventListeners[event]) {
            eventListeners[event] = [];
        }
        eventListeners[event].push(callback);
    }

    /**
     * 移除事件监听器
     * @param event 事件名称
     * @param callback 回调函数
     */
    public removeEventListener(event: string, callback: EventCallback): void {
        if (!eventListeners[event]) {
            return;
        }

        const index = eventListeners[event].indexOf(callback);
        if (index !== -1) {
            eventListeners[event].splice(index, 1);
        }
    }

    /**
     * 处理事件
     * @param event 事件名称
     * @param data 事件数据
     */
    private handleEvent(event: string, data: any): void {
        if (!eventListeners[event]) {
            return;
        }

        // 通知所有该事件的监听器
        eventListeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`处理"${event}"事件时出错:`, error);
            }
        });
    }

    /**
     * 发送WebSocket消息
     * @param message 消息对象
     * @returns 是否发送成功
     */
    public sendMessage(message: WSMessage): boolean {
        if (!this.isConnected()) {
            console.warn('WebSocket未连接，消息将加入队列');
            this.queueMessage(message);
            return false;
        }

        try {
            if (!this.socket) {
                throw new Error('WebSocket实例不存在');
            }

            this.socket.emit('message', message);
            return true;
        } catch (error) {
            console.error('发送WebSocket消息失败:', error);
            this.queueMessage(message);
            return false;
        }
    }

    /**
     * 将消息加入队列
     * @param message 消息对象
     */
    private queueMessage(message: WSMessage): void {
        // 添加到队列
        this.messageQueue.push(message);
        console.log(`消息已加入队列，当前队列长度: ${this.messageQueue.length}`);

        // 如果队列过长，移除最旧的消息
        if (this.messageQueue.length > WebSocketConfig.OFFLINE_QUEUE.MAX_QUEUE_SIZE) {
            this.messageQueue.shift();
            console.warn('消息队列已达到最大长度，最旧的消息已被移除');
        }

        // 保存队列到本地存储
        this.persistMessageQueue();
    }

    /**
     * 持久化消息队列到本地存储
     */
    private async persistMessageQueue(): Promise<void> {
        try {
            await SecureStore.setItemAsync(
                WebSocketConfig.OFFLINE_QUEUE.STORAGE_KEY,
                JSON.stringify(this.messageQueue)
            );
        } catch (error) {
            console.error('保存消息队列到本地存储失败:', error);
        }
    }

    /**
     * 从本地存储加载消息队列
     */
    private async loadMessageQueue(): Promise<void> {
        try {
            const queueData = await SecureStore.getItemAsync(WebSocketConfig.OFFLINE_QUEUE.STORAGE_KEY);
            if (queueData) {
                this.messageQueue = JSON.parse(queueData);
                console.log(`从本地存储加载了${this.messageQueue.length}条消息`);
            }
        } catch (error) {
            console.error('从本地存储加载消息队列失败:', error);
            // 如果加载失败，重置队列
            this.messageQueue = [];
        }
    }

    /**
     * 发送队列中的消息
     */
    private async sendQueuedMessages(): Promise<void> {
        if (!this.isConnected() || this.messageQueue.length === 0) {
            return;
        }

        console.log(`尝试发送队列中的${this.messageQueue.length}条消息`);

        // 创建队列副本并清空原队列
        const queueCopy = [...this.messageQueue];
        this.messageQueue = [];

        // 保存空队列到本地存储
        await this.persistMessageQueue();

        // 发送队列中的消息
        for (const message of queueCopy) {
            try {
                if (this.socket) {
                    this.socket.emit('message', message);
                    // 添加小延迟避免服务器过载
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    throw new Error('WebSocket实例不存在');
                }
            } catch (error) {
                console.error('发送队列消息失败:', error);
                // 将失败的消息重新加入队列
                this.queueMessage(message);
            }
        }

        console.log('队列消息处理完成');
    }

    // 重复的sendPingMessage方法已删除

    /**
     * 发送"正在输入"状态
     * @param isTyping 是否正在输入
     * @param sessionId 会话ID
     */
    public sendTypingStatus(isTyping: boolean, sessionId: string): void {
        if (!this.isConnected() || !this.socket) {
            return;
        }

        // 如果状态没变，不发送
        if (this.typingStatus[sessionId] === isTyping) {
            return;
        }

        // 更新状态
        this.typingStatus[sessionId] = isTyping;

        try {
            this.socket.emit('typing', { isTyping, sessionId });
        } catch (error) {
            console.error('发送typing状态失败:', error);
        }
    }

    /**
     * 更新连接质量
     */
    private async updateConnectionQuality(): Promise<void> {
        // 获取当前网络连接质量
        const networkQuality = await getCurrentConnectionQuality();

        // 计算WebSocket连接质量
        let wsQuality = ConnectionQuality.UNKNOWN;

        // 如果有足够的ping历史记录
        if (this.pingHistory.length >= 3) {
            const avgLatency = this.pingHistory.reduce((sum, val) => sum + val, 0) / this.pingHistory.length;

            if (avgLatency < 100 && this.packetLoss === 0) {
                wsQuality = ConnectionQuality.EXCELLENT;
            } else if (avgLatency < 300 && this.packetLoss <= 0.05) {
                wsQuality = ConnectionQuality.GOOD;
            } else if (avgLatency < 600 && this.packetLoss <= 0.1) {
                wsQuality = ConnectionQuality.FAIR;
            } else {
                wsQuality = ConnectionQuality.POOR;
            }
        }

        // 取网络质量和WebSocket质量中较差的一个
        const finalQuality = this.getWorseQuality(networkQuality, wsQuality);

        // 如果质量变化，通知监听器
        if (finalQuality !== this.connectionQuality) {
            this.connectionQuality = finalQuality;
            this.notifyConnectionQualityChange();
        }
    }

    /**
     * 获取两个连接质量中较差的一个
     */
    private getWorseQuality(quality1: ConnectionQuality, quality2: ConnectionQuality): ConnectionQuality {
        const qualityRank = {
            [ConnectionQuality.UNKNOWN]: 0,
            [ConnectionQuality.POOR]: 1,
            [ConnectionQuality.FAIR]: 2,
            [ConnectionQuality.GOOD]: 3,
            [ConnectionQuality.EXCELLENT]: 4
        };

        return qualityRank[quality1] <= qualityRank[quality2] ? quality1 : quality2;
    }
}