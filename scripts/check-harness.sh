#!/usr/bin/env bash
# Harness drift check. Verifies required paths exist, AGENTS.md stays under the
# line limit, and every relative markdown link resolves. Does not check heading
# anchors or whether content is current.
set -u
cd "$(dirname "$0")/.."
fail=0

required=(
  AGENTS.md CLAUDE.md ARCHITECTURE.md
  docs/DESIGN.md docs/FRONTEND.md docs/PLANS.md docs/PRODUCT_SENSE.md
  docs/QUALITY_SCORE.md docs/RELIABILITY.md docs/SECURITY.md
  docs/design-docs/index.md docs/design-docs/core-beliefs.md
  docs/exec-plans/active docs/exec-plans/completed docs/exec-plans/tech-debt-tracker.md
  docs/generated/db-schema.md docs/product-specs/index.md docs/references
)
for p in "${required[@]}"; do
  [ -e "$p" ] || { echo "missing: $p"; fail=1; }
done

lines=$(wc -l < AGENTS.md | tr -d ' ')
[ "$lines" -le 100 ] || { echo "AGENTS.md has $lines lines, limit 100"; fail=1; }

[ "$(cat CLAUDE.md)" = "@AGENTS.md" ] || { echo "CLAUDE.md must contain only @AGENTS.md"; fail=1; }

while IFS= read -r file; do
  dir=$(dirname "$file")
  grep -oE '\]\(([^)]+)\)' "$file" | sed -E 's/^\]\((.*)\)$/\1/' | while IFS= read -r target; do
    case "$target" in
      http://*|https://*|mailto:*|\#*) continue ;;
    esac
    path="${target%%#*}"
    [ -e "$dir/$path" ] || echo "broken link in $file: $target"
  done
done < <(find . -name '*.md' -not -path './node_modules/*' -not -path './.git/*') | tee /tmp/bulwark-harness-links.txt
[ -s /tmp/bulwark-harness-links.txt ] && fail=1

if [ "$fail" -eq 0 ]; then echo "harness ok"; fi
exit "$fail"
