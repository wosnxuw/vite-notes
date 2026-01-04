# OMP

按照 https://www.youtube.com/watch?v=x0HkbIuJILk&list=PLLX-Q6B8xqZ8n8bwjGdzBJ25X2utwnoEG&index=5 的意思

古董 CPU 可以理解为 SMP 结构，即访问所有内存的代价相同，而实际上由于三级缓存的存在，缓存命中后可以大幅度提高访问速度，现在已经没有 SMP 结构的 CPU 了

一个进程的多个线程之间，在进程的内存模型上，线程间共享代码块，堆，但是每个线程维护自己的栈。OMP 就是基于多线程共享堆变量来做的。

你的进程是从主线程开始的，某一时刻，其它线程提供帮助

同时，任何一个线程可以再次 fork，比如 2 线程，它可以脱离于主线程，自己再造两个线程，它成为这个线程组的主线程。（即主线程似乎并不只是一个）

![image-20250206102503896](assets/image-20250206102503896.png)

在 pragma omp parallel 后面的一个 Block 中，所有的线程都会去执行块里面的语句

```cpp
#pragma omp parallel
{
    int id = omp_get_thread_num();
    printf("hello(%d)", id);
    printf(" world(%d)\n", id);
}
```

按照教程的说法，所有线程共享 A（应该是的，A 这里是全局变量）

```cpp
double A[1000];
int main(void) {
    omp_set_num_threads(8);
    #pragma omp parallel
    {
        int id = omp_get_thread_num();
        pooh(id, A);
    }
    return 0;
}
```

OMP 直至让编译器把这块代码翻译为对应 OS 上的多线程 API 语句

![image-20250206105059314](assets/image-20250206105059314.png)

SPMD 思想：多个线程，利用自己的 id 和线程总数，来调整其所作的事情

**SPMD**（Single Program Multiple Data，单程序多数据）是一种并行编程模型

所有的线程或处理单元执行相同的程序代码，但它们处理的是不同的数据。这种思想的核心是每个线程独立地执行相同的代码，只是操作的数据不同。每个线程在程序中可能会根据其所处理的数据有所不同，但程序的控制流是统一的。

**SIMD**（Single Instruction Multiple Data）：是 SPMD 的一种硬件实现方式，在单指令下执行多个数据操作。比如在 SIMD 架构中，一条指令对多个数据进行并行计算。

**SIMT**（Single Instruction Multiple Threads）：常见于 GPU 中，类似 SPMD，每个线程执行相同的指令，但它们操作不同的数据元素。

（1）循环分布，假设有一个 1000 的数组要计算，让 0 线程算 0 4 8 ...

1 线程算 1 5 9，依此类推

那么每个线程应该怎么访问数组呢？它可以通过起始指针设置为自己的 id，每次走线程个

优势：不需要对原有循环做太多修改

（2）标量提升为数组

当之前要计算一个 sum 值，把 sum 提升为 sum[num_threads]，让每个线程算自己的副本

虚假共享：

它发生在多个线程并行执行时，独立的数据元素位于同一个缓存行上。每次线程更新数据时，缓存行会在多个线程间来回"搅动"，从而造成性能下降。

具体来说，如果数据元素位于内存中的连续位置，且它们被不同线程频繁地修改，尽管这些数据元素是独立的，但由于它们共享同一个缓存行，CPU 的缓存会不断地在不同核心之间同步这些缓存行。这种情况会影响程序的可扩展性，导致性能低下。

sum[NUM]; 是主线程栈上的？

```cpp
#include <stdio.h>
#include <math.h>
#include <omp.h>

static long num_steps = 100000;
double step;
#define NUM 2
int main(void) {
    int i = 0, nthreads = 0;
    double x = 0, pi = 0, sum[NUM];
    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM);
#pragma omp parallel
    {
        int i, id, nthrds;
        double x;
        id = omp_get_thread_num();
        nthrds = omp_get_num_threads();
        if (id == 0)
        {
            nthreads = nthrds;
        }
        for (i = id, sum[id]=0.0 ; i < num_steps;i+=nthrds)
        {
            x = (i + 0.5) * step;
            sum[id] += 4.0 / (1.0 + x * x);
        }
    }
    for (auto s : sum)
    {
        pi += s*step;
    }
    printf("%f", pi);
    return 0;
}

```

nthrds = omp_get_num_threads(); if (id == 0) ...

之所以在并行块内讯问线程数，是因为即使你请求了 8 个线程，有可能失败，系统只给你 6 个。

```cpp
static long num_steps = 100000;
double step;
#define NUM 4
int main(void) {
    double pi = 0;
    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM);
#pragma omp parallel 
    {
        int i, id, nthrds;
        double x, sum;
        id = omp_get_thread_num();
        nthrds = omp_get_num_threads();
        for (i = id, sum = 0; i < num_steps; i += nthrds)
        {
            x = (i + 0.5) * step;
            sum += 4.0 / (1.0 + x * x);
        }
#pragma omp critical
        pi += sum * step;
    }
    printf("%f", pi);
    return 0;
}
```

这个就是，sum 不再提升为数组，而是作为一个标量，避免了虚假共享，算完了合并

如果你没有使用 `reduction` 子句或其他方式管理并行累加，确实应该使用 `#pragma omp critical` 来确保每次只有一个线程可以更新 `pi`，防止竞态条件

同步策略

1、屏障

一个屏障，确保所有线程到达后，才继续向下走

```cpp
int main(void) {

#pragma omp parallel
    {
        int id = omp_get_thread_num();
        A[id] = big_cal1(id);
#pragma omp barrier
        B[id] = big_cal2(id, A);
    }

    return 0;
}
```

2、互斥

```cpp
#pragma omp parallel
    {
        int id = omp_get_thread_num();
        int nthreads = omp_get_num_threads();
        for (i = id; i < max; i += nthreads)
        {
            B = big_job(i);
        }
#pragma omp critical
        res += consume(B);
    }
```

#pragma omp critical 构造了一个区域，这个区域的代码，同时只能由一个线程来执行（但是每个人都要执行）

怕自己读的时候，别人写。或者同时写入。

这个性能降低很大的

3、原子操作

#pragma omp atomtic

和上面互斥类似，但是通过硬件进行支持

只能是以下表达式

```cpp
x binop= expr
x++
X--
    ++x
    --x
```

**for **循环专用优化语句

```cpp
#pragma omp for
#pragma omp parallel for reduction(+:sum)
```

循环中的每次迭代是相互独立的，即每次迭代之间没有依赖关系（比如，迭代结果不影响后续的迭代）。这种情况下使用 `#pragma omp for` 可以显著提高性能

例子：两个大向量做加法、一个向量乘 2

子语句：

`reduction`（直译：减少） 子句用于处理并行循环中**共享变量**的累加或其他运算问题。它确保每个线程拥有该共享变量的私有副本，线程间的操作不会发生冲突，最后会将所有线程的结果合并到共享变量中。

**常见的 `reduction` 操作：**

- `+`（加法）
- `*`（乘法）
- `-`（减法）
- `&`（按位与）
- `|`（按位或）
- `min`（最小值）
- `max`（最大值）

`schedule(dynamic)` 让线程在完成自己的工作后，自动从队列中获取下一个任务。这样，处理较少路径点的线程可以很快获取下一个路径进行处理，避免了负载不均衡的问题

`schedule(dynamic)` 用于控制循环迭代的调度方式。它主要用于多线程并行化循环时，决定如何将循环迭代分配给不同的线程。`schedule(dynamic)` 使得线程在处理完分配给它们的任务后，能够动态地从队列中获取新的任务，从而平衡负载