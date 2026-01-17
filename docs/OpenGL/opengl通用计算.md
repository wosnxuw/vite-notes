```cpp
#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <iostream>
#include <vector>
#include <chrono>

// 检查着色器编译错误
void checkShaderCompileStatus(GLuint shader) {
    GLint status;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &status);
    if (status != GL_TRUE) {
        GLchar log[512];
        glGetShaderInfoLog(shader, 512, nullptr, log);
        std::cerr << "Shader compile error: " << log << std::endl;
        exit(EXIT_FAILURE);
    }
}

// 检查程序链接错误
void checkProgramLinkStatus(GLuint program) {
    GLint status;
    glGetProgramiv(program, GL_LINK_STATUS, &status);
    if (status != GL_TRUE) {
        GLchar log[512];
        glGetProgramInfoLog(program, 512, nullptr, log);
        std::cerr << "Program link error: " << log << std::endl;
        exit(EXIT_FAILURE);
    }
}

int main() {
    // 1. 初始化 GLFW
    if (!glfwInit()) {
        std::cerr << "Failed to initialize GLFW" << std::endl;
        return -1;
    }

    // 创建隐藏窗口（仅用于创建 OpenGL 上下文）
    glfwWindowHint(GLFW_VISIBLE, GLFW_FALSE);
    GLFWwindow* window = glfwCreateWindow(1, 1, "Hidden Window", nullptr, nullptr);
    if (!window) {
        std::cerr << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);

    // 2. 初始化 GLEW
    if (glewInit() != GLEW_OK) {
        std::cerr << "Failed to initialize GLEW" << std::endl;
        return -1;
    }

    // 3. 检查 OpenGL 4.3+ 支持（计算着色器要求）
    if (!GLEW_VERSION_4_3) {
        std::cerr << "OpenGL 4.3 or higher is required!" << std::endl;
        return -1;
    }

    // 4. 创建计算着色器
    const char* computeShaderSource = R"(
        #version 430
        layout (local_size_x = 256) in;

        layout(std430, binding = 0) buffer BufferA {
            float data[];
        } a;

        layout(std430, binding = 1) buffer BufferB {
            float data[];
        } b;

        layout(std430, binding = 2) buffer BufferResult {
            float data[];
        } result;

        void main() {
            uint index = gl_GlobalInvocationID.x;
            result.data[index] = a.data[index] + b.data[index];
        }
    )";

    GLuint shader = glCreateShader(GL_COMPUTE_SHADER);
    glShaderSource(shader, 1, &computeShaderSource, nullptr);
    glCompileShader(shader);
    checkShaderCompileStatus(shader);

    // 5. 创建程序并链接
    GLuint program = glCreateProgram();
    glAttachShader(program, shader);
    glLinkProgram(program);
    checkProgramLinkStatus(program);
    glUseProgram(program);

    // 6. 设置数据（向量长度为 1024）
    const int size = 1024;
    std::vector<float> A(size), B(size), C(size);
    for (int i = 0; i < size; i++) {
        A[i] = static_cast<float>(i);
        B[i] = static_cast<float>(i * 2);
    }

    // 7. 创建 SSBO 并绑定到着色器
    GLuint ssbo[3];
    glGenBuffers(3, ssbo);

    // 绑定 Buffer A
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, ssbo[0]);
    glBufferData(GL_SHADER_STORAGE_BUFFER, size * sizeof(float), A.data(), GL_STATIC_DRAW);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, ssbo[0]);

    // 绑定 Buffer B
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, ssbo[1]);
    glBufferData(GL_SHADER_STORAGE_BUFFER, size * sizeof(float), B.data(), GL_STATIC_DRAW);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 1, ssbo[1]);

    // 绑定结果 Buffer
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, ssbo[2]);
    glBufferData(GL_SHADER_STORAGE_BUFFER, size * sizeof(float), nullptr, GL_DYNAMIC_DRAW);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 2, ssbo[2]);

    // 8. 执行计算着色器
    glDispatchCompute(size / 256, 1, 1);
    glMemoryBarrier(GL_SHADER_STORAGE_BARRIER_BIT); // 确保写入完成

    // 9. 读取结果
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, ssbo[2]);
    float* resultData = (float*)glMapBuffer(GL_SHADER_STORAGE_BUFFER, GL_READ_ONLY);
    if (resultData) {
        std::memcpy(C.data(), resultData, size * sizeof(float));
        glUnmapBuffer(GL_SHADER_STORAGE_BUFFER);
    }

    // 10. 验证结果
    bool success = true;
    for (int i = 0; i < size; i++) {
        float expected = A[i] + B[i];
        if (std::abs(C[i] - expected) > 1e-5f) {
            std::cerr << "Error at index " << i << ": "
                << C[i] << " != " << expected << std::endl;
            success = false;
        }
    }
    std::cout << (success ? "Computation successful!" : "Computation failed!") << std::endl;

    // 11. 清理
    glDeleteBuffers(3, ssbo);
    glDeleteProgram(program);
    glDeleteShader(shader);
    glfwDestroyWindow(window);
    glfwTerminate();

    return 0;
}
```

这里是一个最简单的双数组求和的函数，利用gpu进行计算



```cpp
#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <iostream>
#include <vector>

void checkShaderCompileStatus(GLuint shader) {
    GLint status;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &status);
    if (status != GL_TRUE) {
        GLchar log[512];
        glGetShaderInfoLog(shader, 512, nullptr, log);
        std::cerr << "Shader compile error: " << log << std::endl;
        exit(EXIT_FAILURE);
    }
}

void checkProgramLinkStatus(GLuint program) {
    GLint status;
    glGetProgramiv(program, GL_LINK_STATUS, &status);
    if (status != GL_TRUE) {
        GLchar log[512];
        glGetProgramInfoLog(program, 512, nullptr, log);
        std::cerr << "Program link error: " << log << std::endl;
        exit(EXIT_FAILURE);
    }
}

int main() {
    // 1. 初始化 GLFW
    if (!glfwInit()) {
        std::cerr << "Failed to initialize GLFW" << std::endl;
        return -1;
    }

    glfwWindowHint(GLFW_VISIBLE, GLFW_FALSE);
    GLFWwindow* window = glfwCreateWindow(1, 1, "Hidden Window", nullptr, nullptr);
    if (!window) {
        std::cerr << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);

    // 2. 初始化 GLEW
    if (glewInit() != GLEW_OK) {
        std::cerr << "Failed to initialize GLEW" << std::endl;
        return -1;
    }

    // 3. 检查 OpenGL 4.3+ 支持
    if (!GLEW_VERSION_4_3) {
        std::cerr << "OpenGL 4.3 or higher is required!" << std::endl;
        return -1;
    }

    // 4. 创建计算着色器（关键修改点）
    const char* computeShaderSource = R"(
        #version 430
        layout (local_size_x = 256) in;

        // 输入缓冲区：原始数据
        layout(std430, binding = 0) buffer InputBuffer {
            float data[];
        } inputVec;

        // 输出缓冲区：结果数据（初始全0）
        layout(std430, binding = 1) buffer OutputBuffer {
            float data[];
        } outputVec;

        // 通过uniform传入目标值（例如5）
        uniform float targetValue;

        void main() {
            uint index = gl_GlobalInvocationID.x;
            // 当元素等于目标值时设为1
            if (inputVec.data[index] == targetValue) {
                outputVec.data[index] = 1.0;
            }
            // 其他位置保持0（由CPU初始化保证）
        }
    )";

    GLuint shader = glCreateShader(GL_COMPUTE_SHADER);
    glShaderSource(shader, 1, &computeShaderSource, nullptr);
    glCompileShader(shader);
    checkShaderCompileStatus(shader);

    // 5. 创建程序并链接
    GLuint program = glCreateProgram();
    glAttachShader(program, shader);
    glLinkProgram(program);
    checkProgramLinkStatus(program);
    glUseProgram(program);

    // 6. 设置数据
    const int size = 10;  // 向量长度
    std::vector<float> input(size);
    std::vector<float> output(size, 0.0f);  // 初始化为全0
    float target = 5.0f;  // 目标值

    // 填充输入向量: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    for (int i = 0; i < size; i++) {
        input[i] = static_cast<float>(i + 1);
    }

    // 7. 创建 SSBO
    GLuint ssbo[2];
    glGenBuffers(2, ssbo);

    // 绑定输入缓冲区
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, ssbo[0]);
    glBufferData(GL_SHADER_STORAGE_BUFFER, size * sizeof(float), input.data(), GL_STATIC_DRAW);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, ssbo[0]);

    // 绑定输出缓冲区（初始全0）
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, ssbo[1]);
    glBufferData(GL_SHADER_STORAGE_BUFFER, size * sizeof(float), output.data(), GL_DYNAMIC_DRAW);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 1, ssbo[1]);

    // 8. 设置uniform目标值
    GLuint loc = glGetUniformLocation(program, "targetValue");
    glUniform1f(loc, target);

    // 9. 执行计算（仅需1个工作组，因为size=10 < 256）
    glDispatchCompute(1, 1, 1);
    glMemoryBarrier(GL_SHADER_STORAGE_BARRIER_BIT);

    // 10. 读取结果
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, ssbo[1]);
    float* resultData = (float*)glMapBuffer(GL_SHADER_STORAGE_BUFFER, GL_READ_ONLY);
    if (resultData) {
        std::memcpy(output.data(), resultData, size * sizeof(float));
        glUnmapBuffer(GL_SHADER_STORAGE_BUFFER);
    }

    // 11. 验证并打印结果
    std::cout << "Input vector: ";
    for (float f : input) std::cout << f << " ";
    std::cout << "\nTarget value: " << target << std::endl;

    std::cout << "Output vector: ";
    for (float f : output) std::cout << f << " ";
    std::cout << "\nExpected:      0 0 0 0 1 0 0 0 0 0" << std::endl;

    // 12. 清理
    glDeleteBuffers(2, ssbo);
    glDeleteProgram(program);
    glDeleteShader(shader);
    glfwDestroyWindow(window);
    glfwTerminate();

    return 0;
}
```

