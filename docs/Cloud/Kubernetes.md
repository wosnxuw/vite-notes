### 解决什么问题

Docker 解决了环境一致性问题

Docker Compose 解决了单机多服务的问题

K8s 的官网对自己的定位是：生产级容器编排。是一个自动化部署、扩展和管理容器化应用程序

包含以下功能：自动部署、回滚、服务发现、负载均衡、存储编排、密钥和配置管理等

K8s 是云原生运动的核心，始于 2014，由 Google 发布

Kubernetes 源于古希腊语，意为舵手、领航员，包括其 Logo

### cgroup 和 chroot 和 namespace

namespace 负责能看到什么

cgroup（control groups）负责监控与限制资源的使用，把若干进程分到一个控制组，整组进行限制

chroot 让某一个进程，将其他目录当作 /

这里最重要的是 namespace，原来 Linux 所有资源都是全局共享的，比如端口、主机名、进程表（检查附近有没有其他程序在跑）、挂载点

PID namespace:

正常来说，一个 Linux 的 PID=1 进程是 systemd，一个 nginx 可能 PID 是几千

但是在容器内部，nginx 的 PID=1

PID 不是进程的身份证，一个进程，可以同时拥有多个 PID

每个 namespace 的 init 进程 PID=1，在容器里，它从 nginx 启动

mount namespace、network namespace 用于执行文件系统、网络的隔离

### 关系

Kubernetes 既是一个开源项目 (upstream Kubernetes)，也逐渐形成了一套事实标准

Kubernetes = 开源容器编排平台 + API 规范 + 生态标准

一般可以理解为，K8s = Kubernetes

**Kubernetes 不是一个类似 nginx 那样，直接部署好就能用的单个软件，而是一套组件，包括控制平面、节点、网络插件等**

“安装 Kubernetes”本质上是把所有组件部署好，不是一个单独二进制程序能自然完成的事情。

所以，实际使用上，很少有人直接手工装 Kubernetes 的各种组件，而是用用某个发行版或托管服务

### kubeadm K3s minikube

kubeadm 是 Kubernetes 官方提供的“集群初始化工具”

kubeadm 装出来的，一般就被认为是最接近原版的 Kubernetes

K3s：自己重新打包了一套轻量 Kubernetes 发行版（也可以只在一个 node 上跑）

minikube 是一个轻量级 K8s 发行版，目标在本机运行单 node（单虚拟机）的简单集群

Amazon EKS/Google GKE 等等，云服务商们提供的集群属于 IaaS

### cluster、node 和 pod

cluster 集群 ≈ 整个 K8s，即 控制平面 + 工作节点 + 跑起来的服务们（实际上在 kubectl 里能找到，就算一个集群，切换 cluster，需要切 kubectl 的配置文件）

在生产环节里，一般有多个集群，开发、测试、生产等

node 节点（如果机器翻译翻译成节点的东西，一般就是指 node，pod 很多时候机翻会跳过不翻译，或者被翻译为荚）

一个 node = 一台物理机/一台虚拟机，是最小调度单元

一个 pod，聚合了一个或者多个容器，但是一般情况下一般一个 pod 放置一个应用程序（方便解耦）

每一个 pod 创建后，有一个内部 ip，pod 之间通过 ip 来互相访问

### 架构设计

K8s 是一个主从架构，分为 master（现代也叫做 Control Plane）和 worker

通常的生产级环境，控制平面在一个 node 上，worker 们在另一个平面上。控制平面也允许多个，以避免一个 master 突然坏掉

minikube 这种，control pane 和 worker 合并了，都在一台机器里

K8s 的 Node 一般它需要有：

（1）**kubelet** 用于管理 pod，接受控制平面里 cm 的指令

（2）**kube-proxy** 为 pod 提供网络代理和负载均衡（有的第三方实现不需要）

（3）**container-runtime** 容器运行时，类似 docker engine，它可以灵活更换，包括 containerd、CRI-O

containerd 是 Docker 捐给 CNCF 的东西，源于 Docker，也不绑定死 K8s，更加稳定成熟

CRI-O 是 Red Hat 做的，只为 K8s 打造（依赖），更轻量级

标准 K8s 的控制平面包含以下**组件**：

（1）**kube-apiserver** 集群的入口，命令通过这个东西，转发给对应的组件来处理，也负责集群通信。也包括权限认证，入口可以是 kube-ctl，WebUI 等

（2）**etcd** 一个一致且高可用的键值对存储系统，类似 Redis，存储所有 pod 的信息，即整个集群的数据库

（3）**ControllerManager** 管理器/控制器。它聚合了多个不同的控制器。包括（1）节点控制器：监控节点是否坏掉。（2）作业控制器：监控一次性作业（3）EndpointSlice（4）ServiceAccount

（4）**Scheduler** 调度器，负责监控 node 的节点占用，将 pod 调度到压力更小的节点上。包括 pod 新建时，应该在哪个 node 上跑

（5）cloud-controller-manager 云服务商自己的 API 接口，让用户在 WebUI 上操作，不需要用 kubectl

Kubernetes 很擅长管理 Worker 上的业务故障，但若 Master 自己坏了，是另一个层面的高可用问题（这一般是靠部署三个 master 来解决，少数服从多数，一个 leader，两个 standby）

K8s 还有一些常见插件：

（1）**DNS**：一般都需要有。为 Kubernetes 服务提供 DNS 记录

（2）WebUI（3）资源监控（4）集群级别的日志记录

（5）网络插件：分配虚拟 ip

### 控制平面部署

传统上，控制平面在一个单独的主机上，直接是一个 systemd 服务。也就是 K3s 的做法，就问你 kube-apiserver 是不是 Pod？

kubeadm 常见的是，将控制平面组件，作为静态 pod，用 kubelet 在特定 node 上管理

控制平面作为 Kubernetes 集群内部的 Pod 运行，由 Deployment 和 StatefulSets 或其他 Kubernetes 原语进行管理



### 内部服务与外部服务

内部服务就是指类似数据库，不对外公开，用户不可访问

外部服务就是指类似前端，对外公开，用户可访问。因此需要在 node 上开一个端口，并和 svc 的端口做映射

### svc Service 服务

pod 容易死掉，如果换新，ip 会变化。它解决访问入口不能变的问题。

将一组 pod 封装为一个 service，对外统一访问，Service 的 ip 不变，对外提供稳定服务，对内将请求转发到健康的 pod 上

### ing Ingress 入口

管理从集群外部访问集群内部服务的入口和方式，也可以配置域名、负载均衡、SSL 证书等

外部用户访问时，请求先打在 ingress 上，然后它通过 kube-proxy 来转交给 pod

### Development

当一个节点坏掉了，如何提供服务呢？答案是把 node 复制几份，让 svc 统一管理

将多个 pod 组织在一起，包括滚动更新等功能

### cm ConfigMap

由于读写数据库需要知道数据库的地址、密码，这又得配置，所以 K8s 提供了统一的配置入口

### secret

专门配置密码的组件

### Volume

挂载给数据库，让数据库的数据持久化

### sts

StatefulSet

数据库是由状态的，多个数据库之间数据要同步，用这个东西替代 Development

### 对象 和 Pod 之间的关系

Development、Service、Ingress 都不是某个具体的 Pod

它们是一条声明/规则，描述了需要什么镜像、几个副本，pod 的样子

所以你需要

按照文档的说法，这个应该叫做 K8s 对象，持久实体，一旦创建了对象，Kubernetes 系统就会持续确保该对象存在

Controller 则是一个长期运行的程序，有的内置在 K3s 进程里，有的是 Pod

### 对象创建、管理

可以直接用命令创建 `kubectl create deployment nginx --image nginx`，但是这种对象几乎没用

或者是  `kubectl apply -f nginx.yaml` （也可以是 json，但是 yaml 居多）

比如 yaml 描述了一个 Service 资源；其中字段 kind: Service 告诉 Kubernetes 这是哪类资源；Kubernetes API Server 会按标准解析、校验和保存它，然后相关控制器会把它转成实际可用的服务转发规则

yaml 的优势是，可以存储在 git 上，并且有一些模版可以抄

### K8s 的一个整体理解

K8s 是你声明你需要什么东西

Deployment = 期望状态配置 = 那个 yaml 文件

Controller = 持续执行对账逻辑的程序 = 一个死循环，不断检查服务个数是否对劲

Pod = 真正被运行出来的实例

kubectl 类似于前端，所以也可以脱离 master 和 worker，在你自己的电脑上看

它使用一个配置文件，位置在 `~/.kube/xxx.yaml`

API Server 跑在真实的控制平面上，用于处理你的通过 kubectl 传来的请求

### kubectl

1、get

`kubectl get nodes`

`kubectl get pods -n xxx`

`kubectl get namespace/deployments/configmap/svc/secret/ingress`

2、apply

描述是：通过定义了 K8s 的资源的文件（yaml）来管理应用程序，在集群中创建和更新资源

`kubectl apply -f deployment.yaml`

`kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.20.2/cert-manager.yaml`


### 笔记更换到更云原生的部署方式

大概是这样子：

买一个单体服务器，可以用域名的那种

然后在这上面安装 K3s，部署集群

刚部署好，大概是如下

第一步是安装 K3s，按照官网的命令一键安装，因为我们只有一个机器，所以其实我们只有一个 node

```
kubectl get nodes
NAME   STATUS   ROLES           AGE    VERSION
note   Ready    control-plane   3d2h   v1.35.5+k3s1
```

基本的 pods
```
NAMESPACE     NAME                                      READY   STATUS      解释
kube-system   coredns-8db54c48d-xgwkk                   1/1     Running     集群内 DNS
kube-system   helm-install-traefik-2d687                0/1     Completed   只用于安装 traefik-*，所以状态为 0/1
kube-system   helm-install-traefik-crd-4kph8            0/1     Completed   同上
kube-system   local-path-provisioner-5d9d9885bc-5wsts   1/1     Running     作本地硬盘分配，给应用创建可挂载的数据目录
kube-system   metrics-server-786d997795-6r5c2           1/1     Running     作性能监控
kube-system   svclb-traefik-1b2d7228-krgqr              2/2     Running     ServiceLB，为 Traefik 暴露 80/443
kube-system   traefik-9bcdbbd9-fbd47                    1/1     Running     K3s 默认的 Ingress
```
这里我没有看到 kube-apiserver，是因为，只有标准版的 K8s 才有那个作为 pod。单机的很多功能被打包进入 k3s server 进程里

和证书签发相关的 pods，总的来说，是负责给三个域名申请证书
```
NAMESPACE       NAME                                      READY   STATUS 
cert-manager    cert-manager-68756bcf6f-f4flp             1/1     Running
cert-manager    cert-manager-cainjector-c664cf9b8-7mwj8   1/1     Running
cert-manager    cert-manager-webhook-5749c6dc95-gdqrp     1/1     Running
```
这个 Argo CD 啊，它本身就叫做 CD，所以它关注 CD 这一块
```
NAME                                               READY   STATUS    解释
argocd-application-controller-0                    1/1     Running   对比 Git 状态和集群状态，执行同步
argocd-applicationset-controller-b7669f646-x8g74   1/1     Running   ApplicationSet 控制器
argocd-dex-server-569b757-tjx4k                    1/1     Running   SSO/OIDC 登录组件
argocd-notifications-controller-58ff87546-hrmd9    1/1     Running   通知组件
argocd-redis-b9496d8bf-cgdpg                       1/1     Running   缓存
argocd-repo-server-75ffcfc9df-j229b                1/1     Running   负责拉取 git 仓库，渲染 Kustomize，Kustomize 是一个模版
argocd-server-76755b46f8-xwhd7                     1/1     Running   Web UI/API
```
自动保证你的 Kubernetes 集群实际运行状态，与你 Git 仓库中描述的期望状态完全一致
```
tekton-pipelines  tekton-dashboard-774bff7cc-88zl6                        1/1     Running     WebUI 界面 Dashboard
tekton-pipelines  tekton-events-controller-5cbc777ccd-ggknb               1/1     Running     事件驱动机制的一部分，用于结合 Triggers 实现 Git push 等外部事件的响应
tekton-pipelines  tekton-pipelines-controller-65f567589b-p8jn6            1/1     Running     核心控制器
tekton-pipelines  tekton-pipelines-webhook-75cd84877-ptklv                1/1     Running     准入控制器、配置验证
tekton-pipelines  tekton-triggers-controller-66fd74568d-bmp7w             1/1     Running     监听 Triggers 资源，当事件到达，启动相应的 CI 流程
tekton-pipelines  tekton-triggers-core-interceptors-66456f8cf6-5bg95      1/1     Running     内置的拦截器（interceptor）服务，预处理
tekton-pipelines  tekton-triggers-webhook-55c8dd895f-g6wtv                1/1     Running     类似 pipelines-webhook，但针对 Triggers
tekton-pipelines-resolvers   tekton-pipelines-remote-resolvers-59b7b847cd-chtqn               远程资源解析，允许直接引用远程 pipeline
```

ci 这个 namespace 是每次执行产生的 TaskRun Pod，相当于具体的执行，所以平时没有 Run 是对的。
```
ci   vite-notes-build-9nvsx-build-push-update-manifest-pod   0/3     Error       0          10h
ci   vite-notes-build-qbqp8-build-push-update-manifest-pod   0/3     Completed   0          10h
```
### GitOps 工作原理

关键点是：Git 里不仅有“代码”，还有“我要部署哪个版本”

CI 层级：

你 push 代码；GitHub 知道，并触发 webhook；tekton 的 tirgger 收到；tekton 去拉代码、跑 pipelene；构建出镜像后推送到 GHCR；然后修改 git 里的部署清单的 tag；

CD 层级：

git 的部署清单变化；Argo 一直在监听它，检查到并 apply 它到 K3s；K3s 拉取镜像、逐步调整集群到目标状态

其他：

Traefik 是 Ingress，无论是 push 触发到 tekton-hooks，还是用户访问，都是它先来处理

所以整个流程是靠 K8s 的没错，但是 K8s 只是，把系统逐步调整到你期望的样子，并不是真的负责具体的 CI/CD

Q：为什么 CI 是等待 webhook，而 CD 是自己监听？

A：CI 只处理一次，而 CD 是持续工作，以免谁改了 Deployment 之类的