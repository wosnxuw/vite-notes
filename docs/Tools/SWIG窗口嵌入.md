### 如何在 Java 界面中嵌入一个非 Java 提供的 GUI 窗口？

- 本文仅限于 Windows 操作系统，其它操作系统可以作参考

- 本文假设非 Java 提供的窗口，由一个 DLL 提供，DLL 由 C/`C++`写成，返回窗口的句柄
- DLL 还提供其它函数，用于操作 DLL 的界面

阅读本文需要以下知识：

C/`C++`、Java 基本语法，WindowsAPI，编译与链接，MFC 和 Qt 知识（构建一个界面），基本的 GUI 编程知识

首先，我们是要在 Java 界面里嵌入一个 `C++`窗口

从系统角度考虑，必然是调用到 WIN API 的 SetParent 函数

而 SetParent 函数要求父窗口和子窗口的句柄，父窗口由 Java 的某个窗口提供，而子窗口由 DLL 中导出函数的返回值提供

介绍三个会用到的工具

**1、JNA**

`JNA Java Native Access` 这是一个 Jar 包，提供了一些让 Java 访问 DLL 中的函数的方法

`JNA-Platform` 是上述包的扩展包，提供了针对操作系统的类型封装，比如 HWND 句柄，在 JNA-Platform 中被封装为一个类，类的内部通过一个 long 来存储句柄

JNA 一般是针对 C 接口的，需要 DLL 导出传统 C 接口才行。

**2、JNI**

`JNI Java Native Interface` 是 Java 标准提供的，用于访问本地代码的一种方式。在安装了 JDK 以后，会在 JDK 目录下，发现一个叫做 include 的文件夹，还有一个叫做 win32 的子文件夹（对于 windows 系统）。include 中包含了 `<jni.h>` 这个头文件。

这也就是说，JNI 的用法，并不是去写 Java 代码，而是转而去写 C/`C++`代码。具体来说，是将 Java 的函数用 native 关键字声明，并在 Java 运行时加载某个 DLL，DLL 中符合 JNI 规范的代码，就能被 Java 调用。JNI 提供了很强的灵活性，但是用法复杂，短时间无法掌握。

**3、SWIG**

其实，这里有一个刚才忽略的问题。那就是 HWND 是 C 函数的返回值，如何传递给 Java 呢？HWND 是 void* 在 Java 里没有相对的定义。 如果说 HWND，可以强制转化为 long long，那么如果 C 接口的类型是 int* 呢？Java 里是没有指针的。

这里，也就引出了嵌入的第一个关键问题，做类型映射。要把 C 接口的类型，映射到 Java 中。JNA 不支持指针类型，JNI 能够解决，但是过于复杂。

因此，SWIG 登场了。SWIG 是一个独立的 exe，它可以为 C/`C++`接口生成目标语言的接口。目标语言不只是 Java，还有 Python 等等。

SWIG 本质是一个编译器，输入是 SWIG 专用的 .i 文件，输出为对应目标语言的接口代码（如果目标语言有需要，也会生成 C/`C++`代码）针对 Java 而言，由于 JNI 的要求，SWIG 会再生成一些 C 接口代码，通过`#include <jni.h>` 可以通过编译。`<jni.h>` 是一个 header only 的头文库，不需要添加其它静态或动态链接库。

.i 文件的写法和 Bison、Yacc 类似，比直接手写 JNI 要方便的多。在 Android 的开发文档中，也建议过开发人员使用自动化工具生成 JNI 接口。

SWIG 可以做到的事情很多，包括支持 std::string 作为参数，指针做参数，自定义类型，封装 `C++`类，实现虚类回调等等。

**关键问题 1：** 如何封装 参数是 int* 的 `C++`函数，甚至封装一个 `C++`类

**关键问题 2：** 选什么 Java GUI 组件，才能拿到句柄

下一步是，如何在 Java 中拿到 HWND。`C++`代码中很容易就能拿到 HWND，就不再赘述了。

Java 的 GUI 框架，有 awt，Swing 和 FX 等等。 

而根据我的调查，Swing 和 Fx 大多属于是"轻量级"组件，即一个按钮没有自己的句柄，而是借用其所在顶级窗口的句柄。

通过 Spy++可以发现，Swing 的按钮无论添加多少个，句柄都不会变多。

AI 们似乎总是喜欢给出这样的一个例子，那就是，外壳是 JavaFx 的 App，内部使用一个 SwingNode，SwingNode 包装一个 JPanel（JPanel 是 JComponent 子类），内部包一个 Canvas，由 Canvas 提供句柄

但是我这里实测下来，只要最外壳的窗体是 Fx 的，那么就无法 get 到这个 Canvas 的句柄，会直接死在 getComponentPointer->0xC0000409

如果你说你不管了，直接把原生窗口嵌入到最外面的 Fx 窗体里，那么也能嵌入进去

模型树被嵌入后，位置是正常的，并且可以点击

但是 3d 窗口位置在右下角的一个很怪的位置上（也可以点击），并且用 JNA 的 SetWindowPos，也是直接死机

而根据 StackOverflow 的某个帖子，我们需要那“重量级”组件，也就是由操作系统提供支持的组件。这个组件由两种。一个是大部分 awt 的组件，另一个是 Swing 中继承 Window 类的组件。具体建议是从 awt.Canvas 以及 swing.JFrame 拿句柄。

当然，Java 并不会给我们拿句柄，我们需要借助 JNA 包里的 getComponentPointer 函数。

**关键问题 3：如何让嵌入的窗口正常运行**

接下来，就是让两侧的窗体正常显示。

你可以尝试这样做：

（1）写一个 MFC 或者 Qt 的 DLL，导出一个普通 C 接口，在其中创建一个对话框，返回句柄；再导出一个修改内容的函数

（2）写 SWIG 的接口文件，这函数包装好，并导出 Java 接口（提示：在 Visual Studio 中利用生成前后事件）

（3）在 Java 侧写一个 Swing 的例子，并用 JNA-Platform 提供的 SetParent 放进来

这里有一个问题。Windows 上 GUI 的显示要依靠有消息处理。

即 GetMessage 那个循环，其它框架只不过是封装了起来。 以 Qt 为例，App 在主函数里 exec()，启动了消息循环。因此也卡住了主函数，使得主函数不会直接 return，界面会一直存在，而是在你点了 X 以后才 return。

而导出的 DLL 里，我们只是在一个函数里 show 出一个对话框，并没有启动任何消息循环。如果你不卡住它，那么函数直接返回，窗体就丢失。

因此你需要能够在其它被导出的函数外面，启动消息循环，卡住你的 `C++`函数，并且**不能与原有 Java 消息循环产生冲突**

根据我的大量尝试，这里先说结论：

一定要 JavaFX 作 Java 的入口点，做最外层提供消息循环，任何由 `C++`提供的窗体类，都要创建在主线程 JavaFX Application Thread 上，做嵌入时，通过另起一个 Swing 界面，把界面嵌入到 Swing 下辖的 awt.Canvas 中。

原因有以下几点

1、FX 的主函数提供了类似 MFC 或者 Qt 的消息循环，可以直接支持 `C++`窗体。而 Swing 不支持，在 Swing 上直接调用导出的函数，会导致界面卡住无法显示出来。唯一的解决途径是自行提供消息循环，有两个办法（1）是在 `C++`侧另起一个线程，通过新线程启动消息循环，并展示界面。但是后续调用其它函数，如果要传递参数，只能通过给线程发送自定义消息+封装的结构体/全局变量来传参，非常麻烦，并且自定义的 USER+1 会与你原有的 `C++`界面产生冲突。（2）把消息循环放置在 Java 侧，无非是把复杂性从 `C++`转移到 Java，这样不需要发送自定义消息，不过传参依然麻烦

2、之所以不使用 FX 的 SwingNode，似乎是因为 Canvas 嵌入 Node 以后被接管，句柄丢失

3、如果你的 DLL 是纯 Qt 的，那么似乎不会遇到跨线程修改 UI 的问题。即，你从 JavaFX Application Thread 创建 Qt 窗体，但是把窗体显示在了 Canvas 上面，为了方便展示，你又创建了一些 Canvas 的 JButton 来调用修改 UI 的函数，在 EDT 上修改，Qt 似乎支持这个。**如果你的 DLL 包含 MFC，那么无法从多线程访问 UI**，即使你使用 AFX_MANAGE_STATE(AfxGetStaticModuleState()); 来切换，依然不行。

所以建议是，所有对 `C++`侧 UI 的操作，都放在 `Platform.runLater()` 内部，保证不会遇到跨线程问题。

**其它：**

SWIG 能做到的事情很多，如果你导出的 `C+ +` 类过于复杂，比如多继承或者包含很多难以处理的方法，你可以考虑再包一层类，这个类就是独立的，持有老类指针，代为访问即可。   

以下代码是`wstring* <--> String[]` 的映射（来源：https://stackoverflow.com/questions/3753495/swig-how-to-wrap-stdstring-stdstring-passed-by-reference），您只需要补充这一个映射，其它的 String Vector int* double** ，都不需要写 typemap，利用 SWIG 下的 lib 文件夹提供的库即可支持。

```
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

```

也就是说

int double 

char*（包括各种 C 语言字符串 BSTR std::wstring QString CString 等等，都可以经过转换，转换到 std::wstring 中，再映射到 java 的 String 里）

int* double* 可以用数组来代为访问（数组是可行的办法之一，用指针代理类也行，不过感觉 Java 用指针比较怪）

int** 可以用 `std::vector<int>&` 来解决， vector.i 这个类，提供了`vector vector& vector* `的解决方案

char** 可以用 `std::wstring&` 或者是 `vector<wstring>` 来解决