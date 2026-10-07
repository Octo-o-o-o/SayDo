"""真实临时文件和四个实际读 API 的小 cap 边界测试；非完整准备验收。"""
import importlib.util
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from bounded_read import Budget, ReadRefused

ROOT = Path(__file__).parent


class Spy:
    def __init__(self, stream, requests):
        self.stream, self.requests = stream, requests
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return self.stream.__exit__(*args)
    def fileno(self):
        return self.stream.fileno()
    def read(self, n):
        self.requests.append(n)
        return self.stream.read(n)


class BoundedTests(unittest.TestCase):
    def exercise(self, name, case):
        spec = importlib.util.spec_from_file_location(name, ROOT / name)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix='saydo-bounded-') as tmp:
            p = Path(tmp)/'source';p.write_bytes(b'a'*8)
            calls = []
            def hook(stage, path, stream):
                if stage == 'chunk' and case in {'growth', 'shrink', 'replace'}:
                    if case == 'growth':
                        with path.open('ab') as out: out.write(b'x')
                    elif case == 'shrink':
                        with path.open('r+b') as out: out.truncate(3)
                    else:
                        other = path.with_name('other');other.write_bytes(b'z'*8);os.replace(other,path)
            kwargs = dict(run_id='owned-small-cap',deadline=time.monotonic()+5,
                          file_cap=8,total_cap=32,origin_cap=2,chunk_size=8,
                          opener=lambda path: Spy(path.open('rb',buffering=0),calls),hook=hook)
            if case=='empty':p.write_bytes(b'')
            if case=='file-over':p.write_bytes(b'a'*9)
            if case=='total-over':kwargs['total_cap']=7
            if case=='no-balance':kwargs.update(total_cap=8,used=8)
            if case=='expired':kwargs['deadline']=time.monotonic()-1
            if case=='origin-cap':kwargs.update(origin_cap=1,origins={(0,0)})
            budget=Budget(**kwargs);module.configure(budget)
            if case in {'file-over','total-over','no-balance','expired','origin-cap','unknown'}:
                with self.assertRaises(ReadRefused):module.read(p,channel='native' if case=='unknown' else 'direct-fs')
                self.assertEqual(calls,[]);self.assertEqual(budget.used,kwargs.get('used',0));return
            if case in {'growth','shrink','replace'}:
                with self.assertRaises(ReadRefused):module.read(p)
                self.assertEqual(calls,[8]);self.assertEqual(budget.used,8)
                self.assertEqual(sum(e['bytes'] for e in budget.events),8)
                self.assertEqual(budget.events[-1]['status'],'REFUSED');return
            result=module.read(p);raw=result[0] if isinstance(result,tuple) else result
            self.assertEqual(raw,p.read_bytes());self.assertEqual(budget.used,len(raw))
            self.assertEqual(len(budget.origins),1)
            if case=='empty':self.assertEqual(calls,[])
            if case=='same-version':
                module.read(p);self.assertEqual(budget.used,16);self.assertEqual(len(budget.origins),1)
            if case=='new-version':
                p.write_bytes(b'b'*8);module.read(p);self.assertEqual(budget.used,16)
                self.assertNotEqual(budget.events[0]['sha256'],budget.events[1]['sha256'])
                self.assertEqual(len(budget.origins),1)
            if case=='alias':
                alias=p.with_name('alias');os.link(p,alias);module.read(alias)
                self.assertEqual(budget.used,16);self.assertEqual(len(budget.origins),1)
            if case=='symlink-alias':
                alias=p.with_name('alias');alias.symlink_to(p);module.read(alias)
                self.assertEqual(budget.used,16);self.assertEqual(len(budget.origins),1)
            if case=='rebind':
                with self.assertRaisesRegex(RuntimeError,'TRIAL_REBIND_REFUSED'):module.configure(Budget(**kwargs))

    def test_all_actual_wrappers(self):
        for name in ['precheck.py','collect-prepare.py','finalize.py','check-and-record.py']:
            for case in ['stable','empty','same-version','new-version','alias','symlink-alias','growth','shrink','replace','file-over','total-over','no-balance','expired','origin-cap','unknown','rebind']:
                with self.subTest(wrapper=name,case=case):self.exercise(name,case)

    def test_invalid_nonfinite_and_noninteger_budget_is_rejected(self):
        for changes in [{'deadline':float('nan')},{'deadline':float('inf')},{'file_cap':float('inf')},{'total_cap':True},{'used':-1},{'chunk_size':0}]:
            args=dict(run_id='invalid',deadline=time.monotonic()+1,file_cap=8,total_cap=16,origin_cap=1)
            args.update(changes)
            with self.subTest(changes=changes),self.assertRaises(ValueError):Budget(**args)

    def test_wall_expiry_after_last_chunk_is_not_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input';p.write_bytes(b'a'*8);now=[0]
            def hook(stage,path,stream):
                if stage=='chunk':now[0]=2
            b=Budget(run_id='wall',deadline=1,file_cap=8,total_cap=8,origin_cap=1,clock=lambda:now[0],hook=hook)
            with self.assertRaisesRegex(ReadRefused,'WALL_CAP'):b.read(p,'last')
            self.assertEqual(b.used,8);self.assertEqual(b.events[0]['bytes'],8)

    def test_midstream_growth_never_requests_next_chunk(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input';p.write_bytes(b'a'*8);calls=[]
            def hook(stage,path,stream):
                if stage=='chunk':
                    with path.open('ab') as f:f.write(b'x')
            b=Budget(run_id='mid',deadline=time.monotonic()+5,file_cap=8,total_cap=16,origin_cap=1,chunk_size=3,hook=hook,opener=lambda p:Spy(p.open('rb',buffering=0),calls))
            with self.assertRaisesRegex(ReadRefused,'INPUT_DRIFT_BEFORE_CHUNK'):b.read(p,'middle')
            self.assertEqual(calls,[3]);self.assertEqual(b.used,3)

    def test_all_wrappers_share_trial_and_exact_cumulative_ceiling(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input';p.write_bytes(b'a'*8)
            b=Budget(run_id='shared',deadline=time.monotonic()+5,file_cap=8,total_cap=16,origin_cap=2)
            modules=[]
            for name in ['precheck.py','collect-prepare.py','finalize.py','check-and-record.py']:
                spec=importlib.util.spec_from_file_location(name,ROOT/name);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.configure(b);modules.append(m)
            modules[0].read(p);modules[1].read(p)
            for m in modules[2:]:
                with self.assertRaisesRegex(ReadRefused,'CUMULATIVE_CAP'):m.read(p)
            self.assertEqual(b.used,16);self.assertEqual(len(b.origins),1)

    def test_full_origin_budget_refuses_even_known_path_before_open(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input';p.write_bytes(b'a'*8);opens=[]
            def opener(path):
                opens.append(str(path))
                if len(opens)>1:
                    q=path.with_name('new');q.write_bytes(b'b'*8);os.replace(q,path)
                return path.open('rb',buffering=0)
            b=Budget(run_id='origin',deadline=time.monotonic()+5,file_cap=8,total_cap=32,origin_cap=1,opener=opener)
            b.read(p,'first')
            with self.assertRaisesRegex(ReadRefused,'ORIGIN_RESERVATION_BEFORE_OPEN'):b.read(p,'second')
            self.assertEqual(len(opens),1);self.assertEqual(len(b.origins),1);self.assertEqual(b.used,8)
            self.assertEqual(p.read_bytes(),b'a'*8)

    def test_open_identity_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input';p.write_bytes(b'a'*8)
            def opener(path):
                q=path.with_name('new');q.write_bytes(b'b'*8);os.replace(q,path)
                return path.open('rb',buffering=0)
            b=Budget(run_id='drift',deadline=time.monotonic()+5,file_cap=8,total_cap=16,origin_cap=2,opener=opener)
            with self.assertRaisesRegex(ReadRefused,'OPEN_IDENTITY_DRIFT'):b.read(p,'open')
            self.assertEqual(b.used,0);self.assertEqual(len(b.origins),1)
            self.assertEqual(b.events[0]['bytes'],0)

    def test_sink_failure_keeps_actual_charge(self):
        class BadSink:
            def write(self,chunk):raise OSError('owned-sink-failure')
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input';p.write_bytes(b'a'*8)
            b=Budget(run_id='sink',deadline=time.monotonic()+5,file_cap=8,total_cap=16,origin_cap=2)
            with self.assertRaises(OSError):b.read(p,'sink',sink=BadSink())
            self.assertEqual(b.used,8);self.assertEqual(b.events[0]['bytes'],8)

    def test_short_read_keeps_charge(self):
        class Short(Spy):
            def read(self,n):
                if self.requests:return b''
                self.requests.append(n);return self.stream.read(3)
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input';p.write_bytes(b'a'*8)
            b=Budget(run_id='short',deadline=time.monotonic()+5,file_cap=8,total_cap=16,origin_cap=2,opener=lambda p:Short(p.open('rb',buffering=0),[]))
            with self.assertRaisesRegex(ReadRefused,'SHORT_READ'):b.read(p,'short')
            self.assertEqual(b.used,3);self.assertEqual(b.events[0]['bytes'],3)

    def test_whole_trial_balance_and_origins(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input';p.write_bytes(b'a'*8);q=p.with_name('second');q.write_bytes(b'b')
            b=Budget(run_id='exact',deadline=time.monotonic()+5,file_cap=8,total_cap=8,origin_cap=1)
            b.read(p,'first')
            with self.assertRaises(ReadRefused):b.read(p,'same')
            with self.assertRaises(ReadRefused):b.read(q,'other')
            self.assertEqual(b.used,8)

    def test_first_fstat_failure_reserves_origin_in_every_role(self):
        for name in ['precheck.py','collect-prepare.py','finalize.py','check-and-record.py']:
            with self.subTest(role=name), tempfile.TemporaryDirectory() as tmp:
                a=Path(tmp)/'a';z=Path(tmp)/'z';a.write_bytes(b'a');z.write_bytes(b'z');opens=[]
                def opener(path):opens.append(path);return path.open('rb',buffering=0)
                b=Budget(run_id='fstat',deadline=time.monotonic()+5,file_cap=8,total_cap=16,origin_cap=1,opener=opener)
                spec=importlib.util.spec_from_file_location(name,ROOT/name);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.configure(b)
                with patch('bounded_read.os.fstat',side_effect=OSError('first-fstat-EIO')):
                    with self.assertRaisesRegex(OSError,'EIO'):m.read(a)
                    with self.assertRaisesRegex(ReadRefused,'ORIGIN'):m.read(z)
                self.assertEqual(len(opens),1);self.assertEqual(len(b.origins),1);self.assertEqual(b.used,0)
                self.assertFalse(b.owned_handles);self.assertTrue(b.events[0]['fdClosed']);self.assertNotIn('originReservationResolved',b.events[0])

    def test_close_failure_retains_safe_stream_and_original_read_error_all_roles(self):
        class BadClose(Spy):
            def __exit__(self,*args):raise OSError('owned-exit-EIO')
        for name in ['precheck.py','collect-prepare.py','finalize.py','check-and-record.py']:
            for read_failure in [False,True]:
                with self.subTest(role=name,read_failure=read_failure), tempfile.TemporaryDirectory() as tmp:
                    p=Path(tmp)/'input';p.write_bytes(b'ab');held=[]
                    def opener(path):s=BadClose(path.open('rb',buffering=0),[]);held.append(s);return s
                    def hook(stage,path,stream):
                        if read_failure and stage=='chunk':raise RuntimeError('original-read-error')
                    b=Budget(run_id='cleanup',deadline=time.monotonic()+5,file_cap=8,total_cap=16,origin_cap=1,opener=opener,hook=hook)
                    spec=importlib.util.spec_from_file_location(name,ROOT/name);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.configure(b)
                    try:
                        with self.assertRaisesRegex(OSError,'owned-exit-EIO') as caught:m.read(p)
                        e=caught.exception;event=b.events[0];self.assertEqual(b.used,2);self.assertEqual(event['bytes'],2)
                        self.assertEqual(event['status'],'REFUSED_CLEANUP_UNKNOWN');self.assertEqual(event['fdClosed'],'UNKNOWN')
                        self.assertIs(e.ownedStream,held[0]);self.assertIs(b.owned_handles[e.ownershipToken]['stream'],held[0]);os.fstat(e.ownedFd)
                        self.assertEqual(e.originalReadError is not None,read_failure)
                        if read_failure:self.assertIn('original-read-error',event['reason'])
                        with self.assertRaisesRegex(ReadRefused,'NOT_PROVEN_CLOSED'):b.release_closed(e.ownershipToken)
                        held[0].stream.close();b.release_closed(e.ownershipToken)
                        self.assertFalse(b.owned_handles);self.assertEqual(event['fdClosed'],'UNKNOWN');self.assertTrue(event['fdClosedAtRecovery'])
                    finally:held[0].stream.close()

    def test_close_error_after_actual_release_never_closes_reused_bare_fd(self):
        class AlreadyClosed(Spy):
            def __exit__(self,*args):self.stream.close();raise OSError('closed-then-EIO')
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input';p.write_bytes(b'ab')
            b=Budget(run_id='closed',deadline=time.monotonic()+5,file_cap=8,total_cap=16,origin_cap=1,opener=lambda p:AlreadyClosed(p.open('rb',buffering=0),[]))
            with self.assertRaisesRegex(OSError,'closed-then-EIO') as caught:b.read(p,'close')
            e=caught.exception
            with p.open('rb',buffering=0) as unrelated:
                self.assertEqual(unrelated.fileno(),e.ownedFd)
                self.assertTrue(e.ownedStream.stream.closed)
                b.release_closed(e.ownershipToken)
                os.fstat(unrelated.fileno());self.assertEqual(unrelated.read(),b'ab');self.assertFalse(b.owned_handles)


if __name__ == '__main__':unittest.main(verbosity=2)
