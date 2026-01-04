# Github Actions

Github Actions 你可以认为是 SaaS

您可以配置 GitHub Actions **工作流**，使其在代码仓库中发生特定**事件**时触发，例如创建拉取请求或议题。

您的工作流包含一个或多个**作业**，这些作业可以按顺序或并行运行。

每个作业都将在其自身的虚拟机**运行器**或容器中运行，并包含一个或多个**步骤**。

这些步骤可以运行您定义的**脚本**或运行** Action**（一种可重用的扩展，可以简化您的工作流）。

每次工作流运行都会在一个全新的、新配置的虚拟机中执行。（运行器是一台服务器，它会在工作流被触发时运行这些工作流。每个运行器一次只能运行一个作业）

工作流在何时触发？`on`

当向工作流存储库中的任何分支推送代码时，具有以下值的工作流将运行：

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
```

工作在什么机器上运行？ `runs-on`

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
```

备注：公开仓库的 actions 无限制使用，4 核 16GB；私有仓库的有限制，2 核 7GB

创建作业？
```yaml
jobs:
  my_first_job:
    name: My first job
  my_second_job:
    name: My second job
    needs: my_first_job # 依赖
```

matrix（矩阵）？

是一种在单个工作中运行多个配置的策略，如测试多个 python 版本

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node-version: [10, 12, 14]
    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js ${{ matrix.node-version }} on ${{ matrix.os }}
        uses: actions/setup-node@v2
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm install
      - run: npm test
```

这里一共 6 个作业

预制动作？

为了避免一些重复性的工作，github actions 利用 uses+actions 来提供统一的预定的动作

比如将你的代码拉取到执行器上，或者按照 python 环境等等

检出？

如何确保执行器上有你的代码呢？

你需要

```yaml
    steps:
    - uses: actions/checkout@v4
```

安装 python

```yaml
uses: actions/setup-python@v4
```

Codecov ?

它是一个 SaaS 软件即服务

它衡量的是你的测试**实际执行了代码的多少百分比**

支持多语言，GUI 界面，覆盖率比较（避免因懒惰而不写测试）

我这里最终成功的如下：

```yaml
name: My CI/CD Learn Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python 3.11
      uses: actions/setup-python@v4
      with:
        python-version: "3.11"
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    
    - name: Run unit tests with coverage
      run: |
        python -m pytest tests/test_calculator.py -v --cov=src --cov-report=xml
    
    - name: Run API tests
      run: |
        python -m pytest tests/test_api.py -v
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
        flags: unittests
        name: codecov-umbrella
```

Jenkins（传统 CI 先驱）是自己管理维护的 Github Actions（ 2019 年云原生时代产物）

用 Groovy 脚本编排流程

Groovy 是一个运行在 JVM 上的动态语言

Groovy 可无缝调用 Java 库，Java 也可调用 Groovy 代码（需编译）
