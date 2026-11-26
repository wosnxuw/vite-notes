# 词法与语法分析器：从 Flex & Bison 到 ANTLR4

哪怕很久不写解析器、语法细节忘得差不多了，只要顺着这篇的对比框架看一遍，五分钟就能把“`.l` + `.y` C 语言老派组合”与“`.g4` 现代 ANTLR4”的核心套路重新捡起来。

---

## 一、先用两句话唤醒记忆：词法分析和语法分析各自干什么？

不管解析什么语言（C 语言、SQL、配置文件、甚至是工业机器人指令脚本），编译前端永远分两步走：

```text
原始代码字符串 (如 "a = 10 + 20")
  --> 1. 词法分析器 (Lexer / Scanner：用正则表达式把字符流切成一个个单词 Token，如 [VAR, '=', NUM, '+', NUM])
  --> 2. 语法分析器 (Parser：按上下文无关文法 BNF 规则，把 Token 流拼成一棵语法分析树 AST，并执行计算或代码生成)
```

工业界有两代最经典的自动生成工具：
- C 语言传统组合：`Flex`（管词法，写 `.l` 文件） + `Bison`（管语法，写 `.y` 文件）（分别是早年 Unix 上 `Lex` 和 `Yacc` 的 GNU 开源实现）。特点是生成纯 C 代码，性能极高，但语法规则和 C 语言动作代码紧紧耦合在一起。
- 现代全能霸主：`ANTLR4`（词法和语法合写在一个 `.g4` 文件里）。用 Java 编写，支持 **`LL(*)` 文法（任意步长的前瞻 lookahead），能一键生成 Java / C++ / Python / Go 等各种目标语言的解析器，并且通过 Listener / Visitor 模式** 把“纯净的语法定义”和“业务处理代码”彻底解耦。

---

## 二、传统双剑客：Flex (`.l`) 与 Bison (`.y`) 协作实战

### 1. 它们是怎么编译成一个可执行程序的？

刚开始学的时候最容易晕的就是谁生成谁：
1. 你写一个词法规则文件 `lexer.l`，交给 `flex.exe`，它会帮你生成一份 C 源码 `lex.yy.c`；
2. 你写一个语法规则文件 `parser.y`，交给 `bison.exe -d`，它会帮你生成两份文件：C 源码 `parser.tab.c`（旧称 `y.tab.c`）和包含所有 Token 宏编号的头文件 `parser.tab.h`（旧称 `y.tab.h`）；
3. 注意先后顺序：必须先跑 Bison 生成 `y.tab.h`（因为 Flex 的 `.l` 文件里要 `#include "y.tab.h"` 才能认识那些 Token 编号），然后再跑 Flex，最后用 `gcc` 把生成的两个 `.c` 文件合在一起编译成一个真正的解析器 `.exe`！

```text
1. parser.y --(bison -d)--> 生成 y.tab.c 与 y.tab.h (包含所有 Token 宏定义)
2. lexer.l  --(flex, 引入 y.tab.h)--> 生成 lex.yy.c
3. gcc lex.yy.c y.tab.c -o calc.exe
```

### 2. Flex (`.l`) 与 Bison (`.y`) 的三段式骨架

无论是 `.l` 还是 `.y`，文件内部全都用两个百分号 `%%` 硬切成完全相同的三段：`定义区` %% `规则区` %% `C 代码区`。

当 Flex 和 Bison 配合做一个四则运算计算器时，两者的标准配对代码如下：

#### （1）词法文件 `calc.l`（配合 Bison 时，第三段 `main` 函数省去不写，交给 Bison）

```lex
%{
/* 第一段 A：原样照抄进 lex.yy.c 开头的 C 代码 */
#include <stdio.h>
#include "y.tab.h"   // 引入 Bison 生成的 Token 编号定义和 yylval
void yyerror(char *);
%}

/* 第一段 B：正则宏别名定义（下面用 {NUM} 引用） */
NUM [1-9]+[0-9]*|0

%%
/* 第二段：词法规则区（格式：正则表达式 + 空白 + { C 动作代码 }） */
/* 注意：规则区绝不能随便顶格写注释；任何没被匹配到的字符，Flex 默认会直接 ECHO 原样打印到屏幕！ */

{NUM}                       { sscanf(yytext, "%d", &yylval.inum); return NUM; }
"+"                         { return ADD; }
"-"                         { return SUB; }
"*"                         { return MUL; }
"/"                         { return DIV; }
[a-zA-Z_$]+[a-zA-Z_$0-9]*   { return VAR; }
\n                          { return CR; }
[ \t]+                      { /* 匹配空白符但什么都不做，即吞掉空格，防止被默认 ECHO 打印出来 */ }
%%
```

理解 Flex 的三个关键细节：
1. **`ECHO` 宏与未匹配字符**：Flex 内置了 `#define ECHO fprintf(yyout, "%s", yytext)`。只要输入的字符没命中任何一条正则，Flex 就会自动把它 `ECHO` 打印出来。因此不想输出的空格、换行或注释，必须显式写一条正则匹配它并给一个空动作 `{ ; }`。
2. **精确匹配引号**：正则里写 `"int"` 表示精确匹配这三个字符（虽然不加引号写 `int` 有时也行，但加双引号是防歧义的好习惯）。
3. 为什么 Flex 返回 Token 时还要设置一个全局变量 `yylval`？
   因为 `yylex()` 函数的返回值只是一个代表 Token 种类的整数宏（比如 `#define NUM 258`）。Bison 收到 `258` 只知道“这儿来了一个数字”，但不知道这个数字到底是 `42` 还是 `99`！所以 Flex 在匹配到数字的字符串 `yytext` 时，必须顺手用 `sscanf` 把真實数值塞进 Bison 提供的全局共享变量 `yylval` 里带过去。

#### （2）语法文件 `calc.y`（定义 `%union`、终结符 `%token` 与 BNF 产生式）

因为语法树上的节点有的是整数 `int`、有的是浮点数 `double`、有的是字符串 `char*`，所以在 Bison 里要把 `yylval` 的类型声明为一个 `%union`（联合体）：

```bison
%{
/* 第一段 A：C 头文件与前置声明 */
#include <stdio.h>
#include <string.h>
int yylex(void);
void yyerror(char *);
%}

/* 第一段 B：定义 yylval 的联合体类型，并绑定给终结符 (%token) 与非终结符 (%type) */
%union {
    int inum;
    double fnum;
    char *string;
}

%token ADD SUB MUL DIV VAR CR
%token <inum> NUM          // 声明终结符 NUM 使用 union 里的 inum 字段
%type  <inum> expression   // 声明非终结符 expression 计算出来的值也使用 inum 字段

%%
/* 第二段：BNF 语法产生式区（冒号 : 相当于产生式的箭头 →，分号 ; 结束一条规则） */
/* $$ 代表冒号左边父节点的返回值；$1, $2, $3 依次代表冒号右边第 1, 2, 3 个符号的值！ */

line_list: line
         | line_list line
         ;

line: expression CR        { printf(">> 结果 = %d\n", $1); }
    ;

expression: expression ADD expression  { $$ = $1 + $3; }
          | expression SUB expression  { $$ = $1 - $3; }
          | NUM                        { $$ = $1; }
          ;
%%

/* 第三段：C 语言主入口与错误处理函数 */
void yyerror(char *str) {
    fprintf(stderr, "语法错误: %s\n", str);
}

int yywrap() {
    return 1; // 返回 1 表示输入流读完即结束
}

int main() {
    yyparse(); // 启动 Bison 语法分析主循环（内部会自动不断调用 Flex 的 yylex() 要下一个 Token）
    return 0;
}
```

一眼记住 Bison 最核心的一句语法：`father : expr1 SUB expr3 { $$ = $1 - $3; }`——其中 `$$` 就是左边父节点算出来的值，`$1` 是右边第一个符号 `expr1` 的值，`$2` 是中间的减号 `SUB`，`$3` 是右边第三个符号 `expr3` 的值。

---

## 三、现代工业级解析器：ANTLR4 (`.g4`) 核心套路

看完上面 Flex + Bison 就会发现一个明显的工程痛点：你的语法规则（BNF）里面到处嵌着 `{ $$ = $1 + $3; }` 这种写死的 C 语言动作代码。如果同一套语法，你既想拿它做语法高亮，又想拿它做代码格式化，还想拿它转成 Python 数据结构，在 Bison 里就得改得面目全非。

ANTLR v4 的核心革命就是：让 `.g4` 语法文件保持 100% 纯净，里面只写语法规则，不掺杂任何一行具体语言的业务代码！

### 1. ANTLR4 的三个亮点特性

1. **词法与语法合一（大小写区分）**：在同一个 `.g4` 文件里，以小写字母开头的规则是语法规则（Parser Rule），以大写字母开头的规则是词法规则（Lexer Rule / Token）。
2. **官方开源文法库极其庞大**：GitHub 上的 `antlr/grammars-v4` 仓库几乎把全人类常见的语言（C++、Java、Python、SQL、JSON、甚至工业机器人 ABB Rapid 语言）的 `.g4` 文件全写好了，拿过来直接就能生成解析器。
3. 隐藏通道 `channel(HIDDEN)`（优雅保留注释与空白）：
   如果做代码重构或格式化工具，不能把源码里的注释直接丢掉。ANTLR 允许把注释和空白塞进“隐藏通道”——主语法分析器在匹配语法结构时会自动无视它们，但当你需要还原源码或提取注释时，随时又能从 Token 流里把它们原封不动地捞出来：

   ```antlr
   COMMENT : '/*' .*? '*/' -> channel(HIDDEN) ;
   WS      : [ \r\t\n]+    -> channel(HIDDEN) ;
   ```

### 2. 命令行编译与内置可视化调试神器 `TestRig (grun)`

ANTLR 本体是一个 Java 包（如 `antlr-4.13.1-complete.jar`）。哪怕你的目标语言是生成 C++（加 `-Dlanguage=Cpp`）或 Python，平时写 `.g4` 规则调试文法时，也强烈建议先默认生成 Java 代码，因为可以直接用它内置的 `TestRig` 工具一键弹出可视化的 AST 语法树窗口：

```bash
# 1. 编译 Hello.g4，生成 Lexer、Parser 以及 Visitor 遍历接口 (-visitor)
# （如果想生成 C++ 代码，加上 -Dlanguage=Cpp 即可，非 Java 目标语言在运行时需引入对应的 antlr4-runtime 库）
java -cp antlr-4.13.1-complete.jar org.antlr.v4.Tool Hello.g4 -visitor

# 2. 用 javac 编译生成的 Hello*.java 文件
javac -cp ".;antlr-4.13.1-complete.jar" Hello*.java

# 3. 调用内置的 TestRig 工具测试输入文件 calc.txt（其中 Hello 是文法名，prog 是起始根规则名）
java -cp ".;antlr-4.13.1-complete.jar" org.antlr.v4.gui.TestRig Hello prog -tokens calc.txt  # 打印切出来的 Token 流
java -cp ".;antlr-4.13.1-complete.jar" org.antlr.v4.gui.TestRig Hello prog -tree   calc.txt  # 用括号文本打印语法树
java -cp ".;antlr-4.13.1-complete.jar" org.antlr.v4.gui.TestRig Hello prog -gui    calc.txt  # 直接弹出图形化 AST 树窗口！
```

每次运行完第 1 步，目录下会生成 4 个核心代码文件（`Lexer`、`Parser`、`Listener / BaseListener`、以及加了 `-visitor` 才会生成的 `Visitor / BaseVisitor`）外加 `.tokens` 和 `.interp` 编号表文件。

### 3. 遍历语法树的两种模式：Listener（被动回调）vs Visitor（主动控制）

既然 `.g4` 文件里不写业务代码了，那 ANTLR 把代码解析成一棵语法分析树（Parse Tree）之后，我们怎么去上面提取数据或算结果？

首先在 `.g4` 的产生式分支最右边，用 `# 标签名` 给每个分支起个名字（这样 ANTLR 就会为每个分支单独生成对应的处理函数）：

```antlr
stat: expr          # printExpr
    | ID '=' expr   # assign
    ;
```

接下来你有两种遍历这棵树的方式可选：

| 对比维度 | Listener 模式（默认生成） | Visitor 模式（需加 `-visitor` 参数生成） |
| :--- | :--- | :--- |
| 遍历控制权在谁手里？ | 全自动被动回调（由 ANTLR 内置的 `ParseTreeWalker` 从根节点开始做深度优先遍历，走到哪个节点就自动调你的 `enterXxx` 和 `exitXxx` 钩子） | 由你自己在代码里手动显式控制（你想进哪个子节点，必须在代码里亲自写 `visit(ctx.expr())`） |
| 函数有无返回值？ | `void enterAssign(...)` / `void exitAssign(...)` 没有返回值（如果你想在节点之间传数据，只能自己维护一个外部栈或全局字典） | `T visitAssign(...)` 有明确的泛型返回值（比如写计算器时，子树算完直接 `return Integer` 给父节点，极其自然） |
| 能不能跳过某个子树不遍历？ | 不能（Walker 会机械地把整棵树每一个节点全走一遍） | 可以自由控制（比如实现 `if-else` 解释器或循环语句时，只 `visit` 条件为真的那个分支，甚至反复 `visit` 循环体） |

例如用 Visitor 模式 写计算器的赋值语句，只需要写一个类继承自动生成的 `CalcBaseVisitor<Integer>`（注意：`CalcVisitor` 是纯接口，而带 `Base` 的 `CalcBaseVisitor` 是提供了默认空实现的基类，我们永远继承 `BaseVisitor`），然后重写上面打了 `# assign` 标签的那个方法即可：

```java
public class EvalVisitor extends CalcBaseVisitor<Integer> {
    Map<String, Integer> memory = new HashMap<>();

    /** 对应语法里的：ID '=' expr  # assign */
    @Override
    public Integer visitAssign(CalcParser.AssignContext ctx) {
        String id = ctx.ID().getText();       // 拿到等号左边的变量名字符串
        int value = visit(ctx.expr());        // 显式递归调用 visit，算出等号右边表达式子树的值！
        memory.put(id, value);                // 存入符号表内存
        return value;
    }
}
```
