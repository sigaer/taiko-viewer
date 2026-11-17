"""Capacity, PID reuse, restart and orphan cgroup lease invariants."""
import sys, time, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).parents[1]))
import admission as a

class AdmissionTests(unittest.TestCase):
    def setUp(self):
        self.host=dict(total=32*a.GIB, available=25*a.GIB, psi=0, swap_bps=0,
            parent=0, parent_max=8*a.GIB, qa=0, qa_max=3*a.GIB, build_max=5*a.GIB,
            build_pids=0, annual_pids=0, groups={}, free=40*a.GIB, disk_total=315*a.GIB, cpu_limit=600)
    def request(self, kind='static', worktree='/one'):
        p=a.PROFILES[kind]
        return dict(workload_type=kind, worktree=worktree, slice=p['slice'], memory_budget=p['memory'],
                    cpu_budget=p['cpu'], scratch_budget=p['scratch'], cgroup='/unused', port=None)
    def test_two_static_and_build_fit(self):
        self.assertEqual(a.reasons(self.request('build'), [self.request(),self.request()],self.host),[])
    def test_qa_aggregate_blocks_independent_worktrees(self):
        self.assertTrue(any('QA aggregate' in r for r in a.reasons(self.request('qa'),[self.request('qa','/two')],self.host)))
    def test_parent_budget_not_evaded(self):
        self.assertTrue(any('aggregate' in r for r in a.reasons(self.request('dev'),[self.request('build','/two'),self.request()],self.host)))
    def test_host_pressure_swap_and_disk_reject(self):
        for key,value,reason in [('available',2*a.GIB,'host memory'),('psi',2,'PSI'),('swap_bps',9*1024**2,'swap IO'),('free',5*a.GIB,'disk')]:
            with self.subTest(key=key):
                host={**self.host,key:value}
                self.assertTrue(any(reason in r for r in a.reasons(self.request(),[],host)))
    def test_target_port_and_heavy_build_exclusive(self):
        build=self.request('build')
        self.assertTrue(any('heavy build' in r for r in a.reasons(build,[build],self.host)))
        dev={**self.request('dev'), 'port':4100}
        self.assertTrue(any('port' in r for r in a.reasons(dev,[{**dev,'worktree':'/two'}],self.host)))
    def test_annual_activity_blocks_build(self):
        self.assertIn('Annual worker active',a.reasons(self.request('build'),[],{**self.host,'annual_pids':1}))
    def test_crash_reboot_expiry_and_pid_reuse(self):
        row=dict(boot_id='boot',pid=12,pid_start='start',expiry=200,cgroup='/cg',status='reserved')
        with patch.object(a,'pid_identity',return_value=None),patch.object(a,'populated',return_value=False):
            self.assertEqual(a.reap([row],'boot',100),[])
        with patch.object(a,'pid_identity',return_value='reused'),patch.object(a,'populated',return_value=False):
            self.assertEqual(a.reap([row],'boot',100),[])
        with patch.object(a,'pid_identity',return_value='start'),patch.object(a,'populated',return_value=False):
            self.assertEqual(a.reap([row],'newboot',100),[])
            self.assertEqual(a.reap([row],'boot',201),[])
        with patch.object(a,'pid_identity',return_value=None),patch.object(a,'populated',return_value=True):
            self.assertEqual(a.reap([row],'boot',300)[0]['status'],'orphan-cgroup')

if __name__=='__main__':unittest.main()

class ReclaimableCacheTests(unittest.TestCase):
    setUp = AdmissionTests.setUp
    request = AdmissionTests.request
    def test_idle_cache_is_not_a_permanent_task_lease(self):
        host={**self.host,'parent':2*a.GIB,'qa':a.GIB,'units':[]}
        self.assertEqual(a.reasons(self.request('qa'),[],host),[])
    def test_unknown_live_unit_reserves_its_hard_limit(self):
        host={**self.host,'units':[dict(group='development.slice/development-qa.slice/legacy.service',current=1,maximum=2*a.GIB)]}
        self.assertTrue(any('QA aggregate' in r for r in a.reasons(self.request('qa'),[],host)))

    def test_unknown_cpu_reservation_cannot_be_ignored(self):
        host={**self.host,'units':[dict(group='development.slice/legacy.service',current=1,maximum=a.GIB,cpu_budget=600)]}
        self.assertTrue(any('CPU reservations' in r for r in a.reasons(self.request(),[],host)))
