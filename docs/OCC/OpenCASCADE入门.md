# OCC 库基本知识

### 配置环境

https://blog.csdn.net/xindashuai/article/details/131940740

实际上吧，这个教程在官网上有英文版，只不过太简略

1、下载官网那个 exe（200+MB），然后点击安装，安装后不只有 occ，还有 qt 等一大堆库

创建 vs 项目把头、静态库放进来，我是没用相对路径。动态库放在调试那里

2、
%1%2%3 三个参数的意义分别是 vs 对应的版本号（vc141），要编译的计算机位数（win64）和要编译的方式（Debug）D 大写

按照这个教程的参数，改%2 为 x64 %3 为 Debug 就构建好了，点击 msvc.bat，即可打开 vs 项目，然后手动编译 debug 库

set VCVARS=C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat

不用编译 Samples，也不用一顿复制文件到 occbin 文件夹

3、链接到 https://github.com/oneapi-src/oneTBB/releases 动态库。解压放在 exe 那或者配好路径都行。

否则在我 intel CPU 电脑（后期测试 AMD 也是一样的）会遇到 release 遇到 tdd12.dll，debug 遇到 tdd12_debug.dll 缺失问题。

其实它自带了一个 tbb 文件夹，链接到这个也行。

![occ-depend](assets/occ-depend.png)

这幅图描述了你到底需要什么第三方库。

### 文档

OCC 有两个文档。在线也行，离线的文档实际上在 doc 文件夹下。

https://dev.opencascade.org/doc/overview/html/index.html

这个【概述文档】，实际上内容比想象得多得多，给出了很多例子供参考

https://dev.opencascade.org/doc/refman/html/annotated.html

这个【参考手册】，就是类的实现

![occ-doc](assets/occ-doc.png)

这个是 OCC 的总体层次模型，和 https://dev.opencascade.org/doc/occt-7.6.0/refman/html/index.html 对应，每个模块 Module 中含多个 ToolKit 工具包，注意其中的 Modeling Data 块，其占包含一个 Toolkit TKBRep，内部又包含很多 Package，其中 Package TopoDS 包含了 TopoDS_Shape。在上面状态栏里可以看到层次。

对于总体层次模型，https://www.youtube.com/watch?v=qGPxaqyNMRE&list=PL_WFkJrQIY2iVVchOPhl77xl432jeNYfQ&index=10 视频可以更好的了解

之所以谈这个 Toolkit，是因为库是按照 Toolkit 来编译的，比如 TKBRep.lib，当然你可以不管，直接无脑全加进来。就是在 VS 中，最开始编译的时候，是按照这个顺序来的。  

![occ-framework](assets/occ-framework.png)

### Handle

`#define Handle(Class) opencascade::handle<Class>`

当你 new 一个继承了 OCC Foundation Class 的类对象时（OCC 自带/你自己继承），你可以把指针用 Handle 包裹起来，使之形成智能指针，方便内存管理

### TopoDS_Shape

https://blog.51cto.com/u_15905375/6100350

myTShape 引用计数指针

myOrient 记录方向，对于边，有正向、反向。

myLocation 位置信息

http://www.cppblog.com/eryar/archive/2014/11/16/OpenCASCADE_Outline.html