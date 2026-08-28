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

### SSH 和 HTTPS

Github 早已不允许使用账号密码来修改仓库了

Git 会根据远端的 url 来区分，如果是 git@ 则走 SSH，如果是 https:// 则走 HTTPS

在本地，SSH 需要像登录服务器那样创建密钥对，并填写 config，在网页上粘贴公钥

HTTPS 则更为特殊，git 会根据配置中的 credential.helper 所指示的凭据管理器（根据 OS 不同有区别）来调用并获取对应的 Token

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

### submodule

允许嵌套，但是必须 `git submodule update --init --recursive`才能递归初始化

`.gitmodules` 文件只负责记录直接的子模块名字、路径、远程地址

父模块使用 gitlink 来记录子模块的 commit，它不是一个文件，但是在 VSCode 等 GUI / status 里可见

在使用 `.gitmodules` 下载子模块后，使用 gitlink 来找到使用哪个 commit（子模块的 HEAD 指向哪里）

### worktree

给同一个 Git repository 再挂一个工作目录 + HEAD + index

worktree 必须有自己的 HEAD，它可以从本地某个 commit 直接派生，但是一般是从某个 branch 派生

一个 branch 同时只能被一个 worktree 占用

从理论上来说，多个 working tree，共享同一个 repository，互相知道对方的存在，所以不存在谁是“主”/“原始”一说

它和你直接把仓库复制一次的区别是，后续的所有操作，多个 worktree 之间是共享可见

A commit 了，B 立即可见；如果你只复制仓库，不推拉远端，那么是不知道的

同步的机制是靠共享同一份 .git 数据指针，仍然是同一份数据库

### 分支图轨道

某一个提交节点曾经属于 bugfix/foo 这个事实并不存在于 commit 数据里

我们通常想象的是：

```
main:        A---B---C-------F---G
                     \     /
feature:              D---E
```

但完全可能当时是：

```
old-feature: A---B---C-------F
                      \     /
main:                  D---E
```

然后后来经过 branch 删除、重命名、reset、重新创建，main -> G

不过 commit 节点有两个 parent，这两个 parent 有先后

在这里这个 F 这里，可能 first = C

### 传出的更改

传出的更改（Outgoing Changes）：当前本地分支中，存在于本地、但还不存在于它所跟踪的远程分支历史中的 commit

正常情况就是你本地 main 和 origin/main 的差异

但是如果 merge 了，比如你是在 feature 上开发，然后你本地 merge 到 main，此时你想要推 main

```
       origin/feature
              ↓
              D---E
             /     \
A---B---C-----------M
        ↑           ↑
   origin/main     main
```

只要你处于 main，那么你的传出就是：D + E + M

即使是 D，已经 push 过，但是 push 到 origin/feature 分支上了，因为对于 origin/main 来说，它不知道 D

逻辑上就是 main 相比 origin/main 多出来的历史，而不管其他分支

所以说，Lazygit 里，是默认选一个分支，观察可以抵达这个 ref 的历史

VSCode 里，默认也是这样，你最开始在“自动”那个位置，切换到“全部”，以便于你观察是否有死、不合理的分支遗留。全部即试图同时绘制一整个 DAG 图。

### 以列表/树形式查看

这个说的是 diff 怎么看，是按照文件目录树来组织，还是扁平化。如果改动文件很多建议树，否则列表就够了

### 转到当前历史记录项🎯

把当前 HEAD 所指向的 commit 找出来，滚动到它的位置并高亮

适用于历史极多，滚的太远回不来了

### chrry-pick

主线分支持续先前走，迭代一大堆功能，某一天突然发现并修复重要 bug（或反过来）

现在要把 bug 单独修复到 release 分支上，而新功能不进入

即把那个 bug-fix 的 commit，单独拿出来，补到 release 上

```
main
A---B---C---D---E---F---X

release
A---B---R1---R2---X'
```

不能 merge 是因为不能携带新功能，所以 parent 不同

X 和 X' 从 cherry-pick 完成的那一刻起，没有 Git 图意义上的关联

但是默认情况下，commit message 会沿用，你也可以在 message 里写清楚是从哪里 pick 的

### log reflog status diff

log 相当于看看 DAG

reflog 看本机的指针都怎么移动的

status 看摘要，只能看到有无变化

diff 能看到具体哪一行从什么改成了什么
