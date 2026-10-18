"""Installed HWT schema/mapping in-memory bridge for headless read-only verification.
Never persists vendor XML. Only own verifier aggregates hashes/counts.
"""
import importlib.util,json,zlib,sys
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
p=repo/'build/rhwp-engine/source-7c10dba04ed65742/scripts/secd_tail_survey.py';s=importlib.util.spec_from_file_location('cfb_installed95',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
folder=Path('C:/Program Files (x86)/Hnc/Office 2024/HOffice130/Shared/HwpTemplate/XML/ko-KR');rows=[]
for f in sorted(folder.glob('*.hwt')):
 raw=f.read_bytes();c=m.Cfb(raw)
 rows.append({'name':f.name,'schema':zlib.decompress(c.read('Schema'),-15)[4:].decode('utf-16-le'),'mapping':zlib.decompress(c.read('Instance'),-15)[4:].decode('utf-16-le')})
sys.stdout.buffer.write(json.dumps(rows,ensure_ascii=False).encode('utf-8'))
