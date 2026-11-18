# SnapUI 前端

SnapUI 将文字需求和界面截图转为 React/TSX 组件，支持对话调整、实时预览、源码复制，以及作品发布、收藏和引用创作。本工程负责浏览器界面；业务数据、图片存储和模型调用由后端处理。

## 三个工程的关系

```text
React + TypeScript + Vite（本工程，默认 5173）
  │ HTTP / SSE，JWT 身份认证
  ▼
OCRServer：Node.js + Express（默认 3000）
  ├─ MySQL：用户、积分、会话目录、作品、模型配置、附件引用
  ├─ 阿里云 OSS：私有截图文件
  ├─ MiMo：截图理解；关闭 Agent 时直接生成组件
  └─ Python：FastAPI + 模型生成 + Milvus RAG（默认 8000）
       └─ PostgreSQL：对话消息、运行状态、长期偏好
```

配套文档：[OCRServer README](../../backend/OCRServer/README.md)、[Python README](../../backend/langchain1.2_tutorial/README.md)。浏览器只访问 OCRServer，不直接访问 Python、数据库或模型供应商。

## 启动与构建

需要 Node.js 和 pnpm，Node.js 版本需满足当前 Vite 8 的运行要求。

```bash
pnpm install
pnpm dev
```

在 `.env.development` 中配置后端地址，不包含 `/api` 后缀：

```dotenv
VITE_BASE_URL=http://127.0.0.1:3000
```

Vite 默认使用 5173，端口占用时以终端输出为准。工程没有配置 Vite API 代理；请求地址由 `VITE_BASE_URL` 决定。生产地址写入 `.env.production`，修改后重新构建。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 开发服务与热更新 |
| `pnpm build` | TypeScript 检查 + development 模式构建 |
| `pnpm build:prod` | TypeScript 检查 + production 模式构建 |
| `pnpm preview` | 本地预览 dist 构建产物 |
| `pnpm lint` | 全工程 ESLint 检查 |

部署 `dist/` 时，静态服务器需将 `/chat`、`/profile` 等前端路径回退到 `index.html`，支持刷新和直接访问。

### TypeScript 格式约定

项目使用 Stylistic 5.x 统一两空格缩进、泛型间距和行尾空白，并通过本地 ESLint 规则让多参数函数声明每个参数独占一行。单参数函数、普通函数调用与短泛型实参保持原有布局；不会自动添加返回类型。

```ts
export const post = <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> =>
  instance.post<T, T>(url, data, config);
```

WebStorm 使用项目 ESLint 自动配置，并开启保存时 ESLint 修复即可应用规则，无需修改全局 Code Style。命令行可针对文件执行 `pnpm exec eslint src/utils/request.ts --fix`；现有文件仍需逐步按规则整理。

## 入口与模块

入口链：`index.html → src/main.tsx → src/App.tsx → src/router/index.tsx`。

| 文件或目录 | 职责 |
| --- | --- |
| `src/main.tsx` | 创建 React 根节点，启用 StrictMode，加载全局样式 |
| `src/App.tsx` | 装配 RouterProvider 与全局 Toast |
| `src/router/` | 路由、页面懒加载和登录保护 |
| `src/components/Layout.tsx` | 导航与公共布局 |
| `src/chat/` | 聊天业务模块，含页面、输入上传、消息展示和会话状态 |
| `src/chat/ChatPage.tsx` | 路由入口、作品引用上下文和页面编排 |
| `src/chat/Chat.tsx` | 输入草稿、截图上传与移除、模式和模型选择、组装发送参数 |
| `src/chat/ChatMessages.tsx` | 消息、历史截图入口、预览与源码操作 |
| `src/chat/useChat.ts` | 会话列表、创建与切换、发送、停止、历史加载和引用作品发布 |
| `src/chat/types.ts` | 聊天消息、发送参数和路由上下文类型，不依赖 UI |
| `src/api/chat.ts`、`chatStream.ts` | 会话接口，以及带认证重试的 SSE 传输与解码 |
| `src/api/attachments.ts` | 截图上传、签名 URL 刷新、未引用附件删除 |
| `src/api/modelProfiles.ts`、`works.ts` | 用户模型配置与作品、收藏、引用接口 |
| `src/components/Preview/` | 聊天、首页、作品共用的 TSX 编译预览与内存路由 |
| `src/components/Works/` | 作品卡片、源码与预览展示 |
| `src/stores/` | Zustand 用户、签到和模型共享状态 |
| `src/utils/request.ts`、`token.ts` | Axios、JWT 存取和 401 刷新；SSE 使用独立 fetch 链路 |

## 页面路由

| 路径 | 功能 |
| --- | --- |
| `/` | 首页介绍和创作入口 |
| `/chat` | 新增/调整组件，空会话提供需求模板，侧栏展示最近 30 条会话 |
| `/history` | 分页管理全部对话；选中后进入 chat 加载内容 |
| `/gallery` | 公开作品浏览与搜索 |
| `/works`、`/works/:id` | 个人作品管理与作品详情 |
| `/profile` | 个人信息、个人作品集、模型管理三个 Tab |
| `/credits` | 积分信息 |
| `/login`、`/register`、`/forgot-password` | 账户相关页面 |
| `/quick-start` | 兼容旧地址，重定向至 chat |

`/history/:conversationId` 前端详情路由已移除；后端同名历史详情 API 仍用于加载消息。

## 工作流程

### 文字或截图生成组件

阅读生成流程可从 `src/chat/useChat.ts` 的 `sendMessage` 开始。追溯输入与截图操作时，查看 `Chat.tsx`，再沿 `ChatPage.tsx` 的 `handleSendMessage` 进入会话流程。首页模板、历史会话和作品引用共用 `ChatPage.tsx` 的路由上下文处理。

1. 用户输入需求，选择新增/调整模式及平台模型或个人模型。
2. 选择截图时先调用 `/api/attachments`，取得附件 ID 和签名预览地址；上传数据只在浏览器临时使用。
3. `Chat` 组装输入，`ChatPage` 补充引用作品上下文，`useChat.sendMessage` 创建或复用会话，再通过 `api/chatStream.ts` 提交原始 message、mode、可选 attachmentId、referenceWorkId、会话 ID 和模型选择。前端不拼装系统提示词，不发送引用作品源码或已保存的 API Key。
4. OCRServer 核验权限、组装提示词，执行截图理解与生成，返回 `start / delta / done / error` SSE。
5. 前端逐步展示回复，提取代码块交给 LivePreview 编译预览；停止按钮中止请求。

切换会话时，`useChat` 中止旧请求，并通过 `operationRef` 防止旧结果覆盖新会话。单独点击停止会保留已生成的文字。`Chat` 通过 `uploadEpoch` 丢弃过期上传结果，并尝试删除对应的新附件。

源码需提供 `Component` 或默认导出。前端通过 Babel 编译并移除 import，然后把编译结果发送到 `sandbox="allow-scripts"` 的 iframe。iframe 内运行 React 和内存路由，并通过消息端口回传尺寸与渲染错误。聊天、首页和作品共用这个预览器。iframe 的内容安全策略允许内联样式以及 `data:`、`blob:` 图片，阻止生成组件直接请求远程资源。

### 历史截图继续调整

历史 API 返回附件元数据和短期签名 URL；AttachmentImage 在加载失败时尝试刷新 URL。用户明确选择“用于调整”后，下一轮提交同一个附件 ID，可勾选“重新识别截图”。历史图片不会自动在每轮发送给模型。

取消历史截图只取消选择。移除新上传、未引用的截图时尝试删除附件；遗留文件由后端清理。

### 作品与模型管理

- 生成源码可发布为作品；公开作品支持收藏、引用。引用创作提交作品 ID，后端核验权限并读取源码。
- 个人模型在 profile 的模型管理 Tab 配置地址、模型名和 API Key。保存后仅展示掩码，聊天传 modelProfileId，后端加密保存密钥。
- 个人作品集首次打开后保持挂载，切换 Tab 时隐藏，避免重复加载与入场动画闪烁。

## 联调与检查

准备 MySQL、OSS 和模型配置，启动 Python、OCRServer，再启动前端。Node 的 AGENT_SERVICE_URL 必须与 Python 实际端口一致：当前 Node 默认 8001、Python 默认 8000，需显式统一。

运行 `pnpm build` 检查类型和构建，运行 `pnpm lint` 检查代码规范。浏览器联调可按“登录 → 上传截图 → 生成预览 → 重开历史 → 选择历史截图调整 → 发布作品”检查完整链路，并验证流式回复期间停止、切换会话和引用作品生成。
