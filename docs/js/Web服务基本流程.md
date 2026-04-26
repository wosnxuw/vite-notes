在我们 HTTP 的文档里，我们说明了

HTTP 请求的请求行包含路径

这一点在我们用 FastAPI 时，可以用 @app.post("/v1/chat/completions") 直接指定对应的函数，也可以像那个 rust 例子那样，手工拆解，反正是对应一个函数

现在是这样的，假设有一个很朴素的网站，它前后端分离（前后端分离是说前后端用两套框架来管理，并不一定非得部署到两台不同服务器上）

一般的实现有：

A：不同子域名不同服务器。chat.example.com 为前端，api.example.com 为后端。为 example.com 配置了两个 A 记录，分别指向两台单独的服务器

B：不同子域名相同服务器。chat.example.com 为前端，api.example.com 为后端。为 example.com 配置了两个 A 记录，但是指向同一个服务器。

C：同域名。www.example.com 为前端，www.example.com/api 为后端。

首先，就是我们这里都是 https 服务，不管是前端还是后端，你的 https 服务都默认走 443 端口的。

1、你访问 chat.example.com

这里前端服务器本身就有一个 nginx 服务在跑，它监听 443

nginx 会把前端打包好的静态资源给你

这个界面 html 里包含一些已经写好的 js 函数，比如 fetch("https://api.example.com/user/profile")

2、你点击了发送消息

前端界面里的 js 函数被触发，js 代码代你去访问 api.example.com/v1 去问问题，此时，一个新的请求产生

3、

你通过 api.example.com 请求数据，这个虽然是后端请求，但是**它也是运行在 https 上**的，所以你本质上要访问某个服务器的 443 端口

4、

你去 DNS 服务器找这个 api.example.com 的 ip，假设根本没有 CDN，那么又是同一个 ip/不同 ip 给你

5、你构建一个 https 请求，又打到了某个服务器的 443

6、这个服务器里有一个 Nginx 程序，做反向代理。在 linux 里，监听 1024 以下端口需要 root，它把 443 端口的流量转发到**本机 8000**

7、你的后端程序 FASTAPI 等等跑在 8000 端口上监听，只接受本地连接。只负责拆解请求行，不管到底是哪个 ip 来的

8、补充：Nginx 在 443 上也可以拆分 https 请求行，把不同的 v1 v2 转发到不同程序上

也就是说，不管你后端是前面三种的那一种，基本上都是你的后端请求打到 443，然后 nginx 根据 URL，转移到真正在本地监听 8000 端口的后端服务上。

就是，这个事情，和 api.example.com 是否可以直接被你用 curl 构造一个请求来用，是独立的。

你 curl 后端，也是访问到 nginx，nginx 代你访问