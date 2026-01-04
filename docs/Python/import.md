# Python 包管理

本文旨在解决时不时发生找不到 python 包的问题

### sys.path

首先，python import 会找的路径应该是 sys.path

```python
import sys
print(sys.path)
```

#### FreeCAD 中的 path

```python
['C:\\Users\\liuyanming\\AppData\\Roaming\\FreeCAD\\Mod\\FreeCADMCP2', 
 'C:\\Users\\liuyanming\\AppData\\Roaming\\FreeCAD\\Mod\\FreeCADMCP', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Web', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Tux', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Test',
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\TechDraw', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Surface', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Start', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Spreadsheet', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Sketcher', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Show', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Robot', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\ReverseEngineering', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Points', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Plot', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\PartDesign', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Part', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\OpenSCAD', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\MeshPart', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Mesh', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Measure',
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Material', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Inspection', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Import', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Idf', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Help', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Fem', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Draft', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\CAM', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\BIM', 
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\Assembly',
 'C:\\Program Files\\FreeCAD 1.0\\Mod\\AddonManager',
 'C:\\Program Files\\FreeCAD 1.0\\Mod', 
 'C:\\Program Files\\FreeCAD 1.0\\lib',
 'C:\\Program Files\\FreeCAD 1.0\\Ext',
 'C:\\Program Files\\FreeCAD 1.0\\bin\\python311.zip', 
 'C:\\Program Files\\FreeCAD 1.0\\bin\\DLLs', 
 'C:\\Program Files\\FreeCAD 1.0\\bin\\Lib', 
 'C:\\Program Files\\FreeCAD 1.0\\bin', 
 'C:\\Users\\liuyanming\\AppData\\Roaming\\Python\\Python311\\site-packages', 
 'C:\\Users\\liuyanming\\AppData\\Roaming\\Python\\Python311\\site-packages\\win32', 
 'C:\\Users\\liuyanming\\AppData\\Roaming\\Python\\Python311\\site-packages\\win32\\lib',
 'C:\\Users\\liuyanming\\AppData\\Roaming\\Python\\Python311\\site-packages\\Pythonwin', 
 'C:\\Program Files\\FreeCAD 1.0\\bin\\Lib\\site-packages', 
 'C:\\Users\\liuyanming\\AppData\\Roaming\\FreeCAD\\Macro\\', 
 'C:\\Users\\liuyanming\\AppData\\Roaming\\FreeCAD\\Macro', 
 'C:\\Program Files\\FreeCAD 1.0\\Macro']
```

#### conda(base) 一个新项目的 path
```python
['', 
 'C:\\Users\\liuyanming\\anaconda3\\python312.zip', 
 'C:\\Users\\liuyanming\\anaconda3\\DLLs', 
 'C:\\Users\\liuyanming\\anaconda3\\Lib', 
 'C:\\Users\\liuyanming\\anaconda3', 
 'C:\\Users\\liuyanming\\anaconda3\\Lib\\site-packages', 
 'C:\\Users\\liuyanming\\anaconda3\\Lib\\site-packages\\win32', 
 'C:\\Users\\liuyanming\\anaconda3\\Lib\\site-packages\\win32\\lib', 
 'C:\\Users\\liuyanming\\anaconda3\\Lib\\site-packages\\Pythonwin']
```

#### 小例子做测试

一个 python test 文件，写一个 add 函数

一个 python main 文件（同目录） `from test import add` 

然后我在不同的工作目录，通过直接 `python 1.py`  `python a/b/1.py`

然后在主函数里打印 sys.path

你会发现，**被执行的脚本所在的目录**被添加到 sys.path

并且，无论在哪里运行，都是能找到 test

### os.getcwd()

这里是 get 工作路径

对于上一个小例子，虽然 sys.path 是一样的，但是工作目录不一样

并且工作目录并不总在 sys.path 里

### 相对路径

**`import` 和 `from ... import` 的底层规则完全相同**

python import 语句里，不允许出现任何 "/"，只有"."

```python
import ./utils        # 语法错误！
from ./utils import add  # 语法错误！
```

```python
# 绝对导入（推荐）
from project.utils.other import func

# 相对导入（仅限包内）
from . import other   # . 表示当前包（utils）
from .. import main   # .. 表示父包（project）
```

### 根本解释

首先确定 你跑的 python 脚本，是否在一个包里？

如果你的脚本旁边有 `__init__.py `（可以是空） 则认为是一个包

如果不是包：

你**只能绝对导入**

绝对导入的起点就是 sys.path 里指定的路径

然后你 import A, import A.B.C 这种

如果是包：

不仅可以绝对导入，也支持相对

```python
from . import x
from .utils import y
from ./utils import cleanup # 错误
```

反正绝对不要出现 斜杠 反斜杠