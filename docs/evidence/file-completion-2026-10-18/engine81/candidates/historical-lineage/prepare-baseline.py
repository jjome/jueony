from pathlib import Path
import shutil

work = Path(__file__).resolve().parent
candidate = work/'source-candidate80'
base = work/'source-baseline80'
if base.exists():
    raise SystemExit('baseline already exists')
shutil.copytree(candidate, base)
formal=work.parents[1]/'build/rhwp-engine/source-20fddc2d172763e6'
rel=Path('src/document_core/converters/hwpx_to_hwp.rs')
shutil.copy2(formal/rel,base/rel)
print(base)
