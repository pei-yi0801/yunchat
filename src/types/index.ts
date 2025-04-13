/// <reference types="react-native-get-random-values" />

import { nanoid } from 'nanoid';
import { AUTH_CONFIG } from '../services/config';

// 前缀常量
export const PREFIXES = {
  AGENT: 'agent_',
  CUSTOMER: 'cust_',
  MESSAGE: 'msg_',
  SESSION: 'sess_',
  KEY: 'key_',
} as const;

// 预设的30个密钥
export const PRESET_KEYS: string[] = Array.from({ length: 30 }, () =>
  `${PREFIXES.KEY}${nanoid(16)}`
);

// 当前有效密钥索引计算（基于日期的轮换）
export const getCurrentKeyIndex = (): number => {
  const now = new Date();
  return (now.getDate() + now.getMonth()) % PRESET_KEYS.length;
};

// 获取当前有效密钥
export const getCurrentKey = (): string => {
  return PRESET_KEYS[getCurrentKeyIndex()];
};

// 工作状态
export enum AgentStatus {
  ONLINE = 'online',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

// 聊天状态
export enum ChatStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

// 消息类型
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  VOICE = 'voice',
  VIDEO = 'video',
  SYSTEM = 'system',
}

// 消息状态类型
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'pending';

// 消息同步状态
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'failed' | 'error';

// 网络连接状态
export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
}

// 连接质量
export enum ConnectionQuality {
  UNKNOWN = 'unknown',
  POOR = 'poor',
  FAIR = 'fair',
  GOOD = 'good',
  EXCELLENT = 'excellent'
}

// 同步冲突解决策略
export enum SyncConflictStrategy {
  SERVER_WINS = 'server_wins',
  LOCAL_WINS = 'local_wins',
  NEWEST_WINS = 'newest_wins',
  MERGE = 'merge'
}

// 消息加密状态
export interface MessageEncryption {
  isEncrypted: boolean;
  encryptionType?: 'aes' | 'e2e';
  publicKey?: string;
  encryptedSessionKey?: string;
}

// 客服数据
export interface AgentData {
  id: string;
  name: string;
  avatar?: string;
  status: AgentStatus;
  email: string;
  activeChats: number;
  totalResolved: number;
  lastActive?: Date;
  permissions: string[];
}

// 客户数据
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  firstContact: Date;
  lastContact?: Date;
  tags: string[];
  notes?: string;
}

// 消息接口
export interface Message {
  id: string;
  sessionId: string;
  content: string;
  contentType: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';
  senderType: 'agent' | 'customer' | 'system';
  timestamp: string;
  status: MessageStatus;
  attachments?: any[];
  metadata?: Record<string, any>;
  isOffline?: boolean;
  syncStatus?: SyncStatus;
  offlineId?: string;
  priority?: number; // 消息优先级，用于队列排序
  lastSyncTime?: number; // 最后同步时间
  error?: string; // 错误信息
}

// 聊天会话
export interface ChatSession {
  id: string;
  customerId: string;
  agentId?: string;
  status: ChatStatus;
  startTime: Date;
  endTime?: Date;
  tags: string[];
  subject?: string;
  priority: 'low' | 'medium' | 'high';
  lastMessageTime?: Date;
  unreadCount: number;
}

// WebSocket消息接口
export interface WSMessage {
  type: 'message' | 'ping' | 'pong' | 'status' | 'error';
  payload?: Message;
  timestamp: number;
  retryCount?: number;
  metadata?: Record<string, any>;
}

// 认证数据
export interface AuthData {
  token: string;
  expiresAt: number;
  userId: string;
  userType: 'agent' | 'customer' | 'admin';
}

// 快捷回复
export interface QuickReply {
  id: string;
  content: string;
  tags: string[];
  isGlobal: boolean;
  createdBy?: string;
}

// 系统配置
export interface SystemConfig {
  maxAgentsPerDay: number;
  autoAssignChats: boolean;
  workingHours: {
    start: string; // 格式: "HH:MM"
    end: string;   // 格式: "HH:MM"
    timezone: string;
    workDays: number[]; // 0-6 (周日-周六)
  };
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
  };
}

// SyncManager状态接口
export interface SyncManagerState {
  isInitialSyncComplete: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  errors: SyncError[];
  queueSize: number;
  networkStatus: ConnectionStatus;
  networkQuality: ConnectionQuality;
}

// 同步错误接口
export interface SyncError {
  id: string;
  messageId?: string;
  error: any;
  timestamp: number;
  details?: string;
  attempts?: number;
}

// SyncManager类型
export interface SyncManager {
  getState(): SyncManagerState;
  syncOfflineQueue(): Promise<boolean>;
  resendMessage(sessionId: string, messageId: string): Promise<boolean>;
  registerObserver(observer: (state: SyncManagerState) => void): () => void;
  handleQueueSizeChange?: (size: number) => void;
  handleNetworkStatusChange?: (status: ConnectionStatus, quality: ConnectionQuality) => void;
  handleWebSocketConnection?: (isConnected: boolean) => void;
  handleWebSocketMessage?: (message: any) => void;
  initLastSyncTime?: () => Promise<void>;
}

// 会话分析数据
export interface SessionAnalytics {
  id: string;
  sessionId: string;
  agentId: string;
  responseTime: number; // 平均响应时间，单位毫秒
  sessionDuration: number; // 会话持续时间，单位毫秒
  messageCount: number; // 消息数量
  resolutionTime: number; // 解决时间，单位毫秒
  customerSatisfaction?: number; // 客户满意度评分 (1-5)
  tags: string[]; // 会话标签
  createdAt: Date;
}

// 客服性能指标
export interface AgentPerformance {
  agentId: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  sessionsHandled: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  avgSessionDuration: number;
  satisfactionScore: number;
  messagesPerSession: number;
}

// 用于生成带前缀的nanoid的辅助函数
export const generateId = (
  prefix: 'AGENT' | 'CUSTOMER' | 'MESSAGE' | 'SESSION' | 'KEY' | 'MEDIA'
) => {
  return `${prefix}_${nanoid(10)}`;
};

// 验证密钥是否有效
export const validateKey = (key: string): boolean => {
  // 硬编码管理员密钥，优先使用环境变量中的配置
  if (key === AUTH_CONFIG.ADMIN_API_KEY) {
    return true;
  }
  return PRESET_KEYS.includes(key) || key === getCurrentKey();
};