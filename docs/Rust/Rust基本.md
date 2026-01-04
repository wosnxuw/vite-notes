# Rust基本

### 变量

```rust
let a: i32 = 1;
let mut x = 5;
let _a = 1; //忽略警告
const a: i32 = 1;
```

非 mut 的 let 和 const 的区别是：

const 必须直接给出字面量，编译期间决定，不能后期计算

而 let 虽然不可变，但是是可以后期求出来的

（对比，C/C++，其 const 既可以编译期，也可以运行期，constexpr 必须是编译期，类似 rust 的 const，`const fn`是专门用于编译时求值的函数）

```rust
let x = 5;
let x = x + 1; //遮蔽
let mut y = 5;
y = y + 1;
```

**遮蔽**可以让不同阶段的值以同样的名字表示，避免引入额外的命名复杂性（比如矩阵计算，你不应绞尽脑汁起名字）

当变量需要频繁更新时，例如在循环中递增计数器，或者存储某个对象的状态时，使用 `mut` 更自然

### 复合量

整数的默认类型是 i32

浮点数只有两种 f32 f64，默认是 f64 即 double

**元组** Tuple：多个类型的多个值，**固定长度**，放在容器里

你是可以不指明具体类型的，因为本质 let 就像 C++的 auto。不过也可以自己给

```rust
let my_tuple = (1, 2, 3); 
let a = my_tuple.0; // 直接拿
let (x, y, z) = my_tuple; //解构
```

**数组** 一个类型的多个值，固定长度，放在容器里

```rust
let my_array = [1, 2, 3];
let my_array：[u32, 3] = [1, 2, 3]; // 类型标注
let my_array = [0;10]; // 迅速初始化 10 个（重要）
```

数组超范围是可以编过的。简单的会检查，复杂的无法检查，运行时会 panic。

### 移动

1、每一个值都有一个变量，是该值的所有者

2、每个值同时只有一个所有者

3、所有者超出作用域，值被删除

```rust
let x = 5;
let y = x;
```

5 的所有权没有被转移，而是 y 拷贝了 5

rust 的简单类型，包括**引用**，赋值之后会发生拷贝（而 C++则是都会拷贝，比如 string，vector）

而 非简单类型，则所有权会发生转移。即 String::from 构造出的值，一开始被 s1 持有，之后被 s2 持有

```rust
let s1 = String::from("hello");
let s2 = s1;
```

s1 之后不允许用了。上面的例子可以解读为`s1`被**移动**到了`s2`中

```rust
let s: String = String::from("hello");
takes_ownership(s);   
fn takes_ownership(some_string: String) {
    println!("{}", some_string);
}
```

Rust 中 `s` 的所有权会在调用 `f(s)` 时移动到函数参数 `some_string` 中，因此在调用 `f(s)` 后，变量 `s` 就不能再被使用了。如果尝试使用 `s`，编译器会报错。

这一点和常见的语言不同，因为常见语言是不移动的。比如 C++，他这里会拷贝一次。

const wchar_t* 指针指向的内容不可变，但是指针本身可以重新赋值，指向其它位置

wchar_t* const 指针指向的位置不变，内容可以改

Rust 的 String let 语句的效果约等于是 const wchar_t * const

即 1、S 本身不可重新赋值 2、String 的内容不允许修改

（可以通过变量遮蔽的方式或转移所有权来更改可变性）

```rust
    let s = String::from("hello");
    s.push_str("xxx"); //fail
    s = String::from("world"); //fail
// String 的值虽然是堆上的，但是 s 超作用域就会被自动释放，会自动调用 dorp()
```

let mut 之后，既可以给 s 重新赋值，也可以修改 String 的内容， 类似没有任何 const 的 wchar_t*

```rust
    let mut s = String::from("hello");
    s.push_str("xxx"); //ok
    s = String::from("world"); //ok
```

如果你真的想要复制到堆上的数据（对于 std::wstring，是会复制到堆里的），你需要 clone

```rust
let s = String::from("hello");l
let s2 = s.clone(); // clone 会把栈、堆完整的复制一遍
```

当一个元组的所有元素都是简单类型，那元组也可以复制，否则不行

### 函数

rust 不像 C，函数使用可以比声明早。同时函数的声明和实现通常是一起写的。

函数形参的类型，**必须声明**

返回值 可以没有 -> （如果你不想返回，就不需要写 ->）

```rust
fn my_add(x:i32, y:i32)->i32{
    x+y
}
```

**函数的返回** 我们常常过于看重传参而忽视返回 返回也会发生所有权的转移

就是说，返回值会被移出函数

```rust
let s1 = give_ownership(); 
fn give_ownership() -> String {
    let s = String::from("hello");
    s
}
// 这个是对的，s 会把所有权移动到外面
```

```rust
let s1 = take_and_give_back(s2);
fn take_and_give_back(s: String) -> String {
    s
}
// 这也是对的
```

### 所有权

### 引用和借用

获取变量的引用，称之为借用 (borrowing)，也就是引用是一个结果，借用是一个过程

借用（borrowing）：**符号：`&`** 

Rust 也是支持解引用运算`*`的

```rust
fn f(some_string: &String) {
    println!("{}", some_string);
}

fn main() {
    let s: String = String::from("hello");
    f(&s); // 借用
    println!("{}", s); // 可以继续使用 `s`
}
```

借用的目标：允许你使用值，但是不获取所有权

这里和 C++的区别是

如果函数的形参类型是 &String，那么函数内部不需要解引用就能用，类似 C++

但是给函数传参的时候，需要用&取引用，而 C++不用

（我个人理解，借用就是 C++的引用，默认是 const std::wstring&）

`fn f(some_string: &mut String)`  &mut 声明可变引用

总的来说，借用规则如下：

- 同一作用域，你只能拥有要么一个可变引用，要么任意多个不可变引用
- 引用必须总是有效的

### 字符串

在核心语言层面，只提供了 `&str` 这种字符串切片。

String 是标准库的东西，主要就是可拥有所有权。

rust 里的 **单个字符**，是有这个类型的，是叫做 char，但是是 32 位，和 i32 一样长。并不是 String 里的每个元素

#### 定义

我们先看最开始的字符串是怎么**定义**的：

```rust
// 字符串字面量就是 &str 类型
let s1: &str = "Hello, World!";
let s2 = "字符串切片"; // 类型推断为 &str
// 从 String 获取 &str
let string = String::from("hello");
let slice: &str = &string;
```

我个人的理解是，这种 &str 类型（不可变）的类似一个 C 里的老式指针，指向一个字符串，这个字符串可以是 编译期预定义的常量，也可以是后续指向的堆上的数据

（其实 **`&str` 是胖指针**：包含数据指针和长度信息）

其实你没有想过，&str，那么其实 str 是一个类型

然后呢，String 就类似 std::string，并且可以声明可变的

String 的函数，和 Vec 的函数名称差不多

```rust
// 创建 String 的几种方式
let mut s1 = String::new();
let s2 = String::from("hello");
// 从 &str 转换
let s3 = "hello".to_string();
let slice = "world";
let s4 = slice.to_string();

```

#### 编码

不管是 编译期定义的字符串常量（在只读数据段）和 运行时可变的 String，都是 UTF-8 编码的

所以我们要能区分字符和字节，在 Rust 里，字符才是"世界"，字节则一定是 C 语言的一个 char

```rust
    let s = "hello 世界";
    println!("字符串总字节数：{}", s.len()); // 11 个字节
    println!("字符数：{}", s.chars().count()); // 7 个字符
```

备注：s 的类型是 &str，却可以调用函数

这是 Rust 的 **自动解引用强制转换 (deref coercion)** 和 **方法解析机制**

```rust
// 当你调用 s.len() 时，编译器实际上做了：
s.len() → (*s).len() → str::len(&s)
// 以下调用方式是等价的：
let len1 = s.len();
let s = String::from("hello");
let len2 = s.len(); // 实际调用：str::len(&s) - 因为 String 实现了 Deref<Target=str>
```

#### String 操作

操作（必须是 mut）

1、`s.push_str("rust");` 把一个切片，附加到字符串结尾

2、`s.push('a');` 单个字符

3、`+` 拼接 `let s3 = s1 + data;` 前一个值要求是 String 类型，后一个值要求是&str 类型。实现是`fn add(mut self, other: &str) -> String` 使用后，s1 的所有权被释放了。这种设计可以连加，只有第一个是 String，剩下全是&str

4、`format!("{data} and {s}")` 这个宏。优势是，参数类型随意，并且不会取得所有权。

5、`s.len()` 返回字节数 `let l = String::from("He 我操 llo").len(); //11` 实际上是包装的 `Vec<u8>`

所以不支持 `s[0]` 这种索引，这种是所引到 byte 上了，拿的东西不对

6、`s.insert(5, ',');`  类似 push

7、`s.insert_str(6, " I like"); `

**8、`s.chars()`** 返回一个迭代器，经常用于 for 中遍历标量值。这个方法可以让你遍历所有字符

```
for (i, c) in s.chars().enumerate()
```

9、`trim()` 去掉空白

10、`parse` 转换为 int

```
pop()`，`remove()`，`truncate()`，`clear()
```

#### 取子串

想要准确的从 UTF-8 字符串中获取子串是较为复杂的事情，例如想要从 `holla 中国人नमस्ते` 这种变长的字符串中取出某一个子串，使用标准库你是做不到的（这个问过 AI，确实是做不到好像）

之前做 LeetCode 上的字符串的题的时候，我看 AI 都是把字符串转换为 `Vec<char>`

字符串上的很多接口其返回值都是一个&str，所以你可以**链式调用**

**字符串切片**

和其它语言的那种切片不一样。它指的是字符串一部分的引用

虽然我们称呼其为字符串切片，但是实际上应该是字符串切片的引用

```rust
let s = "xzxxxx"; //字符串字面量，就是一个&str，是一个切片    
let s = String::from("hello");
let num = 4;
let a = &s[..num]; // 不写就是 0
let b = &s[0..7]; //能编译，但是无法运行
```

然而这个 b 东西它**只能切片英文**，如果包含汉字，就会死掉

对于初学者来说，直接对字符串进行切片是危险的

函数返回值可以是切片

**注意：** 函数的接口（返回值，形参）使用字符串切片&str 来替代字符串引用&String，是好的操作习惯

```rust
fn first_word(s:&String)->&str {
    let bytes: &[u8] = s.as_bytes();
    for (i, &item) in bytes.iter().enumerate() {
        if item == b' ' {
            return &s[..i];
        }
    }
    &s
}

fn main() {
    let mut s = String::from("h 你 ello");
    let word = first_word(&s);
    s.clear(); // 去掉以后是可以编译的
    println!("{}", word);
}
```

当一个可变的变量，有不可变的引用时，不可以修改其值。直到不可变引用超出作用域

```rust
    let mut s = String::from("h 你 ello");
    {
        let word = first_word(&s);
        println!("{}", word);
    }
    s.clear();
```

str 和 [u8] 这个才是真的切片，这个切片的内容，可能在栈，可能在堆，可能在静态区。并且大小可变

切片 `slice` 是一种 [动态尺寸类型（DST，dynamically sized type）](https://rustwiki.org/zh-CN/reference/dynamically-sized-types.html)，它代表类型为 `T` 的元素组成的序列，写作 `[T]`。

另一种动态尺寸类型是 [特征对象（trait object）](https://www.zhihu.com/question/581900340/answer/2873592812)。

而 &str &[u8] 是一个引用，大小固定

str 本身是可以修改的，但是大部分的硬编码都不让修改

函数参数类型设为 `&str`，不仅能传入 `&str` 类型变量，也可以传入 `&String` 类型（它可以隐式转换为 `&str` 类型）

同理&[i32] 可以传 `&Vec<i32>`

如果还理解不了，请背诵一句话：String 是 str 的指针，并拥有 str 的所有权；&str 也是指针，没有所有权（即借用）。和上句话有冲突的话，一定是 deref 没理解

### 结构体

定义：

```rust	
struct User {
    active: bool,
    username: String,
    email: String,
    sign_in_count: u64, //最后一个，可有可无
}  //没有；
```

造一个实例：（我注意到赋值使用的也是 `:` 而非 C 语言的 = ）

```rust
let user1 = User{
        email:String::from("123@a.com"),
        username:String::from("lym"),
        active:true,
        sign_in_count:1, //最后一个，可有可无
    }; //必须；
```

（1）必须每个字段都初始化。而 C 语言可以不这样，导致不初始化的值是随机数

（2）不必须顺序一致

访问控制符`.`

```rust
user1.active = false; //user1 is mut
```

（3）更新

```rust
let user2 = User{
    a : user1.a,
    b : user1.b,
    c : "xxx",
}

// 前面写两个。.
let user2 = User{
    c : "zzz",
    ..user1
}
```

（4）Tuple Struct

整体有一个名字，但是元素没名

```rust
struct Color(i32, i32, i32); //必须有；
```

（5）

Struct 里面 放 String，是可以的

但是放 &str 会牵涉到生命周期

（6）调试信息

默认是无法输出结构体的，但是也可以

```rust
#[derive(Debug)]
struct Rect{
    width:u32,
    length:u32,
}
println!("{:?}",r);
println!("{:#?}",r);
```

derive 是派生，可以为你的自定义类，实现一些行为。

你的 Rect 派生于 Debug，所以才能打印

（7）成员函数

长方形求面积的函数，不能写在结构体里面，而是外面，关键字是 `impl`

```rust
impl Rect{ //第一步是对 Rect 进行实现
    fn area(&self) -> u32{ // 第二步是在花括号里写方法，必须写出来是 &self
        //这里可以 self 可以&self 可以 &mut self
        self.width*self.length
    }
        fn square(size:u32) -> Rect{ //可以写一起，也可以换一个 impl 块
        Rect{
            width:size,
            length:size,
        }
    }
}

r.area();
let s = Rect::square(20); //类似 C++
```

rust 里没有 r->area() 一说，永远是`.`，rust 会自动匹配，你也不需要对 r 进行&

（8）静态方法

这里叫做“关联函数” 就是没有 self

### 控制流

1、if 后面**不需要小括号**。if 语句有返回值

```rust
let number = if true {5;} else {6;}; // 这个不对，number 的类型是括号
let number = if true {5} else {6}; // 这个对，因为 5 这个表达式是语句块的最后一句，是返回值
```

但是一定得有大括号

2、`for` 循环是 Rust 循环王冠上的明珠

使用 `for` 时我们往往使用**集合的引用**形式，除非你不想在后面的代码中继续使用该集合（就好比函数的形参）

如果不使用引用的话，所有权会被转移（move）到 `for` 语句块中，后面就无法再使用这个集合了）：

```rust
for item in collection //转移了
for item in &collection // 不可变借用
for item in &mut collection // 可变借用
```

什么时候需要用。iter() 呢？

有一些结构体自己会实现**`IntoIterator`**，这种会自动调 iter()

.iter() 返回的是 &T 一个不可变引用

```rust
    let mut my_list:Vec<i32> = Vec::new();
    my_list.push(1);
    my_list.push(2);
    my_list.push(3);
    for i in &my_list {
        println!("{}", i);
    }
    for i in my_list.iter() { // 效果相同
        println!("{}", i);
    }
    for (i, value) in my_list.emunerate() {  //出错，Vec 没有这个方法
        println!("{}: {}", i, value);
    }// 这里实际上是一个模式匹配，用一个元组去匹配 emunerate 的返回值
```

```rust
fn first_word(s:&String)->usize {
    let bytes = s.as_bytes();
    for (i, &item) in bytes.iter().enumerate() {
        if item == b' ' {
            return i;
        }
    }
    s.len()
}
```

bytes 的类型是 &[u8]  而这里又取了引用？ 

&[u8] 应该算是一个切片，它有一个指针+一个长度

for x in my_list 这个语句，你要仔细分析** my_list **是否能拿到所有权，即 my_list 是引用，还是直接就是一个持有者

3、`loop` 无限循环

```rust
loop{

}
```

4、

一旦你使用了 if-else 那么就应该考虑换成 match

5、迭代器

```rust
let my_array = [1, 2, 3];
    for e in my_array.iter() {
        println!("{}", e);
    }
// 可以看到 e 的类型是&i32, 是直接引用了，如果需要的话你可以修改
```

6、python 的 range() 函数？

```rust
for i in (1..10){
}
```

### 模式匹配

**match** 

穷尽匹配，用 `_` 来代表未列出的所有可能性。不一定非得有_，但是不穷尽的话，编译器会警告

一个分支有两个部分：**一个模式和针对该模式的处理代码**

`match` 本身也是一个表达式

**如果你只有一种情况需要处理，剩下的均忽略，使用 if let**

无论是 `match` 还是 `if let`，它后面跟的那个变量，这里都是一个新的代码块。可以认为行为和 for 类似。而且这里的绑定相当于新变量，如果你使用同名变量，会发生变量遮蔽。

和他妈 MetaModelica 一模一样！

```rust
fn main() {
    let x = Some(5);
    let y = 10;

    match x {
        Some(50) => println!("Got 50"), //如果这个分支只有一句话，则用逗号结尾。并且 println 这个表达式的返回值会返回
        Some(y) => {
            println!("Matched, y = {:?}", y)；
        	1
        }
        _ => println!("Default case, x = {:?}", x),
    }

    println!("at the end: x = {:?}, y = {:?}", x, y);
}
```

1、利用 match 匹配枚举

```rust
enum IpAddrKind{
    V4(u8, u8, u8, u8),
    V6(String),
}
enum WebSite{
    Http,
    Https(IpAddrKind), //枚举可以绑定一个值，这个值可以是另外一个枚举
}
fn main() {
    let web1 = WebSite::Http;
    let web2 = WebSite::Https(IpAddrKind::V4(127, 0, 0, 1));
    match &web2 {
        WebSite::Https(ip) => { //通过匹配 Https，我们可以拿到里面的值（这里 ip 的类型是 &IpAddrKind) 我们可以进一步做想要的事情
            match ip {
                IpAddrKind::V4(a, b, c, d) => { // 再一次从枚举里拿值
                    println!("{} {} {} {}", a, b, c, d);
                }
                IpAddrKind::V6(s) => {
                    println!("{}", s);
                }
            }
        }
        _ => {}
    }
}
```

2、返回值

每个`match`分支的结果必须属于同一类型。例如，如果某个分支返回整数，另一个返回字符串，这会导致类型不匹配错误。

3、

整数比较大小，用一个公共的接口叫做 cmp

其返回值是 Ordering

```rust
    match my_integer.cmp(&another_integer) {
        Ordering::Less => println!("Too small!"),
        Ordering::Greater => println!("Too big!"),
        Ordering::Equal => println!("You win!"),
    }
```

**if let**

一个简化的控制流。

即 match 中只关心一种情况的简化表达式。

就是个语法糖。

```rust
if let 【模式】 = 【变量】{
    //做事情
} else {
    // 做另一个事情
}

if let WebSite::Https(ip) = web2 {
        match ip {
            IpAddrKind::V4(a, b, c, d) => {
                println!("{} {} {} {}", a, b, c, d);
            }
            IpAddrKind::V6(s) => {
                println!("{}", s);
            }
        }
    }
```

### 标准容器

（呃，我也不好说这个东西具体叫什么，反正每个语言标准库里都有一个类似动态数组的东西）

变长数组 Vec（这个是大写的 V）

构造：

```rust
let mut vec0 = Vec::new();
let mut vec1 = vec![1, 2, 3]; //建议是这个宏
let vec2 = Vec::from([1, 2, 3, 4]);
```

方法：

```rust
v.push(); 
v.len();
v.get(); //类似于下标索引，但是返回 Option<>，利用 if let 捕捉越界，越界不会死机
```

遍历：

```rust
for x in &vec //遍历
for (index, value) in vec.iter().enumerate() //类似 python 的含下标的遍历
for i in (0..v.len()){ //类似 C++的遍历
    v[i]；
}
```

哈希表 HashMap：

除了正常创建，还可以用 collect 方法创建：

对一个类型是 Tuple 的 Vec 用 collect 方法

```rust
fn give_map() -> HashMap<&'static str, &'static str>{
    vec![
        ("double", "double"),
        ("DOUBLE", "double"),
        ("double *", "ref double"),
    ].into_iter().collect()
}
```

(1) collect 函数可以创建多种类型，你需要指明

(2) 使用两个 vector 合并

```rust
    let a = vec![String::from("hello"),String::from("world")];
    let b = vec![1,2];
    let c:HashMap<String, i32> = a.into_iter().zip(b.into_iter()).collect();
```

HashMap 的所有权：（重要）

值会复制，String 会转移进去。

即 insert 的时候，两个 String 会失效。不然就是&str, &str。

`get(K) -> Option(V)`

`for (k, v) in &my_map`

### 枚举

Rust `enum` 更像是**带有内置标签**的“安全 C union”

```C
union MyUnion
{
    int x;
    double y;
};
```

```rust
enum IpAddrKind{
    V4,
    V6,
}
let home = IpAddrKind::V4;
let loopback = IpAddrKind::V6;
```

将数据附加到枚举的变体中

```rust
enum IpAddrKind{
    V4(u8, u8, u8, u8),
    V6(String),
}
let home = IpAddrKind::V4(192, 168, 1, 1);
```

每个变体可以拥有不同的类型，不需要用一个单独的 struct 来存 IP

嵌入的类型是任意的。可以不嵌入，可以是一个匿名结构体

**枚举方法**

和 struct 一样，impl

**Option 枚举**

在标准库中。Rust 没有 NULL，用 None 替代它

大概是这样子

```rust
enum Option<T>{
    Some(T),
    None,
}
```

将一些不确定的数据用 Option 包裹，使用时强制解构，能避免错误

### 枚举+Vec

达到类似于 Variant 的效果？

```rust
enum A{
    Int(i32),
    Float(f64),
    Text(String),
}

fn main() {
    let row = vec![
        A::Int(3),
        A::Text(String::from("blue")),
        A::Float(10.12),
    ];
}
```

### 对 Result 类型 进行判断

rust 非常多标准库函数的返回值是一个 Result 类型，因此我们需要判断其是什么

```rust
io::stdin().read_line(&mut guess)
        .expect("Failed to read line");
enum Result<T,E>{ //这是个泛型，不同函数的 T E 类型不同
    Ok(T),
    Err(E),
}
也就是 E 还可以进一步的提取具体错误。
    let e = File::open("file.txt");
    match e {
        Ok(_) => println!("File opened successfully"),
        Err(e1) => match e1.kind() {
            std::io::ErrorKind::NotFound => println!("File not found"),
            _ => println!("Some other error"),
        },
    }
```

这里，read_line 函数，不仅能够写入 guess 这个字符串，还可以返回一个 Result（你理解为 HRESULT 得了）

Result 这个类，有一个 except 方法，如果 Result 匹配 Ok，则提取 OK 附加的值，返回给你。不然就终端程序，显示失败信息。

Result 实际上是一个枚举，OK 或者是 Err。Ok 上一般会有结果，Err 会返回为什么失败

一般来说，编译器会建议你处理 result

但是，有的时候，我们可能并不想要 except 直接停掉我们的程序。unwarp 是一个不能自定义内容的 except

```rust
let guess: u32 = guess.trim().parse()
            .expect("Please type a number!");

let guess: u32 = 
            match guess.trim().parse() {
                Ok(num) => num,
                Err(_) => continue,
            };
// u32 这个 u32 是必须写的
consider giving `guess` an explicit type: `: /* Type */`
否则会因为返回值类型不明确而不知道返回什么
```

我们字节做匹配，Err 也不停止。num 个名字随便起就行。

### ？传播错误

你也可以将你的函数返回 Result

**？**

问号是一个快速解构 Result 的宏

作用是如果成了，就把 T 取出来，赋值。如果黄了，就直接返回这个 Err

```rust
let conn = Connection::open(XUI_DB_PATH)?; // your code

// lib code
pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
    let flags = OpenFlags::default();
    Self::open_with_flags(path, flags)
}
```

问号支持链式调用。

说白了，如果你正常返回你是 A.b
那么 A 返回 Result，就 A?.b

### 读取标准输入

`println!("hello")` 这是一个宏，好像是 std::macros 

`format!()`的用法和 println! 一模一样，但是一个是返回一个字符串，另一个是返回 0，然后输出

输入：

这里是一个链式调用，stdin() 是一个函数，其返回的是一个 Stdin 对象，而你调用这个对象的 read_line() 方法

```rust
use std::io;
let mut guess = String::new();
io::stdin().read_line(&mut guess)
// 或者是
std::io::stdin().read_line()
```

read_line 获取的是之前的所有输入，包括多个、n

所以如果拿一个字符串存，需要每次先清空

### Rust 的第三方库

`Package`   `Crate`   `Module`

代码组织结构

package：包。构建，共享，最顶级的。

一个包 = 一个 Cargo.toml，描述如何构建 Crate。只能 0 或 1 个 lib Crate，任意个 Binary Crate，至少有一个 Crate。

库作为共享代码的基础，而多个二进制可能对应不同的执行入口，比如不同的命令行工具。唯一的库用于存放公共函数。库只需编译一次，所有二进制共享其编译结果，减少构建时间。

它这个的意思是，比如你写一个数学计算的库，你可以提供 矩阵、向量的可执行文件作为工具，这个叫做多个工具

正常来讲，lib.rs 里没有 main 函数。

```shell
my_package/
├── Cargo.toml
└── src/
    ├── lib.rs         # 库 crate
    ├── main.rs        # 默认二进制（`cargo run` 直接运行）
    └── bin/
        ├── cli.rs     # 二进制 1：`cargo run --bin cli`
        └── server.rs  # 二进制 2：`cargo run --bin server`
```

Crate：模块树。可产生一个库或是一个可执行文件，只能二选一。次顶级的。

这个 crate 直译是 木箱（单元包）

https://crates.io/

https://crates.io/search?q=rand

搜完了直接粘到 Cargo.toml 就行

提一嘴，Cargo 的直译是货物。

Crate Root ：这是一个源代码文件。rs，编译器从这里开始编译这个木箱

Module：模块。控制作用域，私有性。有点类似命名空间似的。可嵌套。

```rust
mod my_mod_md{
    pub fn my_mod_md_fn(){
        println!("my_mod_md_fn");
    }
    mod child_mod_md{
        pub fn child_mod_md_fn(){
            println!("child_mod_md_fn");
        }
    }
}
```

Path：路径。命名方式。

`src/main.rs` 默认成为 binary crate 的 root。这个 crate 与 package 同名

`src/lib.rs` 默认成为 library crate 的 root。这个 crate 与 package 同名

如果有多个 Binary Crate 那么，在 src/bin 下面每个文件是单独的 Crate

rust 的路径中 `super::` 关键字 等于 `../`。Java 是访问父类的方法。rust 用于访问父类块项目中的内容。在 MSVC 中 `__super`是一个编译器扩展，用于访问直接基类的方法

对于现代大型软件来说，一般是一个 exe + 多个 dll

所以这种你必然是要用多个包，它有一种工作空间的概念

能够让一个包里包含子包

**使用其它 Crate**

1、使用绝对路径。类似于 `std::vector<int>::Iterator`

2、相对路径。使用 self，super 或者是当前模块的标识符。

```rust
mod my_mod_md{
    pub fn my_mod_md_fn(){
        println!("my_mod_md_fn");
    }
    mod child_mod_md{
        pub fn child_mod_md_fn(){
            println!("child_mod_md_fn");
        }
    }
}

fn main() {
    crate::my_mod_md::my_mod_md_fn(); //这种是绝对路径。并且在同一个 Crate 里。crate 是关键字
    my_mod_md::child_mod_md::child_mod_md_fn(); //相对路径
}
```

**私有边界**

默认，所有的东西全是私有的。

只有两个东西处于同一个"命名空间"中，才能访问到。

父无法访问子，子可以任意访问父。

结构体公共，只是结构体可以看到，但是字段依然私有。

enum 公共，它的所有“变体”都是公共的！！！不然人家不知道你是什么变体。

**use**

引入，但是只能引入公共部分

```rust
use std::collections::HashMap;
```

最后面的东西，就可以直接用。

同样支持 super。

函数一般是 using 到模块，然后使用模块：: 函数来调用。

结构体、枚举，一般是直接 using 到本身。直接用本身的名字

**as** 指定一个本地名字，和 python 差不多

**pub use** B 库引入了 A 库的结构体，但是如果 C 使用 B，A 对于 C 还是私有的。

B 通过 pub use，可以让 C 库看到 A。

**合并**

类似于 from xxx import  ab,bc,cd

```rust
use std::collections::{self, HashMap, HashSet};
```

导入包的时候，如果右下角一直转圈

```rust
 Blocking waiting for file lock on package cache
```

你可以运行 rust-analyzer : stop server

### 错误处理

可恢复：文件未找到。 用 `Result<T,E>`

不可恢复：数组超索引了。 用 panic! 立即终止

panic! 的 RUST_BACKTRACE = full

能帮助你找到调用堆栈

### derive 

#[derive(Debug)] 这是一个给**结构体**自动实现调试 trait 的派生宏

#[derive(Debug, PartialEq, Eq)]

#[derive(Clone, Copy)]

Debug：允许使用 `{:?}` 格式化打印

PartialEq： 支持 `==` 和 `!=` 运算符。

Eq: 更强的等价关系（要求自反性），用于需要完全相等比较的类型

Copy: 按位复制（浅拷贝），赋值时自动复制而不是移动

Clone: 显式深度克隆的能力

与 Python 装饰器的对比：两者都通过在定义上方使用 `@...`（Python）或 `#[...]`（Rust）来修饰，但是 Python 的装饰器是一个函数，rust 是一个自动实现代码的宏

### cfg test

cfg test

#[cfg(target_os = "linux")] cfg config 配置，这是用于条件编译的宏

#[test] 这是一个标记，当你运行 cargo test 时，把这个函数当作 main 函数
