# 客服聊天管理系统

一个使用 Expo 和 React Native 构建的现代化、响应式客服聊天管理系统。该系统使客服人员能够高效管理多个聊天会话，同时为网页和移动平台提供无缝的用户体验。

![客服聊天系统](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=400&fit=crop)

## 功能特点

### 🔄 连接管理
- 网络状态实时监测（4G/5G/WiFi）
- 离线消息队列自动存储与同步
- 断线自动重连（最多5次尝试）
- 连接稳定性指标统计

### 💬 聊天管理
- 实时聊天界面，带有消息状态指示器
- 支持文本消息、图片、文件和语音消息
- 消息时间戳和已读/未读状态跟踪
- 未读消息提醒和计数
- 智能聊天状态管理（活跃、待处理、已解决）

### 👥 客服管理
- 客服状态切换（在线、忙碌、离线）
- 实时绩效指标跟踪
- 活跃会话和已解决案例统计
- 客户列表管理和搜索功能
- 快捷回复功能

### 🔒 安全与认证
- 基于JWT的用户认证系统
- 安全令牌存储（使用Expo SecureStore）
- 密钥管理和每日轮换机制
- 基于角色的权限控制

### ⚙️ 系统设置
- 环境变量配置（通过.env文件）
- 推送通知设置
- 自动分配任务控制
- 工作时间和时区设置
- 团队管理选项

## 技术栈

- **框架**: Expo SDK 52.0.33
- **类型安全**: TypeScript 5.3.3
- **代码规范**: ESLint 9.0.0 + Prettier 3.3.2
- **导航**: Expo Router 4.0.17 + React Navigation Drawer
- **UI组件**: React Native 核心组件
- **实时通信**: Socket.io-client 4.8.1
  - 自动重连机制（指数退避算法）
  - 心跳检测（30秒间隔）
  - 连接状态监控界面
- **状态管理**: React Context API + ServiceContext
  - 统一服务实例管理
  - 依赖注入模式
  - 服务生命周期控制
- **认证**: JWT + Secure Storage
- **适配层**: 自定义API兼容适配器
- **图标**: Lucide React Native
- **字体**: Google Fonts (Inter 字体族)
- **日期处理**: date-fns
- **文件处理**: Expo Document/Image Picker, expo-sharing, react-native-view-shot
- **ID生成**: nanoid (用于生成5位字符的唯一链接)

## 项目结构

```
├── app/                   # Expo Router路由
│   ├── _layout.tsx        # 根布局
│   ├── +not-found.tsx     # 404页面
│   └── (drawer)/          # 抽屉导航
│       ├── _layout.tsx    # 导航配置
│       ├── chat/          # 聊天功能
│       ├── team.tsx       # 客户管理
│       └── settings.tsx   # 系统设置
├── src/
│   ├── adapters/          # 适配层
│   │   └── SecureStoreBridge.ts # SecureStore API兼容适配器
│   ├── components/        # UI组件
│   │   ├── chat/          # 聊天相关组件
│   │   └── agent/         # 客服相关组件
│   ├── contexts/          # 状态管理上下文
│   ├── services/          # 核心服务
│   │   ├── auth.ts        # 认证服务
│   │   ├── socket.ts      # WebSocket服务
│   │   ├── config.ts      # 配置服务
│   │   ├── syncService.ts  # 数据同步服务
│   │   └── socketService.ts # Socket连接管理
│   └── types/             # 类型定义
│       ├── index.ts       # 核心类型
│       └── env.d.ts       # 环境变量类型
├── assets/                # 静态资源
│   └── images/            # 图片资源（icon.png、favicon.png等）
├── hooks/                 # 自定义钩子
└── .env                   # 环境变量配置
```

## 开始使用

### 前置要求

- Node.js 18 或 20 版本（不推荐使用 Node.js 22+）
- npm 或 yarn
- Expo CLI

### 安装步骤

1. 克隆仓库：
   ```bash
   git clone <仓库地址>
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 配置环境变量：
   ```bash
   # 复制并根据需要修改环境变量
   cp .env.example .env
   ```

4. 修正环境变量格式：
   ```bash
   # 确保所有布尔值使用true/false而不是1/0
   # 例如：ENABLE_EMAIL_NOTIFICATIONS=true
   ```

5. 启动开发服务器：
   ```bash
   npm run dev
   ```

### TypeScript配置注意事项

本项目使用TypeScript，tsconfig.json包含以下关键配置：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",       // 启用JSX支持
    "esModuleInterop": true,  // 兼容CommonJS和ES模块
    "skipLibCheck": true,     // 跳过库文件检查，解决依赖冲突
    "paths": {
      "@/*": ["./*"]          // 路径别名，简化导入语法
    }
  }
}
```

如遇TypeScript错误，可能需要：
- 检查导入路径是否正确（使用相对路径或@别名）
- 确保socket.io-client等库的导入兼容性
- 验证JSX配置是否正确

### 解决路径别名问题

如果遇到`@/`路径别名无法解析的问题，可以：

1. 使用相对路径代替：
   ```typescript
   // 改用相对路径
   // 从: import { someIcon } from '@/assets/images/icon.png';
   // 到: import { someIcon } from '../../assets/images/icon.png';
   ```

2. 确保正确配置了babel-plugin-module-resolver:
   ```javascript
   // babel.config.js
   module.exports = function(api) {
     return {
       plugins: [
         ['module-resolver', {
           alias: {
             '@': './'
           }
         }]
       ]
     };
   };
   ```

3. 验证路径别名在Metro配置中正确映射：
   ```javascript
   // metro.config.js
   module.exports = {
     resolver: {
       extraNodeModules: {
         '@': path.resolve(__dirname, './')
       }
     }
   };
   ```

## 核心功能

### 实时聊天

系统使用 Socket.io 实现实时消息传递，支持：
- 文本、图片、文件和语音消息
- 消息状态跟踪（发送中、已发送、已送达、已读）
- "正在输入"状态提示
- 消息历史记录加载

### 客服操作面板

客服面板提供完整的客户管理工具：
- 客户列表与搜索
- 在线状态管理
- 会话统计
- 快捷回复选择

### 密钥管理

系统采用高级密钥管理机制：
- 预设30个nanoid密钥
- 基于日期的密钥轮换
- 前缀式ID生成，确保类型安全
- 支持管理员API密钥（通过环境变量配置）

### 管理员访问

系统支持管理员账号访问：
- 使用以"admin_"开头的客服ID
- 使用环境变量中配置的API密钥（默认为"adminayi888"）
- 管理员拥有额外权限：管理客服、查看分析数据、系统配置、分配聊天会话等
- 可通过.env文件中的ADMIN_API_KEY环境变量修改管理员密钥

### 环境变量配置

通过.env文件可配置各项系统参数：
- API和WebSocket端点
- JWT设置和管理员API密钥
- 系统限制（如最大客服数）
- 工作时间
- 通知设置
- 文件上传限制

**注意**：确保布尔值环境变量使用`true`/`false`而不是数字`1`/`0`。

## 开发指南

### 代码风格

- 使用TypeScript保证类型安全
- 使用React函数组件和hooks
- 遵循React Native最佳实践
- 使用异步/await处理异步操作
- 使用Context API进行状态管理

### 组件最佳实践

1. **性能优化**
   ```typescript
   // 使用 useMemo 和 useCallback 减少不必要的重渲染
   const memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);
   const memoizedCallback = useCallback(() => { doSomething(a, b); }, [a, b]);
   ```

2. **错误处理**
   ```typescript
   try {
     // API调用或其他可能失败的操作
   } catch (error) {
     // 错误处理
     console.error('操作失败:', error);
   }
   ```

3. **性能监控**
   ```typescript
   // 在关键操作处添加性能监控
   const startTime = performance.now();
   // 执行操作
   const endTime = performance.now();
   console.log(`操作耗时: ${endTime - startTime}ms`);
   ```

4. **图片资源管理**
   ```typescript
   // 使用相对路径而非路径别名加载图像资源
   // 良好做法：
   const avatar = require('../../assets/images/icon.png');
   
   // 避免使用（可能导致解析错误）：
   const avatar = require('@/assets/images/icon.png');
   ```

### 常见问题解决

1. **Node.js版本兼容性**：
   - 使用Node.js 18 或 20，避免使用Node.js 22+（存在Expo兼容性问题）
   - 如果遇到兼容性问题，可使用nvm切换Node.js版本

2. **端口占用问题**：
   - 如果遇到端口8081被占用，可用以下命令释放：
     ```bash
     npx kill-port 8081
     ```

3. **包版本不匹配**：
   - 运行`yarn expo install`更新依赖到兼容版本

4. **SecureStore版本兼容性问题**：
   - 项目使用适配层(SecureStoreBridge)解决不同版本expo-secure-store API差异
   - 遇到API兼容性问题时，可选择降级包：`yarn expo install expo-secure-store@12.8.1`
   - 或使用适配层：`import * as SecureStore from '../adapters/SecureStoreBridge'`
   - 注意：`ALWAYS`和`ALWAYS_THIS_DEVICE_ONLY`常量已被替换为安全的替代项：
     - 我们在适配层中将这些常量映射到`AFTER_FIRST_UNLOCK`和`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`
     - 这样可以避免TypeScript弃用警告，同时保持向后兼容性
     - 这种方法提供了更安全的密钥存储方式，符合安全最佳实践

5. **样式属性警告**：
   - 对于Web平台上的shadow*属性废弃警告，请使用boxShadow替代：
     ```javascript
     // 而不是使用这些（在Web平台上已废弃）：
     // shadowColor, shadowOffset, shadowOpacity, shadowRadius
     
     // 使用条件样式以兼容多平台：
     style={{
       ...(Platform.OS === 'web' ? {
         boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)'
       } : {
         // 在原生平台上保留原有shadow属性
         shadowColor: '#000',
         shadowOffset: { width: 0, height: 2 },
         shadowOpacity: 0.1,
         shadowRadius: 2,
       }),
       elevation: 2, // Android兼容性
     }}
     ```

6. **ImagePicker API废弃警告**：
   - 对于`MediaTypeOptions`废弃警告，使用`MediaType`API替代：
     ```javascript
     // 旧方法（已废弃）：
     const result = await ImagePicker.launchImageLibraryAsync({
       mediaTypes: ImagePicker.MediaTypeOptions.Images,
     });
     
     // 新方法（推荐）：
     const result = await ImagePicker.launchImageLibraryAsync({
       mediaTypes: ['images'], // 使用字符串数组指定媒体类型
     });
     ```

7. **聊天加载问题**：
   - 如果"加载更多消息"一直在循环加载，需要实现适当的分页和边界检查：
     ```javascript
     // 在状态中添加跟踪变量
     const [hasMoreMessages, setHasMoreMessages] = useState(true);
     
     // 加载更多消息函数
     const handleLoadMore = async () => {
       if (isLoadingMore || !hasMoreMessages) return;
       
       setIsLoadingMore(true);
       try {
         const hasMore = await loadMoreMessages(sessionId);
         setHasMoreMessages(hasMore);
       } catch (error) {
         console.error('加载更多消息失败', error);
         setHasMoreMessages(false);
       } finally {
         setIsLoadingMore(false);
       }
     };
     
     // 只在有更多消息时显示加载指示器
     {isLoadingMore && hasMoreMessages ? (
       <LoadingIndicator />
     ) : null}
     ```

## 部署

本项目可部署为:
1. Expo Go应用
2. 独立的原生应用
3. Web应用

完整的部署文档见[DEPLOYMENT.md](DEPLOYMENT.md)。

## 许可证

本项目采用 MIT 许可证 - 详见 LICENSE 文件。

## 问题修复说明

### 1. TypeScript类型错误解决方案

项目中遇到的TypeScript类型错误已通过以下方式解决：

- 创建了`tsconfig.json`文件，配置了正确的TypeScript设置
- 安装了`@types/react`和`@types/react-native`包
- 创建了`types/custom.d.ts`文件，为缺少类型声明的模块提供声明

### 2. pointerEvents弃用警告解决方案

React Native已弃用直接在组件上使用`pointerEvents`属性，应该改为在`style`对象中使用。
我们通过以下方式修复了这个问题：

- 移除了直接使用的`pointerEvents`属性
- 创建了`TouchableView`组件，正确处理`pointerEvents`
- 在`tabBarIconStyle`中使用了正确的样式对象格式

### 3. 其他改进

- 优化了JSX组件的嵌套和属性传递
- 添加了缺失的类型声明

## 使用说明

要启动应用，请执行：

```bash
npm install
yarn expo start
```

## 管理控制台

管理控制台可通过设置页面进入，提供以下功能：

- 系统状态概览
- API密钥管理
- 系统设置

只有管理员权限的用户可访问管理控制台。

## 最新功能：客服控制台

我们添加了功能强大的客服控制台组件，它提供以下功能：

### 客户管理
- 查看在线和离线客户列表
- 显示客户设备、IP地址和访问信息
- 未读消息提示

### 聊天功能
- 实时消息对话
- 支持表情选择
- 快捷回复模板管理
- 文件和图片发送

### 黑名单管理
- 将问题客户加入黑名单
- 查看和管理黑名单列表

### 分享链接管理
- 生成带有5位nanoid的唯一分享链接
- 实时生成链接对应的二维码
- 支持复制链接和保存二维码
- 链接访问统计和管理功能

## 如何使用客服控制台

1. 确保用户具有客服权限
2. 访问 `/admin/console` 路由
3. 界面分为左右两个面板：
   - 左侧：客户列表/黑名单/分享链接管理
   - 右侧：聊天界面

```jsx
import { AgentConsole } from '@/src/components/agent';

// 在您的页面中使用
<AgentConsole />
```

## 安装与启动

```bash
# 安装依赖
npm install

# 启动开发服务器
yarn expo start

# 特定平台启动
yarn expo start --web
yarn expo start --ios
yarn expo start --android
```

## 环境配置

在项目根目录创建 `.env` 文件，参考以下配置：

```
API_URL=http://localhost:3000
WS_URL=ws://localhost:3000/ws
JWT_SECRET=your_jwt_secret
MAX_DAILY_AGENTS=30
```

## 抽屉导航类型修复

```
declare module 'expo-router/drawer' {
  import { ComponentType } from 'react';
  
  export const Drawer: {
    Screen: ComponentType<any>;
    Navigator: ComponentType<any>;
    Group: ComponentType<any>;
  };
}

## DrawerIconProps类型

interface DrawerIconProps {
  color: string;
  size: number;
  focused?: boolean;
}