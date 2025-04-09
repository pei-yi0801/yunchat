import { webSocketManager } from './socketService';
import { isOnline, registerNetworkStatusCallback } from './networkService';
import {
  ConnectionStatus,
  Message,
  ChatSession,
  MessageStatus,
  SyncStatus,
  generateId
} from '@/src/types';
import {
  getMessages,
  getSessions,
  getOfflineQueue,
  addToOfflineQueue,
  removeFromOfflineQueue,
  addMessage,
  updateMessage,
  updateSession
} from './storageService';

// 同步状态
interface SyncState {
  isInitialSyncComplete: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncErrors: any[];
}

// 初始同步状态
const syncState: SyncState = {
  isInitialSyncComplete: false,
  isSyncing: false,
  lastSyncTime: null,
  syncErrors: [],
};

// 同步观察者
type SyncObserver = (state: SyncState) => void;
const syncObservers: SyncObserver[] = [];

/**
 * 初始化同步服务
 */
export const initSyncService = async (): Promise<void> => {
  try {
    // 监听网络状态变化
    registerNetworkStatusCallback(handleNetworkStatusChange);

    // 监听WebSocket消息
    if (webSocketManager && typeof webSocketManager.registerMessageHandler === 'function') {
      webSocketManager.registerMessageHandler(handleWebSocketMessage);
    } else {
      console.warn('无法注册WebSocket消息处理程序: webSocketManager未定义或缺少registerMessageHandler方法');
    }

    // 监听WebSocket连接状态
    if (webSocketManager && typeof webSocketManager.registerConnectionStateHandler === 'function') {
      webSocketManager.registerConnectionStateHandler(handleWebSocketConnection);
    } else {
      console.warn('无法注册WebSocket连接状态处理程序: webSocketManager未定义或缺少registerConnectionStateHandler方法');
    }
  } catch (error) {
    console.error('初始化同步服务时出错:', error);
  }
};

/**
 * 注册同步状态观察者
 * @param observer 观察者函数
 * @returns 取消注册的函数
 */
export const registerSyncObserver = (observer: SyncObserver): () => void => {
  syncObservers.push(observer);

  // 立即通知当前状态
  observer({ ...syncState });

  // 返回取消注册的函数
  return () => {
    const index = syncObservers.indexOf(observer);
    if (index !== -1) {
      syncObservers.splice(index, 1);
    }
  };
};

/**
 * 处理网络状态变化
 * @param status 网络状态
 */
const handleNetworkStatusChange = (status: ConnectionStatus): void => {
  if (status === ConnectionStatus.CONNECTED) {
    // 网络恢复时，尝试同步离线数据
    syncOfflineData();
  }
};

/**
 * 处理WebSocket连接状态变化
 * @param isConnected 是否已连接
 */
const handleWebSocketConnection = (isConnected: boolean): void => {
  if (isConnected) {
    // WebSocket连接恢复时，尝试同步离线数据
    syncOfflineData();
  }
};

/**
 * 处理WebSocket消息
 * @param message WebSocket消息
 */
const handleWebSocketMessage = async (message: any): Promise<void> => {
  // 只处理消息类型
  if (message.type !== 'message') return;

  try {
    const data = message.payload;

    if (data.type === 'new_message') {
      // 保存新消息到本地
      await addMessage(data.sessionId, data.message);
    } else if (data.type === 'message_status_update') {
      // 更新消息状态
      await updateMessage(data.sessionId, data.messageId, {
        status: data.status,
      });
    } else if (data.type === 'session_update') {
      // 更新会话
      await updateSession(data.session);
    }
  } catch (error) {
    console.error('处理WebSocket消息失败:', error);
  }
};

/**
 * 同步离线数据
 */
export const syncOfflineData = async (): Promise<void> => {
  // 如果已经在同步或者网络断开，直接返回
  if (syncState.isSyncing || !await isOnline() || !webSocketManager.isConnected()) {
    return;
  }

  // 更新同步状态
  updateSyncState({
    isSyncing: true,
    syncErrors: [],
  });

  try {
    // 获取离线队列
    const offlineQueue = await getOfflineQueue();

    if (offlineQueue.length === 0) {
      console.log('离线队列为空，无需同步');

      // 在这里获取服务器最新数据
      await fetchLatestData();

      // 更新同步状态
      updateSyncState({
        isSyncing: false,
        lastSyncTime: Date.now(),
        isInitialSyncComplete: true,
      });

      return;
    }

    console.log(`开始同步${offlineQueue.length}条离线消息`);

    // 按照时间顺序处理离线消息
    const sortedQueue = [...offlineQueue].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const offlineMessage of sortedQueue) {
      try {
        // 使用WebSocket发送消息
        webSocketManager.sendMessage({
          type: 'message',
          payload: {
            id: offlineMessage.id,
            sessionId: offlineMessage.sessionId,
            content: offlineMessage.content,
            contentType: offlineMessage.contentType,
            senderType: offlineMessage.senderType,
            timestamp: offlineMessage.timestamp,
            status: 'sent',
            isOffline: false,
            syncStatus: 'synced',
            ...(offlineMessage.attachments && { attachments: offlineMessage.attachments }),
            ...(offlineMessage.metadata && { metadata: offlineMessage.metadata })
          },
          timestamp: Date.now(),
          metadata: {
            sender: 'agent',
            messageType: 'new_message'
          }
        });

        // 更新本地消息状态
        await updateMessage(offlineMessage.sessionId, offlineMessage.id, {
          isOffline: false,
          syncStatus: 'synced',
        });

        // 从离线队列中移除
        await removeFromOfflineQueue(offlineMessage.id);

        console.log(`成功同步离线消息: ${offlineMessage.id}`);
      } catch (error) {
        console.error(`同步离线消息失败: ${offlineMessage.id}`, error);

        // 添加到同步错误中
        syncState.syncErrors.push({
          messageId: offlineMessage.id,
          error: error,
          timestamp: Date.now(),
        });
      }
    }

    // 获取服务器最新数据
    await fetchLatestData();

    // 更新同步状态
    updateSyncState({
      isSyncing: false,
      lastSyncTime: Date.now(),
      isInitialSyncComplete: true,
    });

    console.log('离线消息同步完成');
  } catch (error) {
    console.error('同步离线数据时出错:', error);

    // 更新同步状态
    updateSyncState({
      isSyncing: false,
      syncErrors: [...syncState.syncErrors, {
        error: error,
        timestamp: Date.now(),
      }],
    });
  }
};

/**
 * 从服务器获取最新数据
 */
const fetchLatestData = async (): Promise<void> => {
  try {
    // 获取上次同步时间
    const lastSyncTime = syncState.lastSyncTime || 0;

    // 向服务器请求最新数据（使用一个空的Message作为placeholder）
    webSocketManager.sendMessage({
      type: 'status',  // 使用status类型表示这是一个特殊请求
      timestamp: Date.now(),
      metadata: {
        messageType: 'fetch_latest',
        lastSyncTime: lastSyncTime
      }
    });

    // 注：实际应用中，服务器会回复最新数据，
    // 然后在handleWebSocketMessage中处理
  } catch (error) {
    console.error('获取最新数据失败:', error);
    throw error;
  }
};

/**
 * 处理消息发送
 * @param sessionId 会话ID
 * @param content 消息内容
 * @param contentType 内容类型
 * @param attachments 附件信息
 */
export const sendMessage = async (
  sessionId: string,
  content: string,
  contentType: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system' = 'text',
  attachments: any[] = []
): Promise<Message> => {
  try {
    // 创建新消息
    const newMessage: Message = {
      id: generateId('MESSAGE'),
      sessionId,
      content,
      contentType,
      senderType: 'agent',
      timestamp: new Date().toISOString(),
      status: 'sending' as MessageStatus,
      attachments,
      isOffline: !(await isOnline()),
      syncStatus: (await isOnline()) ? 'syncing' as SyncStatus : 'pending' as SyncStatus,
    };

    // 添加到本地存储
    await addMessage(sessionId, newMessage);

    // 如果在线，直接发送
    if (await isOnline() && webSocketManager.isConnected()) {
      try {
        webSocketManager.sendMessage({
          type: 'message',
          payload: {
            id: newMessage.id,
            sessionId: newMessage.sessionId,
            content: newMessage.content,
            contentType: newMessage.contentType,
            senderType: newMessage.senderType,
            timestamp: newMessage.timestamp,
            status: 'sent',
            isOffline: false,
            syncStatus: 'synced',
            ...(newMessage.attachments && { attachments: newMessage.attachments }),
            ...(newMessage.metadata && { metadata: newMessage.metadata })
          },
          timestamp: Date.now(),
          metadata: {
            sender: 'agent',
            messageType: 'new_message'
          }
        });

        // 更新消息状态为已发送
        await updateMessage(sessionId, newMessage.id, {
          status: 'sent' as MessageStatus,
          syncStatus: 'synced' as SyncStatus,
        });
      } catch (error) {
        console.error('发送消息失败:', error);

        // 发送失败，添加到离线队列
        await addToOfflineQueue(newMessage);

        // 更新消息状态
        await updateMessage(sessionId, newMessage.id, {
          status: 'failed' as MessageStatus,
          isOffline: true,
          syncStatus: 'pending' as SyncStatus,
        });
      }
    } else {
      // 离线状态，添加到离线队列
      await addToOfflineQueue(newMessage);
    }

    return newMessage;
  } catch (error) {
    console.error('处理消息发送时出错:', error);
    throw error;
  }
};

/**
 * 更新同步状态并通知观察者
 * @param updates 要更新的状态
 */
const updateSyncState = (updates: Partial<SyncState>): void => {
  // 更新状态
  Object.assign(syncState, updates);

  // 通知所有观察者
  syncObservers.forEach(observer => {
    try {
      observer({ ...syncState });
    } catch (error) {
      console.error('通知同步观察者失败:', error);
    }
  });
};

/**
 * 重新发送失败的消息
 * @param messageId 消息ID
 */
export const resendMessage = async (
  sessionId: string,
  messageId: string
): Promise<boolean> => {
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
      status: 'sending',
      syncStatus: 'syncing',
    });

    // 如果在线，尝试重新发送
    if (await isOnline() && webSocketManager.isConnected()) {
      try {
        webSocketManager.sendMessage({
          type: 'message',
          payload: {
            id: message.id,
            sessionId: message.sessionId,
            content: message.content,
            contentType: message.contentType,
            senderType: message.senderType,
            timestamp: message.timestamp,
            status: 'sent',
            isOffline: false,
            syncStatus: 'synced',
            ...(message.attachments && { attachments: message.attachments }),
            ...(message.metadata && { metadata: message.metadata })
          },
          timestamp: Date.now(),
          metadata: {
            sender: 'agent',
            messageType: 'new_message'
          }
        });

        // 更新消息状态
        await updateMessage(sessionId, messageId, {
          status: 'sent',
          syncStatus: 'synced',
          isOffline: false,
        });

        // 如果在离线队列中，移除
        await removeFromOfflineQueue(messageId);

        return true;
      } catch (error) {
        console.error('重发消息失败:', error);

        // 更新消息状态
        await updateMessage(sessionId, messageId, {
          status: 'failed',
          syncStatus: 'pending',
        });

        return false;
      }
    } else {
      // 确保消息在离线队列中
      if (message.syncStatus !== 'pending') {
        await addToOfflineQueue(message);
      }

      // 更新消息状态
      await updateMessage(sessionId, messageId, {
        status: 'pending',
        syncStatus: 'pending',
        isOffline: true,
      });

      return false;
    }
  } catch (error) {
    console.error('重发消息时出错:', error);
    return false;
  }
};