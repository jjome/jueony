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

    def test_all_generated_local_links_and_item_fragments_resolve(self):
        for source, content in self.outputs.items():
            if source.suffix != ".md":
                continue
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
