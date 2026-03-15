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

### 游戏与转译

Rosetta 2（2026 年的版本）

它是转译，老 Mac 上，x86_64 的代码。即方便应用从 Intel Mac 迁移到 M 系列 Mac。

它不属于第一类/第二类虚拟化技术，因为它只是做指令集的转换，即它不需要模拟另一个操作系统，因为软件本来就是为 x86_64 的老 Mac 开发的。所以它的效率很高。

那种虚拟化技术，都是模拟另一个完整的操作系统的

备注：steam beta 版才是原生 arm，不然是 x86

CrossOver

它也是转译，但是转译的是，Windows 上的 x86_64 代码。即它也不是一个完全虚拟一整套操作系统的东西，它是基于 Wine 来模拟 Windows 的 API。

它是 codeweavers 公司的一个项目，而且它是收费的（它的 GUI 壳子闭源收费，内核开源），所以你要么买，要么盗版

GPTK Game Porting Toolkit

之前提到的 Rosetta 它只能转换 CPU 指令，但是无法转换 GPU 指令，所以苹果又做了一个 DirectX 的转换层，转换成 Metal

苹果现在强推 Metal，是因为 Metal 能更好的调用它的 A/M 系列芯片性能。至于 OpenGL，停在古早版本就不再升级了。

### 虚拟化

完全模拟一个其他操作系统的软件

一般来讲，推荐的是叫 pd（parallels desktop），它是一个付费软件，但是据说和苹果关系密切，性能要比目前免费的 VMWare Fusion 好。

然后在 macOS 上，你也可以再虚拟一个 macOS，动画依然流畅

macOS 做了一个显卡直通的功能，虚拟机可以直接提交指令给真实的 GPU。类似俩系统共用 GPU。

虚拟 Windows，一般主流虚拟的 Windows 都是 ARM 的。这也和你在 x86 Windows 上弄 hyper-v 跑 x86 的 Linux 一样，同架构很好虚拟，性能损失很小。

一般不建议虚拟 x86 的 Windows，这很卡。如果你要跑 x86 的程序，考虑用 CrossOver。