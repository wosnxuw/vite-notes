# Rust智能指针

### 智能指针

就是用一个结构体，实现 Deref 和 Drop 的 trait

### Box

```rust
let b = Box::new(5);
```

当 b 离开作用域，Drop 被调用，堆上的值自动释放

```rust
use crate::List::{Cons, Nil};

enum List{
    Cons (i32, Box<List>),
    Nil,
}

fn main() {
    let list = Box::new(Cons(1, Box::new(Cons(2, Box::new(Nil)))));
}
```

box 就是类似于 C++的 new，只不过是一个自动析构的 new

### Deref trait

1、自定义解引用运算符的行为

2、让智能指针像常规引用一样处理

```rust
let x =5;
let y = Box::new(5);
assert_eq!(x, *y);
```

我们 Y 的类型明明是 `Box<i32>` ，为什么能和 i32 比较呢？

因为 Deref 是 `*` 操作符，自动将内部的东西取出来了

一个简易的例子

```rust
use std::ops::Deref;

struct MyBox<T>(T);

impl<T> MyBox<T> {
    fn new(x: T)->MyBox<T>{
        MyBox(x)
    }
}
impl <T> Deref for MyBox<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

fn main() {
    let x =5;
    let y = MyBox::new(5);
    assert_eq!(x, *y);
}

```

### 隐式解引用转换

Deref Coercion

用于函数（方法）

当把某类型的引用传递给函数或者方法时，如果函数需要的类型和它的类型不匹配，Deref Coercion 就会自动发生

```rust
fn hello(name :&str){
    println!("Hello, {}", name);
}

let m = MyBox::new(String::from("world"));
hello(&m);
```

### Drop

类似析构函数

Drop 在预引入模块里

```rust
impl Drop for YourClass{
    fn drop(&mut self){
        // todo
    }
}
```

可以使用 `std::mem::drop` 方法提前析构，写的时候就 `drop`

注：你 drop 两次编不过

### Rc

引用计数，共享指针

```rust
use crate::List::{Cons, Nil};
use std::rc::Rc;
enum List{
    Cons (i32, Rc<List>),
    Nil,
}

    let a = Rc::new(Cons(1, Rc::new(Cons(2, Rc::new(Nil)))));
    let b = Cons(3, Rc::clone(&a));
    let c = Cons(4, Rc::clone(&a));
```

**Rc::clone** 增加引用计数

Rc 通过**不可变引用，共享只读数据**

仅单线程可用

### Weak

Weak 是 Rc 的弱引用版本

比如父指针持有子 Rc，子持有父 Weak

### 内部可变性 与 RefCell

设计模式：允许只持有不可变引用的情况下，对数据修改

`RefCell<T>` 持有数据唯一所有权

它和 `Box<T>` 的区别是，Box 在编译时就检查借用规则，有问题编不过。RefCell 在运行时检查

仅单线程可用

![smart_ptr_choice](assets/smart_ptr_choice.png)

RefCell 本身有两个方法，分别是 borrow 和 borrow_mut，分别得到 `Rc<T>` ，`RcMut<T>`

并且它本身会记录，可变不可变的引用当前用了几个。

以维护运行时，仅一个可变借用的规则。

```rust
use std::{cell::RefCell, rc::Rc};

use crate::List::{Cons, Nil};

enum List{
    Cons (Rc<RefCell<i32>>, Rc<List>),
    Nil,
}

fn main(){
    let value = Rc::new(RefCell::new(5));
    let a = Rc::new(Cons(Rc::clone(&value), Rc::new(Nil)));
    let b = Cons(Rc::new(RefCell::new(6)), Rc::clone(&a));
    let c = Cons(Rc::new(RefCell::new(7)), Rc::clone(&a));

    *value.borrow_mut() += 10;
    
}
```

**这种 Rc 里套一个 RefCell 是一种常见做法**，用于实现多持有并且可写入

### Arc

`std::sync::Arc`

Rc 的引用计数+原子操作，适用于多线程。和 Rc 一样，默认不可变，需要“内部可变性”

备注：`shared_ptr` 的引用计数是线程安全的，但是它所管理的对象本身的访问需要用户自己来保证线程安全，类似于 Arc

一般定义为 

```
Arc<Mutex<T>>
Arc<RwLock<T>>
Arc<Atomic>
```

Mutex 是 RefCell 的多线程版本，提供了原子操作

### 语义

Box 并不是缩写，就是英文单词"盒子"的意思。字面意思就是"把数据装进盒子里"

Rc **R**eference-**C**ounted pointer（引用计数指针）

**Ref**erence **Cell**（引用单元格）

| Rust 概念        | 现实世界类比       | 特点                                   |
| :-------------- | :----------------- | :------------------------------------- |
| `Box`         | 个人保险箱         | 只有一把钥匙（单一所有权），主人可存取 |
| `Rc`          | 公司共享文件柜     | 多把钥匙（共享所有权），只读访问       |
| `RefCell`     | 带监控的储物柜     | 可以借用钥匙临时访问（运行时检查）     |
| `Rc<RefCell>` | 共享的可借用储物柜 | 多人共享+可临时借用修改                |

### 二叉树实现

```rust
//Rc：负责所有权共享（多对一关系）（之所以是 Rc 是因为该 Node 不只是定义，你后续还要访问呢，必须引用+1）
//RefCell：负责内部可变性（运行时借用检查）

// Definition for a binary tree node.
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
  pub val: i32,
  pub left: Option<Rc<RefCell<TreeNode>>>,
  pub right: Option<Rc<RefCell<TreeNode>>>,
}

impl TreeNode {
  #[inline]
  pub fn new(val: i32) -> Self {
    TreeNode {
      val,
      left: None,
      right: None
    }
  }
}
```

```rust
fn create_tree() -> Option<Rc<RefCell<TreeNode>>> {
    let root = Rc::new(RefCell::new(TreeNode::new(1)));
    
    let left = Rc::new(RefCell::new(TreeNode::new(2)));
    let right = Rc::new(RefCell::new(TreeNode::new(3)));
    
    // 修改内部值
    root.borrow_mut().left = Some(left);
    root.borrow_mut().right = Some(right);
    
    Some(root)
}
```

接下来我们重点看如何翻转二叉树

我一开始写的是

```rust
fn invert_tree(root: Option<Rc<RefCell<TreeNode>>>) -> Option<Rc<RefCell<TreeNode>>> {
    match root {
        Some(root) => {

        let left = root.borrow_mut().left;
        let right= root.borrow_mut().right;

        root.borrow_mut().left = right;
        root.borrow_mut().right = left;

        invert_tree(left);
        invert_tree(right);

        }
        None => None
    }
}
```

或者是

```rust

            let root = root.borrow_mut();

            let left = root.left;
            let right= root.right;

            root.left = right;
            root.right = left;

            invert_tree(left);
            invert_tree(right);
```

这里，问题的关键并不在于我调用了几次 root.borrow_mut()

像是第一种，root.borrow_mut() 的返回值，没有存储，所以在一行之内就结束了生命周期，这都是没有问题的

问题的关键在于

| 操作                | 所有权变化                | 引用计数变化 | 右侧变量是否失效  |
| ------------------- | ------------------------- | ------------ | ----------------- |
| `rc2 = rc1` （赋值）  | `rc1` → `rc2` （移动）      | **不变**     | 是 (`rc1` 失效）   |
| `rc2 = rc1.clone()` | 无所有权转移 （共享所有权） | **+1**       | 否 (`rc1` 仍有效） |

所以，这里我们拿到 left 以后，就直接相当于把树上元素取下来了，这并不合理

备注：按照 Gemini 说法，用完 `RefMut` 后应该尽快释放（Drop），不要带着锁去进行递归调用。

所以
1、利用 take，直接取出来，获取到手里

take 是 Option 的方法，它是，取出 Option 里的值，然后**在原地留下 None**

实际上这句话就不能过编译

```rust
let left = node.borrow_mut().left;
```

当时我疑惑：

node 的类型是 `Rc<RefCell<TreeNode>>`，我们 borrow_mut 之后，返回什么？ 为什么它能取出 left 我认为，既然 take 函数是 left 之后调用的，那 left 那个位置肯定有一个值啊，那个值不能赋值到外面吗？

其实不行

```rust
let borrow = node.borrow_mut();  // 返回类型是 RefMut<TreeNode>
let left = borrow.left;          // &mut Option<Rc<RefCell<TreeNode>>>
```

关键问题：**你尝试从一个可变引用后面移动值出来**

即，从`&mut T`后面不能直接移动`T`

在 Rust 中，`&mut T` 表示一个**可变引用**，它允许修改数据但**不拥有数据**。当通过 `&mut T` 访问数据时，Rust 会阻止你移动（move）`T` 的所有权，因为移动会导致原始引用悬空（dangling reference），违反内存安全规则。

**`mut_ref` 只是临时借用 `Box` 内部的 `String`，它无权转移所有权**

**若需转移所有权，需用 `std::mem::take` 临时替换内部值**

1. **`Rc` 的本质是共享引用计数**
   所有克隆的 `Rc` 指向同一块内存，没有"个人所有权"概念——它们共同拥有数据，无法单独剥离某个 `Rc` 的所有权。
2. **`RefCell` 保护内部数据**
   即使通过 `borrow_mut()` 获取可变访问，也只能操作内部数据，**不能移动出 `T`**（除非替换为新值）。

所以像是下面这个，他就是把树上两个节点先摘下来了，类似于 C 的赋值为 Null，然后再操作

```rust
        let left = node.borrow_mut().left.take();
        let right = node.borrow_mut().right.take();
		let r = invert_tree(right);
		let l = invert_tree(left);
        node.borrow_mut().left = r
        node.borrow_mut().right = l;
```

2、利用 clone，增加所有权计数

```rust
        let inverted_left = invert_tree(node.borrow().left.clone());
        let inverted_right = invert_tree(node.borrow().right.clone());
        
        // 然后交换
        node.borrow_mut().left = inverted_right;
        node.borrow_mut().right = inverted_left;
```

说白了，我写的问题的关键就是

```rust
    let shared = Rc::new(RefCell::new(String::from("secret")));
    let alice = Rc::clone(&shared);
    let bob = Rc::clone(&shared);
    
    // ❌ 尝试"转移 Alice 的所有权"（实际无法做到）
    let alice_secret = alice; // 错误：这只会克隆 Rc 指针，不会移动内部 String，即 alice 无法再使用了

    // ✅ 但可以通过 borrow_mut() 修改内部数据（影响所有持有者）
    alice.borrow_mut().push_str("!"); // 所有人看到的值变为"secret!"
```

### 浅拷贝还是移动？

第一步，我们定义一个结构体

```rust
struct Book {
    year: u32
}
```

第二步，我们定义一个变量

```rust
let immutabook = Book {
        year: 1979
    };
```

第三步，我们移动它

```rust
let mut mutabook = immutabook;
```

Q：这里是否允许这个移动？

允许。rust 允许你在所有权转移时，更改变量的可读性

Q：immutabook 现在还能不能用

不能。因为所有权转移了

第四步，为结构体实现深浅拷贝，并重复第三步

```rust
#[derive(Clone, Copy)]
struct Book {
    year: u32
}
```

Q：这里是否还有移动？

Copy trait 告诉编译器：这个类型很小，复制成本低。因此此时发生复制（类似 int），产生两个不同的结构体

Q：immutabook 还能不能用？

能。因为是两个结构体

总结：如实现 Copy trait，则 `=`  “赋值” 实现浅拷贝；否则发生移动

第五步，我们为结构体添加智能指针

| 智能指针类型 | 是否可 Copy       | 克隆行为               |
| :----------- | :---------------- | :--------------------- |
| `Box<T>`     | ❌                 | 深度克隆（复制堆数据） |
| `Rc<T>`      | ❌                 | 增加引用计数           |
| `Arc<T>`     | ❌                 | 原子增加引用计数       |
| `Cell<T>`    | ✅（如果 T: Copy） | 复制内部值             |
| `RefCell<T>` | ❌                 | 不实现 Copy            |

```rust
#[derive(Clone)]  // 只能 Clone，不能 Copy
struct Book {
    year: u32,
    description: Box<String>,
}
```

实际上，我们只能实现 Clone，因为 Copy 需要每一个成员，都能 Copy，而智能指针不行

Q：发生了什么？

没有 Copy trait ，所以是所有权转移

第六步，没有智能指针那个最开始的结构体
```rust
fn new_edition(book: &mut Book)
let mut b = Book {...}
new_edition(&mut b) // 必须是 &mut 
```

### 遮蔽+更改可变性

```rust
let x = String::from("hello");
let mut x = x;
```

比如

```rust
// 解析阶段：不需要修改
let config = parse_config();
// 处理阶段：需要添加或修改配置项
let mut config = config;  // 现在可以修改了
config.add_default_values();
```

更清楚地表达了意图变化，表明"前阶段只读，后阶段需要修改"

对比，C++

```C++
    int A[6] = { 1,2,3,4,5,6 };
    const int* const_ptr = A; 
    *const_ptr = 2; //不允许
    int* ptr = const_ptr; //不允许
```
