### 解决什么问题

Docker 解决了环境一致性问题

Docker Compose 解决了单机多服务的问题

K8s 的官网对自己的定位是：生产级容器编排。是一个自动化部署、扩展和管理容器化应用程序

包含以下功能：自动部署、回滚、服务发现、负载均衡、存储编排、密钥和配置管理等

K8s 是云原生运动的核心，始于 2014，由 Google 发布

Kubernetes 源于古希腊语，意为舵手、领航员，包括其 Logo

### cgroup 和 chroot 和 namespace

namespace 负责进程能看到什么

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

所以，实际使用上，很少有人直接手工装 Kubernetes 的各种组件，而是用某个发行版或托管服务

### kubeadm K3s minikube

kubeadm 是 Kubernetes 官方提供的“集群初始化工具”

kubeadm 装出来的，一般就被认为是最接近原版的 Kubernetes

K3s：自己重新打包了一套轻量 Kubernetes 发行版（也可以只在一个 node 上跑）

minikube 是一个轻量级 K8s 发行版，目标在本机运行单 node（单虚拟机）的简单集群

Amazon EKS/Google GKE 等等，云服务商们提供的集群属于 IaaS

RKE2 也是一个发行版，它的描述是 Rancher 面向企业用户的下一代 Kubernetes 发行版

历史上有一家独立公司叫 Rancher Labs。它开发了 Rancher、RKE、K3s 等项目，SUSE 在 2020 年把这家公司整个收购了

### cluster、node 和 pod

cluster 集群 ≈ 整个 K8s，即 控制平面 + 工作节点 + 跑起来的服务们（在 kubectl 里能找到，就算一个集群，切换 访问的集群，需要切 kubectl 的配置文件）

在生产环节里，一般有多个集群，开发、测试、生产等；一个集群内部，也可能划分多个子命名空间，来做不同的事情

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

备注：实际上这一节属于原理层面，实际应用中，并不关注

### 控制平面部署

传统上，控制平面在一个单独的主机上，直接是一个 systemd 服务。也就是 K3s 的做法，就问你的 kube-apiserver 是不是 Pod？

kubeadm 常见的是，将控制平面组件，作为静态 pod，用 kubelet 在特定 node 上管理

控制平面作为 Kubernetes 集群内部的 Pod 运行，由 Deployment 和 StatefulSets 或其他 Kubernetes 原语进行管理

### 使用

在 Rancher 的 WebUI 面板上它左侧大概是这样（我列举应该关注的）

#### 集群

##### 项目/工作空间

#### 工作负载

##### Deployment

它管理 pod 如何创建

##### Pod

真正运行代码，意义不大，你可以看看镜像是否是你需要的

#### 服务发现

##### svc Service 服务（内部）

pod 容易死掉，如果换新的，ip 会变化，它解决访问入口不能变的问题。

将一组 pod 封装为一个 service，对外统一访问，Service 的 ip 不变，对外提供稳定服务，对内将请求转发到健康的 pod 上

在这里，目标那一栏，你可以看到 pod 对内的端口，比如 10.96.122.23:6090

注意⚠️：口语上，服务可能是指某个 pod，或者甚至整套系统/应用，但是在 k8s 里，service 的直译是服务

##### ing Ingress 入口（外部）

管理从集群外部访问集群内部服务的入口和方式，也可以配置域名、负载均衡、SSL 证书等

外部用户访问时，请求先打在 ingress 上，然后它通过 kube-proxy 来转交给 pod

其实就是给外部一个域名，这里你可以直接看到，每个命名空间对应的域名是什么

#### 存储

##### cm ConfigMap

由于读写数据库需要知道数据库的地址、密码，这又得配置，所以 K8s 提供了统一的配置入口

点进去之后，“相关资源”里你可以看到谁引用了它

##### Secret

专门配置密码的组件，有时候也被放置 Helm 的部署记录

##### Storage Class

“使用哪种存储系统、怎么创建磁盘”的模板

##### pvc PresistentVolumeChain

声明需要多大空间的申请

##### pv PresistentVolume

集群里实际可用的一块存储，挂载给数据库，让数据库的数据持久化

它们两个之间，由 K8s 自动绑定

### 对象 和 Pod 之间的关系

这个概念是理解 K8s 的核心

一个 Pod 需要综合所有的对象，既要从 Service 里拿到访问其他服务，也需要从 ConfigMap 里拿配置，也需要 Deployment 指定它需要运行哪个镜像，几个副本，还需要 PVC 用于挂载日志目录

### 对象创建、管理

1、可以直接用命令创建 `kubectl create deployment nginx --image nginx`，但是这种对象几乎没用

2、使用 YAML 创建，比如 `kubectl apply -f nginx.yaml` （也可以是 json，但是 yaml 居多）

比如 yaml 描述了一个 Service 资源；其中字段 kind: Service 告诉 Kubernetes 这是哪类资源；Kubernetes API Server 会按标准解析、校验和保存它，然后相关控制器会把它转成实际可用的服务转发规则

yaml 的优势是，可以存储在 git 上，并且有一些模版可以抄

Helm 是 RKE2 内置了的一个安装工具，它也是在 K8s 外部，然后通过 API 来访问并管理各种对象，所以你能在 WebUI 里看到，它建议你从 Helm 里管理，而手工修改 YAML 可能会随时被覆盖

### 登陆与连接

你需要使用一个叫做 kubeconfig 的 YAML 文件来做认证

这个不是部署用的那个，它只记录 URL、身份、密钥

kubectl 会按以下顺序寻找这个文件

1、KUBECONFIG 所指向的位置，可以指向多个

2、~/.kube/config 文件

3、--kubeconfig /path/to/config 临时指定

如果你同时要管理多个集群，那么你可以 merge config，也可以单独存放多个文件

~~~
~/.kube/
├── config
└── configs/
    ├── fabu-dev.yaml
    └── fabu-prod.yaml
~~~

前者的优势是，可以用 kubectl config use-context 切换集群，不需要手工敲配置文件位置，劣势是合并、分离需要花额外的精力

### kubectl

| Rancher 菜单 | kubectl 命令 |
|---|---|
| 工作负载 → Deployments | `kubectl get deployments` |
| 工作负载 → Pods | `kubectl get pods` |
| 服务发现 → Services | `kubectl get services` |
| 服务发现 → Ingresses | `kubectl get ingress` |
| 存储 → ConfigMap | `kubectl get configmaps` |
| 存储 → PVC | `kubectl get pvc` |
| 存储 → Secret | `kubectl get secrets` |
| 存储 → PV | `kubectl get pv` |
| 存储 → StorageClass | `kubectl get storageclass` |




### Todo

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