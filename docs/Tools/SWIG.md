基本的 C / C++包装之旅

默认情况下，SWIG 尝试为 C/ c++代码构建一个自然的 Java 接口。函数被包装为函数，类被包装为类，变量被包装为 JavaBean 类型 getter 和 setter 等等。

1、模块名

```
%module YourModuleName
```

%module 指令指定 Java 模块的名称，也就是生成

（1）

YourModuleName.java

这个文件，相当于你的 DLL，DLL 里独立的函数，会直接导出到这个 Java 类里，作为静态方法。如果你全是类，没有函数，那么这里就不会有东西

YourModuleNameJNI.java

这个是自动生成的类，用作所有其它 java 的底层接口

（2）

"代理类" 

这是为 C++ 生成的 Java 文件，文件和 C++ 的类同名

任何由 SIWG 生成的 Java 文件，都不要自己修改

有时，C/C++ 类型不能由代理类包装，例如指向基本类型的指针。在这些情况下，会生成一个类型包装器类。包装枚举会生成一个*枚举类*，它可以是一个适当的 Java 枚举，也可以是一个模拟枚举模式的 Java 类。

2、函数

DLL 里独立的函数，会直接导出到这个 Java 类里，作为静态方法

3、全局变量

Java 不允许覆盖点操作符，因此所有变量都可以通过 getter 和 setter 来访问。同样，因为没有 Java 全局变量这样的东西，对 C/C++ 全局变量的访问是通过模块类中的静态 getter 和 setter 函数来完成的

getter 返回的值将始终是最新的，即使该值在 c 中发生了更改。注意，生成的 getter 和 setter 遵循 JavaBean 属性设计模式。即变量名的第一个字母大写，前面加上 set 或 get。如果您不幸包装了两个变量，而它们的首字母大小写不同，请使用%rename 来更改其中一个变量名。否则只会生成一个。

YourModuleName.get{C++全局变量变量名}();

4、常量

用#define 指令定义的变量，即使没有现场声明类型，C++编译器也会给一个类型

这个类型会被变成 JNI，并且用 final 修饰

```
%javaconst(1);
```

5、枚举

处理命名和未命名（匿名）枚举

有四种方法

第一种是基于所谓的 Java 类型安全枚举模式的默认方法。

第二个生成适当的 Java 枚举。

最后两种方法对每个枚举项使用简单的整数。

在查看包装命名 C/ c++枚举的各种方法之前，先考虑匿名枚举。

（1）类型安全的

是构造了一个和枚举同名的类，类里面用静态变量类对象

（2）

Java 枚举，如果你的 Java 版本支持，C++枚举直接变成 Java 枚举

6、指针

SWIG 完全支持 C/C++ 指针。此外，SWIG 处理不完整的类型信息没有问题

Java 每个对每个 C++指针类型都会生成一个包装类型，以便于类型检查

尽管您可能倾向于直接从 Java 修改指针值，但不要这样做。该值不一定与底层对象的逻辑内存地址相同。

根据设计，也不可能通过使用 Java 强制转换来手动将指针强制转换为新类型，因为这特别危险，特别是在强制转换 c++ 对象时。如果需要强制转换指针或更改其值，请考虑编写一些辅助函数。

如果使用 c++，您应该始终尝试使用新的 c++ 样式强制转换。例如，在上面的代码中，C 风格的强制转换可能返回一个伪结果

此外，SWIG 通常不会将指针映射到诸如关联数组或列表之类的高级对象。与指针相关的底层语义不为 SWIG 所知。例如，`int *`可能根本不是数组——也许它是一个输出值。

类型检查过程是 SWIG 的一个组成部分，如果不使用类型映射（在后面的章节中描述），就不能禁用或修改它

SWIG 除了基本类型都是指针

与 C/C++ 不同，SWIG 实际上并不关心 Matrix 之前是否在接口文件中定义过（使用 Matrix *时）

7、结构体

结构体生成一个 Java 类，带有成员变量和 get set 函数（其实结构体和类差不多）

当结构体的 `char *` 成员被包装时，假定内容是使用 malloc 或 new 动态分配的（取决于是否使用-c++选项运行 SWIG）。当设置结构成员时，旧的内容将被释放并创建一个新值。如果这不是您想要的行为，则必须使用 typemap（稍后会介绍）。

**编写**

SWIG .i 文件编写指南

```
/* File : example.i */
%module example

%{
extern void add(int *, int *, int *);
extern void sub(int *, int *, int *);
extern int divide(int, int, int *);
%}

/* This example illustrates a couple of different techniques
   for manipulating C pointers */

/* First we'll use the pointer library */
extern void add(int *x, int *y, int *result);
%include cpointer.i
%pointer_functions(int, intp);

/* Next we'll use some typemaps */

%include typemaps.i
extern void sub(int *INPUT, int *INPUT, int *OUTPUT);

/* Next we'll use typemaps and the %apply directive */

%apply int *OUTPUT { int *r };
extern int divide(int n, int d, int *r);
```

example.i 这个文件本身，文件名和后缀可以随意修改，不起任何作用（有时是 swg，注意别变成 VC 的项目）

（1）

%module YourModuleName 模块名

（2）

%{}% 这里是包装代码，你可以认为这里写的东西是符合 C++语法的

这里的内容会复制到 warp.cxx 里面，帮助通过编译

只在这里声明函数是不行的，因为 SWIG 不会分析这里的内容，只是复制过去，类似 YACC 或者 BISON

SWIG 不需要修改您的 C 代码，但是如果您向它提供一组原始的 C 头文件或源代码，那么结果可能不是您所期望的——实际上，结果可能很糟糕

（3）

%{}% 的下面是 swig 配置指令，以%开头，或者是 C++语句

比如

%typemap

在某些情况下，SWIG 可以直接用于原始头文件或源文件。然而，这并不是最典型的情况

最后面，是%includ 指令，让 swig 解析有哪些类

**类型映射**

可以被自动处理的 C++类型是

int
short
long
unsigned
signed
unsigned short
unsigned long
unsigned char
signed char
bool

float
double

在处理大整数值时需要小心。大多数脚本语言使用 32 位整数，因此映射 64 位长整数可能导致截断错误。32 位无符号整数（可能显示为大的负数）也可能出现类似的问题。根据经验，使用 int 数据类型以及所有 char 和 short 数据类型的变体都是安全的。

对于 unsigned int 和 long 数据类型，在用 SWIG 包装程序之后，需要仔细检查程序的正确操作。

char* wchar_t

**%include <windows.i>** 用于处理 **__declspec(dllimport)**, DWORD LONG_PTR 等微软专用的定义，也就是 windows.h 中的定义

但是不包括 HWND

不过 SIWG 似乎建议你之间把 MYDLL_API 定义为空串

SWIG 能够解析 include

但但是，除非提供了-includeall 命令行选项，否则#include 语句将被忽略（#define 正常），否则它可能会为系统头文件生成一大堆内容

！！SWIG 不支持 extern 声明变量

下面是为 C 程序创建接口的一系列步骤：

1、确定要包装的函数。可能没有必要访问 C 程序的每个函数——因此，稍微预先考虑一下就可以极大地简化生成的脚本语言接口。

2、C 头文件是查找要包装的内容的特别好的来源。创建一个新的接口文件来描述程序的脚本语言接口。将适当的声明复制到接口文件中，或者使用 SWIG 的 `%include` 指令来处理整个 C 源文件/头文件。确保接口文件中的所有内容都使用 ISO C/C++ 语法。确保所有必要的`typedef`声明和类型信息在接口文件中可用。特别是，要确保类型信息按照 C/C++ 编译器要求的正确顺序指定。最重要的是，在使用类型之前定义它！如果需要，C 编译器会告诉您完整的类型信息是否可用，而 SWIG 通常不会发出警告或出错，因为它被设计为在没有完整类型信息的情况下工作。但是，如果没有正确指定类型信息，包装器可能不是最优的，甚至会导致不可编译的 C/C++ 代码。

有时，为了使 SWIG 生成的代码能够正确编译，有必要使用某些头文件。通过使用像这样的%{%}块来确保包含某些头文件

第一个类型映射（“in”类型映射）用于将值从目标语言转换为 c 语言。第二个类型映射（“out”类型映射）用于进行相反方向的转换。每个 typemap 的内容是一小段代码，直接插入到 SWIG 生成的包装器函数中。代码通常是 C/C++ 代码，这些代码将生成到 C/C++ 包装器函数中。

### INPUT 和 OUTPUT

先说** OUTPUT **吧

用法有两种

1、在接口文件中，把这个参数的名字，起名为 OUTPUT

因为在接口文件里，实际上只有类型是重要的，名字无所谓，如果是 OUTPUT，则会被认为是关键字

```
void add(int x, int y, int* OUTPUT, int* OUTPUT);
```

在 Java 那边，可能是`add(int x, int y, int[] OUTPUT, int[] arg3)` 只有第一个叫 OUTPUT

2、利用%apply，不必改变名字

```
%apply int *OUTPUT { int *result };
%apply int *INPUT  { int *x, int *y};
```

 被 OUTPUT 修饰后，Java 那边，就只能用数组来接这个返回值了

注意事项：

虽然是用数组来接，但是 OUTPUT 只是声明，int* 是用于修改一个 int，而不是访问或者修改一个数组

所以，即使在 C++侧修改数组，也改不了 Java 的数组，你只能改数组的首个元素。如果你不改这个元素，那么这个元素会自动变成 0，发生意想不到的变化。

**INPUT **的行为有点类似 const 指针，只是为了访问某个值。所以感觉作用不是特别大。

**INOUT**

在 Java 中，输入参数是 1 元素数组中的第一个元素，并被函数的输出所替换

注意：

typemaps.i 只支持基本类型，其它任何指针都不被支持

### 包装 Java 数组

```
%include "arrays_java.i";
```

有了这个库，你在 C++中定义的函数，如果是数组，则不会被默认为指针

`void populate(int x[]);`  而是对应生成一个 Java 的数组参数函数

你要做的就是 在 Java 中创建数组，传到函数里，然后 C++那边当作数组访问并修改。Java 数组长度不够，C++会越界。

但是这个实际上是靠复制数组做到的，底层效率有点小问题吧

还有一种办法是

```
%include "carrays.i"
%array_functions(int, intArray);
%array_class(int, intArray);
```

通过偏移量和数组代理类来访问

但是，这个东西，也只能事先确定数组的大小

这个效率高，但是不做任何安全检查，比如偏移量为负也行啥的

### 我的 JNI 配置

```cpp
%begin %{
// 这里，如果你用预编译头，那么你需要把预编译头放在生成的文件开头
#include "pch.h"
%}

%module(directors="1") PQKit

%{
// 这里，为了你的生成文件能编过，而引入头文件
#include "JRoCallback.h"
#include "JRoPlatform.h"
%}

/* 包含对 std 字符串的支持 */
%include "std_string.i"
%include "std_wstring.i"

/* 传统数组，实际上没用到，但是写在这里以免未来需要 */
%include "arrays_java.i";

/* vector 支持&和*操作符 */
%include "std_vector.i"
namespace std {
  %template(IntVector) vector<int>;
  %template(DoubleVector) vector<double>;
  %template(StrVector) vector<wstring>;
}

/* 包含对 wstring* wstring& 的支持 */
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

/* 忽略 JRoPlatform 的成员变量 */

%ignore JRoPlatform::m_ptrPQPlatformComponent;
%ignore JRoPlatform::m_CMidCallback;
%ignore JRoPlatform::setJCallback;

%feature("director") JRoCallback;

/* begin 用于做绑定，正确显示参数名 ***********************/
/* 建议写下每个函数的定义，否则最后很难查找 */
/* 这里写对的标志是：产生的 Java 文件没有 SWIGTYPE_p_int 类型 */

/* IPQPlatformComponentCallBack 接口上的函数 */

// JRoCallback::Fire_Menu_Pop
%apply int* INOUT { int* o_nHandled };
// JRoCallback::Fire_Element_Selection
%apply double* INOUT { double* i_dPointXYZ };

/*
    如果某些 int *需要特殊处理，请在全局%apply 语句之前单独声明它们
*/
// GLOBAL DECL
%apply int* INOUT { int* };
%apply long* INOUT { int* };
%apply bool* INOUT { bool* };
%apply float *INOUT { float* };
%apply double* INOUT { double* };
%apply long long* INOUT { long long* };
%apply std::wstring* INOUT { std::wstring* };

/* end 用于做绑定，正确显示参数名 *************************/

/* 这里是真正产生接口的 include，用% */

%include "JRoCallback.h"
%include "JRoPlatform.h"
%include "PQKitDef.h"

/* 特殊函数，为解决结构体指针问题**********************************************/
/*
写在 %include 前面似乎有 bug
*/

```