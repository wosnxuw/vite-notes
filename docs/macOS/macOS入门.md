### 键盘鼠标

首先在设置->鼠标，关掉鼠标加速度，并且让滚轮方向正常

但是这确实会令触控板的滚动方向也变反

这一点通过安装 mos 可以解决，mos 是一个免费开源软件

并且它有一个平滑滚动功能，感觉比 macOS 自己的滚动好使，因为它本身的加速度不合理

然后键盘方面 macOS 的左下角是四个键

fn ctrl(⌃) option(⌥) command(⌘)

win 是 ctrl win alt

好，其中 command(⌘) 约等于 ctrl

ctrl(⌃) 约等于 Windows 下，右边那个 📃 键，作用似乎是按下时，按左键等于按右键。它唯一有用的点就是在 shell 里，它是结束命令的那个 ctrl+C

fn(🌍) 大概是切换 F 区 功能的键，默认情况下，不按 fn 时，是触发功能，比如亮度调节；按下 fn 并组合 fx 键，才会触发 fx，比如在 vscode 里运行命令

option(⌥) 按住 Option 点击顶部的 Wi-Fi 图标，可以看到详细的 IP 和信号强度，而且可以和 command 构成组合键

如果你插入标准美式键盘，87 键那种，如果不做任何设置，那么它的右下角是三个键，从左到右，依次是：

ctrl command option

至于 fn，它被丢掉了，但是外接键盘，按下 fx 就直接是 fx 的效果，因此外接键盘也不具备调光功能

所以，需要在设置里把这几个键换个位置，至少顺序和 mac 上得一致

### 畅通网络

首先，在 Windows 下载 v2Ray 的 dmg 包，同时把你的订阅链接以文本形式复制到文本文档，然后用 U 盘拷到 Mac 上，然后安装这个包，并配置网络

你点击配置系统代理后，点一下重启服务，似乎就能好使，不然外面好像依然不好使

我认为 xattr 这个命令是没用的，不需要给 v2Ray

开启 TUN 模式，依然全局都坏了，所以我还是在命令行里设置环境变量

### 用 homebrew 管理软件

homebrew 是一个开源项目，然后它类似于 macOS 上的 apt 或者 dnf（并不是唯一的包管理器，还有其他的，比如 Nix）

以 homebrew 为例，它把软件分为两类，公式 Formulae（CLI/库）和 桶 Casks（GUI）

`brew uninstall <name>` 安装 Formulae，诸如 Git

`brew uninstall --cask <name>` 安装 Cask，诸如 Chrome

其中后者和从官网上下载 dmg 然后手动安装一样，安装位置都是 `/Applications`，macOS 上每一个 app 都类似于沙箱。

所以卸载的时候，一般也只能卸载掉沙箱，产生的数据其实不会被干掉

brew 的下载源分为大概两种，第一种是 brew 自建的服务器（存放一些经典软件），第二种是软链接到软件提供者的服务器（去 get 那个 dmg）