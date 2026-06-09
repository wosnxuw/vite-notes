### 解决什么问题

Docker 解决了环境一致性问题

Docker Compose 解决了单机多服务的问题

K8s 更近一步解决跨机器、自动恢复、负载均衡等问题

### 关系

Kubernetes 既是一个开源项目 (upstream Kubernetes)，也逐渐形成了一套事实标准

Kubernetes = 开源容器编排平台 + API 规范 + 生态标准

一般可以理解为，K8s = Kubernetes

**Kubernetes 不是一个类似 nginx 那样，直接部署好就能用的单个软件，而是一套组件，包括控制平面、节点、网络插件等**

“安装 Kubernetes”本质上是把所有组件部署好，不是一个单独二进制程序能自然完成的事情。

所以，实际使用上，很少有人直接手工装 Kubernetes 的各种组件，而是用用某个发行版或托管服务

如：

kubeadm 装 Kubernetes

K3s

EKS/GKE/AKS

### kubeadm

kubeadm 是 Kubernetes 官方提供的“集群初始化工具”

kubeadm 装出来的，一般就被认为是最接近原版的 Kubernetes

### K3s

kubeadm：装原版 Kubernetes 组件

K3s：自己重新打包了一套轻量 Kubernetes 发行版

### node

node 节点

一个节点 = 一台物理机/一台虚拟机

### pod

最小调度单元

聚合了一个或者多个容器，一般一个 pod 放置一个应用程序（方便解耦）

每一个 pod 创建后，有一个内部 ip，pod 之间通过 ip 来互相访问

### svc

pod 容易死掉，如果换新，ip 会变化

Service 服务

将一组 pod 封装为一个 service，对外统一访问，Service 的 ip 不变，对外提供稳定服务，对内将请求转发到健康的 pod 上

### 内部服务与外部服务

内部服务就是指类似数据库，不对外公开，用户不可访问

外部服务就是指类似前端，对外公开，用户可访问。因此需要在 node 上开一个端口，并和 svc 的端口做映射

### ing

Ingress（直译：入口）

管理从集群外部访问集群内部服务的入口和方式，也可以配置域名、负载均衡、SSL 证书等

### cm

ConfigMap

由于读写数据库需要知道数据库的地址、密码，这又得配置，所以 K8s 提供了统一的配置入口

### secret

专门配置密码的组件

### Volume

挂载给数据库，让数据库的数据持久化

### Development

当一个节点坏掉了，如何提供服务呢？答案是把 node 复制几份，让 svc 统一管理

将多个 pod 组织在一起，包括滚动更新等功能

### sts

StatefulSet

数据库是由状态的，多个数据库之间数据要同步，用这个东西替代 Development

### 架构设计

MASTER 和 WORKER 架构

worker 是那个真正干活的，实际上就是那个 node

它需要有：

（1）kubelet 管理 pod

（2）kube-proxy 为 pod 提供网络代理和负载均衡

（3）container-runtime 容器运行时，类似 docker engine，它可以灵活更换，包括 containerd、CRI-O、Mirantis

master 包含以下组件（也叫做 Control Plane）：

（1）kube-apiserver 集群的入口，命令通过这个东西，转发给对应的组件来处理，也负责集群通信。也包括权限认证，入口可以是 kube-ctl，WebUI 等

（2）etcd 一个高可用的键值对存储系统，类似 Redis，存储所有 pod 的信息，即整个集群的数据库

（3）ControllerManager 管理器，监控 pod，当 pod 坏掉，它会发现，并重启它

（4）Scheduler 调度器，负责监控 node 的节点占用，将 pod 调度到压力更小的节点上

（5）cloud-controller-manager 云服务商自己的 API 接口

Kubernetes 很擅长管理 Worker 上的业务故障，但 Master / Control Plane 自己坏了，是另一个层面的高可用问题（这一般是靠部署三个 master 来解决，少数服从多数，一个 leader，两个 standby）

### minikube

一个轻量级 K8s 发行版，在本机运行单 node（单虚拟机）的简单集群
