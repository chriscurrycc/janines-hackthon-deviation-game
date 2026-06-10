# Deviation Game · 技术设计文档（给工程）

> 面向开发者。三张图说清系统：**技术架构**、**WebSocket 交互**、**房间状态**。图用 [Mermaid](https://mermaid.js.org/) 绘制，GitHub 可直接渲染。

---

## 1. 技术架构图

```mermaid
flowchart TB
  subgraph Client["🌐 浏览器 · 玩家"]
    UI["游戏界面（React）"]
  end

  CADDY["Caddy 反向代理<br/>HTTPS / WSS"]

  subgraph Web["Web 服务 · Next.js · :7242"]
    PAGE["页面 + HTTP 接口<br/>/api/guess · /api/rooms"]
  end

  subgraph RT["实时服务 · WebSocket · :7243"]
    WSS["房间与对局逻辑<br/>内存状态"]
  end

  AI["Anthropic<br/>Claude 视觉模型"]

  UI -->|"HTTP / WebSocket"| CADDY
  CADDY -->|"/ws"| WSS
  CADDY -->|"其余页面 + /api"| PAGE
  PAGE -->|"单人识图"| AI
  WSS -->|"多人识图"| AI
```

**说明**

- **两个后端服务，各司其职**：
  - **Web 服务（Next.js）**——无状态。负责页面、单人模式的 AI 接口（`/api/guess`）、以及房间列表代理（`/api/rooms`）。
  - **实时服务（WebSocket）**——有状态。负责多人房间：连接、笔迹同步、出题、计分、对局推进；房间状态全部在内存里。
- **为什么拆两个**：Next.js 不擅长长连接，而实时对局需要常驻 WebSocket。拆开后二者可独立重启/扩缩容，互不影响。
- **Caddy 统一入口**：自动 HTTPS，把 `/ws` 路由到实时服务、其余到 Web 服务；浏览器只看到一个域名。
- **AI 在服务端调用**：视觉模型由后端调用（密钥不进浏览器），单人与多人共用同一套识图逻辑。

---

## 2. WebSocket 交互流程图

> 三个角色：🎨 **画画的人**、🙋 **作答的人**、🤖 **AI**。它们都不直接对话，而是通过**实时服务器**这个 WebSocket 中枢交互。下图从「加入房间」开始，走完一整局。

```mermaid
sequenceDiagram
  actor Drawer as 🎨 画画的人
  actor Guesser as 🙋 作答的人
  participant RT as 🔌 实时服务器（WebSocket 中枢）
  participant AI as 🤖 AI

  Note over Drawer,Guesser: 各自浏览器通过 WebSocket 连到 /ws

  Drawer->>RT: join（房间码 + 昵称）
  RT-->>Drawer: joined + state（房间快照）
  Guesser->>RT: join
  RT-->>Guesser: joined + state
  Note over RT: 任何状态变化，都向房内所有人广播 state

  Note over RT: 房主开局 → 出题、指定本轮画手
  RT-->>Drawer: state（轮到你画 · 词：X）
  RT-->>Guesser: state（等待画手作画）

  loop 画手作画
    Drawer->>RT: stroke（一段笔迹）
    RT-->>Guesser: stroke（实时转发给其他人）
  end

  Guesser->>RT: guess（选一个选项）
  Drawer->>RT: submitDrawing（提交画布图片）
  RT->>AI: 把图片 + 选项交给 AI 识别
  AI-->>RT: 返回猜测结果

  Note over RT: AI 已答 且 作答者都已锁定 → 进入结算
  RT-->>Drawer: state（reveal · 公布答案与得分）
  RT-->>Guesser: state（reveal）

  Note over RT: 房主点「下一局」→ 轮换画手，回到作画
```

**说明（WebSocket 怎么运作）**

- **持久连接**：每个浏览器与实时服务器保持一条 WebSocket 长连接（`/ws`），双向随时收发，不必反复发 HTTP。
- **服务器是唯一真相源**：客户端只发「意图」消息，服务器据此更新房间状态，再把最新 `state` **广播**给房内每个人；界面永远跟随推送的 `state` 渲染。
- **客户端 → 服务器**：`join`、`start`（房主开局）、`stroke`（一段笔迹）、`guess`（作答）、`submitDrawing`（交给 AI）、`next`/`end`（下一局/结束）。
- **服务器 → 客户端**：`state`（按观看者裁剪，非画手在结算前看不到答案）、`stroke`（转发他人笔迹）、`replay`（中途加入/重连时回放当前画面）。
- **实时同步靠转发**：画手每画一笔就发一条 `stroke`，服务器原样转发，于是大家「同屏」看到作画过程。
- **AI 不是 WebSocket 客户端**：它由服务器在「画手提交」后调用，结果并入房间状态再广播；何时结算由服务器判断（AI 已答 + 所有在线作答者都锁定）。

---

## 3. 房间状态图

```mermaid
stateDiagram-v2
  state "🕓 等待中 · lobby" as L
  state "🎨 作画中 · draw" as D
  state "🔍 结算 · reveal" as R
  state "🏁 已结束 · ended" as E

  [*] --> L: 创建房间
  L --> D: 房主开局
  D --> R: AI 已答 + 作答者都锁定
  R --> D: 下一局 · 轮换画手
  R --> E: 达到结束条件 · 或房主提前结束
  E --> L: 再玩一局
  D --> [*]: 所有人离开 · 房间释放
```

**说明**

| 阶段 | 含义 | 主要操作 |
| --- | --- | --- |
| `lobby` | 等人 + 房主配置玩法 | 房主：选结束方式与参数、选类别开局 |
| `draw` | 画手作画，其他人随时抢答 | 画手：画 + 提交；作答者：锁定一次猜测 |
| `reveal` | 公布答案与本局得分 | 房主：下一局 / 提前结束 / 查看最终结果 |
| `ended` | 展示最终比分与胜负 | 房主：再玩一局（回到 `lobby`） |

- **进入结算（draw → reveal）**：AI 已给出猜测、且所有在线作答者都锁定答案时自动结算。
- **结束（→ ended）**：到达结束条件（固定局数玩满，或抢分有阵营达标），或房主随时「提前结束」。
- **房间释放**：房间里所有人离开后自动清空（状态在内存，进程重启也会清空）。
