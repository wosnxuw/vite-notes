# VPN 协议一览

### 协议一览

（当前内容截止到 2025 年年末）

SS ShadowSocks 2013 年，第一次提出了分流的概念，2015 年死死喵

VMess ：伪装。需要购买域名，配置 CDN 来隐藏 IP。本身加密，实际上是 TLS in TLS，两次加密，因而数据特征明显

Trojan：伪装为完整的 https 网站

VLESS：传输协议和加密层解耦

XTLS：V2Fly 社区的一次分裂

Reality：直接借用别人的官网

Hysteria：利用 UDP 的一种协议

关于 V2RayN 这个客户端：

2023 年的版本，内核是可以用 Xray，但是不能是 Sing-box

现在 2025 的可以是 Sing-box，可以 XRay

目前的发展现状如下：

![image-20251120145342218](assets/image-20251120145342218.png)

传输安全，定义了在 TCP 层之上的传输层安全协议

传输方式，类似于应用层，使用 websocket 还是别的

代理协议，就是代理协议，各家自定义的

这三者理论上可以随意组合
