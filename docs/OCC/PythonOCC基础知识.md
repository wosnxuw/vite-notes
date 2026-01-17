# PythonOCC 经验

https://blog.csdn.net/m0_65073612/article/details/138942290

https://dev.opencascade.org/doc/refman/html/classes.html

https://blog.csdn.net/weixin_42755384/article/details/87893697

第一步，从 step 拿到 `TopoDS_Shape` ，需要用到 `STEPControl_Reader`

```python
from OCC.Core.STEPControl import STEPControl_Reader

filename = "xxx.step"
reader = STEPControl_Reader()
reader.ReadFile(filename)
reader.TransferRoots()
a_shape = reader.OneShape()
# oneshape 时，物体被整合，某些 step 中存在的面可能消失
```

第二步，获取边和面 `TopoDS_Edge` `TopoDS_Face` ，需要用到 `TopologyExplorer`

```python
from OCC.Extend.TopologyUtils import TopologyExplorer

topo = TopologyExplorer(a_shape)
faces = list(topo.faces())
edges = list(topo.edges())
# 此处 edge 并不是双向的，而是无向的，即正方体有 12 个
```

第三步，获取面和边的信息

#### 1、面积、边长、体积

```python
from OCC.Core.BRepGProp import (brepgprop_LinearProperties,
                                brepgprop_SurfaceProperties,
                                brepgprop_VolumeProperties)
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop
```

GProp 指的是 geometry_properties 几何属性，计算形状的物理属性，如体积、表面积。

求面积等都有两种类似的算法

```python
def area_feature(face):  # 求面积
    gp = GProp_GProps()
    brepgprop_SurfaceProperties(face, gp)
    return gp.Mass()
def area_feature2(face):  # 求面积
    gp = GProp_GProps()
    brepgprop.SurfaceProperties(face, gp)
    return geometry_properties.Mass()
def length_feature(edge):  # 求边长
    geometry_properties = GProp_GProps()
    brepgprop_LinearProperties(edge, geometry_properties)
    return geometry_properties.Mass()
def volume_feature(shape):  # 求体积
    geometry_properties = GProp_GProps()
    brepgprop_VolumeProperties(shape, geometry_properties)
    return geometry_properties.Mass()
```

#### 2、求面包含的边，边所在的面

```python
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopAbs import TopAbs_EDGE
```

TopExp 遍历工具，TopExp_Explorer 可以遍历形状的子元素

```python

def get_edges_from_face(face: TopoDS_Face) -> list:
    """
    求面所包含的所有边
    """
    edges = []
    explorer = TopExp_Explorer(face, TopAbs_EDGE)
    while explorer.More():
        edge = explorer.Current()
        edges.append(edge)
        explorer.Next()
    return edges
```

看到这里，我们知道，从体上取面，和从面上取边，有两种做法：

第一种是用 TopologyExplorer 获取 topo，然后直接取得列表

第二种是通过 TopExp_Explorer 的对象的 Current() 方法来获取

如果要求边所在的面（一般是两个），这个操作是比较传统的遍历所有面，再遍历面上所有边

```python
from OCC.Core.TopoDS import topods
from OCC.Core.TopAbs import TopAbs_EDGE, TopAbs_FACE
```

```python
def find_faces_containing_edge(edge: TopoDS_Edge, shape) -> list:
    """
	给定一个边，返回包含此边的面（列表）
	"""
    faces_containing_edge = []
    # 创建 TopExp_Explorer 来遍历所有面
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while explorer.More():
        face = topods.Face(explorer.Current())
        # 创建一个探索器来遍历该面上的所有边
        edge_explorer = TopExp_Explorer(face, TopAbs_EDGE)
        while edge_explorer.More():
            current_edge = topods.Edge(edge_explorer.Current())
            # current_edge = edge_explorer.Current()
            # 比较当前边和给定的边
            if current_edge.IsSame(edge):
                faces_containing_edge.append(face)
                break  # 如果找到包含该边的面，就不再需要遍历该面的其他边
            edge_explorer.Next()
        explorer.Next()
    return faces_containing_edge
```

这里，我们观察到一个方法 current_edge.IsSame(edge) 

这个方法可以判断 边和边 面和面 是否是同一个，而不用在乎是否是同一个对象

即用 topo.edges() 产生的 edge 和用 edge_explorer.Current() 产生的 edge，在这里可以相等

关于用不用 topods.Edge 显示构造的问题，虽然 Current 函数的返回值是 TopoDS_Shape，但是不写应该也行

#### 3、取得 边的两个端点，进而取得中点，取得面的中心点，再求切向量

```python
from OCC.Core.BRepAdaptor import BRepAdaptor_Curve
```

BRepAdaptor 里面是适配器，使得可以以基本几何曲线一样操作拓扑边

```python
curve_adaptor = BRepAdaptor_Curve(edge)
first_vertex = curve_adaptor.FirstParameter()
last_vertex = curve_adaptor.LastParameter()
start_point = curve_adaptor.Value(first_vertex)
end_point = curve_adaptor.Value(last_vertex)
```

BRepAdaptor_Curve 适配了底层曲线，这些曲线有一些参数，你取出端点参数，再构造 gp_Pnt 即可，这个参数对你而言无意义

构造中点时，可以通过**参数**，一半的参数来构建，也可以直接计算坐标（直线型）

```python
midpoint_param = (first_vertex + last_vertex) / 2
midpoint = curve_adaptor.Value(midpoint_param)
```

```python
mid_x = (point1.X() + point2.X()) / 2.0
mid_y = (point1.Y() + point2.Y()) / 2.0
mid_z = (point1.Z() + point2.Z()) / 2.0
return gp_Pnt(mid_x, mid_y, mid_z)
```

求出中点以后，可以求切向量

```python
tangent_vec = curve_adaptor.Tangent(midpoint_param).Direction()
curve_adaptor.D1(midpoint_param, midpoint, tangent_vec)
```

得到边中点和方向的函数

```python
def get_edge_feature(edge: TopoDS_Edge):
    """
    返回一个边的特征，中点坐标以及切向量
    形状：一维数组，长 6
    """
    curve_adaptor = BRepAdaptor_Curve(edge)
    first_vertex = curve_adaptor.FirstParameter()
    last_vertex = curve_adaptor.LastParameter()
    midpoint_param = (first_vertex + last_vertex) / 2
    midpoint = curve_adaptor.Value(midpoint_param)
    tangent_vec = curve_adaptor.Tangent(midpoint_param).Direction()
    curve_adaptor.D1(midpoint_param, midpoint, tangent_vec)
    return [midpoint.X(),midpoint.Y(),midpoint.Z(),tangent_vec.X(),tangent_vec.Y(),tangent_vec.Z()]
```

（注意 X（）是方法调用，不是成员变量）

获取面的中心点，不能直接取得，要通过 GProp 几何属性取得质心

```python
from OCC.Core.gp import gp_Pnt
```

```python
def get_face_center(face: TopoDS_Face) -> gp_Pnt:
    gprops = GProp_GProps()
    brepgprop.SurfaceProperties(face, gprops)
    center_of_mass = gprops.CentreOfMass()
    return center_of_mass
def get_edge_center(edge: TopoDS_Edge) -> gp_Pnt:
    gprops = GProp_GProps()
    brepgprop.LinearProperties(edge, gprops)
    center_of_mass = gprops.CentreOfMass()
    return center_of_mass
```

如果你是一个半圆弧，你的质心是在圆心，但是中心在圆弧上（中心总是在曲线上，毕竟是通过参数方程求出来的）

两个点相比较 `midpoint1.IsEqual(midpoint12,0.0001)`

gp_Pnt.Coord() 方法返回一个三元组，即坐标。 Coordinate：并列的

#### 4、生成 TopoDS_Shape 并保存为 step 文件

BRepPrimAPI 用于生成基本的几何体，如立方体、球体、圆柱等

BrepAlgoAPI 用于执行布尔运算，将多个体转换为一个新体

```python
from OCC.Core.BRepPrimAPI import BRepPrimAPI_MakeBox
```

```python
box = BRepPrimAPI_MakeBox(50+a, 10+b, 30+c, gp_Pnt(0, 0, 0)).shape
# 直接可得到 TopoDS_Shape
```

作布尔运算，Fuse 融合，cut 剪切

```
from OCC.Core.BRepAlgoAPI import BRepAlgoAPI_Fuse
```

```python
t_shape = BRepAlgoAPI_Fuse(base_box, top_box).Shape()
```

利用 STEPControl 写入文件，提供了 STEPControl_Reader，STEPControl_Writer

```python
from OCC.Core.STEPControl import STEPControl_Writer, STEPControl_Reader, STEPControl_AsIs
```

本文一开始的方法已经足够常见，这里再列举一次

```python
def read_step_file(file_path: str) -> TopoDS_Shape:
    reader = STEPControl_Reader()
    reader.ReadFile(file_path)
    reader.TransferRoots()
    shape = reader.OneShape()
    return shape
def write_step_file(shape: TopoDS_Shape, file_path: str):
    writer = STEPControl_Writer()
    writer.Transfer(shape, STEPControl_AsIs)
    writer.Write(file_path)
#均未做任何错误处理
```

#### 5、获取面的法向量

通过 BRepAdaptor_Surface 类将平面映射到 UV 空间内

gp_Dir 表示单位向量

```python
from OCC.Core.gp import gp_Pnt, gp_Vec, gp_Dir
from OCC.Core.BRep import BRep_Tool_Surface
from OCC.Core.TopAbs import TopAbs_REVERSED
from OCC.Core.GeomLProp import GeomLProp_SLProps
from OCC.Core.BRepTools import breptools_UVBounds
```

```python
def get_face_normal(face: TopoDS_Face) -> gp_Dir:
    """
    获取给定面的法向量
    """
    # 获取面的 UV 参数范围
    u_min, u_max, v_min, v_max = breptools_UVBounds(face)
    u_mid = (u_min + u_max) / 2.0
    v_mid = (v_min + v_max) / 2.0
    # 获取法向量
    surf = BRep_Tool_Surface(face)
    normal = GeomLProp_SLProps(surf, u_mid, v_mid, 1, 1e-4).Normal()
    if face.Orientation() == TopAbs_REVERSED:
        normal.Reverse()
    return normal
```

让我们回顾一下“几何属性”相关类

```python
from OCC.Core.BRepGProp import brepgprop
from OCC.Core.BRepGProp import (brepgprop_LinearProperties,
                                brepgprop_SurfaceProperties,
                                brepgprop_VolumeProperties)
```

这个是求，Brep 形状的全局属性的，比如线的长度

```python
from OCC.Core.GeomLProp import GeomLProp_SLProps
from OCC.Core.GeomLProp import GeomLProp_CLProps
```

求一个几何对象的局部属性，S 是面，C 是线

```python
from OCC.Core.GProp import GProp_GProps
```

Gprop 也是求属性的，与第一个类似

#### 6、求给定面，通过某个边的相邻面

```python
from OCC.Core.TopTools import TopTools_IndexedDataMapOfShapeListOfShape
from OCC.Core.TopExp import topexp_MapShapesAndAncestors
from OCC.Core.TopOpeBRepBuild import TopOpeBRepBuild_Tools
```

```
def get_face_adjacent(shape, face, edge) -> TopoDS_Face:
    efmap = TopTools_IndexedDataMapOfShapeListOfShape()
    topexp_MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, efmap)
    adjface = TopoDS_Face()
    if TopOpeBRepBuild_Tools.GetAdjacentFace(face, edge, efmap, adjface):
        return adjface
    else:
        return None
```

#### 7、读写标签

不解释了

```python
import os
import re
from OCC.Core.STEPControl import STEPControl_Reader
from OCC.Extend.TopologyUtils import TopologyExplorer
from OCC.Core.StepRepr import StepRepr_RepresentationItem

def read_step_with_face_labels_with_lines(filename):
    """
    阅读 step 文件 ADVANCED_FACE 中
    形如 “X__Y” 的注释中的标签
    返回按 topo.faces() 列表顺序遍历面的标签列表
    """
    if not os.path.exists(filename):
        print(filename, ' not exists')
        return
    reader = STEPControl_Reader()
    reader.ReadFile(filename)
    reader.TransferRoots()
    shape = reader.OneShape()
    treader = reader.WS().TransferReader()
    topo = TopologyExplorer(shape)
    faces = list(topo.faces())
    labels=[]
    for face in faces:
        item = treader.EntityFromShapeResult(face, -1)
        if item is None:
            # print(filename, face)
            continue
        item = StepRepr_RepresentationItem.DownCast(item)
        name = item.Name().ToCString()
        # print(name)
        # name 是单引号中间那个字符串
        if name:
            matches = re.findall(r'\d+', name)
            if len(matches) >= 2:
                nameid = matches[1]
            else:
                nameid = None
            labels.append(int(nameid))
    return labels

def write_step_labels_by_string(filename):
    """
    通过字符串的方式，为 step 文件写入预设标签
    写入顺序按照 ADVANCED_FACE 出现顺序
    会直接覆盖掉原有''中内容
    """
    prefix = "ADVANCED_FACE"
    # prefix = "EDGE_CURVE"
    with open(filename, 'r') as file:
        lines = file.readlines()
    index = 0
    pattern = r"({}\(')[^']*(')".format(prefix)
    for i, line in enumerate(lines):
        new_line = re.sub(pattern, f"{prefix}(\'{index}__{index}\'", line)
        if new_line != line:
            lines[i] = new_line
            index+=1
    with open(filename, 'w') as file:
        file.writelines(lines)
```

#### 8、显示并上色

```python
from OCC.Display.SimpleGui import init_display

display, start_display, add_menu, add_function_to_menu = init_display()
```

init_display 负责初始化一个图形窗口用于显示，但并不立刻弹出

使用 DisplayShape 放入物体，start_display() 方法显示

```python
# 擦除
display.EraseAll()
display.DisplayShape(shape, update=True) #True 表示立即更新看到结果
start_display()
```

上色，引入 AIS 模块，Application Interactive Service

管理对象的显示状态，包括显示/隐藏、颜色、透明度、材质属性等

其中的 AIS_Shape 专门哟用于显示 TopoDS_Shape 对象

所以我们要做一下内容：

1、将所需要展示的面，转换为 AIS_Shape 2、调用其 SerColor 方法 3、放到 display 里面（如果不是所有面都调用 display.Context.Display()，则不会显示所有面，因为你可能没有写显示整个 Shape 的方法）

```python
from OCC.Core.AIS import AIS_Shape
from OCC.Core.Quantity import Quantity_Color, Quantity_TOC_RGB
```

```python
    topo = TopologyExplorer(shape)
    faces = list(topo.faces())
    edges = list(topo.edges())

    display, start_display, add_menu, add_function_to_menu = init_display()

    color1 = Quantity_Color(1.0, 0.0, 0.0, Quantity_TOC_RGB)
    color2 = Quantity_Color(0.0, 1.0, 0.0, Quantity_TOC_RGB)

    for e in edges:
        ais_edge = AIS_Shape(e)
        if(True):
            ais_edge.SetColor(color1)
        else:
            ais_edge.SetColor(color2)
        display.Context.Display(ais_edge, True)
```

#### 9、曲率 以及求法

曲线 的一阶导数，是切向量（和数学上的概念类似）

二阶导数反映了凸凹性等，结合一二阶导数可以求曲率

这里不给公式了，直接求

利用曲线适配器的 D1 和 D2 方法可以求曲线的一二阶导数

值得注意的是，曲线是参数方程，也就是 u（或者 t 也行）的函数

```python
	curve_adaptor = BRepAdaptor_Curve(edge)
    first_vertex = curve_adaptor.FirstParameter()
    last_vertex = curve_adaptor.LastParameter()
    midpoint_param = (first_vertex + last_vertex) / 2
    midpoint = curve_adaptor.Value(midpoint_param)
    
    tangent_vec = gp_Vec()
    normal_vec = gp_Vec()
    # curve_adaptor.D1(midpoint_param, midpoint, tangent_vec)
    

    curve_adaptor.D2(midpoint_param, midpoint, tangent_vec, normal_vec)
    norm_tangent = tangent_vec.Magnitude()
    norm_normal = normal_vec.Magnitude()
    curvature = norm_normal / (norm_tangent ** 3)
```

面的这里直接给出 能跑的代码

```python
def get_face_feature(face: TopoDS_Face) -> list:

    u_min, u_max, v_min, v_max = breptools_UVBounds(face)
    surface_adaptor = BRepAdaptor_Surface(face)
    u_mid = (u_min + u_max) / 2
    v_mid = (v_min + v_max) / 2
    center = surface_adaptor.Value(u_mid, v_mid)

    normal_vec = gp_Vec()
    tangent_vec = gp_Vec()
    surface_adaptor.D1(u_mid, v_mid, center, normal_vec, tangent_vec)

    d1u=gp_Vec()
    d1v=gp_Vec()
    d2u=gp_Vec()
    d2v=gp_Vec()
    d2uv=gp_Vec()
    surface_adaptor.D2(u_mid, v_mid, center, d1u, d1v, d2u, d2v, d2uv)

    E =d1u.SquareMagnitude()
    F = d1u.Dot(d1v)
    G = d1v.SquareMagnitude()
    L = d2u.Dot(normal_vec)
    M = d2uv.Dot(normal_vec)
    N = d2v.Dot(normal_vec)
    gaussian_curvature = (L * N - M * M) / (E * G - F * F)
    mean_curvature = 0.5 * (L * G - 2 * M * F + N * E) / (E * G - F * F)
```

`gp_Trsf` 是 OpenCASCADE 几何处理库中的一个类，用于表示**三维几何变换（transformation）**。它支持多种类型的几何变换，包括**平移、旋转、缩放、镜像和复合变换**。`gp` 代表 "Geometric Primitives"（几何基本体），而 `Trsf` 则是 "Transformation" 的缩写。
