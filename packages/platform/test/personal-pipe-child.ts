// 专用真实子进程，只接测试创建的随机产品管道；参数没有凭据。
import { openWin32PersonalPipe } from "../src/win32.js";
const name = process.argv[2];
if (!name) throw Error("test pipe missing");
const pipe = await openWin32PersonalPipe(name);
try {
  const observation = pipe.assertCurrent();
  console.log(JSON.stringify({ pid: process.pid, peerPid: observation.peer.pid, birth: observation.local.birth }));
  const content = await pipe.readExact(4);
  if (!content.equals(Buffer.from("ping"))) throw Error("test request mismatch");
  await pipe.write(Buffer.from("pong"), commit => commit());
  // 等父端确认读取，不把已提交的写入当作已消费。
  await pipe.readExact(1);
} finally { await pipe.close(); }
