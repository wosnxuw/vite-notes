# Unix 演进、发行版生态与系统基础

Unix / BSD / GNU / Linux 的历史谱系、主流与国产信创发行版生态、包管理与 AppImage，以及 `systemd` 服务管理、Shell 变量与 `PATH` 环境变量的基础机制。

---

## 一、历史脉络：Unix、BSD、POSIX、macOS 与 GNU/Linux

### 1. Unix 与 BSD 的分家

1. 最早只有 Unix（上世纪 70 年代由 AT&T 贝尔实验室研发）。当时受反垄断法限制，AT&T 不能把 Unix 当商品卖，于是把 Unix 源码开放给了高校，其中最著名的一份给了加州大学伯克利分校（Berkeley）。
2. 伯克利师生在 Unix 基础上加了大量新功能（比如 `vi` 编辑器、TCP/IP 协议栈），打包发行的系统就叫 BSD（Berkeley Software Distribution）。
3. 到了 80 年代，反垄断限制解除，AT&T 开始对 Unix 源码收取高昂授权费。伯克利师生决定把 BSD 里含有 AT&T 原始代码的最后一部分全部重写替掉。这引发了 AT&T 起诉伯克利分校的版权官司，双方多年后达成和解。
4. 和解后发布的 4.4BSD-Lite 彻底摆脱了版权纠纷并完全开源，成为后来 FreeBSD、OpenBSD、NetBSD 等所有现代 BSD 系统的共同祖先。

### 2. POSIX 标准（统一接口，不统一实现）

80 年代 Unix 分裂出了各种变体（BSD 派系和 System V 派系），各家的系统调用名字都不一样。为了解决跨平台移植问题，IEEE 制定了 POSIX 标准。
- 目标：只要你的 C 代码只调用符合 POSIX 标准的函数（比如 `open()`、`read()`、`fork()`），这份源码在任何类 Unix 系统上都能直接编译通过。
- 注意：POSIX 只规定了“接口函数名叫什么、参数是什么”，但没有规定底层用哪个 C 标准库实现。比如桌面 Linux 用的是 GNU 的 `glibc`，而 Android（虽然底层也是 Linux 内核）用的是 Google 自己写的 `Bionic libc`。因此，一个针对桌面 `glibc` 编译出来的二进制程序，直接拷到 Android 上会因为找不到对应的动态库而无法运行。

### 3. 为什么说 macOS 反而是“真·Unix”？

乔布斯当年离开苹果后创办了 NeXT 公司，基于 Mach 微内核套了一层 BSD 4.3，做出了 NeXTSTEP 系统。后来苹果收购 NeXT 请回乔布斯，把这套底座整理开源为 Darwin（XNU 内核），并在上面做出了 macOS 和 iOS。
“UNIX”现在是一个受保护的注册商标（归 The Open Group 所有）。苹果每年花钱为 macOS 购买并维持了官方的 UNIX 03 认证，所以从商标和血统上讲，macOS 是名正言顺的官方认证 Unix。

### 4. GNU/Linux 与开源许可证（BSD vs GPL）

1. **GNU 先于 Linux 出现**：1983 年，理查德·斯托曼（RMS）启动了 GNU 项目（GNU's Not Unix），目标是复刻出一整套完全自由的 Unix 系统。他们采用“借鸡生蛋”的方式，先在商业 Unix 上开发出了 GCC 编译器、Emacs 编辑器、`bash`、`glibc` 和各种基础命令行工具（`ls / cp / grep`），唯独一直缺一个好用的操作系统内核（GNU 自己搞的 Hurd 微内核进展缓慢）。
2. **Linux 内核补齐最后一块拼图**：1991 年，芬兰大学生 Linus Torvalds 写出了开源的 Linux 内核，正好与 GNU 现成的用户态工具链完美结合。所以我们日常用的操作系统，严格来说叫 GNU/Linux。
3. **BSD 许可证 vs GPL 许可证**：
   - BSD（以及 MIT / Apache）许可证非常宽松：允许商业公司拿去修改、闭源售卖，后续怎么用基本不管（这也是苹果能直接拿 FreeBSD 的代码放进闭源 macOS 的原因）。
   - **GPL 许可证具有“传染性”**：只要你修改或静态链接了 GPL 代码并对外发布，你的整个衍生软件也必须同样以 GPL 开源。因此很多商业公司在选型底层库时会刻意规避 GPL（或区分允许动态链接闭源的 LGPL）。

---

## 二、Linux 发行版谱系、包管理器与国产信创生态

### 1. 主流发行版与包管理器对照

如果纠结选哪个桌面发行版，可以去 `https://distrochooser.de/zh-hans` 做个问卷测试。工程上主流就两大派系（Debian 系与 RedHat 系）外加滚动更新的 Arch 系：

| 发行版家族 | 代表系统 | 包管理器 | 安装包后缀 | 特点说明 |
| :--- | :--- | :--- | :--- | :--- |
| Debian 系 | Debian --> Ubuntu / Linux Mint | `apt`（现代交互）`apt-get`（传统/脚本） | `.deb` | Debian 是最早的社区发行版之一；Ubuntu 基于 Debian 演进，生态与 AI 驱动支持最丰富 |
| RedHat 系 | RHEL / Fedora / CentOS / Rocky Linux | `dnf`（现代）`yum`（传统） | `.rpm` | CentOS 曾是 RHEL 的免费重编译版，但 CentOS 7 已于 2024 年 6 月 30 日彻底停服；后续的 CentOS Stream 变成了 RHEL 的上游滚动测试版（需要稳定替代版通常转投 Rocky Linux 或 AlmaLinux） |
| Arch 系 | Arch Linux / Manjaro | `pacman` | `.pkg.tar.zst` | 滚动更新，软件版本极新，Arch Wiki 文档质量极高 |
| SUSE 系 | openSUSE / SLES | `zypper` | `.rpm` | 欧洲企业常用，Rancher / K3s 母公司 |

### 2. AppImage（免安装的单文件打包格式）

除了用 `apt / dnf` 装软件，Linux 桌面上还常看到后缀为 `.AppImage` 的单文件包（依赖 Linux 内核的 FUSE 挂载机制，macOS 上无法使用）：
- 用法：下载后赋一个可执行权限（`chmod +x xxx.AppImage`），直接 `./xxx.AppImage` 就能运行，无需安装。
- 数据隔离：`.AppImage` 文件本身是只读的，软件运行产生的用户配置和缓存依然存放在你家目录的 `~/.config/` 或 `~/.local/share/` 下，与 `.AppImage` 本体分离。（小插曲：用 AppImage 跑 Linux 原生版微信，结果刚登上去就触发风控被踢了，索性没再登。）

### 3. 国产操作系统与国产芯片（信创生态）速览

在政务、国企或信创适配工作中经常遇到国产软硬件，按谱系梳理如下（2026 年现状，这里面很多芯片公司都在上交所科创板上市，股票代码多以 `6880xx` 开头）：

#### （1）国产桌面与服务器操作系统
- **银河麒麟（Kylin）**：早期分“中标麒麟”和“银河麒麟”两支，后来合并统一为银河麒麟；其社区开源版本叫 openKylin（另有服务器端的 openEuler 欧拉系）。
- **统信 UOS 与 Deepin（深度）**：Deepin 是国内做桌面美化很早的 Debian 系发行版，统信 UOS 则是基于 Deepin 打造的主力商业信创系统（可以把 Deepin 看作统信 UOS 的上游社区版）。
- **中科方德**：同样以 Debian / Ubuntu 技术路线为基础。

#### （2）国产 CPU（按指令集架构分类）
- **x86 架构授权**：海光信息（Hygon，源自 AMD Zen 架构早期授权，兼容 x86 最省事）、上海兆芯（源自威盛 VIA x86 授权）。
- **ARM 架构授权**：华为鲲鹏（Kunpeng，主力做数据中心服务器芯片）、飞腾（Phytium）。
- **LoongArch（龙芯自研架构）**：龙芯中科（早期走 MIPS 路线，现已全面转向自研的 LoongArch 龙架构，如 3A6000）。
- **RISC-V 与自研超算架构**：申威（Sunway，太湖之光超算使用的申威架构）、国芯科技等。

#### （3）国产 GPU 与 AI 算力加速卡
- **华为昇腾（Ascend）**：目前国内 AI 算力卡体量最大的一家，主力型号有训练/推理卡 Ascend 910B、910C 以及边缘推理卡 310P（配套软件栈为 CANN）。
- **摩尔线程（Moore Threads）**：既做消费级游戏显卡（MTT S80 / S90），也做智算中心算力卡（MTT S4000 / S5000）。
- **寒武纪（Cambricon）**：主力产品线叫“思元（MLU）”系列 AI 加速卡。
- **其他算力芯片厂商**：壁仞科技、沐曦集成电路，以及海光信息的 DCU（深算系列，与海光 CPU 同属一家，架构上接近 GPGPU 协处理器）。

---

## 三、`systemd`：现代 Linux 的第一个进程（PID 1）

只要不是很冷门的极简发行版，现代主流 Linux 开机后由内核拉起的第一个用户态进程（PID 1）全都是 `systemd`（在 macOS 上对应的角色叫 `launchd`，控制命令是 `launchctl`；而在 Node.js 圈子里如果不想配系统服务，常用 `PM2` 在应用层代管前后端进程的守护与自启）。

### 1. `systemd` 的职责与争议

- 职责：系统初始化、后台服务守护（如启动和监控 Nginx / Docker / SSH）、挂载文件系统、网络与日志管理。
- 争议：当年 Linux 社区从传统的 `SysVinit`（纯 Shell 脚本启动）切换到 `systemd` 是最具争议的决策之一。反对者认为它管得太宽（违背了 Unix“一个程序只做一件事并做好”的哲学），而且它用二进制格式存日志（需用 `journalctl` 查看），违背了“一切皆纯文本”的传统习惯。但从实用角度看，拿它配个开机自启和崩溃自动重启确实省心。
- 为什么用 `ps -ef | grep systemd` 会看到不止一个 `systemd`？
  虽然系统级的 `systemd` 是 PID 1，但它还会启动 `systemd-journald`（管日志）、`systemd-udevd`（管硬件设备）、`systemd-resolved`（管 DNS）等辅助守护进程，并且每个登录的用户还会启动一个 用户级实例 `systemd --user`（PID 自然不是 1）。

### 2. `systemctl` 最常用的 5 条日常命令

`systemctl` 是操作 `systemd` 的命令行工具。最容易混淆的是“`enable`（设为开机自启）”和“`start`（现在立刻跑起来）”——这两个动作在默认情况下是相互独立的：

```bash
# 1. 设置某服务开机自启动（本质是在 /etc/systemd/system/ 下创建软链接，注意：默认不会现在立刻启动它。）
sudo systemctl enable nginx

# 2. 取消开机自启动
sudo systemctl disable nginx

# 3. 检查某服务是否配了开机自启（返回 enabled 且退出码为 0 代表有自启，但不代表它现在正在运行）
systemctl is-enabled nginx

# 4. 现在立刻启动 / 停止 / 重启服务（如果想要“设为开机自启并且现在立刻启动”，可以写 systemctl enable --now nginx）
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx

# 5. 查看服务当前到底有没有在跑、以及最近的几十行报错日志
systemctl status nginx
```

---

## 四、Terminal vs Shell、环境变量与目录路径细节

### 1. 分清 Terminal（终端模拟器）与 Shell（命令解释器）

这两个词日常经常混着叫，但其实是完全分离的两层软件：
- **Terminal（终端模拟器）**：只是一个负责画窗口、显示字符、接收键盘按键的图形界面外壳程序。比如 Windows 11 自带的 Windows Terminal、macOS 上的 Ghostty / iTerm2。它自己根本不懂 `ls` 或 `cd` 是什么意思。
- **Shell（壳）**：包裹在操作系统内核外面的命令解释器进程。你在 Terminal 窗口里敲下一行字，Terminal 把字符传给后台的 Shell，由 Shell 解析语法、查找可执行文件并调用内核启动进程。
  - Windows 上的两个原生 Shell：`cmd.exe` 和 `PowerShell`；
  - **`Bash`**：Linux 下最普遍的默认 Shell，也是 POSIX 标准的事实参考实现；
  - **`Zsh`**：高度兼容 Bash 且补全生态极丰富。自从 macOS 把默认 Shell 切到 Zsh 后用的人越来越多（许多 Linux 发行版虽然默认是 Bash，但也预装了 Zsh）；
  - **`Fish`**：开箱即用体验极好（不用配插件就自带语法高亮、历史命令灰字自动提示），但它 deliberately 不完全兼容 POSIX / Bash 语法（比如不支持 `<< EOF` 的 Heredoc 写法，环境变量赋值也是用 `set -x` 而不是 `export`）；
  - **`Git Bash`（Windows）**：Git for Windows 基于 MSYS2 打包的一个轻量级兼容环境，在 Windows 上模拟运行真正的 `bash`。

### 2. Shell 普通变量 vs 环境变量（`export`）

在 Bash / Zsh 中写脚本或敲命令时，变量分两级作用域：

1. **普通 Shell 局部变量**（仅在当前这个 Shell 窗口自己的进程内有效，它启动的子进程看不见）：

   ```bash
   # 定义变量（注意：等号左右【不能有空格】。否则 MYVAR 会被当成一个命令名。）
   MYVAR="hello"

   # 读取变量（加花括号是为了明确变量名边界，比如 "${MYVAR}_world"）
   echo $MYVAR
   echo ${MYVAR}
   ```

2. 环境变量（Environment Variables）（通过 `export` 标记，任何由当前 Shell 启动的子进程——比如你敲的 `python`、`node`、`curl`——都会自动继承拿到这份变量）：

   ```bash
   # 临时导出环境变量（关闭当前终端窗口即失效；如果要永久生效，需写入 ~/.bashrc 或 ~/.zshrc）
   export MY_API_KEY="sk-xxx"

   # 查看当前终端里生效的所有环境变量（比如 SHELL=/bin/bash，以及 ~ 会被自动展开为 $HOME 的值）
   env

   # 单独查看可执行文件搜索路径 PATH
   echo $PATH
   ```

拼接 `PATH` 时的覆写陷阱：
`PATH` 里用冒号 `:` 分隔了多个目录。当你想要往 `PATH` 里追加一个新目录时，必须带上原有的 `$PATH:`，否则你就会把系统原本的 `/usr/bin` 全冲掉，导致连 `ls`、`vim` 都提示找不到命令：

```bash
# 正确：在原有 PATH 后面（或前面）用冒号追加新路径
export PATH="$PATH:/my/custom/bin"

# 错误：直接把 PATH 覆盖成了只有这一个目录，系统命令全废（此时只能靠关闭终端重开恢复）
export PATH="/my/custom/bin"
```

### 3. 为什么普通用户能直接跑 `node / pnpm / uv`，加了 `sudo` 或切到 `root` 反而报 `command not found`？

对比一下同一台机器上普通用户和 `root` 用户的 `PATH` 就明白了：

```text
普通用户的 PATH：
~/.nvm/versions/node/v24.14.0/bin : ~/.local/share/pnpm : ~/.local/bin : ~/bin : /usr/local/bin : /usr/bin : /bin

root 用户的 PATH：
/usr/local/sbin : /usr/local/bin : /usr/sbin : /usr/bin : /sbin : /bin
```

像 `fnm / nvm`、`pnpm`、`uv`、`rustup` 这类现代开发工具，默认都是安装在普通用户自己的家目录（`~/.local/bin` 或 `~/.nvm/...`）下的，并只写进了普通用户的 `~/.bashrc` 里。当你执行 `sudo xxx` 或切到 `root` 时，出于安全隔离，系统会重置为 `root` 自己那套干净的系统级 `PATH`（包含存管理员工具的 `sbin` 目录，但绝不包含普通用户的 `~/.local/bin`），所以自然就找不到用户级安装的工具了。

### 4. 相对路径与根目录 `/` 的新手细节

在敲 `cd` 或执行程序时，注意路径前缀的精确含义：

```bash
cd a       # 在当前目录下找名为 a 的子目录（如果配置了 CDPATH 则可能去搜索列表里找）
cd a/      # 末尾加斜杠，明确告诉系统 a 必须是一个文件夹（如果 a 是普通文件则报错）
cd ./a/    # 最严谨：明确指明从当前目录 (.) 下找子目录 a（而在执行程序如 ./a.sh 时，必须加 ./，因为当前目录不在 PATH 里。）

cd /a          # 错误。开头带斜杠 / 代表从整台机器的最顶层根目录开始找，根目录下根本没有 /a
cd /usr/local  # 正确：根目录 / 下真实存在 usr/local
```
