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

我们先回忆 C 语言的函数内（或函数外，反正用于函数进行状态保存） static，它产生一个生命周期和程序一致的，但是只能在函数内用的静态变量。一般用于计数，函数调一次，加 1

思考：从计算理论的角度，生成器（yield）和类（或其他状态保存方式）在表达能力上是等价的，因为都可以通过状态机来模拟。对于需要保存复杂状态（多个局部变量、嵌套循环等）的函数，使用 yield 可以避免手动将这些状态提取为类成员变量，从而保持代码的清晰

Python 中的 yield 允许函数在每次调用时返回一个值并暂停执行，下次调用时从暂停处继续

要点：

1、yield 相当于 return，从此处就返回了

2、yield 第二次进入时，相当于下一次的入口点

```python
def generator():
    count = 0
    while True:
        count += 1
        yield count  # 暂停并返回
```

不使用 yield 时，我们通常需要一次性计算所有结果并存储在列表（或其他容器）中，这在数据量大时可能效率低下

实现上，应该是有一个类似状态机的类。将函数转换为**隐式状态机**。保存完整的函数执行上下文，需要时才产生值。

- 每次 `yield` 是一个状态节点
- 调用 `next()` 触发状态迁移

实际案例：读取超大文件

```python
# 不使用 yield - 一次性读入整个文件
def process_file_all(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    results = []
    for line in lines:
        results.append(process_line(line))
    return results

# 使用 yield - 逐行读取
def process_file_generator(filename):
    with open(filename, 'r') as f:
        for line in f:  # 一次只读一行到内存
            yield process_line(line)

# 使用示例
for processed_line in process_file_generator("huge_file.txt"):
    # 处理每个结果，内存中始终只有一行数据
    if some_condition(processed_line):
        break  # 可以提前终止，不会浪费计算资源
```