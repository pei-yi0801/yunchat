import { Platform } from "react-native";

// 色彩常量
export const COLORS = {
    // 主要颜色
    primary: '#007AFF',
    secondary: '#5856D6',
    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9500',
    info: '#00C7BE',

    // 文本颜色
    text: '#000000',
    textSecondary: '#3C3C43',
    textTertiary: '#8E8E93',

    // 背景颜色
    background: '#F2F2F7',
    cardBackground: '#FFFFFF',

    // 边框和分隔线
    border: '#E5E5EA',
    separator: '#C7C7CC',

    // 灰度
    white: '#FFFFFF',
    black: '#000000',
    gray: '#8E8E93',
    gray2: '#AEAEB2',
    gray3: '#C7C7CC',
    gray4: '#D1D1D6',
    gray5: '#E5E5EA',
    gray6: '#F2F2F7',

    // 透明度
    transparent: 'transparent',
    overlay: 'rgba(0, 0, 0, 0.3)',
};

// 间距常量
export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

// 字体大小常量
export const FONT_SIZE = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
};

// 边框圆角常量
export const BORDER_RADIUS = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 999,
};

// 阴影样式
export const SHADOWS = {
    small: {
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        } : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4
        }),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    medium: {
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        } : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4
        }),
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    large: {
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        } : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4
        }),
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
};

// 应用常量
export const APP_CONSTANTS = {
    MAX_MESSAGE_LENGTH: 2000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'],
    ANIMATION_DURATION: 300,
    DEBOUNCE_DELAY: 300,
    STORAGE_KEYS: {
        AUTH_TOKEN: 'auth_token',
        USER_PREFERENCES: 'user_preferences',
        THEME: 'app_theme',
        NOTIFICATIONS: 'notifications_enabled',
    },
};