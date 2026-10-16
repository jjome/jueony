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

    text = ["# Jueony 기능별 진행 현황", "",
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
            "## 기능별 문서", "",
            "숫자는 `완료 또는 연결 / 해당 실행 작업`이다. Agent 분모는 해당 없음 항목을 제외한다. "
            "기능명 아래의 상위 완료는 필요한 검증까지 끝난 상위 범위의 수다. "
            "예를 들어 개체의 세부 구현 1/1은 선택 개체 속성 키 하나의 범위이며, 개체 전체 구현률이 아니다.", "",
            "| 기능 문서·상위 완료 | 실행 작업 / 상위 범위 | 세부 구현 | 세부 검증 | 세부 Agent 연결 |",
            "| --- | --- | --- | --- | --- | --- |"]
    for group in groups:
        items = grouped[group["key"]]
        tasks = [r for r in items if r["kind"] == "TASK"]
        rollups = [r for r in items if r["kind"] != "TASK"]
        upper = f"<br>상위 완료 {sum(complete(r) for r in rollups)}/{len(rollups)}" if rollups else ""
        text.append(f"| {local_link(group['title'], paths[group['key']], overview)}{upper} | "
                    f"{len(tasks)} / {len(items) - len(tasks)} | "
                    f"{counter_text(tasks, 'implementation', 'DONE', 'PARTIAL')} | "
                    f"{counter_text(tasks, 'verification', 'DONE', 'PARTIAL')} | "
                    f"{counter_text(tasks, 'agent', 'CONNECTED', 'PARTIAL')} |")
    text += ["", "## 다음 우선 작업", "",
             "각 영역의 명시적인 후속 작업을 먼저 표시한다. 연결을 누르면 해당 항목의 범위·실제 상태·근거로 이동한다.", ""]
    for group in groups:
        pending = priority_tasks(grouped[group["key"]], complete)[:1]
        if pending:
            text.append(f"- **{group['title']}**: " + " · ".join(f"{next_axis(r)} — " + task_link(r, overview) + " " + escaped(r["task"]) for r in pending))
        elif not any(r["kind"] == "TASK" for r in grouped[group["key"]]):
            text.append(f"- **{group['title']}**: 상위 기능의 상세 실행 작업과 완료조건을 추가한다.")
    text += ["", "## 통합 검증 중인 변경", "",
             "아래는 현재 작업 중인 후속 묶음이다. 최종 검증과 기록 갱신 전에는 위 완료 수치에 추가하지 않는다.", ""]
    for group in groups:
        if group.get("working"):
            text.append(f"- {local_link(group['title'], paths[group['key']], overview)}: {group['working']}")
    text += ["", "## 기록을 갱신하는 방법", "",
             "1. 해당 기능 문서에서 항목 ID와 완료조건을 확인한다.",
             "2. CSV의 구현·검증·Agent 연결과 자동/한글 검증, 근거·다음 작업을 수정한다.",
             "   통합 중 메모는 기능 분류 원본의 `working`에서 관리하고, 완료 기록 반영 시 정리한다.",
             "3. `python scripts/render_work_checklist.py`로 종합·기능별·전체 문서를 함께 생성한다.",
             "4. `python scripts/render_work_checklist.py --check`로 ID 누락·중복 분류·근거·집계·생성 파일 일치를 확인한다.", "",
             "[완료 규칙](97-master-work-checklist.md) · [전체 검색](jueony-work-checklist.html) · "
             "[전체 원문](jueony-work-checklist.md) · [기능 분류 원본](checklist-features.json)", ""]
    outputs[overview] = "\n".join(text)
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
                 "| 축 | 실행 작업 상태 |", "| --- | --- |",
                 f"| 구현 | {counter_text(tasks, 'implementation', 'DONE', 'PARTIAL', True)} |",
                 f"| 검증 | {counter_text(tasks, 'verification', 'DONE', 'PARTIAL', True)} |",
                 f"| Agent 연결 | {counter_text(tasks, 'agent', 'CONNECTED', 'PARTIAL', True)} |", "",
                 "☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. "
                 "검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.", ""]
        if rollups:
            lines += [f"상위 범위는 세 축 완료 **{sum(complete(r) for r in rollups)}/{len(rollups)}개**다. "
                      "세부 작업 완료 수와 분리해서 읽는다.", "",
                      "| 축 | 상위 범위 상태 |", "| --- | --- |",
                      f"| 구현 | {counter_text(rollups, 'implementation', 'DONE', 'PARTIAL', True)} |",
                      f"| 검증 | {counter_text(rollups, 'verification', 'DONE', 'PARTIAL', True)} |",
                      f"| Agent 연결 | {counter_text(rollups, 'agent', 'CONNECTED', 'PARTIAL', True)} |", ""]
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
        for title, subset in [
            ("남은 실행 작업", [r for r in tasks if not complete(r)]),
            ("세 축 완료 작업", [r for r in tasks if complete(r)]),
            ("상위 기능·상태 범위", [r for r in items if r["kind"] != "TASK"]),
        ]:
            if not subset:
                continue
            lines += [f"## {title} ({len(subset)})", "",
                      "항목 ID를 누르면 아래의 완료조건·근거를 펼쳐 확인할 수 있다.", "",
                      "| ID | 항목 | 구현 | 검증 | Agent 연결 |",
                      "| --- | --- | --- | --- | --- |"]
            for row in subset:
                lines.append(f"| {task_link(row, path)} {row['priority']} | {escaped(row['task'])} | "
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
    return outputs
