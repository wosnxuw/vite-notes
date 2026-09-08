编辑中

### 整体概览

现在的大模型服务大概是分为三层，其中中间的服务层，容易和底层的引擎搞混，这是一切混乱的根源

（1）引擎/模型层，只管吐字

（2）服务层，用以提供 Chat Complewtions 等 API 服务

（3）编排层，你本地的 Harness 应用

### 模型与 jinja 文件

你从 Hugging Face 上下载一个模型，你会发现不仅携带权重，还有一个叫做 chat_template.jinja 的文本文件

这个文件指明了模型在后训练时，认识并输出哪种工具格式，比如 `<tool_calls>`

即模型使用工具时，只会依照某一种格式来输出（不会一会是 XML，一会又是 json，否则谁来控制到底是输出哪种？）

### jinja 模板

管理整个上下文应该如何构成，比如开头是 `<system>` 中间是 `assistant`

ChatML 是这里比较常见的一种

### Hermes 工具调用格式

就是现在流行的那个 Hermes Agent 的开发者

Nous 是一个美国的后训练实验室，它在 2024 年年初就后训练了一个模型，那个模型使用了一种工具调用风格，被后续很多开源模型如 Qwen 借鉴，所以它们统一称之为 Hremes 工具调用格式

备注：Hermes 是 ChatML 里的一部分，因为 ChatML 只规定大“段”，Hermes 规定规定内部到底是用 json 还是 XML

### 服务层在做什么

服务层就是把引擎输出的原始字符流整顿一下，然后返回给用户 Chat Completions 或者 Responses 或者 Anthropic message

对于模型来说，看到的 token 是一模一样的

请求里携带的比如 final_reason，其实模型自己根本不会说这个

其实还有 id，模型更不会产生，因为 API 在无状态时，这样做才能让工具匹配上

### 工具调用的产生

推理引擎每生成一个 token，都会检查是否遇到完整的 `<tool_calls></tool_calls>`，如果有，就截断会话，准备调用

部分高级模型（会并发工具），会检查是否有终止 token，这种模型会自己停下来

### 本地工具和服务端工具

部分工具在服务端实现，比如 web_search，模型用这种工具被掐断后，服务端可以自己执行，然后自己继续向前（但是一般会把进度同步给客户端）

### 各种工具

无论是（1）OpenAI 标准工具（2）MCP 自带的工具（3）Hraness 底座自带的 bash 工具

最后模型看到的都是并排的一系列工具，并不会说，因为因为来源不通，会有定义上的区别（某一个必须用 XML 传递参数，另一个 json）

### Chat Completions

直译“完成”，是因为 OpenAI 一开始觉得这个 API 用于会话补全

这个 API 没有状态，所有上下文必须由客户端自己拼接好

1、评论和紧随其后的至少一个工具调用是同一个 API 请求

靠 `content` 和 `tool_calls` 两个字段区分

2、循环，由 `finish_reason` 驱动，若为 "tool_calls" 则告诉 harness 继续，若为 "stop"，则结束

3、API 无法区分评论和最终回复，而是靠 `finish_reason`来判断

### Responses

Responses API 的关键概念叫做 Turn

一个 Turn = 从用户提问到模型给出最终回答的完整过程

一个 Turn 可以包含多次 API 调用

一次 API 调用返回多个独立 item 的序列，每个有 type 和 phase

能够真正的区分评论、最终回复

Responeses 有两种方式，第一种是无状态，即和 Chat Completions 一样，第二种是有状态，每次携带一个 id，并附上追加的内容

### 速率

假设上下文 1M，平均请求 500K，10s 进行一次请求，那速率应该是 200KB/s

### 缓存索引

因为 API 是无状态的，所以服务端为了命中缓存，必须做分块 Hash 比较，这样才能快速的判断是否命中

### Codex 与 Responses API

Codex 其实是用的 无状态的 Responses，因为 Codex 自己存储数据，每次携带完整信息

### 工具选择

现在 OpenAI 存在一种，为了复用工具缓存，定义 ABCD，但是在这一次请求里只允许使用一个子集的操作

叫做 tool_choice.allowed_tools

我的推测是做什么位置掩码来解决的，深入引擎层，OpenAI 没有明说，不过它和 API server 无关，两种都支持

### Responses API 的真正意义

推测是继续往 Chat Completions 里塞东西，显得臃肿

1、需要服务端维持状态/减小网络压力：Codex 也使用无状态

2、需要服务端工具看，比如 web_search：老 API 一样可以截获，但是无法做到半途通知客户端

3、需要携带完整思维链条/缓存命中：OpenAI 自己文档里说的原因。但是实际上 ZCode KimiCode 不着急跟进，靠给 Chat Completions 打一个带思维链的补丁一样可以。
（不过原版 Chat Completions 里面没有思维链）

### Code Mode

【此功能处于 Codex 内部，不对用户提供操控入口】

推测：看起来，像是 Codex 为了节约 token，并且提高速度，给普通工具设计的一套“bash”，并基于 js 语法实现

Codex 里分为三个模式（1）普通（2）CodeMode（3）CodeModeOnly

Codex 自己是提供几个工具的，比如 apply_patch 这种用于文件编辑的，我们姑且称之为 ABC 三种 

同时，Codex 注册了一个 MCP 工具，提供 DE 两个独立工具

（1）没区别，底层模型看到 ABCDE（2）模型看到的多一个 F，并且可以使用 A~F（2）模型看到多一个 F，并且只允许使用 F

F 是一个叫做 functions.exec 的特殊工具，里面可以使用 ABCDE

它用以解决，传统上必须先使用 D，才能使用 E 的困局，因为 E 的参数依赖 D

如果有 F，可以在 F 里按照代码编排 DE，中间的临时数据也可以跳过

所以如果 D E 本身就在 bash 里，那本身就可以被编排

此功能通过端点拿到的模型元数据 models_cache.json 来声明开启状态，gpt-6 强制开启 CodeModeOnly

备注：必须是有先后次序的使用 DE，因为标准函数调用本身就支持一次 Call 调用多个

### apply_patch

一个类似于 git patch/diff 的工具，照抄前后的段，把编辑段直接写成 + A - B

但是不强制用，模型愿意用 python 也允许

