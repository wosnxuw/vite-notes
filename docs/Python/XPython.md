# {?}Python 文件作用

#### pyd

这个东西实际上就是一个 dll，只不过 dll 的后缀改成了 pyd

那么：它仅局限 Windows，同时它本质是由 C/C++编译出来的（linux 应该还是叫 so）

大致流程是，引入 python.h，链接 python3xx.lib，编出来，改后缀

main.py 中，import FreeCAD, FreeCADGui

似乎就能调用到（只要这个 pyd 放在能找到的位置上）

我写的小例子里：

```python
import example

print(example.compute(5))  # 调用 C/C++ 函数
```

### Cython

这个东西的本质是一个编译器。为了方便使用，也可以通过 pip 安装，看起来像是一个库

流程大概是，你先写。pyx 文件，这是用 Cython 语法写的 python 文件（类比 ts 和 js）

然后 Cython 能把它编译为 c 代码

c 代码再编译为 pyd

备注：

这里编译的 Cython 语法是 Python 的超集，如果你直接用 Cython 编。py，也是可以的，只不过性能不会有任何提升，因为产生的 C 是模仿 python 编译器的行为。只有你用了 python 以外的部分，比如调用 C 库之类的才行。一般都是用来集成一个 C 库

### RPython

RPython 我的理解是类似 MetaModelica 的小众领域特定语言

据说是 Python 的子集

它是一个叫做 PyPy 的项目，这个项目是实现了另一个非官方的 Python 解释器

而 PyPy 是用 RPython 写的，这个语言现在也实现自举了

### whl 轮子

如果一个 Python 库完全由纯 Python 代码写成，那么它的 `.whl` 文件就是**跨平台的**

如果一个 Python 库包含了需要编译的代码（比如 C、C++、Rust、Cython 等），那么它的 `.whl` 文件通常是**不跨平台的**

文件名中会明确标注其适用的平台

numpy-1.24.3-cp311-cp311-win_amd64.whl
