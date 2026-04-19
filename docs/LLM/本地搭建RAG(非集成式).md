手工搭建 RAG

https://github.com/ollama/ollama/blob/main/docs/api.md

此文档列出了 ollama 所有的 api

这件事情大概分成一下几个部分

**1、部署本地模型**

这里我选择 ollama（其它有 vllm 等方案）

**2、文档解析&分段**

**2.1、文档解析**

pdf 转 md 这种的库

我这边试过 MinerU，感觉效果极差，反正对于我的文档，函数都搞不定，ULONG ulRobotID = 0; 这么简单的，一个 pdf 里可复制的东西，它能在这里搞出好几个希腊字母。而且总是给我附加一大堆的 css。

pdftotext 这个库还行，就是输出是纯 txt，不可见字符很少，一下就踢掉了。我注意到页眉页脚会被输出，这个在 word 里应该能去掉。

**2.2、文章分段**

将大文章拆成段落

（1）用 langchain 的 **RecursiveCharacterTextSplitter** ，段大小设置为 150-500 之间

效果极差！函数都被拆成两半了，即使是调整了参数

感觉这个东西不能仅仅是通过段大小，必须要有语义分析，不然太离谱

（2）又试了 **from nltk.tokenize import TextTilingTokenizer**

这个的问题是 它好像必须接受**分词**的结果。然后把词整理为段落。

但是分词我这边用 jieba 试了一下，但是总的来说，效果又是奇差无比

（3）尝试用 LangChain

提示模型使用 Json 格式调用外部工具，将外部工具设置为 Schema

但是我这个模型并不会调用工具，而是只和我对话

（4）尝试温柔的提示大模型帮我分段

效果还行，能分开，但是结构化比较差

虽然提示它用分隔符把段分开，但是并不能一定做到。每次的【示例】，也有可能变成【代码示例】这种，不稳定

**3、部署嵌入模型**

这一步可选择的方案也很多。主要有两个点，用哪个模型和用哪个库部署模型

库是用来部署（似乎也可以训练或者微调）模型的，免去直接部署的麻烦

库包括以下几种：

```python
from sentence_transformers import SentenceTransformer #sbert
from FlagEmbedding import FlagModel
from langchain.embeddings import HuggingFaceBgeEmbeddings
from transformers import AutoTokenizer, AutoModel # hugging face
import ollama # ollama
```

模型的话，注意选择问题，要选择同时具备中英文能力的

bge-m3（双语）

bge-large-zh （显存消耗是上一个的一半，轻量化）

**4、部署向量数据库**

向量数据库也有很多款可以选择

https://lakefs.io/blog/12-vector-databases-2023/ 最佳 17 个向量数据库

https://python.langchain.com/docs/integrations/vectorstores/ LangChain 继承的数据库

我试过 Milvus 和 Chroma

一般来讲这个东西只是个数据库（不过有的也提供简单的嵌入功能，不过一般不要用，对中文效果不行）

Milvus 有三个版本，Lite、StandAlone、Distributed

pip install 的 pymilvus 是 python 和 StandAlone 沟通的桥梁

StandAlone 只提供了 Docker

在 Collection 之上引入了 Database 概念，用于多租户场景，但默认连接时使用名称为 "default" 的数据库，无需在大多数示例中显式

在 Milvus 中，集合 Collections 相当于关系数据库管理系统（RDBMS）中的表

**5、搜索与搜索条件**

**nprobe 越大**，打开的簇越多，查询时会覆盖更多潜在的近邻向量，从而能得到更高的召回率（Accuracy ↑）；但因为需要在更多簇中扫描和计算距离，查询延迟也会相应增加（Latency ↑）。

**nprobe 越小**，查询速度越快，但可能会漏掉某些真正的近邻，召回率会下降。

对于常见规模的索引，`nprobe=10` 是一个比较常见的起点

**COSINE**：使用的距离度量（Cosine 相似度）；也可能是 `L2`、`IP`（内积）等

**TopK**：返回几个最相似的

Milvus 在分布式环境下支持多种读一致性策略，影响到查询是否能看到最新写入的数据：

- **Strong**（强一致）：总是从主节点读取，可见最新写入
- **Bounded**（有界延迟）：从 follower 读取，允许短期滞后，但有延迟上限
- **Session**（会话一致）：同一个会话内保持一致性，跨会话可能有延迟
- **Eventually**（最终一致）：最弱，一段时间后才保证可见

**level**

- 对应 HNSW 索引搜索时的 `ef_search` 参数，控制查询时候选邻居的数量／搜索深度
- 值越大，召回率越高但查询延迟也越高

**radius**

- 如果做**半径范围搜索**（range search），只返回距离查询向量小于该阈值的结果

**range filter**

- 对普通字段（如数值、时间等）做范围限制，例如 `price BETWEEN 10 AND 20`

**Partition Filter**

- 指定只在 Collection 中某些分区（Partition）里进行搜索，用于分区化数据的场景

对于 FLAT 索引，Milvus 在一个 Collection 内进行穷举扫描，100% 返回。

对于 IVF 索引，nprobe 参数决定了 Collections 内的搜索范围。增加 nprobe 会增加搜索到的向量比例和召回率，但会降低查询性能。

对于 HNSW 索引，ef 参数决定图搜索的广度。增加 ef 会增加在图中搜索的点数和召回率，但会降低查询性能。

为特定字段创建索引可提高搜索效率

加载集合是在集合中进行相似性搜索和查询的前提。加载 Collections 时，Milvus 会将所有索引文件和每个字段中的原始数据加载到内存中，以便快速响应搜索和查询。

创建索引并加载 Collections 后，就可以通过输入一个或多个查询向量开始相似性搜索。例如，当接收到搜索请求中携带的查询向量表示时，Milvus 会使用指定的度量类型来衡量查询向量与目标 Collections 中的向量之间的相似性，然后再返回与查询语义相似的向量。

要创建一个 Collection，您需要

- [创建 Schema](https://milvus.io/docs/zh/create-collection.md#Create-Schema)
- [设置索引参数](https://milvus.io/docs/zh/create-collection.md#Optional-Set-Index-Parameters)（可选）
- [创建 Collections](https://milvus.io/docs/zh/create-collection.md#Create-a-Collection)

如果创建了带有索引参数的 Collection，Milvus 会在创建时自动加载该 Collection

您也可以创建不带任何索引参数的 Collections，然后再添加索引参数。在这种情况下，Milvus 不会在创建时加载 Collection