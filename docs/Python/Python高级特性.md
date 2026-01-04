# Python 高级

### 装饰器

装饰器本质上是一个函数，它接收另一个函数作为参数，并返回一个新的函数

```python
@decorator_function
def my_function():
    pass
```

相当于

```python
def my_function():
    pass
my_function = decorator_function(my_function)
```

这构成了一种更高级的回调写法

因为写库的人，不知道你会怎么写函数，所以他希望你能给他一个函数指针

让他的函数，适时的调用你的函数

### 推导式

推导式旨在从一个数据集合推出另一个数据集合

其源头不一定是列表

列表推导式：

`[exp for i in list]`

`[exp for i in list if cond-exp]`

`cond-exp`旨在对`i`进行判断

### 模式匹配

类似 MetaModelica，python 的模式匹配也是类似的思路

```python
def my_string_delimit_list(string_list, delimiter):
    match string_list:
        # 匹配空列表
        case []:
            return ""
        # 匹配仅包含一个元素的列表
        case [head]:
            return head
        # 匹配包含至少一个元素的列表，并将其解构为头部和尾部
        case [head, *tail]:
            return head + delimiter + my_string_delimit_list(tail, delimiter)

# 示例用法
string_list = ["apple", "banana", "cherry"]
delimiter = ", "
result = my_string_delimit_list(string_list, delimiter)
print(result)  # 应输出 "apple, banana, cherry"

```

### yield

yield 的直译是 产生 产出

Python 中的 yield 允许函数在每次调用时返回一个值并暂停执行，下次调用时从暂停处继续

不使用 yield 时，我们通常需要一次性计算所有结果并存储在列表（或其他容器）中，这在数据量大时可能效率低下

实现上，应该是有一个类似状态机的类。将函数转换为**隐式状态机**

- 每次 `yield` 是一个状态节点
- 调用 `next()` 触发状态迁移