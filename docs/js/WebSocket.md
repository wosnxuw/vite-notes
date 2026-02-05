我们之前提到过 HTTP 协议，它是 运行在 TCP 上

TCP 的那一层，是运输层

HTTP 的那一层，是应用层

所以 HTTPS 对比 HTTP，实际上应用层没变化

只是在两个层之间的 会话层，额外添加了”传输安全“

HTTPS 的传输安全，是 TLS/SSL

HTTP/3.0 依赖 QUIC，集成了 TLS，直接就安全了

（根据 OSI 模型，TLS/SSL 通常被视为在传输层之上（会话层或表示层），但实际中常被归为传输层安全协议）

SSL/TLS 本质是两个协议一起用

与之平齐的还有：

SSH，但是一般用于远程登录

WireGuard，一般用于 VPN

OpenVPN，一个基于 SSL/TLS 的自定义协议

WebSocket 

它是一个基于 TCP 的 应用层协议，和 HTTP 地位相同，用于解决 HTTP 无法建立持久链接的情况

WebSocket 是一种双向实时通信协议，而 HTTP 是一种单向通信协议。并且，HTTP 协议下的通信只能由客户端发起，服务器无法主动通知客户端。

WebSocket 使用 ws:// 或 wss://（使用 SSL/TLS 加密后的协议，类似于 HTTP 和 HTTPS 的关系） 作为协议前缀，HTTP 使用 http:// 或 https:// 作为协议前缀。

建立 WebSocket，是需要在 HTTP 请求里请求升级为 WS，无法回退。

正常来讲，建立 WS 后，该 TCP 通道就只能按照 WS 的格式发送数据了。但是一些老的 ws 代理技术，又在这之上自己实现了 http 封装拆解，即 HTTP over WebSocket

WebSocket 的使用场景一般是：即时通话、OnShape 那种即时操作界面

SSE 

SSE 是一种技术规范，不是协议。它基于 HTTP，是 W3C 定义的 HTML5 标准的一部分

单工（仅服务器→客户端）

实现相对简单，主要在服务器端处理。浏览器端有标准的 EventSource API，使用方便。开发和维护成本较低。

响应头应里包含了 `text/event-stream`