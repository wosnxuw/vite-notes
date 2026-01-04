# XML 文档结构

1、任何 XML 文档第一句应该声明它是一个 XML

```xml
<?xml version="1.0" encoding="utf-8"?>
```

2、一个 XML 文档相当于一颗树，只允许存在一个**根**

即最外侧的“标签”对，只能有一个

```xml
<?xml version="1.0" encoding="utf-8"?>
<EditorConfig>

</EditorConfig>
```

3、根的子结点，可以有多个。

每个结点表示为一个“标签“对。

标签对之间，可以放置值，也可以不放置值，随意。

```xml
<CommentsMultiLine>
    abc
    <start>%%%</start>
    123
    <end>%%%</end>
    xyz
</CommentsMultiLine>
```

允许混合出现，但是不建议这样写。

4、如果一个标签，中间没有任何值，可以缩写为一个

```xml
<CommentsMultiLine>
	<age/>
</CommentsMultiLine>
```

5、标签可以给定多个值

```xml
<CommentsMultiLine color="red" size="12">
</CommentsMultiLine>
```

6、注释

```
<!--CommentsMultiLine-->
```

7、大段文本内容

```xml
<detail><![CDATA[
        IF [EXP] THEN
        
        ELSEIF [EXP] THEN
        ELSE
        ENDIF
    ]]></detail>
```

8、空白字符有意义

```xml
   <detail>
        IF [EXP] THEN
和
    <detail>IF [EXP] THEN
```

前者有换行符和制表符

大部分解析器默认的行为不会自动丢弃空白字符。必须手动丢掉才行。