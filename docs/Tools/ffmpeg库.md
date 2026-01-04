# FFmpeg库

**FFmpeg** 最初是 **“Fast Forward MPEG”** 的缩写，快速转码（fast forward）MPEG

**AV** — **Audio Video**

**SW** — **Software** 表示纯CPU实现，用于区别硬件实现

libavformat 媒体文件容器格式的处理库（解析.mp4文件）

libavcodec 编解码器的库

libavdevide 设备操作，摄像头麦克风

libavutil 一些单独的函数

libswrsample 音频格式转换和重采样

libswscale 视频格式转换和缩放

libavfilter 滤镜



AVFrame 表示 位压缩的音视频数据（音频或者视频之一）

```c
typedef struct AVFrame {
  ......
  
  //
  // 视频帧图像数据 或者 音频帧PCM数据, 根据不同的格式有不同的存放方式
  // 对于视频帧：RGB/RGBA 格式时 data[0] 中一次存放每个像素的RGB/RGBA数据
  //            YUV420 格式时 data[0]存放Y数据;  data[1]存放U数据; data[2]存放V数据
  // 对于音频帧: data[0]存放左声道数据;  data[1]存放右声道数据
  //
  uint8_t *data[AV_NUM_DATA_POINTERS];  
  
  //
  // 行字节跨度, 相当于stride
  // 对于视频帧: 上下两行同一列像素相差的字节数,例如：对于RGBA通常是(width*4), 但是有时FFMPEG内部会有扩展, 可能会比这个值大
  // 对于音频帧: 单个通道中所有采样占用的字节数
  //
  int linesize[AV_NUM_DATA_POINTERS];
  
  int format;         // 对于视频帧是图像格式; 对于音频帧是采样格式  
  int64_t pts;        // 当前数据帧的时间戳

   
  int width, height;  // 仅用于视频帧, 宽度高度
  int key_frame;      // 仅用于视频, 当前是否是I帧

       
  int sample_rate;          // 仅用于音频, 采样率
  uint64_t channel_layout;  // 仅用于音频, 通道类型
  int nb_samples;           // 仅用于音频, 样本数量
  
  ......
}
```

```c
AVFrame *av_frame_alloc(void);  // 分配一个数据帧结构

AVFrame *av_frame_clone(const AVFrame *src); // 完整的克隆数据帧结构, 包括其内部数据

void av_frame_free(AVFrame **frame);  // 释放数据帧结构及其内部数据

int av_frame_ref(AVFrame *dst, const AVFrame *src);  // 增加引用计数

void av_frame_unref(AVFrame *frame);  // 减少引用计数
```



AVPacket 表示压缩后的音视频数据

```c
typedef struct AVPacket {
  ......
  int64_t pts;        // 显示时间戳   
  int64_t dts;        // 解码时间戳 (对于音频来说通常与pts相同)
  uint8_t *data;      // 实际压缩后的视频或者音频数据
  int     size;       // 压缩后的数据大小
  int     stream_index;  // 流索引值, 在媒体文件中,使用0,1来区分音视频流,可以通过这个值区分当前包是音频还是视频
  int   flags;
 
  int64_t duration;     // 渲染显示时长,对于视频帧比较有用,控制一帧视频显示时长
  int64_t pos;          // 当前包在流文件中的位置, -1表示未知
  ......
} AVPacket;
```

```c
AVPacket *av_packet_alloc(void);  // 分配一个数据包结构体

AVPacket *av_packet_clone(const AVPacket *src);  // 完整赋值一个数据包

void av_packet_free(AVPacket **pkt);  // 释放数据包结构及其内部的数据

void av_init_packet(AVPacket *pkt);   // 初始化数据包结构,可选字段都设置为默认值

int av_new_packet(AVPacket *pkt, int size); // 根据指定大小创建包结构中的数据
```



SwsContext  视频图像转换上下文

关键函数

```c
// 创建转换上下文
SwsContext* sws_getContext(
    int srcW, int srcH, AVPixelFormat srcFormat, // 输入参数
    int dstW, int dstH, AVPixelFormat dstFormat, // 输出参数
    int flags,                                   // 缩放算法（如SWS_BILINEAR）
    SwsFilter* srcFilter,                        // 输入滤波器（通常NULL）
    SwsFilter* dstFilter,                        // 输出滤波器（通常NULL）
    const double* param                          // 算法参数（通常NULL）
);


// 执行转换
int sws_scale(
    SwsContext* ctx,
    const uint8_t* const srcSlice[], // 输入数据指针
    const int srcStride[],           // 输入行大小
    int srcSliceY,                   // 起始行（通常0）
    int srcSliceH,                   // 处理行数
    uint8_t* const dst[],            // 输出数据指针
    const int dstStride[]            // 输出行大小
);



```

SweContext  音频图像转换上下文







avformat_new_stream

在创建或复用媒体文件时，为音频、视频、字幕等流分配并初始化一个 `AVStream` 结构体。新增一个流（视频/音频/字幕等），自动分配流索引（`index`）