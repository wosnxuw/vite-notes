
#define GLEW_STATIC
#include <GL/glew.h>

#include <GLFW/glfw3.h>

#include <string>
#include <iostream>
#include <fstream>
#include <sstream>


#include "Renderer.h"
#include "VertexBuffer.h"
#include "IndexBuffer.h"
#include "VertexArray.h"
#include "VertexBufferLayout.h"
#include "Shader.h"










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
    {

    // 这是我们在cpu中的缓冲区
    float position[] = {
       -0.5, -0.5,
        0.5, -0.5,
        0.5,  0.5,
       -0.5,  0.5
    };

    unsigned int indices[] = {
        0,1,2,
        2,3,0
    };


    VertexArray va;
    VertexBuffer vb(position, sizeof(position));

    VertexBufferLayout layout;
    layout.Push<float>(2);
    va.AddBuffer(vb, layout);

    IndexBuffer ib(indices, sizeof(indices));

    Shader shader("D:\\Learn\\gl\\gl\\Basic.shader");
    shader.Bind();

    shader.SetUniform4f("u_Color", 0.2f, 0.3f, 0.8f, 1.0f);

    va.Unbind();
    shader.Unbind();
    vb.UnBind();
    ib.UnBind();

    float r = 0;
    float increment = 0.05;
    /* Loop until the user closes the window */
    while (!glfwWindowShouldClose(window))
    {
        glClear(GL_COLOR_BUFFER_BIT);
        shader.Bind();
        shader.SetUniform4f("u_Color", r, 0.3f, 0.8f, 1.0f);
        va.Bind();
        ib.Bind();
        glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, NULL);
        if (r > 1)
            increment *= -1;
        if(r <0)
            increment *= -1;
        r += increment;
        glfwSwapBuffers(window);
        glfwPollEvents();
    }
    }
    glfwTerminate();
    return 0;
}
