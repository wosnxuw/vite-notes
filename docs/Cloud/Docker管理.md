面对 Docker 占据空间逐步暴涨的问题，开始规划解决方案和后续管理方案

### 当时现状

Docker 有 100+ GB，350 万文件

### 迁移文件到其他磁盘

```
你 (docker CLI)
        ↓
Docker Engine (dockerd)   ←── 配置文件：/etc/docker/daemon.json
        ↓
containerd (容器运行时)    ←── 配置文件：/etc/containerd/config.toml
        ↓
    runc (启动容器进程)
```

deamon.json 的 `"data-root": "/data/docker"`

负责：镜像层 + 容器可写层 + 卷 + 构建缓存

具体：

（1）overlay 镜像和容器的联合文件系统层

（2）volumes 卷

（3）containers 不是容器，而是日志

（4）buildkit 构建缓存

config.toml 的 `root = "/data/containerd"`

负责：镜像（压缩态）+ 镜像（展开态） + 容器（根文件系统）+ 元数据

值得注意的是，如果你不挪 containerd，如果你本机跑 K8s，一样会用 containerd

一般来说膨胀的位置是 Docker 的目录

### 停止的容器锁住了旧镜像

我经常习惯只看 `docker ps` 而不是 `docker ps -a`

实际上我的感觉是大部分的容器都是死循环，根本跑不完

然后我以前可能是 docker run，但是不 --rm，大批容器停留在 Exited 状态

停止但遗留的容器，锁住了无用的镜像

### 悬挂的匿名卷极多

裸跑 docker run，但是不指定 VOLUME 名，此时容器 --rm，匿名卷不会遗留

但是 Compose 默认 down 不删除匿名卷，后续 up 也不会复用它们，匿名卷遗留

### 构建缓存极大

Boost 安装层、Bazel 输出/cache、Python、Node、Bazel external dependenc

### 习惯

1、默认保持 --rm

2、必须采取命名卷，并且根据情况 -v

3、时常 docker volume ls

4、注意 .dockerignore，避免运行日志等产物同代码一并复制到镜像内部

5、限制缓存上限

6、时常 docker system df、docker system df -v 查看情况

7、单容器临时跑 --rm，多容器换 compose 但是注意卷的使用

### 复杂度转移

以前：你需要启动 Redis，安装 python 等等

现在：docker compose up -d

问题：端口、数据、重启的问题仍然在