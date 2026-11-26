# 运维排障命令、SSH 体系与现代终端工具

按日常连上一台 Linux 机器的工作流排列：先是怎么配好 SSH 密钥免密连上去（含 Windows 当 SSH 服务端踩坑），接着是连上去之后的硬件/网络/端口/进程排障命令，最后是提高终端效率的现代 Rust 工具链与 Neovim 核心操作。

---

## 一、SSH 密钥体系与跨平台连接管理

只要使用基于 OpenSSH 的工具（无论是系统终端、VS Code Remote 还是各种常见终端客户端，除了像 XTerminal 这种把配置存在自己私有目录下的另类），全系统都只共用同一个 `~/.ssh` 文件夹（Linux/macOS 在 `/home/用户名/.ssh`，Windows 在 `C:\Users\用户名\.ssh`）。

### 1. 生成密钥对（公钥 vs 私钥）

如果一台机器上还没有 `.ssh` 目录，建议先跑一次生成命令让系统自动建好具有正确权限的 `.ssh` 文件夹：

```bash
# 生成 RSA 密钥对（现代也常推荐更短更安全的 -t ed25519）
ssh-keygen -t rsa -b 2048
```

执行过程中会依次询问两件事：
1. `Enter file in which to save the key`：保存路径与文件名。单机默认直接回车（叫 `id_rsa` 或 `id_ed25519`）；如果你要管理多台不同的服务器或平台，可以起有辨识度的名字（比如 `id_ed25519_aliyun`、`id_ed25519_github`，名字本身叫什么完全无所谓）。
2. `Enter passphrase (empty for no passphrase)`：是否给私钥文件本身再加一道口令锁。如果设置了，以后每次用这个私钥登录时还得再敲一次这个口令；日常个人设备求省事直接回车留空即可。

跑完后会在 `.ssh/` 下生成成对的两个文件：
- 私钥（不带后缀，如 `id_rsa`，在云厂商下载的有时叫 `keypair.pem`）：留在你自己的客户端电脑上，不能外泄。文件内容长这样：
  ```text
  -----BEGIN OPENSSH PRIVATE KEY-----
  b3Blbn...CAwQFBgc=
  -----END OPENSSH PRIVATE KEY-----
  ```
- 公钥（带 `.pub` 后缀，如 `id_rsa.pub`）：只有一行纯文本（依次包含：算法类型、公钥字符串、末尾注释说明是谁生成的），专门用来复制粘贴到目标服务器或 GitHub 上：
  ```text
  ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ...Va72PZ user@my-machine
  ```

### 2. 客户端与服务端的 `.ssh/` 目录结构对比

很多人分不清 `config`、`known_hosts` 和 `authorized_keys` 该放在哪一头，对比一下两边的目录就清楚了：

```text
[1. 你手头的个人电脑 (客户端 Client)：同时存着你自己的私钥和公钥，外加 config 连接配置]
~/.ssh/
  - config                  (客户端连接别名配置文件：配好后敲 ssh vps 就能免输 IP 和用户名直连)
  - known_hosts             (记录你曾经连过的每台服务器的指纹，防止中间人冒充，也避免每次连接都弹窗问 yes/no)
  - id_ed25519_github       (私钥)
  - id_ed25519_github.pub   (公钥)
  - id_ed25519_vps_us       (私钥)
  - id_ed25519_vps_us.pub   (公钥)

[2. 远端被连接的 Linux 服务器 (服务端 Server)：根本不需要你的私钥，核心只有一个 authorized_keys]
~/.ssh/
  - authorized_keys         (核心门禁名单。把允许登录这台服务器的各个客户端的 .pub 公钥内容，一行一个追加在这个文件里)
  - known_hosts             (仅当你在服务器上去主动 ssh 连别的机器或 git pull 时才会生成)
```

- 怎么把客户端的公钥最快塞进服务器的 `authorized_keys` 里？
  在 Linux / macOS 客户端上，不需要自己手动去服务器上建文件，直接跑一条命令，输入一次服务器密码，它就会自动把你的公钥追加到服务器 `~/.ssh/authorized_keys` 的末尾并设好权限：

  ```bash
  ssh-copy-id -i ~/.ssh/id_ed25519_vps_us.pub ubuntu@1.1.1.1
  ```

- 客户端 `~/.ssh/config` 标准写法（一段配一台服务器，可重复多段）：
  注意 `ssh-copy-id` 只负责把公钥传到服务器，不会改你本地的 `config`。自己打开本地 `~/.ssh/config` 写上：

  ```ssh-config
  Host vps 1.1.1.1                        # 你自己起的快捷别名（支持并列写多个，敲 ssh vps 就等于连它）
      HostName 1.1.1.1                    # 真实的服务器 IP 或域名
      User ubuntu                         # 登录用户名
      IdentityFile ~/.ssh/id_ed25519_vps  # 指定使用哪把私钥文件
      IdentitiesOnly yes                  # 强制只用上面指定的这把私钥，防止 ssh-agent 里加载了过多其他密钥导致重试超限被拒
  ```

  （注：Linux 系统其实有两层 SSH 客户端配置，先读用户自己的 `~/.ssh/config`，再读系统全局的 `/etc/ssh/ssh_config`；如果未来想彻底禁止密码登录、只允许密钥登录，一定要遵循“先确认密钥已经能免密登进去（先有鸡），再去改服务端的 `/etc/ssh/sshd_config` 把 `PasswordAuthentication` 设为 `no`”的顺序，防止把自己锁在服务器门外。）

### 3. 把 Windows 电脑配成 SSH 服务端（`sshd`）的五个大坑

平时 Windows 只当客户端连别人很顺畅；但如果反过来，想在自己的 Windows 台式机上开启 `sshd` 服务端，从 Mac 或另一台电脑 `ssh` 连进 Windows，坑就非常多了：

1. 安装 `OpenSSH.Server` 经常假死：
   Windows 10/11 默认只内置了 `ssh` 客户端，没有装服务端 `sshd`。很多教程让你在管理员 PowerShell 里跑 `Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0`（那四个波浪线是微软规定的版本分隔符），但这步在国内网络或特定系统版本下极易无限卡死。跑通或通过系统“可选功能”装好后，还需要启动服务、设为开机自启并放行防火墙 22 端口，最后务必用 `Get-Service sshd` 确认状态已经是 `Running`。
2. **微软在线账号的密码问题**：
   第一次用密码 `ssh yourname@ip` 连 Windows 时，如果这台 Windows 绑定了微软在线账号，输入的密码必须是你微软账号的邮箱登录密码，而不是平时开机敲的 PIN 码（这与 Windows 远程桌面和 SMB 共享完全一致）。
3. 最大的坑：管理员账号根本不读 `~/.ssh/authorized_keys`。
   在 Linux 上，所有用户的公钥都放在各自家目录的 `~/.ssh/authorized_keys` 里；但在 Windows 上，由于你平时用的个人主账号几乎都属于 `Administrators`（管理员组），Windows 的 `sshd` 默认有一个奇葩规定：凡是属于管理员组的用户，它完全无视你个人目录 `C:\Users\你的名字\.ssh\authorized_keys`，而是强制只去读系统公共目录下的这一个文件：

   ```text
   C:\ProgramData\ssh\administrators_authorized_keys
   ```

   你必须把客户端的 `.pub` 公钥内容写进这个 `administrators_authorized_keys` 文件里。而且这还没完：这个文件的安全权限（ACL）必须严格限制为“仅 `SYSTEM` 和 `Administrators` 可访问，且必须关闭权限继承”，只要普通用户对它有一丁点读取权限，`sshd` 就会认为密钥不安全而直接拒绝免密登录。
4. Windows 没有自带 `ssh-copy-id`：
   Windows 的 OpenSSH 没附带 `ssh-copy-id` 这个 Shell 脚本，所以从 Windows 往别的机器传公钥，要么在 PowerShell 里用管道 `type $env:USERPROFILE\.ssh\id_rsa.pub | ssh user@host "cat >> ~/.ssh/authorized_keys"`，要么登上去手动粘。
5. 连上去默认是 `cmd` 怎么切 Shell？
   连上 Windows `sshd` 后默认进的是老旧的 `cmd.exe`。如果想直接进 PowerShell 或 WSL，可以在连接命令末尾直接带上要启动的 Shell 程序名：`ssh user@hostname powershell`（或修改注册表 `HKLM:\SOFTWARE\OpenSSH` 里的 `DefaultShell`）。

---

## 二、Linux 运维排障基本功（硬件、网络、端口与进程）

连上一台陌生的 Linux 服务器后，按“看硬件家底 $\rightarrow$ 看网络与端口监听 $\rightarrow$ 查进程与杀进程”的顺序，记住以下几组现代标准命令即可。

### 1. 摸清机器硬件家底（CPU、内存、磁盘）

```bash
# 1. 看内核版本与系统架构 (如 x86_64 还是 aarch64)
uname -a

# 2. 看 CPU 型号、核心数、线程数与虚拟化状态
lscpu

# 3. 看物理内存与 Swap 交换分区使用量 (-h 表示自动换算成人类易读的 GB/MB)
free -h

# 4. 看硬盘（两把尺子，维度不同）：
df -h    # 从【已挂载的文件系统】角度看每个分区用了百分之多少（类似看 Windows 里 C 盘、D 盘剩多少空间）
lsblk    # 从【底层物理硬盘与分区树】角度看机器上总共插了几块盘、怎么分的区、分别挂载到了哪个目录
```

### 2. 网络、端口占用与 DNS 排障（拥抱 `iproute2`，告别 `net-tools`）

很多老教程还在教 `ifconfig`、`netstat`、`route`，结果你在新装的 Ubuntu 或 Debian 上一敲报错 `command not found`。
注意：不是系统没装网络工具，而是那些老命令所属的 `net-tools` 包早已被现代 Linux 淘汰了。现代 Linux 发行版默认预装的是直接对接内核的新一代 `iproute2` 工具包：

| 排障目标 | 已过时的老命令 (`net-tools`) | 现代标准命令 (`iproute2`) | 常用缩写与解读 |
| :--- | :--- | :--- | :--- |
| 看网卡与 IP 地址 | `ifconfig` | `ip addr show` | 直接敲缩写 `ip a` |
| 看网卡物理连接状态 | `ifconfig` | `ip link show` | 直接敲缩写 `ip l` |
| 看路由表与网关 | `route -n` | `ip route show` | 直接敲缩写 `ip r`（或 `ip route get 8.8.8.8` 看具体走哪张网卡） |
| 查哪个端口被哪个进程占了 | `netstat -tlnp` | `sudo ss -tlnp` | `ss` 速度比 `netstat` 快得多 |

重点拆解查端口神器 `sudo ss -tlnp`：
- 四个字母参数的含义：
  - `-t`（`--tcp`）：只看 TCP 协议（如果要看 UDP 就加 `-u`）；
  - `-l`（`--listening`）：只看当前正处于“监听等待外部连接”状态的服务端端口（浏览器或 curl 主动往外连别的网站的临时连接不叫监听，会被过滤掉，列表很干净，很多时候连 `| grep :端口号` 都不用加就能一眼看完）；
  - `-n`（`--numeric`）：直接显示纯数字端口号（如 `:443`、`:22`），不要去查表把它翻译成 `https` 或 `ssh` 英文名，速度最快且方便搜索；
  - `-p`（`--process`）：把占用这个端口的进程名和 PID 打印出来。
- **为什么强烈建议前面加 `sudo`？**
  不加 `sudo` 虽然也能跑出端口列表，但凡是由 `root` 或系统服务启动的进程（比如 Nginx、sshd、Docker），最后一栏的进程名和 PID 会全部被隐藏显示为空。加上 `sudo` 才能一次看清所有端口背后的真凶。

防火墙与 DNS 的现代管理入口：
1. **防火墙**：Linux 内核底层的包过滤框架叫 `Netfilter`，老一代用户态配置工具是复杂的 `iptables`（现代正在向 `nftables` 过渡）。日常在发行版上开端口一般不直接手搓 `iptables`，而是用发行版封装好的前端命令：
   - Ubuntu / Debian 系：用 `ufw`（如 `sudo ufw status`、`sudo ufw allow 8080/tcp`）；
   - RHEL / CentOS / Fedora 系：用 `firewall-cmd`（FirewallD）。
2. DNS 到底配在哪？（Ubuntu `systemd-resolved` 机制）：
   虽然 Linux 传统的 DNS 配置文件叫 `/etc/resolv.conf`，但在现代 Ubuntu 上，你去跑一下 `ls -l /etc/resolv.conf`，会发现它其实是一个指向 `../run/systemd/resolve/stub-resolv.conf` 的软链接，里面的 nameserver 写着 `127.0.0.53`。
   这是因为现代系统默认由 `systemd-resolved` 服务在本地 `127.0.0.53` 起了个本地 DNS 缓存桩（Stub），`/etc/resolv.conf` 只是它自动生成出来的结果文件，你直接手改它重启就会被覆盖。想要看每张网卡当前真正生效的上游 DNS 服务器是谁，标准命令是敲：

   ```bash
   resolvectl status
   ```

### 3. 查找进程与终止进程

- **知道端口号找进程**：优先用上面讲的 `sudo ss -tlnp | grep :端口号`。
- **知道程序名字找进程**：用 `ps aux | grep python`（如果装了下面的 ripgrep，敲 `ps aux | rg python`）。
- **杀进程**：
  1. 拿到准确的數字 PID 后精准击杀：`kill <PID>`（发送默认的 `15 SIGTERM` 信号，让进程自己保存收尾后优雅退出）；如果进程已经彻底卡死不听劝，再用 `kill -9 <PID>`（发送 `9 SIGKILL` 信号，由内核直接强行抹杀）。
  2. 尽量少偷懒按名字盲杀（如 `killall nginx` 或 `pkill python`），因为如果机器上同时跑了别人的同名进程或子任务，极易发生误杀。

---

## 三、现代终端工具链（Rust 生态对传统 Unix 命令的替代工具）

过去几年里，开源社区用 Rust（以及 Go）把几十年前那些交互反人类、输出没颜色、参数很难记的传统 Unix 命令几乎重写了一遍。下面按真实日常使用体感做一个梳理与锐评：

### 1. `rg`（ripgrep，替代 `grep`）与 `fd`（替代 `find`）—— 常用替换工具

- `rg`（ripgrep，按文件内容搜索）：
  传统的 `grep -rn "SketchObject" .` 又慢，又会把 `.git/` 目录、编译产物、`node_modules` 里的二进制乱码全搜出来刷屏。
  用 Rust 写的 `rg` 直接敲：

  ```bash
  rg "SketchObject"
  ```

  它默认就是递归搜索当前目录及所有子目录，自动读取你的 `.gitignore` 跳过被忽略的垃圾目录和隐藏 `.git` 文件夹，多线程并发，速度比传统 `grep` 快出一个数量级，输出还自带行号和漂亮的高亮。
- `fd`（按文件名搜索，替代传统 `find`）：
  传统 `find . -name "*test*"` 参数冗长繁琐；而 `fd` 直接敲 `fd test`，就能直接找出当前目录下所有文件名包含 `test` 的文件，同样默认自动跳过 `.git` 和 `.gitignore` 里的目录。

### 2. `zoxide`（智能目录跳转 `z`，替代 `cd`）—— 实用工具

安装 `zoxide` 并在 Shell 配置里执行 `init` 后，它会注入两个 Shell 函数（注意 `z` 和 `zi` 是函数，不是独立的可执行文件，因为子进程没法改变父 Shell 的当前工作目录）：
- 平时完全可以把它当成普通的 `cd` 来用；但每当你去过某个深层目录（比如 `/home/user/Documents/vite-notes`），`zoxide` 就会在后台数据库里记下访问权重；
- 下次不管你在系统的哪个角落，不需要再敲一长串路径，直接敲 `z vite` 或 `z notes`，它就会自动匹配历史权重最相近的那个目录直接跳过去。敲 `zi` 则会弹出一个交互式列表，列出你最近最常去的几个目录供上下键选择（就像 Windows 资源管理器左上角的“快速访问”）。
- 一条重要的 AI 协作工程经验：不要写 `alias cd=z`。
  很多人喜欢在 `~/.bashrc` 或 `fish` 里直接把 `cd` 别名替换成 `z`。不要这么干——因为原生 `cd foo` 的行为是 确定性的（当前目录下没有 `foo` 就明确报错），而 `z foo` 是模糊猜测跳转（当前目录没有 `foo`，它会自作主张把你传送到十万八千里外某个名字带 `foo` 的历史目录去。）。如果后台的 AI Agent 或自动化脚本在你的 Shell 里敲了 `cd`，一旦被替换成模糊跳转的 `z` 跳错了目录，后续的读写或删除操作会直接酿成事故。人自己敲 `z`，把确定性的 `cd` 留给脚本和 AI，才是最稳妥的边界。

### 3. `yazi`（终端三栏文件管理器）与 `fzf`（模糊搜索）

- `yazi`（Rust 写的终端 TUI 文件管理器）：
  在没有图形界面（纯 SSH 连服务器）想要快速浏览多层目录结构、批量选文件移动或改名时非常顺手。打开后是经典的三栏布局：左栏是父目录（左上角显示你当前所在的路径），中间栏是当前目录内容（左下角显示选中项信息），右栏直接实时预览右侧文件内容。

  | 按键 | 在 `yazi` 中的动作 |
  | :--- | :--- |
  | `a` | 新建文件或文件夹（技巧：输入 `notes.txt` 结尾不带斜杠就是新建文件；输入 `src/` 以斜杠结尾就是新建文件夹。） |
  | `r` | 重命名当前文件 |
  | `Space` | 选中 / 取消选中当前文件（可连续按空格多选） |
  | `y` / `x` / `p` | `y` (Yank) 复制选中项；`x` 剪切选中项；跳到目标目录后按 `p` 粘贴 |
  | `d` | 删除文件（默认移入回收站，大写 `D` 永久删除） |
  | `:` / `q` | `:` 在当前目录底部临时唤出命令行跑一条命令；`q` 退出 yazi |

  （注：`yazi` 默认隐藏以 `.` 开头的隐藏文件，可按 `.` 键随时切换显示隐藏文件，或写进配置文件默认显示。）
- `fzf`（Go 写的通用命令行模糊查找器）：
  平时一般很少直接单独敲 `fzf`，它主要是挂在 Shell 的 `Ctrl + R`（搜索历史敲过的命令）快捷键背后当引擎。如果你平时主力已经用 `fish` shell 了（`fish` 自带的 `Ctrl + R` 和右方向键历史补全本来就已经很好用了），装 `fzf` 的体感提升就没那么大；但在原生 `bash / zsh` 下装一个 `fzf` 接管 `Ctrl + R` 还是能救命的。

### 4. `zellij`（Rust 写的现代终端复用器，对标 `tmux`）

`zellij` 的层级结构与 `tmux` 完全一致：`Session（后台持久化会话） --> Tab（顶部标签页） --> Pane（同屏分屏窗格） --> Program（里面跑的具体程序）`。
- 相比老牌 `tmux` 需要死记硬背一套反人类的前缀快捷键，`zellij` 开箱即用，底部直接常驻显示当前可用的快捷键提示栏，而且原生支持直接用鼠标拖动分屏边框调大小。
- 直接敲 `zellij` 会新建一个会话（它会自动随机生成一个“形容词 + 名词”的会话名，不像 tmux 是冷冰冰的 `0, 1, 2`）；断网重连后敲 `zellij a <会话名>`（即 `attach`）就能无缝接回刚才的画面。
- **真实使用锐评**：
  针对我现在“主力用 Mac 桌面终端（如 Ghostty），通过 SSH 连到 Linux 台式机干活”的工作流，我的结论是：除非要在远端服务器上跑一个耗时好几个小时且不能因为网络闪断而中断的编译/训练任务，否则平时日常敲命令、跟 AI Agent 对话时，反而【不应该】套一层 `zellij` 或 `tmux`。
  原因很现实：一旦在终端模拟器里面又套了一层终端复用器，它会拦截接管你的鼠标滚轮、系统剪贴板选中复制、以及 `Alt/Option + 左右方向键` 跨词跳光标的快捷键，导致平时最基础的复制粘贴和光标移动出现各种别扭的割裂感。

---

## 四、NeoVim（LazyVim）核心心智与高频肌肉记忆

在终端里改文件，可以把 Neovim 的生态分成两层来理解：
1. 插件管理器（如 `lazy.nvim`、`vim-plug`）：只负责根据列表把插件从 GitHub 下载到电脑上并在启动时按需加载；
2. 开箱即用配置框架（如 `LazyVim`、`AstroNvim`）：别人已经帮你用 `lazy.nvim` 挑好了几十个主流插件、配好了主题、LSP 代码补全和文件树，配置文件统一放在 `~/.config/nvim/` 下（你可以在里面继续加新插件，或者把自带不喜欢的插件关掉）。如果平时主力用 VS Code，也可以在 VS Code 里装一个 `VSCode Neovim` 插件——它会让 VS Code 的代码编辑区在底层直接由你电脑上真实的 Neovim 进程接管，既享受 GUI 的便利，又拥有 纯正的 Vim 键位。

下面只记最核心、真正能提升编码效率的 7 组肌肉记忆（抛弃那些花里胡哨记不住的奇技淫巧）：

### 1. 模式切换、输入法痛点与窗口焦点

- **关于移动光标的实话**：标准 Vim 教条认为你必须按 `Esc` 退回 Normal 模式再用 `h / j / k / l`（左/下/上/右）移动光标；虽然在 Insert 打字模式下可以按 `Ctrl + o` 临时借用一次 Normal 模式命令再自动弹回 Insert 模式，但这操作在实战中很繁琐——在 Insert 模式下如果只是微调一两个字符，右手直接去按键盘上的方向键有时候反而更自然，完全没必要被教条绑架。
- 退出 Insert 模式自动切回英文输入法：
  写中文注释时最烦的就是：在 Insert 模式切了中文输入法，按 `Esc` 回到 Normal 模式后想按 `w` 跳单词，结果顶出来一串中文拼音选字框。解决方法是配合 `im-select` 工具写一个小钩子脚本：监听 Neovim 的 `InsertLeave` 事件，只要一按 `Esc` 退出插入模式，自动强制把系统输入法切回英文键盘。
- LazyVim 里的窗口与终端切换（必须在 Normal 模式下按）：
  - `Ctrl + /`：在底部一键弹出/隐藏内置浮动终端（再按一次直接收起）；
  - `Ctrl + h / j / k / l`：在左侧文件树、中间代码编辑区、底部终端等多个分屏窗格之间切换焦点；
  - 當焦点在左侧文件树（Neo-tree）上时，按 `H`（或 `Ctrl + h`）可以一键切换显示/隐藏以 `.` 开头的隐藏文件。

### 2. 行内与跨词高速移动：`w / b / e` 与 `f + 字符`

在 Normal 模式下，不要按着 `h` 或 `l` 一个字母一个字母地挪，最高效的是按“单词”和“目标字符”跳：

| 按键 | 跳转效果 | 实战场景 |
| :--- | :--- | :--- |
| `w` (word) | 直接跳到 下一个单词的开头 | 最常用的向右跨词推进 |
| `b` (back) | 直接跳回 上一个单词的开头 | 向左跨词回退 |
| `e` (end) | 直接跳到 当前单词（或下一个单词）的末尾 | 改单词后缀时极顺手 |
| `f + <某字符>` | 行内精准狙击：按下 `f` 后再按任意一个字符（比如 `f(` 或 `f,`），光标直接闪现到当前行下一个 `(` 或 `,` 的位置。<br/>跳过去之后：按分号 `;` 继续跳向下一个该字符，按逗号 `,` 反向跳回上一个该字符。 | 比如在 `int main(int a, int a1, int a4, int b) {}` 这行里，按 `fa` 再连按 `;`，光标就会在几个参数 `a` 之间精准闪现 |

### 3. 文本对象操作符：`c / d / y / v` + `i` + 目标（Vim 最强大的组合语法）

Vim 的编辑命令不是死记硬背的，而是像搭积木一样的“动词 + 介词（范围） + 名词（目标对象）”语法：

- **四个核心动词**：
  - **`c`（change，修改）**：删掉目标内容，并立刻自动进入 Insert 打字模式让你填新内容；
  - **`d`（delete，删除 / 剪切）**：删掉目标内容，继续留在 Normal 模式（注意：Vim 里删掉的东西会自动进剪贴板，所以 `d` 其实也是剪切。）；
  - **`y`（yank，复制）**：复制目标内容（LazyVim 默认已帮你打通了 Vim 寄存器与操作系统的 `Ctrl+C / V` 剪贴板同步）；之后按 `p`（put）即可粘贴；
  - **`v`（visual，高亮选中）**：把目标范围高亮框选出来。
- 核心范围介词 `i`（inner，在……内部）：
  把上面的动词和 `i` 拼在一起，后面跟上 `w`（word 单词）或者成对的符号 `( / [ / { / "`，很实用：

  ```text
  ciw    --> 删除当前光标所在的整颗单词（哪怕光标停在单词正中间。），并直接进入打字模式重写该单词
  ci(    --> 一键清空当前小括号 ( ... ) 里面的所有参数，并直接进入打字模式重填。
  ci"    --> 一键清空当前双引号 " ... " 里面的字符串，直接重填。
  yiw    --> 复制当前光标所在的整颗单词（不需要先把光标挪到词首。）
  di{    --> 一键删空当前大括号 { ... } 函数体内部的所有代码
  yy / y3w --> yy 复制整行；dd 剪切整行；y3w 向后复制 3 个单词
  ```

### 4. `.`（点号命令：一键重放上一次的修改动作）

在 Normal 模式下，英文句号 `.` 代表“完完全全重复执行我刚刚做过的那一次增删改操作”。
比如你想给 `a`、`b`、`c` 三个变量前面统一加上 `prefix_` 前缀：你只需要在第一个变量上做一次修改然后按 `Esc`，接着把光标挪到第二个变量上按一下 `.`，挪到第三个变量上再按一下 `.`，修改直接完成。
