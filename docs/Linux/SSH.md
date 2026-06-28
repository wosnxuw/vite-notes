### 密钥对

建议是在 linux 上生成密钥对，而不是 windows。如果你的 windows 没有密钥，建议生成一次，以便于找到 `.ssh` 文件夹。

.ssh 文件夹是仅有一个，只要使用 OpenSSH 的软件，不管是不是 VSCode 还是各种乱七八糟的软件，都会使用同一个文件夹

（也有另类，是的，说的就是你，XTerminal，存在自己文件夹下）

生成密钥：（在 windows 上也是这个命令）

```bash
ssh-keygen -t rsa -b 2048
```

之后会让你选择密钥的保存位置，默认就行了。

（Linux 是在`home/user-name/.ssh`，windows 是在`C:\Users\user-name/.ssh`）

```shell
Enter file in which to save the key 
```

再之后是问你是否需要密码。这个密码是给私钥的，用于加强私钥。即使用了私钥，还需要输入密码。懒人就直接选不需要了。

```shell
Enter passphrase (empty for no passphrase):
```

完成后，会建立两个文件：

1、id_rsa 这个是私钥（rsa 是一定是用 rsa 算法的，有的时候就叫 keypair.pem）

2、id_rsa.pub 这个是公钥

这个名字到底叫什么，实际上无所谓，叫 fuck 和 fuck.pub 都行，一般多服务器场景下，就用 aliyun aliyun.pub 这种

总之公钥一定是 pub 后缀，私钥一般没后缀

公钥类似于：

```
ssh-rsa AAAAB3...Va72PZ liuya@liuya-virtual-machine
```

私钥类似于：

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3Blbn...CAwQFBgc=
-----END OPENSSH PRIVATE KEY-----
```

在多服务器场景下，我们还需要关注 .ssh 下的 config 和 known_hosts（登录过的服务器的指纹，以免总问你）

config 里可以配置不需要输入密码就能登录的服务器，类似于（重复多次）

```
Host vps 1.1.1.1                        # <----- 这里是你自己起的别名，你可以输入 ssh vps 直接连进去，不需要输入用户名
    HostName 1.1.1.1
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519_vps_us
    IdentitiesOnly yes                  # <----- 限制只使用配置文件里的指定的密钥，以免 agent 中加载其它密钥干扰
```

根据 OS 不同 可能需要调整斜杠和反斜杠

即：个人电脑上，.ssh 下面是公钥私钥都有，比如：

```
~/.ssh/
├── config
├── known_hosts
├── id_ed25519_github
├── id_ed25519_github.pub
├── id_ed25519_gitlab_work
├── id_ed25519_gitlab_work.pub
├── id_ed25519_vps_us
├── id_ed25519_vps_us.pub
├── id_rsa_legacy_nas
└── id_rsa_legacy_nas.pub
```

服务器上，只有公钥，比如：

```
~/.ssh/
├── authorized_keys # <-----关键
└── known_hosts   # 很多时候没有
```

authorized_keys 里存放允许登录这个账号的公钥：（其中注明了算法，公钥，登录者的身份）

```
ssh-rsa AAAAB3...Va72PZ liuya@liuya-virtual-machine
ssh-rsa AAAAA...BBBBBB a@b
```

这里的每一行，都是你在个人电脑上导出的公钥文件的内容（它也只有一行）

即，服务器的公钥（别人用来登录它），并不是单独存放在多个零散的文件里，而是集中到 authorized_keys 里

建议：通过 `ssh-copy-id -i ~/.ssh/mykey.pub user@example.com`

上传公钥，这个命令会要求输入密码，然后会自动追加

（只是追加过去了，config 依然没动，需要自己写）

### Windows 做 Server 踩坑

（1）安装：

如果想让 Windows 做服务端，这里坑还比较大

首先，Windows 专业版虽然内置了 ssh，但是没有 sshd，所以你大概率需要先下载它

AI 们都会推荐你 `Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0`

这一步其实总是卡住（不知道是微软服务器问题还是网络问题，另外四个~是微软要求的）

然后你还需要，启动 sshd 服务，设置开机自启动，放行防火墙端口（这些交给 AI 来做，这些 powershell 命令确实记不住）

你只需要确认 `Get-Service sshd` ，显示已经启动

（2）登录：

ssh yourname@ip 这一步，需要输入密码

如果该 Windows 登陆了微软账号，那么必须是你邮箱的密码（和远程桌面类似）

（3）配置密钥对：

之前，我们的 Windows 电脑只做客户端，所以我们只需要管 `C:\Users\yourname\.ssh` 下面的文件

但是，如果是个人电脑，一般只有一个微软账号登进去，它一般属于 Admin 组，所以它会去看

`C:\ProgramData\ssh` 下面的 `administrators_authorized_keys`，你把你其它客户端上生成的公钥抄过来

备注提一嘴，*nix 上也有两份，是 `~/.ssh/config` 和 `/etc/ssh/ssh_config`，读取顺序是先用户级再 root 级

这时你还是可能会失败，因为这个文件必须设置为，普通用户无法查看或者继承权限

（4）ssh-copy-id 脚本

在 Windows 上，你即便是安装了 sshd，你也没有这个脚本，这意味着你 Windows 做客户端似乎还是得连进去，然后用命令想 *nix 追加公钥

如果 Windows 做服务端，似乎 Windows 没有也没事

（5）哪个 shell？

默认是 cmd，可以通过 `ssh user@hostname powershell` 来指定是 ps 还是 wsl 之类的。

### 权限加固

可以配置 ssh 只允许通过密钥对登录

这里只要解决现有鸡还是先有蛋的问题即可