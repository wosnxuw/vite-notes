### 问题

公司内网里架了一台 DNS 服务器，把内部域名解析到内部 ip，并且都没开 TLS（即 http 和 websocket 明文）

此时，一个 a.company.com 的域名可以在浏览器打开

一个 b.company.com 的域名（提供 OpenAI like 服务），无法支持到 Codex

备注：不要使用 ping

### 可配置的位置

V2RayN 里面有几个配置的位置

（1）参数设置-->系统代理设置：对以下地址不使用代理配置

（2）路由设置-->双击：V4-绕过大陆 (Whitelist)-->direct 规则

（3）DNS 设置-->基础设置-->直连 DNS/远程 DNS

（4）DNS 设置-->进阶设置-->使用系统 hosts：

备注：如果不开启此项，所有能走到 XRay 的流量，都会走自己的 DNS，而不听系统的

（5）DNS 设置-->自定义 DNS

系统环境变量，通过 scutil --proxy 查看

（1）http_proxy

（2）no_proxy

### 解决

无论是 Codex 命令行还是 App，最终看的都是两个系统环境变量

所以必须设置 no_proxy