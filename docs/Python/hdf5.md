# hdf5

学习一下 hdf5 的操作方式

h = hierarchical 

df = Data Format

首先，一个。h5 文件对应一个 H5File

但是。h5 文件并不是一个真的 .zip 文件，不能直接改名然后打开

每个文件可以理解为操作系统上的一个虚拟磁盘

```cpp
H5File file("sensor_data.h5", H5F_ACC_TRUNC);
```

因此，想要写入数据，一般需要先建立文件夹，就是 Group

```cpp
Group data_group = file.createGroup("/my_data");
```

你建立文件夹，也不能直接写入字符串啊，因此还需要建立文件，对应的是 Dataset

但是他这个 dataset，我的感觉有点类似于一个特殊的 excel 表

excel 表是一个二维的表格（仅谈论单 sheet）

他这个是一个可变维度的文件，所以必须先决定维度

怎么决定维度呢？

标量值：0 维

一个数组（不管多长）：1 维

灰度图像：2 维

rgb 图像：3 维

类似这种

结构体数组：依然是一维

创建文件 Dataset 之前需要决定三个东西：**1、名字 2、维度 3、元素大小**

比如你要存一个 double 的数组，那么就是 1 维，然后长度是 length。其实就是 1*length 这么多个空间

```cpp
DataSpace dataspace(1, length);
```

元素的大小实际上是占用的内存的大小

他这里提供了一些类型 int 啥的，你也可以自定义 CompType 类型

此外，在一个 dataset 和 group 很多的 hdf5 文件里查找对应数据，并没有数据库那么高效。因此很多人也在做 semantic based metadata querying 之类的工作，我有看到过相应的文章。

如何保持文件兼容性？

虽然 hdf5 每个 item 的要求是内存上的指定大小。

但是我们读进来的时候，对每个字段都检查有没有，没有就给默认值，好像就行