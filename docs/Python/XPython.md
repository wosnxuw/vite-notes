# {?}Python 文件作用

本篇按照常见程度排序

#### pyd

Windows 上的 Python 扩展模块，底层格式和 DLL 接近，满足 Python 扩展模块的加载约定

或者理解为，链接 python 头的 dll ，后缀改成了 pyd

它仅局限 Windows，同时它本质是由 C/C++编译出来的（linux 应该还是叫 so）

大致流程是，引入 python.h，链接 python3xx.lib，编出来 dll，改后缀即可

main.py 中，`import FreeCAD, FreeCADGui`（本身这个项目就是编出来 pyd，而不是 dll）

似乎就能调用到（只要这个 pyd 放在能找到的位置上）

我写的小例子里：

```python
import example
print(example.compute(5))  # 调用 C/C++ 函数
```

### CPython PyCxx

注意：不要和 Cython 搞混，目前我接触到的普通场景下，都是 CPython，而不是 Cython

CPython 本来是指 Python 官方提供的那个解释器，也就是我们谈论的 python.exe，因为是 C 语言写的，所以叫 CPython，它是一个解释器

CPython 就是 Python.h 那个官方 C 接口

就是类似于 Java 的 jni.h，实际上上一步编译 pyd 的时候，就是 CPython

PyCXX 就是包装了一下 Python.h，提供 C++接口

### pybind11 boost.python SWIG

它们是让 python 调用到 C/C++ 代码的，走非官方的那条路（不用你自己走）

pybind11，之所以叫 11，是因为仅依赖 C++11，其实它的作者是 boost.python 的作者（选择：仅需 python，想爽）

boost.python 比较笨重，而且模板很多（选择：仅限历史遗留）

SWIG 则仅依赖运行时 C 库，但是要编写 .i 接口（选择：需要不止 python）

FreeCAD 里的 Python 绑定，走 PyCXX 原生这一套，也不是 boost::python

### whl 轮子

如果一个 Python 库完全由纯 Python 代码写成，那么它的 `.whl` 文件就是**跨平台的**，但仍可能受 Python 版本/实现限制

如果一个 Python 库包含了需要编译的代码（比如 C、C++、Rust、Cython 等），那么它的 `.whl` 文件通常是**不跨平台的**

文件名中会明确标注其适用的平台

numpy-1.24.3-cp311-cp311-win_amd64.whl

### pyc

pyc 一般出现在 __pycache__ 里，提高启动速度

它跨平台，但是不跨 python 版本

### pyi

`.pyi` 是 Python 接口存根文件，内容为 Python 语法子集

你直接搜索 pyi 你会发现，它的图标被 vscode 直接接管为 python 的图标

它是供 IDE 去静态分析

FreeCAD 里的 pyi 属于是借鉴了官方 pyi 的语法，但是增了一些自定义内容，它用于取代原来的 XML 配置模板

### Cython

这个东西的本质是一个编译器。为了方便使用，也可以通过 pip 安装，看起来像是一个库

流程大概是，你先写 `.pyx` 文件，这是用 Cython 语法写的 python 文件（类比 ts 和 js）

然后 Cython 能把它编译为 c 代码

c 代码再编译为 pyd/so

备注：

这里编译的 Cython 语法是 Python 的超集，如果你直接用 Cython 编 `.py`，也是可以的，只不过性能不会有任何提升，因为产生的 C 是模仿 python 编译器的行为。只有你用了 python 以外的部分，比如调用 C 库之类的才行。一般都是用来集成一个 C 库

### RPython

RPython 我的理解是类似 MetaModelica 的小众领域特定语言

像“受限、可静态分析的 Python 子集”

它是源于一个叫做 PyPy 的项目，这个项目是实现了另一个非官方的 Python 解释器，即 PyPy 是 Python 的实现

而 PyPy 是用 RPython 写的，这个语言现在也实现自举了