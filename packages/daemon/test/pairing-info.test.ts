import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir, type NetworkInterfaceInfo } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lanIpv4FromInterfaces, pairingInfoPayload } from "../src/net/pairingInfo.js";
import { mobileLanApiAllowed } from "../src/net/mobileLan.js";
import { reservePort, startDaemonProcess } from "./helpers/daemonProcess.js";

function iface(partial: Partial<NetworkInterfaceInfo> & { address: string }): NetworkInterfaceInfo {
  const family = partial.family ?? "IPv4";
  if (family === "IPv6") {
    return {
      address: partial.address,
      netmask: partial.netmask ?? "ffff:ffff:ffff:ffff::",
      family: "IPv6",
      mac: partial.mac ?? "00:00:00:00:00:00",
      internal: partial.internal ?? false,
      cidr: partial.cidr ?? `${partial.address}/64`,
      scopeid: 0
    };
  }
  return {
    address: partial.address,
    netmask: partial.netmask ?? "255.255.255.0",
    family: "IPv4",
    mac: partial.mac ?? "00:00:00:00:00:00",
    internal: partial.internal ?? false,
    cidr: partial.cidr ?? `${partial.address}/24`
  };
}

const ipv4 = (...parts: number[]) => parts.join(".");
const EN0 = ipv4(192, 168, 1, 23);
const EN1 = ipv4(10, 0, 0, 8);
const LAN = ipv4(192, 168, 0, 10);

describe("pairing-info 本机投影", () => {
  it("只取 en0 非内部 IPv4", () => {
    expect(
      lanIpv4FromInterfaces({
        lo0: [iface({ address: "127.0.0.1", internal: true })],
        en0: [
          iface({ address: "fe80::1", family: "IPv6" }),
          iface({ address: EN0, family: "IPv4" })
        ],
        en1: [iface({ address: EN1, family: "IPv4" })]
      })
    ).toBe(EN0);
  });

  it("en0 无 IPv4 或缺失时 lanIp 为 null", () => {
    expect(lanIpv4FromInterfaces({ en1: [iface({ address: EN1 })] })).toBeNull();
    expect(lanIpv4FromInterfaces({ en0: [iface({ address: "fe80::1", family: "IPv6" })] })).toBeNull();
    expect(lanIpv4FromInterfaces({})).toBeNull();
  });

  it("payload 带 port 与 mobileLanEnabled", () => {
    expect(
      pairingInfoPayload({
        ifaces: { en0: [iface({ address: LAN })] },
        port: 47473,
        mobileLanEnabled: true
      })
    ).toEqual({ lanIp: LAN, port: 47473, mobileLanEnabled: true });
  });

  it("mobile_lan 白名单不放行 pairing-info", () => {
    expect(mobileLanApiAllowed("GET", "/api/pairing-info")).toBe(false);
  });
});

describe("GET /api/pairing-info 仅本机", () => {
  it("本机来源返回 lanIp/port/开关;进程默认未开手机访问", async () => {
    const daemon = await startDaemonProcess({
      home: realpathSync(mkdtempSync(join(tmpdir(), "saydo-pairing-local-"))),
      port: await reservePort()
    });
    try {
      const res = await daemon.api("/api/pairing-info");
      expect(res.status, await res.clone().text()).toBe(200);
      const body = (await res.json()) as { lanIp: string | null; port: number; mobileLanEnabled: boolean };
      expect(body.port).toBe(daemon.port);
      expect(body.mobileLanEnabled).toBe(false);
      expect(body.lanIp === null || typeof body.lanIp === "string").toBe(true);
    } finally {
      await daemon.stop();
    }
  }, 30_000);
});
