# 跨语言绑定与原生窗口嵌入：JNI、JNA 与 SWIG 实战

当你手头有一套庞大的 C/C++ 核心库（甚至还带着 MFC 或 Qt 写的原生 3D 渲染窗口），怎么把头文件里的函数提取出来、用 SWIG 生成 Java (JNI) 包装层、再通过 Win32 `SetParent` 句柄把 C++ 原生窗口无缝嵌进 JavaFX / Swing 的界面里。

---

## 一、第一步：如何从 C/C++ 头文件里自动化提取所有函数声明？

如果要给一个现成的 C++ 库批量生成其他语言的绑定接口或者自动生成 API 文档，第一步往往是“先找出头文件里到底有哪些函数、返回值是什么、形参列表是什么”。当时依次试过四条路，各自踩过的坑记录如下：

### 1. 手搓 Python + 正则表达式

- 适用范围：只适合格式极其规整的简单 C 头文件。
- 痛点：一旦遇到稍微复杂一点的 C++ 语法，正则表达式会瞬间膨胀到没法维护。比如光是处理指针和数组形参，`int* a`、`int *a`、`int a[3]` 在语法上作用完全相同，但用正则去区分和归一化就要花大量时间；再加上默认参数、宏定义、函数重载、枚举，纯靠正则必翻车。
- 当时的土办法：先把头文件拷过来，手动预处理一遍格式（比如把跨行的函数声明全压到同一行），跑一遍 Python 脚本初筛，最后还是得靠人眼再过一遍那些带默认参数和特殊宏的函数。

### 2. Clang 编译器工具链（AST 抽象语法树）

Clang 本身就是真正的 C++ 编译器前端，解析准确度肯定是 100%，但想要从 Clang 的分析结果里把数据掏出来，实际门槛非常高：
1. 直接调 Clang 的 C++ 类库（LibTooling / LibClang）：API 极其庞大晦涩，当时试了半天都没调通。
2. 用 Clang 命令行工具直接导出 AST（`clang -Xclang -ast-dump`）：虽然能吐出一个 AST 结构或 XML，但那个输出把所有底层语法节点全展开了，如果不先去啃完 Clang 自身的 AST 节点构建标准，根本没法写脚本解析；而且 Clang 作为编译器，往往要求你得先配齐所有的 `#include` 依赖路径让头文件“能通过编译”，不能随便丢一个孤立的头文件进去就给你出结果，不够灵活。
3. `CastXML`：基于 Clang 的 XML 导出工具，当时也没折腾成功。

### 3. Pygments（词法高亮分词器）

试过用 Python 的 `pygments` 库做词法切分。它用起来确实简单，但因为它只是一个“代码语法高亮器”而不是“语法分析器”，吐出来的 Token 粒度根本不够用：

```text
Name, HRESULT
Whitespace,  
, __stdcall
Whitespace,  
Name, Tool_set_tcp_posture
```

在它眼里，前面的返回值类型 `HRESULT` 和后面的函数名 `Tool_set_tcp_posture` 全都被标成了同一个标签 `Name`，完全区分不开谁是返回值、谁是函数名。

### 4. 最终最实用的方案：Doxygen 导出 XML + Python 解析

试了一圈下来，最省事、鲁棒性最高的是借用文档生成工具 `Doxygen`：
- 最大优势：它不需要你的代码能完整编译通过！哪怕缺其他依赖库，只要把头文件丢给它，解析速度极快，并且能直接配置输出结构化的 XML 文件。
- XML 结构极其清晰（完全贴合人的直觉，不需要学编译器 AST）：
  - 直接按 `<memberdef kind="function">` 标签就能精准捞出所有函数；
  - 每个函数节点下的第一个 `<type>` 就是返回值类型，`<name>` 就是函数名；
  - 底下并排的多个 `<param>` 子节点就对应每一个形参，里面规规矩矩地分好了形参的 `<type>` 和 `<declname>`。
- 写几十行 Python 的 `xml.etree.ElementTree` 脚本去扫一遍 Doxygen 产出的 XML，几秒钟就能把全套函数签名干干净净地提取出来。

> 核心总结：不管用上面哪种工具把 C++ 函数签名提取出来，最后一步“写一套 C++ 类型到目标语言类型的变量映射表”都是逃不掉的。因为解析工具只认识 C++，它不知道你接下来要把 `int*` 变成 Java 的数组还是变成指针包装类。像下面要讲的 SWIG 虽然能一条龙全包，但如果在项目半途才引入 SWIG，原有的手写接口往往也得跟着大改。

---

## 二、Java 调用 C/C++ 的三条路线对比：JNA、JNI 与 SWIG

当我们要从 Java 调用 C/C++ 编译出来的 `.dll`（Windows）或 `.so`（Linux）时，主流有三个工具可选：

| 工具名称 | 核心原理 | 优点 | 致命局限 |
| :--- | :--- | :--- | :--- |
| JNA (`Java Native Access`) | 纯 Java 侧的动态调用库（带一个 `JNA-Platform` 扩展包封装了操作系统常用类型，比如用内部持有一个 `long` 的类来包装 Windows 的 `HWND` 窗口句柄） | 不需要写任何 C/C++ 胶水代码，直接在 Java 里声明接口就能调 DLL | 只认纯正的传统 C 语言导出接口，没法直接调 C++ 类；且对 `int*` 等复杂指针传参极其无力 |
| JNI (`Java Native Interface`) | JDK 官方标准（头文件在 JDK 目录的 `include/jni.h` 和 `include/win32/` 下）。在 Java 里用 `native` 关键字声明函数，然后去 C/C++ 侧按 JNI 严苛的命名和签名规范手写实现函数 | 原生性能最高、灵活性无上限 | 手写极其痛苦：C++ 侧到处都要手动操作 `JNIEnv*`、`jobject`、手动转换字符串编码和管理引用释放，接口一多根本写不完 |
| SWIG | 一个独立的跨语言接口编译器（`swig.exe`）。输入一份专门的 `.i` 接口描述文件，它自动帮你生成全套 Java 代理类 + 底层 C/C++ JNI 包装源码（`xxx_wrap.cxx`） | 既拥有 JNI 的完整能力（支持直接包装 C++ 类、继承虚函数跨语言回调、`std::string`、`std::vector`、指针参数），又彻底省去了手写 JNI 胶水代码的苦力 | 需要学习 `.i` 文件的配置规则与 `typemap`（类型映射）机制 |

---

## 三、SWIG 核心机制与 `.i` 接口文件编写实战

默认情况下，SWIG 会尝试为 C/C++ 代码构建最自然的 Java 映射：独立函数变成模块类的静态方法，C++ 类变成同名 Java 代理类，全局变量和结构体成员自动生成符合 JavaBean 规范的 `getter / setter`。

### 1. SWIG 自动生成的 Java 文件结构与基本类型映射

当你在 `.i` 文件开头写下 `%module YourModuleName` 并运行 SWIG 后，它会产出一组切记绝对不要手动去修改的 Java 文件：

1. `YourModuleName.java`（模块主类）：
   相当于你的 DLL 顶层入口。C/C++ 里所有不属于任何类的独立全局函数，都会作为 `static` 静态方法直接导出到这个类里（如果你包装的全是 C++ 类、没有任何全局函数，这个文件里就几乎是空的）。
   - **全局变量**：因为 Java 里没有全局变量的概念，也不允许重载点操作符，所以 C++ 的全局变量也会在这个类里变成静态的 `YourModuleName.getVarName()` 和 `setVarName()`（注意：它会自动把变量名首字母大写再拼 `get/set`；如果你不小心有两个全局变量只有首字母大小写不同，必须用 `%rename` 改掉其中一个，否则只会生成一个）。
2. `YourModuleNameJNI.java`（底层 JNI 桥接类）：
   全部是 `public final static native ...` 声明，供上面生成的 Java 类在底层调用，业务代码不用直接碰它。
3. 与 C++ 类/结构体同名的“Java 代理类”：
   每个 C++ 的 `class` 或 `struct` 都会生成一个同名的 `.java` 文件（底层其实在 Java 对象里存了一个 `long swigCPtr` 用来持有 C++ 对象的真实内存地址）。
   - **常量（`#define`）**：默认会被转成 JNI 调用，加上 `%javaconst(1);` 指令后可以直接生成为 Java 里的 `public final static` 常量。
   - **枚举（`enum`）**：SWIG 提供四种包装方式（默认是生成类型安全的同名 Java 类并用静态对象表示枚举项，也可以配置直接生成原生 Java `enum` 或简单整数）。
   - **指针与不完整类型**：在 SWIG 眼里，除了基本数值类型，其他几乎全当指针处理。如果某个类型比如 `Matrix*` 没有给出完整定义，或者某个指针参数没有配好 `typemap`，SWIG 不会报错，而是会自动生成一个名字叫 `SWIGTYPE_p_Matrix` 或 `SWIGTYPE_p_int` 的黑盒指针包装类。（工程检验标准：如果你的 `.i` 文件写对了，最终生成出来的 Java 代码里应该干干净净，绝不该出现 `SWIGTYPE_p_int` 这种无法直接在 Java 里赋值的裸指针包装类！）
   - **大整数截断提醒**：C/C++ 的 `int`、`short`、`char`、`float`、`double`、`bool` 都能安全自动映射；但遇到 `unsigned int`（Java 里没有无符号数，大数会变负数）和 64 位 `long / long long` 时务必小心检查类型宽度。

### 2. `.i` 接口文件的三段式结构

`.i` 文件（后缀名有时候也叫 `.swg`，文件名随意）的写法跟 Flex/Bison 非常像，分为三个逻辑区：

```swig
/* 1. 模块声明与原样拷贝区 %{ ... %} */
%module example

%{
// 注意：写在 %{ %} 里面的内容，SWIG 自己【根本不会去解析】！
// 它的唯一作用是原封不动地复制到最终生成的 example_wrap.cxx 开头，让 C++ 编译器能编过。
#include "MyHeader.h"
extern void add(int *x, int *y, int *result);
%}

/* 2. SWIG 类型映射配置区（以 % 开头的指令） */
%include "typemaps.i"
%include <windows.i>   // 用于让 SWIG 认识 __declspec(dllimport)、DWORD 等 Windows 宏（但不含 HWND）

// 告诉 SWIG：凡是遇到名叫 result 的 int* 形参，都按 OUTPUT（输出参数）处理！
%apply int *OUTPUT { int *result };
%apply int *INPUT  { int *x, int *y };

/* 3. 真正需要 SWIG 解析并生成 Java 接口的声明区 */
// 既可以直接把要导出的函数声明粘在下面，也可以用 %include "MyHeader.h" 让 SWIG 扫整个头文件
extern void add(int *x, int *y, int *result);
```

写 `.i` 文件时的四条铁律：
1. 分清 `#include` 和 `%include`：写在 `%{ #include "xxx.h" %}` 里是给 C++ 编译器看的；写在外面用 `%include "xxx.h"` 才是真正让 SWIG 去解析里面的类并生成 Java 接口。
2. SWIG 默认不递归展开头文件里的 `#include`：除非你在命令行强行传了 `-includeall`（千万别随便开，否则它会把整个系统的 `<stdio.h>`、`<windows.h>` 全给你生成一堆 Java 类！）。
3. **声明顺序与 `typedef`**：把头文件喂给 `%include` 时，如果用到了某个 `typedef` 或宏（比如 `MYDLL_API`），必须确保在 `%include` 之前先让 SWIG 看到它的定义（或者直接在 `.i` 里写一句 `#define MYDLL_API` 把导出宏置空）。另外，SWIG 不支持 `extern` 声明某些复杂变量。
4. **结构体里的 `char*` 成员**：SWIG 默认假定结构体里的 `char*` 成员是用 `malloc` 或 `new` 动态分配的，调用 setter 赋值时会自动 `free/delete` 旧内存再拷贝新字符串。

### 3. 搞定 C++ 指针形参：`INPUT / OUTPUT / INOUT` 与数组包装

在 C/C++ 里，我们最喜欢写 `void calc(int a, int* out_res)`，用指针形参当输出返回值；但 Java 里没有指针，而且基本类型 `int` 是按值传递的，在函数里改了根本带不出来。

SWIG 内置的 `typemaps.i` 库专门用“单元素数组 `int[]`”解决了这个问题：

- `OUTPUT`（纯输出参数）与 `INOUT`（既输入又修改输出）：
  只要在 `.i` 文件里用 `%apply int* OUTPUT { int* out_res };`（或者偷懒直接把形参名字改成 `int* OUTPUT`），生成的 Java 方法签名就会自动变成：

  ```java
  // Java 侧调用：准备一个长度为 1 的数组传进去接返回值！
  int[] res = new int[1];
  example.calc(10, res);
  System.out.println("C++ 填回来的结果是：" + res[0]);
  ```

  - **大坑警告**：虽然 Java 侧传进去的是一个 `int[]` 数组，但被 `OUTPUT / INOUT` 修饰的 `int*` 在语义上只代表修改 1 个 `int` 值（即只认 `res[0]`），绝不是让你传一个长数组进去遍历！而且如果是纯 `OUTPUT`，C++ 侧一旦忘了给 `*out_res` 赋值，返回 Java 后 `res[0]` 会被自动覆盖成 `0`！
- 真正的数组传递（`arrays_java.i` vs `carrays.i`）：
  如果 C++ 函数真的需要接收并修改一整个数组 `void populate(int x[], int len)`：
  1. 引入 `%include "arrays_java.i";`：Java 侧可以直接传 `int[]` 数组，最符合直觉，但底层在跨越 JNI 边界时会做一次数组内存拷贝，超大数组有一点性能损耗；
  2. 引入 `%include "carrays.i"` 并声明 `%array_class(int, intArray);`：直接在 C++ 堆上分配一块原生内存，Java 通过偏移量代理类去读写，零拷贝效率极高，但完全没有越界安全检查。

### 4. 生产级全功能 `.i` 配置文件模板（含 `std::vector`、预编译头、虚函数回调与 `std::wstring*`）

这是当时在工业软件项目（`PQKit`）中最终打磨成功的完整 `.i` 配置模板，一次性解决了预编译头 `pch.h`、`std::vector` 模板实例化、`directors="1"`（允许在 Java 里重写 C++ 虚函数实现 C++ 回调 Java）、以及自定义的 `std::wstring* <--> String[]` 双向映射：

```swig
%begin %{
// 如果 VC++ 项目开启了预编译头，必须用 %begin 把 pch.h 强行塞到生成的 wrap.cxx 的第一行
#include "pch.h"
%}

// 开启 directors="1"，允许跨语言虚函数继承（让 C++ 侧能通过回调接口调回 Java 子类！）
%module(directors="1") PQKit

%{
#include "JRoCallback.h"
#include "JRoPlatform.h"
%}

/* 1. 标准字符串与 vector 容器支持 */
%include "std_string.i"
%include "std_wstring.i"
%include "arrays_java.i"
%include "std_vector.i"

namespace std {
  %template(IntVector) vector<int>;
  %template(DoubleVector) vector<double>;
  %template(StrVector) vector<wstring>;
}

/* 2. 自定义 typemap：让 C++ 的 std::wstring* 和 std::wstring& 映射为 Java 的单元素 String[] 数组 */
%include "typemaps.i"

%typemap(jni) std::wstring *INOUT, std::wstring &INOUT %{jobjectArray%}
%typemap(jtype) std::wstring *INOUT, std::wstring &INOUT "String[]"
%typemap(jstype) std::wstring *INOUT, std::wstring &INOUT "String[]"
%typemap(javain) std::wstring *INOUT, std::wstring &INOUT "$javainput"

%typemap(in) std::wstring *INOUT (std::wstring strTemp), std::wstring &INOUT (std::wstring strTemp) {
  if (!$input) {
    SWIG_JavaThrowException(jenv, SWIG_JavaNullPointerException, "array null");
    return $null;
  }
  if (JCALL1(GetArrayLength, jenv, $input) == 0) {
    SWIG_JavaThrowException(jenv, SWIG_JavaIndexOutOfBoundsException, "Array must contain at least 1 element");
    return $null;
  }
  jobject oInput = JCALL2(GetObjectArrayElement, jenv, $input, 0);
  if (NULL != oInput) {
    jstring sInput = static_cast<jstring>(oInput);
    const jchar *$1_pstr = jenv->GetStringChars(sInput, 0);
    if (!$1_pstr) return $null;
    strTemp.assign(reinterpret_cast<const wchar_t*>($1_pstr), jenv->GetStringLength(sInput));
    jenv->ReleaseStringChars(sInput, $1_pstr);
  }
  $1 = &strTemp;
}

%typemap(freearg) std::wstring *INOUT, std::wstring &INOUT ""

%typemap(argout) std::wstring *INOUT, std::wstring &INOUT {
  jstring jStrTemp = jenv->NewString(reinterpret_cast<const jchar*>(strTemp$argnum.c_str()), strTemp$argnum.length());
  JCALL3(SetObjectArrayElement, jenv, $input, 0, jStrTemp);
}

/* 3. 隐藏不需要暴露给 Java 的内部私有成员，并为回调类开启 director 特性 */
%ignore JRoPlatform::m_ptrPQPlatformComponent;
%ignore JRoPlatform::m_CMidCallback;
%ignore JRoPlatform::setJCallback;

%feature("director") JRoCallback;

/* 4. 指针参数批量绑定（确保生成的 Java 文件里不出现任何 SWIGTYPE_p_int） */
// 特殊形参单独命名绑定：
%apply int* INOUT { int* o_nHandled };
%apply double* INOUT { double* i_dPointXYZ };

// 其余同类指针全局兜底绑定：
%apply int* INOUT { int* };
%apply long* INOUT { int* };
%apply bool* INOUT { bool* };
%apply float* INOUT { float* };
%apply double* INOUT { double* };
%apply long long* INOUT { long long* };
%apply std::wstring* INOUT { std::wstring* };

/* 5. 真正扫描并生成接口的头文件（注意特殊结构体的辅助函数需放在 %include 之后以免触发 bug） */
%include "JRoCallback.h"
%include "JRoPlatform.h"
%include "PQKitDef.h"
```

有了这套配置，各种 C/C++ 常见类型在 Java 侧就全有了标准归宿：
- `int / double` $\rightarrow$ 直接映射；
- `char* / BSTR / CString / QString / std::wstring` $\rightarrow$ 在 C++ 包装层统一转成 `std::wstring`，自动映射为 Java 的 `String`；
- `int* / double*` $\rightarrow$ 映射为 Java 的单元素数组 `int[] / double[]`；
- `int`（动态一维数组）或 `char`（字符串列表） $\rightarrow$ 在 C++ 侧包一层轻量的代理类改用 `std::vector<int>&` 或 `std::vector<std::wstring>&`，直接享受 `std_vector.i` 的原生支持。

---

## 四、终极实战：如何在 Java 界面中嵌入一个 C++ (MFC/Qt) 原生窗口？

假设我们在 Windows 上有一个用 C++（内部用了 MFC、Qt 以及 OpenCASCADE 3D 渲染引擎）写好的 DLL，这个 DLL 能创建一个 3D 视图窗口并返回它的 Windows 窗口句柄 `HWND`，同时还提供了一堆操作这个界面的 C++ 函数。现在要求：用 Java 写外层主程序界面，并把这个 C++ 的原生窗口严丝合缝地嵌进 Java 窗口的某个区域里。

从 Windows 操作系统底层看，把一个窗口塞进另一个窗口内部，核心必然是调用 Win32 API 的 `SetParent(HWND hWndChild, HWND hWndNewParent)`。其中子窗口句柄由 C++ DLL 返回，而父窗口句柄必须由 Java 的某个 GUI 组件提供。

听起来很简单，但在实操中必须连跨三道大坎：

### 关键问题 1：选哪个 Java GUI 组件，才能拿到真正的操作系统 `HWND` 句柄？

Java 的 GUI 框架有老牌的 `AWT`、`Swing` 和现代的 `JavaFX`。
- **轻量级组件 vs 重量级组件**：
  用 Visual Studio 自带的 `Spy++` 抓窗口句柄就会发现，`Swing`（如 `JButton`、`JPanel`）和 `JavaFX` 的绝大多数组件都是“轻量级（Lightweight）组件”——也就是说它们全是 Java 自己用画笔在同一个顶层大窗口上画出来的假控件，每个小控件根本没有独立的操作系统 `HWND` 句柄！
- 千万别信 AI 常给的 `JavaFX -> SwingNode -> JPanel -> awt.Canvas` 套娃方案：
  问 AI 怎么在 JavaFX 里拿子区域句柄，AI 最喜欢让你在 JavaFX 里塞一个 `SwingNode`，里面包 `JPanel` 再包 `java.awt.Canvas`，然后调 JNA 的 `Native.getComponentPointer(canvas)` 去拿句柄。
  实测血泪教训：只要最外层直接用了 `SwingNode` 去套 `Canvas`，`Canvas` 的底层绘制就会被 JavaFX 接管，原有的独立句柄直接丢失，程序运行到 `getComponentPointer` 时会当场崩溃暴毙（错误码 `0xC0000409` 栈缓冲区溢出）！而如果你不管三七二十一，直接把 C++ 窗口 `SetParent` 嵌到最外层的 JavaFX 顶层大窗体上，普通模型树控件虽然能点，但 C++ 的 3D 渲染窗口会错位飞到右下角一个莫名其妙的位置，且一旦调 JNA 的 `SetWindowPos` 改尺寸就立刻死机。
- **正解（谁才有真句柄？）**：
  只有由操作系统底层直接提供支持的“重量级（Heavyweight）组件”才拥有自己独立的 `HWND` 句柄！在 Java 里只有两类：① `java.awt.Canvas` 等 AWT 原生组件；② `javax.swing.JFrame / Window` 顶层窗口。必须把 `awt.Canvas` 放在纯正的 `Swing` 窗口容器下，通过 JNA 的 `Native.getComponentPointer(canvas)` 才能稳稳拿到真实的父窗口 `HWND`！

### 关键问题 2：Windows 消息循环冲突（为什么窗口一闪而过或彻底卡死？）

Windows 上任何 GUI 窗口要想能显示、能响应鼠标点击和重绘，底下都必须跑着一个 `GetMessage / DispatchMessage` 消息循环（Message Loop）（比如 Qt 主函数最后的 `app.exec()` 本质就是启动了这个死循环，卡住主函数不让它 return）。

而在我们的场景里，C++ 是被编成了一个 `.dll` 被动等待调用的，它没有自己的 `main` 函数！如果你只写一个 C++ 函数 `ShowMyDialog()` 创建窗口并返回句柄，没有消息循环托底，函数一返回窗口就没了；反过来，如果你在 C++ 函数里自己写死循环启动消息泵，又会把调用它的 Java 线程彻底卡死。

经过大量试错，唯一能同时跑通双端消息循环且不冲突的黄金架构如下：

```text
[程序主入口：必须用 JavaFX 作为整个 Java 程序的启动入口点 (启动 JavaFX Application Thread 主线程)]
  --> 1. 为什么必须用 JavaFX 当入口？
         因为 JavaFX 的主线程底层天然提供了一套与 Windows 原生 Win32 / MFC / Qt 完美兼容的系统级消息循环！
         （如果纯粹用 Swing 当主入口去直接调 C++ 导出窗口，界面会直接卡死无法显示；自己去 C++ 或 Java 侧另起线程跑消息循环，后续跨线程传参和自定义 WM_USER 消息又会和原有 C++ 界面撞车。）
  --> 2. 窗口创建在哪条线程？
         所有由 C++ DLL 提供的窗体类，必须在【JavaFX Application Thread 主线程】上调用初始化和创建！
  --> 3. 嵌到哪里去？
         在 Java 侧另起一个 Swing 窗口界面，里面放好重量级的【java.awt.Canvas】，用 JNA 拿到 Canvas 的 HWND，再通过 SetParent 把刚才创建好的 C++ 窗口嵌进这个 Canvas 里！
```

### 关键问题 3：跨线程操作 UI 的死穴（Qt vs MFC）

当把 C++ 窗口嵌进 Swing 的 `Canvas` 之后，你自然会在 Swing 界面上放几个 `JButton` 按钮，点击按钮时调用 C++ DLL 导出的函数来修改 3D 窗口里的内容。

这时候要注意一个极其隐蔽的线程切换：
- 你最初创建 C++ 窗口是在 JavaFX 主线程（`JavaFX Application Thread`）上；
- 而当你点击 Swing 的 `JButton` 时，按钮的点击回调是跑在 Swing 的事件派发线程（`EDT, Event Dispatch Thread`）上的！
- **实测差异**：
  - 如果你的 C++ DLL 内部是 纯 Qt 写的，从 Swing 的 EDT 线程直接调进去改 UI 居然能抗住不崩；
  - 但如果你的 C++ DLL 内部包含了 MFC（工业 CAD 软件极常见），MFC 对跨线程访问 UI 是零容忍的——只要你在 EDT 线程直接调进去操作 MFC 窗口，哪怕在 C++ 函数开头加上了经典的 `AFX_MANAGE_STATE(AfxGetStaticModuleState());` 切换模块状态，也照样必崩无疑！
- **终极保命守则**：在 Java 侧，凡是任何点击按钮或事件要去调用 C++ DLL 操作 UI 的代码，一律用 `Platform.runLater(() -> { ... })` 包裹起来！强制把所有对 C++ 窗口的调用全部投递回最初创建它的那条 `JavaFX Application Thread` 主线程去执行，从此彻底告别一切跨线程崩溃。
