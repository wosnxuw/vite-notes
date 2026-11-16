# V2Ray 分流与内网绕过

## 问题

公司内网里架了一台 DNS 服务器，把内部域名解析到内部 ip，并且都没开 TLS（即 http 和 websocket 明文）

此时，一个 a.company.com 的域名可以在浏览器打开

一个 b.company.com 的域名（提供 OpenAI like 服务），无法支持到 Codex

备注：不要使用 ping（ping 走 ICMP，不走 HTTP/SOCKS 应用层代理）

补充场景：使用 Tailscale 组网访问 `100.64.0.x` 服务时，发现 `ssh 100.64.0.x` 一直正常（`ssh` 不读 `http_proxy`，直接走内核 `tailscale0` 路由），但终端/Python 等 HTTP 客户端访问 `http://100.64.0.22:3000` 却会卡死超时或返回 `502`。

## 可配置的位置

V2RayN 里面有几个配置的位置

（1）参数设置-->系统代理设置：对以下地址不使用代理配置

（2）路由设置-->双击：V4-绕过大陆 (Whitelist)-->direct 规则

（3）DNS 设置-->基础设置-->直连 DNS/远程 DNS

（4）DNS 设置-->进阶设置-->使用系统 hosts：

备注：如果不开启此项，所有能走到 XRay / sing-box 的流量，都会走自己的 DNS，而不听系统的

（5）DNS 设置-->自定义 DNS

系统环境变量，在 macOS 上可通过 `scutil --proxy` 查看系统代理，在 Linux / shell 中主要看：

（1）`http_proxy` / `https_proxy` / `all_proxy`

（2）`no_proxy` / `NO_PROXY`

## 解决与勘误

无论是 Codex 命令行还是 App，最终看的都是两个系统环境变量

所以最好是两边都走，即设置 `no_proxy`，V2RayN 也要加入路由 direct

why？

1. **Tailscale 网段不在 `geoip:private` 中**：`100.64.0.0/10` 属于 RFC 6598（CGNAT 地址段），不包含在默认 `V4-绕过大陆(Whitelist)` 的 `绕过局域网IP（geoip:private）` 里。在**白名单模式**下，未命中 `direct` 的流量默认全走远端代理节点（导致远端连不上内网而超时/`502`）；如果切换到 `V4-黑名单(Blacklist)`，因最后一条规则是`最终直连`，反而不会触发这个问题。

2. **仅靠 `no_proxy` 无法兜住所有客户端**：Python `urllib` 等标准库不支持 `NO_PROXY` 里的 CIDR 网段（`100.64.0.0/10`），也不支持 `*` 通配符；且 macOS 上从 Dock/`launchd` 启动的 GUI App 也经常继承不到 shell 环境变量。

3. **内网域名进了 V2RayN 依然会 `502`**：V2RayN 默认 `DirectDNS` 为 `119.29.29.29` 且 `UseSystemHosts: false`，公网 DNS 查不到公司内网域名；另外 V2RayN 路由规则里匹配子域名使用的是 **`domain:` 前缀**（如 `domain:xxx.com`），写 `*.xxx.com` 无效。

## 备注

如果你还开启了 tailscale，你需要关掉使用 tailscale 内部 DNS 这个功能
