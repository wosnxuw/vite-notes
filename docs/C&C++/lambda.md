# Lambda 表达式

### Lambda 表达式

λ 函数、回调函数、函数指针、λ 表达式、匿名函数

这几个东西都差不多

现实情况是这样：

有的时候，A 写的函数，并不能满足所有的情况，你不能仅靠传递枚举来决定 A 写的函数的行为，所以你要把你自己写的函数传给 A。

举例：

函数指针允许你将函数传递给另一个函数，比如 qsort 排序

在 C++ 中，如果你不想思考函数指针的类型，你可以
```C++
auto func_ptr =  say_hello;
//是否写&都可以，有一个隐式转换
```

如果是 typedef 的话

```cpp
int add(int x, int y);
typedef int (*my_type)(int, int);
my_type = add;
```

只要你有一个函数指针，你就可以在使用函数指针的位置使用 lambda，如果你愿意

注意：返回值后置

C++：必须显示说明捕获什么东西
```C++
auto func = [](int x, int y) -> int {
    return x + y;
};
```

Rust：不需要指定捕获什么东西，会自动推断

```rust
let add = |x: i32, y: i32| -> i32 {
    x + y
};
let base = 10;
let add_base = |x| x + base;
println!("{}", add_base(5));  // 15
```

Python：必须声明为 lambda，隐式捕获外部变量，只支持一行内写完，不支持多语句

```python
add = lambda x, y: x + y
sorted_pairs = sorted(pairs, key=lambda x: x[1])  # 按第二个元素排序
```

中括号（捕获方式）表示 lambda 的开始，不能省略

[] 里可以放置一些符号

`=` 表示函数体可以使用`{}`外的变量，按值传递

`&` 是按引用

`this` 表示可以使用 lambda 所在的类的成员变量

不写则不捕获，只能用形参

也可以写 a（变量名），就是只传递这个变量

小括号是放形参

最常见的 lambda 函数是这个样子

```C++
void ForEach(const std::vector<int>& values, void(*func)(int)){
    ...
}
//调用
ForEach(values,[](int value){std::cout<< value << std::endl;});
//使用 auto，来检查类型
auto lambda = [](int value) {std::cout << value << std::endl; };
```

```C++
//最 C++的方式
void ForEach(const std::vector<int>& values, const std::function<void(int)>& func){
    ...
}
int main{
    int a=10;
    auto lambda = [&](int value){a=90;std::cout << a;};
}
```

只要你有一个函数指针，你就可以在使用函数指针的位置使用 lambda，如果你愿意

但是反过来：

**不带捕获（capture）的 lambda** 可以退化（decay）成一个普通的函数指针

**带捕获的 lambda** 则无法被简单地替换为一个函数指针

**函数指针** 只是一个指向可执行代码地址的指针，不包含任何额外的上下文信息或数据（即不包含捕获状态）

**带捕获的 lambda** 本质上是一个“闭包对象”（closure object），它不仅包含可调用体（相当于函数体），还携带了它所捕获的外部变量，存储在这个对象的内部

**匿名** 每个 lambda 在编译时都会“生成”一个独立的**类**类型。是编译器自动生成的、不可直接命名的闭包类型。包含一个或多个“私有”成员变量，用于存放捕获的外部变量（如果有捕获）

**不可命名** 无法直接给出 lambda 的类型（你无法直接写出它的名字），只能通过`auto`、`std::function<>` 或者 `decltype` 的方式来“获取”到这个类型的实例或类型信息。非捕获时允许转换

### 让 B 类完全不清楚 A 的情况下，通知 A

```cpp
class A { // Command
public:
    B b;
    void finish() {
        b.delete_dialog();
    }
    void delete_resource() {
        ;
    }
};

class B { // Dialog
public:
    void delete_dialog() {
        ;
    }
};
```

设想如下场景，A 类为命令类，B 类为对话框类。A 类被上级 finish 时，它要先通知 B 对话框关掉，然后等 B 成功关掉，再把资源删掉。

但是 B 里面不能出现任何有关 A 的代码，包括 include 或者是声明。（B 和 A 的代码是分开的）A 可以创造 B

方式 1

类函数指针（通过 lambda 或者 std::function）实现回调

B 在被构造后，拿到一个回调函数，只要自己的 delete_dialog 被调用了，那么就去调用这个回调就好了。A 负责在拿到 B 的时候，给它设置回调函数。

例子：

在 B 中定义一个 `std::function<void()>` 的成员

A 构造 B 时，把“想做的事情”封装成一个 lambda 送给 B

方式 2

通过 抽象接口 

定义一个额外的抽象接口 ICallback，然后 A 实现它，B 存 ICallback，A 构造 B 的时候，把自己当作 ICallback 的子类传过去，B 调父类的接口

方式 3

通过 信号槽、消息传递等复杂机制

### 在 C 语言中模仿闭包

一般是把造一个结构体，保存函数指针，以及上下文环境

1、明确类型

函数指针，让第一个参数是 指向结构体本身的指针

```C
typedef struct {
    int captured;
    void (*func)(struct closure*);  // 函数指针，参数是该结构本身
} closure;
// 一个辅助函数，用来方便地调用
void closure_call(closure* c) {
    if (c && c->func) {
        c->func(c);
    }
}
```

2、void* 类型都不要了

库中比较常见，让调用者自己去转型。减少耦合度

```C
#include <stdio.h>
#include <stdlib.h>

typedef void (*callback_t)(void* userdata);

// 一些框架/库提供的“调用回调”的函数
void do_something(callback_t cb, void* userdata) {
    printf("Doing something before callback...\n");
    if (cb) {
        cb(userdata);  // 回调
    }
    printf("Doing something after callback...\n");
}

// 定义自己的数据结构
typedef struct {
    int some_value;
    // ... 其他要捕获的东西
} MyData;

// 定义回调函数
void my_callback(void* userdata) {
    MyData* data = (MyData*) userdata;
    printf("Inside callback, some_value = %d\n", data->some_value);
    data->some_value += 1;  // 改变捕获值
}

int main(void) {
    MyData data;
    data.some_value = 10;

    // 传递函数指针 + 数据指针
    do_something(my_callback, &data);

    return 0;
}

```

### std::function

使用 C++11 引入的新特性来构造更强大的函数指针

`std::function`是 C++11 引入的一个标准库特性，用于封装任何可调用实体，这包括普通函数、Lambda 表达式、成员函数以及具有`operator()`成员的类实例（即函数对象）

```C++
int add(int a, int b);
int (*func_ptr)(int,int) = add;
int result=func_ptr(2,3);
```

```C++
#include <functional>
std::function<int(int,int)> func = add;
int result = func(2,3);
```

### std::bind

将一个可调用对象（如普通函数、成员函数、函数对象等）与部分参数绑定，生成一个新的函数对象

这个新的函数对象在调用时，已预先填充了部分参数，从而可以简化调用接口或适配不同的函数签名

```cpp
void print(int a, int b) {
    std::cout << a << ", " << b << std::endl;
}

int main() {
    // 绑定 print 的第一个参数为 10，第二个参数由调用时提供
    auto f = std::bind(print, 10, std::placeholders::_1);
    f(20);  // 输出：10, 20
    return 0;
}
```