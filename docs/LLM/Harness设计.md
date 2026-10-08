## 编辑工具

### Codex 的 apply_patch

1、不强制用，模型愿意用 python/bash 也允许

2、一个类似于 git patch/diff 的工具，照抄前后的段，把编辑段直接写成 + A - B

3、此工具会根据模型元数据决定是否注册，所以 Codex + Qwen，出现无法使用 apply_patch，并不是它不会用（或许真的不会），直接原因是 Qwen 看不见

4、它是一个 Freeform 形式的工具，允许直接传文本，而不是写 json

传统工具调用，AI 必须写好 JSON，但是 Lark grammar 定义了一种文本模版，AI 不必手写 JSON，格式更宽松（但依然有）

模型直接传递一整个字符串 `apply_patch(input: string)`

```text
*** Begin Patch
*** Update File: example.txt
@@
上文
-B
+A
下文
*** End Patch
```

### PI 的 Edit

1、它是一个 json 工具

2、有两个参数，一个是 path，一个是 edits。edits 为数组，内部用 newText 替换 oldText，old 必须精准匹配并且唯一


```json
   {
     "path": "src/utils/format.ts",
     "edits": [
       {
         "oldText": "export function formatDate(date) {",
         "newText": "export function formatDateTime(date) {"
       },
       {
         "oldText": "return date.toISOString();",
         "newText": "return this.format(date);"
       }
     ]
   }
 ```

### OpenCode 的 edit

1、也是一个 json 工具

2、参数：

- filePath（必填）：要修改文件的绝对路径
- oldString（必填）：要被替换的文本
- newString（必填）：替换后的文本（须与 oldString 不同）
- replaceAll（可选）：是否替换所有匹配项，默认 false

3、一个工具的调用只能编辑一个位置，但是依靠同一条消息里批量发出多个工具调用，减少 token 消耗

## 沙箱与规则与安全

### PI

完全没有沙箱，完全继承用户完整权限

### Codex 沙箱

1、如果是 full access 模式，则直接按用户权限运行，不做沙箱

https://learn.chatgpt.com/docs/agent-approvals-security#os-level-sandbox

Codex 的沙箱不是在命令前加一层检查，而是让操作系统启动一个受限进程，并让限制沿着整个子进程树继承下去

2、沙箱的库是

macOS Seatbelt（Apple 的沙盒框架）

Linux bwrap（Bubblewrap），底层基于 OS 的 namespace 等机制（备：bwarp 很重要）

Windows 没有原生机制，Codex 自己实现的沙箱

### Codex 命令阻断

1、即便是 full access，依旧会检查 rm -rf 这类命令

2、即 full access = 关掉沙箱，不再请人审批，但是依旧默认有自动检查

### Codex 审查机制

Codex 的 Auto 审批机制，是有一套执行策略，此策略给各个命令划分等级

（1）拒绝（2）直接放行（3）请求 LLM 审批

审批 LLM 的选择是模型元数据提供，如果是 gpt 席勒，则可能是 codex-auto-review

简单来说，如果你没有任何配置，直接在自定义端点用 Auto，那么确实会用主模型审批

## 系统提示词

### PI

对于所有模型一视同仁，非常简单

### Codex

如果是 GPT 系列，那么它可以从模型元数据里拿到提示词，提示词经常会更新

如果是其他模型，则跌落到默认提示词

### OpenCode

OpenCode 根据不同模型，来提供不同提示词

不过 OpenCode 有一个 issue 是，提示词降低了 Kimi 的性能，原因大概是提供的工具示例和编程不符以及矛盾

## 记忆

### Claude Code

Claude Code 是直接给主模型提供一个 memory 工具，并且让主模型直接在会话中实时的维护记忆，每一个记忆和一个项目关联

### Codex

Codex 如果开启记忆模式，则不是主模型主动维护。而是当你触发下一轮会话时（确保 Codex 启动了），扫 6 小时前的其他会话，统一做总结。主模型无法直接编辑记忆。记忆分为摘要和完整，摘要会直接注入到提示词，并建议模型用 rg 等搜索完整记忆。记忆跨项目存在，一个电脑一份。

## 压缩机制

### PI

PI 曾经提出过两种压缩方式：

旧：（称之为 独立总结）

专用 system prompt（要求总结）+ 序列化后的历史 --> 摘要

新：（称之为 append compaction）

原 system prompt + 原工具定义 + 原历史 + “请总结” --> 摘要

当时的目标是缓存复用，合并到主分支，不过后续又撤回

截至 2026-09-17 仍是旧版独立总结方案

### 与上下文长度的关系

你要是想有像 Codex 那样的体验，必须依靠模型元数据来提供上下文信息

而 PI 从 v1/models 拿不到上下文长度，所以它接入了 models.dev，依靠解析你的 URL 和模型名字，来尽量推断上下文长度

如果依然无法推断，则超上下文后，砍工具调用等方式去压长度，然后逐步尝试总结

## 多模态

### PI 图片阅读

PI 的 Read 工具的参数如果直接填写图片路径，那么模型就可以读到图片

## UI 设计

### Codex Read/Search

UI 显示的 Read、Search 是解析命令后生成的标签，不是独立工具

rg 显示为 Search/List，cat/sed 显示为 Read，兜底则显示为 Run

即 exec_command 工具的参数，而不是直接有一个叫做 Read 的工具

## Code Mode

据说 PI 要推出 Code Mode 了，所以这里聊一聊

### Codex Code Mode

【此功能处于 Codex 内部，不对用户提供操控入口，此功能通过端点拿到的模型元数据 models_cache.json 来声明开启状态，gpt-6 强制开启 CodeModeOnly】

目标：为了节约 token，并且提高速度，给普通工具设计的一套“bash”，并基于 js 语法实现

比如说，先搜索一个东西，拿到它的 ID，再用 ID 搜具体信息。如果是 Code Mode，那么可以将 ID 隐藏在中间结果里，减少一次往返。

关键：被隐藏的东西是否和“上下文理解有关”，一个 ID 很可能不需要多往返一次，而如果必须看那个 ID 的字段构成，那么就没办法隐藏

Codex 里分为三个模式（1）普通（2）CodeMode（3）CodeModeOnly

Codex 自己是提供几个工具的，比如 apply_patch 这种用于文件编辑的，我们姑且称之为 ABC 三种 

同时，你在 Codex 注册了一个 MCP 工具，提供 DE 两个独立工具

（1）没区别，底层模型看到 ABCDE（2）模型看到的多一个 F，并且可以使用 A~F（2）模型**能**看到一个 F，和部分**A**

重点讨论 F，它是一个叫做 functions.exec 的特殊工具，里面可以使用 ABCDE

比如，在 Codex 里，CodeModeOnly 会直接隐藏掉 apply_patch 工具的定义，而把 apply_patch 工具定义到 F 的参数里，所以模型是知道 apply_patch，但是无法直接调用 apply_patch，必须靠 F

它用以解决，传统上必须先使用 D，才能使用 E 的困局，因为 E 的参数依赖 D

如果有 F，可以在 F 里按照代码编排 DE，中间的临时数据也可以跳过

所以如果 D E 本身就在 bash 里，那本身就可以被编排

备注：必须是有先后次序的使用 DE，因为标准函数调用本身就支持一次 Call 调用多个

如果不做额外覆盖，普通模式下，大部分你常见的工具都隐藏了 exec_command apply_patch view_image MCP（具体工具也被收到 functions.exec）

### OpenCode

OpenCode 有一个实验性开关，开启后类似于 Codex 的 CodeMode，不会隐藏基本工具，主要是为 MCP 工具的编排服务

### PI

公开 RFC 没有提

Armin 在探索，https://github.com/mitsuhiko/pi-codemode-mcp，但是在今天还没提到正式版里

## WebSearch（服务端工具）

todo