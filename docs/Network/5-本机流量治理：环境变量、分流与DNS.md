# 本机流量治理：环境变量、分流与 DNS

当一台开发机上同时运行着代理软件（如 V2RayN / Xray / sing-box）、私有组网（如 Tailscale）、公司内网 DNS、虚拟机和各种命令行/GUI 工具时，最常遇到一类让人抓狂的现象：浏览器能打开、终端 `curl` 不通；`ssh` 内网正常、Python 脚本报 `502`；人手敲命令正常、自动化脚本却连不上外网。

根因几乎全出在同一件事上：**没搞清一个请求从程序发出到真正离开网卡之前，究竟经过了几道关卡、每道关卡听谁指挥。**

---

## 一、全景决策树：一个请求发出后，到底先听谁的？

一个程序发起网络请求时，流量并不是直接交给操作系统路由表的，而是按下面 **4 道关卡** 依次决定去向：

1. **第 1 关：程序是否读取应用层代理？**
   - **不读**（`ping`、默认 `ssh`、默认 Node.js `undici`）→ 直接跳到 **第 4 关**。
   - **读取**（系统代理或 `http_proxy` 环境变量）→ 进入 **第 2 关**。
2. **第 2 关：是否命中 `NO_PROXY` / 系统代理绕过列表？**
   - **命中绕过** → 直接跳到 **第 4 关**。
   - **未绕过** → 在 L7 直接把请求发往本地代理端口（如 `127.0.0.1:10808`，走本机回环），进入 **第 3 关**。
3. **第 3 关：代理内核内部路由 & 代理 DNS**
   - **命中 `proxy` 规则** → 由代理软件加密发往远端节点出站。
   - **命中 `direct` 规则** → 由代理内核自行解析 DNS 后直连出站，进入 **第 4 关**。
4. **第 4 关：系统 DNS / `/etc/hosts` → 内核 L3 路由表**
   - 命中虚拟网卡明细路由（如 `tailscale0` / `utun`）→ 走私有组网隧道；
   - 若代理开启了 TUN 模式 → 由路由表统一劫持进代理 TUN 虚拟网卡；
   - 兜底命中默认路由 `0.0.0.0/0` → 经物理网卡发往默认网关出站。

记住这条铁律：**应用层代理（第 1~3 关）拦截时机远早于内核 L3 路由表（第 4 关）**。一旦请求在应用层被拐进了本地 `127.0.0.1:10808`，它走的是本机回环接口，压根不会碰到内核里给内网或虚拟网卡写的路由规则。

---

## 二、程序是如何决定走代理的？

排查一个程序为什么没走（或走错了）代理，第一步先看**它内部调用网络接口的方式**，大体分三类：

1. **读取系统代理**：自动读取操作系统网络设置里填的代理端口（macOS 可用 `scutil --proxy` 查看）。典型代表：浏览器、多数桌面 GUI 应用、以及 Windows 下的 PowerShell（底层集成于 .NET，会自动遵循系统代理）。
2. **读取环境变量**：源自 Unix/Linux 生态的命令行程序，只认 `http_proxy`、`https_proxy`、`all_proxy` 等环境变量。典型代表：`curl`、`git`、`npm` 等。
   - 在 Windows 非 TUN 模式下，PowerShell 可以直接访问外网，但 `cmd` 里执行 `curl`（调用的是 `System32\curl.exe`）往往不通，就是因为 `curl.exe` 不读 Windows 系统代理，需要手动设置临时环境变量：
     ```cmd
     set http_proxy=http://127.0.0.1:10808
     set https_proxy=http://127.0.0.1:10808
     set all_proxy=http://127.0.0.1:10808
     ```
     ```bash
     export http_proxy=http://127.0.0.1:10808
     export https_proxy=http://127.0.0.1:10808
     export all_proxy=http://127.0.0.1:10808
     ```
   - **大小写问题**：小写的 `http_proxy` / `no_proxy` 是 `libcurl` 等 C 生态优先读取的标准；大写变量被部分 Java 等程序采用。稳妥起见，大小写保持同步设置。
3. **默认忽略所有应用层代理**：
   - `ping`：走 L3 ICMP，不存在应用层代理概念。
   - `ssh`：默认完全忽略 `http_proxy` / `all_proxy`（除非在 `~/.ssh/config` 中显式配置 `ProxyCommand`）。
   - **部分语言的网络库（典型坑位：Node.js `undici` / 内置 `fetch`）**：
     ```js
     // 即便终端里已经 export 了 http_proxy 且 curl 正常，这段代码默认仍不会走代理
     const { fetch } = require('undici');
     fetch('https://api.telegram.org')
       .then(res => console.log('Success:', res.status))
       .catch(err => console.log('Failed:', err.message));
     ```

### 容易混淆的三组概念：SOCKS5、`all_proxy` 与透明代理

这三个概念经常同时出现，但其实分属三个不同维度：

| 概念 | 所属维度 | 核心含义 | 客户端是否感知 |
| :--- | :--- | :--- | :--- |
| **SOCKS5** | **代理协议** | 客户端与本地代理之间的通用转发协议，支持 TCP / UDP | 感知（程序需支持 SOCKS5 协议） |
| **`all_proxy`** | **环境变量入口** | 给命令行程序兜底指定代理的环境变量名，值里可以填 `http://` 也可以填 `socks5://` | 感知（程序需主动读取变量） |
| **透明代理** | **内核/网关拦截方式** | 通过本机 TUN 虚拟网卡，或 Linux 路由器 `iptables` / `nftables`（`REDIRECT` 仅 TCP / `TPROXY` 支持 TCP+UDP）在底层半路截胡流量 | **无感知**（程序以为自己在直连） |

### 实战避坑：为什么 `all_proxy` 推荐写 `http://` 而不是 `socks5://`？

现代桌面代理客户端（如 V2RayN `10808`、Clash/Mihomo `7890`）默认监听的是**混合入站端口（Mixed Port）**，同一个端口同时兼容 HTTP 代理和 SOCKS5。日常开发环境里，把 `all_proxy` 统一写成 `http://127.0.0.1:10808` 远比 `socks5://` 稳妥：

1. **绕开 Python 等生态的依赖崩溃坑**：几乎所有开发工具都原生内置 HTTP 代理（HTTPS 走 HTTP `CONNECT` 隧道，同样转发完整加密字节流）；但一旦 `all_proxy` 设为 `socks5://`，Python 的 `requests`、`httpx`、`openai` SDK 等在任何未安装 `PySocks` / `socksio` 的虚拟环境里会**直接抛异常报错**（例如 `Using SOCKS proxy, but the 'socksio' package is not installed`），即便 `http_proxy` 写的是 `http://` 也常被连带触发。
2. **默认防本地 DNS 污染**：HTTP `CONNECT` 天然直接把**域名**交给代理软件解析；而 `socks5://` 默认由本机先做 DNS 解析再把 IP 交给代理，必须刻意写成 **`socks5h://`**（带 `h`）才会把域名交给代理远端解析，极易漏写。
3. **何时才用 `socks5h://`？** 仅当代理入口**只懂 SOCKS5、不懂 HTTP**（典型如 `ssh -D 1080` 开出的动态端口），或个别非 HTTP 工具明确要求 SOCKS5 时，按需给单条命令临时指定即可。

### 底层本质与 `proxychains` 兜底

核心原因在于：**`http_proxy` 只是一个社区“约定”，而不是操作系统的强制规则**——具体程序读不读全看它底层用的 HTTP 库有没有写这段代码。

对于不认环境变量（例如基于 Node.js `undici` 的后台工具）、又不想开启全局 TUN 网卡的程序，常见解法是使用 **`proxychains`**：
- `proxychains` 不是常驻后台进程，也不会创建虚拟网卡；
- 它在启动目标程序时，通过动态链接库预加载（Hook 底层 `connect()` 等网络系统调用），强制把该进程发起的 TCP 连接重定向到指定代理端口。
- 配置要点：在 `proxychains` 配置文件末尾把默认的 `socks4` 删掉，改成自己本地代理监听的 `http` 或 `socks5` 地址与端口，再以 `proxychains4 <命令>` 启动即可。

---

## 三、为什么配了环境变量，进程却拿不到？

第二步排查的是：**程序本身虽然支持 `http_proxy`，但启动它的那条进程链到底有没有把环境变量传给它？**

### 1. GUI 应用与后台服务（`launchd` / `systemd`）

在终端里 `export` 的环境变量，只会被**当前终端后续拉起的子进程**继承；但桌面图标和后台守护进程根本不经过你的交互式 Shell：

- **macOS（`launchd`）**：
  - 从 Dock 或 Spotlight 启动的 GUI 应用（以及这些 GUI 应用内部再拉起的 CLI 子进程），父进程是用户级 `launchd`，完全不会读取 `~/.zshrc`。
  - macOS 的 `launchd` 分为**系统级**（开机即存在）和**用户级**（登录桌面后存在，如 `~/Library/LaunchAgents`）。GUI 应用只继承用户级 `launchd` 的环境。
  - 若全局给用户级 `launchd` 注入代理变量，影响面往往过大；更精准的做法是只给需要代理的特定 App 写一个轻量的包装启动脚本。
- **Linux（`systemd`）**：
  - `systemd`（包括用户态 `systemd --user`）与交互式 Shell 是两套完全独立的环境变量系统（不依赖个人 Shell 脏状态，也是 `systemd` 服务更稳定的原因之一）。
  - 后台服务需要显式在 unit 文件的 `Environment=` 中配置变量；但前提仍是服务内部使用的网络库本身遵循 `http_proxy`（若底层用的是 Node.js `undici` 等忽略环境变量的库，写进 `systemd` 同样无效）。

### 2. Shell 的四种启动模式（为什么人敲命令通，脚本跑不通）

Shell 按两个正交维度分成四种独立模式：**交互式 vs 非交互式**、**登录 Shell（Login）vs 非登录 Shell（Non-Login）**。实际高频遇到三种：

1. **登录 + 交互**：SSH 远程登录服务器、部分终端模拟器的新窗口；
2. **非登录 + 交互**：在已有终端里再启动子 Shell、或部分 IDE 内置终端；
3. **非登录 + 非交互**：执行 Shell 脚本、通过 `ssh host 'cmd'` 直接远程执行单条命令、或者由 AI/自动化工具在后台调用子 Shell 执行命令。

> 注意：桌面终端模拟器是否以 Login Shell 启动，完全取决于软件自身默认设置（例如 VSCode 内置终端常见为非登录，而 Ghostty 等默认可能是登录）。

两条快速自检命令：
```bash
echo $0          # 输出开头带 '-'（如 -zsh）表示登录 Shell，否则为非登录
echo $- | rg i   # 输出包含字母 'i' 表示交互式（interactive），否则为非交互式
```

以 **zsh** 为例，配置文件的严格加载顺序如下：

```text
1. /etc/zshenv
2. $ZDOTDIR/.zshenv          ← 所有模式都会加载（包括非登录、非交互脚本）

如果是登录 Shell：
3. /etc/zprofile
4. $ZDOTDIR/.zprofile

如果是交互式 Shell：
5. /etc/zshrc
6. $ZDOTDIR/.zshrc           ← 平时把 export 写在这里，非交互脚本根本读不到！

如果是登录 Shell：
7. /etc/zlogin
8. $ZDOTDIR/.zlogin
```

- **常见踩坑**：平时习惯把 `export http_proxy=...` 写在 `~/.zshrc` 里，人手在终端敲命令一切正常，但一旦让脚本或自动化工具通过“非交互式 Shell”跑命令，`.zshrc` 根本没加载，请求瞬间断网。
- **工程解法**：把通用环境变量抽到一个独立的 `~/.env` 文件中（保证重复 `source` 具备幂等性），按需在 `~/.zshenv`（或同时在 `~/.zprofile` 与 `~/.zshrc`）中加载。
- **对比 `fish`**：`fish` 的配置机制不区分登录与否，只看是否交互式，配置统一放在 `config.fish` 和 `conf.d/*.fish` 中，因此切回 `zsh` 时最容易突然踩到登录/非登录的坑。

---

## 四、`NO_PROXY` 的写法规范与生效限制

当你同时访问外网和内网（如公司内网域名、Tailscale `100.64.0.x`）时，`NO_PROXY` 用来告诉客户端“遇到这些地址别送去本地代理，直接直连”。实际使用中有四条必须记住的坑：

1. **在 L3 路由之前触发**：只要目标没命中 `NO_PROXY`，支持代理变量的程序在建连前就会把请求送给 `127.0.0.1:10808`，永远轮不到内核里的直连路由表生效。
2. **域名通配写法**：匹配整个子域必须写成 **`.company.com`**，**不要**写 `*company.com` 或 `*.company.com`（大量客户端不认星号通配）。
3. **客户端对 CIDR 网段的支持不统一**：
   - `curl`、Go 等程序支持在 `NO_PROXY` 中直接写 CIDR（如 `100.64.0.0/10`）；
   - **但 Python 标准库不支持 CIDR**：实测当 `NO_PROXY="100.64.0.0/10"` 时，`urllib.request.proxy_bypass("100.64.0.22:3000")` 仍返回 `False`，Python 依然会把请求送进本地代理端口。
   - 因此对于网段级内网地址，**绝对不能只指望 `NO_PROXY`**，必须同时在代理软件路由规则里兜底。
4. **大小写优先**：`curl`（libcurl）会优先读取小写的 `no_proxy`，建议 `no_proxy` 与 `NO_PROXY` 保持完全一致。

---

## 五、代理软件分流、内网绕过与 DNS 冲突

由于 `NO_PROXY` 无法兜住所有客户端（Python `urllib` 不认 CIDR、GUI App 拿不到环境变量），最稳妥的本机治理策略是**双保险**：**环境变量（`no_proxy`）和代理软件自身的 `direct` 分流规则两边同时配齐**。

以桌面常用的 V2RayN（底层 Xray / sing-box）为例，涉及分流和解析的配置分散在 5 个入口：
1. **参数设置 → 系统代理设置**：对以下地址不使用代理配置（决定操作系统级别的绕过列表）；
2. **路由设置 → 规则集（如 `V4-绕过大陆 (Whitelist)`）→ `direct` 规则**：决定已经进入代理端口的流量哪些改走直连；
3. **DNS 设置 → 基础设置**：直连 DNS（DirectDNS）与远程 DNS；
4. **DNS 设置 → 进阶设置 → 使用系统 hosts**：若不开启，进入 Xray / sing-box 的流量全部走代理自身的 DNS，完全不听系统 `/etc/hosts`；
5. **DNS 设置 → 自定义 DNS**：为特定内网域名指定公司/局域网内部 DNS 服务器。

### 三个高频踩坑与根因

#### 1. 白名单模式下访问 Tailscale `100.64.0.x` 返回超时或 `502`
- **原因**：`100.64.0.0/10` 属于 RFC 6598（CGNAT 地址段），**不包含**在默认 `V4-绕过大陆 (Whitelist)` 规则集内置的“绕过局域网 IP（`geoip:private`）”中。
- 在**白名单模式**下，未命中 `direct` 的流量默认全走远端代理节点——远端公网 VPS 根本连不上你的私有组网 IP，最终返回 `502` 或超时。
- 反之，在**黑名单模式（`V4-黑名单 (Blacklist)`）**下，兜底规则是“最终直连”，反而不会撞这个坑。
- **解法**：在白名单模式的 `direct` 规则中手动补上 `100.64.0.0/10`。

#### 2. 公司内网域名进了代理软件依然 `502`
- **典型场景**：公司内网自建了内部 DNS，把 `a.company.com`、`b.company.com`（如内部 HTTP / WebSocket / OpenAI-compatible 接口）解析到私有 IP 且未开 TLS。浏览器可能正常，但终端 CLI 工具访问报 `502`。
- **两个隐蔽陷阱**：
  1. **公网 DirectDNS 查不到内网域名**：V2RayN 默认 `DirectDNS` 往往是 `119.29.29.29` 等公网 DNS，且默认关闭 `UseSystemHosts`。哪怕流量命中了直连规则，只要先经过了代理内核，公网 DNS 依然解析不出公司内部域名。必须给内网域名配置自定义内部 DNS，或通过 `NO_PROXY` + 系统代理绕过让它根本不进代理。
  2. **路由规则域名语法陷阱**：Xray / V2RayN 路由规则匹配子域名必须使用 **`domain:` 前缀**（例如 `domain:company.com`），写成 `*.company.com` **完全无效**。

#### 3. 代理软件与 Tailscale 的 DNS 抢权
- 当本机同时运行代理软件和 Tailscale 时，如果两边都试图接管系统 DNS（特别是开启 Tailscale 内部 DNS / MagicDNS 覆盖），极易引发内网或外网解析紊乱。常见做法是在 Tailscale 客户端关闭接管系统/内部 DNS 功能，让 DNS 解析权保持单一清晰。

---

## 六、实战场景：宿主机共享代理给虚拟机 / 局域网设备

在没有桌面环境的 Linux 虚拟机或同局域网设备上，直接部署图形化代理客户端既麻烦又难维护。更干净的做法是将流量转发给同一局域网内的宿主机代理软件（如 Windows 上的 V2RayN）统一处理：

1. **宿主机代理无需强制开启 TUN**：普通 HTTP/SOCKS 端口监听即可（避免与虚拟机网桥/虚拟网卡冲突或卡顿）；
2. **开启局域网监听**：在代理软件设置中打开 **“允许来自局域网的连接”**；
3. **放行宿主机防火墙**：允许局域网段访问宿主机的代理端口（如 `10808`），或在受信任内网按需调整防火墙策略；
4. **在 Linux 虚拟机配置环境变量**（指向宿主机的局域网 IP）：
   ```bash
   export ALL_PROXY="http://192.168.0.3:10808"
   # 若部分工具只认 http_proxy / https_proxy，可同步设置
   export http_proxy="http://192.168.0.3:10808"
   export https_proxy="http://192.168.0.3:10808"
   ```
5. **正确验证**：用 `curl -I https://www.google.com` 或浏览器测试，**不要用 `ping`**（`ping` 走 ICMP，永远不经过 HTTP/SOCKS 代理）。

> **运维习惯兜底**：当代理节点挂掉或临时关闭代理软件做网络连通性测试时，务必立刻将代理软件切到 **“清除系统代理”**，并 `unset` 掉终端里的 `http_proxy` / `https_proxy` / `ALL_PROXY`。留着指向死端口的僵尸代理变量去测新服务器或排查网络，极容易得出完全错误的结论。
