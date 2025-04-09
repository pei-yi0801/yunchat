declare module '@env' {
    // API配置
    export const API_URL: string;
    export const WS_URL: string;
    export const API_VERSION: string;

    // 认证配置
    export const JWT_SECRET: string;
    export const TOKEN_EXPIRY: string;
    export const REFRESH_TOKEN_EXPIRY: string;
    export const ADMIN_API_KEY: string;

    // 系统配置
    export const MAX_AGENTS_PER_DAY: number;
    export const AUTO_ASSIGN_CHATS: boolean;
    export const WORKING_HOURS_START: string;
    export const WORKING_HOURS_END: string;
    export const WORKING_TIMEZONE: string;
    export const WORKING_DAYS: string;

    // 通知配置
    export const ENABLE_EMAIL_NOTIFICATIONS: boolean;
    export const ENABLE_PUSH_NOTIFICATIONS: boolean;
    export const ENABLE_SOUND_NOTIFICATIONS: boolean;

    // 上传配置
    export const MAX_UPLOAD_SIZE: number;
    export const ALLOWED_FILE_TYPES: string;

    // 加密设置
    export const ENCRYPTION_MODE: string;

    // 应用设置
    export const MAX_AGENTS: number;
    export const DEBUG_MODE: boolean;
    export const OFFLINE_CACHE_DAYS: number;
}