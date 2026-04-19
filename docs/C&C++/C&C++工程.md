### VS 工程

#### 一般性问题

可以这么说，你在 VS 上，配环境配半天没成，80%是 release 和 debug 搞混的问题

首先看你配的和运行的是不是同一个

然后看库是不是一致的，都是 debug 或者都是 release 最好

再看别的

值得注意的是，你当前菜单栏上的 Debug，并不意味着你打开项目的属性，会自动跳转到 Debug 上，而是停留在上次的界面，这是一个很容易失误的点。

#### 介绍-生成

一个典型的 C++库由两部分组成

lib 和 include

include 里面是一大堆头文件

lib 里面提供了静态和动态库

静态链接，编译后，把库放在 exe 里

glfw.dll 是动态库

glfw3dll.lib 是一个静态库，与 glfw.dll 一起使用（这称之为隐式链接、导入库）

glfw.lib 静态库，静态链接时使用

项目名->属性->c++->general->附加包含目录：指的是 include 的目录

此时，单独一个文件能编译，但链接出问题

项目名->属性->linker ->general 附加库目录：指的是 vs-2019 那个 lib 目录（这块主要是指定 lib，而不是 dll）

你可能在这里引入一个 A.lib 但是它可能只是 dll 的引导库，而实际运行还是需要 A.dll

然后 linker -> 输入 附加依赖项：glfw3.lib

需要一个 dll，和是否需要导入库没关系，有时候需要导入库。

一般你用 C 的标准库，编译器会自动帮你链接到 ucrtbase.dll

动态库两类：

1、静态的 动态库版本 程序早就知道这库里有什么函数（本例）

2、加载这个库，但不知道里面有什么

动态链接：include 同时支持动静

必须同时编译 glfw.dll & glfw3dll.lib，以保证函数指针不错误

只需要修改 linker -> 输入 附加依赖项：glfw3dll.lib

#### 运行

可以“生成”但不可以运行

1、你把 dll 拷贝到 exe 同级目录下

2、在调试里，配置“环境的值”

这里，最后面有没有分号，都可以，但是，PATH=必须写，并且写在开头

```
PATH=%PATH%;D:\OpenCASCADE-7.5.0-vc14-64\opencascade-7.5.0\win64\vc14\bind;D:\OpenCASCADE-7.5.0-vc14-64\tbb_2017.0.100\bin\intel64\vc14
```

这块，不能换行，不能有空格，必须是一行之内，紧挨着写。

```
PATH=%PATH%;D:\OpenCASCADE-7.5.0-vc14-64\opencascade-7.5.0\win64\vc14\bind;D:\OpenCASCADE-7.5.0-vc14-64\tbb_2017.0.100\bin\intel64\vc14;D:\OpenCASCADE-7.5.0-vc14-64\ffmpeg-3.3.4-64\bin;D:\OpenCASCADE-7.5.0-vc14-64\freeimage-3.17.0-vc14-64\bin;D:\OpenCASCADE-7.5.0-vc14-64\freetype-2.5.5-vc14-64\bin;D:\OpenCASCADE-7.5.0-vc14-64\openvr-1.14.15-64\bin\win64;D:\OpenCASCADE-7.5.0-vc14-64\qt5.11.2-vc14-64\bin;D:\OpenCASCADE-7.5.0-vc14-64\tcltk-86-64\bin;D:\OpenCASCADE-7.5.0-vc14-64\vtk-6.1.0-vc14-64\bin;
```

#### 关于建立库

1. 创建 game，点击解决方案（而不是里面的），再建立 engine，实际上在同级文件夹
2. 保证 game，配置常规为应用程序，engine 改为静态库 lib

同样去 game 里，添加 c++依赖项
然后去 game，添加，引用，选择 engine 即可
就不用在 linker 里面选了

动态库建立：
https://learn.microsoft.com/zh-cn/cpp/build/walkthrough-creating-and-using-a-dynamic-link-library-cpp?view=msvc-160

#### 使用其它人的库

如果你使用别人的 release 的库，你有可能在 debug 模式下无法加载这个库，你只能在 release 上跑

release 也能调试

#### 工作目录

在命令行里走到某个路径下，或者在资源管理器上双击，你可能会运行 my.exe ，这就相当于你把”工作目录“，设置为当前文件夹

如果你是在别的文件夹下，通过 `D:\Learn\compiler\a.exe`运行，你的”工作目录“，就在当前的文件夹，而不是 exe 所在的文件夹。

源代码里，所有的相对路径，都是相对工作目录的

而 VS，或把工作目录，自动设置为，你的源代码所在的文件夹，ProjectDir，实际上是 vcxproj 所在的位置。

这也是为什么我之前，写编译的时候，直接在源代码文件夹创建 txt，我的 exe 就能读取到，我没有进行任何设置。而到了考试机上，用 CLion 时，我必须把 txt 挪到和 exe 在同一个文件夹。

因为我的 exe 设置的是相对路径，而 CLion 把工作目录设置在了 exe 所在文件夹，自然无法读取到不在 exe 文件夹的 txt 文件。

根据以上的经验，你在配置 DLL 的时候，也需要将”工作目录“设置为 $(TargetDir) ，这样，你的代码里根据相对位置加载 dll 的代码，才能找到 DLL。

#### GUI 工程

在 VS 里，每个程序启动时，要选择系统

通常你写的无界面程序是 控制台

而 GUI 程序一般改为了窗口，这导致你的输出不知道跑哪去了

解决：

1、引入 windows.h，利用 OutputDebugString 输出。

2、引入 qdebug.h，利用 qDebug 输出

std::cout、printf 为什么不行呢，是因为它是 iostream，这是标准输出输出，定义的点是控制台和键盘

而控制台现在不见了（有方法可以让控制台和窗口同时在，但是这里先不谈了，对于调试来说，没必要）

另：

如果你不能调试你的程序，程序瞬间结束，你要看到你在 release 之前的输出，请打开 视图 -> 输出

把他放在底下

另：

assert 宏，定义于 assert.h 中，当程序以 release 模式运行时，一般会定义 NDEBUG，这会阻止 assert 宏的工作

另：

当你断点停不下来的时候，只能停在附近，尤其是写一个 int a =10; 这种凑数语句，停不下来，你应该检查是不是启 release 了，因为 release 能调试，但是优化的时候给优化没了。

#### 改名

有时候，只是随手建了一个项目，随便命名

后续它逐渐变得重要起来，因此需要改名

1、改 sln 所在文件夹的名字

2、改 sln 的文件名

3、打开 sln，搜索旧的名字，替换为新的

4、给 vcxproj 三个文件改名

5、只需要打开 vcvproj，搜索旧的名字，替换为新的

那里面的 GUID 不用动。

6、如果旧的名字还包括 C 源文件的名字，也需要改

改了之后，还需要更新头文件的内容

1、删除。vs 文件夹，因为旧的数据指向的是旧的（似乎改名也行）

2、删除或移动那些可执行文件

### CMake

https://cliutils.gitlab.io/modern-cmake/

由于在 windows 上，默认是生成 sln 项目

如果你要使用 mingw，要加上-G "MinGW Makefiles"

Cmake 构建文件名严格区分大小写。（linux 文件、文件夹都区分大小写的，即可以同时存在 `A.txt`与`a.txt`，而 Windows 不允许你这样）

必须叫做`CMakeLists.txt`三个大写字母，结尾是复数

基础：

1、单 main.c 与 Cmake 在同文件夹

```bash
cmake .
make
```

2、PROJECT

PROJECT (HELLO C CXX) 工程的名字，支持的语言

这个关键词会额外定义两个变量，指向的是当前的工作目录

`<projectname>_BINARY_DIR`

`<projectname>_SOURCE_DIR`

3、SET

SET(SRC_LIST main.cpp t1.cpp t2.cpp)

定义变量，等价于字符串

4、ADD_EXECUTABLE

`ADD_EXECUTABLE(hello $(SRC_LIST))`

第一个是生成的可执行文件名，第二个是源文件

在 windows 系统下，只需要写`ADD_EXECUTABLE(main $(SRC_LIST))`，即可生成 main.exe

PS: 工程 PROJECT 的名字和可执行文件名字没有关系，不必一致

5、变量使用

大括号包裹（而不是小括号）

${name}

当一个变量中有空格，定义或使用时用引号

SET(SRC_LIST "my main file.c")

6、指令使用

指令就是指那些预定于的命令，比如 ADD_EXECUTABLE，使用时必须要括号包裹

指令名（参数 1 参数 2 ...）

指令名（参数 1; 参数 2 ...） 

指令名不区分大小写，习惯上是大写。不过 CLion 默认提供的是小写的。

里面的参数严格区分大小写，尤其是文件名。

常用命令：

OPTION 条件编译、流程控制

OPTION(`<变量>` "提示信息" ON)

定义一个选项（或者变量），后面是 ON/OFF

通过 configure_file 就可以将这个传递给源文件使用（不清楚）

ADD_LIBRARY 构建库

`ADD_LIBRARY(hello SHARED/STATIC ${MYFILES})`

SHARED 表示为动态 STATIC 为静态

hello 库名，在 win 环境下，会自动构建 libhello.dll 或 libhello.lib

7、内部构建/外部构建

假设只有一个 main.c，同级文件夹下存在 CMakeLists.txt

内部构建：

运行 cmake . 后，同文件夹下出现一大堆（4 个）临时文件

CMakeFiles（文件夹） CMakeCache.txt cmake_install.cmake Makefile

请注意此时你的目标文件、可执行文件还没得到呢

运行 make 命令构建出的可执行文件，也在这个文件夹下，很乱

外部构建：

手工建立 build 文件夹，去这个文件夹下 cmake ..

就相当于把上述所有在原来文件夹下的临时文件移动到 build 里了

在 build 里 make，然后可执行文件直接放在 build 里

创建常见工程：

1、选择一个文件夹，写最外层 CMakeLists.txt，建立 src 与 build

2、最外层文件夹

```Cmake
PROJECT(P)
ADD_SUBDIRECTORY(src bin)
```
ADD_SUBDIRECTORY 用于向当前工程添加存放源文件的子目录如 src，并可以指定中间二进制和目标二进制存放的位置如 bin
2、进入 src 文件，写代码，建立内侧 CMakeLists.txt

```cmake
ADD_EXECUTABLE(main ${FILES})
```

3、进入 build 文件夹，cmake .. ， make

目录具体理解：

安装：
使用 CMake 进行安装操作时，你需要先构建好二进制文件。CMake 的`install`命令用于指定如何安装项目，但实际的安装过程是 Make 的控制下进行的。

make install 将编译好的二进制文件和其他必要的文件复制到指定的安装路径

```cmake
INSTALL(FILES readme.md DESTINATION share/doc/cmake/)
#相对路径，默认位置是 /usr/local/ ，即安装到/usr/local/share/doc/cmake
#这里 share 之前为啥没斜杠？表明是相对路径。如果有斜杠，直接安装到根目录下 share 里了，蠢
#所以不要随便定义 FILES 了
INSTALL(PROGRAMS run.sh DESTINATION bin)
#安装脚本（非可执行文件），同理，bin 为相对位置，相对于/usr/local
INSTALL(DIRECTORY doc/ DESTINATION share/doc/cmake)
#这里，如果你不加斜杠，表示仅仅添加一个目录；加杠表示安装目录中内容
```

cmake ..
cd build 
#不是 cd build/bin 尽管这里也有 makefile
make install （不执行这个，就不会开始安装）

实例：使用库
```cmake
cmake_minimum_required(VERSION 3.0)
project(MyProject)

set(CMAKE_BUILD_TYPE Debug)

add_library(add STATIC add.c)
add_library(minus SHARED minus.c)

add_executable(main main.c)
target_link_libraries(main add minus)
set_target_properties(main PROPERTIES
    INSTALL_RPATH "$ORIGIN/../")
#上面这句话不写也没事
```

（假设五个文件都在最外层与 CMakeLists.txt 同级）

链接库：
注：静态链接库是直接整合到 exe 里，安装后一个。lib 都没有的
1、和 src 同级建立 lib 文件夹，建立 hello.c hello.h CMakeLists.txt

```cmake
SET(LIBHELLO_SRC hello.c)
ADD_LIBRARY(hello SHARED ${LIBHELLO_SRC})
```

2、外部同上一次的
cmake ..
make

3、安装并使用（假设是动态库）

```cmake
INSTALL(FILES hello.h DESTINATION include/hello)
INSTALL(TATGETS hello LIBRARY DESTINATION lib)
#默认安装到/usr/local/ 下
```

cmake ..
make
make install (sudo)

4、使用安装的库
在可执行文件前，添加头文件搜索路径，源文件直接写位置即可

```cmake
INCLUDE_DIRECTORYS(/usr/local/include/hello)

LINK_DIRECTORIES()

TARGET_LINK_LIBRARY(main libhello.so)
#只在环境变量里找。第一个参数是二进制可执行文件名。
#必须在 add_executable 后面
```

（这个是什么意思呢？就是一般来讲，你要是构建动态库，不光是要构建，还要执行安装，使得可执行文件能够找到他）

### Makefile

make 不局限于 C/C++，其他语言，其他非编程相关都可以使用

1、基本格式

```makefile
target : prerequireds
	command
```

target：可以是目标文件名，可以是可执行文件名，也可以是一个 Label 标签，表示一个“操作”
这里，由于 linux 上可执行文件没后缀名，所以，target 很可能是可执行文件的文件名

command：前面必须是一个 Tab 键，是 shell 里的命令

2、规则

make 命令会找到 Makefile 里第一个 target（不指定 target），把这个当作 target。

所以 ALL 要尽量写在前面，如果你需要第一个执行 all。一个目标可以依赖于或调用另一个目标，无论这个被依赖/调用的目标是定义在前面还是后面。make 处理目标的方式是基于它们的依赖关系，而不仅仅是它们在文件中的位置。

如果 target 文件不存在，或者它依赖的 `.o` 文件的修改时间比 target 新，那么就执行后面的 command 来生成 target。

如果依赖的`.o` 不存在，则会寻找哪个 target 生成这个`.o`，然后先跑那个命令。

3、伪目标

伪目标不是文件，不是文件名，只是一个 label

用 PHNOY 作为 label，表示这个目标是一个伪目标

它的作用是：让 make 认为，它后面的那个目标，不是一个文件，即不用找到那个文件，就可以运行这个命令

```makefile
clean : 
	rm -rf dir1
debug :
	echo hello

.PHNOY : clean
```

如果没有伪目标，如果当前文件夹下存在 clean 这么一个文件，那么 make clean 就会什么都不做。而有伪目标后，执行 make clean 就不管当前文件夹下有没有 clean 文件了，只管执行命令。

debug 一般用于测试是否写对了。

所以为什么 make all。因为基本上不会出现“all”这个文件，那么你不管这么运行 make all，都会是执行命令。

进一步，你可以把 all 的依赖写成可执行文件，然后命令什么都不写。可执行文件在做为一个 target，专门写编译它的命令。这样 make 会递归的找到这个命令。

0、注释

makefile 和 Cmake 都是#开头注释
shell 文件。sh 的注释也是#
运行 ./xxx.sh （需要可执行权限）
在 shell 中输入注释：#xxxxxx

1、变量定义

= 号后不写东西，代表空值

定义的时候必须给出初值
使用的时候，需要用 $ 引用，并且变量名需要 () 或{}包裹。而 Cmake 只能是{}

你可以直接使用一个未定义的变量，视作空

2、预定义变量

`$@` 在命令里使用，表示这个命令的 target 的名字
`$<` 这个命令的第一个依赖
`$^` 这个命令的所有依赖

3、赋值运算符

= 允许一个变量多次赋值，后面的覆盖前面

:= 赋值后不在更改，即便是后面重新定义（不管用什么符号定义）

4、累加运算

+= 可以给一个用：=定义的变量赋值
就好比字符串拼接

5、换行符

\

实例：

```makefile
all : main.o
    @echo "find main.o"

target1 : main.c
    gcc -c main.c
```

这个例子就失败了，因为虽然依赖 main.o，但是 target 中没有说明白，make 又没办法知道 gcc 会生成 main.o

实例 2：

```makefile
CC=gcc
DEBUG_FLAG=-g

all : main.c static dynamic
	$(CC) $(DEBUG_FLAG) $< -o a.out -L. -lminus -ladd -Wl,-rpath,'$$ORIGIN'

static : add.c
	$(CC) $(DEBUG_FLAG) -c add.c
	ar -r libadd.a $(^:.c=.o)

dynamic : minus.c
	$(CC) $(DEBUG_FLAG) -c -fpic minus.c
	$(CC) -shared $(^:.c=.o) -o libminus.so

clean : 
	rm -rf *.o *.so *.a *.out

.PHONY : all clean
```

要点 1：在命令行里使用'$ORIGIN'，而文件里使用'$$ORIGIN'，放置被 make 展开，放置被 shell 展开
要点 2：$(^:.c=.o) 表示后缀替换
要点 3：如果要调试进入库里，你构建目标文件的时候必须-g，否则调试的时候进不去
要点 4：如果你想在 make all 的时候先清理，不要把$(MAKE) clean 写入 all 的命令中，这会导致你先构建库，再把它删了
要点 5：make 的 target 区分大小写（在命令行和文件都是），make CLEAN 不等于 make CLEAN

chatgpt 重写的 Makefile
```makefile
CC=gcc
DEBUG_FLAG=-g
STATIC_LIB=libadd.a
DYNAMIC_LIB=libminus.so
OBJECTS=add.o minus.o

all: static dynamic main

main: main.c $(STATIC_LIB) $(DYNAMIC_LIB)
	$(CC) $(DEBUG_FLAG) $< -o a.out -L. -lminus -ladd -Wl,-rpath,'$$ORIGIN'

static: $(STATIC_LIB)

$(STATIC_LIB): add.o
	ar -r $@ $^

dynamic: $(DYNAMIC_LIB)

$(DYNAMIC_LIB): minus.o
	$(CC) -shared $^ -o $@

%.o: %.c
	$(CC) $(DEBUG_FLAG) -c $< -o $@

clean:
	rm -rf $(OBJECTS) $(STATIC_LIB) $(DYNAMIC_LIB) a.out

.PHONY: all static dynamic main clean

```

技巧：把一个目标设计为文件名，之后用$@替代，而不是每个目标都要是伪目标
技巧：all 没有命令，只是给出执行顺序

实例 3：
`rm -rf \*~ \*.o` 一些文件会以~结尾，比如 main.c~，这可能是编辑器产生的临时文件

`%.o: %.c` 这是一个 target，我们只能在 command 处写 rm *.o 但是 target 处不支持`*`，只支持%

常用变量：
CC 表示 C 编译器
LD 链接器
CFLAGS 传递给 gcc 的参数
INCLUDES := -I./ -I../ -I../include/

**已经执行的命令不会被回滚**：Makefile 中，在错误发生之前成功执行的命令的效果将保持不变。例如，如果 Makefile 中的某个规则创建了文件或修改了文件，并且在后续的某个步骤中发生了错误，那么这些文件的创建或修改将不会自动撤销。

### GCC

编译过程：四个阶段

hello.c
预处理器 cpp：比如直接把 include 插入到文件中
hello.i
编译器 ccl
hello.s
汇编器 as：将上面文本的汇编转成二进制
hello.o printf.o
链接器 ld
hello.out

GCC 严格的区分选项的大小写-o 与-O 完全两码事

按照步骤，一步步编译的例子：
1、源文件 -> 预处理文件

```bash
gcc -E main.c
gcc -E main.c -o helloworld.i
```
-E 表示执行预处理，但是默认不输出文件，只输出到标准输出
-o 表示写入目标文件。此命令不管什么时候都能使用，只不过后面参数的文件名的后缀需要自己考虑。与是否生成目标文件没关系。
2、源文件 -> 汇编文件
```bash
gcc -S main.c
gcc -S main.c -o xxxxx.s
```
前者默认生成文件，文件与源文件同名
3、源文件 -> 目标文件
```bash
gcc -c main.c
gcc -c main.c -o xxx.o
```
默认生成与源代码同名文件
编译多个文件：
```bash
gcc -c main.c fff.x aaa.c bbb.c
```
4、单个源文件 -> 可执行文件
```bash
gcc main.c
```
默认是输出 a.out 。不需要其他 flag。

创建静态库文件：

假设在 add.c 中实现了一个 add 函数。在 main.c 中，先声明这个函数，然后就直接使用这个函数

1、将 add.c 编译为目标文件

```bash
gcc -c add.c minus.c
```

2、编译为静态库

```bash
ar -r libadd.a add.o minus.o
```

一般来说，一个静态库命名为 lib[真正库名].a 

3、链接 并生成 可执行文件

```bash
gcc main.c libadd.a -o main.out
```

创建动态库：

1、编译为目标文件（同上，先导出目标，但是有-fpic）

```bash
gcc -c -fpic xxx.c yyy.c
```

2、编译为库

```bash
gcc -shared xxx.o yyy.o -o libadd.so
```

3、链接到动态库

```bash
gcc main.c -o main.out -loperation -L/c/buaa/learn/src
```

-l 指定库的名字 选项名与库名之间不允许存在空格（小写 library 的首字母）

-L 指定库路径 不允许存在空格

练习：

创建 add.a 与 minus.so

建立 add.h 和 minus.h

在 main 里引入并最后成功链接

要点：

（1）-l 后面，不需要写 lib，当你的库叫做 libadd.a 时，你只需要写-ladd

而且-l 后面也不需要指定是动态还是静态。如果都有，优先动态。

使用-static 尝试仅使用静态

（2）-L. 表示把当前路径纳入到库搜索范围。不然编译器只会在一些基本路径如/usr/bin/ld 下寻找

（3）这个时候你去执行，会发现，无法找到。so。即便是你把。so 和。out 放在一起。

因为 linux 不同于 windows，它不会在当前目录下寻找动态链接

要解决这个问题，可以尝试（仅本 shell 有效）

```shell
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:.
```

或者将这个命令添加到脚本里，用脚本执行可执行文件

或者将动态链接库的位置写入可执行文件中
```shell
gcc -o myapp myapp.c -L. -lminus -Wl,-rpath,'$ORIGIN'
```

`-Wl,<options>` 表示这个选项 gcc 不理解，将传递给 ld 连接器
`-rpath,'$ORIGIN'` 是连接器选项，告诉链接器将可执行文件所在的目录添加到运行时的搜索路径中。请注意，单引号是必须的，以防止 shell 展开 `$ORIGIN`。这个路径被编码在可执行文件中，并在运行时由动态链接器（如 `ld-linux.so`）使用来查找所需的动态库。

例子：-Wl,-Bdynamic -lomcgc
这个里，只有 -Bdynamic 是传递给 ld 的 options，-l 是 gcc 本来就有的，不过-l 的本质也是传给 ld

妈的：给我注意。那个-rpath 前面有一个杠，别给忘了。debug 半天，以为是别的问题。

这个例子里，你把 a.out 挪走，不行，把 a.out 和 minus.so 同时移走，可以在别的位置运行

其他选项

-g 调试模式

-O 优化级别：0 无优化 1 基本 2 进一步 3 狠狠，但是可能会增大大小？ -Os=O2 且减小代码大小

-D 宏定义 
相当于源代码中使用`#define`预处理指令。`gcc -DMY_MACRO=1 ...` 会导致编译器在编译过程中定义宏`MY_MACRO`并将其值设为`1`

-I include 首字母大写：添加额外的头文件搜索路径
`gcc -I/my/custom/path ...` 会让编译器在`/my/custom/path`目录下也搜索头文件

值得注意的是编译器只会在当前文件夹下搜索，而不会自动找其子文件夹（在当前文件夹下的文件又通过代码 include 到子文件夹不算），所以你会看见

`$(QTDIR)\include $(QTDIR)\include\QtWidgets`

补充知识：
ELF(Executable and Linking Format) 这种文件同时兼具可执行、可连接的作用
.out .so 都是 ELF，这也是你为什么可以运行/lib64/ld-linux-x86-64.so.2

ldd a.out
查看依赖那些动态链接库

不运行就查看是否存在符号表：
windows 系统，采用：x64 Native Tools Command Prompt for VS 2019
dumpbin /SYMBOLS "完整路径、xxx.exe"

linux 系统，objdump --syms your_executable | less

我没有使用以下语句就导出了函数，是为什么？好像是说可能是编译器默认行为。

```
#if defined _WIN32 || defined __CYGWIN__
    /* Note: both gcc & MSVC on Windows support this syntax. */
#define FMI2_Export __declspec(dllexport)
#else
#if __GNUC__ >= 4
#define FMI2_Export __attribute__ ((visibility ("default")))
#else
#define FMI2_Export
#endif
```

### GDB

一般来说，在 vscode 里可以用远程调试，不需要在命令行里敲命令

编译时记得带 -g

进入程序
```shell
gdb ./main
```

运行：键入 run 或 r （无断点就直接跑完了）
退出：quit 或 q
man gdb 查看常见命令
打断点：break / b
`break <function-name> break main`
`b 10`

断点设置位置：任何实际的可执行语句。不能是注释、预处理器指令或空白行

查看断点：info b
查看源代码：list （一次看不完就再 list，或者回车，回车直接执行上一次的命令）

执行下一步：n （逐过程）
注：按下 n 后，得到的标准输出是即将运行的，但还没有执行

查看变量值：
p arr[0]
p &arr[0]

进入执行（逐语句）：step s

跳出函数：finish

运行 shell 命令：shell ls 通过前面加 shell

日志：set logging on 在 gdb.txt 里记录 gdb 的输出

观察点：watchpoint 查看是否一个变量变化，如果变了，就停下
```
print &i
watch *0x7fffffffde2c
info watchpoint
```

调试一个会崩溃的程序：Segmentation fault (core dumped)
gdb ./a.out core.19766

调试在运行的程序：
写一个死循环，然后。/a.out & 后台执行，返回进程号
gdb -p

补充：
（1）clang 的参数和 gcc 类似，并且采用 clang 编译，也可以拿 gdb 调试
（2）GDB 中看到的可能是经过预处理后的代码，而不是原始的源代码？这个我拿自己的代码写一些条件编译，但是 gdb 还是看得到的。但是 chatgpt 说是有这种情况。
