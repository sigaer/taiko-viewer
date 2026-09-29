#!/usr/bin/env python3
"""Read-only BPF_PROG_QUERY: prove effective cgroup socket filters are attached."""
import ctypes,json,os,platform,sys
assert platform.machine()=='x86_64','BPF syscall number needs review on this architecture'
path=os.path.realpath(sys.argv[1]);assert path.startswith('/sys/fs/cgroup/development.slice/')
class Query(ctypes.Structure):
 _fields_=[('target_fd',ctypes.c_uint32),('attach_type',ctypes.c_uint32),('query_flags',ctypes.c_uint32),('attach_flags',ctypes.c_uint32),('prog_ids',ctypes.c_uint64),('prog_cnt',ctypes.c_uint32)]
fd=os.open(path,os.O_RDONLY);lib=ctypes.CDLL(None,use_errno=True);rows=[]
try:
 for kind in [0,1]:
  ids=(ctypes.c_uint32*16)();q=Query(fd,kind,1,0,ctypes.addressof(ids),16)
  ret=lib.syscall(321,16,ctypes.byref(q),ctypes.sizeof(q))
  assert ret==0 and q.prog_cnt>0, 'Missing effective network BPF filter'
  rows.append({'attachType':kind,'ids':list(ids)[:q.prog_cnt]})
finally:os.close(fd)
print(json.dumps(rows))
