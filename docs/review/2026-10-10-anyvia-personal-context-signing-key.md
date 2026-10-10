# Windows 安装签名密钥引用验证

代码提交 `596be13563d1bf7733962d058f3974c3ed26b9e1`；仍为 in_progress，尚未接入 Owner 登记、恢复或双产品业务。

按已双路审查的 19.2.2 实现当前用户 Generic 凭据精确引用、当前机器持久化、回读 Ed25519/PKCS8/元信息/完整摘要校验、临时缓冲区清零与精确清理。不枚举凭据；引用不是授权；没有原子 compare-delete 或同用户恶意程序隔离的承诺。创建前的同步回调只得到非秘密 intent，失败不得进入 OS 写入；异常保留精确新引用及可能存在标记。

T08.109—113 共5项验证通过。真实创建/读取/签名/清理仅用本次新随机测试前缀，错误摘要拒绝删除后原测试密钥仍可用，最后精确清理成功。管道与凭据联合回归、全仓类型/lint、隐私及emoji通过。没有访问用户已有凭据。

双 reviewer 独立发现异步准备回调的未观察Promise拒绝。实际入口原测试本身断言通过但产生1个未处理错误，进程exit1，不能报通过；修复后保留同一测试，5项exit0。另一独立纯guard oracle红后绿，范围严格为零Cred API，不能冒称原生凭据复验。

设计、冻结候选、两路评审和红绿证据见同名JSON及Anyvia证据ZIP。后续必须落实跨SQLite/OS崩溃intent、逻辑撤销优先、恢复不启用旧引用、同一产品生命周期写者和真实产品入口，不能凭原语测试宣布这些闭环。

官方核对：[CredWriteW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew) 创建或替换精确目标，因此新UUID预检不是原子create-only；[CredReadW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credreadw) 返回缓冲区须使用CredFree；[CREDENTIALW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw) 定义local-machine持久化；[Koffi指针文档](https://koffi.dev/pointers)用于外部缓冲区视图。查阅日期2026-10-10，真实本机API结果另列于测试证据。
