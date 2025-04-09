import { WSMessage, ConnectionStatus } from '@/src/types';
// @ts-ignore
import * as SecureStore from '../adapters/SecureStoreBridge';

// 类型声明
type TimeoutId = ReturnType<typeof setTimeout> | null;
type IntervalId = ReturnType<typeof setInterval> | null;

// 常量定义
const WS_API_URL = 'wss://example.com/api/ws';
const API_KEY_STORE = 'apiKey';
const AUTH_TOKEN_STORE = 'authToken';
const INITIAL_RECONNECT_DELAY = 3000; // 初始重连延迟（毫秒）
const MAX_RECONNECT_DELAY = 30000; // 最大重连延迟（毫秒）
const RECONNECT_FACTOR = 1.5; // 重连延迟增长因子
const MAX_RECONNECT_ATTEMPTS = 10; // 最大重连尝试次数
const PING_INTERVAL = 30000; // ping间隔（毫秒）
const PONG_TIMEOUT = 5000; // pong超时时间（毫秒）
const MAX_MISSED_HEARTBEATS = 3; // 最大允许丢失心跳次数

// WebSocket 管理器单例类
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private messageHandlers: Array<(message: WSMessage) => void> = [];
  private connectionStateHandlers: Array<(isConnected: boolean) => void> = [];
  private _isConnected = false;
  private isConnecting = false;
  private reconnectTimeout: TimeoutId = null;
  private pingInterval: IntervalId = null;
  private reconnectAttempts = 0;
  private currentReconnectDelay = INITIAL_RECONNECT_DELAY;
  private missedHeartbeats = 0;
  private pongTimeout: TimeoutId = null;

  // 初始化WebSocket连接
  public async initialize(): Promise<void> {
    if (this.isConnecting || this._isConnected) {
      console.log('WebSocket连接已存在或正在连接中');
      return;
    }

    this.isConnecting = true;

    try {
      // 获取WebSocket URL（带有身份验证令牌）
      const wsUrl = await this.getWebSocketUrl();

      // 创建WebSocket连接
      this.ws = new WebSocket(wsUrl);

      // 设置事件处理程序
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

      console.log('WebSocket连接初始化中...');
    } catch (error) {
      console.error('初始化WebSocket失败:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  // 关闭WebSocket连接
  public close(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.stopPingInterval();

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.ws) {
        // 移除所有事件处理程序
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;

        // 如果连接开着，关闭它
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        }

        this.ws = null;
      }

      // 更新连接状态
      if (this._isConnected) {
        this._isConnected = false;
        this.notifyConnectionStateChange();
      }

      this.isConnecting = false;
      console.log('WebSocket连接已关闭');
      resolve();
    });
  }

  // 发送WebSocket消息
  public sendMessage(message: WSMessage): void {
    if (!this._isConnected || !this.ws) {
      console.error('无法发送消息：WebSocket未连接');
      throw new Error('WebSocket未连接');
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('发送WebSocket消息失败:', error);
      throw error;
    }
  }

  // 检查连接状态
  public isConnected(): boolean {
    return this._isConnected;
  }

  // 注册消息处理程序
  public registerMessageHandler(handler: (message: WSMessage) => void): () => void {
    this.messageHandlers.push(handler);

    // 返回用于注销处理程序的函数
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index !== -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  // 注册连接状态变化处理程序
  public registerConnectionStateHandler(handler: (isConnected: boolean) => void): () => void {
    this.connectionStateHandlers.push(handler);

    // 立即通知当前状态
    handler(this._isConnected);

    // 返回用于注销处理程序的函数
    return () => {
      const index = this.connectionStateHandlers.indexOf(handler);
      if (index !== -1) {
        this.connectionStateHandlers.splice(index, 1);
      }
    };
  }

  // 构建WebSocket URL（带有身份验证令牌）
  private async getWebSocketUrl(): Promise<string> {
    try {
      // 从安全存储中获取API密钥和身份验证令牌
      const apiKey = await SecureStore.getItemAsync(API_KEY_STORE);
      const authToken = await SecureStore.getItemAsync(AUTH_TOKEN_STORE);

      if (!apiKey) {
        throw new Error('API密钥不存在');
      }

      // 构建URL，添加查询参数
      const url = new URL(WS_API_URL);
      url.searchParams.append('apiKey', apiKey);

      if (authToken) {
        url.searchParams.append('token', authToken);
      }

      return url.toString();
    } catch (error) {
      console.error('获取WebSocket URL失败:', error);
      throw error;
    }
  }

  // 处理连接打开事件
  private handleOpen(): void {
    console.log('WebSocket连接已建立');
    this._isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.currentReconnectDelay = INITIAL_RECONNECT_DELAY;
    this.missedHeartbeats = 0;
    this.notifyConnectionStateChange();
    this.startPingInterval();
  }

  // 处理接收到的消息
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      // 处理pong消息
      if (message.type === 'pong') {
        this.missedHeartbeats = 0;
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
        return;
      }

      this.messageHandlers.forEach(handler => handler(message));
    } catch (error) {
      console.error('处理WebSocket消息失败:', error);
    }
  }

  // 处理连接关闭事件
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket连接已关闭: ${event.code} ${event.reason}`);

    // 更新状态
    this._isConnected = false;
    this.isConnecting = false;
    this.ws = null;

    // 停止ping间隔
    this.stopPingInterval();

    // 通知连接状态变化
    this.notifyConnectionStateChange();

    // 安排重新连接
    this.scheduleReconnect();
  }

  // 处理错误事件
  private handleError(event: Event): void {
    console.error('WebSocket错误:', event);

    // 连接错误可能不会触发关闭事件，因此我们手动关闭
    this.close();
  }

  // 通知所有连接状态处理程序
  private notifyConnectionStateChange(): void {
    this.connectionStateHandlers.forEach(handler => {
      try {
        handler(this._isConnected);
      } catch (error) {
        console.error('连接状态处理程序发生错误:', error);
      }
    });
  }

  // 安排重新连接
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('达到最大重连次数，停止重连');
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.initialize();
      this.reconnectAttempts++;
      this.currentReconnectDelay = Math.min(
        this.currentReconnectDelay * RECONNECT_FACTOR,
        MAX_RECONNECT_DELAY
      );
    }, this.currentReconnectDelay);
  }

  // 开始ping间隔以保持连接活动
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this._isConnected) {
        this.sendMessage({ type: 'ping', timestamp: Date.now() });
        this.missedHeartbeats++;

        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
        }

        this.pongTimeout = setTimeout(() => {
          if (this.missedHeartbeats >= MAX_MISSED_HEARTBEATS) {
            console.error('心跳检测失败，重新连接');
            this.close();
            this.initialize();
          }
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  // 停止ping间隔
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// 创建单例并导出
export const webSocketManager = new WebSocketManager();