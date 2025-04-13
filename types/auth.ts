/**
 * 认证相关类型定义
 */

/**
 * 用户角色枚举
 */
export enum UserRole {
    ADMIN = 'admin',      // 管理员
    SUPERVISOR = 'supervisor', // 主管
    AGENT = 'agent',      // 普通客服
    TRAINEE = 'trainee'   // 培训中的客服
}

/**
 * 用户状态枚举
 */
export enum UserStatus {
    ACTIVE = 'active',       // 活跃
    INACTIVE = 'inactive',   // 非活跃
    SUSPENDED = 'suspended', // 已暂停
    PENDING = 'pending'      // 待审核
}

/**
 * 用户权限枚举
 */
export enum Permission {
    // 系统管理权限
    MANAGE_SYSTEM = 'manage_system',       // 系统管理
    MANAGE_AGENTS = 'manage_agents',       // 管理客服
    MANAGE_SETTINGS = 'manage_settings',   // 管理设置
    VIEW_ANALYTICS = 'view_analytics',     // 查看分析数据

    // 客服操作权限
    ASSIGN_CHATS = 'assign_chats',         // 分配聊天
    TRANSFER_CHATS = 'transfer_chats',     // 转移聊天
    ACCESS_ALL_CHATS = 'access_all_chats', // 访问所有聊天

    // 基本操作权限
    SEND_MESSAGES = 'send_messages',       // 发送消息
    UPLOAD_FILES = 'upload_files',         // 上传文件
    USE_QUICK_REPLIES = 'use_quick_replies', // 使用快捷回复
    CLOSE_SESSIONS = 'close_sessions'      // 关闭会话
}

/**
 * 角色权限映射
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    [UserRole.ADMIN]: [
        Permission.MANAGE_SYSTEM,
        Permission.MANAGE_AGENTS,
        Permission.MANAGE_SETTINGS,
        Permission.VIEW_ANALYTICS,
        Permission.ASSIGN_CHATS,
        Permission.TRANSFER_CHATS,
        Permission.ACCESS_ALL_CHATS,
        Permission.SEND_MESSAGES,
        Permission.UPLOAD_FILES,
        Permission.USE_QUICK_REPLIES,
        Permission.CLOSE_SESSIONS
    ],
    [UserRole.SUPERVISOR]: [
        Permission.VIEW_ANALYTICS,
        Permission.MANAGE_AGENTS,
        Permission.ASSIGN_CHATS,
        Permission.TRANSFER_CHATS,
        Permission.ACCESS_ALL_CHATS,
        Permission.SEND_MESSAGES,
        Permission.UPLOAD_FILES,
        Permission.USE_QUICK_REPLIES,
        Permission.CLOSE_SESSIONS
    ],
    [UserRole.AGENT]: [
        Permission.SEND_MESSAGES,
        Permission.UPLOAD_FILES,
        Permission.USE_QUICK_REPLIES,
        Permission.CLOSE_SESSIONS
    ],
    [UserRole.TRAINEE]: [
        Permission.SEND_MESSAGES,
        Permission.USE_QUICK_REPLIES
    ]
};

/**
 * 用户认证信息接口
 */
export interface AuthUser {
    id: string;
    username: string;
    displayName: string;
    role: UserRole;
    status: UserStatus;
    permissions: Permission[];
    email?: string;
    avatar?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    lastLoginAt?: string;
}

/**
 * 登录请求接口
 */
export interface LoginRequest {
    username: string;
    password: string;
    rememberMe?: boolean;
}

/**
 * 登录响应接口
 */
export interface LoginResponse {
    user: AuthUser;
    token: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * 刷新令牌请求接口
 */
export interface RefreshTokenRequest {
    refreshToken: string;
}

/**
 * 刷新令牌响应接口
 */
export interface RefreshTokenResponse {
    token: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * 修改密码请求接口
 */
export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

/**
 * 重置密码请求接口
 */
export interface ResetPasswordRequest {
    email: string;
}

/**
 * 验证码请求接口
 */
export interface VerificationCodeRequest {
    email: string;
    purpose: 'login' | 'reset_password' | 'registration';
}

/**
 * 验证码验证请求接口
 */
export interface VerifyCodeRequest {
    email: string;
    code: string;
    purpose: 'login' | 'reset_password' | 'registration';
}

/**
 * 认证状态接口
 */
export interface AuthState {
    isAuthenticated: boolean;
    user: AuthUser | null;
    token: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
    isLoading: boolean;
    error: string | null;
}