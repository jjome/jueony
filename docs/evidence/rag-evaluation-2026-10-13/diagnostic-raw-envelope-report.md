# Local RAG corpus evaluation

Contracts: 53 passed, 10 failed.
Corpus: 16 semantic documents / 21 physical files. Queries: 22. LLM calls: 0.
Source recall @1/@3/@8: 27.8% / 83.3% / 100.0%.
MRR: 0.567. Answer-span macro recall: 100.0%.
Unanswerable queries returning matches: 3/4.

| Case | First source | Recall @8 | Answer spans | Quality issue |
|---|---|---:|---:|---|
| current-budget | service-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| old-budget | service-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| current-equipment | service-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| plan-training | service-plan-2026 | 100.0% | 100.0% | none |
| plan-performance | service-plan-2026 | 100.0% | 100.0% | none |
| late-appendix | service-plan-2026 | 100.0% | 100.0% | none |
| current-start | service-schedule-2026-v1 | 100.0% | 100.0% | expected authority is not the first unique source |
| current-end | service-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| old-end | service-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| current-retention | shared-record-rule-2025 | 100.0% | 100.0% | expected authority is not the first unique source |
| old-retention | shared-record-rule-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| training-limit | shared-expense-guide-2026 | 100.0% | 100.0% | none |
| approval-flow | service-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| compatibility-risk | service-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| roles | service-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| semantic-alias | service-glossary-2026 | 100.0% | 100.0% | none |
| temporary-confirmation | service-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| other-budget | other-plan-2026 | 100.0% | 100.0% | expected authority is not the first unique source |
| unknown-word | none | n/a | n/a | none |
| unknown-overlap | service-plan-2026 | n/a | n/a | unanswerable question still returned lexical matches; no automatic abstention |
| foreign-unselected | service-plan-2026 | n/a | n/a | unanswerable question still returned lexical matches; no automatic abstention |
| unknown-key | service-plan-2026 | n/a | n/a | unanswerable question still returned lexical matches; no automatic abstention |

These are deterministic extraction/context/search observations, not model-answer scores. Quality issues do not change production code or the ground truth.

- Sources have no workspace owner/version/validity metadata. The gateway checks registered workspace roots; direct Source[] callers must enforce ownership. Index scope checks only prevent reusing a scoped index.
- Shared docs are explicitly connected to each evaluated workspace; no automatic global access or persistent search index.
- Version/current authority is ground truth, not implemented automatic date filtering; lexical search can return superseded or unrelated documents.
- Missing answer does not trigger abstention or confidence threshold. Zero-hit unfamiliar vocabulary and overlapping unanswerable questions are measured separately.
- Synthetic corpus quality is not public-document, Hancom rendering, semantic understanding, or real-world RAG accuracy validation.
- Instructions remain reference data at context boundary; no real-model prompt-injection resistance or answer safety validation.
- No embeddings, reranker, vector DB, OCR, provider calls, autonomous loop, output factuality evaluation, or production Agent reconstruction.
