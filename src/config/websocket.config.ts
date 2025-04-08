/**
 * WebSocket配置文件
 * 用于管理WebSocket连接的相关参数和配置
 */

export const WebSocketConfig = {
    // WebSocket服务器地址
    WS_API_URL: process.env.WS_API_URL || 'wss://example.com/api/ws',

    // 存储键
    STORAGE_KEYS: {
        API_KEY: 'apiKey',
        AUTH_TOKEN: 'authToken',
        LAST_SYNC_TIME: 'lastSyncTime'
    },

    // 连接配置
    CONNECTION: {
        // 初始重连延迟（毫秒）
        INITIAL_RECONNECT_DELAY: 1000,
        // 最大重连延迟（毫秒）
        MAX_RECONNECT_DELAY: 30000,
        // 重连延迟增长因子
        RECONNECT_FACTOR: 1.5,
        // 最大重连尝试次数
        MAX_RECONNECT_ATTEMPTS: 10
    },

    // 心跳配置
    HEARTBEAT: {
        // 心跳间隔（毫秒）
        PING_INTERVAL: 30000,
        // 心跳超时时间（毫秒）
        PONG_TIMEOUT: 10000,
        // 心跳失败重试次数
        MAX_MISSED_HEARTBEATS: 3
    },

    // 消息配置
    MESSAGE: {
        // 消息重发最大尝试次数
        MAX_RETRY_ATTEMPTS: 3,
        // 消息重发延迟（毫秒）
        RETRY_DELAY: 3000
    },

    // 离线队列配置
    OFFLINE_QUEUE: {
        // 最大队列大小
        MAX_QUEUE_SIZE: 1000,
        // 队列持久化键
        STORAGE_KEY: '@CustomerServiceApp:offlineQueue',
        // 自动同步间隔（毫秒）
        AUTO_SYNC_INTERVAL: 300000,
        // 同步重试延迟（毫秒）
        SYNC_RETRY_DELAY: 5000
    }
};