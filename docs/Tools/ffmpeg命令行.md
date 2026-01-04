# FFmpeg命令行

```
usage: ffmpeg [options] [[infile options] -i infile]... {[outfile options] outfile}...

Getting help:
    -h      -- print basic options
    -h long -- print more options
    -h full -- print all options (including all format and codec specific options, very long)
    -h type=name -- print all options for the named decoder/encoder/demuxer/muxer/filter/bsf/protocol
    See man ffmpeg for detailed description of the options.

Per-stream options can be followed by :<stream_spec> to apply that option to specific streams only. <stream_spec> can be a stream index, or v/a/s for video/audio/subtitle (see manual for full syntax).


输出 帮助、信息、能力：
-L                  show license
-h <topic>          show help
-version            show version
-muxers             show available 复用器
-demuxers           show available demuxers
-devices            show available devices
-decoders           show available decoders
-encoders           show available encoders
-filters            show available filters
-pix_fmts           show available pixel formats
-layouts            show standard channel layouts
-sample_fmts        show available audio sample formats

全局选项（影响整个程序，而非单一文件）:
-v <loglevel>       set logging level
-y                  overwrite output files
-n                  never overwrite output files
-stats              print progress report during encoding

每个文件的选项 (适用于输入 输出文件):
-f <fmt>            force container format (auto-detected otherwise)
-t <duration>       stop transcoding after specified duration
-to <time_stop>     stop transcoding after specified time is reached
-ss <time_off>      start transcoding at specified time


Per-file options (output-only):
-metadata[:<spec>] <key=value>  add metadata

Per-stream options:
-c[:<stream_spec>] <codec>  select encoder/decoder ('copy' to copy stream without reencoding)
-filter[:<stream_spec>] <filter_graph>  apply specified filters to audio/video

视频选项:
-r[:<stream_spec>] <rate>  override input framerate/convert to given output framerate (Hz value, fraction or abbreviation)
-aspect[:<stream_spec>] <aspect>  set aspect ratio (4:3, 16:9 or 1.3333, 1.7777)
-vn                 disable video
-vcodec <codec>     alias for -c:v (select encoder/decoder for video streams)
-vf <filter_graph>  alias for -filter:v (apply filters to video streams)
-b <bitrate>        video bitrate (please use -b:v)

音频选项:
-aq <quality>       set audio quality (codec-specific)
-ar[:<stream_spec>] <rate>  set audio sampling rate (in Hz)
-ac[:<stream_spec>] <channels>  set number of audio channels
-an                 disable audio
-acodec <codec>     alias for -c:a (select encoder/decoder for audio streams)
-ab <bitrate>       alias for -b:a (select bitrate for audio streams)
-af <filter_graph>  alias for -filter:a (apply filters to audio streams)

Subtitle options:
-sn                 disable subtitle
-scodec <codec>     alias for -c:s (select encoder/decoder for subtitle streams)
```

Muxer 复用器

用途是封装视频，将音频、视频、字幕等数据流按照特定的容器格式（如MP4、MKV、AVI等）进行打包

```
  E  h264            raw H.264 video
  E  mp3             MP3 (MPEG audio layer 3)
  E  mp4             MP4 (MPEG-4 Part 14)
  E  avi             AVI (Audio Video Interleaved)
```

Demuxer 解复用器

用途是将封装好的视频，转为单独的音频、视频

Decoder 解码器

当你播放视频时，需要解码，将视频内容还原为视频帧

Encoder 编码器

当录制视频时，需要编码，压制视频



码率



Resolution: 3840 x 2160@29.963

Video DataRate: 3651Kbps

Audio DataRate: 163 kbps

1、是以 bit 来衡量的

4K 粗略的认为是 0.4MB/s 这样，1分钟的视频，就要24MB？

而1K，确实是4K的四分之一，大概0.1MB/s的样子

你b站卡住之后，它显示的是 50 Kbps~200Kbps，这个速率确实看不了1K的视频都

看1分钟，需要消耗6MB，20分钟，需要120MB

常用命令

视频格式转换

```
ffmpeg -i input.avi output.mp4
```

视频裁剪

```
ffmpeg -i input.mp4 -ss 00:00:30 -to 00:01:00 -c copy output.mp4
```

调整视频分辨率

```
ffmpeg -i input.mp4 -s 1280x720 output.mp4
```

改变视频帧率

```
ffmpeg -i input.mp4 -r 30 output.mp4
```

合并视频

```
echo "file 'input1.mp4'" > mylist.txt
echo "file 'input2.mp4'" >> mylist.txt
ffmpeg -f concat -safe 0 -i mylist.txt -c copy output.mp4
```

查看信息（包括码率）

```
ffmpeg -i input.mp4
```

重新编码视频（以不同码率）

```
ffmpeg -i input.mp4 -b:v 1000k -c:a copy output.mp4
```



按照我之前OBS的设置是20000Kbps的码率，它相当于2.5MB/s

一分钟就要 150 MB 是不可接受的

我的设想大概是1分钟的视频，20MB

那么 码率应该设置为 2500 Kbps

