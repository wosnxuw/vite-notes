# Kubernetes核心架构与资源模型

几乎所有的 Kubernetes（简称 K8s）教程，一上来就会给你画一张庞大的集群架构图，逼着你背 `etcd`、`kube-apiserver`、`kube-scheduler`、`kube-proxy` 这些底层组件。结果背了半天，真正打开公司的 Rancher 面板或者拿到一份项目的 `deploy/` 目录时，依然一头雾水：我到底该点哪里？我的程序跑在哪？外部请求是怎么进来的？

之所以会觉得乱，是因为没有把 K8s 的 “使用者视角（怎么用）” 和 “造轮子视角（集群底层怎么跑）” 彻底分开：

- 第一层：日常使用层（开发者 95% 的时间只需要关心这一层）
  把整个 K8s 集群当成一个已经装好的黑盒云平台。你根本不需要管它底下有几台机器、也不需要知道 `etcd` 在哪，你只需要看懂 Rancher 面板左侧的三个核心菜单（工作负载、服务发现、存储与配置），知道怎么把你的容器镜像、端口、域名、配置文件和磁盘这几块积木拼起来。
- 第二层：底层引擎层（只有在自己搭集群或排查节点级故障时才需要关心）
  打开黑盒盖子，看看当你提交了一份 YAML 图纸之后，底下的控制平面（Control Plane）和工作节点（Worker Node）到底是谁在发号施令、谁在拉起容器。

这一篇我们就反过来讲：先从你每天打开 Rancher 面板（或敲 `kubectl`）真实看到的东西出发，反向建立直觉；把怎么用彻底搞明白之后，最后再掀开盖子看底层的架构原理。

---

## 一、先站在最高处：为什么有了 Docker Compose 还要搞 K8s？

在单台服务器上用 `docker-compose.yml` 跑几个容器已经很爽了，为什么去到公司生产环境，非要换成一个复杂得多的 K8s？

因为一旦你的业务不能只靠一台机器扛，而是有 5 台甚至 50 台服务器 时，Docker Compose 立刻会遇到五个管不了的问题：
1. **跨机器谁来分配？（调度）**：新来一个容器，5 台机器里哪台内存还宽裕、哪台插着 GPU？总不能每次靠人去挨台机器 `ssh` 看 `htop` 再手动挑机器起容器。K8s 把所有机器池化成一个整体，你只管把容器丢进去，它自动挑最闲的机器跑。
2. **机器半夜挂了怎么办？（自愈）**：凌晨 3 点，第 2 台物理服务器断电死机了。跑在它上面的 Compose 容器就彻底失联了；但在 K8s 里，平台发现第 2 台机器没心跳了，会自动在第 1、3、4 台健康的机器上把刚才死掉的容器重新拉起一份。
3. **容器换了机器，IP 变了怎么连？（服务发现）**：容器死掉并在别的机器上复活后，它的内网 IP 肯定变了。调用它的前端或其他服务，怎么能在不改配置的情况下，永远连上最新活着的那个容器？
4. **发新版本怎么做到不断线？（滚动更新）**：升级镜像时不能把旧容器全停了再起新的。K8s 支持跑着 3 个旧容器时，先起 1 个新容器，确认新容器能正常响应请求了，再杀 1 个旧容器，逐个平滑替换；发现 Bug 一键秒级回滚。
5. 同一套镜像怎么在开发/测试/生产环境通用？（配置与存储解耦）：镜像本身只装代码，到了不同环境，里面的数据库地址、密码、挂载的硬盘由平台在启动时动态塞进去。

一句话抓住 K8s 的最高视角：
使用单机 Docker 时，你是“直接跟单个容器打交道”；而使用 K8s 时，你是“填好几张声明式申请表（YAML 对象），交给 K8s 平台，平台替你保证线上永远维持你表格里要求的样子”。

---

## 二、第一层（怎么用）：打开 Rancher 面板，你到底该看哪里？

当你登录进公司内网的 Rancher WebUI 面板，点进某一个集群（Cluster，比如 `dev` 测试集群或 `prod` 生产集群），再在顶部选好你团队所属的 项目 / 命名空间（Namespace，相当于集群里给每个项目划出的独立文件夹） 后，左侧边栏有几十个菜单项。

不要被吓到，日常开发、发版和排障，你只需要盯死以下 四大菜单（共 8 个高频名词）。它们全部围绕着一个绝对中心运转——`Pod`（真正跑你容器代码的那个实例）。

```text
你在 Rancher 左侧菜单看到的 4 大块，其实就是在回答一个容器活在集群里的 4 个基本问题：

1. [工作负载 Workloads]  --> 代码在哪跑？由谁管死活？
     - Deployment (管 Pod 的监工：声明跑哪个镜像、要几个副本)
     - Pod        (真正干活的打工人：里面包着你的 Docker 容器)

2. [服务发现 Service Discovery] --> 请求怎么从外面打进这个 Pod？
     - Ingress    (外部大门：绑定域名 https://notes.xxx.com 和 SSL 证书，把外网流量放进来)
     - Service    (内部固定电话总机：给随时会死掉重生的 Pod 提供一个永远不变的内部 IP 和端口)

3. [配置 ConfigMaps & Secrets] --> 配置文件和密码放哪？
     - ConfigMap  (存明文配置文件、环境变量)
     - Secret     (存数据库密码、HTTPS 证书私钥、拉私有镜像的账号令牌)

4. [存储 Storage] --> 容器删了重建，需要持久化落盘的数据放哪？
     - PVC        (开发填的“申请一张 10GB 硬盘”的领用单，挂给 Pod 用)
     - PV / StorageClass (底层真正切出来的那块硬盘，以及切硬盘的模板)
```

下面我们顺着你在面板上排查一个线上服务的真实动线，把这四块逐个看穿：

### 1. 第一站：工作负载（Workloads）—— 看 `Deployment` 和 `Pod`

当你关心“我的程序现在跑起来没有、跑的是哪个版本的镜像、为什么报错重启了”，直接点开左侧的 工作负载。这里最核心的是上下两级关系：

- `Deployment`（你真正应该修改和管理的对象）：
  在 K8s 里，我们几乎从来不会手动去直接创建一个裸 `Pod`。因为裸 `Pod` 没人照看，一旦死掉就彻底消失了。
  我们创建的都是 `Deployment`（监工）。你在 `Deployment` 里写好要求：“用 `ghcr.io/wosnxuw/vite-notes:v1` 这个镜像，维持 `3` 个副本（Replicas）活着”。`Deployment` 就会自动在底下帮你把 3 个 `Pod` 创建出来，一旦死了一个，它立刻补一个新的。
  - 你在面板的 `Deployment` 里看什么？ 看副本数是不是绿色的 `3/3`、点“编辑”升级镜像版本号、或者点 `Redeploy` 让它把底下的 Pod 优雅地滚动重启一遍。
- `Pod`（真正跑代码的实例，只用来“看状态和看日志”，不要手动改它）：
  点进某个 `Deployment`，底下列出来的那一排名字带随机后缀的实例（比如 `vite-notes-6b8f9c-x2k9p`），就是 `Pod`。
  - 为什么不直接叫 Container（容器）而要叫 Pod（荚）？
    你可以把 `Pod` 直接理解成 “给你的 Docker 容器外面套了一个带独立内网 IP 的标准集装箱壳子”。90% 的情况下，1 个 Pod 里面就只装了 1 个业务容器（偶尔为了辅助收集日志或做代理，会在同一个壳子里并排塞一个辅助小容器，叫 Sidecar 边车，它们共用这同一个 Pod 的 IP 和 `localhost`）。
  - **你在面板的 `Pod` 里干什么？**
    1. 看它当前拉取的镜像 Tag 对不对、跑在哪台机器（Node）上；
    2. 点最右边的 “查看日志（Logs）” 看程序标准输出的报错（对应命令行 `kubectl logs`）；
    3. 点 “执行 Shell（Execute Shell）” 直接开一个终端进到容器内部看文件（对应 `kubectl exec -it`）；
    4. 如果你发现某个 Pod 卡死了，直接在面板上把这个 Pod 删掉（Delete）——别怕，因为上面有 `Deployment` 监工看着，你刚删掉旧 Pod 的下一秒，`Deployment` 就会立刻自动帮你新建一个干净的新 Pod！

> 顺带一提：在工作负载菜单下除了最常用的 `Deployment`（占 85% 的无状态服务），你还会见到另外三个亲戚，它们也是管 Pod 的监工，只是脾气不同：
> - `StatefulSet`：专门管数据库/中间件（如 Redis、etcd、ArgoCD 核心控制器）。它建出来的 Pod 不带随机后缀，而是固定叫 `-0`、`-1`、`-2`，各自绑死自己专属的硬盘。
> - `DaemonSet`：不设副本数，集群里有几台服务器，它就保证每台服务器上精确跑 1 个 Pod（常用于每台机器必装的日志收集或监控探针）。
> - `Job / CronJob`：跑一次性任务或定时任务（比如 CI 编译构建、数据库迁移脚本），跑完变成 `Completed (0/1)` 正常退出就算成功，不会无限重启。

### 2. 第二站：服务发现（Service Discovery）—— 看 `Service (svc)` 和 `Ingress`

现在你的 `Pod` 已经在工作负载里绿油油地跑起来了，它也有一个集群内部 IP（比如 `10.42.0.15`）和容器内部端口（比如 `8080`）。但接下来有两个问题：① 如果这个 Pod 明天崩溃重建了，它的新 IP 变成了 `10.42.0.99`，别人怎么找它？ ② 外网用户的浏览器怎么通过域名访问到它？

这时候就轮到左侧菜单的 服务发现 出场了。它把网络清晰地切成了“对内”和“对外”两棒：

```text
外网用户浏览器 (访问 https://notes.wosnxuw.top)
  --> 第一棒 [Ingress (对外网关规则：认域名、配 HTTPS 证书)]
        --> 第二棒 [Service (对内固定总机：IP 永远不变，如 10.96.122.23:80)]
              --> 第三棒 [Pod 1 / Pod 2 / Pod 3 (真实干活的容器，IP 随时会变，监听 8080)]
```

- `Service`（简称 `svc`，集群内部的固定入口与负载均衡）：
  - 注意口语歧义：平时大家嘴上说“某微服务”，可能指的是整个应用；但在 K8s 面板里，`Service` 特指这个内部网络转发组件。
  - **它解决什么问题？** 因为 Pod 随时会死掉换新 IP，所以 K8s 在一组相同的 Pod 前面挡了一个 `Service`。`Service` 自己的虚拟 IP（ClusterIP，比如 `10.96.122.23`）和内部 DNS 域名（比如 `http://vite-notes:80`）从创建起就永远不会变。
  - **你在面板的 `Service` 里看什么？** 看“目标端口”那一栏（比如它把自己的 `80` 端口转给了底下 Pod 的 `6090` 端口），以及点进去看它底下到底有没有成功关联（Selector 匹配）上健康的 Pod。如果点进一个 Service 发现底下的 Endpoints（端点 Pod 列表）是空的，说明标签写错了或者 Pod 的健康检查没通过，流量走到这就会断掉。
- `Ingress`（简称 `ing`，集群对外的域名大门）：
  - `Service` 只给了你一个集群内部的虚拟 IP，外网用户还是进不来。
  - 你点开面板里的 `Ingress`，这里就跟配 Nginx 反向代理一模一样了：你在里面能直观看到当前命名空间对外暴露的外部域名是什么（比如 `notes.wosnxuw.top`）、挂了哪张 SSL 证书、把哪个 URL 路径（如 `/api`）转发给了上面哪一个内部 `Service`。

### 3. 第三站：配置与存储（Storage / Config）—— 看 `ConfigMap`、`Secret` 和 `PVC`

如果程序跑起来报错“连不上数据库”或者“找不到配置文件”，就要去左侧的 存储 / 配置 菜单里找这三样东西：

- `ConfigMap`（简称 `cm`，明文配置中心）：
  数据库的地址、服务端端口号、或者整份 `nginx.conf` 配置文件，不能写死在 Docker 镜像里（否则换个环境就要重新打包镜像）。把这些键值对写在 `ConfigMap` 里，Pod 启动时就会自动把它们读取为环境变量或挂载成容器里的配置文件。
  - **实用看盘技巧**：在 Rancher 面板里点进某一个 `ConfigMap`，在“相关资源（Related Resources）”一栏，你能一眼看到当前到底是哪几个 `Deployment / Pod` 引用了这份配置。
- **`Secret`（密码与证书保险箱）**：
  用法和 `ConfigMap` 完全一样，区别在于它专门用来存不能明文展示的敏感信息——比如数据库密码、HTTPS 域名的私钥证书、去私有仓库（如 GHCR / Harbor）拉镜像用的账号密码（`imagePullSecrets`）。（注：有时候用 Helm 安装软件，Helm 也会把自己的安装历史记录作为一个特殊类型的 Secret 存在这里。）
- `PVC`、`PV` 与 `StorageClass`（持久化硬盘三件套）：
  如果集群里跑了 MySQL、Redis 或者需要持久化落盘的文件，Pod 删掉重建后数据不能丢，就必须挂硬盘。为什么 K8s 面板里把挂硬盘拆成了三个菜单？
  1. `PVC`（PersistentVolumeClaim，你唯一需要关心的“硬盘申请单”）：作为开发者，你只需要在自己的项目空间里建一个 `PVC`，写明“我申请一块 `20Gi` 的硬盘”，然后让你的 Pod 挂载这个 `PVC` 就行了。
  2. `PV`（PersistentVolume，集群真正切出来的那块物理/网络磁盘块）：你提交 `PVC` 申请单后，K8s 会自动在后台找一块真正的磁盘 `PV` 跟你的 `PVC` 一对一绑死（状态变成绿色的 `Bound`）。
  3. `StorageClass`（存储类，运维预先配好的“自动切硬盘模板”）：你可能会好奇，K8s 怎么知道去哪切一块新硬盘 `PV` 出来？就是靠运维提前配好的 `StorageClass` 模板（比如告诉 K8s 去公司的 Ceph 存储池切、去阿里云买块云盘、或者像单机 K3s 的 `local-path` 那样直接在宿主机硬盘上新建一个文件夹当磁盘用）。

---

## 三、把第一层串起来：用本仓库的 4 个真实 YAML 看懂完整闭环

现在你已经认识了面板上的那几个菜单。怎么把一个应用放到 K8s 里？

在面板上用手点按钮创建（或者敲 `kubectl create deployment nginx --image=nginx`）只适合临时做实验，真正在工程里，我们永远是把刚才在面板上看到的每一项，写成对应的 YAML 文件存在 Git 仓库里（通过 `kubectl apply -f xxx.yaml` 提交给集群）。

我们直接拿本笔记仓库 `./deploy/base/` 目录下真实写好的 4 个迷你 YAML 文件来做对照。你会发现，每一个文件里的 `kind:` 字段，都精确对应你刚才在 Rancher 面板上看到的一个菜单：

```yaml
# 文件 1：namespace.yaml —— 在集群里建一个叫 vite-notes 的专属项目文件夹
apiVersion: v1
kind: Namespace
metadata:
  name: vite-notes
---
# 文件 2：deployment.yaml —— 对应面板【工作负载 -> Deployments】
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vite-notes
  namespace: vite-notes
spec:
  replicas: 1                  # 要求永远保持 1 个 Pod 活着
  selector:
    matchLabels:
      app: vite-notes          # Deployment 靠这个标签认领底下的 Pod
  template:                    # 下面是孵化 Pod 的模板
    metadata:
      labels:
        app: vite-notes        # 给生出来的 Pod 贴上 app=vite-notes 标签
    spec:
      imagePullSecrets:
        - name: ghcr-pull      # 引用【Secret】菜单里的凭证去拉私有镜像
      containers:
        - name: vite-notes
          image: ghcr.io/wosnxuw/vite-notes:bootstrap
          ports:
            - name: http
              containerPort: 80
          readinessProbe:      # 就绪探针：每 10 秒戳一下容器 80 端口，通了才让 Service 把流量放进来
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:       # 存活探针：如果连续戳不通，说明进程假死了，自动重启该容器
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 20
            periodSeconds: 30
          resources:           # 限制容器最多吃多少 CPU 和内存（底层对应 Linux Cgroups）
            requests:
              cpu: 20m         # 至少保证 0.02 核与 64MB 内存
              memory: 64Mi
            limits:
              cpu: 300m        # 最多不超过 0.3 核，内存超 256MB 直接触发 OOM 重启 (Exit 137)
              memory: 256Mi
---
# 文件 3：service.yaml —— 对应面板【服务发现 -> Services】
apiVersion: v1
kind: Service
metadata:
  name: vite-notes
  namespace: vite-notes
spec:
  type: ClusterIP
  selector:
    app: vite-notes            # 关键纽带！只要哪个健康 Pod 身上贴着 app=vite-notes，流量就自动转给谁
  ports:
    - name: http
      port: 80                 # Service 对内暴露的固定虚拟端口
      targetPort: http         # 转给底下 Pod 容器的 http (80) 端口
---
# 文件 4：ingress.yaml —— 对应面板【服务发现 -> Ingresses】
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vite-notes
  namespace: vite-notes
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod  # 让集群里的证书插件自动去申请免费 HTTPS 证书
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - notes.wosnxuw.top
      secretName: vite-notes-tls  # 签下来的 HTTPS 证书自动存进【Secret】菜单的 vite-notes-tls 里
  rules:
    - host: notes.wosnxuw.top     # 外网访问这个域名时
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: vite-notes  # 转交给上面文件 3 定义的那个 Service 的 80 端口！
                port:
                  number: 80
```

看懂这 4 个文件的串联关系，你就已经掌握了 K8s 最核心的 80% 日常用法：外部域名进 `Ingress` $\rightarrow$ 转给内部固定总机 `Service` $\rightarrow$ 按 `app: vite-notes` 标签找到活着的 `Pod`（由 `Deployment` 负责看管和引用 `Secret / ConfigMap / PVC`）。

### 日常怎么用命令行（`kubectl`）代替点面板？

如果不打开 Rancher 网页，想在自己电脑终端里查看上面这些菜单，首先要配好登录凭证文件 `kubeconfig`（默认放在 `~/.kube/config`，里面只记录了集群的 URL、CA 证书和你的身份密钥，跟业务部署无关）。

`kubectl` 会按以下优先级寻找凭证：
1. 命令行临时指定：`--kubeconfig /path/to/config`
2. 环境变量：`KUBECONFIG`（可以用冒号拼接多个集群的文件）
3. 默认路径：`~/.kube/config`（如果管多个集群，比如 `fabu-dev` 和 `fabu-prod`，可以用 `kubectl config get-contexts` 查看列表，并用 `kubectl config use-context <集群名>` 一键切换当前操作的集群）。

连上之后，面板上的每个菜单跟 `kubectl` 命令是一一对应的：

| 你在 Rancher 面板看的位置 | 终端等价的 `kubectl` 查询命令 | 出问题时的排障三板斧 |
| :--- | :--- | :--- |
| 工作负载 $\rightarrow$ Deployments | `kubectl get deploy -n <命名空间>` | `kubectl rollout restart deploy/<名字> -n <命名空间>`（优雅滚动重启） |
| 工作负载 $\rightarrow$ Pods | `kubectl get pods -n <命名空间> -o wide` | ① Pod 起不来（卡在 `Pending / ImagePullBackOff`）：<br/>`kubectl describe pod <Pod名> -n <命名空间>`（拉到最底下看 Events 报错原因）<br/>② Pod 反复崩溃（`CrashLoopBackOff`）或看业务日志：<br/>`kubectl logs -f <Pod名> -n <命名空间>`<br/>③ 进容器内部开终端：<br/>`kubectl exec -it <Pod名> -n <命名空间> -- sh` |
| 服务发现 $\rightarrow$ Services | `kubectl get svc -n <命名空间>` | `kubectl get endpoints <Service名> -n <命名空间>`（看底下有没有成功绑上 Pod IP） |
| 服务发现 $\rightarrow$ Ingresses | `kubectl get ing -n <命名空间>` | `kubectl describe ing <Ingress名> -n <命名空间>` |
| 存储 $\rightarrow$ ConfigMap / Secret | `kubectl get cm,secret -n <命名空间>` | `kubectl get cm <名字> -n <命名空间> -o yaml`（打印配置内容） |
| 存储 $\rightarrow$ PVC / PV / StorageClass | `kubectl get pvc,pv,sc -A` | `kubectl describe pvc <PVC名> -n <命名空间>`（看为什么挂不上硬盘） |

### 附：为什么面板上经常提示“由 Helm 管理，请勿直接手动编辑 YAML”？

当要部署的大型软件包含几十个 YAML，或者同一套应用要在 `dev / prod` 传不同的镜像 Tag 和域名时，没人会手改几十处 YAML，而是用下面两个模板工具之一：
1. **Kustomize（给自己的业务代码打补丁）**：就像本仓库的 `deploy/overlays/prod/kustomization.yaml` 一样，基础目录 `deploy/base/` 放纯原生 YAML，然后在 `prod/` 下只写三行补丁把镜像 Tag 替换掉，用 `kubectl apply -k` 叠加生效。
2. Helm（K8s 世界的 `apt / homebrew` 应用商店安装包）：把复杂的开源软件（如 Redis 集群、Traefik、监控套件）打包成带模板变量的安装包（Chart），对外只留一个参数文件 `values.yaml`。很多企业环境（如 RKE2 + Rancher）内置了 Helm。凡是通过 Helm 装进来的应用，如果你直接在面板里手改了它的 Deployment YAML，下次别人或流水线一跑 `helm upgrade`，你的手动修改就会被 Helm 模板当场覆盖掉。因此改 Helm 应用永远要去改它的 `values.yaml` 配置入口。

---

## 四、第二层（底层引擎）：掀开黑盒，K8s 集群自己是怎么运转的？

现在你已经完全搞懂了第一层（怎么用）：你只管把 `Deployment`、`Service`、`Ingress` 的 YAML 提交给集群，集群就会自动把一切安排妥当。

这时候我们再退后一步，掀开集群的机箱盖子，看看普通教程一上来就讲的那堆底层概念：当你敲下 `kubectl apply -f deployment.yaml` 的那一刻，集群底下的机器之间到底发生了什么？

### 1. 主从架构：控制平面（Control Plane） vs 工作节点（Worker Node）

一个 K8s 集群由多台服务器（物理机或云主机，统称为 Node 节点）组成，按角色分为“大脑”和“手脚”两部分：

```text
你的命令 (kubectl / Rancher 面板 / Helm / ArgoCD)
  --> 统一发往集群的大脑：

[大脑：控制平面 Control Plane (旧称 Master 节点，一般不跑业务代码，只管发号施令)]
  - 1. kube-apiserver          (前台总机：整个集群唯一的 API 入口，负责鉴权、校验 YAML，也是唯一有资格读写 etcd 数据库的组件)
  - 2. etcd                    (核心账本：一个高可用键值数据库，类似 Redis，把整个集群所有 YAML 的期望状态和当前状态全存在里面)
  - 3. kube-controller-manager (监工总队：后台跑着 Deployment/Node/Job 等一堆死循环控制器，盯着账本，发现实际状态跟期望不符就报警修正)
  - 4. kube-scheduler          (排班调度员：专门盯着那些刚建出来、还没分配去哪台机器跑的 Pod，挑一台 CPU/内存最宽裕的机器分配给它)

  --> 各台工作机器主动连向 apiserver 领活：

[手脚：工作节点 Worker Node 1..N (真正跑你业务 Pod 的苦力服务器)]
  - 1. kubelet                 (驻场包工头：每台机器必装的核心 Agent，听 apiserver 的指令，调用本机容器引擎把 Pod 拉起来并盯着它的健康探针)
  - 2. container-runtime       (容器运行时：比如 containerd 或 CRI-O，类似 Docker Engine，真正负责去拉镜像并调 Linux 内核跑起容器)
  - 3. kube-proxy              (本机交通警：在本机维护 iptables / IPVS 转发规则，把访问虚拟 Service IP 的流量准确拐进真实的 Pod IP)
```

你看，刚才第一层里你提交了一个 `Deployment`（要求跑 3 个副本），底层这几个组件就是做了一次极其丝滑的流水线接力：
1. 你把 YAML 发给前台 `kube-apiserver`，它把你的要求记在 `etcd` 账本上；
2. 监工 `kube-controller-manager` 看账本发现：“要求有 3 个 Pod，现在账本上还是 0 个”，立刻往账本上登记了 3 个待创建的 `Pod` 清单；
3. 调度员 `kube-scheduler` 看到账本上有 3 个还没分房子的裸 `Pod`，看了一圈机器余量，在账本上批注：“1 号和 2 号 Pod 分给 `Node-A`，3 号 Pod 分给 `Node-B`”；
4. 驻扎在 `Node-A` 和 `Node-B` 机器上的包工头 `kubelet` 看到账本上有分给自家机器的 Pod，立刻喊本机的 `containerd` 去拉镜像、建容器，跑起来之后再通过 `apiserver` 把账本上的状态改成绿色的 `Running`！

> 为什么说这一层在日常写业务时“其实不用太关心”？
> 因为只要集群已经搭好了，上面这四步接力完全在毫秒级自动完成。只有当集群本身坏了（比如 Master 节点死机了——生产环境通常会部署 3 台 Master 节点，基于少数服从多数的共识算法选出 1 主 2 备来保证 `etcd` 和 `apiserver` 不死；或者某台 Worker 机器上的 `kubelet` 掉线了导致节点变成 `NotReady`），运维才需要去修这些底层组件。

### 2. 怎么拥有一套 K8s 集群？主流发行版一表看懂

正是因为 K8s 底层由上面这么多独立组件拼成，如果像装 Nginx 那样去下载源码把 `apiserver`、`etcd`、`kubelet`、网络插件（CNI）、内部 DNS（CoreDNS）一个个手工配起来并签发双向证书，能把人折腾疯。

所以现实中，没有人会纯手工散装 Kubernetes，大家都是根据场景直接用现成的“打包发行版”或云厂商托管服务：

| 名字 | 它到底是什么？ | 底层怎么装控制平面的？ | 什么时候用它？ |
| :--- | :--- | :--- | :--- |
| kubeadm | K8s 官方出品的标准集群安装引导工具，装出来的最接近原版上游（Upstream）K8s | 把 `apiserver`、`etcd`、`scheduler` 作为特殊的“静态 Pod”，由 Master 机器上的 `kubelet` 直接拉起（所以在 `kube-system` 命名空间里能看到这些组件的 Pod） | 想学习最标准的官方多机架构，或传统企业自建标准集群 |
| K3s | Rancher 团队出品（2020 年被 SUSE 收购）的极简轻量级 K8s 发行版 | 单进程奇迹：把上面整个控制平面、内置数据库、containerd、Flannel 网络、CoreDNS、甚至默认的 Traefik Ingress 网关 和本地磁盘分配器，全部塞进了一个不到 100MB 的单二进制文件里，作为宿主机的一个 `k3s.service` 进程直接跑起来（所以你在 K3s 里敲 `kubectl get pods -A` 根本看不到 `kube-apiserver` 的 Pod，因为它直接融进宿主机 `k3s server` 进程里了） | 个人买一台云服务器自建集群、边缘计算、单机或两三台小机器跑全套云原生（一条命令 30 秒装完，省内存且功能 100% 完整） |
| RKE2 | Rancher 面向企业生产环境的下一代旗舰发行版 | 吸收了 K3s 的易安装特性，但恢复了上游 K8s 的标准多组件隔离架构与严格的企业级安全合规，默认内置 Helm 控制器 | 公司内网私有云生产环境（企业最常见的黄金组合就是：底层用 RKE2 搭集群 + 上面挂 Rancher WebUI 面板统一管理） |
| minikube / kind | 在个人电脑（Mac / Windows）本地启动一个单节点玩具集群的工具 | 把整个 K8s 塞进本地的一台小虚拟机（minikube）或一个本地 Docker 容器（kind）里 | 不买服务器，纯粹在自己笔记本上练习敲 `kubectl` 命令 |
| EKS / GKE / ACK | 亚马逊 AWS EKS、谷歌 GKE、阿里云 ACK 等公有云厂商提供的托管版 K8s | 云厂商把整个控制平面（大脑）全包了——你连 Master 节点长什么样都看不到、也不用操心 `etcd` 备份，你只管花钱买 Worker 机器挂上去跑业务 Pod | 绝大多数商业互联网公司的生产首选 |
