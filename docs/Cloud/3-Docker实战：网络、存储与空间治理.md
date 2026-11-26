# Docker 实战：网络、存储与空间治理

理解了容器底层的 Namespace、Cgroups 和 OverlayFS 之后，真正在日常工作与服务器上把 Docker 用稳，核心要解决的其实只有四个工程问题：
1. **生命周期**：容器的主进程退出、容器停止、容器被删除到底是哪三个阶段？
2. **数据持久化**：镜像层是只读的，容器删掉后可写层也会跟着灰飞烟灭，数据库和配置到底该怎么存？（Named Volumes vs Bind Mounts）
3. **网络与多容器编排**：容器里面的端口怎么暴露出来？Docker Compose 里的多个容器怎么通过服务名互相访问？
4. **磁盘空间治理**：为什么用了一段时间后，`/var/lib/docker` 会悄无声息地膨胀到 100GB+ 甚至塞爆系统盘？如何排查与根治？

---

## 一、容器生命周期与高频命令心智模型

初学者最容易混淆“启动命令”和“容器状态”，导致在机器上留下一大堆处于 `Exited` 状态的僵尸容器，或者每次重启容器发现配置又丢了。

### 1. 分清容器生命周期的三个阶段

当你运行一个容器时，一定要在脑海里区分以下三件事：

```text
[镜像 Image (只读模板)]
  --> (执行 docker run：套上新的容器可写层 + 启动内部 PID 1 进程)
[阶段 1：运行中 Running]   (docker exec 只能在这个阶段进去执行附加命令)
  --> (容器内 PID 1 主进程自然结束 / 报错崩溃 / 手动执行了 docker stop)
[阶段 2：已停止 Exited]    (进程虽然停了，但容器本身还在！可写层、日志和元数据依然占着磁盘，此时 docker start 可原地唤醒)
  --> (手动执行 docker rm，或者最初 docker run 时带了 --rm 参数)
[阶段 3：彻底销毁 Removed] (容器的可写层与 JSON 日志被从磁盘上抹除)
```

理解了这三步，几组高频命令参数的组合就完全不需要死记硬背了：

- `docker run` vs `docker start` vs `docker exec`：
  - `docker run` = 新建一个全新的容器并启动。如果你连续敲三次 `docker run ubuntu`，宿主机上会多出三个完全独立的容器实例。
  - `docker start <容器名>` = 把一个已经存在、但处于 `Exited` 停止状态的旧容器重新唤醒（保留它之前在可写层里改过的文件）。
  - `docker exec -it <容器名> /bin/bash` = 在一个正在运行（`Running`）的容器内部，额外新开一个交互式终端进程。当你在这个终端里敲 `exit` 退出时，退出的只是你新开的这个附加 bash，容器原本的 PID 1 主进程完全不受影响，容器继续在后台跑。
- `-d` vs `-it` vs `--rm`：
  - `-d`（Detached）：后台守护模式运行，不占用你当前的命令行窗口，适合跑 Nginx、数据库、后端服务。
  - `-it`（Interactive + TTY）：给你分配一个伪终端并把当前输入输出绑到容器的 PID 1 上。注意：如果你用 `docker run -it ubuntu /bin/bash` 启动容器，此时这个 `/bin/bash` 本身就是容器的 PID 1 主进程！一旦你敲 `exit` 退出，PID 1 就结束了，容器当场进入 `Exited` 停止状态。
  - `--rm`：只要容器进入 `Exited` 停止状态，Docker 就自动替你执行 `docker rm` 把它连同可写层彻底删掉。因此，凡是临时跑一次脚本、进个环境测试一下，永远养成写 `docker run -it --rm ...` 的习惯，绝不留垃圾。

### 2. 日常确认服务状态的必要检查

在排查任何 Docker 报错前，先跑一条：

```bash
docker version
```

Docker 是典型的 C/S（客户端 / 服务端）架构：
- 如果输出里只有 `Client:`，下面报错 `Cannot connect to the Docker daemon at unix:///var/run/docker.sock`，说明后台的 `dockerd` 服务（或者 Mac/Windows 上的 Docker Desktop 虚拟机）根本没启动，或者当前用户没有访问 `docker.sock` 的权限；
- 查看容器列表时，永远用 `docker ps -a`（或 `docker container ls -a`）而不是只敲 `docker ps`。因为 `docker ps` 只显示正在 `Running` 的容器，那些由于配置错误一启动就崩溃退出的容器、或者以前遗留的几十个 `Exited` 容器，只有加了 `-a` 才能看到。

---

## 二、数据持久化：具名卷（Named Volumes）vs 绑定挂载（Bind Mounts）

既然容器一旦删除重建（升级镜像版本时必然要删旧容器、建新容器），它顶上的那层“容器可写层”就会彻底消失，那么所有需要长期保留的有状态数据（数据库文件、用户上传的文件、应用配置、持久日志）就绝对不能留在容器可写层里，必须通过挂载（Mount）保存在容器生命周期之外。

Docker 提供了两种主流的持久化流派，它们在底层其实都是“把宿主机（或 Docker 虚拟机）上的某个真实目录，通过 Linux Mount Namespace 映射进容器内部的指定路径”，但在管理权和迁移体验上截然不同：

| 对比维度 | 具名卷 (Named Volumes) | 绑定挂载 (Bind Mounts) |
| :--- | :--- | :--- |
| 命令行写法 | `docker run -v n8n_data:/home/node/.n8n ...`（冒号前是一个卷名称，不带 `/` 或 `./`） | `docker run -v ./data:/var/lib/mysql ...` 或 `-v /opt/app/data:/app/data`（冒号前是宿主机真实路径） |
| 物理文件到底存在哪？ | 由 Docker 统一接管，默认藏在 `/var/lib/docker/volumes/<卷名>/_data/` 目录下 | 就在你指定的宿主机目录下（如 `docker-compose.yml` 旁边的 `./data` 文件夹里），所见即所得 |
| 空目录首次挂载行为 | 自动初始化填充：如果具名卷是空的，而容器镜像的目标路径下本来有默认配置文件，Docker 会贴心地把镜像里的默认文件先拷进具名卷再挂载 | 直接强行覆盖遮蔽：只要你把宿主机的一个空目录 Bind Mount 进容器的 `/etc/nginx`，容器原本 `/etc/nginx` 下的所有默认文件瞬间被遮住看不见了，经常导致服务因找不到默认配置而启动失败 |
| Windows / macOS 性能 | 性能极高：因为具名卷直接存在 WSL2 / Mac 虚拟机的原生 Linux `ext4` 虚拟磁盘内部，不走跨系统文件共享协议 | 大量小文件 I/O 较慢：把 Windows (`C:\`) 或 macOS (`/Users/...`) 的宿主目录挂进虚拟机里的容器，需要走 9P / VirtioFS 跨系统文件桥接，跑 `npm install` 或高并发数据库时会有明显性能损耗 |
| 备份与迁移便利度 | 较隐蔽，在文件管理器里不能一眼看到，卸载项目时容易漏删在后台占空间 | 极其直观：整个项目的代码、`docker-compose.yml` 和挂载出来的 `./data` 都在同一个文件夹里，打包整个文件夹就能备份或搬家 |
| 典型开源项目偏好 | n8n、Portainer 等单容器开箱即用型工具喜欢用具名卷 | Milvus、Dify、自建业务服务等通常偏爱在 `docker-compose.yml` 同级目录下建 `./volumes/...` 做绑定挂载 |

### 警惕第三种隐藏形态：匿名卷（Anonymous Volumes）

为什么有时候你明明没配任何 `-v` 卷，跑了一段时间执行 `docker volume ls`，却看到满屏名字像 `f8a9c3e1b2...` 这样长达 64 位随机哈希的卷？

原因在于：有些官方镜像（比如 MySQL、PostgreSQL、Redis）的作者为了防止新手忘了挂卷就把数据写进容器可写层，会在镜像的 `Dockerfile` 里写上一句 `VOLUME ["/var/lib/postgresql/data"]`。
- 当你启动这类镜像又没有显式用具名卷或绑定挂载去接管那个路径时，Docker 就会自动为你创建一个随机哈希名字的匿名卷；
- **最坑的地方**：如果你是单容器 `docker run --rm`，容器退出时会自动顺手清理掉它创建的匿名卷；但如果你用的是 `docker compose`，执行 `docker compose down` 时默认不会删除卷，而下次 `docker compose up -d` 重建容器时，它往往又不会复用上一次的匿名卷，而是再新建一个 64 位哈希的匿名卷！久而久之，磁盘里就会堆满几百个失去了主人、却又占着几十 GB 空间的孤儿匿名卷。

工程铁律：在任何 `docker-compose.yml` 或长期运行的 `docker run` 中，一律显式使用具名卷或绑定挂载，绝不让容器退化出匿名卷。

### 容器日志的两种落盘路径

排查容器问题时，日志也分两条路：
1. **写到容器内部文件**（如 `/var/log/app/error.log`）：这种必须把该日志目录通过具名卷或 Bind Mount 挂出来，直接去宿主机对应目录里 `tail -f` 查看。
2. 直接打到标准输出（`stdout` / `stderr`，云原生推荐标准）：容器内程序直接往控制台 `print` 日志，由 Docker 的日志驱动（默认是 `json-file`）拦截并保存在宿主机的 `/var/lib/docker/containers/<容器ID>/<容器ID>-json.log` 中。此时直接用 `docker logs -f --tail 100 <容器名>` 即可实时追踪。

---

## 三、Docker 网络模型与端口转发真相

为什么容器启动后，里面明明提示 `Listening on 0.0.0.0:8080`，但在宿主机浏览器访问 `localhost:8080` 却打不开？

### 1. Bridge（网桥）与虚拟局域网的物理拓扑

正如上一篇所述，每个容器都运行在自己独立的 Network Namespace 里。在 Linux 宿主机上，Docker 默认通过软件虚拟交换机（Linux Bridge）把容器连成一张内部局域网：

```text
外部客户端 / 宿主机端口 (如 0.0.0.0:8090)
  --> 宿主机内核 iptables / nftables (DNAT 端口转发规则：把宿主机 8090 流量拐进 172.23.0.2:8080)
  --> Docker 虚拟网桥 br-xxxx (网关 IP: 172.23.0.1/16，充当虚拟二层交换机 + NAT 路由器)
        - veth pair 虚拟网线 1 --> 容器 A (web): 内部网卡 eth0 = 172.23.0.2，监听自身 8080 端口
        - veth pair 虚拟网线 2 --> 容器 B (redis): 内部网卡 eth0 = 172.23.0.3，监听自身 6379 端口
```

从这张图可以清晰推导出 Docker 网络的五个核心规则：

1. **容器永远只监听它自己内部的端口**：
   容器里的程序写 `listen 8080`，监听的是容器自己那块虚拟网卡（`172.23.0.2`）的 `8080` 端口，跟宿主机的 `8080` 端口没有任何关系。
2. `-p`（`ports`）与 `EXPOSE` 的本质区别：
   - `Dockerfile` 里的 `EXPOSE 8080` 或 Compose 里的 `expose: ["8080"]` 完全不会向宿主机开放任何端口！它只是一句文档声明（或者仅供处于同一张 Docker 虚拟局域网内的其他容器直接访问）。
   - 只有写了 `-p 8090:8080`（Compose 里的 `ports: ["8090:8080"]`），Docker 才会在宿主机上配置 `iptables` 转发规则或启动 `docker-proxy`：冒号左边永远是宿主机（外部），冒号右边永远是容器（内部），方向是从外往里拐（`宿主机 8090 --> 容器 8080`）。
   - **安全技巧**：如果你在带有公网 IP 的云服务器上跑了一个 MySQL 容器，或者跑了一个只希望给本机 Nginx 反向代理调用的后端容器，千万不要直接写 `-p 3306:3306`！因为 Docker 修改的是内核 `iptables` 的 `PREROUTING/DOCKER` 链，这会直接绕过你服务器上配的 `ufw` 防火墙，把 3306 端口裸露到全网！如果只需要本机宿主机进程（如本机 Nginx）访问该容器，务必绑定回环地址：`-p 127.0.0.1:8090:8080`。
3. 每个 Compose 项目的独立子网与内置微型 DNS：
   每当你启动一个 `docker-compose.yml` 项目，Docker 都会自动为这个项目单独新建一个 `br-xxxx` 虚拟网桥，并从 `172.17.0.0/12` 或 `192.168.0.0/16` 里挑一个不冲突的网段划给它。
   - **容器间通信绝不需要写死 IP**：同一个 Compose 网络内部自带了一个内嵌 DNS 服务器（`127.0.0.11`）。后端容器 `web` 想要连接数据库容器 `redis`，在配置文件里直接写主机名 `redis:6379` 即可，Docker 内置 DNS 会自动把服务名 `redis` 解析成它当前的容器内网 IP（如 `172.23.0.3`）。
   - 不同 Compose 项目由于挂在不同的 `br-xxxx` 网桥上，默认互相网络隔离；容器主动上外网（如 `curl https://api.openai.com`）则由网桥通过宿主机的 NAT 伪装（Masquerade）直接出站，因此容器默认总能访问外网。
4. Tailscale 等 P2P 组网与 Docker 网桥的小摩擦：
   因为每个 Compose 项目都会在宿主机上多建一块 `br-xxxx` 虚拟网卡并占一个 `172.x.0.1` 的 IP，像 Tailscale 这类组网工具在尝试收集本机所有网卡 IP 建立 P2P 直连时，也会把这些根本无法从外部访问的 Docker 网桥 IP 一并上报给对端去尝试握手（虽然最终会挑出真实可达的路径，但在查看网卡列表和路由表时要注意区分这些 `br-xxxx` 和 `vethxxxx` 虚拟接口）。
5. 什么时候用 `--network host`（主机网络模式）？
   在 Linux 宿主机上（注：Mac/Windows 的 Docker Desktop 因为隔了一层虚拟机，不支持原汁原味的 Host 网络），如果给容器加上 `--network host`，Docker 就不再为它创建独立的 Network Namespace，容器直接共享宿主机的真实网卡和端口。容器里监听 `8080`，宿主机上就占用了 `8080`。这省去了 NAT 端口转发的性能损耗，常用于对网络吞吐极敏感的服务或需要管理宿主机网络的工具。

---

## 四、Docker Compose：单机多容器编排的完整法则

在实际工程和开源项目（如 Dify、Milvus、GitLab）中，很少有软件只靠单打独斗的一个容器就能跑起来——往往是一个前端容器 + 一个后端 API 容器 + 一个 PostgreSQL 容器 + 一个 Redis 容器 + 一个向量数据库容器。

如果手写 5 条 `docker run` 命令，不仅每次启动要自己按顺序建网络、挂卷、传几十个环境变量，关闭时还要挨个杀。Docker Compose 就是用一份声明式的 `docker-compose.yml`（或 `compose.yaml`）把这一整套多容器应用的拓扑一次性定义清楚。

### 1. 什么是“服务（Service）”？

在 Compose 和 Kubernetes 的语境里，服务（Service）不是容器本身，而是对一类容器的声明式图纸：
- 你在 `docker-compose.yml` 的 `services:` 下面写的每一个条目（比如 `db:`、`api:`、`nginx:`），都是在声明：“我期望系统里运行着这样一个角色，它使用哪个镜像、映射什么端口、挂哪个目录、崩溃后怎么自动重启”。
- **容器（Container）** 则是编排引擎照着这份“服务图纸”真正创建出来的运行实例。

### 2. 经典灵魂拷问：为什么我把存放 `docker-compose.yml` 的 Git 仓库文件夹都删了，容器居然还在跑，甚至重启电脑后自己又起来了？

这是刚用 Docker Compose 时最容易觉得“闹鬼”的现象，用建筑工程打个比方就瞬间通透了：
- `docker-compose.yml` 只是一张放在你桌上的“建筑施工图纸”；
- 当你在该目录下敲下 `docker compose up -d` 时，`docker compose` 命令行工具读取了这张图纸，转换成 API 指令发给后台的 `dockerd` 守护进程；
- `dockerd` 按照图纸把真正的“大楼”（容器、虚拟网桥、具名卷）在 `/var/lib/docker`（或 Docker Desktop 的 `.vhdx` 虚拟硬盘）里盖好了，并且如果图纸里写了 `restart: always` 或 `restart: unless-stopped`，这个“开机自启策略”已经被直接写进了 `/var/lib/docker/containers/<ID>/hostconfig.json` 元数据里！
- 大楼盖好之后，你把桌上的纸质图纸（Git 仓库目录里的 `docker-compose.yml`）撕了扔进垃圾桶，盖好的大楼当然不会塌；下次电脑开机，`dockerd` 守护进程一启动，读取自己 `/var/lib/docker` 下记录了 `restart: always` 的容器，不需要任何 `.yml` 文件就能直接把它们全部重新拉起来！

那万一忘了某个正在跑的 Compose 项目当初是从电脑哪个目录里的 `yml` 启动的，怎么找回来？

因为 `docker compose up` 创建容器时，会自动往每个容器身上打一组隐藏的 Labels（标签），记录它属于哪个项目、当时的 `yml` 文件绝对路径在哪。因此：
1. 在 Docker Desktop GUI 里，直接点开该容器的 `Inspect` 面板就能看到 `com.docker.compose.project.working_dir`；
2. 在 Linux 终端里，根本不需要去找当时的 `yml` 文件，直接运行：

```bash
# 列出当前机器上所有由 Compose 启动的项目名、状态以及它当初对应的 yml 配置文件绝对路径！
docker compose ls -a
```

而且，当你想要彻底停掉并销毁某个 Compose 项目时，即使当时的 `yml` 文件已经被你删了，也完全不需要找回 `yml`，直接在任意目录下按项目名（Project Name）关闭即可：

```bash
# 直接按项目名停止并删除该项目下的所有容器与虚拟网桥（不需要当前目录下有 docker-compose.yml）
docker compose -p <项目名> down

# 如果想连同该项目关联的具名存储卷（数据库数据）也一并彻底清空，加上 -v
docker compose -p <项目名> down -v
```

### 3. Compose 项目名（Project Name）的决定优先级

既然所有的容器命名（`<项目名>-<服务名>-1`）、具名卷命名（`<项目名>_<卷名>`）和虚拟网络命名都以“项目名”为前缀，那项目名到底是怎么定的？按优先级从高到低依次为：
1. 命令行显式传入 `-p / --project-name`（如 `docker compose -p my_app up -d`）；
2. 环境变量 `COMPOSE_PROJECT_NAME`（或在同级 `.env` 文件里定义了该变量）；
3. `docker-compose.yml` 文件顶层写的 `name: my_app` 字段；
4. 以上都没有时，默认取 `docker-compose.yml` 所在文件夹的名字（自动转小写）。
   - **注意**：如果你把两个不同项目的文件夹都起名叫 `deploy/`，又没在 `yml` 顶层写 `name:`，那启动第二个项目时，它的项目名也叫 `deploy`，就会直接把第一个项目的容器当成同名项目覆盖或冲突！因此，自己写 `docker-compose.yml` 时，最好在第一行显式写上 `name: xxx`。

### 4. 为什么 `docker compose ls` 显示 `exited(2), running(7)` 往往也是完全正常的？

在部署大型开源项目（如 Dify、Milvus、Sentry）时，经常看到一组 9 个容器里，有 7 个是 `Running`，却有 2 个变成了 `Exited (0)`。
- 不要慌张去重启那两个 `Exited` 容器。先看它的退出码：如果是 `Exited (0)`，在 Unix 世界里 `0` 代表“任务圆满完成并正常退出”。
- 这类容器通常是项目的 一次性初始化容器（Init Containers）——比如专门负责在启动时自动执行数据库表结构迁移（`alembic upgrade head`）、创建初始 MinIO 存储桶或修改目录权限。它们干完活本来就应该功成身退，只要主服务容器是 `Running` 且退出码为 `0`，整个系统就是完全健康的。

---

## 五、Docker 空间暴涨（100GB+）的深度解剖与治理实战

几乎每个重度使用 Docker 的开发者或服务器运维，都会经历一次这样的噩梦：系统根分区 `/` 突然报警 100% 满载，一查 `/var/lib/docker`（或 `/var/lib/containerd`）竟然占了 100 多 GB、里面塞了 350 多万个零碎小文件！

### 1. 先搞懂 `/var/lib/docker` 和 `/var/lib/containerd` 各自存了什么

还记得上一篇讲的调用链吗？

```text
docker CLI
  --> dockerd      (配置文件：/etc/docker/daemon.json，默认数据目录：/var/lib/docker)
  --> containerd   (配置文件：/etc/containerd/config.toml，默认数据目录：/var/lib/containerd)
  --> runc
```

这两个目录各自管着不同的家当：
- `/var/lib/docker`（由 `daemon.json` 的 `"data-root"` 控制，通常是膨胀的绝对主力）：
  1. `overlay2/`：所有镜像解压后的只读层 + 所有容器的顶层可写层（几百万个零碎小文件就在这里）；
  2. `volumes/`：所有具名卷和孤儿匿名卷的真实持久化数据；
  3. `containers/`：注意，这里存的不是容器的文件系统，而是每个容器的元数据 JSON 和 **默认永不封顶的 `*-json.log` 标准输出日志文件**（有的容器狂打日志，单一个 `.log` 文件就能长到 40GB！）；
  4. `buildkit/`：`docker build` 过程中攒下的海量编译构建缓存。
- `/var/lib/containerd`（由 `/etc/containerd/config.toml` 的 `root` 字段控制）：
  负责存储拉取下来的原始压缩态镜像块（Content Store）、镜像展开快照以及容器运行时状态。特别注意：如果你的机器上除了跑 Docker，还在本机跑了 K3s / Kubernetes（它们直接调 `containerd` 而不走 `dockerd`），或者开启了 Docker 的 containerd 镜像存储特性，那么数据就会大量写进 `/var/lib/containerd`！

### 2. 第一步：一眼看穿到底是谁吃掉了 100GB

不要盲目去删目录，直接跑 Docker 内置的空间审计命令：

```bash
# 查看四大块（Images 镜像、Containers 容器可写层、Local Volumes 数据卷、Build Cache 构建缓存）的宏观占比与可回收空间 (RECLAIMABLE)
docker system df

# 加上 -v 查看每一个具体镜像、具体容器、具体卷到底占了多少 MB/GB
docker system df -v
```

在 99% 的真实案例中，吃光 100GB 磁盘的罪魁祸首无外乎以下 四大元凶：

#### 元凶 1：大量 `Exited` 停止态容器“锁死”了陈旧的历史镜像
- 你习惯只看 `docker ps`，以为没几个容器在跑；其实 `docker ps -a` 里躺着几十个半年前跑完没加 `--rm` 的 `Exited` 容器。
- 因为这些停止的容器还挂在那些老版本的镜像只读层之上，导致你清理旧镜像时 Docker 报错“镜像正在被某停止的容器使用”，几十个 GB 的历史旧镜像层就这么被死死锁在磁盘里。
- **清理命令**：`docker container prune`（一键删掉所有处于停止状态的容器），然后再跑 `docker image prune -a`（删掉所有当前没有任何容器在使用的悬空与闲置镜像）。

#### 元凶 2：堆积如山的孤儿匿名卷（Anonymous Volumes）
- 如前文所述，多次 `docker compose down` + `up` 或裸跑未指定具名卷的数据库容器后，`volumes/` 下会残留几十个 64 位随机哈希的孤儿卷。而且为了防止误删用户数据，`docker system prune` 默认绝不会动任何 Volume！
- **清理命令**：先用 `docker volume ls` 检查确认有用的卷都有明确的名字，然后执行 `docker volume prune` 清理未被任何容器引用的孤儿匿名卷。

#### 元凶 3：失控的 BuildKit 构建缓存（Build Cache）
- 只要你在机器上频繁构建包含 C++ Boost、Bazel 缓存、Rust `target`、Python PyTorch 或 Node `node_modules` 的镜像，即使旧镜像删了，BuildKit 为了加速下次构建，依然会在 `buildkit/` 下保留几十 GB 的中间编译层缓存。
- **清理命令**：`docker builder prune -a`（一键清空所有构建缓存）。

#### 元凶 4：未配置轮转的 `*-json.log` 容器日志
- 默认情况下，Docker 的 `json-file` 日志驱动没有大小上限。一个跑了半年的业务容器如果不断往控制台打 debug 日志，对应的 `/var/lib/docker/containers/<ID>/<ID>-json.log` 可以膨胀到几十 GB。

### 3. 治本之道：把数据目录迁移到大容量数据盘 + 配置全局防爆护栏

如果服务器的系统盘（`/`）只有 50GB，而挂载的数据盘（如 `/data`）有 2TB，最彻底的方案是在装好 Docker 后，修改配置文件把整个家当挪到 `/data` 下，并同时锁死日志和构建缓存的上限。

#### （1）配置并迁移 `dockerd`（`/etc/docker/daemon.json`）

```bash
# 1. 停止 Docker 服务
sudo systemctl stop docker docker.socket

# 2. 用 rsync 保留完整权限与软硬链接，把原目录无损同步到数据盘
sudo mkdir -p /data/docker
sudo rsync -aHAXxSP /var/lib/docker/ /data/docker/
```

编辑 `/etc/docker/daemon.json`（一次性配好新路径、日志自动轮转上限、以及 BuildKit 缓存自动垃圾回收上限）：

```json
{
  "data-root": "/data/docker",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  },
  "builder": {
    "gc": {
      "enabled": true,
      "defaultKeepStorage": "20GB"
    }
  }
}
```

#### （2）同步迁移 `containerd`（`/etc/containerd/config.toml`）

```bash
sudo systemctl stop containerd
sudo mkdir -p /data/containerd
sudo rsync -aHAXxSP /var/lib/containerd/ /data/containerd/
```

编辑 `/etc/containerd/config.toml`（若文件为空可先通过 `containerd config default | sudo tee /etc/containerd/config.toml` 生成默认配置），将顶层的 `root` 字段修改为：

```toml
root = "/data/containerd"
```

最后重启服务并确认新路径生效后，即可安全删掉 `/var/lib/docker` 和 `/var/lib/containerd` 释放系统盘：

```bash
sudo systemctl start containerd docker
docker info | grep "Docker Root Dir"
```

---

## 六、个人电脑 vs 服务器：在本地用 Docker 的边界与思考

Docker 和 Docker Compose 本质上是一套为 Linux 服务器 24 小时常驻部署而设计的运维范式。当越来越多的开源项目（尤其是 AI 时代的 WebUI、工作流引擎、向量数据库）为了省去写跨平台桌面安装包和环境适配文档的麻烦，在 README 里直接丢一句“请用户自己在电脑上 `docker compose up -d`”时，其实就是把环境复杂度从项目作者转移到了用户的个人电脑上。

在自己的日常主力笔记本（macOS 或 Windows）上跑这类服务器向的 Compose 项目，如果不加约束，很容易遇到五个典型的水土不服：

1. **生命周期失控（关不掉的后台吃资源大户）**：
   桌面 GUI 软件是你点叉关闭窗口，进程就死了；而很多开源项目的 `docker-compose.yml` 里全写着 `restart: always`。你测试完玩了半小时以为结束了，结果每次电脑开机、或者笔记本从睡眠中唤醒，后台隐藏的 Linux 虚拟机就自动拉起十几个 Redis、PostgreSQL、Milvus、Celery 容器，风扇狂转、内存瞬间少掉 8GB（Windows 的 WSL2 在睡眠唤醒后还偶发 VM 跑满全核的 Bug）。
2. **数据归属黑盒化（卸载如同猜谜）**：
   普通软件卸载只要删掉应用目录；而跑过一堆 Compose 项目后，它产生的数据到底是在容器可写层里、在具名卷里、在某个仓库的 Bind Mount 子目录里，还是烂在了 Docker Desktop 那个几十 GB 且不会自动缩容的 `Docker.raw / docker_data.vhdx` 虚拟磁盘文件里？
3. **入口散乱**：
   如果你在 `~/Downloads/test1`、`~/Documents/proj2`、`/tmp/demo3` 各跑过一次 `docker compose up -d`，过两个月你自己都记不清电脑上到底有哪些目录绑定了正在跑的容器。
4. 填平了环境依赖，不等于提高了软件本身的代码质量：
   Docker 只能保证“程序在作者指定的库版本下能启动”，但如果那个开源项目本身写得极其粗糙（例如某些重型组件在空载时依然死循环轮询吃 CPU、内存泄漏假死），套上容器外壳一样会假死。

### 在个人电脑上健康使用 Docker 的四条守则

为了既享受容器隔离环境的便利，又不让个人电脑沦为混乱的服务器垃圾场，可以建立一套非常清爽的本地习惯：

1. 所有长期自用的 `docker-compose.yml` 集中收口到同一个目录：
   比如在电脑上专门建一个 `~/docker-services/<项目名>/docker-compose.yml`，所有挂载数据一律改成该目录下的相对路径 Bind Mount（如 `./data:/var/lib/postgresql/data`）。这样不仅所见即所得，哪天不想用了，直接 `docker compose down -v` 再 `rm -rf` 这个子文件夹，就 100% 卸载得干干净净。
2. 在个人电脑上，把第三方 `yml` 里的 `restart: always` 全删掉（或改为 `no`）：
   个人电脑上的工具应该是“我用的时候手动 `up -d` 拉起，不用的时候它绝不能随开机自启”。
3. **单容器临时测试永远带 `--rm`**：
   随手测试或让 AI 跑一次性容器任务时，强制加上 `--rm`，退出即焚。
4. AI 时代的本地环境分工（最小宿主环境 + 容器兜底）：
   以前为了防止本地不同项目的 Node 或 Python 版本冲突，往往要在宿主机上折腾复杂的版本切换器；但在 AI Agent 辅助编程时代，宿主机其实只需要用 `uv`、`node` 原生安装的 `rust / go` 保持一套干净精简的主力命令行工具链，供你和 AI 随手秒级运行本地脚本即可；真正遇到依赖极其古怪、或者需要一整套异构中间件的老旧仓库，再把它关进独立的 Docker 容器里跑，实现宿主机清爽与环境兼容的最佳平衡。
