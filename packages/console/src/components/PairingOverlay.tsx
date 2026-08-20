// 侧栏「与手机配对」浮层:左栏占位下载码,右栏真实配对码;单浮层/Esc/点外关闭。

import { Smartphone, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { toDataURL } from "qrcode";
import {
  PAIRING_DOWNLOAD_PLACEHOLDER,
  pairingBlockedReason,
  pairingTargetUrl,
  type PairingInfo
} from "../lib/pairing";

export async function renderPairingQrDataUrl(url: string): Promise<string> {
  return toDataURL(url, { margin: 1, width: 168, errorCorrectionLevel: "M" });
}

export function PairingOverlay({
  info,
  token,
  error,
  onClose
}: {
  info: PairingInfo | null;
  token: string;
  error: string | null;
  onClose: () => void;
}) {
  const url = info ? pairingTargetUrl(info, token) : null;
  const blocked = info ? pairingBlockedReason(info, token) : null;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!url) {
      setQr(null);
      return;
    }
    let alive = true;
    void renderPairingQrDataUrl(url).then(
      (dataUrl) => {
        if (alive) setQr(dataUrl);
      },
      () => {
        if (alive) setQr(null);
      }
    );
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const column: CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: "var(--space-4)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-sm)",
    background: "var(--surface)"
  };

  return (
    <div
      data-pairing-overlay
      role="dialog"
      aria-modal="true"
      aria-label="与手机配对"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "var(--scrim)",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-5)"
      }}
    >
      <div
        data-fusion-overlay="pairing"
        style={{
          width: "min(640px, 94vw)",
          background: "var(--bg-app)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-modal)",
          padding: "var(--space-5)"
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
          <div className="flex items-center gap-[8px]" style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>
            <Smartphone size={16} aria-hidden />
            与手机配对
          </div>
          <button
            type="button"
            data-action="close-pairing"
            onClick={onClose}
            className="border-0 bg-transparent"
            style={{ color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
            aria-label="关闭配对"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="grid gap-[12px] sm:grid-cols-2">
          <div style={column} data-pairing-col="download">
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: 10 }}>下载应用</div>
            <PlaceholderQr />
            <p style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
              {PAIRING_DOWNLOAD_PLACEHOLDER}
            </p>
          </div>
          <div style={column} data-pairing-col="scan">
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: 10 }}>扫码配对</div>
            {error ? (
              <p data-pairing-error style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-error)" }}>
                {error}
              </p>
            ) : !info ? (
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>正在读取本机地址…</p>
            ) : blocked ? (
              <p data-pairing-blocked style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                {blocked}
              </p>
            ) : qr ? (
              <img
                data-pairing-qr
                src={qr}
                alt="手机配对码"
                width={168}
                height={168}
                style={{ display: "block", background: "var(--surface-control)", padding: 8 }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>正在生成配对码…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderQr() {
  return (
    <div
      data-pairing-download-placeholder
      aria-hidden
      style={{
        width: 168,
        height: 168,
        background: "var(--surface-control)",
        border: "1px dashed var(--line)",
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gridTemplateRows: "repeat(5, 1fr)",
        gap: 6,
        padding: 16
      }}
    >
      {Array.from({ length: 25 }, (_, i) => (
        <span
          key={i}
          style={{
            background: i % 3 === 0 ? "var(--line)" : "transparent",
            opacity: 0.7
          }}
        />
      ))}
    </div>
  );
}
