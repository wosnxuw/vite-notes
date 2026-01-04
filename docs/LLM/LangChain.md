LangChain 可以用来统一整个工作流程

这里写一个 Langchain 的使用流程

ollama、huggingface、Milvus

### 聊天模型

ollama 模型

```python
llm = ChatOllama(
        model="deepseek-r1:7b",
        base_url='http://localhost:11434'
    )
```
在线模型

1、在线模型统一用的是 ChatOpenAI，并且即使不是 OpenAI，名字也叫OpenAI

2、streaming 控制是否流式输出

```python
from pydantic.types import SecretStr # 这块注意是v1还是v2，有点库比较老
ds_key = SecretStr("sk-xxx")
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(
    model="deepseek-chat",
    base_url="https://api.deepseek.com/v1"
    api_key=ds_key,
    streaming=False
	)
```

### 嵌入模型

第一种是 用直接提供的，在Hugging Face上

```python
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
```

第二种是 在ollama里找，并使用

```python
from langchain_ollama import OllamaEmbeddings
return OllamaEmbeddings(model="mxbai-embed-large")
```

第三种是用在线的

```python
from langchain_openai import OpenAIEmbeddings
embeddings = OpenAIEmbeddings(
        model="BAAI/bge-m3",
        base_url="https://api.siliconflow.cn/v1", # 即使用嵌入模型，这里也必须是v1，而不是v1/embeddings
        api_key=sf_key
    )
```

### 向量存储

```python
from langchain_milvus import Milvus
from langchain_core.documents import Document
```

LangChain中，定义了一些独立于数据库的概念，用于跨数据库

数据库：VectorStore

存储的对象： Document

对象的名字：Document 中的 page_content 字段

对象的其它数据：其它数据全部存储在 “元数据” 里，元数据是一个Dict

最后：形成一个类似于Excel的表，每列分辨是：UUID，名字，元数据1，元数据2，元数据3

VectorStore 通过 add_documents 接受 List[Document]

连接：

```python
URI = "http://localhost:19530"
vectorstore = Milvus(
    embedding_function=embeddings,
    connection_args={"uri": URI, "token": "root:Milvus", "db_name": "default"},
    collection_name="robotart_docs",
    index_params={"index_type": "FLAT", "metric_type": "COSINE"},
    consistency_level="Strong",
    drop_old=True, # 其实我们应该插入之前，把老的删掉
)
```

插入：

```python
def chunk_list(lst, size): # 解决一次不让插入太多的问题
    for i in range(0, len(lst), size):
        yield lst[i:i + size]

if __name__ == "__main__":
    documents = process_xml_files("D:\\笔记\\RobotArt文档\\Kit\\手工分段\\")
    chunks = list(chunk_list(documents, 48))
    for chunk in chunks:
        uuids = [str(uuid4()) for _ in range(len(chunk))]
        vectorstore.add_documents(documents=chunk, ids=uuids)
```

### 向量查询

不管是底层是什么查询方式，上层都用 similarity_search 去查询

此函数参数可以指定查询的方案，和您的数据库有关

（查询并不只是有一个计算函数，似乎和数据库的架构设计也与关系，因为这决定了如何遍历所有的文档）

不过这个LangChain对Milvus的描述是，不支持Search by Vector，但是支持 Search with score

```python
results = vectorstore.similarity_search_with_score(
    "如何求法向量", k=5
)
for res, score in results:
    print(f"* [SIM={score:3f}] {res.page_content}")
```



### 调用外部工具

**在设计模型使用的工具时，记住以下几点很重要：**

具有显式工具调用api的模型将比未微调的模型更擅长工具调用。

如果工具有精心选择的名称和描述，模型将执行得更好。

对于模型来说，简单的、范围狭窄的工具比复杂的工具更容易使用。

要求模型从大量的工具列表中进行选择给模型带来了挑战。【重要】



**Function Calling的核心机制，模型仅生成请求，外部系统负责执行**

当你将 llm 和 tool 绑定以后，llm会根据你的问题决定是否调用工具

如果调用，你得到的AIMessage会包含tool_calls字段，指示AI给出了哪些参数，而content为空

其中以 JSON 描述了需要llm需要哪些参数

```python
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
model = ChatOllama(
    model="llama3.1:latest",
    temperature=0.5
)
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
messages = [
    SystemMessage("用中文回答"),
    HumanMessage("请计算 2457 乘 3514")
]
@tool
def multiply(a: int, b: int) -> int:
    """Multiply a and b.""" # 函数必须有文档型注释
    print("Is Called")
    return a * b
tools = [multiply]
model_with_tools = model.bind_tools(tools)
response = model_with_tools.invoke(messages)
print(response.text())
print(response.tool_calls)
```

按照此案例，其返回了

```json
[{'name': 'multiply', 'args': {'a': 2457, 'b': 3514}, 'id': 'af25e84a-fe4f-405e-b16d-69f443485026', 'type': 'tool_call'}]
```

我（或者一个后台服务）需要去解析这个JSON，然后帮大模型调用，将函数执行结果作为新消息追加到对话历史

```python
# 获取工具调用参数
tool_call = response.tool_calls[0]
args = tool_call["args"]

# 执行工具并获取结果
result = multiply.invoke(args)

# 将结果封装为ToolMessage并追加到消息列表
messages.append(ToolMessage(content=str(result), tool_call_id=tool_call["id"]))

final_response = model.invoke(messages)
print(final_response.content)
```

### RAG 一次性回答

将几个流程串联起来

```python
from langchain.chains import RetrievalQA
```

```python
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vectorstore.as_retriever(  # 自动转换为 Retriever
        search_kwargs={"k": 3}  # 返回 top 3 相关文档
    ),
    return_source_documents=True,  # 可选：返回参考的原文档
    chain_type_kwargs={"prompt": PROMPT},
    verbose=True  # 关键！会在控制台打印完整 prompt
)
```

```python
response = qa_chain.invoke({"query": "如何获取面的法向量，怎么做？"})
print(response["result"])  # 生成的答案
```



### 模块导入

有的时候是 `.` 有的时候是 `_` ，因为一开始，langchain所有的包都在langchain下，后来转移到各个分布式的包里了

所以，大部分的核心功能 `langchains.xxxx` 都可以换成 `langchain_core.xxxx`

和社区有关的功能，建议是直接放在 `langchains_xxxxx` 下



### MCP

这里的 MCP 解决方案有两种

1、是你有一个现成的 MCP 工具，然后把MCP工具告诉langchain，再结合到流程里（MCP工具由fastMCP生成）

2、是你用 langchain 直接写 MCP工具，然后集成到流程里。这种实际上 langchain 提供的工具，只是一个工具调用，而并非真实的 MCP，但是效果类似。

（注意，这种的话，你会依赖 langchain，可能并不符合MCP的本意，也不是真正的 MCP）



第一种：

```python
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent

client = MultiServerMCPClient(
    {
        "PQDocMCP": {
            "transport": "stdio",  # Local subprocess communication
            "command": "C:\\Users\\liuyanming\\anaconda3\\envs\\fastmcp\\python.exe",
            # Absolute path to your math_server.py file
            "args": ["D:\\Project\\LLM\\PQDocMCP\\tools.py"],
        }
    }
)

async def main():
    tools = await client.get_tools()
    llm = deepseek_model_online()
    agent = create_agent(
        llm,
        tools
    )
    response = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "如何将轨迹反向？"}]}
    )
    print(response)

if __name__ == "__main__":
    asyncio.run(main())
```



第二种：

```python
from langchain_core.tools import tool
from langchain.agents import create_agent
@tool
def get_api_documentation(category: str, func_name: str) -> str:
    
# 将工具放入列表
tools = [get_api_documentation, list_all_apis]

agent_executor = create_agent(llm, tools)
```

所以不管是1还是2，最终都是 create_agent 里传递 工具函数列表，已有MCP 服务器，无非是取出工具列表

所以1和2其实也是一码事，单独写 MCP 也可以集成进来





### 流式输出

本地：

本地流式输出就是输出到控制台，这个意义不是很大

它也可以区分按token，按chunk，甚至每个token可以绑定回调函数（这个我没试）



Web：

正常来讲，流式输出必须做成Web服务才有意义

这里用的是一个 fastAPI

创建 llm 时，必须确保 streaming=True

后端：

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from lc_models import deepseek_model_online

app = FastAPI(title="LangChain流式聊天API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "LangChain流式聊天API服务运行中"}

@app.get("/chat")
async def chat_stream(question: str):
    # 1. 获取模型
    # 注意：确保你的 deepseek_model_online() 内部支持 streaming=True
    # 如果是 ChatOpenAI 类，通常不需要改动，但最好显式传入 streaming=True
    llm = deepseek_model_online()

    # 2. 定义生成器函数
    async def generate():
        try:
            # 3. 使用 astream (异步流) 直接迭代
            # LangChain 的 astream 会自动处理流式传输
            async for chunk in llm.astream(question):
                # chunk 可能是字符串，也可能是 AIMessageChunk 对象
                content = chunk.content if hasattr(chunk, "content") else str(chunk)

                if content:
                    # 替换换行符，防止 SSE 格式错误
                    # data: 后面必须紧跟内容，且不能直接包含未转义的换行
                    # 但为了简单，通常前端处理展示，这里直接发
                    yield f"data: {content}\n\n"

            # 4. 发送结束标记
            yield "data: [DONE]\n\n"

        except Exception as e:
            print(f"生成错误: {e}")
            yield f"data: Error: {str(e)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream", # 标准 SSE 类型
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no", # 防止 Nginx 缓存
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

前端：

```html
<!DOCTYPE html>
<html>
<head>
    <title>LangChain流式聊天测试</title>
</head>
<body>
    <h1>LangChain流式聊天测试</h1>
    <div>
        <input type="text" id="question" placeholder="输入问题..." style="width: 300px;">
        <button onclick="sendQuestion()">发送</button>
    </div>
    <div id="response" style="margin-top: 20px; padding: 10px; border: 1px solid #ccc; min-height: 200px; white-space: pre-wrap;"></div>

    <script>
        async function sendQuestion() {
            const question = document.getElementById('question').value;
            const responseDiv = document.getElementById('response');
            responseDiv.innerHTML = ''; // 清空

            try {
                const response = await fetch(`http://localhost:8000/chat?question=${encodeURIComponent(question)}`);
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    // 处理可能被切断的数据包
                    const lines = chunk.split('\n\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const content = line.slice(6); // 去掉 "data: "
                            if (content === '[DONE]') return;
                            if (content.startsWith('Error:')) {
                                responseDiv.innerHTML += `<br/><span style="color:red">${content}</span>`;
                                return;
                            }

                            // 简单的追加，如果是 markdown 建议用 marked.js 等库渲染
                            responseDiv.innerHTML += content;

                            // 自动滚动
                            window.scrollTo(0, document.body.scrollHeight);
                        }
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                responseDiv.innerHTML += `\nError: ${error.message}`;
            }
        }
    </script>
</body>
</html>
```



### 历史记录

按照 langchain 的 Doc 是这样说的，上下文工程，包括了：消息历史记录等等

历史记录管理大概也有两种实现

1、就是不借助外部数据库，每次用户发问，我们都把问题存到一个List里，然后每次调用大模型，都附带这个List

2、借助外部数据库，存储List。实际上是1的扩展，就是每个List对一个ID，存到数据库里



我们详谈第二种

需要做三件事情

1、连接数据库

2、定义如何获取历史消息（通过1）

3、给 RunnableWithMessageHistory 传递2

```python
from sqlalchemy import create_engine
engine = create_engine("sqlite:///chat_history.db", echo=True)

def get_session_history(session_id: str) -> SQLChatMessageHistory:
    """根据session_id获取或创建消息历史"""
    return SQLChatMessageHistory(
        session_id=session_id,
        connection="sqlite:///chat_history.db"
    )
    
chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history"
)
```

但是，这里的问题是，你需要每次都主动去调用

chain_with_history.invoke 函数
