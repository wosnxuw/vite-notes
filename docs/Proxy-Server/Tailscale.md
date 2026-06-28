### Tailscale

Tailscale 按照其官方的介绍是：

Tailscale is a WireGuard-based app that makes secure, private networks easy for teams of any scale.

Tailscale 的自己部署时架构大概是这样：

一台总控下面挂着多台加入的机器

### HeadScale

**一台**核心服务器，上面部署 HeadScale，叫做控制平面，用于做用户认证。

HeadScale 服务，内置了 DERP 和 STUN（embedded DERP），并且由 DERP 服务器充当 STUN 服务器。

### Stun Derp

Stun: session traversal utilities for NAT

Derp: Designated Encrypted Relay for Packets

STUN 用于做镜子，用于检查你的 NAT 结构是否可以打穿；DERP 是 TailScale 这个团队搞的一个“盲人搬运工”，用于无法打穿时，提供流量中继

一个 derp 服务器（derp 必然有公网 ip），打开 443 端口应该有个简易网页：

This is a Tailscale DERP server.

It provides STUN, interactive connectivity establishment, and relaying of end-to-end encrypted traffic for Tailscale clients.

### TailScale 客户端

tailnet 上其他所有设备，上面部署 TailScale 客户端

核心服务器上，是没有 TailScale 客户端的，即不允许同时存在 TailScale 和 HeadScale，所以以后在有 TailScale 客户端的机子上 `tailscale status`，也看不到核心服务器

### 多个 DERP

可以是由某个加入了 tailnet 网络的 TailScale 节点提供，也可以是可以是第三方的服务器提供（因为它是瞎子）

只要部署了 DERP 服务在跑，只需要你的 HeadScale 配置进来。

### Tailscale 和 OpenVPN

OpenVPN 是传统的企业级 VPN（它既是一种协议，也有对应的软件）

OpenVPN 服务端/客户端能看到经过 VPN 隧道的解密后 IP 包元数据；如果流量本身没加密，还能看到内容

应该是，只要你不在自己的电脑上，配置企业根证书，除了你谁都看不了 HTTPS

WireGuard 是现代 VPN 协议，正常只走 UDP

Tailscale 基于的是 WireGuard，这里有必要理清楚

WireGuard 是一个网络隧道协议，目标是替代 OpenVPN，将数据包加密后发送给其他节点，有点类似于建立链接

### 对比 ssh

ssh 的话，更侧重于主和从，谁登录谁，操纵谁。（虽然 ssh -L 也可以绑定端口）

https://tailscale.com/blog/how-tailscale-works

这里的说明认为，传统 WG 用户，是建立中心辐射式网络，枢纽有静态 ip

TailScale 的改进就在于，中心枢纽只负责认证，通过 P2P 实现，流量不走枢纽，而传统的中心枢纽流量压力太大

如果从 OSI 模型来理解（我们按实际的四层理解）

SSH 很明显是一个应用层，它基于 TCP（这个肯定不是 UDP 吧😂）

SSH -L -R -D 等，但感觉还是应用层的代理，因为它本质还是端口的对接

WireGuard 的目标是创建 encrypted network tunnel，也就是对 IP 包 建隧道。它是一个跨层的东西。它跑在 UDP 上，在这个 UDP 上传递你要保护的 IP 层的包。

VLess over TCP over TLS，所以 VLess 很明显，是应用层，它是一种“代理协议”

硬要归类，应该是：

Vless 和 SSH 和 设置里的 HTTP 端口直接代理到旁路由里，这是一类

WireGuard 更类似于网络层，他要建立虚拟网卡，传输 IP 包

给主机提供虚拟私网。
