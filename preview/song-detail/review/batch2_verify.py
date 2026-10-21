"""One bounded workflow; server/browser processes close before the next stage."""
import argparse,subprocess,sys
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--baseline-source',required=True);args=ap.parse_args()
script=Path(__file__).with_name('batch2.py')
for command in [['before','--source',args.baseline_source],['after','--checks']]:
 subprocess.run([sys.executable,str(script),*command],check=True,timeout=720)
