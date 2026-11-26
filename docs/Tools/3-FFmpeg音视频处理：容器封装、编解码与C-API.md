# FFmpeg 音视频处理：容器封装、编解码与 C-API 核心结构

前半部分厘清音视频最基本的容器封装、编解码与码率换算，并给出日常高频使用的 `ffmpeg` 命令行速查；后半部分拆解用 C/C++ 调用 FFmpeg 七大底层库时的核心数据结构（`AVPacket`、`AVFrame`、`SwsContext`）。

---

## 一、数字媒体与音视频的三个基本概念

刚开始接触音视频时，最容易把 `.mp4` 和 `H.264` 混为一谈。处理任何媒体文件前，必须先分清三个层级：

1. 文件封装格式（Container / 容器，对应复用器 Muxer 与解复用器 Demuxer）：
   - 比如 `.mp4`、`.mkv`、`.avi`、`.flv`。
   - 它就像一个快递包装盒，负责把一条视频轨道 + 多条音轨（比如国语配音轨、英语原声轨） + 多国字幕轨道 + 元数据（封面图、标题、时间轴索引）打包捆绑在同一个文件里。
   - **Demuxer（解复用器）**：打开 `.mp4` 盒子，把里面混装的视频流、音频流、字幕流拆成独立的数据流；
   - **Muxer（复用器）**：反过来，把编码好的视频流、音频流、字幕流按规则重新打包塞进 `.mp4` 或 `.mkv` 盒子里。
2. 编码压缩格式（Codec / 编解码器，对应编码器 Encoder 与解码器 Decoder）：
   - 盒子里装的视频轨和音频轨具体用什么数学算法压缩的？
   - 常见视频编码：`H.264 (AVC)`（兼容性之王）、`H.265 (HEVC)`、`AV1`（新一代开源免版税高压缩比格式）；
   - 常见音频编码：`AAC`、`MP3`、`AC3（杜比）`、`DTS`、`FLAC`。
   - **Decoder（解码器）**：播放视频时，把高度压缩的 H.264 数据包还原成一帧帧未压缩的原始像素画面（YUV / RGB）；
   - **Encoder（编码器）**：录制或压制视频时，把原始像素画面压缩成 H.264 数据包。
3. **码率（Bitrate）与文件体积的快速心算**：
   - 码率指“每秒钟的音视频数据占多少比特（`bps = bits per second`）”。注意大小写换算：`1 Byte (字节) = 8 bits (比特)`！
   - 举例 1（日常在线流媒体）：一段 4K (3840×2160 @ 30fps) 的网络视频，如果视频码率是 `3651 Kbps`、音频码率是 `163 Kbps`，总码率约为 `3800 Kbps` ≈ 除以 8 ≈ `0.47 MB/s`。也就是说看 1 分钟大约消耗 `28 MB` 流量；而 1080P 视频如果压到 `1000 Kbps`（约 `0.12 MB/s`），1 分钟大约 `7 MB`。当 B 站缓冲卡住显示网速只有 `50~200 Kbps`（每秒才十几 KB）时，连低码率 1080P 都支撑不起。
   - 举例 2（自己用 OBS 录屏的码率设定）：之前 OBS 默认设了 `20000 Kbps`（即 `20 Mbps`），除以 8 等于每秒钟往硬盘写 `2.5 MB/s`，录 1 分钟视频就要占掉 `150 MB`，体积过于庞大；如果希望录出来的视频控制在“1 分钟约 20 MB 左右”（即每秒约 `0.33 MB`），反推乘以 8，把 OBS 录制码率设在 `2500 Kbps` 左右就非常均衡了。

---

## 二、FFmpeg 命令行架构与高频实战速查

### 1. 命令行的整体参数顺序结构

```text
ffmpeg [全局选项] {[输入文件选项] -i 输入文件 1} ... {[输出文件选项] 输出文件}
```

一条核心经验：`-c copy`（流拷贝 / 直接换壳不重编码）。
如果你只是想把 `.mkv` 转成 `.mp4`，或者截取视频里的某几分钟，加上 `-c copy`（或 `-c:v copy -c:a copy`）会让 FFmpeg 完全跳过极耗 CPU 的“解码 $\rightarrow$ 重新编码”过程，直接用解复用器把里面的 H.264 数据流抽出来原封不动塞进新容器里，几秒钟就能处理完几个 GB 的视频，而且画质 100% 零损耗！

### 2. 日常最高频的 7 个实操命令

```bash
# 1. 查看视频文件的详细信息（分辨率、帧率、音视频编码格式、总码率）
ffmpeg -i input.mp4

# 2. 格式转换（不加 -c copy 会按默认编码器重新编码；若内部编码兼容，加 -c copy 可秒转封装）
ffmpeg -i input.avi output.mp4

# 3. 无损极速裁剪片段（从 00:00:30 截取到 00:01:00，使用 -c copy 不重编码秒切）
ffmpeg -i input.mp4 -ss 00:00:30 -to 00:01:00 -c copy output.mp4

# 4. 压制视频码率（把视频码率压到 2500k 以缩小体积，音频流 -c:a copy 原样保留不重编）
ffmpeg -i input.mp4 -b:v 2500k -c:a copy output.mp4

# 5. 调整视频分辨率（缩放到 1280x720）与改变帧率（-r 30 改为 30 帧）
ffmpeg -i input.mp4 -s 1280x720 -r 30 output.mp4

# 6. 剥离音视频（-vn 丢弃视频只留音频；-an 丢弃音频只留静音视频；-sn 丢弃字幕）
ffmpeg -i input.mp4 -vn -c:a copy output_audio.aac

# 7. 无损合并多个同规格视频片段（先生成文件列表 mylist.txt，再用 concat 解复用器拼接）
echo "file 'part1.mp4'" > mylist.txt
echo "file 'part2.mp4'" >> mylist.txt
ffmpeg -f concat -safe 0 -i mylist.txt -c copy merged.mp4
```

### 3. 命令行内置查询与参数字典备忘

遇到不熟悉的编码器或像素格式时，直接用 `ffmpeg` 自带的查询参数：

| 参数类别 | 常用选项 | 作用说明 |
| :--- | :--- | :--- |
| 能力查询 | `-encoders` / `-decoders`<br/>`-muxers` / `-demuxers`<br/>`-pix_fmts` / `-filters`<br/>`-h encoder=libx264` | 列出当前编译版本支持的所有编码器、解码器、封装复用器、像素格式与滤镜；或查看某个具体编码器的专属私有参数 |
| 全局控制 | `-y` / `-n`<br/>`-v warning` / `-stats` | `-y` 自动覆盖同名输出文件（写脚本必加）；`-n` 绝不覆盖；控制日志级别与进度打印 |
| 时间与文件 | `-ss <起点>` / `-to <终点>` / `-t <持续时长>`<br/>`-f <fmt>` | 指定时间裁剪范围；`-f` 强制指定容器封装格式 |
| 流选择器 | `-c:v <视频编码>` / `-c:a <音频编码>` / `-c:s <字幕>`<br/>`-vf <视频滤镜图>` / `-af <音频滤镜图>`<br/>`-b:v <视频码率>` / `-ar <音频采样率>` / `-ac <声道数>` | 冒号后的 `v / a / s` 分别代表精准作用于视频流、音频流或字幕流（旧写法里的 `-vcodec` 等价于 `-c:v`，`-acodec` 等价于 `-c:a`） |

---

## 三、FFmpeg C/C++ 开发库架构与核心结构体

FFmpeg 最初是“Fast Forward MPEG”的缩写。在 C/C++ 项目里引入 FFmpeg 开发包时，看到的头文件和动态库前缀主要包含两个缩写：`AV`（Audio Video 音视频）和 `SW`（Software，代表纯 CPU 软件算法实现，以区别于硬件加速实现）。

### 1. 七大核心组件库分工

| 库名称 | 职责定位 | 核心作用 |
| :--- | :--- | :--- |
| `libavformat` | 容器封装与协议层 | 负责解析 `.mp4 / .mkv` 等容器文件格式或 RTMP/HTTP 流（包含 Demuxer 解复用与 Muxer 复用，如 `avformat_new_stream` 创建新流并分配流索引 `index`） |
| `libavcodec` | 编解码核心层 | 包含所有音视频编码器与解码器的实现（把 `AVPacket` 解码成 `AVFrame`，或反过来） |
| `libswscale` | 视频像素缩放与色彩转换 | 纯 CPU 实现的视频图像分辨率缩放、以及像素色彩空间转换（如把解码出来的 `YUV420P` 转成渲染需要的 `RGBA`） |
| `libswresample` | 音频重采样层 | 纯 CPU 实现的音频采样率转换、声道布局转换与采样格式转换 |
| `libavfilter` | 音视频滤镜图 | 字幕烧录、水印叠加、倍速、降噪等滤镜链处理 |
| `libavdevice` | 硬件采集与输出设备 | 直接读取本机摄像头、麦克风或抓取桌面屏幕输入 |
| `libavutil` | 公共基础工具库 | 内存分配、数学运算、字典、错误码与日志等底层辅助函数 |

### 2. 音视频处理流水线上的两个灵魂结构体：`AVPacket` vs `AVFrame`

写 FFmpeg C 代码，90% 的时间都是在倒腾这两个结构体。它们一个代表“压缩态”，一个代表“原始未压缩态”：

```text
[媒体文件 .mp4]
  --(1. libavformat 解复用 av_read_frame)-->
[AVPacket (压缩后的数据包：里面装的是 H.264 NALU 或 AAC 压缩字节流)]
  --(2. libavcodec 解码 avcodec_send_packet / avcodec_receive_frame)-->
[AVFrame  (未压缩的原始帧：里面装的是 YUV420/RGB 像素矩阵 或 PCM 音频采样点)]
```

#### （1）`AVPacket`（压缩数据包）

```c
typedef struct AVPacket {
    int64_t pts;          // 显示时间戳 (Presentation Timestamp：这一帧应该在什么时候显示给用户看)
    int64_t dts;          // 解码时间戳 (Decoding Timestamp：因为视频有依赖后帧的 B 帧，解码顺序往往不等于显示顺序；音频则 pts == dts)
    uint8_t *data;        // 指向实际压缩后的 H.264 / AAC 二进制数据缓冲区
    int     size;         // 压缩数据字节大小
    int     stream_index; // 流索引编号（比如 0 代表视频轨，1 代表国语音轨，2 代表字幕轨，靠它区分当前包是谁的！）
    int     flags;        // 标志位（如 AV_PKT_FLAG_KEY 表示这是一个关键帧 I 帧）
    int64_t duration;     // 当前包对应的渲染显示持续时长
    int64_t pos;          // 当前包在媒体文件中的字节偏移位置（-1 表示未知）
} AVPacket;

// 常用生命周期管理函数（内部缓冲区通过引用计数管理）：
AVPacket *av_packet_alloc(void);                      // 分配结构体外壳
int       av_new_packet(AVPacket *pkt, int size);     // 分配内部 data 缓冲区内存
AVPacket *av_packet_clone(const AVPacket *src);       // 克隆数据包（增加引用计数）
void      av_packet_unref(AVPacket *pkt);             // 每次循环用完必须 unref 释放内部缓冲区引用，否则内存秒爆！
void      av_packet_free(AVPacket **pkt);             // 彻底销毁结构体及其内部数据
```

#### （2）`AVFrame`（解码后的原始图像帧 / 音频 PCM 帧）

```c
typedef struct AVFrame {
    // 核心像素 / 采样数据指针数组（分平面 Planar 与打包 Packed 两种存放布局）：
    // - 视频打包格式 (如 RGB/RGBA)：只有 data[0] 有值，里面按 R,G,B,A,R,G,B,A 依次连续交错存放所有像素；
    // - 视频平面格式 (如最常见的 YUV420P)：三个通道分开存放！data[0] 存全部亮度 Y，data[1] 存全部色度 U，data[2] 存全部色度 V；
    // - 音频平面格式：data[0] 存左声道全部采样，data[1] 存右声道全部采样。
    uint8_t *data[AV_NUM_DATA_POINTERS];

    // 行字节跨度 (Stride / Pitch) —— 极易踩坑的字段！
    // 对于视频：linesize[0] 代表【图像一行像素在内存中实际占用的字节数】。
    // 注意：为了满足 CPU SIMD 指令的 16/32/64 字节内存对齐要求，FFmpeg 往往会在每行末尾补齐几个空白填充字节！
    // 因此 linesize[0] 经常会【大于】图像的实际像素宽度 (width * 每像素字节数)！拷贝图像时必须按行遍历 linesize，绝不能直接 width * height 一次性 memcpy！
    int linesize[AV_NUM_DATA_POINTERS];

    int format;               // 视频帧为像素格式 (AVPixelFormat 如 AV_PIX_FMT_YUV420P)；音频帧为采样格式 (AVSampleFormat)
    int64_t pts;              // 当前帧的显示时间戳

    // 仅视频帧有效：
    int width, height;        // 视频画面宽高像素数
    int key_frame;            // 是否为关键帧 (I 帧)

    // 仅音频帧有效：
    int sample_rate;          // 音频采样率 (如 44100, 48000 Hz)
    uint64_t channel_layout;  // 声道布局 (立体声、5.1 环绕等)
    int nb_samples;           // 当前这一个音频帧里包含的单通道样本数量
} AVFrame;

// 常用生命周期与引用计数函数：
AVFrame *av_frame_alloc(void);
AVFrame *av_frame_clone(const AVFrame *src);
int      av_frame_ref(AVFrame *dst, const AVFrame *src);   // 增加内部数据缓冲区的引用计数（浅拷贝共享像素内存）
void     av_frame_unref(AVFrame *frame);                   // 减少引用计数（归零时自动释放像素内存）
void     av_frame_free(AVFrame **frame);
```

### 3. 图像像素格式转换与缩放：`SwsContext`（以及音频 `SwrContext`）

解码器解出来的 `AVFrame` 几乎清一色是 `YUV420P` 格式，而如果你要把它贴到 Qt 界面、OpenGL 纹理或者保存成图片，往往需要把它转成指定宽高尺寸的 `RGB24` 或 `RGBA` 格式。这时候就固定调用 `libswscale` 的两步套路（音频重采样则是对应调用 `libswresample` 里的 `SwrContext`）：

```c
// 1. 初始化转换上下文（只需在循环外创建一次，指定源宽高/源像素格式 --> 目标宽高/目标像素格式，以及插值算法如 SWS_BILINEAR 双线性插值）
SwsContext *sws_ctx = sws_getContext(
    srcW, srcH, AV_PIX_FMT_YUV420P,   // 输入源参数
    dstW, dstH, AV_PIX_FMT_RGBA,      // 输出目标参数
    SWS_BILINEAR,                     // 缩放滤波算法
    NULL, NULL, NULL
);

// 2. 在解码循环中，对每一帧调用 sws_scale 执行色彩空间转换与分辨率缩放
sws_scale(
    sws_ctx,
    (const uint8_t * const *)srcFrame->data,
    srcFrame->linesize,               // 传入源帧的真实行对齐跨度
    0,                                // 起始处理行号（通常从第 0 行开始）
    srcH,                             // 总共处理的源图像行数
    dstFrame->data,
    dstFrame->linesize                // 输出到目标帧
);
```
