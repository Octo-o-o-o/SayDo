#!/usr/bin/env python3
"""Tiny jsonl inspectors for W5.4-a spike verdicts. Values of env dumps are never printed."""
from __future__ import annotations

import json
import sys
from typing import Any, Iterator


def iter_objs(path: str) -> Iterator[dict[str, Any]]:
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            s = line.strip()
            if not s:
                continue
            try:
                obj = json.loads(s)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                yield obj


def init_obj(path: str) -> dict[str, Any] | None:
    for obj in iter_objs(path):
        if obj.get("type") != "system":
            continue
        if obj.get("subtype") == "init":
            return obj
        if "session_id" in obj and "tools" in obj:
            return obj
    return None


def result_obj(path: str) -> dict[str, Any] | None:
    last = None
    for obj in iter_objs(path):
        if obj.get("type") == "result":
            last = obj
    return last


def flatten_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                if isinstance(block.get("text"), str):
                    parts.append(block["text"])
                elif isinstance(block.get("content"), str):
                    parts.append(block["content"])
        return "\n".join(parts)
    return str(content)


def tool_results(path: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for obj in iter_objs(path):
        if obj.get("type") != "user":
            continue
        msg = obj.get("message")
        blocks: list[Any] = []
        if isinstance(msg, dict) and isinstance(msg.get("content"), list):
            blocks = msg["content"]
        elif isinstance(obj.get("content"), list):
            blocks = obj["content"]
        for block in blocks:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_result" or "tool_use_id" in block:
                out.append(
                    {
                        "tool_use_id": block.get("tool_use_id"),
                        "is_error": bool(block.get("is_error") is True),
                        "content": flatten_text(block.get("content")),
                    }
                )
    return out


def assistant_tool_uses(path: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for obj in iter_objs(path):
        if obj.get("type") != "assistant":
            continue
        msg = obj.get("message")
        if not isinstance(msg, dict) or not isinstance(msg.get("content"), list):
            continue
        for block in msg["content"]:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                out.append(
                    {
                        "name": block.get("name"),
                        "id": block.get("id"),
                        "input": block.get("input"),
                    }
                )
    return out


def types_in_order(path: str) -> list[str]:
    labels: list[str] = []
    for obj in iter_objs(path):
        t = str(obj.get("type") or "unknown")
        sub = obj.get("subtype")
        if isinstance(sub, str) and sub:
            labels.append(f"{t}/{sub}")
        else:
            labels.append(t)
    return labels


def events_before_init(path: str) -> list[str]:
    labels: list[str] = []
    for obj in iter_objs(path):
        is_init = obj.get("type") == "system" and (
            obj.get("subtype") == "init" or ("session_id" in obj and "tools" in obj)
        )
        if is_init:
            break
        t = str(obj.get("type") or "unknown")
        labels.append(t)
    return labels


def rate_limit_statuses(path: str) -> list[str]:
    out: list[str] = []
    for obj in iter_objs(path):
        if obj.get("type") != "rate_limit_event":
            continue
        info = obj.get("rate_limit_info")
        if isinstance(info, dict) and isinstance(info.get("status"), str):
            out.append(info["status"])
        elif isinstance(obj.get("status"), str):
            out.append(obj["status"])
    return out


def env_extra_names(path: str, allow: set[str]) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for tr in tool_results(path):
        for line in tr["content"].splitlines():
            if "=" not in line:
                continue
            name = line.split("=", 1)[0]
            if not name or name in seen:
                continue
            seen.add(name)
            if name not in allow:
                names.append(name)
    return names


def haystack(path: str) -> str:
    parts: list[str] = []
    for obj in iter_objs(path):
        if obj.get("type") == "assistant":
            msg = obj.get("message")
            if isinstance(msg, dict):
                parts.append(flatten_text(msg.get("content")))
        if obj.get("type") == "result":
            if isinstance(obj.get("result"), str):
                parts.append(obj["result"])
            parts.append(flatten_text(obj.get("content")))
        for tr in []:
            pass
    for tr in tool_results(path):
        parts.append(tr["content"])
    return "\n".join(parts)


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: jsonl_query.py <cmd> <jsonl> [args...]", file=sys.stderr)
        return 2
    cmd = sys.argv[1]
    path = sys.argv[2]
    if cmd == "types":
        print("\n".join(types_in_order(path)))
        return 0
    if cmd == "first_type":
        ts = types_in_order(path)
        print(ts[0] if ts else "")
        return 0
    if cmd == "init":
        obj = init_obj(path)
        if obj is None:
            return 1
        keys = [
            "session_id",
            "model",
            "tools",
            "permissionMode",
            "apiKeySource",
            "claude_code_version",
            "cwd",
            "memory_paths",
            "plugins",
            "mcp_servers",
        ]
        slim = {k: obj.get(k) for k in keys if k in obj}
        json.dump(slim, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    if cmd == "init_field":
        field = sys.argv[3]
        obj = init_obj(path)
        if obj is None:
            return 1
        val = obj.get(field)
        if isinstance(val, (dict, list)):
            json.dump(val, sys.stdout, ensure_ascii=False)
            sys.stdout.write("\n")
        elif val is None:
            return 1
        else:
            print(val)
        return 0
    if cmd == "result":
        obj = result_obj(path)
        if obj is None:
            return 1
        keys = [
            "subtype",
            "is_error",
            "num_turns",
            "duration_ms",
            "stop_reason",
            "terminal_reason",
            "permission_denials",
            "session_id",
            "usage",
            "modelUsage",
            "total_cost_usd",
        ]
        slim = {k: obj.get(k) for k in keys if k in obj}
        json.dump(slim, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    if cmd == "result_field":
        field = sys.argv[3]
        obj = result_obj(path)
        if obj is None:
            return 1
        val = obj.get(field)
        if isinstance(val, bool):
            print("true" if val else "false")
        elif isinstance(val, (dict, list)):
            json.dump(val, sys.stdout, ensure_ascii=False)
            sys.stdout.write("\n")
        elif val is None:
            return 1
        else:
            print(val)
        return 0
    if cmd == "tool_results":
        json.dump(tool_results(path), sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    if cmd == "tool_uses":
        json.dump(assistant_tool_uses(path), sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    if cmd == "events_before_init":
        print("\n".join(events_before_init(path)))
        return 0
    if cmd == "rate_limit_statuses":
        print("\n".join(rate_limit_statuses(path)))
        return 0
    if cmd == "env_extras":
        allow = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else set()
        print("\n".join(env_extra_names(path, allow)))
        return 0
    if cmd == "contains":
        needle = sys.argv[3]
        text = haystack(path)
        print("yes" if needle.lower() in text.lower() else "no")
        return 0 if needle.lower() in text.lower() else 1
    if cmd == "pwd_lines":
        # tool_result contents that look like a single path line
        for tr in tool_results(path):
            body = tr["content"].strip()
            if body.startswith("/") and "\n" not in body:
                print(body)
        return 0
    print(f"unknown cmd {cmd}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
