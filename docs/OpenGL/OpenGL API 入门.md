因为 opengl 是一个标准，各个显卡厂商的实现基于硬件，不一致
所以如果想使用现代的 opengl，需要从显卡驱动里找到那些最新的函数
因此需要 glew 或者 glad 等库帮你找（他们无非是帮你调 win32api 找一下）
虽然系统头文件里也有 gl.h，但是这个太古董了，不够现代，函数不全

按照我的理解。计算机最开始是冯诺依曼模型，只包含 cpu 内存硬盘。但是缺乏人机交互能力，因此引入了输出输出设备，比如鼠标和键盘。这些设备由 cpu 直接控制，cpu 通过轮询等机制获取鼠鼠的输入。但是因为鼠鼠硬件状态不一致，因此需要驱动程序。（大部分鼠鼠都符合默认标准，系统也提供了默认驱动，所以插上去能直接用）再后来，显卡出现了，显卡是更复杂的设备，具备了与 cpu 协作的能力。显卡可以理解为一个不同架构的 cpu，比如 x46，x68 这样子。它上面也执行代码，这些代码也需要像 C 那样写出来，然后编译。那么这个代码是什么呢，我的理解是 glsl 或者 hlsl，然后各个显卡厂商，会实现自己的编译器（就好比 intel 会实现编译器，但是因为显卡生态的原因，开源的不多），这个编译器就存在于显卡驱动里

DirectX 通过驱动程序（如显示驱动的用户模式部分）与硬件通信。它定义了一套标准的接口，硬件厂商需要实现这些接口（即编写驱动程序）来支持 DirectX。所以 DirectX 并不直接封装 OpenGL。它们都是**与显卡硬件通信的“并列”的 API**。
 
opengl 是一个状态机
你需要做的是设置一系列状态
你应该在 GPU VRAM 内设置顶点缓冲区，设置 Shader，它去绘制三角形
而不是告诉 opengl，给我画一个三角形，我给你一些参数
因为它知道自己需要画三角形

文档 https://docs.gl

（其实从这里看，glsl 的函数不超过 100 个。按照 ai 说法，核心大概 100 个，每个厂家有自己的扩展）

绘制的流程大概是：（你把 gpu 当作 cpu 来看待）

我们把数据送到 GPU 的缓冲区中（GPU 内存）

然后 shader 着色器指明了每个点应该如何绘制

并且 shader 必须知道缓冲区内的内存布局，否则它不知道缓冲区里数据是怎么摆放的

（比如有没有法向、纹理等等）

布局的定义在 CPU 中，使用 C++定义

Vertex 顶点：顶点的属性之一是坐标，除此之外，还有颜色，纹理，法向

有时候我们即使不写着色器，三角形也出现了

这是因为 gpu 提供了默认的着色器

顶点着色器和片段着色器（也称之为像素着色器）

数据送给 gpu->顶点->片段->显示（这是最简化的流程）

我们送给 gpu 的每个顶点，都要走一次**顶点着色器**，决定一个顶点显示在哪

**片段着色器**会为显示器的每个像素调用一次，决定该像素的颜色

```cpp

#define GLEW_STATIC
#include <GL/glew.h>

#include <GLFW/glfw3.h>

#include <string>
#include <iostream>

static unsigned int CompileShader(const std::string& source, unsigned int type)
{
    unsigned int id = glCreateShader(type);
    const char* src = source.c_str();
    glShaderSource(id, 1, &src, nullptr);
    glCompileShader(id);
    int result;
    glGetShaderiv(id, GL_COMPILE_STATUS, &result);
    if (result == GL_FALSE)
    {
        int length;
        glGetShaderiv(id, GL_INFO_LOG_LENGTH, &length);
        char* message = new char[length];
        glGetShaderInfoLog(id, length, &length, message);
        std::cout << "Fail"  << ((type == GL_VERTEX_SHADER) ? "vertex" : "fragment" )<< std::endl;
        std::cout << message << std::endl;
        glDeleteShader(id);
        return 0;
    }

    return id;
}

static unsigned int CreateShader(const std::string& vertexShader, const std::string& fragmentShader)
{
    unsigned int program = glCreateProgram();
    unsigned int vs = CompileShader(vertexShader, GL_VERTEX_SHADER);
    unsigned int fs = CompileShader(fragmentShader, GL_FRAGMENT_SHADER);

    glAttachShader(program, vs); // shader 也是需要链接
    glAttachShader(program, fs);

    glLinkProgram(program);
    glValidateProgram(program);

    glDeleteShader(vs);
    glDeleteShader(fs);

    return program;
}

int main(void)
{
    GLFWwindow* window;

    /* Initialize the library */
    if (!glfwInit())
        return -1;

    /* Create a windowed mode window and its OpenGL context */
    window = glfwCreateWindow(640, 480, "Hello World", NULL, NULL);
    if (!window)
    {
        glfwTerminate();
        return -1;
    }

    /* Make the window's context current */
    glfwMakeContextCurrent(window);
    if (glewInit() != GLEW_OK)
    {
        return -1;
    }

	// 这是我们在 cpu 中的缓冲区
    float position[6] = {
        -0.5, -0.5,0, 0.5,0.5, -0.5
    };

    unsigned int buffer;
    glGenBuffers(1, &buffer);
    glBindBuffer(GL_ARRAY_BUFFER, buffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(position), position, GL_STATIC_DRAW);
    // 通过以上函数，我们构造了一个在 gpu 中的缓冲区，但是此时，gpu 不知道这个缓冲区里的内容如何解释
    
    glEnableVertexAttribArray(0);
    // 为缓冲区指明内容如何解释
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * 4, 0);
    /*
    第一个参数是你自己指定的顶点的属性的索引，什么意思，就是之后你可以在 glsl 里，利用这个整数索引，拿到这块数据
    第二个是这个属性值的数量，我这里是位置，所以是 2
    第三个是类型
    第四个是是否要单位化（对于颜色）
    第五个是，每个顶点的所有属性占多少字节。因为复杂的时候，顶点不止有位置，还有颜色，那么它第一个顶点取完颜色，需要跳跃到第二个顶点取颜色
    第六个是，当前这个属性，对于顶点开头的字节偏移量。因为我这里就一个位置，所以不会偏移
    */
    
    std::string vertexShader =
        "#version 330 core\n"
        "\n"
        "layout(location = 0) in vec4 position;"
        "\n"
        "void main()\n"
        "{\n"
        "    gl_Position = position;\n"
        "}\n";
    std::string fragmentShader =
        "#version 330 core\n"
        "\n"
        "layout(location = 0) out vec4 color;"
        "\n"
        "void main()\n"
        "{\n"
        "    color = vec4(1,0,0,1);\n"
        "}\n";

    unsigned int shader = CreateShader(vertexShader, fragmentShader);
    glUseProgram(shader);
    /* Loop until the user closes the window */
    while (!glfwWindowShouldClose(window))
    {
        /* Render here */
        glClear(GL_COLOR_BUFFER_BIT);

        /*glBegin(GL_TRIANGLES);
        glVertex2f(-0.5, -0.5);
        glVertex2f(0, 0.5);
        glVertex2f(0.5, -0.5);
        glEnd();*/
        glDrawArrays(GL_TRIANGLES, 0, 3); // 这里应该就是设置图元，到底是把这几个点画成三角形还是离散的点
        /* Swap front and back buffers */
        glfwSwapBuffers(window);

        /* Poll for and process events */
        glfwPollEvents();
    }

    glfwTerminate();
    return 0;
}

```

关于 glsl 语言

1、

core 表示我们正在使用核心模式。即现代化 opengl，实际上用老的 openglAPI 反而会报异常

```glsl
#version 330 core
```

2、

vec3 vec4 这种是 glsl 里预定义的结构体，是 float 型，由于它的长度固定，你可以直接访问其元素，元素依次是 x y z w (w 用于透视划分，并不是 3D 坐标，可以给 1)

```glsl
gl_Position = vec4(position.x, position.y, position.z, 1.0);
```

3、

in 关键字

大概就是从之前的布局里取数据

```glsl
layout (location = id) in 类型 变量名字；
layout (location = 0) in vec3 position;
```

out 关键字

应该就是做最终输出

因为每个着色器都需要有输入输出，这样才能构建管线

4、

uniform

类似全局变量，任何着色阶段的着色器都可用。从 cpu 发送

关于两个着色器：

vertex 着色器的目标是确定顶点位置，所以最终目标应该给全局变量 gl_Position 赋值

fragment 着色器的目标是确定像素的颜色，所以最终目标是 输出一个 vec4 类型的变量，我们例子里称之为了 color

两个着色器之间能够传递变量，同名同类型即可，不需要显式声明。只需要是 vertex 的输出，fragment 就能用

vbo 顶点缓冲区：如果画一个三角形，这很好

ibo 索引缓冲区：如果我们画正方形，它是两个三角形，但是实际上只有四个顶点。我们利用索引来共享顶点

调查错误（黑屏原因）：

1、glGetError 函数 获取错误代码

如果多个标志记录了错误，`glGetError`则返回并清除任意错误标志值。因此，如果需要重置所有错误标志，`glGetError`则应始终循环调用 ，直到返回。`GL_NO_ERROR`

因为每个函数都要做，所以我们可以定义一个宏，每次调用函数都用宏调用

2、自 4.3，可以给 opengl 一个回调，当错误发生时，自动进入回调

顶点数组 vao（注意这不是顶点缓冲区）

当我们需要绘制多个东西时，每个东西，都有顶点缓冲，索引缓冲，指定布局，这很麻烦

现在把 绑定顶点缓冲区和指定布局 二合一，成为绑定顶点数组对象

```C++

#define GLEW_STATIC
#include <GL/glew.h>

#include <GLFW/glfw3.h>

#include <string>
#include <iostream>
#include <fstream>
#include <sstream>

static void GLClearError()
{
    while (glGetError()!= GL_NO_ERROR)
    {
        ;
    }
}

static void GLCheckError()
{
    while (GLenum error = glGetError())
    {
        std::cout << error << std::endl;
    }
}

struct ShaderProgramSource
{
    std::string VertexSource;
    std::string FragmentSource;
};

static ShaderProgramSource ParseShader(const std::string& filepath)
{

    enum class ShaderType
    {
        NONE     = -1,
        VERTEX   =  0,
        FRAGMENT =  1
    };

    std::ifstream stream(filepath);
    std::string line;
    std::stringstream ss[2];
    ShaderType type = ShaderType::NONE;
    while (getline(stream, line))
    {
        if (line.find("#shader") != std::string::npos)
        {
            if (line.find("vertex") != std::string::npos)
            {
                type = ShaderType::VERTEX;
            }
            else if (line.find("fragment") != std::string::npos)
            {
                type = ShaderType::FRAGMENT;
            }
        }
        else
        {
            ss[(int)type] << line << "\n";
        }
    }

    return { ss[0].str(), ss[1].str() };
}

static unsigned int CompileShader(const std::string& source, unsigned int type)
{
    unsigned int id = glCreateShader(type);
    const char* src = source.c_str();
    glShaderSource(id, 1, &src, nullptr);
    glCompileShader(id);
    int result;
    glGetShaderiv(id, GL_COMPILE_STATUS, &result);
    if (result == GL_FALSE)
    {
        int length;
        glGetShaderiv(id, GL_INFO_LOG_LENGTH, &length);
        char* message = new char[length];
        glGetShaderInfoLog(id, length, &length, message);
        std::cout << "Fail" << ((type == GL_VERTEX_SHADER) ? "vertex" : "fragment") << std::endl;
        std::cout << message << std::endl;
        glDeleteShader(id);
        return 0;
    }

    return id;
}

static unsigned int CreateShader(const std::string& vertexShader, const std::string& fragmentShader)
{
    unsigned int program = glCreateProgram();
    unsigned int vs = CompileShader(vertexShader, GL_VERTEX_SHADER);
    unsigned int fs = CompileShader(fragmentShader, GL_FRAGMENT_SHADER);

    glAttachShader(program, vs); // shader 也是需要链接
    glAttachShader(program, fs);

    glLinkProgram(program);
    glValidateProgram(program);

    glDeleteShader(vs);
    glDeleteShader(fs);

    return program;
}

int main(void)
{
    GLFWwindow* window;

    /* Initialize the library */
    if (!glfwInit())
        return -1;

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    //我们设置为核心模式，这样它不会自己创建顶点数组

    /* Create a windowed mode window and its OpenGL context */
    window = glfwCreateWindow(640, 480, "Hello World", NULL, NULL);
    if (!window)
    {
        glfwTerminate();
        return -1;
    }

    /* Make the window's context current */
    glfwMakeContextCurrent(window);

    glfwSwapInterval(1);

    if (glewInit() != GLEW_OK)
    {
        return -1;
    }

    // 这是我们在 cpu 中的缓冲区
    float position[] = {
        -0.5   , -0.5,
        0.5     , -0.5,
        0.5    , 0.5,
       -0.5    , 0.5
    };

    unsigned int indices[] = {
        0,1,2,
        2,3,0
    };

    unsigned int vao;
    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);

    unsigned int buffer;
    glGenBuffers(1, &buffer);
    glBindBuffer(GL_ARRAY_BUFFER, buffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(position), position, GL_STATIC_DRAW);
    // 通过以上函数，我们构造了一个在 gpu 中的缓冲区，但是此时，gpu 不知道这个缓冲区里的内容如何解释

    glEnableVertexAttribArray(0);
    // 为缓冲区指明内容如何解释
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * 4, 0);
    /*
    第一个参数是你自己指定的顶点的属性的索引，什么意思，就是之后你可以在 glsl 里，利用这个整数索引，拿到这块数据
    第二个是这个属性值的数量，我这里是位置，所以是 2
    第三个是类型
    第四个是是否要单位化（对于颜色）
    第五个是，每个顶点的所有属性占多少字节。因为复杂的时候，顶点不止有位置，还有颜色，那么它第一个顶点取完颜色，需要跳跃到第二个顶点取颜色
    第六个是，当前这个属性，对于顶点开头的字节偏移量。因为我这里就一个位置，所以不会偏移

    当使用 VAO 时，我们不需要指明到底那个 vbo 应该怎么榜到那个 vao 里
    只要在 glVertexAttribPointer 指定布局之前，绑定了 vao，此布局就会自动记录到 vao 里

    */

    unsigned int ibo;
    glGenBuffers(1, &ibo);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ibo);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);
    

    ShaderProgramSource source = ParseShader("D:\\Learn\\gl\\gl\\Basic.shader");

    unsigned int shader = CreateShader(source.VertexSource, source.FragmentSource);
    glUseProgram(shader);

    // 当绑定一个着色器后，才可以设置 uniform，否则不知道给谁

    int location = glGetUniformLocation(shader, "u_Color");
    _ASSERT(location != -1);
    glUniform4f(location, 0.2, 0.3, 0.8, 1);

    glBindVertexArray(0);
    glUseProgram(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);

    float r = 0;
    float increment = 0.05;
    /* Loop until the user closes the window */
    while (!glfwWindowShouldClose(window))
    {
        glClear(GL_COLOR_BUFFER_BIT);

        glUseProgram(shader);

        glUniform4f(location, r, 0.3, 0.8, 1);

        glBindVertexArray(vao);
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ibo);

        glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, NULL);
        

        if (r > 1)
            increment *= -1;
        if(r <0)
            increment *= -1;
        r += increment;
        /*glBegin(GL_TRIANGLES);
        glVertex2f(-0.5, -0.5);
        glVertex2f(0, 0.5);
        glVertex2f(0.5, -0.5);
        glEnd();*/
        
       

        /*
        * glDrawArrays
        第一个参，这里应该就是设置图元，到底是把这几个点画成三角形还是离散的点
        第二个参，从第几个开始画
        第三个参，画几个
        */
        
        /* Swap front and back buffers */
        glfwSwapBuffers(window);

        /* Poll for and process events */
        glfwPollEvents();
    }

    glfwTerminate();
    return 0;
}

```