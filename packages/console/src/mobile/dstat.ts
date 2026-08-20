import { useEffect, useReducer, useRef } from "react";

export type DaemonStatus = "connecting" | "online" | "offline";
export type DaemonStatusEvent =
  | "connect_start"
  | "connect_timeout"
  | "open"
  | "close"
  | "browser_online"
  | "browser_offline";

export const DAEMON_CONNECT_TIMEOUT_MS = 3_000;

export function reduceDaemonStatus(state: DaemonStatus, event: DaemonStatusEvent): DaemonStatus {
  switch (event) {
    case "open":
      return "online";
    case "browser_offline":
    case "connect_timeout":
      return "offline";
    case "connect_start":
    case "browser_online":
      return state === "online" ? "online" : "connecting";
    case "close":
      return "offline";
  }
}

export function useDaemonStatus(connected: boolean): DaemonStatus {
  const [status, dispatch] = useReducer(
    reduceDaemonStatus,
    undefined,
    () => (typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "connecting")
  );
  const connectedOnce = useRef(false);
  const connectedRef = useRef(connected);
  useEffect(() => {
    connectedRef.current = connected;
    if (connected) {
      connectedOnce.current = true;
      dispatch("open");
      return;
    }
    if (connectedOnce.current) {
      dispatch(typeof navigator !== "undefined" && navigator.onLine === false ? "close" : "connect_start");
    }
  }, [connected]);
  useEffect(() => {
    if (status !== "connecting" || connected) return;
    const timer = window.setTimeout(() => dispatch("connect_timeout"), DAEMON_CONNECT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [connected, status]);
  useEffect(() => {
    const online = () => dispatch(connectedRef.current ? "open" : "browser_online");
    const offline = () => dispatch("browser_offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);
  return status;
}
