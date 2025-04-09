// @ts-ignore
import * as SecureStore from '../adapters/SecureStoreBridge';
// @ts-ignore
import { jwtDecode } from 'jwt-decode';
import { AuthData } from '../types';
import { API_CONFIG } from './config';

// 存储密钥
const AUTH_TOKEN_KEY = 'auth_token';

// 保存认证令牌到安全存储
export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  } catch (error) {
    console.error('存储认证令牌时出错:', error);
    throw new Error('无法保存认证令牌');
  }
};

// 从安全存储获取认证令牌
export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('获取认证令牌时出错:', error);
    return null;
  }
};

// 从安全存储删除认证令牌
export const removeAuthToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('删除认证令牌时出错:', error);
  }
};

// 检查令牌是否有效
export const isTokenValid = (token: string): boolean => {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    const currentTime = Date.now() / 1000;

    return decoded.exp > currentTime;
  } catch (error) {
    console.error('验证令牌时出错:', error);
    return false;
  }
};

// 获取当前用户信息
export const getCurrentUser = async (): Promise<AuthData | null> => {
  const token = await getAuthToken();

  if (!token || !isTokenValid(token)) {
    return null;
  }

  try {
    const decoded = jwtDecode<{
      userId: string;
      userType: 'agent' | 'customer' | 'admin';
      exp: number;
    }>(token);

    return {
      token,
      userId: decoded.userId,
      userType: decoded.userType,
      expiresAt: decoded.exp * 1000, // 转换为毫秒
    };
  } catch (error) {
    console.error('解码令牌时出错:', error);
    return null;
  }
};

// 登录函数
export const login = async (
  email: string,
  password: string
): Promise<AuthData> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '登录失败');
    }

    const data = await response.json();
    await saveAuthToken(data.token);

    return {
      token: data.token,
      userId: data.userId,
      userType: data.userType,
      expiresAt: data.expiresAt,
    };
  } catch (error) {
    console.error('登录时出错:', error);
    throw error;
  }
};

// 退出登录
export const logout = async (): Promise<void> => {
  await removeAuthToken();
};

// 检查是否已认证
export const isAuthenticated = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user !== null;
};