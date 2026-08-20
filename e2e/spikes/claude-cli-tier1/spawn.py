#!/usr/bin/env python3
"""Spawn claude in a new process group for W5.4-a spikes.

Used by run.sh. Not a production path. stdin is a file or /dev/null.
stdout/stderr are teed line-by-line so kill-on-result can fire the instant a
result event appears.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import signal
import subprocess
import sys
import threading
import time
from typing import IO, Callable, Optional

RESULT_RE = re.compile(r'"type"\s*:\s*"result"')


def _mapped_rc(code: Optional[int]) -> int:
    if code is None:
        return 1
    if code < 0:
        return 128 + (-code)
    return code


def _is_result_line(line: str) -> bool:
    if RESULT_RE.search(line):
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            return True
        return isinstance(obj, dict) and obj.get("type") == "result"
    return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cwd", required=True)
    ap.add_argument("--stdout", required=True)
    ap.add_argument("--stderr", required=True)
    ap.add_argument("--env-json-file", required=True)
    ap.add_argument("--argv-json-file", required=True)
    ap.add_argument("--stdin", default="/dev/null")
    ap.add_argument("--pidfile", default="")
    ap.add_argument("--elapsed-file", default="")
    ap.add_argument("--timeout-sec", type=float, default=180)
    ap.add_argument("--kill-on-result", action="store_true")
    ap.add_argument("--sigterm-after-substring", default="")
    ap.add_argument("--sigterm-after-file", default="")
    ap.add_argument("--sigterm-delay-sec", type=float, default=1.0)
    args = ap.parse_args()

    with open(args.env_json_file, encoding="utf-8") as f:
        env = json.load(f)
    if not isinstance(env, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in env.items()):
        print("spawn: env json must be string-to-string object", file=sys.stderr)
        return 2
    with open(args.argv_json_file, encoding="utf-8") as f:
        argv = json.load(f)
    if not isinstance(argv, list) or not argv or not all(isinstance(x, str) for x in argv):
        print("spawn: argv json must be non-empty string array", file=sys.stderr)
        return 2

    stdin: int | IO[str]
    close_stdin = False
    if args.stdin in ("", "/dev/null"):
        stdin = subprocess.DEVNULL
    else:
        stdin = open(args.stdin, encoding="utf-8")
        close_stdin = True

    t0 = time.monotonic()
    try:
        proc = subprocess.Popen(
            argv,
            cwd=args.cwd,
            env=env,
            stdin=stdin,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError as e:
        if close_stdin and not isinstance(stdin, int):
            stdin.close()
        print(f"spawn: exec failed: {e}", file=sys.stderr)
        return 127

    if args.pidfile:
        with open(args.pidfile, "w", encoding="utf-8") as f:
            f.write(str(proc.pid))

    kill_lock = threading.Lock()
    sigterm_scheduled = threading.Event()
    finished_kill = {"done": False}

    def killpg(sig: int) -> None:
        with kill_lock:
            if finished_kill["done"] and sig == signal.SIGTERM:
                return
            try:
                os.killpg(proc.pid, sig)
            except OSError:
                try:
                    proc.send_signal(sig)
                except OSError:
                    pass
            if sig == signal.SIGKILL:
                finished_kill["done"] = True

    def pump(src: IO[str], dest_path: str, on_line: Optional[Callable[[str], None]]) -> None:
        with open(dest_path, "w", encoding="utf-8", errors="replace") as dest:
            while True:
                line = src.readline()
                if line == "":
                    break
                dest.write(line)
                dest.flush()
                if on_line is not None:
                    on_line(line)

    def schedule_sigterm() -> None:
        if sigterm_scheduled.is_set():
            return
        sigterm_scheduled.set()

        def later() -> None:
            time.sleep(max(0.0, args.sigterm_delay_sec))
            killpg(signal.SIGTERM)

        threading.Thread(target=later, daemon=True).start()

    def on_stdout(line: str) -> None:
        if args.kill_on_result and _is_result_line(line):
            killpg(signal.SIGKILL)
            return
        sub = args.sigterm_after_substring
        if sub and sub in line:
            schedule_sigterm()

    def watch_file() -> None:
        target = args.sigterm_after_file
        if not target:
            return
        deadline = time.monotonic() + (args.timeout_sec or 180)
        while time.monotonic() < deadline and proc.poll() is None:
            if os.path.exists(target):
                schedule_sigterm()
                return
            time.sleep(0.2)

    assert proc.stdout is not None and proc.stderr is not None
    out_t = threading.Thread(
        target=pump,
        args=(proc.stdout, args.stdout, on_stdout),
        daemon=True,
    )
    err_t = threading.Thread(
        target=pump,
        args=(proc.stderr, args.stderr, None),
        daemon=True,
    )
    out_t.start()
    err_t.start()
    if args.sigterm_after_file:
        threading.Thread(target=watch_file, daemon=True).start()

    timeout = args.timeout_sec if args.timeout_sec and args.timeout_sec > 0 else None
    timed_out = False
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        killpg(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            killpg(signal.SIGKILL)
            proc.wait()

    out_t.join(timeout=5)
    err_t.join(timeout=5)
    if close_stdin and not isinstance(stdin, int):
        stdin.close()

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    if args.elapsed_file:
        with open(args.elapsed_file, "w", encoding="utf-8") as f:
            f.write(str(elapsed_ms))
            if timed_out:
                f.write("\ntimeout=1\n")

    return _mapped_rc(proc.returncode)


if __name__ == "__main__":
    sys.exit(main())
