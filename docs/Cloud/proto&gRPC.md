### 关系

gRPC 默认使用 Proto 作为它的作为它的接口定义语言（IDL）和数据序列化格式

并非绑定，但大概率一起出现。你可以只在纯本地用 Protobuf 来存储数据，或者其他方式传输 Protobuf

你可以把 Proto 理解为标准集装箱

### Proto

（1）proto 定义文件，`.proto`

（2）wire 线上传输格式

（3）contract 契约 两个系统之间约定好的、必须长期保持兼容的东西

（4）protoc 编译器，生成 xxx_pb2.py

（5）proto 运行时，你的 xxx_pb2.py 必须依赖运行时才能跑起来，负责 encode decode

### 匹配

A 应用能理解 B 应用的 proto

不需要 protoc 一致，也不需要 runtime 一致，也不需要 xxx_pb2.py 一致

只需要字段匹配（即，你认为第一个是 user，我也是；你可以第三个是 age，但是我不知道也无所说）

如果用 gRPC 传输，也不要两侧的 grpc 版本一模一样，因为本质是 HTTP2 + protobuf wire format

### 问题

我是在 A 仓库有一个 .proto，用 A 仓库的较新的 protoc 编译器编译了

然后我并没有把 .proto 复制到 B 仓库，而是把 xxx_pb2.py 复制到 B，然后试图用 B 仓库里一个老的 proto runtime 跑，这不行

较新 gencode + 较旧 runtime =可能 import 失败或运行错误

官方明确区分了 gencode 和 runtime，并指出“不受支持的跨版本组合”可能报错或产生未定义行为

所以正确做法应该是复制 .proto，而不是编译产物