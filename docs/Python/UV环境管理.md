# UV 环境管理工具

最近看的很多项目都是用 uv 来管理环境的，所以我认为有必要学习一下

一开始我根本不管理环境，所有项目共用一个 python

后来我用的是 conda 来管理，每一个项目，配置一个 python 版本，配置对应的依赖，完全隔离

uv 我感觉它的野心是成为 python 里的 cargo，npm

实现：包管理+虚拟环境+项目+全局工具

备注：uv 也能切换 python 的版本

我们用 uv 来替换 conda，大概需要替换如下事情：

### 新建环境

指定一个 python 版本

```shell
uv init uv-learn
cd uv-learn
uv venv --python 3.14
```
init 会添加 pyproject.toml 这是 python 的官方标准，不用担心它是独家的

venv 用 python 原生虚拟环境，添加 .venv 创建虚拟环境

### 安装某个包

```shell
uv add requests
```
uv 会自动将依赖写入 pyproject.toml

注意，uv add 是必须在工程里运行，否则会找不到 pyproject.toml

### 全局工具

全局安装工具，相当于安装在 uv 的一个根目录里（类似 conda，似乎它也有一个类似 base 的基本目录）

```shell
uv tool install sphinx
uv tool run sphinx
```

但是一般的建议是用 uvx 运行但是不安装

```shell
uvx ruff
```