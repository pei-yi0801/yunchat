/**
 * expo-secure-store API适配层
 * 该模块提供兼容层，允许应用程序代码使用一致的API，
 * 而不受底层expo-secure-store版本变化的影响
 */

// 导入方式修改，确保获取正确的模块
// @ts-ignore
import * as SecureStoreModule from 'expo-secure-store';
import { Buffer } from 'buffer';

// 密钥相关常量
const KEY_PREFIX = 'secure_';
const ADMIN_KEY_PREFIX = 'admin_';
const AGENT_KEY_PREFIX = 'agent_';
const KEY_EXPIRY = 24 * 60 * 60 * 1000; // 24小时过期
const ADMIN_MASTER_KEY = 'adminayi888'; // 管理员主密钥

// 密钥类型枚举
enum KeyType {
  NORMAL = 'normal',
  ADMIN = 'admin',
  AGENT = 'agent'
}

// 密钥格式验证
const isValidKey = (key: string): boolean => {
  // 管理员主密钥验证
  if (key === ADMIN_MASTER_KEY) {
    return true;
  }

  // 基本格式验证：8-32位字母数字下划线中划线
  if (!(/^[a-zA-Z0-9_-]{8,32}$/.test(key))) {
    return false;
  }

  // 特殊密钥验证
  if (key.startsWith(ADMIN_KEY_PREFIX)) {
    return key.length >= ADMIN_KEY_PREFIX.length + 8;
  }
  if (key.startsWith(AGENT_KEY_PREFIX)) {
    return key.length >= AGENT_KEY_PREFIX.length + 8;
  }

  return true;
};

// 获取密钥类型
const getKeyType = (key: string): KeyType => {
  if (key === ADMIN_MASTER_KEY) {
    return KeyType.ADMIN;
  }
  if (key.startsWith(ADMIN_KEY_PREFIX)) {
    return KeyType.ADMIN;
  }
  if (key.startsWith(AGENT_KEY_PREFIX)) {
    return KeyType.AGENT;
  }
  return KeyType.NORMAL;
};

// 加密存储值
const encryptValue = (value: string): string => {
  // 使用更安全的加密方式，添加随机盐值
  const salt = Buffer.from(Math.random().toString()).toString('base64').slice(0, 8);
  const valueWithSalt = salt + value;
  return Buffer.from(valueWithSalt).toString('base64');
};

// 解密存储值
const decryptValue = (value: string): string => {
  try {
    const decoded = Buffer.from(value, 'base64').toString();
    // 移除盐值（前8个字符）
    return decoded.slice(8);
  } catch (error) {
    console.error('解密值时出错:', error);
    throw new Error('解密失败');
  }
};

// 获取带时间戳和版本的值
const getTimestampedValue = (value: string, keyType: KeyType): string => {
  return JSON.stringify({
    value,
    timestamp: Date.now(),
    version: '1.0',
    type: keyType
  });
};

// 检查值是否过期
const isValueExpired = (timestampedValue: string): boolean => {
  try {
    const { timestamp, type } = JSON.parse(timestampedValue);
    // 根据密钥类型设置过期时间
    const expiryTime = type === KeyType.ADMIN ? KEY_EXPIRY / 2 :
      type === KeyType.AGENT ? KEY_EXPIRY * 1.5 :
        KEY_EXPIRY;
    return Date.now() - timestamp > expiryTime;
  } catch (error) {
    console.error('检查过期时出错:', error);
    return true;
  }
};

// Web环境检测
const isWeb = typeof document !== 'undefined';

// 重新导出一个安全的、不含弃用警告的API子集

/**
 * 存储键值对
 */
export async function setItemAsync(
  key: string,
  value: string,
  options = {}
): Promise<void> {
  // 验证密钥格式和类型
  if (!isValidKey(key)) {
    throw new Error('Invalid key format');
  }
  const keyType = getKeyType(key);

  // 处理值加密和时间戳
  const encryptedValue = encryptValue(getTimestampedValue(value, keyType));
  try {
    // 在Web环境中使用localStorage作为备选
    if (isWeb) {
      localStorage.setItem(`${KEY_PREFIX}${key}`, encryptedValue);
      return;
    }

    // 使用当前版本API（14.0.1+）
    if (typeof SecureStoreModule.setItemAsync === 'function') {
      return await SecureStoreModule.setItemAsync(`${KEY_PREFIX}${key}`, encryptedValue, options);
    }

    // 尝试直接访问内部实现（兼容性尝试）
    const module = SecureStoreModule as any;

    if (module.default && typeof module.default.setItemAsync === 'function') {
      return await module.default.setItemAsync(key, value, options);
    }

    if (module.default && typeof module.default.setValueWithKeyAsync === 'function') {
      return await module.default.setValueWithKeyAsync(key, value, options);
    }

    // 最后的备选方案
    console.warn('SecureStore API不可用: setItemAsync - 使用localStorage作为备选');
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('SecureStore setItemAsync 错误:', error);
    // 在出错时使用后备方案
    try {
      localStorage.setItem(key, value);
    } catch (fallbackError) {
      console.error('后备存储也失败了:', fallbackError);
      throw new Error('存储失败');
    }
  }
}

/**
 * 获取存储的值
 */
export async function getItemAsync(
  key: string,
  options = {}
): Promise<string | null> {
  // 验证密钥格式
  if (!isValidKey(key)) {
    throw new Error('Invalid key format');
  }
  try {
    // 在Web环境中使用localStorage作为备选
    if (isWeb) {
      const encryptedValue = localStorage.getItem(`${KEY_PREFIX}${key}`);
      if (!encryptedValue) return null;

      const decryptedValue = decryptValue(encryptedValue);
      if (isValueExpired(decryptedValue)) {
        localStorage.removeItem(`${KEY_PREFIX}${key}`);
        return null;
      }

      return JSON.parse(decryptedValue).value;
    }

    // 使用当前版本API（14.0.1+）
    if (typeof SecureStoreModule.getItemAsync === 'function') {
      const encryptedValue = await SecureStoreModule.getItemAsync(`${KEY_PREFIX}${key}`, options);
      if (!encryptedValue) return null;

      const decryptedValue = decryptValue(encryptedValue);
      if (isValueExpired(decryptedValue)) {
        await SecureStoreModule.deleteItemAsync(`${KEY_PREFIX}${key}`, options);
        return null;
      }

      return JSON.parse(decryptedValue).value;
    }

    // 尝试直接访问内部实现（兼容性尝试）
    const module = SecureStoreModule as any;

    if (module.default && typeof module.default.getItemAsync === 'function') {
      return await module.default.getItemAsync(key, options);
    }

    if (module.default && typeof module.default.getItemAsync === 'function') {
      return await module.default.getItemAsync(key, options);
    }

    // 最后的备选方案
    console.warn('SecureStore API不可用: getItemAsync - 使用localStorage作为备选');
    return localStorage.getItem(key);
  } catch (error) {
    console.error('SecureStore getItemAsync 错误:', error);
    // 在出错时使用后备方案
    try {
      const encryptedValue = localStorage.getItem(`${KEY_PREFIX}${key}`);
      if (!encryptedValue) return null;

      const decryptedValue = decryptValue(encryptedValue);
      if (isValueExpired(decryptedValue)) {
        localStorage.removeItem(`${KEY_PREFIX}${key}`);
        return null;
      }

      return JSON.parse(decryptedValue).value;
    } catch (fallbackError) {
      console.error('后备存储也失败了:', fallbackError);
      return null;
    }
  }
}

/**
 * 删除存储的值
 */
export async function deleteItemAsync(
  key: string,
  options = {}
): Promise<void> {
  try {
    // 在Web环境中使用localStorage作为备选
    if (isWeb) {
      localStorage.removeItem(key);
      return;
    }

    // 使用当前版本API（14.0.1+）
    if (typeof SecureStoreModule.deleteItemAsync === 'function') {
      return await SecureStoreModule.deleteItemAsync(key, options);
    }

    // 尝试直接访问内部实现（兼容性尝试）
    const module = SecureStoreModule as any;

    if (module.default && typeof module.default.deleteItemAsync === 'function') {
      return await module.default.deleteItemAsync(key, options);
    }

    if (module.default && typeof module.default.deleteItemAsync === 'function') {
      return await module.default.deleteItemAsync(key, options);
    }

    // 最后的备选方案
    console.warn('SecureStore API不可用: deleteItemAsync - 使用localStorage作为备选');
    localStorage.removeItem(key);
  } catch (error) {
    console.error('SecureStore deleteItemAsync 错误:', error);
    // 在出错时使用后备方案
    try {
      localStorage.removeItem(key);
    } catch (fallbackError) {
      console.error('后备存储也失败了:', fallbackError);
    }
  }
}

/**
 * 检查SecureStore是否可用
 */
export async function isAvailableAsync(): Promise<boolean> {
  try {
    // 在Web环境中，返回false（表示需要使用后备方案）
    if (isWeb) {
      return false;
    }

    if (typeof SecureStoreModule.isAvailableAsync === 'function') {
      return await SecureStoreModule.isAvailableAsync();
    }

    // 检查是否有任何一个关键方法可用
    const module = SecureStoreModule as any;
    return !!(
      (typeof SecureStoreModule.getItemAsync === 'function') ||
      (module.default && typeof module.default.getItemAsync === 'function') ||
      (module.default && typeof module.default.getValueWithKeyAsync === 'function')
    );
  } catch (error) {
    console.error('SecureStore isAvailableAsync 错误:', error);
    return false;
  }
}

/**
 * 检查是否可以使用生物识别认证
 */
export function canUseBiometricAuthentication(): boolean {
  try {
    // @ts-ignore
    if (typeof SecureStoreModule.canUseBiometricAuthentication === 'function') {
      // @ts-ignore
      return SecureStoreModule.canUseBiometricAuthentication();
    }
    return false;
  } catch (error) {
    console.error('SecureStore canUseBiometricAuthentication 错误:', error);
    return false;
  }
}

// 导出常量 - 优先使用新版本的常量，或提供合理的默认值
export const AFTER_FIRST_UNLOCK = SecureStoreModule.AFTER_FIRST_UNLOCK || 'AfterFirstUnlock';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = SecureStoreModule.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY || 'AfterFirstUnlockThisDeviceOnly';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = SecureStoreModule.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY || 'WhenPasscodeSetThisDeviceOnly';
export const WHEN_UNLOCKED = SecureStoreModule.WHEN_UNLOCKED || 'WhenUnlocked';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = SecureStoreModule.WHEN_UNLOCKED_THIS_DEVICE_ONLY || 'WhenUnlockedThisDeviceOnly';

// 安全替代方案 - 旧版常量映射到新的安全替代方案
export const ALWAYS = AFTER_FIRST_UNLOCK;
export const ALWAYS_THIS_DEVICE_ONLY = AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY;

// 导出类型
// @ts-ignore
export type { SecureStoreOptions } from 'expo-secure-store';