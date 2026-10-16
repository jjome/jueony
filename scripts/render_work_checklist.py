"""Render the reviewed CSV without inferring or changing implementation status."""
from pathlib import Path
import argparse
import collections
import csv
import html
import json

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SOURCE = DOCS / "jueony-work-checklist.csv"
LABELS = {"DONE": "☑ 완료", "PARTIAL": "◐ 부분", "MISSING": "☐ 미구현",
          "STUB": "☐ stub", "AUDIT": "? 재점검", "NOT_RUN": "☐ 미검증",
          "CONNECTED": "☑ 연결", "NOT_CONNECTED": "☐ 미연결", "NA": "— 해당 없음"}
KINDS = {"ROLLUP": "한글 상위 기능", "STATE_ROLLUP": "상태 수명 상위 항목", "TASK": "실행 작업"}


def complete(row):
    return (row["implementation"] in {"DONE", "NA"}
            and row["verification"] in {"DONE", "NA"}
            and row["agent"] in {"CONNECTED", "NA"}
            and row["hancom_check"] in {"DONE", "NA"})


def load():
    with SOURCE.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    ids = {row["id"] for row in rows}
    assert len(ids) == len(rows), "중복 ID"
    for row in rows:
        assert row["kind"] in KINDS
        assert row["implementation"] in {"DONE", "PARTIAL", "MISSING", "STUB", "AUDIT", "NA"}
        assert row["verification"] in {"DONE", "PARTIAL", "NOT_RUN", "NA"}
        assert row["agent"] in {"CONNECTED", "PARTIAL", "NOT_CONNECTED", "NA"}
        assert row["auto_check"] in {"PASS", "PARTIAL", "NOT_RUN", "NA"}
        assert row["hancom_check"] in {"DONE", "PARTIAL", "NOT_RUN", "NA"}
        assert row["priority"] in {"P0", "P1", "P2", "P3"}
        assert not row["parent"] or row["parent"] in ids, row["id"] + " parent"
        for dep in filter(None, row["depends_on"].split(";")):
            assert dep in ids, row["id"] + " dependency"
        for evidence in row["evidence"].split(";"):
            assert (ROOT / evidence.strip()).is_file(), row["id"] + " evidence: " + evidence
        if row["implementation"] == "DONE":
            assert row["evidence"] and row["scope"], row["id"] + " 완료 근거/범위"
        if row["verification"] == "DONE":
            assert row["auto_check"] == "PASS" and row["hancom_check"] in {"DONE", "NA"}
    return rows


def stats(rows):
    tasks = [r for r in rows if r["kind"] == "TASK"]
    return {"baselineDate": "2026-10-15", "rows": len(rows), "taskRows": len(tasks),
            "kinds": dict(collections.Counter(r["kind"] for r in rows)),
            "implementation": dict(collections.Counter(r["implementation"] for r in tasks)),
            "verification": dict(collections.Counter(r["verification"] for r in tasks)),
            "agent": dict(collections.Counter(r["agent"] for r in tasks)),
            "completedTaskRows": sum(complete(r) for r in tasks),
            "productCompletionPercent": None,
            "note": "상위 항목·세부 작업은 중복 집계하지 않는다. 한글 전체 기능/동등성의 진행률이 아니다."}


def markdown(rows, counts):
    text = ["# Jueony 전체 작업 체크리스트", "",
            "먼저 [기능별 종합 진행 현황](jueony-progress.md)에서 영역을 선택한다. 각 기능의 상세 문서로 연결된다.", "",
            "기준일: 2026-10-15. 원본은 [CSV](jueony-work-checklist.csv), 사용 규칙은 "
            "[97번 문서](97-master-work-checklist.md), 검색 화면은 [HTML](jueony-work-checklist.html)이다.", "",
            f"총 {counts['rows']}행: 실행 작업 {counts['taskRows']}행과 상위 범위 항목 "
            f"{counts['rows'] - counts['taskRows']}행. 범위가 겹치므로 전체 완성률로 나누지 않는다.", "",
            "☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증은 자동 검사와 "
            "한글 직접 비교를 구분한다. 각 완료 표시는 해당 행의 제한된 완료조건에만 적용한다.", ""]
    groups = collections.defaultdict(list)
    for row in rows:
        groups[(row["kind"], row["area"])].append(row)
    escape = lambda value: value.replace("|", "\\|").replace("\n", " ").replace("\r", " ")
    for (kind, area), group in groups.items():
        text += [f"## {area} — {KINDS[kind]}", "",
                 "| ID | 작업·완료조건 | 구현 | 검증 | Agent 연결 | 다음 작업·근거 |",
                 "| --- | --- | --- | --- | --- | --- |"]
        for r in group:
            evidence = " · ".join(f"[{Path(p.strip()).name}](../{p.strip()})" for p in r["evidence"].split(";"))
            v = LABELS[r["verification"]] + f"<br>자동:{r['auto_check']} / 한글:{r['hancom_check']}"
            command = f"<br>`{r['agent_command']}`" if r["agent_command"] else ""
            text.append(f"| {r['id']} {r['priority']} | **{escape(r['task'])}**<br>{escape(r['scope'])} "
                        f"| {LABELS[r['implementation']]} | {v} | {LABELS[r['agent']]}{command} "
                        f"| {escape(r['next_action'])}<br>{evidence} |")
        text.append("")
    return "\n".join(text).rstrip() + "\n"


def page(rows, counts):
    data = json.dumps(rows, ensure_ascii=False).replace("<", "\\u003c")
    labels = json.dumps(LABELS, ensure_ascii=False)
    return """<!doctype html><html lang="ko"><meta charset="utf-8"><title>Jueony 작업 체크리스트</title>
<style>body{font:15px/1.6 system-ui,sans-serif;margin:24px;color:#172b3d}h1{margin:0}p{max-width:1000px}
header{position:sticky;top:0;background:#fff;padding:10px 0;border-bottom:2px solid #ccd9e4;z-index:1}
input,select{font:inherit;padding:8px;border:1px solid #a9bacb;border-radius:5px;margin-right:6px}input{width:330px}
table{border-collapse:collapse;width:100%;margin-top:16px}td,th{padding:10px;text-align:left;border-bottom:1px solid #dde5ee;vertical-align:top}
th{background:#edf3f8}td:nth-child(1){white-space:nowrap}small{color:#53697b}.done{background:#eef8ef}a{color:#12649e}
details p{margin:4px 0}.status{min-width:115px}#count{margin-left:8px;font-weight:600}</style>
<header><h1>Jueony 구현 · 검증 · Agent 연결</h1><p><a href="jueony-progress.md">기능별 종합 진행 현황</a> · 2026-10-15 기준. CSV가 원본이며 이 화면은 검색용입니다.
상위 메뉴 연결을 완료로 계산하지 않습니다. 자동 검사 통과와 한글 직접 비교는 별개입니다.
<a href="97-master-work-checklist.md">사용 규칙</a> · <a href="jueony-work-checklist.csv">CSV</a></p>
<input id="query" aria-label="검색" placeholder="작업명·ID·명령·남은 제한 검색">
<select id="kind" aria-label="작업 종류"><option value="all">전체 범위</option><option value="TASK">실행 작업</option><option value="ROLLUP">한글 상위 기능</option><option value="STATE_ROLLUP">상태 수명</option></select>
<select id="mode" aria-label="상태 필터"><option value="all">모든 상태</option><option value="remaining">세 축 미완료</option><option value="implementation">남은 구현</option><option value="verification">남은 검증</option><option value="agent">남은 Agent 연결</option><option value="complete">세 축 완료</option></select>
<select id="area" aria-label="영역 필터"><option value="">모든 영역</option></select><span id="count"></span></header>
<table><thead><tr><th>ID</th><th>작업·완료조건</th><th>구현</th><th>검증</th><th>Agent 연결</th></tr></thead><tbody id="rows"></tbody></table>
<script>const data=DATA,labels=LABELS;const el=id=>document.getElementById(id);
const done=r=>['DONE','NA'].includes(r.implementation)&&['DONE','NA'].includes(r.verification)&&['CONNECTED','NA'].includes(r.agent)&&['DONE','NA'].includes(r.hancom_check);
for(const a of [...new Set(data.map(r=>r.area))])el('area').add(new Option(a,a));
const e=(tag,value,parent)=>{const n=document.createElement(tag);n.textContent=value;parent.append(n);return n;};
function render(){const q=el('query').value.toLowerCase(),mode=el('mode').value,kind=el('kind').value,area=el('area').value;
const selected=data.filter(r=>(kind==='all'||r.kind===kind)&&(!area||r.area===area)&&JSON.stringify(r).toLowerCase().includes(q)&&
(mode==='all'||mode==='remaining'&&!done(r)||mode==='complete'&&done(r)||mode==='implementation'&&!['DONE','NA'].includes(r.implementation)||mode==='verification'&&!['DONE','NA'].includes(r.verification)||mode==='agent'&&!['CONNECTED','NA'].includes(r.agent)));
el('count').textContent=`표시 ${selected.length} / 전체 ${data.length}행`;el('rows').replaceChildren();
for(const r of selected){const tr=e('tr','',el('rows'));if(done(r))tr.className='done';e('td',r.id+' · '+r.priority,tr);
const t=e('td','',tr);e('strong',r.task,t);e('p',r.scope,t);const details=e('details','',t);e('summary','다음 작업·근거·원래 상태',details);
e('p',r.next_action,details);if(r.ui_command)e('p','수동 UI 명령: '+r.ui_command,details);e('small',r.source_status,details);for(const path of r.evidence.split(';')){const p=e('p','',details),a=e('a',path.trim(),p);a.href='../'+path.trim();}
e('td',labels[r.implementation],tr).className='status';const v=e('td',labels[r.verification],tr);v.className='status';e('p','자동: '+r.auto_check,v);e('p','한글: '+r.hancom_check,v);
const a=e('td',labels[r.agent],tr);a.className='status';if(r.agent_command)e('small',r.agent_command,a);}}
for(const id of ['query','kind','mode','area'])el(id).addEventListener('input',render);render();</script></html>""".replace("DATA", data).replace("LABELS", labels)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rows = load()
    counts = stats(rows)
    outputs = {DOCS / "jueony-work-checklist.md": markdown(rows, counts),
               DOCS / "jueony-work-checklist.html": page(rows, counts),
               DOCS / "evidence/master-checklist-2026-10-15/counts.json": json.dumps(counts, ensure_ascii=False, indent=2) + "\n"}
    from feature_checklists import feature_outputs
    outputs.update(feature_outputs(rows, ROOT, LABELS, KINDS, complete, counts))
    for path, content in outputs.items():
        if args.check:
            assert path.read_text(encoding="utf-8") == content, "CSV와 표시 파일 불일치: " + str(path)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content.encode("utf-8"))
    print(json.dumps(counts, ensure_ascii=False))


if __name__ == "__main__":
    main()
