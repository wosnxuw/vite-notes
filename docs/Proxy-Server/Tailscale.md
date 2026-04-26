Tailscale 按照其官方的介绍是：

Tailscale is a WireGuard-based app that makes secure, private networks easy for teams of any scale.

Tailscale 的自己部署时架构大概是这样：

一台核心服务器，上面部署 HeadScale，叫做控制平面，用于做用户认证。HeadScale 服务，内置了 DERP 和 STUN（embedded DERP）。并且由 DERP 服务器充当 STUN 服务器。

Stun：session traversal utilities for NAT

Derp：Designated Encrypted Relay for Packets

STUN 用于做镜子，DERP 是 TailScale 这个团队搞的一个“盲人搬运工”

其他所有设备，上面部署 TailScale 客户端，

核心服务器上，是没有 TailScale 客户端的，不允许同时存在 TailScale 和 HeadScale，所以以后在有 TailScale 客户端的机子上 status，也看不到核心服务器

一个 Headscale 支持多个 DERP

它不是由某个加入了 tailnet 网络的 TailScale 节点本身，它内部有某个开关，开启后，就可以充当 DERP（有些电脑都没公网 ip 你 derp 个什么）

而是那台机器，部署了一个 DERP 服务在跑，这个 DERP 服务可以是第三方的。只需要你的 headscale 配置进来。这个 derp 服务器，甚至可以不在 tailnet 里，因为它是瞎子。

一个 derp 服务器，打开 443 端口应该有个简易网页

DERP

This is a Tailscale DERP server.

It provides STUN, interactive connectivity establishment, and relaying of end-to-end encrypted traffic for Tailscale clients.

tailscale 基于的是 WireGuard，这里有必要理清楚

WireGuard 是一个网络隧道协议，目标是替代 OpenVPN，将数据包加密后发送给其他节点，有点类似于建立链接

对比一下：

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
