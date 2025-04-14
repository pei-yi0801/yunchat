# TypeScript错误处理指南

## 常见错误类型及解决方案

### 1. "文件不是模块"错误

错误消息示例：
```
文件"node_modules/expo-router/index.d.ts"不是模块。
```

解决方案：
1. **临时解决方案**：使用`// @ts-ignore`注释跳过类型检查
   ```typescript
   // @ts-ignore
   import { useRouter } from 'expo-router';
   ```

2. **长期解决方案**：在`types/custom.d.ts`中添加类型声明
   ```typescript
   declare module 'expo-router' {
     import { ComponentType } from 'react';
     
     export const useRouter: () => {
       push: (route: string) => void;
       replace: (route: string) => void;
       back: () => void;
       navigate: (route: string) => void;
     };
     
     // 添加其他必要的类型
   }
   ```

### 2. "找不到模块或其相应的类型声明"错误

新增适配器模式解决方案：
```typescript
// 使用适配层替代直接导入
import * as SecureStore from '../adapters/SecureStoreBridge';
// 替代原有导入方式
// import * as SecureStore from 'expo-secure-store';
```

错误消息示例：
```
找不到模块"expo-secure-store"或其相应的类型声明。
```

解决方案：
1. **安装类型声明包**（如适用）
   ```bash
   npm install -D @types/package-name
   ```

2. **添加自定义类型声明**：在`types/custom.d.ts`中添加
   ```typescript
   declare module 'expo-secure-store' {
     export function getItemAsync(key: string, options?: any): Promise<string | null>;
     export function setItemAsync(key: string, value: string, options?: any): Promise<void>;
     // 添加其他必要的类型
   }
   ```

3. **临时解决方案**：使用`// @ts-ignore`注释
   ```typescript
   // @ts-ignore
   import * as SecureStore from 'expo-secure-store';
   ```

### 3. "类型上不存在属性"错误

错误消息示例：
```
类型"typeof import("expo-secure-store")"上不存在属性"canUseBiometricAuthentication"。
```

解决方案：
1. **使用类型断言**
   ```typescript
   (SecureStore as any).canUseBiometricAuthentication();
   ```

2. **添加条件检查**
   ```typescript
   if (typeof SecureStore.canUseBiometricAuthentication === 'function') {
     // @ts-ignore
     SecureStore.canUseBiometricAuthentication();
   }
   ```

## 最佳实践

**生产环境密钥管理补充**：
1. 在`.env.production`中配置`KEY_ROTATION_INTERVAL=30`设置密钥轮换周期
2. 添加PM2生态配置文件：
```json
{
  "apps": [{
    "name": "key-rotation",
    "script": "./scripts/keyRotation.js",
    "cron_restart": "0 0 * * *"
  }]
}
```

1. **创建完整的类型声明文件**：通过在`types/custom.d.ts`中添加完整的类型定义，避免在每个使用处添加`@ts-ignore`注释。

2. **优先使用类型声明而非忽略错误**：优先考虑添加正确的类型声明，而不是使用`@ts-ignore`。

3. **使用版本控制跟踪类型声明**：确保类型声明文件被纳入版本控制系统，以便团队所有成员都能受益。

4. **定期更新类型声明**：随着库版本的更新，确保类型声明也保持最新。

5. **考虑降级使用稳定版本**：如果某个包的类型定义问题太多，考虑降级到有完善类型支持的版本。

## 常用类型声明模板

以下是一些常用的类型声明模板，可以根据需要修改：

```typescript
// 基本模块声明
declare module 'module-name';

// 带导出的模块声明
declare module 'module-name' {
  export function functionName(param: ParamType): ReturnType;
  export const constantName: ConstantType;
  
  // 默认导出
  export default ComponentName;
}

// 资源模块声明
declare module '*.png' {
  const value: any;
  export default value;
}

declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

// QR码和文件处理相关类型
declare module 'react-native-qrcode-svg' {
  import React from 'react';
  
  export interface QRCodeProps {
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    // 其他属性...
  }
  
  const QRCode: React.FC<QRCodeProps>;
  export default QRCode;
}

declare module 'react-native-view-shot' {
  export function captureRef(
    viewRef: React.RefObject<any>,
    options?: {
      format?: 'png' | 'jpg' | 'webm' | 'raw',
      quality?: number,
      // 其他选项...
    }
  ): Promise<string>;
}
```