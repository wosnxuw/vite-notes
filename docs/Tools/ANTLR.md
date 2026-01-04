# ANTLR

### ANTLR

ANTLR 是一个用 Java 编写的词法、语法分析都可以做的分析器

看起来，ANTLR 更加火一些

ANTLR 支持的文法类型是 **LL(\*)**，其中的 `*` 表示能够支持任意数量的前瞻（lookahead）

https://wizardforcel.gitbooks.io/antlr4-short-course/content/embedding-actions.html

https://zhuanlan.zhihu.com/p/483679676

官方给了很多 G4，甚至有 ABB 的

https://github.com/antlr/grammars-v4

不是把注释丢掉，而是放在“隐藏通道”里

```
COMMENT
    : '/*' .*? '*/' -> channel(HIDDEN)    // match anything between /* and */
    ;

WS  : [ \r\t\n]+    -> channel(HIDDEN)
    ;
```

ANTLR v4 鼓励我们保持语法的整洁，使用语法分析树 Visitor 和其它遍历器来实现语言应用。

因此 ANTLR 读取的 g4，一般只包含文法，不像 Bison 那样，包含额外的函数。

生成的东西里，你可以改动，做自己的处理（我们是继承了，然后做处理）

为制作语言应用，我们必须为每个输入短语或子短语执行一些适当的代码，那样做最简单的方法是操作由语法分析器自动创建的语法分析树。

那么 Listener 和 Visitor 是两种遍历树的方式。

默认生成 Listener，Listener 是自动被 ANTLR 调用，而 Visiter 手动遍历。

Listener 机制的强大之处在于所有都是自动的。我们不必要写语法分析树遍历器，而且我们的 Listener 方法也不必要显式地访问它们的子节点。

有些情况下，我们实际想要控制的是遍历本身，在那里我们可以显式地调用 visit 方法去访问子树节点。

### 下载与环境配置

1、首先你需要下载 jar 包

2、除了目标语言是 java，你都需要下载运行时库

通过

```cmd
#启动
java -jar antlr-4.13.1-complete.jar
# -cp 指定寻找的路径
java -cp antlr-4.13.1-complete.jar org.antlr.v4.Tool Hello.g4
java -cp antlr-4.13.1-complete.jar org.antlr.v4.Tool Hello.g4 -visitor
java -cp antlr-4.13.1-complete.jar org.antlr.v4.Tool Hello.g4 -no-listener
-Dlanguage=Cpp
#编译
javac -cp antlr-4.13.1-complete.jar Hello*.java
#利用内置的 TestRig 工具做测试
#因为同时要用到 jar 和你的 class，所以 . 是必须的
java -cp ".;antlr-4.13.1-complete.jar" org.antlr.v4.gui.TestRig Hello s -tokens
java -cp ".;antlr-4.13.1-complete.jar" org.antlr.v4.gui.TestRig Hello s -tree
java -cp ".;antlr-4.13.1-complete.jar" org.antlr.v4.gui.TestRig Hello s -gui
java -cp ".;../antlr-4.13.1-complete.jar" org.antlr.v4.gui.TestRig Calc prog -gui calc.txt
java -cp ".;antlr-4.13.1-complete.jar" Calc calc.txt
```

可以生成 4 个 Java 文件

Lexer Parser BaseListener Listener

两个 token 文件

文法。token Lexer.token

两个 interp 文件，文件名和 token 文件是对应的

### 入门练习

计算器程序

**Visitor**

通过设置标签，来为每个候选项生成单独的函数

```
stat
    : expr                   # printExpr
    | ID '=' expr            # assign
    ;
```

生成 Visitor 以后，发现 Visitor 里提供了很多方法，等待你来补全

```
    /** ID '=' expr */
    @Override
    public Integer visitAssign(CalcParser.AssignContext ctx) {
        String id = ctx.ID().getText();  // id is left-hand side of '='
        int value = visit(ctx.expr());   // compute value of expression on right
        memory.put(id, value);           // store it in our memory
        return value;
    }
```

然后我们可以继承`CalcBaseVisitor<Integer>`类，重写这些方法，然后利用父类自带的遍历方法进行遍历

（呃，虽然叫 base，实际上 base 是继承没有 base 的，无 base 继承 antlr 的。这是因为 base 是一个实类（基础实现类），而无 base 只是一个接口类）

**Listener**

每个标签生成 Enter 和 Exit