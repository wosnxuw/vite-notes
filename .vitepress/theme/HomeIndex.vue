<script setup>
import { ref, computed } from 'vue'
import { withBase } from 'vitepress'

const activeGroup = ref('all')
const query = ref('')

const groups = [
  { id: 'all', label: '全部专题' },
  { id: 'arch', label: 'AI 与分布式基础设施' },
  { id: 'sys', label: '系统编程与内核' },
  { id: 'graphics', label: '图形几何与编译工具' },
  { id: 'hardware', label: '硬件与日常' }
]

const catalog = [
  {
    id: 'LLM',
    group: 'arch',
    domain: 'LLM',
    summary: 'Transformer 架构、本地量化推理、上下文工程与 Harness 机制拆解',
    entries: [
      { title: '1-Transformer与基础概念', path: '/LLM/1-Transformer与基础概念', note: 'Attention / Token / 训练阶段' },
      { title: '2-模型推理与本地部署', path: '/LLM/2-模型推理与本地部署', note: 'KV Cache / 量化 / vLLM & Ollama' },
      { title: '3-Agent与上下文工程', path: '/LLM/3-Agent与上下文工程', note: 'Prompt 结构 / Tool Use / 记忆管理' },
      { title: '4-Harness机制拆解', path: '/LLM/4-Harness机制拆解', note: '沙箱执行 / 循环控制 / 权限边界' },
      { title: '5-Agent落地实战与反思', path: '/LLM/5-Agent落地实战与反思', note: '工程故障模式与确定性约束' },
      { title: '6-AI协作与文档编写', path: '/LLM/6-AI协作与文档编写', note: '仓库规范与上下文维护' },
      { title: '7-从机器学习到Agent', path: '/LLM/7-从机器学习到Agent', note: '范式演进全景' }
    ]
  },
  {
    id: 'Network',
    group: 'arch',
    domain: 'Network',
    summary: '网卡路由、TCP 状态机、NAT 穿透、隧道跳板与本机流量分流排障',
    entries: [
      { title: '1-分层模型、网卡与路由基础', path: '/Network/1-分层模型、网卡与路由基础', note: 'L2-L7 / 路由表 / 虚拟交换机' },
      { title: '2-传输层核心：TCP、UDP与状态机', path: '/Network/2-传输层核心：TCP、UDP与状态机', note: '握手挥手 / 拥塞控制 / Socket' },
      { title: '3-NAT、公网链路与内网穿透', path: '/Network/3-NAT、公网链路与内网穿透', note: 'STUN / DERP / Tailscale 组网' },
      { title: '4-隧道、代理与跳板：从SSH到VPN', path: '/Network/4-隧道、代理与跳板：从SSH到VPN', note: '端口转发 / TUN 虚拟网卡' },
      { title: '5-本机流量治理：环境变量、分流与DNS', path: '/Network/5-本机流量治理：环境变量、分流与DNS', note: 'FakeIP / 防污染 / 透明代理' },
      { title: '6-代理协议栈与工具参考', path: '/Network/6-代理协议栈与工具参考', note: 'VLESS / Reality / 核心配置' },
      { title: '7-网络排障方法论与真实案例库', path: '/Network/7-网络排障方法论与真实案例库', note: 'tcpdump / curl / 路由追踪' }
    ]
  },
  {
    id: 'Web',
    group: 'arch',
    domain: 'Web',
    summary: 'HTTP 演进、浏览器安全沙箱、JS 工具链、渲染架构与证书反代链路',
    entries: [
      { title: '1-HTTP协议与Web通信基础', path: '/Web/1-HTTP协议与Web通信基础', note: 'HTTP/1.1-3 / WebSocket / SSE' },
      { title: '2-浏览器运行机制、存储与安全边界', path: '/Web/2-浏览器运行机制、存储与安全边界', note: 'CORS / Cookie / 同源策略' },
      { title: '3-现代前端工程化与JS生态工具链', path: '/Web/3-现代前端工程化与JS生态工具链', note: 'ESM / Vite / 打包器演进' },
      { title: '4-前端框架、状态管理与渲染架构', path: '/Web/4-前端框架、状态管理与渲染架构', note: 'CSR / SSR / SSG / 响应式原理' },
      { title: '5-身份认证、授权与Web安全', path: '/Web/5-身份认证、授权与Web安全', note: 'Session / JWT / OAuth2 / OIDC' },
      { title: '6-证书签名、反向代理与Web部署链路', path: '/Web/6-证书签名、反向代理与Web部署链路', note: 'TLS 握手 / ACME / Nginx & Traefik' }
    ]
  },
  {
    id: 'Cloud',
    group: 'arch',
    domain: 'Cloud',
    summary: '硬件虚拟化、Linux 容器隔离、Docker 实战、Kubernetes 编排、GitOps 交付与分布式系统',
    entries: [
      { title: '1-虚拟化、转译与算力底座', path: '/Cloud/1-虚拟化、转译与算力底座', note: 'Hypervisor / KVM & QEMU / WSL2 / Rosetta 2 & Wine' },
      { title: '2-容器核心：Linux隔离机制与Docker架构', path: '/Cloud/2-容器核心：Linux隔离机制与Docker架构', note: 'Namespace / Cgroups / OverlayFS / containerd & runc' },
      { title: '3-Docker实战：网络、存储与空间治理', path: '/Cloud/3-Docker实战：网络、存储与空间治理', note: 'Volumes vs Bind Mounts / 网桥 DNS / Compose / 100GB 空间治理' },
      { title: '4-Kubernetes核心架构与资源模型', path: '/Cloud/4-Kubernetes核心架构与资源模型', note: 'Control Plane / K3s & RKE2 / Pod & Service & Ingress & PVC' },
      { title: '5-CI-CD与GitOps：从GitHub Actions到云原生交付', path: '/Cloud/5-CI-CD与GitOps：从GitHub Actions到云原生交付', note: 'GitHub Actions / Push vs Pull / Tekton + ArgoCD + Kustomize' },
      { title: '6-分布式系统、微服务与大数据全景', path: '/Cloud/6-分布式系统、微服务与大数据全景', note: 'XaaS / 微服务 & gRPC / MQTT & Kafka / HDFS & Spark & MPI' }
    ]
  },
  {
    id: 'C&C++',
    group: 'sys',
    domain: 'C & C++',
    summary: '内存布局、左右值与移动语义、多线程并发、OpenMP 与构建调试配置',
    entries: [
      { title: 'C基本', path: '/C&C++/C基本', note: '指针 / 内存对齐 / 预处理与编译期' },
      { title: 'Cpp基本', path: '/C&C++/Cpp基本', note: '面向对象 / 虚函数表 / RAII' },
      { title: 'C11及中级特性', path: '/C&C++/C11及中级特性', note: '智能指针 / auto / 类型推导' },
      { title: '左右值', path: '/C&C++/左右值', note: '移动构造 / std::move / 完美转发' },
      { title: 'lambda', path: '/C&C++/lambda', note: '闭包捕获 / 函数对象' },
      { title: '多线程', path: '/C&C++/多线程', note: 'std::thread / 互斥锁 / 条件变量与原子操作' },
      { title: 'OMP', path: '/C&C++/OMP', note: 'OpenMP 并行循环与规约调度' },
      { title: 'C&C++工程', path: '/C&C++/C&C++工程', note: 'CMake / 静态库与动态库 / ABI' },
      { title: '性能分析', path: '/C&C++/性能分析', note: 'Perf / 火焰图 / 缓存命中率' },
      { title: '字符集', path: '/C&C++/字符集', note: 'ASCII / Unicode / UTF-8 编码实现' },
      { title: 'Lua', path: '/C&C++/Lua', note: 'C 栈交互与脚本嵌入' },
      { title: 'LeetCode题', path: '/C&C++/LeetCode题', note: '常见数据结构与算法刷题记录' },
      { title: '现代硬件算法', path: '/C&C++/现代硬件算法', note: 'SIMD 与硬件亲和性' }
    ]
  },
  {
    id: 'Rust',
    group: 'sys',
    domain: 'Rust',
    summary: '所有权与借用检查、智能指针内部可变性、Trait 类型系统与 Tokio 异步运行时',
    entries: [
      { title: 'Rust基本', path: '/Rust/Rust基本', note: '所有权 / 生命周期 / 模式匹配' },
      { title: 'Rust智能指针', path: '/Rust/Rust智能指针', note: 'Box / Rc / Arc / RefCell / Cow' },
      { title: 'Rust进阶', path: '/Rust/Rust进阶', note: 'Trait 对象 / 泛型约束 / 并发安全' },
      { title: 'tokio', path: '/Rust/tokio', note: 'Future 状态机与异步任务调度' },
      { title: '工程构建', path: '/Rust/工程构建', note: 'Cargo Workspace 与特性开关' },
      { title: '常用', path: '/Rust/常用', note: '错误处理 anyhow/thiserror 与序列化' }
    ]
  },
  {
    id: 'Linux',
    group: 'sys',
    domain: 'Linux',
    summary: 'Unix 演进与发行版、启动与页表、动态链接、TTY 终端、SSH、Wayland 桌面与 Git 原理',
    entries: [
      { title: '1-Unix演进、发行版生态与系统基础', path: '/Linux/1-Unix演进、发行版生态与系统基础', note: 'Unix & BSD & POSIX / 信创生态 / systemd / Shell 与 PATH' },
      { title: '2-系统启动、虚拟内存页表与动态链接', path: '/Linux/2-系统启动、虚拟内存页表与动态链接', note: 'UEFI & initramfs / 多级页表 & TLB / .so 搜索与 SONAME' },
      { title: '3-命令传参哲学、文件描述符与TTY终端', path: '/Linux/3-命令传参哲学、文件描述符与TTY终端', note: 'POSIX-GNU-BSD 参数 / argv vs stdin / 重定向管道 / PTY 主从架构' },
      { title: '4-运维排障命令、SSH体系与现代终端工具', path: '/Linux/4-运维排障命令、SSH体系与现代终端工具', note: 'SSH 密钥与 Win sshd / iproute2 & ss / rg & zoxide & yazi / Neovim' },
      { title: '5-Linux图形桌面架构：从X11、Wayland到音频输入法', path: '/Linux/5-Linux图形桌面架构：从X11、Wayland到音频输入法', note: 'GTK & Qt / 浮动与平铺 WM / X11 vs Wayland / PipeWire & Fcitx5' },
      { title: '6-Git底层原理、分支模型与高级工作流', path: '/Linux/6-Git底层原理、分支模型与高级工作流', note: 'DAG 提交图 / Branch & HEAD / origin/main / rebase & worktree' }
    ]
  },
  {
    id: 'Python',
    group: 'sys',
    domain: 'Python',
    summary: 'uv 现代包管理、asyncio 事件循环、C 扩展混合调试与数据交换协议',
    entries: [
      { title: 'UV环境管理', path: '/Python/UV环境管理', note: 'pyproject.toml / 锁文件 / 解释器隔离' },
      { title: 'Python高级特性', path: '/Python/Python高级特性', note: '装饰器 / 生成器 / 元类与描述符' },
      { title: '异步', path: '/Python/异步', note: 'asyncio / Event Loop / 协程并发' },
      { title: 'import', path: '/Python/import', note: 'sys.path / 模块缓存与循环导入' },
      { title: 'XPython', path: '/Python/XPython', note: 'C++ 与 Python 跨语言混合断点调试' },
      { title: 'RPC', path: '/Python/RPC', note: 'Stub 序列化流转与 REST 对比' },
      { title: '正则表达式', path: '/Python/正则表达式', note: '贪婪匹配 / 捕获组与回溯' },
      { title: 'JSON', path: '/Python/JSON', note: '序列化边界与 Schema' },
      { title: 'XML', path: '/Python/XML', note: 'DOM / ElementTree 解析' },
      { title: 'hdf5', path: '/Python/hdf5', note: '科学计算层次化矩阵存储' }
    ]
  },
  {
    id: 'Software-Engineering',
    group: 'arch',
    domain: 'Software-Engineering',
    summary: 'Agent 编码反模式观察、控制反转与依赖注入、六边形/整洁架构、TDD 与 Qt MVC 实战',
    entries: [
      { title: 'Agent', path: '/Software-Engineering/Agent', note: '偶然复杂度 / 伪测试约束 / 黑盒执念' },
      { title: '软件架构、控制反转与TDD', path: '/Software-Engineering/软件架构、控制反转与TDD', note: 'IoC & DI / 六边形与整洁架构 / Chicago vs London TDD / Qt MVC' }
    ]
  },
  {
    id: 'Tools',
    group: 'graphics',
    domain: 'Tools',
    summary: 'SWIG 跨语言绑定与窗口嵌入、Flex/Bison/ANTLR4 编译前端、FFmpeg 音视频与 OR-Tools 路径规划',
    entries: [
      { title: '1-跨语言绑定与原生窗口嵌入：JNI、JNA与SWIG实战', path: '/Tools/1-跨语言绑定与原生窗口嵌入：JNI、JNA与SWIG实战', note: 'Doxygen 符号提取 / SWIG typemap / JavaFX+Swing 嵌入 C++ HWND' },
      { title: '2-词法与语法分析器：从Flex&Bison到ANTLR4', path: '/Tools/2-词法与语法分析器：从Flex&Bison到ANTLR4', note: '.l & .y 三段式 / yylval / ANTLR4 .g4 / Listener vs Visitor' },
      { title: '3-FFmpeg音视频处理：容器封装、编解码与C-API', path: '/Tools/3-FFmpeg音视频处理：容器封装、编解码与C-API', note: 'Muxer & Codec / 码率计算 / AVPacket vs AVFrame / SwsContext' },
      { title: '4-运筹优化与工业路径规划：TSP、VRP与OR-Tools实战', path: '/Tools/4-运筹优化与工业路径规划：TSP、VRP与OR-Tools实战', note: '圆环质心聚合 / 尖点 0.1 引导系数 / 双机器人负载均衡与防撞' }
    ]
  },
  {
    id: 'OpenGL',
    group: 'graphics',
    domain: 'OpenGL',
    summary: '现代可编程渲染管线、光栅化与深度缓冲、Compute Shader 通用计算、NeRF 与 3DGS',
    entries: [
      { title: 'OpenGL API 入门', path: '/OpenGL/OpenGL API 入门', note: 'VAO / VBO / IBO / GLSL 着色器抽象' },
      { title: '光栅化', path: '/OpenGL/光栅化', note: '坐标变换 / Z-Buffer / Phong 光照模型' },
      { title: 'opengl通用计算', path: '/OpenGL/opengl通用计算', note: 'SSBO / Compute Shader 并行派发' },
      { title: 'NeRF与3DGS', path: '/OpenGL/NeRF与3DGS', note: '隐式 MLP 体积渲染 vs 显式三维高斯椭球可微泼溅' }
    ]
  },
  {
    id: 'OCC',
    group: 'graphics',
    domain: 'OCC',
    summary: 'OpenCASCADE 几何内核、B-Rep 拓扑结构与 CAD 空间位姿变换',
    entries: [
      { title: 'OpenCASCADE入门', path: '/OCC/OpenCASCADE入门', note: '模块划分 / Handle 智能指针与建模架构' },
      { title: 'PythonOCC基础知识', path: '/OCC/PythonOCC基础知识', note: 'TopoDS_Shape / Wire / Face 布尔运算' },
      { title: '位姿--从OCC到CAD', path: '/OCC/位姿--从OCC到CAD', note: 'gp_Trsf 齐次变换矩阵与欧拉角坐标系' }
    ]
  },
  {
    id: 'hardware',
    group: 'hardware',
    domain: 'hardware',
    summary: '显示面板光学参数、DDR 内存时序超频、声学频响曲线与相机传感器',
    entries: [
      { title: '显示器设备', path: '/hardware/显示器设备', note: 'IPS-MiniLED-OLED / 色域空间 / HDR 映射' },
      { title: '内存超频', path: '/hardware/内存超频', note: '颗粒体质 / 主副时序 / 电压调校' },
      { title: 'HIFI', path: '/hardware/HIFI', note: 'DAC 解码 / 耳放阻抗匹配 / 哈曼曲线' },
      { title: '相机', path: '/hardware/相机', note: '画幅等效焦距 / 曝光三角 / 动态范围' },
      { title: '客制化键盘', path: '/hardware/客制化键盘', note: 'Gasket 结构 / 轴体触发行程与键帽高度' }
    ]
  },
  {
    id: 'OS & Life',
    group: 'hardware',
    domain: 'OS / Web3 / life',
    summary: 'macOS 与 Windows 系统机制、本地包管理环境治理、Web3 基础与日常备忘',
    entries: [
      { title: 'macOS系统与开发环境', path: '/OS/macOS系统与开发环境', note: '键鼠映射 / Homebrew & Gatekeeper / fnm & uv & 本地 Docker 反思' },
      { title: 'Windows系统技巧与排障', path: '/OS/Windows系统技巧与排障', note: 'APIPA 双机直连 / 四级权限模型 / PowerShell / 睡眠自动唤醒排障' },
      { title: 'Web3', path: '/Web3/Web3', note: '共识机制 / 智能合约 / 钱包签名' },
      { title: '火车飞机', path: '/life/火车飞机', note: '出行航司与车型备忘' },
      { title: '基本护肤知识', path: '/life/基本护肤知识', note: '屏障清洁与活性成分' },
      { title: '油脂', path: '/life/油脂', note: '脂肪酸结构与食用油烟点' },
      { title: '风水', path: '/life/风水', note: '居住空间采光与动线通识' }
    ]
  }
]

const totalDocs = computed(() =>
  catalog.reduce((sum, item) => sum + item.entries.length, 0)
)

const filteredCatalog = computed(() => {
  const q = query.value.trim().toLowerCase()
  return catalog
    .filter((section) => activeGroup.value === 'all' || section.group === activeGroup.value)
    .map((section) => {
      if (!q) return section
      const matchedEntries = section.entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.note.toLowerCase().includes(q) ||
          section.domain.toLowerCase().includes(q)
      )
      return {
        ...section,
        entries: matchedEntries
      }
    })
    .filter((section) => section.entries.length > 0)
})

const filteredCount = computed(() =>
  filteredCatalog.value.reduce((sum, item) => sum + item.entries.length, 0)
)
</script>

<template>
  <div class="ledger-page" data-ui>
    <!-- Section 1: Typographic Statement Header -->
    <header class="ledger-hero">
      <div class="hero-top">
        <h1 class="hero-title">NOTES</h1>
        <dl class="hero-metrics">
          <div class="metric-cell">
            <dt>收录文档</dt>
            <dd>{{ totalDocs }}</dd>
          </div>
          <div class="metric-cell">
            <dt>知识域</dt>
            <dd>{{ catalog.length }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <!-- Section 2: Systematic Series Strip (Tone step surface, 6px tray) -->
    <section class="series-section" aria-labelledby="series-heading">
      <div class="section-bar">
        <h2 id="series-heading">成体系专题</h2>
        <span class="section-meta">按编号演进的核心主线</span>
      </div>
      <div class="series-tray">
        <a :href="withBase('/LLM/1-Transformer与基础概念')" class="series-cell">
          <div class="series-head">
            <span class="series-name">LLM &amp; Agent</span>
            <span class="series-count">7 篇</span>
          </div>
          <p class="series-desc">Transformer、量化部署、上下文工程、Harness 沙箱机制与落地反思</p>
        </a>
        <a :href="withBase('/Network/1-分层模型、网卡与路由基础')" class="series-cell">
          <div class="series-head">
            <span class="series-name">Network</span>
            <span class="series-count">7 篇</span>
          </div>
          <p class="series-desc">路由交换、TCP 状态机、NAT 穿透、SSH/VPN 隧道、分流 DNS 与排障案例</p>
        </a>
        <a :href="withBase('/Web/1-HTTP协议与Web通信基础')" class="series-cell">
          <div class="series-head">
            <span class="series-name">Web Architecture</span>
            <span class="series-count">6 篇</span>
          </div>
          <p class="series-desc">HTTP 协议、浏览器安全边界、现代 JS 工具链、渲染架构、认证与证书反代</p>
        </a>
        <a :href="withBase('/Cloud/1-虚拟化、转译与算力底座')" class="series-cell">
          <div class="series-head">
            <span class="series-name">Cloud &amp; Infra</span>
            <span class="series-count">6 篇</span>
          </div>
          <p class="series-desc">虚拟化与转译、Linux 容器内核隔离、Docker 空间治理、K8s 编排、GitOps 与分布式全景</p>
        </a>
      </div>
    </section>

    <!-- Section 3: Live Ledger Directory -->
    <section class="directory-section" aria-labelledby="directory-heading">
      <div class="directory-toolbar">
        <div class="tab-strip" role="tablist" aria-label="目录分类过滤">
          <button
            v-for="g in groups"
            :key="g.id"
            role="tab"
            :aria-selected="activeGroup === g.id"
            :class="['tab-btn', { active: activeGroup === g.id }]"
            @click="activeGroup = g.id"
          >
            {{ g.label }}
          </button>
        </div>

        <div class="filter-controls">
          <input
            v-model="query"
            type="search"
            class="filter-input"
            placeholder="过滤标题或关键词..."
            aria-label="过滤笔记标题或关键词"
          />
          <span class="filter-count">{{ filteredCount }} / {{ totalDocs }} 篇</span>
        </div>
      </div>

      <div v-if="filteredCatalog.length === 0" class="empty-ledger">
        未找到匹配「{{ query }}」的条目。
      </div>

      <div v-else class="ledger-groups">
        <div
          v-for="section in filteredCatalog"
          :key="section.id"
          class="ledger-group"
        >
          <div class="group-meta">
            <h3 class="group-title">{{ section.domain }}</h3>
            <p class="group-summary">{{ section.summary }}</p>
            <span class="group-total">{{ section.entries.length }} 篇</span>
          </div>

          <div class="group-rows">
            <a
              v-for="entry in section.entries"
              :key="entry.path"
              :href="withBase(entry.path)"
              class="ledger-row"
            >
              <span class="row-title">{{ entry.title }}</span>
              <span class="row-note">{{ entry.note }}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ledger-page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 56px 24px 128px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* ==========================================================================
   1. Typographic Hero
   ========================================================================== */
.ledger-hero {
  padding-bottom: 40px;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 32px;
  flex-wrap: wrap;
}

.hero-title {
  font-size: clamp(64px, 9.5vw, 132px) !important;
  font-weight: 500 !important;
  line-height: 0.86 !important;
  letter-spacing: -0.04em !important;
  margin: 0 0 0 -0.04em !important;
  padding: 0 !important;
  border: 0 !important;
  color: var(--text);
}

.hero-metrics {
  display: flex;
  gap: 40px;
  margin: 0;
  padding: 0;
}

.metric-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-cell dt {
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
  margin: 0;
}

.metric-cell dd {
  font-size: 20px;
  font-weight: 500;
  color: var(--text);
  margin: 0;
  letter-spacing: -0.02em;
}

/* ==========================================================================
   2. Systematic Series Tray (6px padded tray holding 4 surface cells)
   ========================================================================== */
.series-section {
  margin-top: 40px;
}

.section-bar {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 14px;
}

.section-bar h2 {
  font-size: 18px !important;
  font-weight: 500 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  letter-spacing: -0.01em;
}

.section-meta {
  font-size: 13px;
  color: var(--muted);
}

.series-tray {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 6px;
  border-radius: 10px;
  background-color: var(--raised);
}

.series-cell {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  border-radius: 6px;
  background-color: var(--surface);
  text-decoration: none !important;
  color: var(--text) !important;
  transition: background-color 0.15s ease;
}

.series-cell:hover {
  background-color: var(--ground);
}

.series-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.series-name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--text);
}

.series-cell:hover .series-name {
  color: var(--signal);
}

.series-count {
  font-size: 13px;
  color: var(--signal);
  font-weight: 500;
}

.series-desc {
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--muted);
  margin: 0 !important;
}

/* ==========================================================================
   3. Live Ledger Directory
   ========================================================================== */
.directory-section {
  margin-top: 72px;
}

.directory-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 6px 8px;
  background-color: var(--raised);
  border-radius: 8px;
  flex-wrap: wrap;
}

.tab-strip {
  display: flex;
  gap: 4px;
  overflow-x: auto;
}

.tab-btn {
  padding: 7px 14px;
  font-size: 13.5px;
  font-weight: 400;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn.active {
  color: var(--text);
  font-weight: 500;
  background-color: var(--surface);
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 14px;
}

.filter-input {
  width: 240px;
  height: 32px;
  padding: 0 12px;
  font-size: 13.5px;
  color: var(--text);
  background-color: var(--surface);
  border: 0;
  border-radius: 6px;
  outline: none;
}

.filter-input:focus-visible {
  outline: 2px solid var(--signal);
  outline-offset: 1px;
}

.filter-count {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
  padding-right: 6px;
}

.empty-ledger {
  padding: 64px 0;
  font-size: 15px;
  color: var(--muted);
}

.ledger-groups {
  display: flex;
  flex-direction: column;
  gap: 56px;
  margin-top: 40px;
}

.ledger-group {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 48px;
}

.group-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-title {
  font-size: 20px !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  color: var(--text);
}

.group-summary {
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--muted);
  margin: 0 !important;
}

.group-total {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--muted);
}

.group-rows {
  display: flex;
  flex-direction: column;
}

.ledger-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  min-height: 38px;
  padding: 7px 12px;
  margin: 0 -12px;
  border-radius: 6px;
  text-decoration: none !important;
  transition: background-color 0.12s ease;
}

.ledger-row:hover {
  background-color: var(--raised);
}

.row-title {
  font-size: 15px;
  font-weight: 450;
  color: var(--text);
}

.ledger-row:hover .row-title {
  color: var(--signal);
}

.row-note {
  font-size: 13px;
  color: var(--muted);
  text-align: right;
  flex-shrink: 0;
}

/* ==========================================================================
   Responsive Breakpoints
   ========================================================================== */
@media (max-width: 960px) {
  .series-tray {
    grid-template-columns: repeat(2, 1fr);
  }
  .ledger-group {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .ledger-groups {
    gap: 40px;
  }
}

@media (max-width: 640px) {
  .ledger-page {
    padding: 28px 16px 80px;
  }
  .hero-metrics {
    gap: 24px;
  }
  .series-tray {
    grid-template-columns: 1fr;
  }
  .filter-controls {
    width: 100%;
    justify-content: space-between;
  }
  .filter-input {
    flex: 1;
  }
  .ledger-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 10px 8px;
  }
  .row-note {
    text-align: left;
  }
}
</style>
