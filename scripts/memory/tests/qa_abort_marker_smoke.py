"""Intentional owner abort. Expected wrapper exit 125, not a business failure."""
import importlib.util,os,time
from pathlib import Path
spec=importlib.util.spec_from_file_location('qa_vault',Path(__file__).parents[1]/'qa_vault.py');qa=importlib.util.module_from_spec(spec);spec.loader.exec_module(qa)
run=qa.attach_active_run(Path(os.environ['QA_RUN_DIR']))
qa.write_abort_marker(run,'MAINTENANCE_SMOKE')
print('Validated owned abort marker written; supervisor must stop this run.',flush=True)
time.sleep(10)
raise AssertionError('Supervisor did not honor abort marker')
