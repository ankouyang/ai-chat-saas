## AI Chat SaaS

这是一个按 Day 1 / Day 2 节奏推进的 AI 全栈练手项目，当前已经包含：

- 首页、登录页、聊天页基础骨架
- 全局主题和可复用展示组件
- Day 2 的 `Prisma + Auth.js` 代码结构

## 当前目录重点

- `app/`: 页面、路由、服务端入口
- `components/`: UI 组件
- `lib/`: 数据库和认证客户端
- `prisma/`: 数据模型
- `types/`: 类型扩展

## Day 2 启动步骤

1. 安装依赖
2. 复制 `.env.example` 为 `.env.local`
3. 填入 `DATABASE_URL`、`AUTH_SECRET`，如果要启用消息缓存，再补 Upstash Redis 配置
4. 执行 Prisma 初始化
5. 启动开发服务

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看页面。

如果没有配置数据库和密钥，`/chat` 会显示 Day 2 的引导说明，而不是放行真实聊天。

## Redis 消息缓存

聊天消息缓存现在支持 Upstash Redis。可选环境变量：

```bash
UPSTASH_REDIS_REST_URL="https://your-database.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
MESSAGE_CACHE_TTL_MS="15000"
```

- `UPSTASH_REDIS_REST_URL`：Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`：Upstash Redis REST Token
- `MESSAGE_CACHE_TTL_MS`：消息缓存 TTL，默认 `15000` 毫秒

如果没有配置 Upstash Redis 凭据，系统会自动回退为数据库直读。
