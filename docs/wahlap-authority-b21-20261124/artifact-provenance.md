# RC artifact provenance and dependency matrix

Core 0.1.4rc2 / Application 0.10.0rc2 / Bot 0.27.0rc9 are local candidates, never published or deployed. [Machine summary](artifact-summary.json) records source commits, hashes and actual resolver results. Full per-source-file manifests, build logs, freeze, pip check and import paths remain in the private durable release archive.

Core starts from v0.1.2 to retain both Center/Client interfaces, then incorporates the five reviewed Batch 2 correctness modules and the explicit Authority input contract. The old center-only 52909ec candidate is preserved. This is a new committed source build, not an overlay used as an installed artifact.

Each unique package was built twice from clean git archive with SOURCE_DATE_EPOCH and PYTHONHASHSEED=0; SHA is byte-identical. Core/Application receive unique new RC2 versions for the final position contract; prior RC1 artifacts are retained. RC1–RC8 and failed logs remain for audit. Final Bot source is recorded in artifact-summary.json.

| Wheel | SHA-256 | Bytes |
|---|---|---:|
| taiko_bot-0.27.0rc9-py3-none-any.whl | 702ee32972e4ea7e7ae20a50832a1e1f0e73b85b5eb7c51defed66fbf9db48ae | 1138583 |
| sakura_taiko_core-0.1.4rc2-py3-none-any.whl | 0515e104332705240f9af8f2866cce47603f5ca055ab00ba3a5e3eea771f0dd5 | 110439 |
| taiko_application-0.10.0rc2-py3-none-any.whl | 2bd584d1d017570b21daa7f158725e1665d0dc8bbf6b35d27cb68067e5b76d19 | 97487 |
| sakura_taiko_contract-0.1.0-py3-none-any.whl | a23e53a86905a300ab35289b359d27a57a6ea069f92016f8185992e9145c1970 | 4822 |
| python_memory_runtime-1.1.0-py3-none-any.whl | 1797622c1c862da88b1cad719943a0ffdd34c5b7fd5a8e04461297bb191d50ab | 9810 |

New Python 3.11 venv uses no system site packages and no editable/source overlay. -I imports resolve under installed-rc9/lib; every Core/Bot/App Python source file matches installed bytes. setuptools 80.9.0 and wheel 0.45.1; external dependency versions are frozen. pip check and center/client/joint dry-run resolver pass. Tests import actual installed hosts; no Bot server or production adapter started.

| Host | Dependency combination | Evidence |
|---|---|---|
| Center | Bot[center] 0.27.0rc9, App 0.10.0rc2, Core[hiroba] 0.1.4rc2 | resolver exit0, actual host bridges |
| Client | Bot[client] 0.27.0rc9, same App/Core | resolver exit0, nine repaired actual host bridges |
| Joint | Bot[center,client], same single Core | resolver exit0 and pip check |
| Viewer child | explicit installed-rc9 Python and request Catalog revision | Python regression, Node bridge and H3 child-env checks |

Pure old compatibility tests remain; actual production runtime stays unchanged until acceptance. Source branches, installed paths and final evidence are separate from deployment claims.
