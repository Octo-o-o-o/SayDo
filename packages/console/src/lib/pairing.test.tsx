import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PairingOverlay } from "../components/PairingOverlay";
import {
  PAIRING_DOWNLOAD_PLACEHOLDER,
  PAIRING_LAN_DISABLED_MESSAGE,
  PAIRING_NOT_PRIVATE_MESSAGE,
  isRfc1918Ipv4,
  pairingBlockedReason,
  pairingTargetUrl
} from "./pairing";

const ipv4 = (...parts: number[]) => parts.join(".");
const LAN = ipv4(192, 168, 1, 8);
const TEN = ipv4(10, 0, 0, 1);
const TEN_B = ipv4(10, 1, 2, 3);
const C172A = ipv4(172, 16, 0, 1);
const C172B = ipv4(172, 31, 255, 255);
const C172LOW = ipv4(172, 15, 0, 1);
const C172HIGH = ipv4(172, 32, 0, 1);

describe("配对 URL 与浮层", () => {
  const open = { lanIp: LAN, port: 47473, mobileLanEnabled: true };

  it("QR 内容用本机 token 拼 LAN URL,不经 daemon 往返", () => {
    expect(pairingTargetUrl(open, "cap_abc")).toBe(`http://${LAN}:47473/?token=cap_abc`);
    expect(pairingTargetUrl({ ...open, mobileLanEnabled: false }, "cap_abc")).toBeNull();
    expect(pairingTargetUrl({ ...open, lanIp: null }, "cap_abc")).toBeNull();
    expect(pairingTargetUrl(open, "")).toBeNull();
  });

  it("mobile_lan 未开时不出码,如实提示启动开关", () => {
    expect(pairingBlockedReason({ ...open, mobileLanEnabled: false }, "cap_abc")).toBe(
      PAIRING_LAN_DISABLED_MESSAGE
    );
    const html = renderToStaticMarkup(
      <PairingOverlay
        info={{ lanIp: LAN, port: 47473, mobileLanEnabled: false }}
        token="cap_abc"
        error={null}
        onClose={() => {}}
      />
    );
    expect(html).toContain(PAIRING_LAN_DISABLED_MESSAGE);
    expect(html).toContain(PAIRING_DOWNLOAD_PLACEHOLDER);
    expect(html).toContain("data-pairing-download-placeholder");
    expect(html).not.toContain("data-pairing-qr");
  });

  it("RFC1918 私网才出码,公网/CGNAT/环回不出", () => {
    expect(isRfc1918Ipv4(LAN)).toBe(true);
    expect(isRfc1918Ipv4(TEN)).toBe(true);
    expect(isRfc1918Ipv4(C172A)).toBe(true);
    expect(isRfc1918Ipv4(C172B)).toBe(true);
    expect(isRfc1918Ipv4(C172LOW)).toBe(false);
    expect(isRfc1918Ipv4(C172HIGH)).toBe(false);
    expect(isRfc1918Ipv4("8.8.8.8")).toBe(false);
    expect(isRfc1918Ipv4("100.64.0.1")).toBe(false);
    expect(isRfc1918Ipv4("127.0.0.1")).toBe(false);
    expect(pairingTargetUrl({ ...open, lanIp: TEN_B }, "cap_abc")).toBe(
      `http://${TEN_B}:47473/?token=cap_abc`
    );
    expect(pairingTargetUrl({ ...open, lanIp: "1.1.1.1" }, "cap_abc")).toBeNull();
    expect(pairingBlockedReason({ ...open, lanIp: "1.1.1.1" }, "cap_abc")).toBe(PAIRING_NOT_PRIVATE_MESSAGE);
    const html = renderToStaticMarkup(
      <PairingOverlay info={{ ...open, lanIp: "8.8.8.8" }} token="cap_abc" error={null} onClose={() => {}} />
    );
    expect(html).toContain(PAIRING_NOT_PRIVATE_MESSAGE);
    expect(html).not.toContain("data-pairing-qr");
  });

  it("服务已开时右栏走真实配对码路径", () => {
    expect(pairingBlockedReason(open, "tok")).toBeNull();
    const html = renderToStaticMarkup(
      <PairingOverlay info={open} token="tok" error={null} onClose={() => {}} />
    );
    expect(html).toContain("扫码配对");
    expect(html).toContain("正在生成配对码");
    expect(html).not.toContain(PAIRING_LAN_DISABLED_MESSAGE);
  });
});
