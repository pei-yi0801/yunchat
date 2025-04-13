/**
 * 统一导出所有业务相关类型定义
 * 此文件作为类型定义的集中导出点，整合了根目录和src目录下的所有类型
 */

// 引用React Native随机值生成类型
/// <reference types="react-native-get-random-values" />

// 导入必要的依赖
import { nanoid } from 'nanoid';
import { AUTH_CONFIG } from '../src/services/config';

// 导出当前目录下的类型定义
export * from './auth';
export * from './business';

// 导出自定义声明文件中的类型
// 注意：custom.d.ts是声明文件，不需要显式导出

// 从src/types导入并重命名可能冲突的类型
import {
    AgentPerformance as SrcAgentPerformance,
    ChatSession as SrcChatSession,
    Customer as SrcCustomer,
    Message as SrcMessage,
    QuickReply as SrcQuickReply,
    AgentData as SrcAgentData,
    SystemConfig as SrcSystemConfig,
    SyncManager as SrcSyncManager,
    SyncManagerState as SrcSyncManagerState,
    SyncError as SrcSyncError,
    SessionAnalytics as SrcSessionAnalytics
} from '../src/types';

// 环境变量类型将从@env模块中获取
// 注意：env.d.ts是声明文件，不需要显式导入

// 导入src/types/auth.ts中的认证相关类型
import {
    UserRole,
    UserStatus,
    Permission,
    ROLE_PERMISSIONS,
    AuthUser,
    JWTPayload,
    LoginRequest,
    LoginResponse
} from '../src/types/auth';

// 显式导出重命名后的类型
export {
    SrcAgentPerformance,
    SrcChatSession,
    SrcCustomer,
    SrcMessage,
    SrcQuickReply,
    SrcAgentData,
    SrcSystemConfig,
    SrcSyncManager,
    SrcSyncManagerState,
    SrcSyncError,
    SrcSessionAnalytics
};

// 注意：环境变量类型和认证相关类型已在上方导出，此处不再重复导出

// 从src/types导入并导出所需类型
// 注意：不使用通配符导出，避免与./business中的类型冲突
import {
    AgentStatus,
    ChatStatus,
    MessageType,
    MessageStatus,
    SyncStatus,
    ConnectionStatus,
    ConnectionQuality,
    SyncConflictStrategy,
    MessageEncryption,
    WSMessage,
    AuthData,
    SyncManagerState,
    SyncError,
    SessionAnalytics,
    AgentData,
    Customer,
    Message,
    ChatSession,
    QuickReply,
    SystemConfig,
    SyncManager,
    AgentPerformance
} from '../src/types';

// 显式导出从src/types导入的非冲突类型
export {
    AgentStatus,
    ChatStatus,
    MessageType,
    MessageStatus,
    SyncStatus,
    ConnectionStatus,
    ConnectionQuality,
    SyncConflictStrategy,
    MessageEncryption,
    WSMessage,
    AuthData,
    SyncManagerState,
    SyncError,
    SessionAnalytics,
    AgentData,
    Customer,
    Message,
    ChatSession,
    QuickReply,
    SystemConfig,
    SyncManager,
    AgentPerformance
};

// 注意：环境变量类型和认证相关类型已在上方导出，此处不再重复导出

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

// 验证密钥是否有效
export const validateKey = (key: string): boolean => {
    // 使用环境变量中的管理员密钥
    if (key === AUTH_CONFIG.ADMIN_API_KEY) {
        return true;
    }
    return PRESET_KEYS.includes(key) || key === getCurrentKey();
};

// 用于生成带前缀的nanoid的辅助函数
export const generateId = (prefix: 'AGENT' | 'CUSTOMER' | 'MESSAGE' | 'SESSION' | 'KEY' | 'MEDIA'): string => {
    return `${prefix}_${nanoid(10)}`;
};