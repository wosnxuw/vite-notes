# HTTP 协议与 Web 通信基础

这一篇承接传输层（TCP/UDP）继续往上走，回答三个基础问题：**浏览器和后端服务器之间到底在传什么文本/字节？HTTP 缓存（`Cache-Control` / `ETag`）和协议演进是如何提升性能的？在轮询、SSE、WebSocket 以及 REST / RPC / GraphQL 之间该怎么选型？**

---

## 一、HTTP 报文长什么样？

HTTP 是典型的**请求 - 响应（Request-Response）**模型：永远由客户端主动发起一次请求，服务器处理后返回一次响应。

底层 TCP 传输的是无边界的原始**字节流（byte stream）**；HTTP 只是在字节流之上约定的一套文本排版规则：**头部必须是 ASCII/UTF-8 文本，正文（Body）可以是 JSON、HTML，也可以是图片、视频等任意二进制数据**。

### 1. 请求报文（以 HTTP/1.1 为例）

一个标准 HTTP 请求由**四段**组成：请求行、请求头、空行、请求体。

```http
POST /api/user HTTP/1.1
Host: www.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOi...
Content-Length: 43

{"username": "john", "password": "123456"}
```

- **① 请求行**：`方法 + 路径 + 协议版本`（如 `GET /index.html HTTP/1.1`）。
  - `GET`：查询资源，参数放在 URL 的 `?` 后面（如 `/search?q=vite&page=1`），语义上**无副作用**（不修改服务端数据）。
  - `POST`：提交数据或触发操作，参数放在请求体里，**不保证无副作用**。
  - 其他常见方法：`PUT`（整条覆盖更新）、`PATCH`（局部字段更新）、`DELETE`（删除）、`OPTIONS`（浏览器跨域预检探测）。
- **② 请求头（Headers）**：每行一个键值对，用来声明客户端信息和数据格式：
  - `Host`：目标域名（HTTP/1.1 必填，一台服务器挂多个网站时全靠它区分）。
  - `Content-Type`：声明请求体的 MIME 格式，最常见是 `application/json` 或表单 `application/x-www-form-urlencoded` / `multipart/form-data`（上传文件）。
  - `Accept` / `Accept-Encoding`：告诉服务器客户端能接收什么格式（如 JSON）和压缩算法（`gzip`、`br`）。
  - `Authorization` / `Cookie`：携带身份认证凭证。
  - `User-Agent`：客户端标识。
  - `Connection: keep-alive`：复用 TCP 连接。
- **③ 空行（`\r\n`）**：固定用来分隔“头部”和“正文”。
- **④ 请求体（Body）**：实际载荷（`GET` 请求通常没有请求体）。

### 2. 响应报文与高频状态码

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: max-age=3600
ETag: "abc123"

{"id": 123, "name": "张三", "email": "zhangsan@example.com"}
```

响应第一行是 `版本 + 状态码 + 状态短语`。日常排障不需要背全表，记住这几个最常用来定责的状态码就够了：

| 状态码 | 含义 | 排障时的第一反应 |
| :--- | :--- | :--- |
| **`200` / `201` / `204`** | 成功 / 已创建 / 成功但无返回正文 | 请求正常完成（`DELETE` 常回 `204`） |
| **`301` / `302`** | 永久重定向 / 临时重定向 | 响应头里一定带 `Location`，如 HTTP 跳转 HTTPS |
| **`304`** | Not Modified（未修改） | 命中协商缓存，服务器没重传正文，浏览器继续用本地副本 |
| **`400` / `422`** | 参数错误 / 字段校验失败 | **客户端发的数据格式不对**（FastAPI 校验失败默认回 `422`） |
| **`401`** | Unauthorized（未认证） | **还没登录，或 Token/Cookie 过期无效** |
| **`403`** | Forbidden（无权限） | **知道你是谁，但你不配做这个操作**（比如普通用户调管理员接口） |
| **`404`** | Not Found | 路径拼错、Nginx `proxy_pass` 斜杠写错、或 SPA 刷新没配 `try_files` |
| **`413`** | Payload Too Large | 上传文件太大，多半撞上了 Nginx 默认的 `1MB` 上限 |
| **`429`** | Too Many Requests | 触发了限流（调大模型 API 最常见） |
| **`500`** | Internal Server Error | **后端代码自己抛了未捕获异常**，直接查后端日志 |
| **`502` / `504`** | 网关错误 / 网关超时 | **反代（Nginx）活着**：`502` 是连不上后端进程，`504` 是后端算太慢超时了 |

### 3. 路由与 HTTP 服务器的本质

所谓**HTTP 服务器**（用 FastAPI、Flask、Axum、Express 搭出来的后端 App），本质上和你用 Python 写一个死循环、不断读取用户输入并 echo 回复是同一回事——区别只是框架帮你屏蔽了底层 Socket 收发和 HTTP 字符串拆解的脏活。

而**路由（Routing）**，就是框架把解析出来的**方法（Method）+ 路径（Path）**映射到对应处理函数（Handler / Controller）的过程——无论是 Rust 里手写路径匹配类，还是 Python Flask/FastAPI 里的 `@app.route('/add', methods=['POST'])`，本质都是通过装饰器或注册表把你的业务函数交给框架回调。

---

## 二、彻底搞懂 HTTP 缓存：`Cache-Control` 与 `ETag`

前面响应示例里出现了两个非常高频的头：`Cache-Control: max-age=3600` 和 `ETag: "abc123"`。理解它们不仅能看懂浏览器 Network 面板里的 `200 (from disk cache)` 和 `304`，更是**上线后防止“明明发了新版，用户却还看到旧页面”的关键**。

HTTP 缓存分两层：**强缓存**（压根不发请求）和**协商缓存**（发个小请求问一下文件变没变）。

### 1. 强缓存：`Cache-Control`

服务器在响应头里通过 `Cache-Control` 告诉浏览器“这份文件在本地能直接用多久”：

- **`Cache-Control: max-age=3600`**：未来 3600 秒（1 小时）内，浏览器再次需要这个 URL 时**根本不发网络请求**，直接从本地内存/硬盘读出来（耗时 0ms）。
- **`Cache-Control: public, max-age=31536000, immutable`**：缓存整整一年，且声明“内容永不变”。现代前端打包工具（Vite/Webpack）会给 JS/CSS 文件名拼上内容哈希（如 `app.8f3a1c.js`），只要代码改了一行，文件名就会变，所以可以放心强缓存一年。
- **`Cache-Control: no-cache`**：**最容易望文生义的一个值！它不是“不缓存”，而是“允许缓存，但每次使用前必须先问一遍服务器文件有没有更新”（即跳过强缓存，直接进入下面的协商缓存）。**
- **`Cache-Control: no-store`**：这才是**彻底禁止缓存**（内存、硬盘、CDN 都不许存），用于银行账单、敏感个人信息等。

### 2. 协商缓存：`ETag` + `If-None-Match` → `304`

当强缓存过期了，或者服务器设置了 `Cache-Control: no-cache`，浏览器不会傻傻直接重新下载整个大文件，而是利用 `ETag` 跟服务器“对一下指纹”：

- **`ETag`**：服务器给文件算出的版本指纹（通常类似文件哈希，如 `ETag: "abc123"`），随第一次 `200 OK` 响应一起发给浏览器。
- 下次再请求同一 URL 时，浏览器会在请求头自动带上 `If-None-Match: "abc123"`，问服务器：“我手里有 `abc123` 这版，线上变了吗？”
  - **没变**：服务器只回一个 **`304 Not Modified`**（**没有响应体**，只有几百字节头部），浏览器放心继续用本地缓存；
  - **变了**：服务器回 **`200 OK`** + 新的完整正文 + 新的 `ETag: "def456"`。

把**强缓存**和**协商缓存**串起来，完整判断顺序只有三步：

1. **首次访问（无缓存）**：浏览器发 `GET /index.html` → 服务器回 `200 OK` + 正文 + `Cache-Control: max-age=60` + `ETag: "abc123"`，浏览器存入本地。
2. **有效期内再访问（60 秒内）**：直接命中**强缓存**，不发任何网络请求，0ms 从本地读取。
3. **过期后再访问（60 秒后，或原本就是 `no-cache`）**：进入**协商缓存**，浏览器发 `GET /index.html` 并带上 `If-None-Match: "abc123"`：
   - 文件没变 → 服务器回 **`304 Not Modified`**（空正文，省带宽），浏览器继续用本地副本；
   - 文件变了 → 服务器回 **`200 OK`** + 新正文 + 新 `ETag: "def456"`。

> **前端上线防“旧缓存”的黄金组合**：
> - 入口文件 **`index.html`** 配 `Cache-Control: no-cache`（每次打开网页都向服务器对一次 `ETag`，没发版就秒回 `304`，一旦发新版立刻拿到新 `index.html`）；
> - `index.html` 里引用的**带哈希静态文件**（如 `assets/index-9a2b3c.js`）配 `Cache-Control: public, max-age=31536000, immutable`（强缓存一年，发版后新 `index.html` 引用的是新文件名，彻底避开旧缓存）。

---

## 三、HTTP 版本演进：1.0 → 1.1 → 2 → 3

HTTP 运行在传输层（TCP/UDP）之上。加上加密层（TLS/SSL，工程上夹在传输层与应用层之间）就是 HTTPS（同级的其他加密协议如 SSH、WireGuard、OpenVPN 详见 Network 目录）。

| 版本 | 底层传输 | 核心解决的问题 | 遗留局限 |
| :--- | :--- | :--- | :--- |
| **HTTP/1.0** | TCP（短连接） | 最早的请求 - 响应文本传输 | 每次请求都要重新 TCP 握手/挥手，开销极大 |
| **HTTP/1.1** | TCP（**长连接**） | 默认 `keep-alive` 复用同一条 TCP 连接（也因此能支持 SSE 长响应） | **应用层队头阻塞**：同一条连接上必须串行一问一答；浏览器为了并发不得不对同一域名开 6~8 条 TCP 连接 |
| **HTTP/2** | TCP（**多路复用**） | 把报文切成二进制帧，**同一条 TCP 连接上可以同时并发收发几十个请求和响应**，互不阻塞，还加入了头部压缩（HPACK） | 仍跑在 TCP 上，存在 **TCP 层队头阻塞**：公网丢了一个 TCP 包，整条连接上的所有并发流都要原地等重传 |
| **HTTP/3** | **UDP + QUIC** | 把可靠传输、多路复用和 **TLS 1.3** 全部集成进基于 UDP 的 QUIC 协议；单条流丢包不影响其他流，手机切 Wi-Fi/5G 时连接不断（Connection Migration） | 部分老旧企业防火墙或运营商对 UDP 限速/丢包，通常需要保留 HTTP/2 自动降级 |

---

## 四、超越请求 - 响应：轮询、SSE 与 WebSocket 怎么选？

HTTP 天然只能**客户端问、服务器答**，服务器没法主动给浏览器推消息。遇到股票行情、聊天室、AI 打字机流式输出、协同编辑（如 OnShape）这类实时场景时，工程上有四种主流做法：

1. **短轮询（Polling）**：前端每隔几秒用定时器发一次普通 HTTP 请求问“有新数据吗？”。实现最傻瓜，但大量无效空请求浪费带宽和服务器算力。
2. **长轮询（Long Polling）**：客户端发请求后，服务器先挂起连接不回，直到有新数据或超时再返回，客户端收到后立刻再发下一个。比短轮询省流量，但仍需反复重建请求。
3. **SSE（Server-Sent Events）**：
   - **不是独立协议**，而是基于普通 HTTP 的 W3C 标准规范。
   - **单向通道（仅服务器 → 客户端）**：服务端返回响应头 `Content-Type: text/event-stream`，保持 HTTP 长连接不断开，源源不断按行往下推 `data: ...\n\n` 文本块。
   - 浏览器原生提供 `EventSource` API（支持自动断线重连）；如果需要 `POST` 传请求体或自定义 `Authorization` 请求头（例如调用大模型对话接口），前端直接用原生 `fetch` 读取流即可。
   - **开发、鉴权、过 Nginx/CDN 成本远低于 WebSocket**。
4. **WebSocket（`ws://` / `wss://`）**：
   - 和 HTTP 平级的独立应用层协议（跑在 TCP 上，加 TLS 加密即为 `wss://`）。
   - **全双工双向实时通信**：建立时先借用一次 HTTP 请求带上 `Upgrade: websocket` 头向服务器申请升级协议；升级成功后，这条 TCP 通道就永久转为 WebSocket 二进制/文本帧格式，**无法回退回 HTTP**，客户端和服务端可以随时互相发消息。（注：部分老式代理技术会在 WS 通道之上再手动封装 HTTP，即 HTTP over WebSocket。）

### 选型一句话对照

| 方案 | 通信方向 | 协议成本与穿透性 | 最适合的场景 |
| :--- | :--- | :--- | :--- |
| **轮询** | 客户端定时拉 | 极低（纯普通 HTTP） | 后台任务进度查询、几秒延迟无所谓的看板 |
| **SSE** | **单向（服务端 → 客户端）** | **低（纯 HTTP，天然复用 Cookie/Header/负载均衡）** | **大模型打字机流式输出、站内消息通知、实时日志流** |
| **WebSocket** | **全双工（双向随时推）** | 中高（需维护有状态连接、心跳保活、反代 Upgrade 配置） | **即时聊天、多人协同编辑（OnShape/Figma）、实时语音信令、网页游戏** |

> **指挥 AI 时的关键选型原则**：做 AI 对话、Agent 步骤推送、进度条直播时，**默认选 SSE，不要一上来就上 WebSocket**；只有客户端也需要高频向服务端持续推送数据（双向交互）时，才值得为 WebSocket 支付状态管理和连接保活的运维代价。

---

## 五、API 架构风格选型：REST vs RPC vs GraphQL

### 1. RESTful API（当前最通用默认选项）

名称源于 Roy Fielding 2000 年博士论文提出的 **REST（Representational State Transfer，表述性状态转移）**：
- **以资源为中心**：每个对象有唯一 URL（如 `/users/123`、`/orders/456`），而不是满屏动词（如 `/getUserById`）。
- **用 HTTP 方法表达动作**：`GET /users/123` 查、`POST /users` 建、`PATCH /users/123` 改、`DELETE /users/123` 删。
- **无状态**：服务器不依赖上一次请求的上下文，每次请求自带完整信息（如 Token）。

**优点**：任何语言、任何工具（`curl`、浏览器、FastAPI 自动生成的 OpenAPI/Swagger 文档）开箱即用，也是 AI 最熟悉、出错率最低的接口风格。

### 2. RPC (gRPC / tRPC)

把远程接口当成本地函数调用来设计（以“动作”为中心，而不是硬套资源名词）：
- **gRPC**：基于 HTTP/2 + Protobuf 二进制序列化，性能极高、强类型，适合**后端微服务之间内部通信**；但浏览器不能直接原生调标准 gRPC（需要 `grpc-web` 网关中转），一般不直接暴露给普通前端。
- **tRPC**：专门服务于 **TypeScript 全栈项目**（前后端都写 TS）。后端写好函数类型，前端直接 import 类型就能获得端到端自动补全和编译期报错，连写 OpenAPI 文档和手敲 URL 路径都省了。

### 3. GraphQL

由前端决定“我这次需要哪些字段”，在一个统一端点（通常 `POST /graphql`）里用查询语句精准要数据，解决移动端多端适配中 REST 接口“返回字段太多（Over-fetching）”或“要拼 5 个接口（Under-fetching）”的问题。
- **代价**：引入了查询解析、权限细粒度控制、N+1 数据库查询性能问题和 HTTP 缓存失效等复杂度。**中小型项目和非超复杂多端业务，通常没有必要上 GraphQL。**

---

## 六、动手最小闭环：发请求与起一个后端

真正写代码时不需要手拼 HTTP 字符串，全部用成熟库完成。

### 1. 发送请求的三要素与常用工具

向任何接口发请求，本质只需要填三样东西：**① URL**、**② 请求头**（`Content-Type`、鉴权 Token 等）、**③ 与 `Content-Type` 匹配的请求体**（JSON 或表单）。

- **终端调试：`curl`**（在 Linux / macOS / Git Bash 下运行，避免 Windows CMD 的引号转义坑）
  ```bash
  curl -X POST http://localhost:5000/add \
    -H "Content-Type: application/json" \
    -d '{"a": 10, "b": 5}'
  ```
  > 这里的 `Content-Type: application/json` 之所以必填，是因为后端（如 Flask 的 `request.get_json()` 或 FastAPI）会依据该请求头决定按 JSON 还是表单来解析请求体。

- **Python：`requests`（或支持异步的 `httpx`）**
  ```python
  import requests

  url = "http://localhost:5000/add"
  payload = {"a": 10, "b": 5}  # 直接传字典，库会自动序列化 JSON 并补上 Content-Type

  try:
      resp = requests.post(url, json=payload, timeout=10)
      resp.raise_for_status()  # 非 2xx 状态码主动抛异常
      print("成功：", resp.json()["result"])
  except requests.exceptions.HTTPError:
      print(f"请求失败 [{resp.status_code}]: {resp.text}")
  except Exception as e:
      print("网络或解析异常：", e)
  ```

- **浏览器 / JS 前端：`fetch` vs `axios`**
  - **`fetch`**：现代浏览器和 Node.js 18+ 原生内置，零依赖，且**原生支持读取 SSE 流式响应**（`response.body.getReader()`）。注意它有个经典反直觉点：遇到 404/500 **不会**自动抛异常，必须手动检查 `if (!resp.ok)`。
  - **`axios`**：老牌第三方封装库，胜在内置请求/响应拦截器（方便统一注入 Token、统一处理 401 刷新登录）、自动抛 HTTP 错误和更直观的超时设置。

### 2. 起一个后端 HTTP 服务（Flask / FastAPI）

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify({"message": "Calculator API is running!"})

@app.route('/add', methods=['POST'])
def add():
    data = request.get_json()
    if not data or 'a' not in data or 'b' not in data:
        return jsonify({"error": "Missing parameters 'a' and 'b'"}), 400
    return jsonify({"result": data["a"] + data["b"]})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

现代 Python 新项目通常优先选用 **FastAPI + uvicorn**（ASGI 异步服务器）：写法与 Flask 高度相似，但原生支持 `async/await` 并发、基于 Pydantic 自动做请求参数校验（校验失败自动回 `422`），并且开箱自动生成 `/docs` 交互式 OpenAPI 接口文档，极大降低前后端联调和让 AI 对接接口的成本。
