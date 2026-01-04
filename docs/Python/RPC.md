# RPC

RPC 是远程过程调用

**核心工作流程**

- **客户端调用**：客户端调用一个本地存根（Stub），就像调用普通函数。
- **序列化**：Stub 将函数名、参数等打包成**网络可传输的消息**（序列化）。
- **网络传输**：消息通过网络（如 HTTP/TCP）发送到服务端。
- **反序列化**：服务端接收到消息后解包（反序列化），调用实际函数。
- **返回结果**：服务端将结果序列化后返回，客户端 Stub 反序列化并返回给调用者。

- 在 RPC 中，客户端和服务器之间需要传递数据，这就需要一种数据格式来序列化和反序列化参数与返回值。
- 早期，XML 被广泛用于数据交换，例如在 SOAP（Simple Object Access Protocol）协议中，它使用 XML 作为消息格式。因此，基于 SOAP 的 RPC（有时称为 XML-RPC）会使用 XML。
- 而 JSON（JavaScript Object Notation）作为一种轻量级的数据交换格式，近年来非常流行。许多现代的 RPC 框架（如 gRPC、JSON-RPC 等）支持 JSON 作为序列化格式。例如，JSON-RPC 协议就是专门使用 JSON 格式的 RPC 协议。

1、 **不同 RPC 协议（gRPC/JSON-RPC）的区别**

它们是完全不同的协议栈，不仅数据格式不同，底层传输、会话管理、错误机制均不同。

即使都用 JSON，也不能混用不同 RPC 库（除非严格遵循同一规范，如 JSON-RPC 2.0 官方标准）

RPC 是一个“概念”或“设计模式”，而非单一的强标准

不同的 RPC 框架（如 gRPC, Dubbo, Thrift）各行其是，协议互不兼容

2、**用 RPC 还是 HTTP POST**

HTTP POST 完全可以实现 RPC，甚至可以说现有的很多 RPC（如 gRPC, JSON-RPC）底层就是用的 HTTP

但“用 HTTP POST”通常指的是简单的文本传输，而成熟的 RPC 框架在这个基础上做了大量的优化

当我们说“用 HTTP POST 替代 RPC”时，其实是在对比两种** API 设计风格**：**RESTful** vs **RPC**。