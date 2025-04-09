/**
 * WebSocket通信服务
 * 提供实时通信能力，用于消息发送、接收和状态通知
 */

import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from './config';

// Socket实例
let socket: Socket | null = null;

// 事件监听器存储
const listeners: { [event: string]: ((data: any) => void)[] } = {};

/**
 * 初始化WebSocket连接
 * @param token JWT令牌
 * @param agentId 客服ID
 */
export function initSocket(token: string, agentId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 检查参数
      if (!token) {
        console.error('初始化WebSocket失败: 缺少token');
        return reject(new Error('初始化WebSocket失败: 缺少token'));
      }

      if (!agentId) {
        console.error('初始化WebSocket失败: 缺少agentId');
        return reject(new Error('初始化WebSocket失败: 缺少agentId'));
      }

      // 如果已存在连接，先断开
      if (socket) {
        console.log('断开现有WebSocket连接');
        socket.disconnect();
      }

      // 获取WebSocket服务器URL
      const wsUrl = API_CONFIG.WS_URL || 'ws://localhost:3001';
      console.log(`正在连接WebSocket服务器: ${wsUrl}`);

      // 创建新的Socket连接
      socket = io(wsUrl, {
        auth: { token }, // 使用auth对象传递token
        query: { agentId }, // 查询参数
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 15000, // 增加超时时间
      });

      // 连接事件
      socket.on('connect', () => {
        console.log('WebSocket已连接');
        resolve();
      });

      // 连接错误 - 提供更详细的错误信息
      socket.on('connect_error', (error) => {
        console.error('WebSocket连接错误:', error);
        console.error('错误详情:', JSON.stringify(error, null, 2));

        // 检查是否认证错误
        if (error.message && (error.message.includes('auth') || error.message.includes('jwt') || error.message.includes('token'))) {
          console.error('认证错误，请检查JWT Token是否有效');
        }

        reject(error);
      });

      // 重连尝试
      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`WebSocket尝试重连 #${attemptNumber}`);
      });

      // 断开连接
      socket.on('disconnect', (reason) => {
        console.log(`WebSocket断开连接: ${reason}`);
      });

      // 处理自定义消息
      socket.on('message', (data) => {
        handleEvent('message', data);
      });

      // 处理状态更新
      socket.on('status_update', (data) => {
        handleEvent('status_update', data);
      });

      // 处理新会话
      socket.on('new_session', (data) => {
        handleEvent('new_session', data);
      });

      // 处理会话关闭
      socket.on('session_closed', (data) => {
        handleEvent('session_closed', data);
      });

      // 处理正在输入状态
      socket.on('typing', (data) => {
        handleEvent('typing', data);
      });

    } catch (error) {
      console.error('初始化WebSocket失败:', error);
      reject(error);
    }
  });
}

/**
 * 处理WebSocket事件
 * @param event 事件名
 * @param data 事件数据
 */
function handleEvent(event: string, data: any): void {
  if (!listeners[event]) {
    return;
  }

  // 通知所有该事件的监听器
  listeners[event].forEach(callback => {
    try {
      callback(data);
    } catch (error) {
      console.error(`处理"${event}"事件时出错:`, error);
    }
  });
}

/**
 * 发送WebSocket消息
 * @param event 事件名称
 * @param data 消息数据
 * @returns 发送成功返回true，否则返回false
 */
export function sendMessage(event: string, data: any): boolean {
  if (!socket || !socket.connected) {
    console.error('发送消息失败: WebSocket未连接');
    return false;
  }

  try {
    socket.emit(event, data);
    return true;
  } catch (error) {
    console.error('发送消息失败:', error);
    return false;
  }
}

/**
 * 发送"正在输入"状态
 * @param isTyping 是否正在输入
 * @param sessionId 会话ID
 */
export function sendTypingStatus(isTyping: boolean, sessionId: string): void {
  if (!socket || !socket.connected) {
    return;
  }

  socket.emit('typing', { isTyping, sessionId });
}

/**
 * 添加事件监听器
 * @param event 事件名
 * @param callback 回调函数
 */
export function addEventListener(event: string, callback: (data: any) => void): void {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
}

/**
 * 移除事件监听器
 * @param event 事件名
 * @param callback 回调函数
 */
export function removeEventListener(event: string, callback: (data: any) => void): void {
  if (!listeners[event]) {
    return;
  }

  const index = listeners[event].indexOf(callback);
  if (index !== -1) {
    listeners[event].splice(index, 1);
  }
}

/**
 * 断开WebSocket连接
 * @returns Promise<void> 断开连接的Promise
 */
export async function disconnectSocket(): Promise<void> {
  if (socket) {
    console.log('主动断开WebSocket连接');
    socket.disconnect();
    socket = null;
  }

  // 清除所有监听器
  Object.keys(listeners).forEach(event => {
    listeners[event] = [];
  });

  console.log('WebSocket连接已断开，所有监听器已清除');
}

/**
 * 检查WebSocket连接状态
 * @returns 连接状态
 */
export function isConnected(): boolean {
  return socket !== null && socket.connected;
}

/**
 * 手动重新连接WebSocket
 * @returns 重连Promise
 */
export function reconnect(token?: string, agentId?: string): Promise<void> {
  // 记录重连尝试
  console.log('手动重新连接WebSocket...');

  // 如果没有提供新的token和agentId，尝试复用现有连接信息
  if (!token || !agentId) {
    if (!socket) {
      return Promise.reject(new Error('无法重连: 缺少token或agentId，且无现有连接信息'));
    }

    // 使用socket.io的重连机制
    const currentSocket = socket; // 复制引用以避免空引用问题
    currentSocket.connect();

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        currentSocket.off('connect', onConnect);
        reject(new Error('重连超时'));
      }, 10000);

      // 监听连接成功
      const onConnect = () => {
        clearTimeout(timeout);
        currentSocket.off('connect', onConnect);
        console.log('WebSocket手动重连成功');
        resolve();
      };

      currentSocket.once('connect', onConnect);
    });
  }

  // 提供了新的认证信息，重新初始化连接
  return initSocket(token, agentId);
}

/**
 * 发送消息
 * @param sessionId 会话ID
 * @param content 消息内容
 * @param type 消息类型
 * @param attachments 附件
 */
export function sendChatMessage(
  sessionId: string,
  content: string,
  type: string = 'text',
  attachments?: any[]
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new Error('WebSocket未连接'));
      return;
    }

    const message = {
      sessionId,
      content,
      type,
      attachments,
      timestamp: new Date().toISOString(),
    };

    try {
      socket.emit('send_message', message, (response: any) => {
        if (response && response.success) {
          resolve(true);
        } else {
          reject(new Error(response?.error || '发送消息失败'));
        }
      });
    } catch (error) {
      console.error('发送消息失败:', error);
      reject(error);
    }
  });
}

/**
 * 获取WebSocket连接详细信息
 * @returns 连接详细信息对象
 */
export function getConnectionInfo(): {
  isConnected: boolean;
  lastConnectedTime?: number;
  disconnectReason?: string;
  connectionAttempts?: number;
} {
  if (!socket) {
    return {
      isConnected: false,
      disconnectReason: '未初始化'
    };
  }

  return {
    isConnected: socket.connected,
    lastConnectedTime: socket.connected ? Date.now() : undefined,
    disconnectReason: socket.disconnected ? '已断开连接' : undefined,
    connectionAttempts: 0 // 目前没有办法直接从socket.io获取重连次数
  };
}