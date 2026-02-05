HTTP 协议主要基于 **请求-响应** 模型。

客户端发送一个 HTTP 请求到服务器，然后服务器返回一个 HTTP 响应。

以 HTTP/1.1 为例

**请求**

一、请求行

这是第一行，包括 **方法+路径+版本**

```
GET /index.html HTTP/1.1
```

二、请求头

这里，每行是一个键值对

```
Host: www.example.com          # 目标主机（必需）
User-Agent: Mozilla/5.0...    # 客户端标识
Accept: text/html,application/xhtml+xml  # 可接受的 MIME 类型
Accept-Language: zh-CN        # 语言偏好
Accept-Encoding: gzip, deflate # 压缩方式
Content-Type: application/json # 请求体类型（POST/PUT 需要）
Content-Length: 348           # 请求体长度
Authorization: Bearer token   # 认证信息
Cookie: name=value           # Cookie
Connection: keep-alive       # 连接控制
```

三、空行

```
\r\n
```

四、请求体

可能是一个 json

```
{"username": "john", "password": "123456"}
```

完整如下：

```
POST /api/user HTTP/1.1
Content-Type: application/json

{"username": "john", "password": "123456"}
```

**响应**

```
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: max-age=3600
ETag: "abc123"

{"id": 123, "name": "张三", "email": "zhangsan@example.com"}
```

**路由**

路由（Routing）就是根据 HTTP 请求中的**方法（Method）** 和**路径（Path）**，将请求**映射**到对应的处理函数（Handler/Controller），并返回相应结果的过程

就是当时那个 Rust 里拆解路径的类

就是 Flask 里

```
@app.route('/')
```

**编码**

**TCP 层**：传输的是原始的**字节流（byte stream）**

**HTTP** 消息的 **头部必须是 ASCII/UTF-8 文本**，但**正文可以是任意二进制数据**

**HTTP 服务器**

你用框架搭建的那个 App，称之为 Http 服务器是最合理的

它其实本质上，和你用 python 写一个死循环，不断 echo 用户的输入是类似的

只不过，它屏蔽了网络的细节，让你快速使用 http

**HTTP/1.1**

HTTP/1.0 为短连接，HTTP/1.1 支持长连接

所以 HTTP/1.1 就能支持 SSE 了

**HTTP/2.0** 

多路复用：

HTTP/2.0 在同一连接上可以同时传输多个请求和响应（可以看作是 HTTP/1.1 中长链接的升级版本），互不干扰。

HTTP/1.1 则使用串行方式，每个请求和响应都需要独立的连接，而浏览器为了控制资源会有 6-8 个 TCP 连接的限制。这使得 HTTP/2.0 在处理多个请求时更加高效，减少了网络延迟和提高了性能。