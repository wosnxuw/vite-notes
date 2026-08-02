Git 原理研究

### 分布式

整个 Git 仓库是存在于你本地的，服务器上的是另一个同等的 Git 仓库，你把你的内容同步到它那里，而不是你听从于它

### commit graph

整个 Git 仓库，是一个 DAG 图，每一次 commit，生成一个节点

它是一个单向链表，每个 Node 只知道自己的父亲，但是不知道自己的孩子

### branch

branch 分支，可以理解为一个指向某一个节点的“指针”，不是 SVN 的那种 branch（类似一个真实存在的中心服务器目录）

branch 的意义类似于路标，如果没有 branch，它这个图里你不知道每一个杈是干嘛的

### HEAD

本地、远端、worktree，都有独立的 HEAD

HEAD 表示当前从哪个分支工作

HEAD 可以指向一个 branch，也可以直接指一个 Node

后者称之为 detached HEAD（发生在你 checkout 到某个 commit）

### commit

commit 的默认行为是：

生成一个新 commit 节点，它的父节点是当前 HEAD

让当前分支指向新的节点

关键：

（1）我们说 HEAD 没有动，因为 HEAD 执行的一直是同一个 branch，但是 branch 在动

（2）一般不能在 detached HEAD 状态提交

### main 和 master

2020 年 黑人的命也是命 事件后，Github 宣布将 master 切换为 main

即 git init 后，默认分支叫什么的问题



### remote

remote 本质和 email 差不多，是一个配置项的“键”

但是它里面可以存好几个值，每一个值还可以起别名

### origin / upstream

git 默认将你 clone 的那个地址设置为 origin

如果你是 fork 别人的仓库，那你的仓库是 origin，原作者是 upstream

### origin/main

这也是一个分支，而不是一个 url，一个对 remote 的快照

备注：这不一定是 remote 的 HEAD 指向的位置，比如 origin/dev

### push

在 Git 的默认配置下，必须：

（1）本地待提交的分支（如果不说，就是 HEAD 指向的），和远端分支的名字一致（避免你手滑推到 main 上）

（2）远端的那个分支指向的 Node，必须是你本地分支的父亲节点

特点：

不会修改远端 HEAD 的指向，前面说过，是分支指针在前进，而 HEAD 指向分支，本质是推进远端的分支指针

### merge / rebase

本质把 Y 字形的分岔捏合在一起

merge 是直接捏起来，比较好理解。它是两个分支之间进行捏合，捏合成功后，两个分支指向同一个 Node

rebase 是试图把一侧的分支剪枝，然后拼接到另一侧后面

但是因为 commit 的节点变不了（可以认为是父亲无法修改），本质是丢掉右侧（没有任何 branch 能到，30 天后被清理），然后在左侧添加新的 commit
