# Rust进阶

### 泛型函数

这个函数的泛用性不好

```rust
fn largest(list:&Vec<i32>) -> i32
```

这个可能会好一些（但是在 rust 里不对）

```rust
fn largest<T>(list:&[T]) -> T
```

Rust 的泛型在编译时进行单态化（monomorphization），也就是为每个具体类型生成独立的代码

### 结构体泛型

```rust
struct Point<T>{
    x:T,
    y:T,
}
```

（注：y 的类型可以是 U，但是不建议，一般只有一个泛型）

### 枚举泛型

`Option<T>` 其 Some 持有 T，None 不持有

`Result<T, E>` 其 Ok 持有 T，Err 持有 E

### 成员函数泛型

```rust
impl<T> Point<T>{ //impl 后面有一个 T
    fn x(&self)->&T{
        &self.x
    }
}
```

### Trait

直译：特征

有点类似接口（java）或者是 C++的纯虚类

每个 Trait 下面还可以有一些方法

只有方法签名，可以提供默认实现，可以不提供

```rust
pub trait Summary{
    fn summarize(&self)->String{
        String::from("NoImpl");
    }
}
```

**实现**

``` rust
impl<T> Summary for Point<T>{
    fn summarize(&self)->String {
        todo!()
    }
}
```

实现 Trait 时，这个 impl 里不能出现非 trait 中的方法，需要换一个 impl。

注意：不是在 struct 上实现，而是在 impl 里

trait 需要 pub，并且 use，才能在其它的 Crate 里用

**默认实现**

仍然要写一个 impl Trait for Struct

Trait 之间的方法可以互相调用。

即：一个默认方法，可以调用一个没无默认实现的方法。

1、两个都不在本 Crates 的 trait 和 struct，则不可以在本 Crate 实现，至少要有一个在

即：你不可以在你的项目里，在别人的结构体上实现别人的接口。你要么为自己的结构体实现别人的接口，要么为别人的结构体实现自己的接口，要么纯自己写。

### 函数利用 Trait

如果你的两个 struct 都实现了某个 Trait

那么公共函数可以要求其参数是实现某个 Trait 的结构体

```rust
pub fn notify(item : impl Summary){
    item.summarize();
}
```

### Trait Bounds 约束

1、

给上面的换一种写法

```rust
pub fn notify<T: Summary>(item:T){
    item.summarize();
}
```

优势是，如果有两个 item，可以写一次 Summary

2、

多个接口

```rust
pub fn notify(item : impl Summary + Display){
    item.summarize();
}
pub fn notify<T: Summary + Display>(item:T){
    item.summarize();
}
```

3、

过于复杂的用 where 子句

```rust
pub fn notify<T, U>(item : T, item2: U)
where T: Summary + Display,
      U: Debug + Clone{
    item.summarize();
}

```

4、返回值实现 Trait

```rust
pub fn func() -> impl Summary{
    
}
```

**注意**：只能返回 trait 的一种具体实现，不能可能的返回值有多个 struct 类型

### 生命周期引入

```cpp
int& createInt() {
    int value = 42;
    return value;
}

int* createInt(){
    int value = 42;
    return &value;
}
```

C++函数就不合理

原因是它返回了一个栈上的引用

这里，别人会调用这个函数，而调用者不知道内部发生了什么

而函数也不知道外部会发生什么

那么有什么办法，能够让函数返回一个绝对正确的引用呢？绝对不会出错

那就是，我们给函数的每个形参，每个返回值都标注生命周期

**生命周期： 是指引用有效的作用域**

**引用的生命周期从借用处开始，一直持续到最后一次使用的地方**

```rust
let mut r;
{
    let x = 5;  
    r = &x;    
}
```

这个是什么意思呢？

就是说，借用了&x，这一步是可以的

但是不可以赋值给 r，因为 r 的作用域比 x 大（注意不是&x）

报错：`x does not live long enough`

什么时候能通过，作用域比大小

### 函数的生命周期标注

```rust
fn longest(x: & str, y: &'a str) -> & str {
    if x.len() > y.len() {
        x
    } else {
        y
    }
}
```

这个函数，不标注生命周期的问题是什么呢？

```cpp
const wchar_t* fn(const wchar_t* p1, const wchar_t* p2)
{
    return p2;
}

int main() {
    const wchar_t* s1 = L"1";
    const wchar_t* r = nullptr;
    {
        std::wstring s2 = L"2";
        r = fn(s1, s2.c_str());
    }
    std::wcout << r;
    return 0;
}
```

可以看到我这里有两个字符串的生命周期不一致

但是 fn 函数是不知道给自己参数生命周期是否一致，反正它不管里面咋算，最后会返回这两个之一

那么外面从 fn 拿的指针，也不知道生命周期，所以 r 被赋值了

但是超出了作用域还在用

Rust 可以避免

```rust
fn main() {
    let s1 = "1";
    let mut r:&str = "";
    {
        let s2 = String::from("2");
        r = longest(s1, s2.as_str()); // s2 会报错
    }
    println!("The longest string is {}", r);
}
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() {
        x
    } else {
        y
    }
}
```

这里就是函数标注作用域来保证的。

因为调用这个函数，要求你是三个参数的作用域必须一致

而这里调用后发现，s2 的作用域要小，那么报错。

如果 x 和 y 都是 'a 那么 ，返回值的生命周期，应该是这两个里短的那一个

1、返回值的生命周期必须是传入参数的生命周期里的某一个。如果没有传入参数，你必须用 Box 这种智能指针，或者是直接以值类型返回，不允许返回引用。（除非 unsafe）

### 结构体的生命周期

之前的结构体，每个字段都是自持有的类型

但是结构体也可以包含引用，这时强制要求标注

结构体空引用的太多了，这里就不举 C++例子了，太常见

```rust
struct my_string<'a>{
    s:&'a str,
}
```

函数，结构体，都是在自定义标识后添加泛型生命周期，而不是 struct 关键字后

这个目的是保证。

只要这个结构体有效，结构体中的引用就不会空。

```rust
    let mut ms = my_string{s:"Hello World"};
    {
        let s2: String = String::from("Hello World2");
        ms.s = s2.as_str(); //s2 出错
    }
    println!("{}",ms.s);
```

### 省略

（只能省略函数，包括成员函数，其它一律不能省）

1、如果只有一个输入，那么输入的 a，会赋予每个输出（输出是指其它没被推断出来的，不一定是函数的返回值）

2、如果有多个输入，但是包含 &self &mut self（实际上也就说它是成员函数），那么这个 self 的生命周期会赋予所有输出

基本有两点：

1、省略的，要么是全 a，要么是全 self

2、输入大于两个 & ，无 self，就标注

### 静态

static 是永远有效，包括字符串字面量

### 闭包

观看此内容前，请复习 C++闭包

rust 的任何运算符，都是类似通过接口的形式（个人理解）

比如 闭包 就是去实现 Fn 这个 trait（还必须实现 FnMut FnOnce）

`Fn`、`FnMut` 和 `FnOnce` 是三个核心闭包特质（traits），它们定义了闭包如何捕获环境变量以及可被调用的次数

FnOnce：最多调用一次（传入方式无所谓，可变不可变引用 或者 转移所有权均可） 

FnMut：可多次调用，并且可以修改变量（可变引用传入）

Fn：可多次，不修改（相当于是外部的值，以不可变引用的形式传入闭包） 

| 特质     | 捕获方式          | 可修改变量？ | 调用次数 | 典型场景               |
| -------- | ----------------- | ------------ | -------- | ---------------------- |
| `Fn`     | 不可变借用 (`&`)  | ❌            | 任意多次 | 无状态闭包（如纯函数） |
| `FnMut`  | 可变借用 (`&mut`) | ✔️            | 多次     | 有状态闭包（如计数器） |
| `FnOnce` | 移动（所有权）    | ✔️/❌          | 一次     | 消耗变量/跨线程传递    |

- **继承关系**：
  `Fn` → `FnMut` → `FnOnce`
  （`Fn` 是最严格的，`FnOnce` 是最宽松的）

```rust
fn main() {
    let x=0;
    let y=1;
    let f = add; // fn add(i32, i32)->i32
    let z = |m:i32, n:i32| -> i32 { //impl Fn add(i32, i32)->i32
        m + n
    };
}
```

### 类型标注

一般编译器能推断出类型，可以不标注

但是编译器只能推断出一种类型，不可以泛型

### 记忆化

让一个 struct 持有闭包以及其调用结果，只有需要结果时，才调用闭包

```rust
struct Cache<T>
    where T: Fn(i32) -> i32 {
    calculation: T,
    value: Option<i32>,
}
impl<T> Cache<T>
where T: Fn(i32) -> i32{
    fn new(calculation: T) -> Cache<T> {
        Cache {
            calculation,
            value: None,
        }
    }
    fn value(&mut self, arg: i32) -> i32 {
        match self.value {
            Some(v) => v,
            None => {
                let v = (self.calculation)(arg);
                self.value = Some(v);
                v
            }
        }
    }
}
```

这样依然可以实现类似于 C++的回调

即通过结构体闭包不同，鼠标点击后执行不同的操作。

```rust
/// 一个简单的处理器，持有闭包作为回调
struct Processor<T> {
    /// 这里的闭包是 （引用 T) -> U
    /// 之所以用 Box<dyn Fn(&T) -> U>，是为了在编译期不确定闭包的具体类型。
    callback: Box<dyn Fn(&T) -> String>,
}

impl<T> Processor<T> {
    /// 通过泛型参数 F，接收任意实现了 Fn(&T) -> String 的闭包。
    /// 'static 约束表示闭包的生命周期不依赖于函数栈帧，可以安全地存储。
    fn new<F>(f: F) -> Self
    where
        F: 'static + Fn(&T) -> String,
    {
        Processor {
            callback: Box::new(f),
        }
    }

    /// 对外提供的处理接口
    fn process(&self, data: &T) -> String {
        (self.callback)(data)
    }
}

fn main() {
    let p = Processor::new(|text: &String| {
        // 这里闭包里可以写各种业务逻辑
        format!("Hello, {}!", text)
    });

    // 可以反复调用 process，执行封装起来的逻辑
    let result = p.process(&"Rust".to_string());
    println!("{}", result); // 输出：Hello, Rust!

    let text_data = "World".to_string();
    let another_result = p.process(&text_data);
    println!("{}", another_result); // 输出：Hello, World!
}

```

### 捕获

闭包可以访问定义闭包那个作用域内的变量，而普通函数不可以，必须传递到形参里

捕获值类似于给函数传参（实际上是用于构造闭包类的成员变量了）

1、取得所有权 FnOnce

2、可变借用 FnMut

2、不可变借用 Fn

创建闭包时，通过对环境值的使用，编译器会推断使用哪个 trait

无需访问外部的，实现 Fn

没有移动的，实现 FnMut

否则实现 FnOnce

### move

强制 将 闭包处的函数移动到 闭包内

一般没用，只有多线程切线程才用好像是

### 闭包总结与讨论

https://www.zhihu.com/question/21865351

闭包就是：一个函数，以及与它关联的环境。

以往的函数，其内部变量的值，依据**定义**时的上下文

而闭包，其内部变量，可以依赖**调用**时的上下文

一个闭包提供了一个环境，可以隐藏状态，显露行为，模仿 OOP

对象是天然的闭包。

闭包让无状态的函数有了状态，函数有了状态和行为，和对象一样，成为了完整的状态机

### 迭代器

实现 Iterator Trait。其仅要求实现一个方法 next

next 会修改 迭代器 内部指针指向。用一次少一个，直到耗尽。

所以必须是 mut 的才能调 next（for 循环自动转型了）

`iter` 一个不可修改原有 Vec 的迭代器，只能读

`into_iter` 同上，并取得所有权。即这个函数的参数是 self，而上一个是&self

`iter_mut` 第一个的可变版本，可以修改。

```rust
    let v:Vec<i32> = vec![1, 2, 3];
    let i1 = v.iter(); //Iter<`_, i32>
    let i2 = v.into_iter(); //IntoIter<i32>
    let i3 = v.iter_mut(); //IterMut<`_, i32>
```

### 消耗和产生迭代器

迭代器上有一些方法可以逐步的把迭代器消耗掉。

```rust
    let sum = i1.sum::<i32>();
```

**迭代器适配器**

将迭代器转换为别的迭代器

例 1：`map`

map 接受一个闭包，返回另一个迭代器

```rust
    let v:Vec<i32> = vec![1, 2, 3];
    let i1 = v.iter();
    let i2 = i1.map(|x| x + 1); //这个实际上是没做事情的
    println!("{:?}", i2.collect::<Vec<i32>>()); //collcet 才做事情
```

`collect` 消耗性适配器，收集到另一个集合里

调用 `.collect()` 后，迭代器中还没被迭代掉的元素会被全部迭代出来，然后根据 `.collect()` 的目标类型（比如 `Vec<_>`、`HashMap<_, _>`、`String` 等）构建一个新的集合或对象。之后，迭代器本身就相当于被“跑到底”了，不能再用来产生任何元素。

例 2：`filter`

接受一个闭包，此闭包返回 bool。返回一个迭代器，内容是闭包结果是 true 的元素。

反向遍历

```rust
for x in v.iter().rev()
```

```rust
#[derive(Debug, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}
fn find_point(i_point:Vec<Point>, size:i32) ->Vec<Point>{
    i_point.into_iter().filter(|p| p.x < size).collect()
}
```

### 与 C++对比

在 C++ 中，标准库迭代器本质上是对容器中某个位置的“指针式”抽象

可以前后移动（如 `++iter`、`--iter`），不属于“消耗”性的操作

在 Rust 中，它更像一个“一去不复返”的数据流——在默认情况下只能**单向**遍历且会在过程中把迭代器“消耗”掉
