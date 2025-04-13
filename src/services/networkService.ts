// @ts-ignore
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { ConnectionStatus } from '@/src/types';
import { getSessions, getOfflineQueue, addToOfflineQueue, removeFromOfflineQueue } from './storageService';
import { WebSocketService } from './websocket';

// 网络状态监听器
let netInfoSubscription: NetInfoSubscription | null = null;

// 网络状态变化回调函数
type NetworkStatusCallback = (status: ConnectionStatus) => void;

// 连接质量等级
export enum ConnectionQuality {
  UNKNOWN = 'unknown',
  POOR = 'poor',
  FAIR = 'fair',
  GOOD = 'good',
  EXCELLENT = 'excellent'
}

// 网络类型映射到质量
const networkTypeQualityMap: Record<string, ConnectionQuality> = {
  'unknown': ConnectionQuality.UNKNOWN,
  'none': ConnectionQuality.POOR,
  'cellular': ConnectionQuality.FAIR,
  'wifi': ConnectionQuality.GOOD,
  'ethernet': ConnectionQuality.EXCELLENT,
  'bluetooth': ConnectionQuality.FAIR,
  'wimax': ConnectionQuality.GOOD,
  'vpn': ConnectionQuality.FAIR,
  'other': ConnectionQuality.FAIR
};

// 状态回调存储
const networkCallbacks: NetworkStatusCallback[] = [];

// 连接质量回调类型
type ConnectionQualityCallback = (quality: ConnectionQuality) => void;

// 质量回调存储
const qualityCallbacks: ConnectionQualityCallback[] = [];

// 最后一次测量的网络状态
let lastNetworkState: NetInfoState | null = null;

/**
 * 检查网络连接状态
 * @returns 是否在线
 */
export const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    lastNetworkState = state;
    return !!state.isConnected;
  } catch (error) {
    console.error('检查网络状态失败:', error);
    return false;
  }
};

/**
 * 注册网络状态回调
 * @param callback 网络状态回调
 * @returns 取消注册函数
 */
export const registerNetworkStatusCallback = (callback: NetworkStatusCallback): () => void => {
  networkCallbacks.push(callback);

  // 如果还没有订阅，创建一个
  if (!netInfoSubscription) {
    startNetworkMonitoring();
  }

  return () => {
    const index = networkCallbacks.indexOf(callback);
    if (index !== -1) {
      networkCallbacks.splice(index, 1);
    }

    // 如果没有回调，停止监听
    if (networkCallbacks.length === 0 && qualityCallbacks.length === 0) {
      stopNetworkMonitoring();
    }
  };
};

/**
 * 注册连接质量回调
 * @param callback 连接质量回调
 * @returns 取消注册函数
 */
export const registerConnectionQualityCallback = (callback: ConnectionQualityCallback): () => void => {
  qualityCallbacks.push(callback);

  // 如果还没有订阅，创建一个
  if (!netInfoSubscription) {
    startNetworkMonitoring();
  }

  return () => {
    const index = qualityCallbacks.indexOf(callback);
    if (index !== -1) {
      qualityCallbacks.splice(index, 1);
    }

    // 如果没有回调，停止监听
    if (networkCallbacks.length === 0 && qualityCallbacks.length === 0) {
      stopNetworkMonitoring();
    }
  };
};

/**
 * 启动网络监控
 */
const startNetworkMonitoring = () => {
  netInfoSubscription = NetInfo.addEventListener(state => {
    lastNetworkState = state;

    // 通知网络状态变化
    const status = state.isConnected
      ? ConnectionStatus.CONNECTED
      : ConnectionStatus.DISCONNECTED;

    networkCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('网络状态回调错误:', error);
      }
    });

    // 确定连接质量
    const quality = determineConnectionQuality(state);

    // 通知质量变化
    qualityCallbacks.forEach(callback => {
      try {
        callback(quality);
      } catch (error) {
        console.error('连接质量回调错误:', error);
      }
    });
  });
};

/**
 * 停止网络监控
 */
const stopNetworkMonitoring = () => {
  if (netInfoSubscription) {
    netInfoSubscription();
    netInfoSubscription = null;
  }
};

/**
 * 确定连接质量
 */
const determineConnectionQuality = (state: NetInfoState): ConnectionQuality => {
  if (!state.isConnected) {
    return ConnectionQuality.POOR;
  }

  // 基于网络类型确定基础质量
  const baseQuality = networkTypeQualityMap[state.type] || ConnectionQuality.UNKNOWN;

  // 考虑信号强度 (如果可用)
  if (state.details && 'strength' in state.details && typeof state.details.strength === 'number') {
    const strength = state.details.strength;

    // 基于信号强度调整质量
    if (strength > 80) return ConnectionQuality.EXCELLENT;
    if (strength > 60) return ConnectionQuality.GOOD;
    if (strength > 40) return ConnectionQuality.FAIR;
    return ConnectionQuality.POOR;
  }

  return baseQuality;
};

/**
 * 获取当前网络连接质量
 */
export const getCurrentConnectionQuality = async (): Promise<ConnectionQuality> => {
  if (lastNetworkState) {
    return determineConnectionQuality(lastNetworkState);
  }

  try {
    const state = await NetInfo.fetch();
    lastNetworkState = state;
    return determineConnectionQuality(state);
  } catch (error) {
    console.error('获取网络质量失败:', error);
    return ConnectionQuality.UNKNOWN;
  }
};

/**
 * 同步离线数据
 */
export const syncOfflineData = async (): Promise<void> => {
  try {
    // 检查是否联网
    if (!isOnline()) {
      console.log('无法同步离线数据：网络未连接');
      return;
    }

    // 检查WebSocket连接
    if (!WebSocketService.getInstance().isConnected()) {
      console.log('无法同步离线数据：WebSocket未连接');
      return;
    }

    // 获取离线队列
    const offlineQueue = await getOfflineQueue();

    if (offlineQueue.length === 0) {
      console.log('离线队列为空，无需同步');
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
        const wsService = WebSocketService.getInstance();
        if (!wsService.isConnected()) {
          throw new Error('WebSocket未连接');
        }

        wsService.sendMessage('message', {
          type: 'message',
          payload: {
            ...offlineMessage,
            isOffline: false,
            syncStatus: 'synced',
          },
          timestamp: Date.now(),
          metadata: {
            sender: 'agent'
          }
        });

        // 从离线队列中移除
        await removeFromOfflineQueue(offlineMessage.id);

        console.log(`成功同步离线消息: ${offlineMessage.id}`);
      } catch (error) {
        console.error(`同步离线消息失败: ${offlineMessage.id}`, error);
      }
    }

    console.log('离线消息同步完成');
  } catch (error) {
    console.error('同步离线数据时出错:', error);
  }
};

/**
 * 添加消息到离线队列
 * @param message 要添加的消息
 */
export const queueOfflineMessage = async (message: any): Promise<void> => {
  try {
    // 添加到离线队列
    await addToOfflineQueue({
      ...message,
      isOffline: true,
      syncStatus: 'pending',
      offlineId: message.id,
    });

    console.log(`消息已添加到离线队列: ${message.id}`);
  } catch (error) {
    console.error('添加消息到离线队列时出错:', error);
  }
};

// 自动初始化网络监控
startNetworkMonitoring();