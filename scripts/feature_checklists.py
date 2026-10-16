"""Feature navigation generated from the same reviewed checklist rows.

Every row has exactly one primary feature. Cross-feature parent/dependency links
remain intact; grouping does not change a row's scope or completion status.
"""
from pathlib import Path
import collections
import html
import json
import os
import re


def expand_ids(spec):
    result = []
    for token in spec.split():
        match = re.fullmatch(r"([A-Z])(\d+)(?:-([A-Z])(\d+))?", token)
        assert match, "잘못된 기능 ID 범위: " + token
        prefix, first, other, last = match.groups()
        assert not other or prefix == other, "다른 접두사의 범위: " + token
        assert not last or int(first) <= int(last), "역순 ID 범위: " + token
        result.extend(f"{prefix}{n:0{len(first)}d}" for n in range(int(first), int(last or first) + 1))
    return result


def organize(rows, config):
    assert config["version"] == 1
    groups = config["groups"]
    by_id = {r["id"]: r for r in rows}
    by_key = {g["key"]: g for g in groups}
    assert len(by_key) == len(groups), "중복 기능 키"
    assert len({g["file"] for g in groups}) == len(groups), "중복 기능 문서"
    owners = {}
    for group in groups:
        assert re.fullmatch(r"\d{2}-[a-z0-9-]+\.md", group["file"])
        assert all(key in by_key and key != group["key"] for key in group["related"])
        for item in expand_ids(group["ids"]):
            assert item in by_id, "존재하지 않는 기능 항목: " + item
            assert item not in owners, "기능 중복 배치: " + item
            owners[item] = group["key"]

    def owner(item, visiting=None):
        if item in owners:
            return owners[item]
        visiting = set() if visiting is None else visiting
        assert item not in visiting, "부모 순환: " + item
        visiting.add(item)
        parent = by_id[item]["parent"]
        assert parent, "기능 분류를 추가하세요: " + item
        owners[item] = owner(parent, visiting)
        return owners[item]

    for row in rows:
        owner(row["id"])
    grouped = {g["key"]: [r for r in rows if owners[r["id"]] == g["key"]] for g in groups}
    assert all(grouped.values()), "빈 기능 문서"
    assert sum(map(len, grouped.values())) == len(rows)
    return groups, owners, grouped


def escaped(text):
    return text.replace("|", "\\|").replace("\n", " ").replace("\r", " ")


def local_link(label, target, current):
    relative = Path(os.path.relpath(target, current.parent)).as_posix()
    return f"[{escaped(label)}](<{relative}>)"


def counter_text(rows, field, done, partial, excluded=False):
    values = collections.Counter(r[field] for r in rows)
    if not rows:
        return "— 상세 작업 없음"
    applicable = len(rows) - values["NA"]
    if not applicable:
        return f"해당 없음 {values['NA']}"
    label = "연결" if field == "agent" else "완료"
    text = f"{label} {values[done]}/{applicable} · 부분 {values[partial]}"
    states = {"implementation": [("MISSING", "미구현"), ("STUB", "stub"), ("AUDIT", "재점검")],
              "verification": [("NOT_RUN", "미검증")], "agent": [("NOT_CONNECTED", "미연결")]}
    for status, name in states[field]:
        if values[status]:
            text += f" · {name} {values[status]}"
    if excluded and values["NA"]:
        text += f" · 해당 없음 {values['NA']}"
    return text


def priority_tasks(rows, complete):
    # Explicit follow-ups precede historical baseline tasks; no state is inferred.
    pending = [r for r in rows if r["kind"] == "TASK" and not complete(r)]
    return sorted(pending, key=lambda r: (
        r["implementation"] in {"DONE", "NA"} and r["agent"] in {"CONNECTED", "NA"},
        not r["id"].startswith("N"), r["priority"], r["id"]))[:3]


def next_axis(row):
    if row["implementation"] not in {"DONE", "NA"}:
        return "구현" if row["implementation"] != "AUDIT" else "재점검"
    return "Agent 연결" if row["agent"] not in {"CONNECTED", "NA"} else "검증"


def work_tables(items, limit=8):
    """Keep related parent/child work together; show every row once in small tables."""
    by_id = {row["id"]: row for row in items}
    families = collections.OrderedDict()
    for row in items:
        ancestor = row
        seen = set()
        while ancestor["parent"] in by_id:
            assert ancestor["id"] not in seen, "작업표 부모 순환"
            seen.add(ancestor["id"])
            ancestor = by_id[ancestor["parent"]]
        families.setdefault(ancestor["id"], []).append(row)
    buckets = collections.OrderedDict()
    for root_id, family in families.items():
        root = by_id[root_id]
        if len(family) > 1:
            key, title = root_id, root["task"]
        else:
            kind = "상위 기능 점검" if root["kind"] != "TASK" else "독립 실행 작업"
            key, title = (kind, root["area"]), f"{root['area']} · {kind}"
        buckets.setdefault(key, {"title": title, "rows": []})["rows"].extend(family)
    result = []
    for bucket in buckets.values():
        for start in range(0, len(bucket["rows"]), limit):
            suffix = f" ({start // limit + 1})" if len(bucket["rows"]) > limit else ""
            result.append({"title": bucket["title"] + suffix, "rows": bucket["rows"][start:start + limit]})
    return result


def validate_markdown_tables(content):
    """Reject mismatched columns instead of silently losing GFM table rendering."""
    tables = []
    block = []

    def cells(line):
        return re.split(r"(?<!\\)\|", line.strip()[1:-1])

    def finish():
        if not block:
            return
        assert len(block) >= 2, "표 구분선 없음"
        width = len(cells(block[0]))
        delimiter = cells(block[1])
        assert len(delimiter) == width, "표 제목/구분선 열 수 불일치"
        assert all(re.fullmatch(r"\s*:?-{3,}:?\s*", cell) for cell in delimiter), "잘못된 표 구분선"
        assert all(len(cells(line)) == width for line in block[2:]), "표 본문 열 수 불일치"
        tables.append({"columns": width, "rows": len(block) - 2})
        block.clear()

    for line in content.splitlines():
        if line.startswith("|") and line.endswith("|"):
            block.append(line)
        else:
            finish()
    finish()
    return tables


def feature_outputs(rows, root, labels, kind_names, complete, counts):
    docs = root / "docs"
    config = json.loads((docs / "checklist-features.json").read_text(encoding="utf-8"))
    groups, owners, grouped = organize(rows, config)
    by_key = {g["key"]: g for g in groups}
    paths = {g["key"]: docs / "features" / g["file"] for g in groups}
    overview = docs / "jueony-progress.md"
    outputs = {}

    def task_link(row, current):
        target = paths[owners[row["id"]]]
        href = Path(os.path.relpath(target, current.parent)).as_posix() + "#" + row["id"].lower()
        return f"[{row['id']}](<{href}>)"

    def dashboard(current):
        lines = ["| 기능 | 구현 완료 | 검증 완료 | Agent 연결 | 현재 상황 · 다음 작업 |",
                 "| --- | --- | --- | --- | --- |"]
        for group in groups:
            items = grouped[group["key"]]
            tasks = [r for r in items if r["kind"] == "TASK"]
            scope = tasks or items
            def value(field, done):
                states = collections.Counter(r[field] for r in scope)
                total = len(scope) - states["NA"]
                if not total:
                    return "해당 없음"
                return ("상위 " if not tasks else "") + f"{states[done]}/{total}" + (f" · 부분 {states['PARTIAL']}" if states["PARTIAL"] else "")
            pending = priority_tasks(items, complete)[:1]
            next_work = (f"{next_axis(pending[0])} " + task_link(pending[0], current) + " " + escaped(pending[0]["task"])) if pending else "상세 작업 분해 필요" if not tasks else "기록된 작업 완료"
            if group.get("working"):
                next_work = "**통합 검증 중** · " + next_work
            rollups = [r for r in items if r["kind"] != "TASK"]
            upper = f"<br>상위 완료 {sum(complete(r) for r in rollups)}/{len(rollups)}" if rollups else ""
            lines.append(f"| {local_link(group['title'], paths[group['key']], current)}{upper} | "
                         f"{value('implementation', 'DONE')} | {value('verification', 'DONE')} | "
                         f"{value('agent', 'CONNECTED')} | {next_work} |")
        lines += [f"| **전체 실행 작업** | **{counts['implementation'].get('DONE', 0)}/{counts['taskRows']}** | "
                  f"**{counts['verification'].get('DONE', 0)}/{counts['taskRows']}** | "
                  f"**{counts['agent'].get('CONNECTED', 0)}/{counts['taskRows'] - counts['agent'].get('NA', 0)}** | "
                  f"세 축 완료 **{counts['completedTaskRows']}개** |", "",
                  "숫자는 **완료·연결 / 해당 세부 실행 작업 수**다. ‘상위’는 상세 작업이 아직 없는 영역의 상위 범위 집계다. "
                  "다른 행의 세부 작업 수와 합산하지 않는다. 전체 기능 완성률이 아니며, 한글 직접 비교와 미검증 변경은 완료에 포함하지 않는다.", ""]
        return lines

    text = ["# Jueony 기능별 진행 현황", ""] + dashboard(overview) + [
            f"문서 구성일: {config['organizedDate']}. 진행 상태는 검수한 [CSV](jueony-work-checklist.csv)의 기록을 사용한다. "
            "상태를 바꿀 때 CSV를 수정하고 문서를 다시 생성한다.", "",
            "## 현재 집계", "",
            f"전체 **{len(groups)}개 기능 문서 · {counts['rows']}개 항목**이다. "
            f"집계 대상은 **실행 작업 {counts['taskRows']}개**이며, 상위 기능·상태 범위 "
            f"{counts['rows'] - counts['taskRows']}개는 중복 분모에 넣지 않는다.", "",
            "| 구분 | 완료·연결 | 부분 | 남은 작업 |",
            "| --- | ---: | ---: | --- |",
            f"| 구현 | {counts['implementation'].get('DONE', 0)} | {counts['implementation'].get('PARTIAL', 0)} | "
            f"미구현 {counts['implementation'].get('MISSING', 0)} · 재점검 {counts['implementation'].get('AUDIT', 0)} |",
            f"| 검증 | {counts['verification'].get('DONE', 0)} | {counts['verification'].get('PARTIAL', 0)} | "
            f"미검증 {counts['verification'].get('NOT_RUN', 0)} |",
            f"| Agent 연결 | {counts['agent'].get('CONNECTED', 0)} | {counts['agent'].get('PARTIAL', 0)} | "
            f"미연결 {counts['agent'].get('NOT_CONNECTED', 0)} · 해당 없음 {counts['agent'].get('NA', 0)} |", "",
            f"세 축과 필요한 한글 검증을 모두 충족한 실행 작업: **{counts['completedTaskRows']}개**.", "",
            "완료 표시는 각 항목의 제한된 범위에 적용한다. 자동 검사 통과와 한글 2024 직접 비교는 구분한다. "
            "이 수치는 한글 전체 완성률이 아니다. 한글 2024 직접 비교는 마지막 일괄 검수로 진행한다.", "",
            "## 기능 선택", "",
            "아래에서 기능을 선택한다. 각 기능의 요약표와 상세 문서는 따로 제공한다.", ""]
    for group in groups:
        text.append(f"- [{group['title']}](<#feature-{group['key']}>) · " +
                    local_link("상세 작업표", paths[group["key"]], overview))
    text += ["", "## 기능별 요약표", "",
             "실행 작업과 상위 범위는 별도 집계한다. Agent 분모에서는 해당 없음을 제외한다. "
             "예를 들어 개체의 세부 구현 1/1은 선택 개체 속성 키 하나이며, 개체 전체 완성을 뜻하지 않는다.", ""]
    for group in groups:
        items = grouped[group["key"]]
        tasks = [r for r in items if r["kind"] == "TASK"]
        rollups = [r for r in items if r["kind"] != "TASK"]
        text += [f'<a id="feature-{group["key"]}"></a>', "",
                 f"### {group['title']}", "",
                 local_link("항목별 작업표 열기 →", paths[group["key"]], overview), "",
                 "| 구분 | 실행 작업 | 상위 범위 |", "| --- | --- | --- |"]
        for field, label, done in [("implementation", "구현", "DONE"),
                                   ("verification", "검증", "DONE"), ("agent", "Agent 연결", "CONNECTED")]:
            text.append(f"| {label} | {counter_text(tasks, field, done, 'PARTIAL', True)} | "
                        f"{counter_text(rollups, field, done, 'PARTIAL', True) if rollups else '— 상위 범위 없음'} |")
        text += ["", f"실행 작업 {len(tasks)}개 · 상위 범위 {len(rollups)}개. "
                 f"세 축 완료: 실행 작업 {sum(complete(r) for r in tasks)}개 · 상위 범위 {sum(complete(r) for r in rollups)}개.", ""]
        pending = priority_tasks(items, complete)[:1]
        if pending:
            text += ["**다음 작업:** " + " · ".join(f"{next_axis(r)} — " + task_link(r, overview) + " " + escaped(r["task"]) for r in pending), ""]
        elif not tasks:
            text += ["**다음 작업:** 상위 기능의 상세 실행 작업과 완료조건을 추가한다.", ""]
        if group.get("working"):
            text += ["**통합 검증 중:** " + group["working"], ""]
    text += ["", "## 기록을 갱신하는 방법", "",
             "1. 해당 기능 문서에서 항목 ID와 완료조건을 확인한다.",
             "2. CSV의 구현·검증·Agent 연결과 자동/한글 검증, 근거·다음 작업을 수정한다.",
             "   통합 중 메모는 기능 분류 원본의 `working`에서 관리하고, 완료 기록 반영 시 정리한다.",
             "3. `python scripts/render_work_checklist.py`로 종합·기능별·전체 문서를 함께 생성한다.",
             "4. `python scripts/render_work_checklist.py --check`로 ID 누락·중복 분류·근거·집계·생성 파일 일치를 확인한다.", "",
             "[완료 규칙](97-master-work-checklist.md) · [전체 검색](jueony-work-checklist.html) · "
             "[전체 원문](jueony-work-checklist.md) · [기능 분류 원본](checklist-features.json)", ""]
    outputs[overview] = "\n".join(text)
    readme = root / "README.md"
    start, end = "<!-- jueony-progress:start -->", "<!-- jueony-progress:end -->"
    readme_text = readme.read_text(encoding="utf-8")
    assert readme_text.count(start) == readme_text.count(end) == 1, "README 진행표 경계 확인 필요"
    before, remaining = readme_text.split(start)
    _, after = remaining.split(end)
    outputs[readme] = before + start + "\n\n" + "\n".join(dashboard(readme)) + "\n" + end + after
    directory_index = docs / "features" / "README.md"
    directory_lines = ["# 기능별 작업 문서", "",
                       local_link("종합 진행 현황", overview, directory_index) +
                       "에서 전체 진행을 보고, 아래 기능 문서에서 항목별 상태·완료조건·근거를 확인한다.", ""]
    directory_lines += ["- " + local_link(group["title"], paths[group["key"]], directory_index) for group in groups]
    directory_lines += ["", "상태 원본은 " + local_link("CSV", docs / "jueony-work-checklist.csv", directory_index) +
                        "다. `python scripts/render_work_checklist.py`로 모든 문서를 함께 갱신한다.", ""]
    outputs[directory_index] = "\n".join(directory_lines)

    for group in groups:
        path = paths[group["key"]]
        items = grouped[group["key"]]
        tasks = [r for r in items if r["kind"] == "TASK"]
        rollups = [r for r in items if r["kind"] != "TASK"]
        lines = [f"# {group['title']}", "",
                 local_link("← 종합 진행 현황", overview, path) + " · " +
                 local_link("전체 검색", docs / "jueony-work-checklist.html", path) + " · " +
                 local_link("완료 규칙", docs / "97-master-work-checklist.md", path), "",
                 group["description"], "", "## 진행 요약", "",
                 f"실행 작업 **{len(tasks)}개**, 상위 범위 **{len(items) - len(tasks)}개**. "
                 "CSV의 기록을 기능별로 표시한 문서다.", "",
                 "| 구분 | 실행 작업 | 상위 범위 |", "| --- | --- | --- |"]
        for field, label, done in [("implementation", "구현", "DONE"),
                                   ("verification", "검증", "DONE"), ("agent", "Agent 연결", "CONNECTED")]:
            lines.append(f"| {label} | {counter_text(tasks, field, done, 'PARTIAL', True)} | "
                         f"{counter_text(rollups, field, done, 'PARTIAL', True) if rollups else '— 상위 범위 없음'} |")
        lines += ["",
                 "☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. "
                 "검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.", ""]
        if rollups:
            lines += [f"상위 범위는 세 축 완료 **{sum(complete(r) for r in rollups)}/{len(rollups)}개**다. "
                      "세부 작업 완료 수와 분리해서 읽는다.", ""]
        if not tasks:
            lines += ["이 영역은 상위 기능의 점검 기록만 있다. 상세 실행 작업을 추가하고 완료조건을 확정해야 한다.", ""]
        if group.get("working"):
            lines += ["**현재 통합 중:** " + group["working"], ""]
        pending = priority_tasks(items, complete)
        if pending:
            lines += ["## 먼저 할 일", ""]
            for row in pending:
                lines.append(f"- **{next_axis(row)}** {task_link(row, path)} **{escaped(row['task'])}** — {escaped(row['next_action'])}")
            lines.append("")
        tables = work_tables(items)
        lines += ["## 기능별 작업표", "",
                  "관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. "
                  "ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.", ""]
        lines += [f"- [{table['title']}](<#work-{number}>)" for number, table in enumerate(tables, 1)]
        lines.append("")
        for number, table in enumerate(tables, 1):
            lines += [f'<a id="work-{number}"></a>', "", f"### {table['title']}", "",
                      "| ID | 항목 | 구현 | 검증 | Agent 연결 |",
                      "| --- | --- | --- | --- | --- |"]
            for row in table["rows"]:
                kind = "작업" if row["kind"] == "TASK" else "범위"
                lines.append(f"| {task_link(row, path)} · {kind} | {escaped(row['task'])} | "
                             f"{labels[row['implementation']]} | {labels[row['verification']]} | {labels[row['agent']]} |")
            lines.append("")
        lines += ["## 항목별 완료조건·근거", "", "각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.", ""]
        for row in items:
            lines += [f"<details id=\"{row['id'].lower()}\">",
                      f"<summary>{row['id']} · {html.escape(row['task'])}</summary>", "",
                      f"- 종류: {kind_names[row['kind']]} · 우선순위: {row['priority']}.",
                      f"- 상태: 구현 {labels[row['implementation']]} / 검증 {labels[row['verification']]} / Agent {labels[row['agent']]}.",
                      f"- 검증 구분: 자동 **{row['auto_check']}** / 한글 **{row['hancom_check']}**.",
                      f"- 완료 범위: {escaped(row['scope'])}",
                      f"- 다음 작업: {escaped(row['next_action'])}"]
            if row["parent"]:
                parent = next(r for r in rows if r["id"] == row["parent"])
                lines.append("- 상위 항목: " + task_link(parent, path) + " " + escaped(parent["task"]))
            if row["depends_on"]:
                deps = [next(r for r in rows if r["id"] == item) for item in row["depends_on"].split(";") if item]
                lines.append("- 선행 작업: " + " · ".join(task_link(r, path) for r in deps))
            for field, label in [("ui_command", "UI 명령"), ("agent_command", "Agent 명령")]:
                if row[field]:
                    lines.append(f"- {label}: `{row[field]}`")
            lines.append("- 근거: " + " · ".join(local_link(Path(item.strip()).name, root / item.strip(), path) for item in row["evidence"].split(";")))
            lines += [f"- 원래 기록: `{row['source_status']}`", "", "</details>", ""]
        lines += ["## 함께 보는 기능", ""]
        lines += [f"- {local_link(by_key[key]['title'], paths[key], path)}" for key in group["related"]]
        lines += ["", "이 파일은 자동 생성한다. 상태는 " + local_link("CSV", docs / "jueony-work-checklist.csv", path) +
                  "에서, 기능 배치는 " + local_link("분류 원본", docs / "checklist-features.json", path) + "에서 수정한다.", ""]
        outputs[path] = "\n".join(lines)

    # Persist machine-readable ownership/counts for audits without duplicating CSV state.
    index = {"organizedDate": config["organizedDate"], "rowCount": len(rows),
             "taskCount": counts["taskRows"], "groups": []}
    for group in groups:
        subset = grouped[group["key"]]
        tasks = [r for r in subset if r["kind"] == "TASK"]
        index["groups"].append({"key": group["key"], "title": group["title"], "file": group["file"],
            "ids": [r["id"] for r in subset], "taskCount": len(tasks), "rollupCount": len(subset) - len(tasks),
            "implementation": dict(collections.Counter(r["implementation"] for r in tasks)),
            "verification": dict(collections.Counter(r["verification"] for r in tasks)),
            "agent": dict(collections.Counter(r["agent"] for r in tasks))})
    outputs[docs / "features" / "index.json"] = json.dumps(index, ensure_ascii=False, indent=2) + "\n"
    for path, content in outputs.items():
        if path.suffix == ".md":
            validate_markdown_tables(content)
    return outputs
