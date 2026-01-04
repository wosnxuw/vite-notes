# tokio

tokio 相当于一个异步运行时

（类似一个线城池？）

你把你的函数和主函数声明为 async 之后

你可以提交给 tokio （但并不会执行），还可以像多线程一样等待

异步函数是惰性的，只有遇到 await 才会运行

在 rust 里

函数前面生命 async 其实只是编译器提供的语法糖

只要是 async 函数，返回值一定是 Future

你的返回值本质也会被包裹进来

即这俩是一样的

```rust
async fn read() -> String{
    sleep(Duration::new(2, 0));
    String::from("1")
}

fn read() -> impl Future<Output = String>{
    async{
        sleep(Duration::new(2, 0));
    	String::from("1")
    }
}
```

Future 里面有一个 Poll 方法

Poll 用于检查到底有没有完成任务

异步执行器来管理所有的 Feature，来调用 poll 方法，驱动这些方法执行

一个程序包括多个任务，一个任务包括多个 Future

Pin：固定
