# RAG FAQ source data

This directory contains one UTF-8 JSONL file per knowledge category, with 513
records across 15 categories. Most categories contain 35 records;
`mission_values_and_culture` contains 24 and
`offices_locations_and_contacts` contains 34 after company review removed
questions that should not be part of the knowledge base.

Every line follows this field order:

`key`, `category`, `question_en`, `answer_en`, `aliases_en`, `aliases_km`,
`is_active`

`answer_km` is intentionally omitted. Records whose answer begins with
`[NEEDS_COMPANY_INPUT: ...]` contain company facts that are not available in
the repository. They remain inactive until the marker is replaced with an
authoritative answer and `is_active` is changed to `true`.

Do not activate company records using demo-seeded employee identities or
unverified corporate details.
