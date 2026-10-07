# owner19 repair47 检查器直接读取与实际计费证据

状态：INCOMPLETE/RED，workflow FAILED；作者检查不是独立验收。代码I `df5c127bb5ab2b94f08eab1db93e837c86304451`，ci-final3测试的是snapshot修复前b0dfa63c；最终snapshot修复后未再次跑完整CI，只重跑直接受影响门；E仅附证据/journal/真实机械census，不自指自身SHA。task、canonical合同限额、业务分析算法、source_binding、A conservative unavailable、准入0均未修改。

输入：保留repair46 E及七个原直接读模块/唯一contracts输入字节与SHA（input-manifest.json）；before-real-fs是真实旧verifySourceBinding，只有导入路径重定位，readFile注入实际执行tiny FS读取：4B两次供给8B只计4B；1048577B实际供给后拒绝而账0。注入Git回应仅限定功能控制，不冒真Git全通道。

行动：七模块所有原直接readFileSync口接入共享readScanFile；单件/累计/origin/原wall读前guard，每块实际计账，stat/FD/路径/版本漂移拒绝，EOF不额外read一字节，失败不倒扣。每次物理复读收费；已持有当前调用不可变字符串只用opaque收据复用，unknown readFile callback先拒不调用。FS snapshot复用前重新stat当前canonical/version并核原source bytes hash；没有物理来源的内存夹具仅显式Git注入条件允许，不冒默认FS验证。真实同长度data→evil反例after拒绝（snapshot-drift）。canonical§18.7已以truth-plane/test-truth-plane通配纪律要求唯一禁集同步，无需新增合同形状。loadRepoSources缺预算入口改为建立有效新预算；已给恢复预算必须有限、非负、origin计数一致，不能默许恢复重置。每新open保守预留名额，已见路径在满origin后也拒绝。close失败保持ownedFd/cleanup UNKNOWN，不冒释放。readSync无效返回先拒，坏注入的额外IO未知不能虚构计费。

验证：真实tiny FS/明确spy与hook注入21项PASS，另有效过期wall预算+真实FS+明确受控clock补证0读取；无1MiB重复大反例after。包括稳定/空/复读/新版本/alias/dev-inode、增长缩小替换、最后块后漂移、单件累计零余额、origin满额/open替换、short/error、恢复坏状态、异常got、close失败恢复FD。唯一TRUTH_PLANE_SELF_PATHS与vocab投影、契约禁集测试同步。首次词汇投影缺失contract/CI失败保留，修正后contract0；首次37缺省预算拒绝与随后原callee_unresolved失败分别保留。

当前43 exact-set：{'PASS': 32, 'FAIL': 10, 'REUSED_PASS': 1}；逐项actual argv/PID/UTC/exit/log bytes/SHA/运行ref见 required-current.json 与真实runner terminal。35=ci-final3的实际FAIL，不能视作最终I完整CI结果；分发本地scratch空缓存强制offline缺better-sqlite3 ENOTCACHED，未下载/发布/全局安装，Python另跑160PASS。36=repair46恢复原已装browser的64PASS限定复用，936个daemon/console/e2e/config等owning对象原字节一致，contracts只新增禁集常量与测试；不冒新PW执行。早ci-final2期间HEAD变化只保留过程证据，不算最终候选门。早其它旧ref门只按未变的具体owning源码对象复用，受影响guard/scan门最终真实再跑；actual source输入差异与ref不抹平。

失败保留：04/06/07/08真实产品source_binding与callee有限来源旧失败；37/38 callee_unresolved；26/27新研究源码未语义分类及contracts review stale，机械census只报告transport647→648（test_bounded_read.py:177）、源865→871，不改selected647/semantic-claims/旧语义结论以造绿；35/40离线分发前提失败。其它真实结果以required-current为准，不把NOT_RUN标PASS。

范围限制：直接FS读取层修正不等于完整checker全部资源通道保证。Git白名单未增加，cat-file子进程输出仍可能无界；OS/child/loader/native/mmap/heap、已有任意输入Map与未全观测UTF8 view成本仍UNKNOWN。内部budget有逐读事件，所有调用者持久化完整事件账未被本轮普遍证明。旧四完整准备编排仍禁止resume；正式native trust/build/load/ABI/artifact/domain验收NOT_RUN。全PG/D1仍RED/UNKNOWN；20原件UNRECOVERED保留，C14 A unavailable/13hops/256nodes/depth12原口径不变。

保全：原13来源、113 tracked图像、20 current字节锚、12 question原文件合计600题、四旧helper bytes/SHA逐项相等（guard-after.json）；日志不入Git。旧修45/评20/procedure4及原历史2PASS/41NOT_RUN不清零；本轮repair47/root36，现役sameCause cap37，window第2/3修，两fresh仍由主持调用。未merge/push/cleanup，自评审NOT_RUN。

下一步量化建议：分别核2个stale contracts corpus审核锚、6个新研究源码归类及1个机械transport命中；另处理6个旧PG门的有限来源/source_binding前提，并在授权环境具备本地分发依赖时复验35/40。Git child/全通道与正式native信任单独合同前提，不借本reader提升准入。

日志索引（真实原名、bytes、SHA-256）：

- `before-real-fs.log` 500B SHA `d973499eb4997130897b6333ec390506246a5047d9fb0a5352e4156cf979037d`
- `c14-self.log` 11456B SHA `bbfaeeea25836b1f17a6aa8f7913ab026c6ad275d69fb9f0c6b03283c278a8f1`
- `census-final.log` 69B SHA `7504082de1d6f837978c38fbfd796c767ed369d4ef9a49c793f6eca72e666a9a`
- `census-fresh.log` 658841B SHA `190cf3fb2ff3d71cf36170c338f7ba62f61d110a2629b72912cd2d17d219da52`
- `census-snapshot-final.log` 69B SHA `7504082de1d6f837978c38fbfd796c767ed369d4ef9a49c793f6eca72e666a9a`
- `census-update.log` 69B SHA `7504082de1d6f837978c38fbfd796c767ed369d4ef9a49c793f6eca72e666a9a`
- `ci-final.log` 144159B SHA `8ed5f8aab8700784c9c83df81e827e1950f45a65f32f2ff76985efd7e889976f`
- `ci-final2.log` 147703B SHA `9a9fecfbdc5362fd3deffa18596302a65ffe5d15040b9074959ddc5944f6a2f9`
- `ci-final3.log` 158230B SHA `3133b524e606b51fd21c5b2f0ab005509fe58bc325a7551948054bb828d2d3d7`
- `ci-frozen.log` 6683B SHA `56c22518c4fa6a5a39f46368d80ddd2a4dec90323e4c5bd7e16ea89318ee47ce`
- `evidence-doc.log` 47B SHA `fd572c00a95bcd71926a73eac61d8a3912d8b530d25e42d102ad5608e1ea2060`
- `evidence-precommit.log` 370B SHA `829bbdf9a6b33bd1a41b94d70afc0622e0b76ee6003e49c41afeae5cf170c8ef`
- `evidence-privacy-fs.log` 67B SHA `590591b5bd5a0151f7a73f9ffd0c6145a7368a66002758e7b9abb2605e18bf6b`
- `final-I-privacy.log` 67B SHA `1286f2d7de84333cca1fbd1a4de6e86d98f8157d6a718a89ce6e3d809ddbcf12`
- `final-I-privacy4.log` 67B SHA `1286f2d7de84333cca1fbd1a4de6e86d98f8157d6a718a89ce6e3d809ddbcf12`
- `final-budget-contract.log` 325B SHA `99671a1c8019f3b73561af543da9b83dd0810f8f38eb45f7b8dcdde20a4c628e`
- `final-budget-read-boundary.log` 1178B SHA `8ad8ceb3c2bfb610fef06bcdfdc3d79d8c491ff321f817b4450f579513e51336`
- `final-negative-start.log` 1178B SHA `8ad8ceb3c2bfb610fef06bcdfdc3d79d8c491ff321f817b4450f579513e51336`
- `final-read-boundary.log` 989B SHA `a673e4727eb2ced4c782430221f8cc125456a820c78d4ef1d9dbeb47cc208b7e`
- `final-required-01.log` 327B SHA `a62dc829f06123bd68aadb8dc93093f2286203f7709519492df78e503ab539f6`
- `final-required-04.log` 701B SHA `d7418179bc93ff8b8f6083230d1e3b880ac22d48b53fe6897e9dc99256716387`
- `final-required-05.log` 24B SHA `39a4213f5f6c793ae104e1709eb5a20ef438aefe6987a3dd5711636506d2259d`
- `final-required-06.log` 21600B SHA `b6605fbba20f85439d663339a02995ddc609571659edf1a081069953f6ffd146`
- `final-required-07.log` 3283519B SHA `eafce2aa98f61f94f9a48926bb57d2dc003e435c858c3d2cc01c664f5ad7a050`
- `final-required-08.log` 374B SHA `740c2ad8df4be77265899d1cffd4241ea24ddc733adb0c06b0a0e57fa81d84fa`
- `final-required-09.log` 21B SHA `5ee014a32aad1a0d1112ea37f75bea272b65eca50b0730a8849dd272a20125c8`
- `final-required-37.log` 1715B SHA `abfc5691ee1f89863b8a638c69e01a755cad45e14d93ba6d01c986be7cf43452`
- `final3-required-01.log` 328B SHA `ed98b93957b6abab83dab6b0594a74a1b4efd5058bff7b5803d0bcd6b969a917`
- `final3-required-04.log` 701B SHA `d7418179bc93ff8b8f6083230d1e3b880ac22d48b53fe6897e9dc99256716387`
- `final3-required-05.log` 24B SHA `39a4213f5f6c793ae104e1709eb5a20ef438aefe6987a3dd5711636506d2259d`
- `final3-required-06.log` 21608B SHA `430b5aecf1664654b97dc4aaa844a96a874adc71a5abdf8751797ef7a4fbe3bb`
- `final3-required-07.log` 3283520B SHA `83dcf719cb7392b96daf03ff988601b1c83a27bfbee0e1793d25cc7290b66e14`
- `final3-required-08.log` 374B SHA `740c2ad8df4be77265899d1cffd4241ea24ddc733adb0c06b0a0e57fa81d84fa`
- `final3-required-09.log` 21B SHA `5ee014a32aad1a0d1112ea37f75bea272b65eca50b0730a8849dd272a20125c8`
- `final3-required-38.log` 12707B SHA `ce9aeab5d186a0ffe6c49516c9a19a89515303f47d1ecc4eb56a6973475cc932`
- `final3-required-39.log` 11447B SHA `a1df6afdbef832304028ea7e02c10d98fd13ebb638f6417a6e327d871151272e`
- `final4-required-01.log` 326B SHA `e75464c080b4bf4f168ab70e5b376d69b9f75d6f1a92791a17c45bb6776617ad`
- `final4-required-04.log` 701B SHA `d7418179bc93ff8b8f6083230d1e3b880ac22d48b53fe6897e9dc99256716387`
- `final4-required-05.log` 24B SHA `39a4213f5f6c793ae104e1709eb5a20ef438aefe6987a3dd5711636506d2259d`
- `final4-required-06.log` 21592B SHA `7b7ca3fcc44dc1b6d07c50132bca5cbce20debc8e53319a94d91bfb24e389142`
- `final4-required-07.log` 3283517B SHA `b25bb8a60e611ac8680126069e861c64bcb8300b21f68837d865e2d0dba7b110`
- `final4-required-08.log` 374B SHA `740c2ad8df4be77265899d1cffd4241ea24ddc733adb0c06b0a0e57fa81d84fa`
- `final4-required-09.log` 21B SHA `5ee014a32aad1a0d1112ea37f75bea272b65eca50b0730a8849dd272a20125c8`
- `final4-required-38.log` 12729B SHA `05ee232df0a0d69ea2b1b26a52c2a9f042db200e3435c7bdd5c094ad2381bb74`
- `final4-required-39.log` 11473B SHA `a28ef7deeb4612afd8b242b6c0e57ee4183c6a4a2f1fd9203644aa4265b3c4e2`
- `freeze-precommit.log` 370B SHA `a2e052f47f3e09f227490ab392a311057aafea3723a5f9c1117bd8e88092f3f4`
- `new-contract-self.log` 2680B SHA `b766ba256346959a41801ab008102eda5bc0efe2630fd49526dbaa713c84afe0`
- `precommit.log` 370B SHA `a2e052f47f3e09f227490ab392a311057aafea3723a5f9c1117bd8e88092f3f4`
- `python-final.log` 415B SHA `450234c7adeec4e3fcef1978f6eebccd15f311a156173e9467c5f16fef5af532`
- `read-boundaries.log` 916B SHA `b455de4f1f8e54ef9313d212a378752ac94d41265602c727d74aba0ade210714`
- `read-final.log` 916B SHA `b455de4f1f8e54ef9313d212a378752ac94d41265602c727d74aba0ade210714`
- `required-00.log` 328B SHA `a64cf311daa1d72e58b58072107d889bf329296931cd598b961604373a90c77f`
- `required-01.log` 327B SHA `45063e249ddf311de82955388dee9d23053c142436c9b6979cc64bc3abbeaa3e`
- `required-02.log` 526B SHA `628b084d8403813faa0e78ccf00ce0fbcc3ac9034f7799e0fedbc90b88cb640f`
- `required-03.log` 129B SHA `186e5fdf31e61e4da9d89dd82b82bfa2e77ba1c91cee748d5a0c58077b901621`
- `required-04.log` 701B SHA `d7418179bc93ff8b8f6083230d1e3b880ac22d48b53fe6897e9dc99256716387`
- `required-05.log` 24B SHA `39a4213f5f6c793ae104e1709eb5a20ef438aefe6987a3dd5711636506d2259d`
- `required-06.log` 21604B SHA `e8608465c2e73c0c3f7261d0068d6d8db20857dbb6cdde161d957b35afaaaea5`
- `required-07.log` 3283522B SHA `ea613988af74154415de7eaad63c6bae8e40578e2697dedc67f7ea728433ab4f`
- `required-08.log` 374B SHA `740c2ad8df4be77265899d1cffd4241ea24ddc733adb0c06b0a0e57fa81d84fa`
- `required-09.log` 21B SHA `5ee014a32aad1a0d1112ea37f75bea272b65eca50b0730a8849dd272a20125c8`
- `required-10.log` 18814B SHA `4f52033471e9d64a9ec890b497b838d25357384720b44cf822440c06dc62b28d`
- `required-11.log` 4691B SHA `85d607d26283d3c177e0b7045c49f7c5df895d5941dd35fe2297470df8d50c36`
- `required-12.log` 2021B SHA `e6f59226a37aab2bc3b2b7acb6a32cfac91478a8d3477478038d6ca7d31b6cab`
- `required-13.log` 531B SHA `5171873129c13c7a0cd25cf52f1c12631fc51139ab878b8a8230b357cdb76048`
- `required-14.log` 656B SHA `adc478407cea7bfad48b1ac1fb657fe19da463a039658d2eafa74e91733364c0`
- `required-15.log` 1899B SHA `7517ace03217a12acefdf2e71479dab3ca5052a455206608f2456f3b5789c8d0`
- `required-16.log` 832B SHA `a24e86aa1d4e81347d3200f867a8176c8280e8a1608096a872e42236750b7d8b`
- `required-17.log` 28B SHA `fcf9d9b005e7c8ce7b76fb3bda5028373c684533cec26d35e41c6176db8c3886`
- `required-18.log` 1931B SHA `d9c369cc6531ee1f3f7e9401aaf38a99409a3b4ab72528a9664c79cbdda7f770`
- `required-19.log` 27B SHA `8b46650b1c52525eafa2b67b3cbfc74b9d7af3bf9e6a74d7f0edec511c91800c`
- `required-20.log` 1156B SHA `917d56956c12b7674c2e638f9282e0f5b7a62883e660dd7039eb0536c96c8fda`
- `required-21.log` 597B SHA `d4ed3b779946a27812364d00cb43009c4d499d471a0784e1e6401fd88d8c5176`
- `required-22.log` 1250B SHA `c0af1a6111683ab2ea46eba372a899256d37b42ec64bddce16c29e7961db2a13`
- `required-23.log` 12272B SHA `62eb38ac0a5589337716b4c05271434f9e876e56f1df88bc6b49c8fc660b6ae4`
- `required-24.log` 71B SHA `7c413e5e18145636179f2e0bda6352a2b47903ce4b37b201fe3b7fb982688bcd`
- `required-25.log` 512B SHA `6cb54e37c13b5eac36b23ef07aedcdc66c762b45493ebbe11704786b3295ca83`
- `required-26.log` 748B SHA `66913fd904884200455dc11ad19b85d229e4cc455766fa8ee869c78990c0b3f5`
- `required-27.log` 3259B SHA `2041287f056d7740cd7513f4b8d82ff7b373b18f065249f34bd95acd25e6e0ad`
- `required-28.log` 82B SHA `d360e836a6cc111c570c1c604162160bd7d8017185d5b77904a50445af4a2c20`
- `required-29.log` 47B SHA `fd572c00a95bcd71926a73eac61d8a3912d8b530d25e42d102ad5608e1ea2060`
- `required-30.log` 23B SHA `e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3`
- `required-31.log` 67B SHA `1286f2d7de84333cca1fbd1a4de6e86d98f8157d6a718a89ce6e3d809ddbcf12`
- `required-32.log` 67B SHA `1286f2d7de84333cca1fbd1a4de6e86d98f8157d6a718a89ce6e3d809ddbcf12`
- `required-33.log` 0B SHA `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- `required-34.log` 448B SHA `8394e399fc1db6433060ab605e25d3087af7e2fc3b75eb52abe171bf4bdc4be0`
- `required-37.log` 2100B SHA `53c7bf413fa69b3ad4b47c0dea0867288f46068564b28bb3acd775733984f9e2`
- `required-38.log` 12723B SHA `05653a678edf6930e6b60a23e989f268b04306c2b11718a175ff0547bba4dd16`
- `required-39.log` 11463B SHA `7e8bba61d9078b68a851dd5e7782ca7d6dea7ffbf7f3f74187730eeae5a9f1f6`
- `required-40.log` 3073B SHA `0035a655f102fe159ab1baf1715a9e3339f42ab4bd63272d568c19d95921d7d1`
- `required-41.log` 3516B SHA `fd10e62f5fee43434df69f96d00875f28a7e1438a8190b2cda33e9bfa4db70de`
- `required-42.log` 104B SHA `b30cc3e1cd52c763c116d5554c49a5a423fad9a9939e9c64f600fc2344946be8`
- `snapshot-boundaries.log` 1178B SHA `8ad8ceb3c2bfb610fef06bcdfdc3d79d8c491ff321f817b4450f579513e51336`
- `snapshot-drift.log` 101B SHA `f4e9037786bc9ba5c0b4bf8e11f7b3c80c6c0a1aec399e01620e68a0a1352071`
- `support-final.log` 21B SHA `5ee014a32aad1a0d1112ea37f75bea272b65eca50b0730a8849dd272a20125c8`
- `support-self.log` 21B SHA `5ee014a32aad1a0d1112ea37f75bea272b65eca50b0730a8849dd272a20125c8`
- `valid-wall-boundary.log` 117B SHA `1c0166e67039bb487b202f3a5191e25e887fa74ea7db922e475ca2cdb0e34d16`
