import { useEffect, useState } from "react";
import type { CardKind } from "./types";

export type MobileRoute =
  | { page: "today" }
  | { page: "things" }
  | { page: "focus"; focusId: string }
  | { page: "lane"; focusId: string; laneId: string }
  | { page: "card"; kind: CardKind; id: string }
  | { page: "chat" }
  | { page: "notfound" };

const CARD_KINDS = new Set<CardKind>(["confirmation", "obligation", "task", "expectation", "memory_candidate"]);

export function parseMobileHash(hash: string): MobileRoute {
  const path = decodeURI(hash.replace(/^#/, "") || "/m");
  if (path === "/" || path === "/m" || path === "/today") return { page: "today" };
  if (path === "/m/things" || path === "/focuses") return { page: "things" };
  if (path === "/m/chat" || path === "/chat-new" || path === "/chat" || /^\/p\/[^/]+\/chat$/.test(path)) {
    return { page: "chat" };
  }
  const focus = /^(?:\/m)?\/focus\/([^/]+)$/.exec(path);
  if (focus) return { page: "focus", focusId: focus[1] as string };
  const lane = /^\/m\/lane\/([^/]+)\/([^/]+)$/.exec(path);
  if (lane) return { page: "lane", focusId: lane[1] as string, laneId: lane[2] as string };
  const card = /^\/m\/card\/([^/]+)\/([^/]+)$/.exec(path);
  if (card && CARD_KINDS.has(card[1] as CardKind)) {
    return { page: "card", kind: card[1] as CardKind, id: card[2] as string };
  }
  return path.startsWith("/m/") ? { page: "notfound" } : { page: "today" };
}

export function desktopRouteForMobileHash(hash: string): string | null {
  if (!hash.replace(/^#/, "").startsWith("/m")) return null;
  const route = parseMobileHash(hash);
  switch (route.page) {
    case "today":
      return "/today";
    case "things":
      return "/focuses";
    case "focus":
    case "lane":
      return `/focus/${encodeURIComponent(route.focusId)}`;
    case "card":
      return "/today";
    case "chat":
      return "/chat-new";
    case "notfound":
      return "/today";
  }
}

export function useMobileRoute(): MobileRoute {
  const [route, setRoute] = useState(() => parseMobileHash(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseMobileHash(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export function mobileHref(path: string): string {
  return `#${path}`;
}
