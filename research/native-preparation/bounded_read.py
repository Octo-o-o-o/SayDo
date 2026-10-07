"""直接读通道的有界工具。未观测 OS/native/mmap/heap；本工具不授予 build 准入。"""
from pathlib import Path
import hashlib
import math
import os
import stat
import time


class ReadRefused(RuntimeError):
    """拒绝保留实际已读账，不倒扣。"""


def version(s):
    return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns,
            stat.S_IMODE(s.st_mode))


class Budget:
    """每个 trial 共享一个显式 deadline/余额，恢复不得重置旧时钟。"""

    def __init__(self, *, run_id, deadline, file_cap, total_cap, origin_cap,
                 used=0, origins=(), events=None, chunk_size=1048576,
                 clock=time.monotonic, opener=None, hook=None):
        limits = (file_cap, total_cap, origin_cap, chunk_size)
        if (not run_id or any(type(n) is not int or n <= 0 for n in limits)
                or not isinstance(deadline, (int, float)) or not math.isfinite(deadline)):
            raise ValueError('INVALID_BUDGET')
        if type(used) is not int or used < 0 or used > total_cap:
            raise ValueError('INVALID_INITIAL_USAGE')
        self.run_id, self.deadline = run_id, deadline
        self.file_cap, self.total_cap, self.origin_cap = file_cap, total_cap, origin_cap
        self.used, self.origins = used, set(origins)
        self.events = events if events is not None else []
        self.owned_handles = {}
        self.chunk_size, self.clock = chunk_size, clock
        self.opener = opener or (lambda p: p.open('rb', buffering=0))
        self.hook = hook or (lambda stage, path, stream: None)

    @staticmethod
    def _handle_closed(stream):
        if getattr(stream, 'closed', False) is True:
            return True
        try:
            stream.fileno()
        except ValueError:
            return True
        return False

    def release_closed(self, ownership):
        """只确认仍持有对象已关闭；不执行close，不碰可能被复用的裸FD。"""
        held = self.owned_handles[ownership]
        if not self._handle_closed(held['stream']):
            raise ReadRefused('OWNED_HANDLE_NOT_PROVEN_CLOSED')
        held['event'].update(cleanupRecovered=True, fdClosedAtRecovery=True, ownedFd=None)
        self.owned_handles.pop(ownership)

    def _guard(self, n, key, count):
        if self.clock() >= self.deadline:
            raise ReadRefused('WALL_CAP_BEFORE_READ')
        if count + n > self.file_cap:
            raise ReadRefused('FILE_CAP_BEFORE_READ')
        if self.used + n > self.total_cap:
            raise ReadRefused('CUMULATIVE_CAP_BEFORE_READ')
        if key not in self.origins and len(self.origins) >= self.origin_cap:
            raise ReadRefused('ORIGIN_CAP_BEFORE_OPEN')

    def read(self, path, phase, *, sink=None, channel='direct-fs'):
        if channel != 'direct-fs':
            raise ReadRefused('UNKNOWN_CHANNEL')
        p = Path(path)
        before = p.stat()
        if not stat.S_ISREG(before.st_mode):
            raise ReadRefused('NON_REGULAR_FILE')
        canonical = str(p.resolve(strict=True))
        key = (before.st_dev, before.st_ino)
        self._guard(before.st_size, key, 0)
        # 路径 stat 不能排除 open 前替换；每次新 open 都保守预留一个名额。
        # 名额已满时即使 stat 指向已见 inode 也拒绝，不能赌 FD 身份不变。
        if len(self.origins) >= self.origin_cap:
            raise ReadRefused('ORIGIN_RESERVATION_BEFORE_OPEN')
        digest, count = hashlib.sha256(), 0
        data = bytearray() if sink is None else None
        event = {'path': str(p), 'canonicalPath': canonical, 'aliases': sorted({str(p), canonical}),
                 'device': key[0], 'inode': key[1], 'versionBefore': list(version(before)),
                 'runId': self.run_id, 'phase': phase, 'channel': channel,
                 'bytes': 0, 'chunks': [], 'status': 'OPENING'}
        self.events.append(event)
        # 未知origin名额不因首次fstat或opener异常免费。确认真实身份后才安全合并。
        reservation = ('UNKNOWN_OPEN', self.run_id, len(self.events))
        while reservation in self.origins:
            reservation += ('next',)
        self.origins.add(reservation)
        event['originReservation'] = list(reservation)
        ownership = f'{self.run_id}:open:{len(self.events)}'
        manager = stream = None
        read_error = None
        try:
            manager = self.opener(p)
            self.owned_handles[ownership] = {'manager': manager, 'stream': manager, 'event': event}
            event.update(ownershipToken=ownership, fdClosed='UNKNOWN')
            stream = manager.__enter__()
            self.owned_handles[ownership]['stream'] = stream
            fd = stream.fileno()
            event.update(openedFd=fd, ownedFd=fd)
            initial = os.fstat(fd)
            actual_key = (initial.st_dev, initial.st_ino)
            self.origins.remove(reservation)
            self.origins.add(actual_key)
            event['originReservationResolved'] = True
            event['openedDevice'], event['openedInode'] = actual_key
            self.hook('opened', p, stream)
            if version(initial) != version(before):
                raise ReadRefused('OPEN_IDENTITY_DRIFT')
            while count < before.st_size:
                if version(os.fstat(stream.fileno())) != version(before):
                    raise ReadRefused('INPUT_DRIFT_BEFORE_CHUNK')
                n = min(self.chunk_size, before.st_size - count)
                self._guard(n, key, count)
                chunk = stream.read(n)
                # 首先记实际 bytes；sink/漂移拒绝不得抹去已发生读取。
                self.used += len(chunk)
                count += len(chunk)
                digest.update(chunk)
                event['bytes'], event['sha256'] = count, digest.hexdigest()
                event['chunks'].append({'bytes': len(chunk), 'requested': n,
                                        'trialBytesAfter': self.used})
                if len(chunk) > n:
                    raise ReadRefused('INVALID_READER_OVERSUPPLY')
                if not chunk:
                    raise ReadRefused('SHORT_READ')
                if sink is None:
                    data.extend(chunk)
                else:
                    sink.write(chunk)
                self.hook('chunk', p, stream)
            # 到 cap/预期 EOF 后只复核元数据；绝不为了漂移探测额外 read(1)。
            after_fd = os.fstat(stream.fileno())
            event['versionAfterFd'] = list(version(after_fd))
            after = p.stat()
            event['versionAfter'] = list(version(after))
            if (count != before.st_size or version(after_fd) != version(before)
                    or version(after) != version(before)
                    or str(p.resolve(strict=True)) != canonical):
                raise ReadRefused('INPUT_DRIFT_AFTER_READ')
            self._guard(0, key, count)
            event['sha256'], event['status'] = digest.hexdigest(), 'BOUND_IDENTITY_ONLY'
            return (bytes(data) if data is not None else None), event
        except BaseException as error:
            read_error = error
            event.update(status='REFUSED', reason=type(error).__name__ + ':' + str(error),
                         bytes=count, sha256=digest.hexdigest())
            raise
        finally:
            if manager is not None:
                try:
                    # 只调用仍持有的manager，不用裸FD重关；不接受__exit__吞掉读异常。
                    manager.__exit__(type(read_error) if read_error else None,
                                     read_error, read_error.__traceback__ if read_error else None)
                    held = stream if stream is not None else manager
                    closed = self._handle_closed(held)
                    if not closed:
                        raise ReadRefused('CLOSE_RETURNED_WITHOUT_RELEASE_PROOF')
                    event.update(fdClosed=True, ownedFd=None)
                    self.owned_handles.pop(ownership, None)
                except BaseException as cleanup_error:
                    event.update(dataBindingStatus=event['status'], status='REFUSED_CLEANUP_UNKNOWN',
                                 fdClosed='UNKNOWN', cleanupReason=type(cleanup_error).__name__ + ':' + str(cleanup_error))
                    # 原强引用stream/manager保持于budget和异常，恢复须核对象closed状态。
                    cleanup_error.ownedStream = stream if stream is not None else manager
                    cleanup_error.ownedManager = manager
                    cleanup_error.ownedFd = event.get('ownedFd')
                    cleanup_error.ownershipToken = ownership
                    cleanup_error.readEvent = event
                    cleanup_error.originalReadError = read_error
                    raise cleanup_error from read_error
