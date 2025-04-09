import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AuthUser, UserRole, Permission, JWTPayload, hasPermission } from '../types/auth';

// 存储键
const AUTH_TOKEN_KEY = 'CustomerServiceApp.authToken';
const AUTH_USER_KEY = 'CustomerServiceApp.authUser';

// 认证上下文类型
interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;
    isAuthenticated: boolean;
    agent: AuthUser | null;
    login: (username: string, password: string, apiKey?: string) => Promise<boolean>;
    logout: () => Promise<void>;
    hasPermission: (permission: Permission) => boolean;
    isAdmin: boolean;
    isSupervisor: boolean;
    updateProfile: (profileData: { name?: string; avatar?: string }) => Promise<boolean>;
}

// 创建上下文
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * JWT解码函数
 */
function decodeJWT(token: string): any {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('JWT解码错误:', error);
        return null;
    }
}

/**
 * 检查JWT是否有效
 */
function isValidJWT(token: string): boolean {
    try {
        const payload = decodeJWT(token);
        if (!payload) return false;

        // 检查过期时间
        const now = Math.floor(Date.now() / 1000);
        return payload.exp > now;
    } catch (error) {
        return false;
    }
}

// 认证提供者组件
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // 模拟登录API调用 (实际项目中应该调用真实API)
    const login = async (username: string, password: string, apiKey?: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);

            // 这里应该调用真实的登录API
            // 模拟API调用延迟
            await new Promise(resolve => setTimeout(resolve, 800));

            // 检查是否为管理员登录
            const isAdminLogin = username.startsWith('admin_') && apiKey;

            // 创建模拟的用户对象
            const role = isAdminLogin ? UserRole.ADMIN :
                username.startsWith('super_') ? UserRole.SUPERVISOR :
                    username.startsWith('trainee_') ? UserRole.TRAINEE :
                        UserRole.AGENT;

            // 根据角色确定权限
            let permissions: Permission[] = [];

            if (role === UserRole.ADMIN) {
                permissions = [
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
                ];
            } else if (role === UserRole.SUPERVISOR) {
                permissions = [
                    Permission.VIEW_ANALYTICS,
                    Permission.MANAGE_AGENTS,
                    Permission.ASSIGN_CHATS,
                    Permission.TRANSFER_CHATS,
                    Permission.ACCESS_ALL_CHATS,
                    Permission.SEND_MESSAGES,
                    Permission.UPLOAD_FILES,
                    Permission.USE_QUICK_REPLIES,
                    Permission.CLOSE_SESSIONS
                ];
            } else if (role === UserRole.AGENT) {
                permissions = [
                    Permission.SEND_MESSAGES,
                    Permission.UPLOAD_FILES,
                    Permission.USE_QUICK_REPLIES,
                    Permission.CLOSE_SESSIONS
                ];
            } else if (role === UserRole.TRAINEE) {
                permissions = [
                    Permission.SEND_MESSAGES,
                    Permission.USE_QUICK_REPLIES
                ];
            }

            // 创建用户对象
            const authUser: AuthUser = {
                id: `user_${Date.now()}`,
                username,
                displayName: username,
                role,
                status: 'active' as any,
                permissions,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString()
            };

            // 创建模拟的JWT令牌
            const now = Math.floor(Date.now() / 1000);
            const jwtPayload: JWTPayload = {
                sub: authUser.id,
                username: authUser.username,
                role: authUser.role,
                status: authUser.status,
                permissions: authUser.permissions,
                iat: now,
                exp: now + 24 * 60 * 60 // 24小时过期
            };

            // 在实际项目中，令牌应该由服务器生成
            // 这里只是生成一个带有相同结构的模拟令牌
            const mockToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(jwtPayload))}.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`;

            // 保存到状态
            setToken(mockToken);
            setUser(authUser);

            // 持久化存储
            await SecureStore.setItemAsync(AUTH_TOKEN_KEY, mockToken);
            await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(authUser));

            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '登录失败';
            setError(errorMessage);
            console.error('登录错误:', err);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // 注销处理
    const logout = async (): Promise<void> => {
        try {
            setIsLoading(true);

            // 清除状态
            setToken(null);
            setUser(null);

            // 清除存储
            await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
            await SecureStore.deleteItemAsync(AUTH_USER_KEY);

        } catch (err) {
            console.error('注销错误:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // 更新个人资料
    const updateProfile = async (profileData: { name?: string; avatar?: string }): Promise<boolean> => {
        try {
            if (!user) return false;

            // 更新用户对象
            const updatedUser: AuthUser = {
                ...user,
                displayName: profileData.name || user.displayName,
                avatar: profileData.avatar !== undefined ? profileData.avatar : user.avatar,
                lastLoginAt: new Date().toISOString()
            };

            // 更新状态
            setUser(updatedUser);

            // 更新存储
            await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(updatedUser));

            return true;
        } catch (err) {
            console.error('更新个人资料错误:', err);
            return false;
        }
    };

    // 检查权限
    const checkPermission = (permission: Permission): boolean => {
        return user?.permissions.includes(permission) || false;
    };

    // 初始化认证状态
    useEffect(() => {
        const loadAuthState = async () => {
            try {
                setIsLoading(true);

                // 加载令牌
                const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

                if (!storedToken) {
                    setIsLoading(false);
                    return;
                }

                // 验证令牌
                if (!isValidJWT(storedToken)) {
                    // 令牌无效，清除状态
                    await logout();
                    return;
                }

                // 加载用户数据
                const storedUserJson = await SecureStore.getItemAsync(AUTH_USER_KEY);

                if (storedUserJson) {
                    const storedUser = JSON.parse(storedUserJson) as AuthUser;
                    setUser(storedUser);
                    setToken(storedToken);
                } else {
                    // 用户数据缺失，注销
                    await logout();
                }
            } catch (err) {
                console.error('加载认证状态错误:', err);
                await logout();
            } finally {
                setIsLoading(false);
            }
        };

        loadAuthState();
    }, []);

    // 计算派生状态
    const isAuthenticated = !!user && !!token;
    const isAdmin = user?.role === UserRole.ADMIN || false;
    const isSupervisor = user?.role === UserRole.SUPERVISOR || isAdmin || false;

    // 构造上下文值
    const contextValue = useMemo<AuthContextType>(() => ({
        user,
        token,
        isLoading,
        error,
        isAuthenticated,
        agent: user,
        login,
        logout,
        hasPermission: checkPermission,
        isAdmin,
        isSupervisor,
        updateProfile
    }), [user, token, isLoading, error, isAuthenticated, isAdmin, isSupervisor]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// 使用认证的Hook
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth必须在AuthProvider内部使用');
    }

    return context;
};