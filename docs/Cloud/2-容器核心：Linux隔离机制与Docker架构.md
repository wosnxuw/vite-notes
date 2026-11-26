# 容器核心：Linux隔离机制与Docker架构

初学者接触 Docker 和 Kubernetes 时，最容易产生的两个误解是：
1. 把容器当成“一种特别轻量的虚拟机”；
2. 觉得 Docker 是一个黑盒巨石软件，分不清 `dockerd`、`containerd`、`runc` 和 Kubernetes 之间到底谁调用谁。

如果从 Linux 内核视角看过去，真相只有一个：Linux 系统里根本不存在一种叫“容器”的特殊内核对象。所谓的容器，100% 就是宿主机上的一个普通进程——只不过内核在启动这个进程时，用 Namespace（命名空间） 蒙住了它的眼睛（让它以为自己独占一台机器），用 Cgroups（控制组） 捆住了它的手脚（限制它能吃多少 CPU 和内存），再用 OverlayFS（联合文件系统） 给它垫了一层只读的目录树（让它以为自己拥有一整套 Ubuntu 或 Alpine 的根目录）。

把这三块内核积木和容器运行时的调用链彻底拆开，后续无论是看 Docker 还是看 Kubernetes，都不会再有任何神秘感。

---

## 一、容器要解决的真正痛点：为什么虚拟机的粒度还是太重？

在容器普及之前，部署一个 Python 或 C++ 服务只有两条路：
- **直接在物理机 / 云主机上裸跑**：A 服务依赖 Python 3.8 和 OpenSSL 1.1，B 服务依赖 Python 3.12 和 OpenSSL 3.0；加上系统的 `glibc` 版本、环境变量、全局配置文件互相污染，经常出现“在我电脑上明明能跑，发到服务器上就报动态库缺失”的灾难。
- **每个服务发一台独立虚拟机**：环境确实隔离了，但为了跑一个内存占用只有 50MB 的 Web 进程，却要连带启动一整套 Guest OS 内核、分配几 GB 的独占内存和几十 GB 的虚拟磁盘，开机还要花几十秒。

容器的核心思路：既然大家的程序最终都是要向 Linux 内核发起系统调用，那完全没必要为每个程序单独启动一个 Linux 内核。所有程序直接共用宿主机的同一个 Linux 内核，只把“程序本身 + 它依赖的所有动态库（如特定版本的 `glibc`、Python 解释器、配置文件）”打包成一个不可变的文件夹（容器镜像），在宿主机内核上用隔离机制跑起来即可。

由此带来的直接结果：
- **启动时间等于进程启动时间**（毫秒级，不需要走 BIOS/UEFI 和内核引导）；
- **零额外内核内存开销**（几百个容器共享宿主机同一份内核内存）；
- **跨机器 100% 环境一致**（只要宿主机是现代 Linux 内核，不管宿主机发行版是 Ubuntu、Debian 还是 Rocky Linux，容器里面看到的永远是打包进镜像的那套用户态环境）。

> 安全边界提示：正因为所有容器共享同一个宿主机 Linux 内核，容器的隔离强度天然弱于硬件虚拟机。如果在容器里通过 `insmod` 加载内核模块、修改 `/proc/sys` 全局内核参数，或者触发了内核提权漏洞，影响的是整台宿主机上的所有容器。

---

## 二、Linux 容器的三大内核基石：Namespace、Cgroups 与 OverlayFS

Docker 自身并没有发明任何底层隔离技术，它更像是一个把 Linux 内核早已存在的三大能力优雅组装起来的“前端编排外壳”。

### 1. 文件系统视角起点：从 `chroot` 到 Pivot Root

最原始的目录隔离叫 `chroot`（Change Root）：通过一个系统调用，告诉某个进程“从现在起，把宿主机上的 `/var/lib/containers/app1/rootfs` 目录当成你的根目录 `/`”。
- 该进程在里面访问 `/usr/bin/python`，实际读取的是宿主机上的 `/var/lib/containers/app1/rootfs/usr/bin/python`。
- 现代容器在此基础上改用了更安全的 `pivot_root` 配合下文的 Mount Namespace，将整个挂载树与宿主机彻底脱钩。

### 2. Namespace（命名空间）—— 决定进程“能看见什么”

如果只改了根目录，进程去读进程表（`ps aux`）还是能看到宿主机上所有的进程，甚至能调用 `kill` 把宿主机的其他服务杀掉；去绑 `80` 端口还是会和宿主机冲突。

为此，Linux 内核提供了 Namespace（通过 `clone()` 系统调用创建进程时传入对应标志位），把原本全局共享的内核资源切分成一个个独立的视图：

| Namespace 类型 | 内核标志位 | 隔离了什么视图？ | 容器内的直观表现 |
| :--- | :--- | :--- | :--- |
| PID | `CLONE_NEWPID` | 进程 ID 编号空间 | 容器内启动的第一个业务进程（如 `nginx` 或 `python`）在容器里看自己的 PID 永远是 1；而在宿主机上用 `ps` 看，它其实是一个 PID 为 `28491` 的普通进程（同一个进程在不同层级拥有多个 PID） |
| Network | `CLONE_NEWNET` | 网卡设备、IP 地址、路由表、端口列表、`iptables` 规则 | 每个容器拥有自己独立的 `lo` 回环网卡、`eth0` 虚拟网卡和 `0~65535` 全套端口。10 个容器可以在各自内部同时监听 `80` 端口而互不冲突 |
| Mount | `CLONE_NEWNS` | 文件系统挂载点列表 | 容器内部挂载或卸载目录，宿主机和其他容器完全看不见 |
| UTS | `CLONE_NEWUTS` | 主机名（Hostname）与域名 | 每个容器可以有自己独立的 `hostname`（默认是容器 ID 的前 12 位） |
| IPC | `CLONE_NEWIPC` | 进程间通信（信号量、消息队列、共享内存段） | 不同容器的进程无法通过 System V IPC 或 POSIX 消息队列直接串门 |
| User | `CLONE_NEWUSER` | 用户 ID（UID）与组 ID（GID）映射 | 允许将容器内的 `root (UID 0)` 映射为宿主机上的普通非特权用户（如 `UID 100000`），防止容器逃逸后直接拿到宿主机真 root 权限（Rootless 容器的基础） |
| Cgroup | `CLONE_NEWCGROUP` | 控制组目录视图 | 容器内查看 `/proc/self/cgroup` 时只看到自己的相对根路径，不会暴露宿主机的完整 Cgroup 树 |

> 为什么说“容器的生命周期就等于它内部 PID 1 进程的生命周期”？
> 在传统 Linux 里，PID 1 是 `systemd` 守护进程；而在容器的 PID Namespace 里，你在 `Dockerfile` 的 `CMD` / `ENTRYPOINT` 里写的那条命令就是 PID 1。一旦这个 PID 1 进程执行完毕退出（或者崩溃），内核就会立刻销毁该 PID Namespace 下的所有子进程，容器随即进入 `Exited`（停止）状态。这也是为什么容器里的主程序必须在前台常驻运行（如 `nginx -g "daemon off;"`），绝不能用后台守护模式启动——如果主命令一fork完就退出了，容器在 1 毫秒内就会当场结束。

### 3. Cgroups（Control Groups）—— 决定进程“最多能用多少资源”

Namespace 解决了“看不见别人”的问题，但没解决“一人吃光全机资源”的问题：如果某个容器里的代码写出了死循环或内存泄漏，它会瞬间把宿主机的所有 CPU 核心跑满、把物理内存吃光，导致整台机器死机。

Cgroups（控制组） 是 Linux 内核提供的硬件资源配额与记账机制。内核把它暴露为一个位于 `/sys/fs/cgroup/` 下的虚拟文件系统：
- 每当 Docker 启动一个容器，就会在 `/sys/fs/cgroup/` 下为该容器新建一个子目录，并把容器进程的宿主机 PID 写进该目录的 `cgroup.procs` 文件里；
- 想要限制这个容器最多只能用 2 核 CPU 和 512MB 内存，本质上就是往该目录下的控制文件（如 `cpu.max`、`memory.max`）里写入对应的数字：
  - 当容器试图申请超过 `memory.max` 的内存时，内核的内存回收或 OOM Killer（Out-Of-Memory Killer） 就会直接在容器边界内介入，把该容器进程精准杀死（退出码通常为 `137`，即 `128 + 9 (SIGKILL)`），而宿主机和其他容器毫发无损。

### 4. OverlayFS（联合文件系统）—— 镜像分层与写时复制（CoW）

如果我在宿主机上用同一个 `ubuntu:24.04` 镜像（假设 80MB）启动了 50 个容器，难道磁盘上要把这 80MB 的系统文件复制 50 份吗？

完全不需要。Docker 使用了 Linux 内核的 OverlayFS（特别是 `overlay2` 存储驱动），把文件系统拆成了“底层多级只读层 + 顶层单级可写层”，像透明胶片一样叠在一起展示给容器：

```text
容器进程看到的统一根目录视图 (MergedDir / 合并挂载视图)
  --> 顶层：容器可写层 (UpperDir / Container Layer，随容器创建而生成，随容器删除而销毁)
  --> 底层：镜像只读层 (LowerDir / Image Layers，所有基于该镜像的容器全局共享同一份物理文件)
        - Layer 3 (只读): COPY ./app /app            [sha256: 9f8e...]
        - Layer 2 (只读): RUN apt-get install python3 [sha256: 3c2b...]
        - Layer 1 (只读): FROM ubuntu:24.04 基础层     [sha256: 7a1d...]
```

这套结构解释了 Docker 最核心的四个行为特征：

1. 镜像（Image） vs 容器（Container）的本质区别：
   - **镜像**就是底下那几层完全不可修改的只读层（`LowerDir`），类似于硬盘上的静态可执行程序模板；
   - **容器**就是在镜像顶上新盖了一层薄薄的可写层（`UpperDir`），并在其上拉起隔离进程。
2. **跨镜像的层复用机制**：
   `Dockerfile` 里的每一条指令（`FROM`、`RUN`、`COPY`）都会构建出一个新的只读层，并按内容算出唯一的 SHA256 哈希。如果你拉取了 10 个不同的开源项目镜像，只要它们底层的第一层都是 `ubuntu:24.04`，Docker 在宿主机磁盘上只会下载并保存 1 份 `ubuntu:24.04` 的基础层。
3. 写时复制（Copy-on-Write, CoW）与 Whiteout 删除：
   - **读文件**：容器直接穿透去读底下的只读层，零拷贝；
   - **改文件**：当容器试图修改底层只读镜像里的 `/etc/hosts` 或某个配置时，底层只读层绝不会被改动；OverlayFS 会先把该文件从只读层复制一份到顶部的容器可写层（`UpperDir`），所有修改都发生在这份副本上，并遮盖住底下的原文件；
   - **删文件**：当容器删除底层只读层里的某个文件时，底层同样不会动，只会在顶层可写层创建一个特殊的“遮罩标记文件（Whiteout）”，让合并视图隐藏该文件。（这也是为什么在 `Dockerfile` 里，如果第一行 `RUN` 下载了一个 1GB 的安装包，第二行 `RUN rm` 把它删掉，最终构建出来的镜像体积依然会白白多出 1GB——因为第一层已经是不可变的只读层了，第二层的 `rm` 只是打了个隐藏标记！下载、解压、安装和清理缓存必须在同一个 `RUN` 指令里用 `&&` 串起来在同一层内完成。）
4. 容器停止（`stop`）与容器删除（`rm`）的区别：
   只要容器只是停止（`Exited`）而没有被 `docker rm` 删掉，它顶上的那层容器可写层（`UpperDir`） 就一直保留在宿主机磁盘上，下次 `docker start` 启动该容器时，你在里面改过的文件还在；一旦执行 `docker rm`（或启动时带了 `--rm`），这层可写层就会被彻底清空。

---

## 三、现代容器运行时调用链：`docker`、`containerd` 与 `runc`

早期的 Docker Engine 是一个包揽一切的巨石守护进程（`dockerd`）。后来为了推动标准化（OCI, Open Container Initiative）并让 Kubernetes 不必绑死在庞大的 Docker 之上，Docker 把底层的核心运行时一层层剥离并捐献给了 CNCF（云原生计算基金会）。

今天当你在终端敲下一行 `docker run` 时，底层的真实进程调用链是这样的：

```text
1. docker CLI (命令行客户端，无状态，只负责把你的命令转成 REST API 请求发给 unix:///var/run/docker.sock)
     --> 2. dockerd (Docker 守护进程：管镜像构建 BuildKit、Docker 网络网桥、存储卷 Volume、Compose 编排)
           --> 3. containerd (工业级核心容器运行时守护进程：管镜像拉取/解压、管理容器生命周期，通过 gRPC 提供 CRI 接口)
                 --> 4. containerd-shim (每个运行中的容器对应一个轻量垫片进程：作为容器的父进程，接管 stdio 流与退出状态)
                       --> 5. runc (OCI 底层命令行工具：调 Linux 内核创建 Namespace/Cgroup，拉起容器 PID 1 进程后，runc 自己当场退出！)
                             --> 6. 容器业务进程 (如 nginx / python)
```

把这五个角色拆开看，很多运维现象就一目了然了：

1. 为什么 `runc` 启动完容器自己就退出了，中间还要多一个 `containerd-shim`？
   - `runc` 只是一个一次性的命令行启动器：它读入容器配置（`config.json`）和根文件系统，调 Linux 内核建好 Namespace 和 Cgroup，把你的业务进程 fork 出来之后，`runc` 的使命就完成了，它会立刻退出。
   - `runc` 退出后，由极轻量的 `containerd-shim` 接手成为容器业务进程的父进程（负责收集容器的 `stdout/stderr` 标准输出日志、向 `containerd` 汇报容器退出码）。
   - 最大好处（Daemonless Containers）：正因为有 `shim` 顶着，哪怕你在宿主机上重启了 `dockerd` 甚至升级重启了 `containerd`，正在跑的业务容器进程也不会被连带杀死！
2. 为什么人们常说“`dockerd` 长期以 root 权限常驻有安全隐患”，以及 Podman 是怎么替代它的？
   - 传统架构下，`docker CLI` 只是一个发请求的薄壳，真正干活的是后台以 `root` 权限常驻的 `dockerd`。任何被加入 `docker` 用户组的普通 Linux 用户（能读写 `/var/run/docker.sock`），实际上都等价于拥有了宿主机的无密码 `root` 权限（只需跑一句 `docker run -v /:/host -it ubuntu chroot /host` 就能直接改写宿主机上的任何系统文件）。
   - **Podman** 则彻底砍掉了常驻的 `dockerd` 守护进程，直接由命令行调用底层 OCI 运行时（如 `crun` / `runc`），并原生主推基于 User Namespace 的 Rootless（无根）容器，命令行语法与 `docker` 100% 兼容（甚至可以直接 `alias docker=podman`）。
3. 为什么现代 Kubernetes（1.24+）弃用了 Docker（Dockershim），却依然能直接跑 Docker 构建出来的镜像？
   - Kubernetes 并不需要 `dockerd` 提供的单机网桥、Docker Volume 或 `docker build` 功能，它只需要一个能拉取镜像并调用 `runc` 跑起容器的底层运行时。
   - 以前 K8s 的调用链是：`kubelet --> dockershim --> dockerd --> containerd --> runc`，中间的 `dockerd` 完全是个多余的二道贩子；
   - 现代 K8s 直接通过标准的 CRI（Container Runtime Interface） 接口对接 `containerd`（或 Red Hat 为 K8s 量身定制的轻量运行时 `CRI-O`），调用链缩短为：`kubelet --> containerd --> containerd-shim --> runc`。
   - 因为 Docker 构建出来的镜像遵守的是全球统一的 OCI 镜像规范，所以 K8s + `containerd` 跑 Docker 镜像天然无缝兼容。

---

## 四、镜像制作与分发：Dockerfile、分层缓存与仓库规范

### 1. `Dockerfile` 的核心指令与缓存命中法则

`Dockerfile` 就是一份“如何在一层基础镜像之上，一步步叠加新的只读层，最终产出目标镜像”的自动化构建脚本。

以一个在生产环境部署前端或编译型应用最标准的 多阶段构建（Multi-stage Build） 为例（直接取材自本笔记仓库根目录的真实 `Dockerfile`）：

```dockerfile
# ==================== 阶段 1：构建环境 (包含庞大的 Node 编译器与源码) ====================
FROM node:24-alpine AS build

WORKDIR /app

# 先单独复制依赖清单并安装：只要 package.json 没变，下面改任何源码都不会重新跑 npm ci！
COPY package*.json ./
RUN npm ci

# 再复制经常变动的业务源码并打包
COPY . .
RUN npm run docs:build

# ==================== 阶段 2：运行时环境 (极简纯净，只拿编译产物) ====================
FROM nginx:1.27-alpine

# 拷贝自定义 Nginx 配置与上一阶段产出的静态网页，彻底丢弃阶段 1 的 Node 环境与 node_modules
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/.vitepress/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
```

编写和阅读 `Dockerfile` 时，有三条最关键的工程直觉：

1. **构建缓存的“多米诺骨牌”失效机制**：
   Docker（BuildKit）构建镜像时，会从上往下逐层检查缓存。一旦某一层指令的内容（或 `COPY` 进来的文件哈希）发生了变化，从这一层开始往下的所有层缓存全部失效，必须重新执行。
   - 因此，永远把变化频率最低的操作（安装系统 apt 包、复制 `package.json` / `requirements.txt` / `Cargo.toml` 并安装第三方依赖）放在最前面；把变化频率最高的操作（`COPY . .` 复制业务代码）放在最后面。
2. 多阶段构建（`FROM ... AS build` + `COPY --from=build`）的威力：
   编译 C++、Rust、Go 或打包前端项目时，编译期需要几百 MB 甚至几 GB 的编译器、头文件和 `node_modules`，但运行期其实只需要一个几 MB 的二进制文件或 `dist/` 静态目录。使用多阶段构建，最终产出的镜像只包含最后一个 `FROM` 阶段的内容，镜像体积能从 1.2GB 直接缩减到 20MB，且源码不会泄漏进生产镜像。
3. 构建上下文（Build Context）与 `.dockerignore` 的巨坑：
   当你执行 `docker build -t myapp .` 时，末尾的那个点 `.` 代表的不是“当前目录下的 Dockerfile”，而是 “把当前目录下的所有文件打包作为构建上下文发送给 Docker 构建引擎”！
   - 如果你的项目目录下有 5GB 的训练数据、`node_modules`、`.git` 历史、或者运行日志，又没写 `.dockerignore`，每次 `docker build` 光把这 5GB 垃圾传给构建器就要卡几分钟，如果不小心写了 `COPY . .`，这 5GB 垃圾还会被直接塞进镜像层里。

### 2. 镜像的命名规范与外部仓库（Registry）

一个完整的镜像名称（Tag）看似只是一个字符串，实际上严格对应着“去哪台服务器下载哪个仓库的哪个版本”：

```text
完整格式： [Registry 仓库域名]/[Namespace 组织或用户名]/[Repository 镜像名]:[Tag 版本标签]
```

| 镜像写法示例 | 实际去哪个 Registry 拉取？ | 说明 |
| :--- | :--- | :--- |
| `nginx:1.27-alpine` | `docker.io/library/nginx:1.27-alpine` | Docker Hub 官方标准库镜像：省略域名默认走 `docker.io`，省略用户名默认补 `library/` |
| `bitnami/redis:7.2` | `docker.io/bitnami/redis:7.2` | Docker Hub 第三方组织镜像：省略域名走 Docker Hub（注：Docker Hub 对匿名和免费登录用户均有每 6 小时的拉取次数限速） |
| `ghcr.io/wosnxuw/vite-notes:v1` | `ghcr.io` (GitHub Container Registry) | GitHub 镜像仓库：必须显式写出 `ghcr.io/用户名或组织名/镜像名:标签`。在 GitHub Actions 或 CI 中可直接使用内置的 `GITHUB_TOKEN` 进行免密推送 |

### 3. 本地镜像怎么离线迁移？

镜像在宿主机上并不是一个单独的 `.img` 文件，而是被打散成十几个只读层和 JSON 清单存放在 `/var/lib/docker`（或 `/var/lib/containerd`）深处。当服务器处于离线内网或拉不动外网镜像时，标准的打包搬运命令只有一对：

```bash
# 1. 在有网的机器上，将镜像完整导出为归档包（建议用 .tar 或配合 gzip 压缩为 .tar.gz）
docker image save ghcr.io/wosnxuw/vite-notes:v1 -o vite-notes.tar

# 2. 传到目标机器后，直接导入回本地镜像库（保留完整的层结构与原 Tag 名称）
docker image load -i vite-notes.tar
```
