/**
 * WebSocket服务
 * 管理实时通信连接、消息发送接收和状态监控
 */

import { io, Socket } from 'socket.io-client';
import { WSMessage, ConnectionStatus, Message } from '../types';
import { API_CONFIG } from './config';
import { useAuth } from '../contexts/AuthContext';
import { nanoid } from 'nanoid';
import 'react-native-get-random-values';
import { useEffect } from 'react';
import { registerNetworkStatusCallback, getCurrentConnectionQuality, ConnectionQuality } from './networkService';

// 重新导出ConnectionQuality枚举，以便其他模块可以导入
export { ConnectionQuality };

// WebSocket服务单例
let wsInstance: WebSocketService | null = null;

// WebSocket状态监听器接口
export interface WSStatusListener {
    onStatusChange: (status: ConnectionStatus) => void;
    onConnectionQualityChange?: (quality: ConnectionQuality) => void;
    onOfflineMode?: () => void;
}

// WebSocket消息监听器接口
export interface WSMessageListener {
    onMessage: (message: WSMessage) => void;
    onMessageError?: (message: WSMessage) => void;
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
    baseReconnectInterval: 2000,      // 2秒
    maxReconnectInterval: 60000,      // 1分钟
    maxReconnectAttempts: 10,         // 10次
    backoffFactor: 1.5,               // 1.5倍
    useExponentialBackoff: true,      // 使用指数退避
    pingInterval: 30000,              // 30秒
    connectionTimeout: 15000,         // 15秒
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
 * WebSocket服务类
 */
export class WebSocketService {
    private socket: Socket | null = null;
    private statusListeners: WSStatusListener[] = [];
    private messageListeners: WSMessageListener[] = [];
    private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
    private reconnectAttempts: number = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private token: string | null = null;
    private messageQueue: WSMessage[] = [];
    private maxRetries: number = 3;
    private retryInterval: number = 5000; // 5秒
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
    public static getInstance(): WebSocketService {
        if (!wsInstance) {
            wsInstance = new WebSocketService();
        }
        return wsInstance;
    }

    /**
     * 初始化WebSocket连接
     * @param token 认证token
     */
    public init(token: string): void {
        // 如果token相同并且已连接，无需重新连接
        if (this.token === token && this.isConnected()) {
            return;
        }

        this.token = token;
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
                        },
                        auth: { token: this.token || '' }, // 使用auth字段传递token，提高兼容性
                        timeout: 15000, // 增加超时时间到15秒
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
            this.updateStatus(ConnectionStatus.CONNECTED);
            this.startPingTimer();

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
            } catch (error) {
                console.error('解析WebSocket消息时出错:', error);
            }
        });

        // 接收状态更新
        this.socket.on('status', (status: any) => {
            console.log('收到状态更新:', status);
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

        if (!this.pingInterval) {
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

                    this.socket.send(JSON.stringify(pingMessage));

                    // 如果超过2秒没收到pong，认为可能丢包
                    this.pingTimeoutId = setTimeout(() => {
                        // 未收到pong响应
                        console.warn('未收到pong响应，增加丢包计数');
                        this.packetLoss += 1;

                        // 如果连续多次未收到pong，可能连接有问题
                        if (this.packetLoss > 3) {
                            console.warn(`连续${this.packetLoss}次未收到pong响应，检查连接`);
                            this.checkConnectionHealth();
                        }
                    }, 2000);
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

            // 收到pong意味着连接正常，重置丢包计数
            this.packetLoss = 0;

            // 打印延迟信息（调试模式）
            if (this.debug) {
                console.log(`WebSocket延迟: ${this.currentLatency}ms`);
            }
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
     * 发送ping消息并记录时间
     */
    private sendPing(): void {
        if (this.socket && this.connectionStatus === ConnectionStatus.CONNECTED) {
            const pingId = nanoid(8);
            const timestamp = Date.now();

            const pingMessage: WSMessage = {
                type: 'ping',
                timestamp,
                metadata: {
                    pingId
                }
            };

            // 监听pong响应
            const pongListener = (data: any) => {
                if (data && data.pingId === pingId) {
                    const latency = Date.now() - timestamp;
                    this.recordPingLatency(latency);

                    // 移除监听器
                    this.socket?.off('pong', pongListener);
                } else {
                    // 增加丢包记录
                    this.packetLoss += 0.1;
                    this.packetLoss = Math.min(this.packetLoss, 1); // 最大1.0 (100%)
                }
            };

            // 添加临时pong监听
            this.socket.on('pong', pongListener);

            // 发送ping
            this.socket.emit('message', pingMessage);

            // 5秒内没收到响应视为丢包
            setTimeout(() => {
                this.socket?.off('pong', pongListener);
            }, 5000);
        }
    }

    /**
     * 记录ping延迟
     */
    private recordPingLatency(latency: number): void {
        this.pingHistory.push(latency);

        // 保持历史记录不超过最大值
        if (this.pingHistory.length > this.maxPingHistory) {
            this.pingHistory.shift();
        }

        // 计算平均延迟
        if (this.pingHistory.length > 0) {
            this.currentLatency = this.pingHistory.reduce((sum, val) => sum + val, 0) / this.pingHistory.length;
        }

        // 降低丢包率（如果有成功的响应）
        this.packetLoss = Math.max(0, this.packetLoss - 0.05);

        // 更新连接质量
        this.updateConnectionQuality();
    }

    /**
     * 更新连接质量
     */
    private updateConnectionQuality(): void {
        // 根据延迟和丢包率计算连接质量
        let newQuality = ConnectionQuality.UNKNOWN;

        if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
            newQuality = ConnectionQuality.UNKNOWN;
        } else if (this.packetLoss > 0.5) {
            newQuality = ConnectionQuality.POOR;
        } else if (this.currentLatency > 1000) {
            newQuality = ConnectionQuality.POOR;
        } else if (this.currentLatency > 500) {
            newQuality = ConnectionQuality.FAIR;
        } else {
            newQuality = ConnectionQuality.EXCELLENT;
        }

        // 只有在质量变化时才通知
        if (newQuality !== this.connectionQuality) {
            this.connectionQuality = newQuality;
            this.notifyQualityListeners();
        }
    }

    /**
     * 通知所有状态监听器
     */
    private notifyStatusListeners(): void {
        this.statusListeners.forEach(listener => {
            listener.onStatusChange(this.connectionStatus);
        });
    }

    /**
     * 通知所有消息监听器
     * @param message 收到的消息
     */
    private notifyMessageListeners(message: WSMessage): void {
        this.messageListeners.forEach(listener => {
            listener.onMessage(message);
        });
    }

    /**
     * 通知质量监听器
     */
    private notifyQualityListeners(): void {
        this.statusListeners.forEach(listener => {
            if (listener.onConnectionQualityChange) {
                listener.onConnectionQualityChange(this.connectionQuality);
            }
        });
    }

    /**
     * 添加状态监听器
     * @param listener 状态监听器
     */
    public addStatusListener(listener: WSStatusListener): void {
        this.statusListeners.push(listener);
    }

    /**
     * 移除状态监听器
     * @param listener 要移除的状态监听器
     */
    public removeStatusListener(listener: WSStatusListener): void {
        this.statusListeners = this.statusListeners.filter(l => l !== listener);
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
     * @param listener 要移除的消息监听器
     */
    public removeMessageListener(listener: WSMessageListener): void {
        this.messageListeners = this.messageListeners.filter(l => l !== listener);
    }

    /**
     * 发送消息
     * @param message 要发送的消息
     */
    public sendMessage(message: WSMessage): void {
        if (this.socket && this.connectionStatus === ConnectionStatus.CONNECTED) {
            try {
                this.socket.emit('message', message);
                // 发送成功后从队列中移除
                this.messageQueue = this.messageQueue.filter(msg => msg !== message);
            } catch (error) {
                console.error('发送消息失败:', error);
                this.handleMessageError(message);
            }
        } else {
            console.warn('尝试在未连接状态下发送消息');
            this.handleMessageError(message);
        }
    }

    private handleMessageError(message: WSMessage): void {
        // 将消息添加到队列
        if (!this.messageQueue.includes(message)) {
            this.messageQueue.push(message);
        }

        // 启动重试机制
        this.startRetryTimer();
    }

    private startRetryTimer(): void {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
        }

        this.retryTimer = setInterval(() => {
            if (this.connectionStatus === ConnectionStatus.CONNECTED && this.messageQueue.length > 0) {
                this.retrySendMessages();
            }
        }, this.retryInterval);
    }

    private retrySendMessages(): void {
        const failedMessages = [...this.messageQueue];
        this.messageQueue = [];

        failedMessages.forEach(message => {
            if (message.retryCount === undefined) {
                message.retryCount = 0;
            }

            if (message.retryCount < this.maxRetries) {
                message.retryCount++;
                this.sendMessage(message);
            } else {
                console.warn('消息发送失败，已达到最大重试次数:', message);
                // 通知消息发送失败
                this.notifyMessageError(message);
            }
        });
    }

    private notifyMessageError(message: WSMessage): void {
        // 通知所有监听器消息发送失败
        this.messageListeners.forEach(listener => {
            if ('onMessageError' in listener) {
                (listener as any).onMessageError(message);
            }
        });
    }

    /**
     * 发送聊天消息
     * @param content 消息内容
     * @param sessionId 会话ID
     * @param contentType 内容类型
     */
    public sendChatMessage(content: string, sessionId: string, contentType: string = 'text'): string {
        const messageId = `msg_${nanoid(10)}`;

        const message: Message = {
            id: messageId,
            sessionId,
            content,
            contentType: 'text' as const,
            senderType: 'agent',
            timestamp: new Date().toISOString(),
            status: 'sending',
        };

        const wsMessage: WSMessage = {
            type: 'message',
            payload: message,
            timestamp: Date.now(),
        };

        this.sendMessage(wsMessage);
        return messageId;
    }

    /**
     * 检查连接是否正常
     */
    public isConnected(): boolean {
        return this.connectionStatus === ConnectionStatus.CONNECTED;
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
     * 获取当前连接状态
     */
    public getStatus(): ConnectionStatus {
        return this.connectionStatus;
    }

    /**
     * 获取当前连接质量
     */
    public getConnectionQuality(): ConnectionQuality {
        return this.connectionQuality;
    }

    /**
     * 获取当前延迟
     */
    public getCurrentLatency(): number {
        return Math.round(this.currentLatency);
    }

    /**
     * 获取当前丢包率
     */
    public getPacketLoss(): number {
        return Math.round(this.packetLoss * 100);
    }

    /**
     * 发送ping消息来测试连接
     */
    private sendPingMessage(): void {
        if (this.socket && this.connectionStatus === ConnectionStatus.CONNECTED) {
            try {
                const pingMessage: WSMessage = {
                    type: 'ping',
                    timestamp: Date.now(),
                    metadata: {
                        deviceId: this.deviceId || 'unknown',
                    }
                };

                console.log('发送ping测试消息');
                this.socket.emit('message', pingMessage);
            } catch (error) {
                console.error('发送ping消息失败:', error);
            }
        }
    }

    /**
     * 更新连接状态并通知监听器
     * @param status 新的连接状态
     */
    private updateStatus(status: ConnectionStatus): void {
        this.connectionStatus = status;
        this.notifyStatusListeners();
    }

    /**
     * 生成唯一的消息ID
     */
    private generateMessageId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 开始连接质量检查
     */
    private startQualityCheck(): void {
        // 如果已经在检查中，先清除
        this.clearQualityCheck();

        // 每30秒检查一次
        this.qualityCheckInterval = setInterval(async () => {
            // 只在连接状态下检查质量
            if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
                return;
            }

            try {
                // 获取网络连接质量
                const networkQuality = await getCurrentConnectionQuality();
                let newQuality = networkQuality;

                // 基于延迟和丢包评估质量
                if (this.currentLatency > 500 || this.packetLoss > 10) {
                    // 高延迟或高丢包率表示连接质量差
                    newQuality = ConnectionQuality.POOR;
                } else if (this.currentLatency > 200 || this.packetLoss > 5) {
                    // 中等延迟或丢包率，最高为FAIR
                    if (networkQuality === ConnectionQuality.EXCELLENT || networkQuality === ConnectionQuality.GOOD) {
                        newQuality = ConnectionQuality.FAIR;
                    }
                }

                // 如果质量变化，通知监听器
                if (newQuality !== this.connectionQuality) {
                    this.connectionQuality = newQuality;
                    this.notifyQualityListeners();
                }
            } catch (error) {
                console.error('评估连接质量时出错:', error);
            }
        }, 30000);
    }

    /**
     * 清除质量检查间隔
     */
    private clearQualityCheck(): void {
        if (this.qualityCheckInterval) {
            clearInterval(this.qualityCheckInterval);
            this.qualityCheckInterval = null;
        }
    }
}

/**
 * 创建WebSocket钩子
 */
export function useWebSocket() {
    const { token } = useAuth();
    const wsService = WebSocketService.getInstance();

    // 使用useEffect监听token变化
    useEffect(() => {
        // 当token变化时更新连接
        wsService.updateToken(token);

        // 组件卸载时断开连接
        return () => {
            if (!token) {
                wsService.disconnect();
            }
        };
    }, [token]);

    return {
        sendMessage: (content: string, sessionId: string, contentType: string = 'text') =>
            wsService.sendChatMessage(content, sessionId, contentType),
        addMessageListener: (listener: WSMessageListener) =>
            wsService.addMessageListener(listener),
        removeMessageListener: (listener: WSMessageListener) =>
            wsService.removeMessageListener(listener),
        addStatusListener: (listener: WSStatusListener) =>
            wsService.addStatusListener(listener),
        removeStatusListener: (listener: WSStatusListener) =>
            wsService.removeStatusListener(listener),
        isConnected: () => wsService.isConnected(),
        status: wsService.getStatus(),
        connectionQuality: wsService.getConnectionQuality(),
        latency: wsService.getCurrentLatency(),
        packetLoss: wsService.getPacketLoss(),
    };
}
