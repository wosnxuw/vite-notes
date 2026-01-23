记录一下 Qt 里踩的坑

说实话我写这篇笔记我都生气

### QAbstractItemView

Qt 有以下特点：

（1）双重缓冲区

（2）可见的部分才会访问数据，但是访问频率不固定

比如我试图做一个 Table，它 5 万行数据，那么实际上我发现，做成 Model-View 分离架构以后，它并不会实时的访问你所有数据的 data

只有你的数据在屏幕上可见，那么它的 data 才会被调用

所以我的思路就是说把 Qt 的 Model 做的很轻量级，节点的内存尽可能的少

而数据上的 Model 给我的时候，我能遍历所有节点，取指针，放在 Qt 的 Model 里即可，这样内存省，而且显示的内容不会太多，即使是现场求一些字符串，计算压力也小

### QStyledItemDelegate

我们如果对话框的花活比较多，那么肯定是要用到这个委托的

这个委托有点类似于特定于每个 Item 的

它能做到什么？

（1）paint 绘制背景，当时是为了选中时蓝底不要把图片盖住

（2）createEditor 打开编辑器，这里可以 new QComboBox 或者 QSpinBox 辅助编辑值

（3）setEditorData 相当于 2 的回调，方便在这里把值写道数据里

### QStyleOptionViewItem

这个东西我个人认为就是这里最大的坑

如果我不需要处理 Qt4 也许我会好一些

（1）

在 Qt4 里，V4 V3 逐级继承于 QStyleOptionViewItem，但是 Qt5 直接把 V4 的内容放到了 Item 里，并且不让再声明 V4

你可以看到 QStyledItemDelegate 的函数大多参数里拥有 QStyleOptionViewItem

这里，你即使不使用 V4 的扩展内容，在 Qt4 里也必须初始化 V4，否则无法绘制

即，你不能直接用他函数参数里的 Item，那个不好使，必须 `QStyleOptionViewItemV4 optv4 = option;`

(2)

所有 QStyledItemDelegate 里根据形参传入的 Item，它本身已经初始化好了，尤其是 Item 的 rect 变量不是 0, 这才能用

如果你在别处自己造 QStyleOptionViewItem，并且又把 Delegate 取出来，再通过 initStyleOption（这是一个私有方法，但是有点 AI 总写），或者说通过 ItemView 来初始化，反正都不好使，你的 rect 永远是 0

### QProxyStyle

一个用于控制特定控件的通用样式，继承 QStyle，修改控件的整体外观（如调整边距、颜色、字体、动画等）

当时是改拖拽动画，让线更粗，所以用的这个