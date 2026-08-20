import { useEffect, useState } from "react";

export const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

/** 原生壳(iPad 等宽视口设备)注入的强制移动壳标志;桥与语音胶囊只在移动壳内接线。 */
export function isForcedMobileShell(target: { __saydoForceMobileShell?: unknown } = window as never): boolean {
  return (target as { __saydoForceMobileShell?: unknown }).__saydoForceMobileShell === true;
}

export function isMobileViewport(width: number): boolean {
  return width < 768;
}

export function useMobileViewport(): boolean {
  const [mobile, setMobile] = useState(() => isForcedMobileShell() || window.matchMedia(MOBILE_VIEWPORT_QUERY).matches);
  useEffect(() => {
    if (isForcedMobileShell()) return;
    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const onChange = (event: MediaQueryListEvent) => setMobile(event.matches);
    setMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return mobile;
}
