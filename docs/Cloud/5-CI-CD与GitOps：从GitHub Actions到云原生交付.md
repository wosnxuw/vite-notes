# CI-CD与GitOps：从GitHub Actions到云原生交付

前面几篇解决了“如何把代码打包成标准容器镜像”以及“如何在 Kubernetes 集群里编排运行容器”。但在真实的工程团队里，还有一个连接“开发者敲下 `git push`”与“线上集群完成更新”的关键桥梁：自动化交付流水线。

为什么同样是自动化部署，有的团队用 GitHub Actions / GitLab CI / Jenkins，有的团队却要大费周章地在集群里额外部署一套 Tekton + ArgoCD 搞所谓的 GitOps？这两种模式到底差在哪？这一篇把 DevOps 协作理念、CI 流水线语法（GitHub Actions 实战）、Push 与 Pull 两种部署范式、以及单机 K3s 全套云原生 GitOps 交付架构彻底串起来。

---

## 一、概念正本清源：DevOps、CI/CD 与 GitOps 到底是什么关系？

这三个词经常被混在一起用，但它们其实处于三个完全不同的抽象层次：

```text
顶层（组织文化与协作哲学）： DevOps (Development + Operations，打破开发与运维甩锅墙的协作模式)
  --> 中层（工程实践与自动化闭环）： CI / CD (持续集成 / 持续交付与持续部署)
        --> 底层（云原生时代实现 CD 的最佳实践规范）： GitOps (以 Git 仓库为唯一事实来源 + 集群内部控制器主动拉取收敛)
```

### 1. DevOps：不是某个软件工具，而是一种消除“人肉运维”的工程文化

传统软件开发模式里，开发（Dev）和运维（Ops）之间有一堵高墙：
- 开发写完代码，打包丢给运维；运维手工 SSH 连上服务器配环境、改配置、重启服务；一旦线上出故障，开发怪运维环境配错了，运维怪开发代码有 Bug，互相甩锅。
- **DevOps**（注意中间没有空格，是 `Development + Operations` 的合成词）描述的是一种团队协作文化与工程方法论，而不是指你装了 Jenkins 或 GitHub Actions 就自动变成了 DevOps。
- **检验 DevOps 是否落地的黄金标尺**：“任何需要人手动 SSH 登录到生产服务器上去敲命令做的事情（拉代码、改配置、重启进程、看日志、续签证书），都是 DevOps 还没做到位的标志。”

### 2. CI / CD：把“合并代码”与“上线发布”变成确定性的机械动作

为了实现 DevOps 的目标，工程上把代码从提交到上线的过程切成了两棒接力：

- CI（Continuous Integration，持续集成）：
  - **触发时机**：开发者每次向 Git 仓库 `push` 代码或发起 `Pull Request / Merge Request` 时自动触发。
  - **干什么活**：启动一个干净的临时容器或虚拟机，拉取最新代码 $\rightarrow$ 跑静态检查（Lint） $\rightarrow$ 编译构建 $\rightarrow$ 自动运行单元测试与集成测试套件（如 `pytest`） $\rightarrow$ 如果通过，将程序打包成带版本号（如 Commit SHA）的 Docker 镜像并推送到镜像仓库（如 GHCR 或公司私有 Harbor）。
  - **解决什么痛点**：防止有人把编译不过或破坏已有功能的脏代码合进主干；确保主干代码在任何时刻都是健康的、随时可发布的。
- CD（Continuous Delivery 持续交付 / Continuous Deployment 持续部署）：
  - **干什么活**：接过 CI 构建好的那个新版本镜像，自动把它部署到测试环境、预发环境或生产环境，并跑冒烟测试验证服务正常。
  - **两者的细微差别**：持续交付（Delivery） 是流水线自动把一切部署包和预发环境都准备妥当，最后上生产环境前留一个“人工点击审批按钮”；而 持续部署（Deployment） 则是只要主分支（如 `main` 或 `release-*`）的自动化测试全绿，连人工按钮都不用点，全自动直接发到线上生产环境，让开发者从“半年发一次大版本的部署恐惧”变成“一天随时平滑交付十几次价值”。

---

## 二、CI 流水线实战：以 GitHub Actions（及 Jenkins 对比）为例

在云原生时代之前，企业自建 CI 的绝对霸主是 Jenkins；而在 2019 年之后，以 GitHub Actions 和 GitLab CI 为代表的托管式 YAML 流水线成为了现代工程的事实标准。

### 1. GitHub Actions 的五大核心组件模型

GitHub Actions 本质上是 GitHub 官方提供的一套 SaaS（软件即服务）自动化流水线平台。只要你在代码仓库的 `.github/workflows/` 目录下放一个 `.yml` 文件，GitHub 就会替你完成调度。它的内部层级非常清晰：

```text
1. Event (触发事件 on: push / pull_request / schedule 定时 / workflow_dispatch 手动点击)
  --> 2. Workflow (工作流：对应 .github/workflows/ 下的一个 .yml 文件)
        --> 3. Job (作业：默认并行执行，可通过 needs: 声明先后依赖；每个 Job 分配一台全新干净的虚拟机 Runner！)
              --> 4. Runner (运行器服务器：GitHub 官方托管的 ubuntu-latest / macos-latest，或你自己部署的 Self-hosted Runner)
                    --> 5. Step (步骤：在同一个 Runner 里按顺序依次执行，可以是 run: 敲 Shell 命令，也可以是 uses: 调用现成 Action 插件)
```

需要记住的三个底层运行特征：
1. **每个 Job 都在一台全新的虚拟机里从零开始**：如果一个 Workflow 里定义了 `job_build` 和 `job_test` 两个 Job，它们默认会同时在两台完全独立的虚拟机上并行开跑；`job_build` 在本地磁盘生成的文件，`job_test` 默认是看不到的（除非通过 `actions/upload-artifact` 传递，或者把它们写成同一个 Job 内部的上下两个 Step）。
2. **官方托管 Runner 的算力配额**：对于 Public（公开开源）仓库，GitHub 官方提供的标准 Linux Runner（4 核 CPU、16GB 内存、14GB SSD）是完全免费且不限时长的；对于私有仓库则有每月免费分钟数额度限制。
3. `uses:` 预制动作（Action 插件） vs `run:` 原生脚本：
   刚启动的一台全新 Runner 虚拟机里是空的，甚至连你自己仓库的代码都没有！因此几乎所有 Job 的第一步都是写 `uses: actions/checkout@v4`（调用官方插件把你当前仓库的代码 `git clone` 到这台 Runner 上），第二步调用 `uses: actions/setup-python@v5` 或 `actions/setup-node@v4` 配好指定版本的语言环境，随后再用 `run:` 执行你自己的测试或打包命令。

### 2. 完整实战模板：含 Matrix 矩阵测试与 Codecov 覆盖率上报

假设我们要为一个 Python 项目配置一套标准的 CI 流水线：每次向 `main` 或 `develop` 分支推送代码或提 PR 时，自动拉代码、装依赖、跑单元测试与 API 测试，并将测试代码覆盖率报告上传给 Codecov（一个专门统计“你的测试用例到底真实执行了源码里百分之多少的代码行”的 SaaS 服务，防止偷懒写空壳测试）：

```yaml
name: Python CI Pipeline

# 1. 何时触发工作流？
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

# 2. 定义作业列表
jobs:
  test:
    # 在什么系统上跑？（这里结合了下面的 matrix 矩阵变量）
    runs-on: ${{ matrix.os }}

    # 【进阶技巧】Matrix 矩阵策略：用一份配置自动排列组合裂变出多个并行 Job
    # 例如下面 2 种操作系统 × 2 个 Python 版本 = 自动并发启动 4 台虚拟机同时测试兼容性！
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        python-version: ["3.11", "3.12"]

    steps:
      # Step 1: 把当前仓库代码检出到 Runner 虚拟机上
      - name: Checkout repository
        uses: actions/checkout@v4

      # Step 2: 安装指定版本的 Python 并开启 pip 缓存
      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'

      # Step 3: 安装项目依赖
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      # Step 4: 运行单元测试并生成 XML 格式的覆盖率报告 (--cov=src)
      - name: Run unit tests with coverage
        run: |
          python -m pytest tests/test_calculator.py -v --cov=src --cov-report=xml

      # Step 5: 运行 API 集成测试
      - name: Run API tests
        run: |
          python -m pytest tests/test_api.py -v

      # Step 6: 将生成的 coverage.xml 上传至 Codecov 平台
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage.xml
          flags: unittests
          name: codecov-umbrella
```

### 3. 传统先驱 Jenkins vs 现代云原生 CI（GitHub Actions / GitLab CI / Tekton）

在不少企业内网里，依然能看到老牌的 Jenkins。它与现代 CI 的核心区别在于：
- **架构与环境隔离**：传统 Jenkins 是一台你自己长期维护的 Java 服务器，上面配了固定的构建节点，所有任务都在同一个宿主机环境里跑，很容易出现依赖污染；而 GitHub Actions / GitLab CI / Tekton 天生就是容器化 / 一次性沙箱化的，每次构建起一个全新容器，跑完即焚。
- **编排语言**：现代 CI 统一使用声明式的 YAML；而 Jenkins 的 Pipeline（`Jenkinsfile`）使用的是 Groovy——一种运行在 JVM（Java 虚拟机）上的动态脚本语言（语法像 Python/Ruby，但底层能无缝调用任何 Java 类库，也可以被 Java 代码编译调用）。虽然写复杂循环逻辑很灵活，但维护成本远高于声明式 YAML。

---

## 三、Push 模式 vs Pull 模式（GitOps）：为什么生产集群更推崇 GitOps？

现在 CI 已经帮我们跑过了测试，并且把最新代码打包成 Docker 镜像 `ghcr.io/wosnxuw/vite-notes:fc651a0` 推送到了镜像仓库。接下来进入 CD（把新镜像部署到 Kubernetes 集群里），工业界有两条截然不同的架构路线：

### 路线 1：传统的推送式部署（Push-based CD Pipeline）

这是大家最容易想到的直觉做法：直接在 GitHub Actions 或 Jenkins 流水线的最后一个 Step 里，放上生产 K8s 集群的最高权限 `kubeconfig` 密钥，或者放上生产服务器的 SSH 私钥，由 CI Runner 在集群外部直接执行一条 `kubectl set image` 或 `helm upgrade`，强行把新镜像推（Push）进生产集群：

```text
Push 模式 (CI 流水线直接伸手进生产集群)：
开发者 git push --> CI Runner (编译测试 + 推镜像到 GHCR) --[持有生产集群上帝权限 kubeconfig]--> 直接向生产 K8s 执行 kubectl apply
```

Push 模式在生产安全与治理上的三大隐患：
1. **权限外泄风险极高**：你的外部 CI 平台（如公网的 GitHub Actions 或一台安全性一般的 Jenkins 机器）必须持有生产 K8s 集群的管理员凭据，而且生产集群的 `kube-apiserver`（6443 端口）必须对外部 CI 网络开放。一旦 CI 平台被攻破，整个生产集群直接沦陷。
2. 状态漂移（Configuration Drift）黑洞：如果某天半夜线上出故障，某个运维偷偷用自己的电脑执行 `kubectl edit` 临时改了生产集群的环境变量或镜像版本，此时 Git 仓库里的配置和线上真实跑的配置就不一致了；等下周 CI 再次触发推送时，上次的临时修复被莫名其妙覆盖掉，当场引发二次事故。
3. **CI 只是一次性触发**：如果 CI 执行 `kubectl apply` 的那一秒网络抖动或者集群正在升级，流水线报错退出就结束了，没有人替你持续兜底。

### 路线 2：拉取式部署（Pull-based GitOps —— 以 ArgoCD / Flux 为代表）

为了彻底解决 Push 模式的痛点，Weaveworks 在 2017 年正式提出了 GitOps 范式。

GitOps 的核心定义只有一句话：以 Git 仓库作为基础设施和应用部署状态的“唯一事实来源（Single Source of Truth）”，并在目标 Kubernetes 集群内部署一个守护控制器（如 ArgoCD），由集群自己从内部往外监控 Git 仓库的变化，一旦发现 Git 里的 YAML 变了，就主动拉取（Pull）并在集群内自动同步收敛。

```text
Pull 模式 / GitOps (集群内部驻扎 ArgoCD，CI 绝不触碰生产集群)：
1. CI 阶段： 开发者 git push --> CI (编译测试 + 推镜像 ghcr.io/app:v2) --> CI 自动提交一个 Commit 修改 Git 部署清单里的 image tag 为 v2
2. CD 阶段： 驻扎在 K8s 集群内部的 ArgoCD (24 小时盯着 Git 部署仓库) --> 发现 Git 里的 tag 变成了 v2，与集群现状(v1)不符 --> 主动拉取 YAML 并在集群内 apply 收敛！
```

你看，从 Push 换成 Pull（GitOps）之后，立下了三条铁律，瞬间带来了质的飞跃：

1. **声明式配置（Declarative）**：Git 里不仅有“业务源码”，还有完整描述“当前生产环境到底应该跑哪个镜像版本、多少副本”的 K8s YAML 清单。
2. Git 是修改线上环境的唯一入口（Git as Single Entry Point）：
   - 想要发布新版本？CI 去改 Git 里的镜像 Tag；
   - 想要回滚到昨天的版本？直接对部署仓库执行一次 `git revert`，ArgoCD 看到 Git 退回去了，3 秒钟内自动把线上集群回滚到昨天的状态！
   - 所有的线上变更都有极其清晰的 `git log` 和 Pull Request 审批记录（谁、在几点几分、为什么改了哪个配置，一清二楚）。
3. 持续状态自愈与更高安全性（Continuous Reconciliation & Pull Security）：
   - CI 流水线再也不需要持有生产集群的 `kubeconfig` 密钥（CI 只需要有写 Git 部署仓库的权限），生产集群也不需要向外网暴露 API 端口，只要集群内部能往外访问 Git 仓库和镜像仓库即可；
   - 为什么 CI 是等 Webhook 被动触发一次，而 CD（ArgoCD）却是 24 小时主动持续监听？
     因为 CI（编译打包）是一锤子买卖，一个 Commit 只需要构建一次镜像；而 CD 守护的是线上真实运行状态——哪怕没有任何新的 Git 提交，万一有人手贱用 `kubectl edit` 偷偷改了线上的 `Deployment` 副本数或删了某个 `Service`，24 小时巡逻的 ArgoCD 发现“集群实际状态偏离了 Git 仓库里的期望状态（OutOfSync）”，就会立刻把人工偷改的配置纠正回 Git 里描述的样子！

---

## 四、两种真实的 GitOps 工业落地架构拆解

理解了原理，我们直接对比两套在真实工作中跑通的 GitOps 完整链路：一套是企业级多仓库微服务架构（GitLab CI + 独立 Manifest 仓库 + ArgoCD），另一套是本笔记仓库在单机 K3s 上亲手搭建的全集群内闭环架构（K3s + Traefik + cert-manager + Tekton + ArgoCD）。

### 案例 1：企业级多仓库标准流水线（业务代码仓与部署清单仓分离）

在公司团队协作中，往往有十几个微服务代码仓库，通常会专门建立一个独立的部署清单 Git 仓库（Manifest Repo，收集所有微服务在 dev/prod 各环境的 YAML）：

1. **代码提交与 CI 流水线**：
   开发者向业务仓库 `push` 代码 $\rightarrow$ GitLab 检测到新 Commit，自动拉起 `.gitlab-ci.yml` 流水线 $\rightarrow$ 依次跑完：`代码规范静态检查 (Lint) -> 单元测试 -> 编译打包 -> 构建 Docker 镜像推送到内网 Harbor -> 启动临时容器跑冒烟测试`。
2. **自动修改部署仓库（CI 的最后一棒）**：
   如果当前分支是受保护的 `master` 或 `release-*` 分支，GitLab CI 会执行写在业务仓库 `./ci/` 目录下的一个 Python 自动化脚本。这个脚本不会去连 K8s 集群，而是去 `git clone` 那个专门用于部署的 Manifest Git 仓库，把对应服务 YAML 里的镜像 Tag 更新为刚刚构建出来的镜像版本号，并自动 `git commit && git push` 到部署仓库。
3. **ArgoCD 自动同步收敛（CD 接棒）**：
   集群里的 ArgoCD 是一个全局公共组件（它不属于某一个业务仓库，业务代码甚至完全不需要知道 ArgoCD 的存在）。ArgoCD 一直在监控那个部署仓库，一看到里面的 YAML 发生了 Commit 变更，立刻拉取最新配置并 `apply` 到生产集群里，触发 K8s Deployment 滚动更新。

> 为什么企业更喜欢把“业务代码仓”和“部署 YAML 仓”拆成两个独立的 Git 仓库？
> 一是因为一个系统往往由十几个微服务仓库组成，集中到一个部署仓库里方便统一看清整套环境的全貌和做整体版本快照；二是因为如果不分开，每次 CI 构建完往业务仓库自己身上自动 `git push` 一个“更新 YAML Tag”的 Commit，如果没配好 `[skip ci]` 过滤规则，这个新 Commit 又会再次触发新一轮的 CI 构建，变成无限死循环！

### 案例 2：本仓库单机 K3s 全栈云原生闭环（K3s + Tekton + ArgoCD + cert-manager）

如果你有一台带公网 IP 和域名的个人云服务器，不想依赖外部的 GitHub Actions，而是想在自己的单机 K8s 集群内部完成从收 Webhook、跑 CI 构建、签发 HTTPS 证书到 ArgoCD 自动发布的 100% 纯正云原生闭环，整套集群里到底跑了哪些组件？

这正是本笔记仓库 `./deploy` 目录曾经在线上真实跑通的完整架构。当时在那台只装了单节点 K3s 的服务器（节点名为 `note`）上，通过 `kubectl get pods -A` 看到的五大命名空间各司其职：

```text
外部流量 / GitHub Push 事件 --> 打向服务器 80 / 443 端口 (由 kube-system 下的 svclb-traefik 转交给 traefik 网关)

[1. 入口与基础底座：kube-system & cert-manager]
  - traefik                 (K3s 默认内置的 Ingress 网关：既是用户访问笔记网站的入口，也是接收 GitHub Webhook 的入口)
  - cert-manager (+webhook) (全自动证书管家：看到 Ingress 上的注解，自动找 Let's Encrypt 完成 ACME 校验并把证书存进 Secret)
  - coredns                 (集群内部 DNS 解析)
  - local-path-provisioner  (本地磁盘存储分配器：把服务器本地目录动态切给 PVC 当持久化卷用)

  --> 分支 A (当 GitHub 推送代码触发 Webhook 请求打进 Traefik 时)：
[2. 云原生 CI 引擎：tekton-pipelines & ci 命名空间]
  - tekton-triggers-controller / webhook / interceptors (监听并校验来自 GitHub 的 Webhook 事件，在 ci 命名空间生成一次性的 TaskRun Pod)
  - tekton-pipelines-controller / dashboard             (调度执行具体的 CI 流水线任务，并提供 WebUI 查看构建日志)
  - ci/vite-notes-build-xxxx-pod (0/3 Completed)        (每次 git push 动态诞生的一次性构建 Pod，包含 3 个按序执行的 Step 容器：
                                                          Step 1: 拉取最新源码 --> Step 2: 构建新镜像推向 GHCR --> Step 3: 修改 git 仓库 deploy/overlays/prod/kustomization.yaml 里的 newTag 并推回 GitHub！跑完即变为 Completed 退出)

  --> 分支 B (当 Git 仓库里的 kustomization.yaml 的 newTag 发生变更时)：
[3. 云原生 GitOps CD 引擎：argocd & vite-notes 命名空间]
  - argocd-repo-server               (定时或收通知拉取 Git 仓库，调用内置 Kustomize 把 deploy/base 与 deploy/overlays/prod 渲染成最终 YAML)
  - argocd-application-controller-0  (核心控制器：实时对比渲染出来的 Git 期望 YAML 与集群当前状态，发现 image tag 变了，立刻调用 K8s API 执行同步)
  - argocd-server / dex / redis      (ArgoCD 的可视化 WebUI 面板、SSO 登录与状态缓存)
  - vite-notes/vite-notes-xxxx-pod   (最终平稳完成滚动更新的笔记 Nginx 容器)
```

把这两个案例放在一起对比就会发现：无论底层是用 GitHub Actions + GitHub Pages 极简托管，还是用 GitLab CI + ArgoCD，抑或是 Tekton + ArgoCD 全自建，现代云原生交付的核心骨架从来没有变过——“用容器镜像锁死运行环境，用声明式 YAML 描述集群状态，用自动化流水线代替人肉 SSH”。
