"""Integrity checks for feature navigation, links and non-duplicated progress."""
import collections
import copy
import hashlib
import json
from pathlib import Path
import re
import unittest
from urllib.parse import unquote

import feature_checklists as features
import render_work_checklist as checklist


class FeatureChecklistTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = checklist.load()
        cls.config = json.loads((checklist.DOCS / "checklist-features.json").read_text(encoding="utf-8"))
        cls.groups, cls.owners, cls.grouped = features.organize(cls.rows, cls.config)
        cls.outputs = features.feature_outputs(cls.rows, checklist.ROOT, checklist.LABELS,
                                               checklist.KINDS, checklist.complete, checklist.stats(cls.rows))

    def test_every_row_has_one_primary_feature_and_one_detail_anchor(self):
        anchors = []
        for group in self.groups:
            path = checklist.DOCS / "features" / group["file"]
            anchors += re.findall(r'<details id="([a-z0-9]+)">', self.outputs[path])
        self.assertCountEqual(anchors, [row["id"].lower() for row in self.rows])
        self.assertEqual(len(anchors), len(set(anchors)))

    def test_agent_commands_and_storage_overrides_follow_the_actual_feature(self):
        for item, expected in {"A005": "tables", "A050": "tables", "A051": "tables",
                               "A029": "formatting", "A021": "stories", "A034": "pages",
                               "N001": "files", "B153": "tables", "N020": "ui"}.items():
            self.assertEqual(self.owners[item], expected)

    def test_parent_inheritance_supports_new_scoped_tasks_without_duplication(self):
        rows = copy.deepcopy(self.rows)
        row = dict(rows[-1], id="G999", parent="N007")
        rows.append(row)
        _, owners, grouped = features.organize(rows, self.config)
        self.assertEqual(owners["G999"], "tables")
        self.assertEqual(sum(map(len, grouped.values())), len(rows))

    def test_invalid_ranges_duplicate_ownership_and_unknown_ids_are_rejected(self):
        for value in ["B004-B001", "B001-G002", "wrong"]:
            with self.assertRaises(AssertionError):
                features.expand_ids(value)
        for item in ["G005", "B999"]:
            config = copy.deepcopy(self.config)
            config["groups"][1]["ids"] += " " + item
            with self.assertRaises(AssertionError):
                features.organize(self.rows, config)

    def test_missing_feature_and_parent_cycle_cannot_silently_drop_rows(self):
        for extra in [[dict(self.rows[0], id="X001", parent="")],
                      [dict(self.rows[0], id="X001", parent="X002"), dict(self.rows[0], id="X002", parent="X001")]]:
            with self.assertRaises(AssertionError):
                features.organize(self.rows + extra, self.config)

    def test_feature_totals_equal_the_canonical_task_totals(self):
        index = json.loads(self.outputs[checklist.DOCS / "features" / "index.json"])
        self.assertEqual(index["rowCount"], len(self.rows))
        self.assertEqual(sum(g["taskCount"] for g in index["groups"]), index["taskCount"])
        self.assertEqual(sum(g["rollupCount"] for g in index["groups"]), len(self.rows) - index["taskCount"])
        for field in ["implementation", "verification", "agent"]:
            combined = collections.Counter()
            for group in index["groups"]:
                combined.update(group[field])
            expected = collections.Counter(r[field] for r in self.rows if r["kind"] == "TASK")
            self.assertEqual(combined, expected)

    def test_mismatched_header_delimiter_and_body_columns_are_rejected(self):
        for content in ["| A | B |\n| --- | --- | --- |\n| 1 | 2 |",
                        "| A | B |\n| --- | --- |\n| 1 | 2 | 3 |"]:
            with self.assertRaises(AssertionError):
                features.validate_markdown_tables(content)
        valid = "| A | B |\n| --- | ---: |\n| escaped \\| pipe | 2 |"
        self.assertEqual(features.validate_markdown_tables(valid), [{"columns": 2, "rows": 1}])

    def test_each_feature_has_its_own_overview_table(self):
        content = self.outputs[checklist.DOCS / "jueony-progress.md"]
        tables = features.validate_markdown_tables(content)
        self.assertEqual(len(tables), 2 + len(self.groups))
        self.assertEqual([t["columns"] for t in tables], [5, 4] + [3] * len(self.groups))
        for group in self.groups:
            section = content.split(f'<a id="feature-{group["key"]}"></a>', 1)[1].split('<a id="feature-', 1)[0]
            self.assertEqual(len(features.validate_markdown_tables(section)), 1)

    def test_dashboard_is_first_and_readme_generated_block_stays_in_sync(self):
        overview = self.outputs[checklist.DOCS / "jueony-progress.md"]
        readme = self.outputs[checklist.ROOT / "README.md"]
        block = readme.split("<!-- jueony-progress:start -->")[1].split("<!-- jueony-progress:end -->")[0]
        self.assertTrue(overview.splitlines()[2].startswith("| 기능 |"))
        self.assertEqual(features.validate_markdown_tables(block), [{"columns": 5, "rows": len(self.groups) + 1}])
        for group in self.groups:
            self.assertIn(f"[{group['title']}]", block)
            self.assertIn(f"[{group['title']}]", overview.split("문서 구성일:")[0])
        self.assertEqual(readme.split("<!-- jueony-progress:end -->")[1],
                         (checklist.ROOT / "README.md").read_text(encoding="utf-8").split("<!-- jueony-progress:end -->")[1])

    def test_small_work_tables_keep_parent_children_and_all_rows_once(self):
        seen = []
        for group in self.groups:
            items = self.grouped[group["key"]]
            tables = features.work_tables(items)
            ids = [r["id"] for t in tables for r in t["rows"]]
            self.assertCountEqual(ids, [r["id"] for r in items])
            self.assertTrue(all(0 < len(t["rows"]) <= 8 for t in tables))
            path = checklist.DOCS / "features" / group["file"]
            content = self.outputs[path]
            actual = re.findall(r'^\| \[([A-Z]\d+)\]', content, re.M)
            self.assertCountEqual(actual, ids)
            seen.extend(actual)
            parsed = features.validate_markdown_tables(content)
            self.assertEqual(parsed[0]["columns"], 3)
            self.assertTrue(all(t["columns"] == 5 and t["rows"] <= 8 for t in parsed[1:]))
        self.assertCountEqual(seen, [r["id"] for r in self.rows])
        table_family = next(t for t in features.work_tables(self.grouped["tables"]) if any(r["id"] == "B161" for r in t["rows"]))
        self.assertTrue({"B161", "N004", "A050"}.issubset({r["id"] for r in table_family["rows"]}))

    def test_all_generated_local_links_and_item_fragments_resolve(self):
        for source, content in self.outputs.items():
            if source.suffix != ".md":
                continue
            if source == checklist.ROOT / "README.md":
                content = content.split("<!-- jueony-progress:start -->")[1].split("<!-- jueony-progress:end -->")[0]
            for angle, ordinary in re.findall(r'\[[^\]]+\]\((?:<([^>]+)>|([^\s)]+))\)', content):
                href = unquote(angle or ordinary)
                path, _, anchor = href.partition("#")
                target = (source.parent / path).resolve() if path else source
                self.assertTrue(target in self.outputs or target.is_file(), (source, href))
                if anchor:
                    target_content = self.outputs.get(target) or target.read_text(encoding="utf-8")
                    self.assertIn(f'id="{anchor}"', target_content, (source, href))

    def test_rendering_does_not_change_source_or_promote_partial_verification(self):
        before = hashlib.sha256(checklist.SOURCE.read_bytes()).hexdigest()
        original = copy.deepcopy(self.rows)
        features.feature_outputs(self.rows, checklist.ROOT, checklist.LABELS, checklist.KINDS,
                                 checklist.complete, checklist.stats(self.rows))
        self.assertEqual(self.rows, original)
        self.assertEqual(hashlib.sha256(checklist.SOURCE.read_bytes()).hexdigest(), before)
        partial = next(r for r in self.rows if r["implementation"] == "DONE" and r["verification"] == "PARTIAL")
        self.assertFalse(checklist.complete(partial))


if __name__ == "__main__":
    unittest.main()
