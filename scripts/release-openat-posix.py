#!/usr/bin/env python3
"""POSIX dir_fd/openat helper for deploy evidence. stdin: one JSON object. stdout: one JSON object."""

import errno
import fcntl
import json
import os
import stat
import sys

MAX_STDIN = 2 * 1024 * 1024
MAX_EVIDENCE_BYTES = 1048576
MAX_IDENTITY_DIGITS = 39
FIRST_FOLLOW_NAMES = frozenset({"tmp", "var"})
PATH_ILLEGAL = "部署证据路径非法"
NOT_REGULAR = "既有部署证据不是普通文件"
READ_FAILURE = "既有部署证据读取失败"
WRITE_FAILURE = "部署证据写入失败"
LEASE_LOST = "部署证据租约已失效"
CLAIM_FAILURE = "部署证据租约写入失败"
OVERSIZE = "既有部署证据过大"


class BoundedReadError(OSError):
    pass

REQUEST_KEYS = {
    "claim": frozenset({"op", "path", "body", "failParentFsync"}),
    "read": frozenset({"op", "path"}),
    "persist": frozenset({"op", "path", "body", "dev", "ino"}),
    "lease": frozenset({"op", "path", "dev", "ino"}),
}
RESULT_KEYS = frozenset({"ok", "error", "code", "dev", "ino", "text"})


def fail(error, code=None):
    payload = {"ok": False, "error": error}
    if code is not None:
        payload["code"] = code
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.exit(0)


def ok(extra):
    payload = {"ok": True}
    payload.update(extra)
    if not set(payload).issubset(RESULT_KEYS):
        fail(PATH_ILLEGAL)
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.exit(0)


def format_id(value):
    if type(value) is not int or value < 0:
        raise ValueError(PATH_ILLEGAL)
    text = str(value)
    if not text.isdigit() or len(text) > MAX_IDENTITY_DIGITS or (len(text) > 1 and text.startswith("0")):
        raise ValueError(PATH_ILLEGAL)
    return text


def parse_id(value):
    if type(value) is bool or type(value) is not str:
        fail(LEASE_LOST)
    if not value or len(value) > MAX_IDENTITY_DIGITS:
        fail(LEASE_LOST)
    if value[0] in "+-" or "." in value or "e" in value or "E" in value:
        fail(LEASE_LOST)
    if not value.isascii() or not value.isdigit() or (len(value) > 1 and value[0] == "0"):
        fail(LEASE_LOST)
    parsed = int(value, 10)
    if parsed < 0 or str(parsed) != value:
        fail(LEASE_LOST)
    return parsed


def split_path(path):
    if not isinstance(path, str) or not path or "\x00" in path:
        raise ValueError(PATH_ILLEGAL)
    abs_path = os.path.abspath(path)
    if os.name == "nt":
        drive, tail = os.path.splitdrive(abs_path)
        if not drive or not tail.startswith("\\"):
            raise ValueError(PATH_ILLEGAL)
        root = drive + "\\"
        rel = tail.lstrip("\\")
        parts = [item for item in rel.split("\\") if item]
    else:
        if not abs_path.startswith("/"):
            raise ValueError(PATH_ILLEGAL)
        root = "/"
        parts = [item for item in abs_path.split("/") if item]
    if not parts:
        raise ValueError(PATH_ILLEGAL)
    for item in parts:
        if item in (".", "..") or "/" in item or "\\" in item:
            raise ValueError(PATH_ILLEGAL)
    return root, parts


def is_single_regular(st):
    return stat.S_ISREG(st.st_mode) and not stat.S_ISFIFO(st.st_mode) and st.st_nlink == 1


def close_quietly(fd):
    if fd is None:
        return
    try:
        os.close(fd)
    except OSError:
        pass


def open_anchored(path, file_flags, file_mode=0o644, keep_parent=False):
    if not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY") or os.name == "nt":
        fail(PATH_ILLEGAL, "OPENAT_UNSUPPORTED")
    root, parts = split_path(path)
    basename = parts[-1]
    parents = parts[:-1]
    follow_dir = os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_CLOEXEC", 0)
    nofollow_dir = follow_dir | os.O_NOFOLLOW
    dirfd = os.open(root, follow_dir)
    strict = False
    try:
        for index, comp in enumerate(parents):
            st = os.lstat(comp, dir_fd=dirfd)
            if stat.S_ISLNK(st.st_mode):
                allow_first = (
                    not strict
                    and index == 0
                    and root == "/"
                    and comp in FIRST_FOLLOW_NAMES
                )
                if not allow_first:
                    raise ValueError(PATH_ILLEGAL)
                nextfd = os.open(comp, follow_dir, dir_fd=dirfd)
                strict = True
            elif stat.S_ISDIR(st.st_mode):
                nextfd = os.open(comp, nofollow_dir, dir_fd=dirfd)
                strict = True
            else:
                raise OSError(errno.ENOTDIR, "not dir")
            os.close(dirfd)
            dirfd = nextfd
        fd = os.open(basename, file_flags | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0), file_mode, dir_fd=dirfd)
        if keep_parent:
            return fd, dirfd
        os.close(dirfd)
        return fd, None
    except Exception:
        close_quietly(dirfd)
        raise


def set_blocking(fd):
    flags = fcntl.fcntl(fd, fcntl.F_GETFL)
    if flags & os.O_NONBLOCK:
        fcntl.fcntl(fd, fcntl.F_SETFL, flags & ~os.O_NONBLOCK)


def write_fully(fd, data):
    view = memoryview(data)
    while len(view):
        wrote = os.write(fd, view)
        if not isinstance(wrote, int) or wrote <= 0 or wrote > len(view):
            raise OSError("short write")
        view = view[wrote:]


def read_bounded(fd, limit):
    if type(limit) is not int or limit < 0 or limit > MAX_EVIDENCE_BYTES:
        raise BoundedReadError("oversize")
    chunks = []
    got = 0
    while got < limit:
        buf = os.read(fd, min(65536, limit - got))
        if not buf:
            raise BoundedReadError("truncated")
        if got + len(buf) > limit:
            raise BoundedReadError("oversize")
        chunks.append(buf)
        got += len(buf)
    extra = os.read(fd, 1)
    if extra:
        raise BoundedReadError("oversize")
    return b"".join(chunks)


def map_open_error(exc, basename_op):
    if isinstance(exc, ValueError):
        fail(PATH_ILLEGAL)
    if not isinstance(exc, OSError):
        fail(PATH_ILLEGAL)
    err = exc.errno
    if err == errno.ENOENT:
        fail(PATH_ILLEGAL, "ENOENT")
    if err == errno.EEXIST:
        fail(PATH_ILLEGAL, "EEXIST")
    if err == errno.ELOOP:
        fail(NOT_REGULAR if basename_op else PATH_ILLEGAL, "ELOOP")
    if err in (errno.EISDIR, errno.ENOTDIR, errno.ENXIO):
        fail(NOT_REGULAR, errno.errorcode.get(err, "EIO"))
    if err == errno.EACCES:
        fail(READ_FAILURE, "EACCES")
    fail(READ_FAILURE if basename_op else PATH_ILLEGAL)


def require_request(req, op):
    allowed = REQUEST_KEYS.get(op)
    if allowed is None or set(req) - allowed:
        fail(PATH_ILLEGAL)


def encode_evidence_body(body, oversize_error):
    if type(body) is not str:
        fail(PATH_ILLEGAL)
    try:
        data = body.encode("utf-8")
    except UnicodeEncodeError:
        fail(oversize_error)
    if len(data) > MAX_EVIDENCE_BYTES:
        fail(oversize_error)
    return data


def main():
    raw = sys.stdin.buffer.read(MAX_STDIN + 1)
    if len(raw) > MAX_STDIN:
        fail(PATH_ILLEGAL)
    try:
        req = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        fail(PATH_ILLEGAL)
    if type(req) is not dict:
        fail(PATH_ILLEGAL)
    op = req.get("op")
    path = req.get("path")
    if op not in REQUEST_KEYS or type(path) is not str:
        fail(PATH_ILLEGAL)
    require_request(req, op)
    try:
        if op == "claim":
            body = req.get("body")
            data = encode_evidence_body(body, CLAIM_FAILURE)
            fail_parent_fsync = req.get("failParentFsync")
            if fail_parent_fsync is not None and type(fail_parent_fsync) is not bool:
                fail(PATH_ILLEGAL)
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
            parent_fd = None
            try:
                fd, parent_fd = open_anchored(path, flags, keep_parent=True)
            except Exception as exc:
                close_quietly(parent_fd)
                map_open_error(exc, True)
            write_error = None
            identity = None
            try:
                st = os.fstat(fd)
                if not is_single_regular(st):
                    write_error = NOT_REGULAR
                else:
                    write_fully(fd, data)
                    os.fsync(fd)
                    st = os.fstat(fd)
                    if not is_single_regular(st):
                        write_error = NOT_REGULAR
                    else:
                        identity = {"dev": format_id(st.st_dev), "ino": format_id(st.st_ino)}
            except (OSError, ValueError):
                write_error = CLAIM_FAILURE
            parent_error = None
            if write_error is None:
                try:
                    if fail_parent_fsync is True:
                        raise OSError("injected parent fsync")
                    os.fsync(parent_fd)
                except OSError:
                    parent_error = CLAIM_FAILURE
            try:
                os.close(fd)
                close_error = None
            except OSError:
                close_error = CLAIM_FAILURE
            try:
                os.close(parent_fd)
            except OSError:
                if parent_error is None:
                    parent_error = CLAIM_FAILURE
            if write_error:
                fail(write_error, "ELOOP" if write_error == NOT_REGULAR else None)
            if parent_error:
                fail(parent_error)
            if close_error:
                fail(close_error)
            ok(identity)
        if op == "read":
            flags = os.O_RDONLY | os.O_NONBLOCK
            try:
                fd, _parent = open_anchored(path, flags)
            except Exception as exc:
                map_open_error(exc, True)
            read_error = None
            payload = None
            try:
                st = os.fstat(fd)
                if not is_single_regular(st):
                    read_error = NOT_REGULAR
                elif st.st_size > MAX_EVIDENCE_BYTES or st.st_size < 0:
                    read_error = OVERSIZE
                else:
                    data = read_bounded(fd, st.st_size)
                    payload = {
                        "dev": format_id(st.st_dev),
                        "ino": format_id(st.st_ino),
                        "text": data.decode("utf-8"),
                    }
            except BoundedReadError:
                read_error = OVERSIZE
            except (OSError, ValueError, UnicodeDecodeError):
                read_error = READ_FAILURE
            try:
                os.close(fd)
                close_error = None
            except OSError:
                close_error = READ_FAILURE
            if read_error:
                fail(read_error, "ELOOP" if read_error == NOT_REGULAR else None)
            if close_error:
                fail(close_error)
            ok(payload)
        if op == "persist":
            body = req.get("body")
            data = encode_evidence_body(body, WRITE_FAILURE)
            expect_dev = parse_id(req.get("dev"))
            expect_ino = parse_id(req.get("ino"))
            flags = os.O_WRONLY | os.O_NONBLOCK
            try:
                fd, _parent = open_anchored(path, flags)
            except Exception as exc:
                map_open_error(exc, True)
            write_error = None
            try:
                st = os.fstat(fd)
                if not is_single_regular(st):
                    write_error = "拒绝覆盖非普通文件"
                elif st.st_dev != expect_dev or st.st_ino != expect_ino:
                    write_error = LEASE_LOST
                else:
                    set_blocking(fd)
                    os.ftruncate(fd, 0)
                    write_fully(fd, data)
                    os.fsync(fd)
            except (OSError, UnicodeEncodeError):
                write_error = WRITE_FAILURE
            try:
                os.close(fd)
                close_error = None
            except OSError:
                close_error = WRITE_FAILURE
            if write_error:
                fail(write_error, "ELOOP" if write_error == "拒绝覆盖非普通文件" else None)
            if close_error:
                fail(close_error)
            ok({})
        if op == "lease":
            expect_dev = parse_id(req.get("dev"))
            expect_ino = parse_id(req.get("ino"))
            flags = os.O_RDONLY | os.O_NONBLOCK
            try:
                fd, _parent = open_anchored(path, flags)
            except Exception as exc:
                map_open_error(exc, True)
            lease_error = None
            try:
                st = os.fstat(fd)
                if not is_single_regular(st):
                    lease_error = NOT_REGULAR
                elif st.st_dev != expect_dev or st.st_ino != expect_ino:
                    lease_error = LEASE_LOST
            except OSError:
                lease_error = LEASE_LOST
            try:
                os.close(fd)
                close_error = None
            except OSError:
                close_error = LEASE_LOST
            if lease_error:
                fail(lease_error, "ELOOP" if lease_error == NOT_REGULAR else None)
            if close_error:
                fail(close_error)
            ok({})
    except Exception:
        fail(PATH_ILLEGAL)


if __name__ == "__main__":
    main()
