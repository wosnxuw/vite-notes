# JSON 文档结构

JSON 相比于 XML，感觉书写上更加的灵活

```
{
    "sites": [
    { "name":"菜鸟教程" , "url":"www.runoob.com" }, 
    { "name":"google" , "url":"www.google.com" }, 
    { "name":"微博" , "url":"www.weibo.com" }
    ]
}
```

```
<sites>
  <site>
    <name>菜鸟教程</name> <url>www.runoob.com</url>
  </site>
  <site>
    <name>google</name> <url>www.google.com</url>
  </site>
  <site>
    <name>微博</name> <url>www.weibo.com</url>
  </site>
</sites>
```

1、

{} 表示对象

[] 表示数组

2、

一个对象，可以包含多个键值对 key:value

它等价于一条 JS 的赋值语句

```
"name" : "菜鸟教程"
name = "菜鸟教程"
```

3、

JSON 的键，**必须**要用""包裹，其包裹的内容实际上是 JS 的一个变量名

值则无所谓，字符串、数、数组等等都行

4、

值数组

(1) 数组不要求元素的类型一致

(2) 数组可以嵌套的包含其它对象

```
{
    "mixedArray": [42, "hello", true, null, { "key": "value" }, [1, 2, 3]]
}
```

建议是一致，这样方便阅读

5、

键值对必须在对象里，不许存在裸露的键值对

6、

JSON 的根，必须是**一个**对象或者数组

只有一个根

并且根不能是单独的数字或者字符串