# Harness 机制拆解（Codex / PI / CC / OpenCode）

参考：https://earendil.com/posts/what-is-a-harness/

这篇文章横向拆解主流 Coding Agent（Codex、PI、Claude Code、OpenCode）在编辑工具、沙箱审批、系统提示词、记忆、上下文压缩，以及 Skills / MCP / CodeMode 上的具体工程实现。

---

## 一、编辑工具（Edit）

### Codex 的 `apply_patch`

1、不强制用，模型愿意用 python/bash 也允许

2、一个类似于 git patch/diff 的工具，照抄前后的段，把编辑段直接写成 `+ A - B`

3、此工具会根据模型元数据决定是否注册，所以 Codex + Qwen，出现无法使用 `apply_patch`，并不是它不会用（或许真的不会），直接原因是 Qwen 看不见

4、它是一个 **Freeform** 形式的工具，允许直接传文本，而不是写 json

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

### PI 的 `Edit`

1、它是一个 json 工具

2、有两个参数，一个是 `path`，一个是 `edits`。`edits` 为数组，内部用 `newText` 替换 `oldText`，old 必须精准匹配并且唯一

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

### OpenCode 的 `edit`

1、也是一个 json 工具

2、参数：
- `filePath`（必填）：要修改文件的绝对路径
- `oldString`（必填）：要被替换的文本
- `newString`（必填）：替换后的文本（须与 oldString 不同）
- `replaceAll`（可选）：是否替换所有匹配项，默认 false

3、一个工具的调用只能编辑一个位置，但是依靠同一条消息里批量发出多个工具调用，减少 token 消耗

---

## 二、沙箱、规则与安全审批

### PI

完全没有沙箱，完全继承用户完整权限

### Codex 沙箱

1、如果是 full access 模式，则直接按用户权限运行，不做沙箱

https://learn.chatgpt.com/docs/agent-approvals-security#os-level-sandbox

Codex 的沙箱不是在命令前加一层检查，而是让操作系统启动一个受限进程，并让限制沿着整个子进程树继承下去

2、沙箱的底层库：
- macOS：`Seatbelt`（Apple 的沙盒框架）
- Linux：`bwrap`（Bubblewrap），底层基于 OS 的 namespace 等机制（备：bwrap 很重要）
- Windows：没有原生机制，Codex 自己实现的沙箱

### Codex 命令阻断与 Auto 审查机制

1、即便是 full access，依旧会检查 `rm -rf` 这类命令。即 `full access` = 关掉沙箱，不再请人审批，但是依旧默认有自动检查

2、Codex 的 Auto 审批机制，是有一套执行策略，此策略给各个命令划分等级：
- （1）拒绝
- （2）直接放行
- （3）请求 LLM 审批

审批 LLM 的选择是模型元数据提供，如果是 gpt 系列，则可能是 `codex-auto-review`。简单来说，如果你没有任何配置，直接在自定义端点用 Auto，那么确实会用主模型审批。

---

## 三、系统提示词、记忆与压缩机制

### 系统提示词

### PI

对于所有模型一视同仁，非常简单

### Codex

如果是 GPT 系列，那么它可以从模型元数据里拿到提示词，提示词经常会更新；如果是其他模型，则跌落到默认提示词

### OpenCode

OpenCode 根据不同模型，来提供不同提示词。不过 OpenCode 有一个 issue 是，提示词降低了 Kimi 的性能，原因大概是提供的工具示例和编程不符以及矛盾

### 记忆（Memory）

### Claude Code

Claude Code 是直接给主模型提供一个 memory 工具，并且让主模型直接在会话中实时的维护记忆，每一个记忆和一个项目关联

### Codex

Codex 如果开启记忆模式，则不是主模型主动维护。而是当你触发下一轮会话时（确保 Codex 启动了），扫 6 小时前的其他会话，统一做总结。主模型无法直接编辑记忆。记忆分为摘要和完整，摘要会直接注入到提示词，并建议模型用 `rg` 等搜索完整记忆。记忆跨项目存在，一个电脑一份。

### 压缩机制（Compaction）

### PI 的两种压缩方式

PI 曾经提出过两种压缩方式：

旧（称之为 独立总结）：

`专用 system prompt（要求总结）+ 序列化后的历史 --> 摘要`

新（称之为 append compaction）：

`原 system prompt + 原工具定义 + 原历史 + “请总结” --> 摘要`

当时的目标是缓存复用，合并到主分支，不过后续又撤回。截至 2026-09-17 仍是旧版独立总结方案。

### 与上下文长度的关系

你要是想有像 Codex 那样的体验，必须依靠模型元数据来提供上下文信息。

而 PI 从 `v1/models` 拿不到上下文长度，所以它接入了 `models.dev`，依靠解析你的 URL 和模型名字，来尽量推断上下文长度。如果依然无法推断，则超上下文后，砍工具调用等方式去压长度，然后逐步尝试总结。

### 多模态与 UI 细节

PI 的 `Read` 工具的参数如果直接填写图片路径，那么模型就可以读到图片。

Codex UI 显示的 Read、Search 是解析命令后生成的标签，不是独立工具：`rg` 显示为 Search/List，`cat`/`sed` 显示为 Read，兜底则显示为 Run。即 `exec_command` 工具的参数，而不是直接有一个叫做 Read 的工具。

---

## 四、扩展机制：Skills、MCP 与 Code Mode

一句话区分三者：
Skills 是一种提示词管理模式，相当于大号提示词数据库，支持渐进式加载提示词，避免上下文太长；MCP 是一个标准化外接工具箱，不要一次给太多，否则 AI 也有选择困难症；Code Mode 则是把工具调用转成 JS/TS 代码放进沙箱里编排执行，减少中间结果进入模型上下文的往返消耗。

### Skills

现在 Claude 把 Skills 的标准公开了，很多工具也支持：https://code.claude.com/docs/en/skills

每个 skill 是一个文件夹（对比 mcp 是一个可执行程序），包含一个 `SKILL.md`（里面是 YAML 元数据头 + 正文指令），以及可选的子文件夹（放脚本、文本等资源，只要在 `SKILL.md` 里说明并让 AI 能找到即可）。

每次提问时，客户端会扫描所有已开启 SKILL 的元数据（`name` 和 `description`）直接加入上下文，用于降低全文加载的 Token 消耗；只有模型判断需要时，才去读取正文指令和子文件夹脚本。所以不用的 Skill 不要开。

我认为直接抄别人的 SKILL 是比较好的，一般不要自己写。SKILL 有一点类似于 Bash 即一切，通过 Bash 来运行命令或已有脚本来操作更多东西。

### MCP

https://modelcontextprotocol.io/docs/learn/architecture

一个 AI 应用可以连接多个 MCP 服务器（通过本地 `stdio` 或远程 `http` 通信）。注意大模型本身并不会直接发送 `tools/list`、`tools/call` 这些协议请求，而是由 Harness（MCP 客户端）在启动时向 MCP 服务器拉取工具列表，转换成标准的 Function Calling 格式塞给模型。

MCP 协议定义了三种原语：`tools`（工具）、`resources`（资源）、`prompts`（提示模板）。

当时踩过一个坑：原本想不用向量数据库了，直接把文档数据做成 MCP 的 `resources` 让 AI 访问，结果发现主流客户端对 `resources` 的自主调用支持极差（它更像需要人在 UI 里手动 `@` 挂载的附件），在自主 Agent 循环里，最终还是得全部做成 `tool` 才能让模型顺畅查询。

另外，在给桌面软件（比如调研 FreeCAD-mcp 时）写 MCP 时，通用的做法是“分离式架构”：宿主软件内部的 Python 环境不要去依赖 `fastMCP`，而是单独起一个外部进程（用 `uv` 或 `nodejs` 跑 MCP 服务）跟 AI 通过 `stdio` 通信，外部进程再通过本地 socket/http 把自定义的简单消息发给宿主软件里的监听插件，甚至只暴露一个“执行宏/脚本”的入口让 AI 自己写代码调。

### Code Mode

CodeMode 是 Cloudflare 提出的，把 MCP 工具转成 TypeScript API，让模型写代码调用。A\ 去年好像就跟进了此事。

### Codex Code Mode

【此功能处于 Codex 内部，不对用户提供操控入口，此功能通过端点拿到的模型元数据 `models_cache.json` 来声明开启状态，gpt-6 强制开启 `CodeModeOnly`】

目标：为了节约 token，并且提高速度，给普通工具设计的一套“bash”，并基于 js 语法实现。

比如说，先搜索一个东西，拿到它的 ID（工具 D），再用 ID 搜具体信息（工具 E）。标准函数调用虽然支持并发 Call 多个工具，但遇到这种 E 的参数依赖 D、必须有先后次序的场景，传统方式只能多往返一次。如果有 Code Mode，可以在代码里编排 DE，把临时 ID 隐藏在中间结果里，减少一次往返。（关键：被隐藏的东西是否和“上下文理解有关”，一个 ID 很可能不需要多往返一次，而如果必须看那个 ID 的字段构成，那么就没办法隐藏）

Codex 里分为三个模式：（1）普通（2）CodeMode（3）CodeModeOnly

假设 Codex 自己提供 ABC 三种内置工具（如 `apply_patch`），同时注册了一个 MCP 提供 DE 两个工具：
- （1）普通：底层模型看到 ABCDE
- （2）CodeMode：模型看到的多一个特殊工具 `F`（即 `functions.exec`），并且可以使用 A~F
- （3）CodeModeOnly：模型只能看到 `F` 和部分 A。比如直接隐藏掉 `apply_patch` 工具的顶层定义，而把 `apply_patch` 工具定义到 `functions.exec` 的参数说明里，所以模型知道 `apply_patch`，但必须靠 `functions.exec` 写代码调用。如果不做额外覆盖，大部分常见工具（`exec_command`、`apply_patch`、`view_image`、MCP）都被收到 `functions.exec`。

### OpenCode 与 PI 的 Code Mode

OpenCode 有一个实验性开关，开启后类似于 Codex 的 CodeMode，不会隐藏基本工具，主要是为 MCP 工具的编排服务。

Pi 在 1.0 版本同时引入 MCP 和 CodeMode。默认更接近 Codex 的 CodeMode（`on`），同时支持配置显式切换到 `CodeModeOnly`（`only`），MCP 工具现在在 CodeMode 里面。

核心原因：工具不只是在 Bash 上发生。非服务端工具（即 Harness 执行的工具，比如 MCP）需要一个编排调用的办法，把工具调用之间的数据处理放进 harness 侧的 JS 沙箱，减少中间结果进入模型上下文。

https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/
https://earendil.com/posts/you-said-no-mcp/

当时这篇文章提到，早期 MCP 的实现一般比较粗糙，直接将大结果返回给模型，当时的处理是靠小型 CLI 脚本将 MCP 扭回 Bash；现在 CodeMode 相当于在 Harness 内部直接提供了这层编排沙箱。
