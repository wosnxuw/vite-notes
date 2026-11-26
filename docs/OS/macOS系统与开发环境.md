# macOS 系统使用与开发环境治理

这篇笔记合并了 macOS 日常外设与窗口操作习惯、Homebrew 软件管理机制，以及为什么我会在 Mac（包括 Windows）上对 `npm`、`pip` 和个人电脑跑 `Docker` 保持警惕。

---

## 一、键鼠外设与窗口管理习惯

### 1. 鼠标滚轮方向与加速度（Mos）

刚从 Windows 切到 macOS 时，鼠标最别扭的有两点：一是自带奇怪的鼠标移动加速度，二是把鼠标滚轮方向调成正常（往下滚页面往下走）之后，触控板的双指滑动方向也会跟着一起变反。
- 解决办法：在「设置 --> 鼠标」里关掉鼠标加速度，然后安装免费开源的小工具 Mos。
- Mos 不仅可以单独把外接鼠标的滚轮方向反转（不影响触控板的自然滚动），而且它自带的“平滑滚动”曲线比 macOS 原生生硬的滚轮步进舒服得多。（瑕疵：当这台 Mac 被远程桌面控制时，开着 Mos 偶尔会导致远程滑动速度失控。）

### 2. 键盘左下角四键映射与外接机械键盘

macOS 原生键盘左下角从左到右依次是四个键：`fn(🌍)`、`control(⌃)`、`option(⌥)`、`command(⌘)`（对比 Windows 是 `Ctrl`、`Win`、`Alt`）：

| macOS 按键 | 对应直觉与核心作用 |
| :--- | :--- |
| `command (⌘)` | 约等于 Windows 下的 `Ctrl`（复制 `⌘C`、粘贴 `⌘V`、保存 `⌘S` 全靠它） |
| `control (⌃)` | 在桌面操作里约等于鼠标右键（按住它点左键等于点右键）；它最核心的用处是在终端 Shell 里，中断程序的 `Ctrl + C` 依然是真的按这个 `control` 键 |
| `option (⌥)` | 意为“另一种隐藏选项”。除了跟 `command` 组快捷键外，按住 `option` 再去点顶部菜单栏的 Wi-Fi 图标，就能直接展开看到当前路由器的 IP、信道、握手速率和信号衰减强度 |
| `fn (🌍)` | 切换顶部 F1~F12 功能区：默认不按 `fn` 直接按顶部按键是调亮度、调音量；按住 `fn` 再按才是触发软件（如 VS Code）里的标准 `F1~F12` |

外接标准 87 键美式机械键盘时的改键必做项：
- 普通 Windows 机械键盘插到 Mac 上，左下角三个键默认会被识别为：`control`、`option (原 Win 键位)`、`command (原 Alt 键位)`——后面两个键的顺序跟 Mac 原生键盘是反的（而且外接键盘没有 `fn`，按 F 区直接就是标准的 `F1~F12`，不具备调光功能）。
- 因此插上外接键盘后，第一步就是去「设置 --> 键盘 --> 键盘快捷键 --> 修饰键」里，针对这把外接键盘把 `Option` 和 `Command` 互换位置，保证大拇指盲按的肌肉记忆与 Mac 笔记本内置键盘完全一致。

### 3. 程序坞（Dock）与多窗口切换技巧

在 Windows 上，我习惯一个桌面堆所有窗口，因为任务栏图标鼠标悬停就有全部子窗口预览，不会迷路；但在 macOS 上，如果你开了两个 Chrome 窗口，底下程序坞还是只有一个 Chrome 图标，也没有悬停预览，按 `Command + Tab` 切应用时要么全弹出来要么找不到收起的窗口。

最实用的四个原生窗口调度动作：
1. `Control + 下方向键`（App Exposé，最有用的一集）：单独把“当前正在用的这一个软件”的所有窗口平铺展开在屏幕上，找同一个软件的第二个窗口极快；
2. `Control + 上方向键`（调度中心 Mission Control）：把当前桌面上所有软件的窗口全部平铺展开；
3. **`Control + 左 / 右方向键`**：在多个虚拟桌面（以及全屏游戏/全屏应用）之间左右滑动切换；
4. `Command + ~`（Tab 上面那个反引号键）：在当前同一个软件的多个窗口之间直接循环切换（而 `Command + Tab` 是在不同软件之间切换）。另外，右键点程序坞里的软件图标，列表里前面带“对号 `✓`”的代表正在显示，带“菱形 `◆`”的代表被最小化收起了。

---

## 二、Homebrew 包管理机制与 Gatekeeper 签名坑

Homebrew 是 macOS 上事实标准的第三方包管理器（地位类似于 Ubuntu 的 `apt` 或 Fedora 的 `dnf`，当然也有人用声明式的 Nix）。

### 1. Formulae（公式）vs Casks（桶）

Homebrew 把所有软件严格分为两类：

```bash
# 1. 安装 Formulae（命令行工具、编译器、底层 C/C++ 库，如 git, ripgrep, ffmpeg）
# 统一安装在 /opt/homebrew/Cellar/ 下，并软链接到 /opt/homebrew/bin/
brew install git

# 2. 安装 Casks（带图形界面的桌面 GUI 软件，如 Google Chrome, VS Code）
# 效果和自己去官网下载 .dmg 拖进应用程序文件夹一样，最终都放在 /Applications 下
brew install --cask google-chrome
```

关于下载源与卸载的真相：
- Brew 下载软件分两条路：第一类基础开源工具（Formulae）直接从 Brew 官方预编译好的二进制镜像服务器（Bottles）拉取；第二类商业或桌面 GUI 软件（Casks），Brew 的配置文件里其实只写了一个指向软件官方下载服务器的 URL，执行安装时现去官网拉 `.dmg` 下来解包。
- **卸载残留问题**：macOS 上的每个 `.app` 本体虽然像个独立沙箱，但运行时依然会在 `~/Library/Application Support/`、`~/Library/Caches/`、`~/Library/Preferences/` 下拉出一堆配置和缓存。直接敲 `brew uninstall --cask xxx` 通常只删掉了 `/Applications/xxx.app` 壳子，产生的数据并不会被清理。比较彻底的范式是：先用 Pearcleaner 或 AppCleaner 这类卸载器把关联目录扫干净，再用 `brew uninstall` 注销记录。
- **自动更新软件的冲突**：像现代 AI 编辑器、Chrome 浏览器这类更新极快（一天一个版本）的 GUI 软件，它们内部自带了强力的后台自动更新机制。一旦它自己升级了版本，就脱离了当时 Brew 记录的版本号，后续其实就没必要再用 Brew 去升级管理它们了。

### 2. macOS Gatekeeper 弹窗“已损坏，移到废纸篓”的根因

有时候用 `brew install --cask` 装完某些开源 GUI 软件，双击打开时 macOS 甚至不给你“来自互联网下载，是否仍要打开”的确认按钮，而是直接弹窗威胁“软件已损坏，请移到废纸篓”。

- **根因**：软件其实根本没坏。是因为从浏览器或 Brew 下载的文件会被 macOS 文件系统自动贴上一个名为 `com.apple.quarantine`（隔离检疫）的扩展属性标签；如果该开源作者没有每年交 99 美元给苹果买开发者证书做公证签名（Notarization），新系统的 Gatekeeper 看到带有检疫标签又没苹果公证的二进制，就会直接拦截。
- **解法**：以前 Brew 提供了一个 `--no-quarantine` 参数，后来被官方废弃了。遇到这种被拦的开源软件，只需在终端用 `xattr -cr /Applications/xxx.app` 剥离掉它身上的扩展检疫属性（或者在本地配一个安装后自动清理该属性并进行本地 `codesign --force --deep -s -` 重签名的钩子脚本），就能直接正常打开。（注：像常见的代理客户端配置系统代理后如果不生效，点一下“重启服务”即可，倒不需要对它折腾 `xattr`；另外在部分网络环境下开启全局 TUN 模式容易把本机路由表搞乱，日常在终端里走环境变量或局部白名单代理反而最稳。）

---

## 三、对 `npm -g`、`pip` 和本地跑 Docker 保持警惕？

以我现在手里这台 Mac（Windows 上其实也一模一样）为例，记录一下为什么我越来越不敢随手用 `npm`、`pip` 或 `Docker` 往主力电脑里全局装软件。

### 1. `npm` 全局包：绑死在特定 Node 版本路径下的孤岛

要在电脑上用 Node.js，通常大家都会先装一个管理 Node 版本的工具（比如用 Rust 写的 `fnm`，或者老牌的 `nvm`）。在这台 Mac 上，`fnm` 本体装在：

```text
/opt/homebrew/bin/fnm
```

当你打开终端时，`fnm` 会在后台创建一个指向当前激活 Node 版本的临时软链接目录塞进 `$PATH`：

```text
/Users/<用户名>/.local/state/fnm_multishells/82397_1777030690437/bin/npm
```

重点来了：当你执行 `npm install -g <某个全局命令行工具>` 时，这个全局包到底被装到了哪里？

```text
/Users/<用户名>/.local/share/fnm/node-versions/v24.14.1/installation/lib/node_modules/
```

看一眼这个路径就能明白：你的“全局 npm 包”根本不是装在操作系统的全局位置，而是死死绑在 `v24.14.1` 这一个具体的 Node 版本文件夹内部！
一旦你半年后用 `fnm` 升级切换到了 `Node v25`，你之前用 `npm install -g` 装的所有全局工具在一夜之间就全部“蒸发”找不到了。

### 2. `pip` 与多套 Python 解释器的混战

Python 的包安装逻辑也是同理：你执行 `pip install`，包永远是被装进“当前这个 `pip` 所绑定的那个 `python` 解释器”同级的 `site-packages` 目录下。

如果不加约束，一台开发用的 Mac 上随随便便就会同时出现 三套以上来源完全不同的 Python：
1. Apple Xcode Command Line Tools 自带的 Python：表面路径在 `/usr/bin/python3`，实际指向 `/Library/Developer/CommandLineTools/usr/bin/python3`（供系统开发工具自用，千万别往里乱装包）；
2. **Homebrew 被动装进来的 Python**：比如 `/opt/homebrew/bin/python3.14`。很多时候根本不是你主动要装它，而是你用 `brew install nmap` 或别的工具时，被当作依赖静默拖下来的；
3. 项目虚拟环境与 `uv` 管理的 Python。

如果平时习惯在终端随手裸敲 `pip install xxx`，几个月下来，包会散落在上面两三个不同的解释器目录里，彻底乱成一锅粥。

现在的根治方案：不再裸用系统的 `pip`，所有自己的 Python 项目和脚本工具全面收口交给 `uv` 管理（项目依赖用 `uv sync / uv run`，全局独立的 Python CLI 工具用 `uv tool install` 隔离存放，甚至在 `uv` 创建的现代虚拟环境里默认连 `pip` 二进制都不放，彻底杜绝误装）。

### 3. 在个人电脑上跑 Docker Compose 的水土不服与转变

以前看到开源项目提供 `docker-compose.yml` 觉得很省事，跑多了之后却产生了一种强烈的排斥感——本质上是项目开发者偷懒，把原本针对 Linux 服务器 24 小时常驻设计的部署范式，强行搬到了用户的个人桌面电脑上，把环境治理的包袱甩给了用户自己：

1. **生命周期失控**：桌面软件点关闭按钮就彻底退出了；而服务器向的 `compose.yml` 里到处写着 `restart: always`。结果每次电脑开机或从睡眠中唤醒，后台虚拟机就自动拉起一堆容器吃内存和 CPU（Windows 上从睡眠唤醒后甚至偶发虚拟机跑满全核的 Bug）。
2. **数据归属模糊，卸载极难**：跑完产生的数据到底在容器可写层、Docker 具名卷、本地 Bind Mount 目录，还是烂在了 Docker Desktop 那个几十 GB 的虚拟硬盘文件里？想彻底删干净跟排雷一样。
3. **配置入口散落各处**：如果你在五个不同的代码仓库里敲过 `docker compose up -d`，你几乎得拿本子记下这五个 `yml` 的路径，否则过阵子都忘了谁是谁。
4. **填平了环境不代表软件质量变好**：像 Milvus 这类重型组件，哪怕包在 Docker 里，写得不好的地方照样在后台假死或空跑 CPU。

如果确实要在个人电脑上跑第三方 Compose 项目的三条缓和铁律：
- 把所有长期要用的 `compose.yml` 统一集中放到同一个专门的管理文件夹下；
- 检查里面的 `volumes`，优先改为挂载当前目录旁边的本地文件夹（所见即所得，删文件夹即彻底卸载）；
- 把里面所有的 `restart: always` 删掉。

### 4. AI 时代的本地环境新思考

最近和 AI Agent 高频协作写代码后，思路又有了一层新转变：
- 以前觉得本地必须装 `fnm / nvm` 并在好几个 Node、Python 版本之间来回切，是因为人要自己去跑各种老项目；
- 其实在 AI 时代，如果某个复杂或老旧的仓库对 Node / Python 版本有极其严苛的要求，Docker 容器反而能为那个仓库锁死专属的编译器版本；
- 因此，在自己的宿主机系统里，只需要保留一套最精简、最新、最干净的 `Node` 和 `Python (uv)` 就完全够了——目的仅仅是让 AI 平时能随手秒级跑几个小脚本和小命令；
- 反倒是像 `Go`、`Rust`、`gcc/clang` 这类原生编译工具链，最好在宿主机本地直接装好一套。因为 AI 在分析或写工具时偶尔会去调用它们，如果你宿主机本地没装，AI 为了完成任务，反而会自己去后台给你拉起一个庞大的 Docker 容器来跑编译，那就本末倒置了。
