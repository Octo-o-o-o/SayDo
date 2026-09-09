"""本轮文档的机械核验，不加入产品 CI。"""

from pathlib import Path
import hashlib
import json
import re

root = Path(__file__).resolve().parents[2]
area = root / "research/astra-gap-synthesis"
plan_path = root / "docs/plan/2026-09-05-engineering-gap-consolidated.astra.md"
prompt_path = root / "docs/plan/IMPL-PROMPT-engineering-gap-consolidated.astra.md"
plan = plan_path.read_text()
coverage = json.loads((area / "coverage.json").read_text())
for item in coverage["fable_ids"] + coverage["astra_ids"]:
    assert len(re.findall(r"^\| " + item + r" \|", plan, re.M)) == 1, item
for source in json.loads((area / "source-manifest.json").read_text())["sources"]:
    assert hashlib.sha256((root / source["file"]).read_bytes()).hexdigest() == source["sha256"], source["file"]
for path in [plan_path, prompt_path]:
    content = path.read_text()
    assert all(line.rstrip() == line for line in content.splitlines()), path.name
    for target in re.findall(r"\]\(([^)]+)\)", content):
        if not target.startswith(("https:", "http:", "#")):
            assert (path.parent / target.split("#")[0]).exists(), target
assert prompt_path.read_text().count("```workflow-v2\n") == 1
print("[ok] Fable 29 / Astra 11 coverage; source hashes; document links; whitespace; one workflow contract")
