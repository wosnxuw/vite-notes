### 关系

gRPC 默认使用 Proto 作为它的作为它的接口定义语言（IDL）和数据序列化格式

并非绑定，但大概率一起出现。你可以只在纯本地用 Protobuf 来存储数据，或者其他方式传输 Protobuf

但是大概率 Proto 是用作跨语言的接口，所以必然要用 gRPC 发送/接受数据

Proto = 字符串，gPRC = HTTP

### 概念

编译类：

（1）proto 定义文件，`.proto`，如果说 Schema，那么指 .proto

（2）protoc 编译器，但是它只负责调度编译器插件，不负责直接产出代码。

它位于：`~/.local/bin/` Linux 用户级可执行文件的“默认推荐位置”之一，uv 也在这里（其实是 symlink 过去的）

（3）proto 编译器插件--消息代码，比如 protoc-gen-go，被 protoc 调度，然后产出 xxx.pb.go

（4）proto 编译器插件--gRPC 服务代码，比如 protoc-gen-go-grpc，同样被 protoc 调度，产出 xxx_grpc.pb.go

正常情况下：

（5）grpcio-tools，python 世界的一个包，内置了三者（protoc message插件 gPRC插件）

（6）buf 一个 protoc 的高级包装器

运行时：

（1）proto 运行时，你的 xxx_pb2.py 必须依赖运行时才能跑起来，消息和 rpc 各有一套

python 的叫做 protobuf、grpcio

go 的叫做 google.golang.org/protobuf + google.golang.org/grpc

（2）wire 兼容。

wire 直译是电线，但是在这个语境下，好比 “bug”，没有一个特别好的中文译名，所以一般直接保留英文

大概就是指，传输过程中流转的那个格式，那个二进制

### 匹配

在多仓库的项目里

（1）A 仓库定义了某一个 .proto，相当于 schema 的维护者，它选择了自己的编译器和运行时版本

（2）对于其他使用者而言，它们必须认识的是 A 给出的 wire

（3）对于 B 而言，为了在运行时认识 wire，它持有匹配的运行时和 pb2.py 其实就能跑（其实它可以没有 A 的 proto），这甚至是一种标准做法，把 pb2.py 专门放在一个仓库里，其他消费者不需要自己生成

（4）但是还有一种架构，是让 B 直接抄写 A 的 proto，然后自己生成。因为 pb2.py 要匹配，所以运行时约束了编译器的版本。

运行时最后的小版本无所谓，不一样也能跑

### 问题

（1）

我是在 A 仓库有一个 .proto，用 A 仓库的较新的 protoc 编译器编译了

然后我并没有把 .proto 复制到 B 仓库，而是把 xxx_pb2.py 复制到 B，然后试图用 B 仓库里一个老的 proto runtime 跑，这不行

较新 gencode + 较旧 runtime =可能 import 失败或运行错误

（2）

在 A 仓库有一个 proto，复制到 B 仓库

但是在 B 仓库用 5.x 家族的工具链生成，而 A 是 4.x 的，依然不能跑