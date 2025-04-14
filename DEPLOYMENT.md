## Web应用部署

### 前置条件
1. 已安装Node.js 18+
2. 项目已配置正确环境变量
3. 安装Expo CLI：`yarn global add expo-cli`

### 构建步骤
```bash
# 安装依赖
yarn install

# 构建Web静态文件
expo build:web

# 生成的静态文件位于web-build目录
```

### 部署到Netlify
1. 新建站点并连接Git仓库
2. 构建命令：`yarn build`
3. 发布目录：`web-build`
4. 环境变量配置：
   - 添加`.env`文件中的所有变量
   - 设置`NODE_VERSION=18`

### 部署到Vercel
1. 导入Git仓库
2. 框架选择"Expo"
3. 构建命令自动检测为`yarn build`
4. 输出目录保持`web-build`
5. 通过Dashboard添加环境变量

### 本地预览
```bash
yarn serve -s web-build -p 3000
```

### 注意事项
- 确保`app.json`包含web配置
- 检查路由适配：
```json
{
  "expo": {
    "web": {
      "bundler": "metro",
      "favicon": "./assets/images/favicon.png"
    }
  }
}
```