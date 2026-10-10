# Anyvia 个人上下文传输原语验证

代码提交：`e80a12fd6bdd0324cf65a064e671ab74a44f6fbf`。状态：in_progress；尚未完成双产品业务装配、真实环境验收或发布。

本增量按 09§19.2.1 实现签名临时 X25519 握手、双向密钥确认、方向隔离的 AES-GCM 帧、严格序号与期限，以及 Windows 私有命名管道、实际对端 PID/birth/SID 和持有进程句柄的复核。仅本地 SID 不能证明应用身份；加密帧也不自身授予业务权限。

新增 T08.084—102 共 19 项。最终平台回归 109 项通过；密码学、登记与签名身份联合 21 项通过；全仓类型、lint、隐私与 emoji 检查通过。精确命令、日志字节数与 SHA-256 见同名 evidence.json，原始日志保存在 Anyvia 的独立证据目录，不入本仓 Git。

双 reviewer 先审 canonical，再只读冻结实现。协议 reviewer 的 P01 真实反例证明 finish 后丢失原握手截止，原 1 失败/1 通过完整保留；修复继承原起点与单调钟，原反例复跑 2 项通过。另一 reviewer 在真实 Windows 上检查 20 次 pending accept 取消、pending read 重复关闭、迟到最终写者，3 项通过；20 次句柄数 194→194，只证明这次样本。新包中 Windows 字节未变，已复核 SHA，沿用结果不冒称重跑。

保留首次 INVALID_HANDLE_VALUE 无符号指针缺陷、Windows 子进程 loader 文件 URL 失败及负向 ACL 断言过窄的失败证据。最终实现将原生无效句柄正规化为有符号 64 位；子进程使用 file URL；明确宽 ACL 的真实原生管道继续精确拒绝。

未完成：daemon/Gateway 启动装配、系统受保护密钥引用、双方当前权限与删除水位、请求路由/30 秒截止与主动闲置关闭、业务最终写者、状态对账与 gap/snapshot、Unix OS 传输、原始本人回应证明与 S3、实际账户和设备验收。底层通过不关闭这些要求。不得把未复核远端自报 PID/birth 当 OS 事实。
