#!/usr/bin/env bash
# Installs the third-party skills referenced by rules/*.md into ~/.agents/skills.
# Existing skills with the same name are kept; a clash is installed as ext-<name>.
set -euo pipefail

DEST="${SKILLS_DIR:-$HOME/.agents/skills}"
SRC="$(mktemp -d)"
trap 'rm -rf "$SRC"' EXIT
mkdir -p "$DEST"

clone() { git clone -q --depth 1 "https://github.com/$1" "$SRC/$2"; }
clone jakubkrehel/skills krehel
clone flutter/skills flutter
clone deanpeters/Product-Manager-Skills pm
clone trailofbits/skills tob
clone mattpocock/skills mp
clone vercel-labs/web-interface-guidelines wig

K=$SRC/krehel/skills F=$SRC/flutter/skills P=$SRC/pm/skills T=$SRC/tob/plugins M=$SRC/mp/skills
skills=(
  # ui
  $K/better-ui $K/better-typography $K/better-colors $K/better-layout $K/better-accessibility
  $K/better-writing $K/better-interface $K/interface-review $K/build-design $K/variant
  $K/state-machine $K/break
  $F/flutter-build-responsive-layout $F/flutter-fix-layout-issues $F/flutter-add-widget-preview
  # coder
  $F/flutter-apply-architecture-best-practices $F/flutter-use-http-package
  $F/dart-fix-runtime-errors $F/dart-run-static-analysis $F/dart-add-unit-test
  $M/engineering/tdd $M/engineering/diagnosing-bugs $M/engineering/domain-modeling
  $M/engineering/improve-codebase-architecture
  $T/patching-bugs/skills/reproduce-bug $T/patching-bugs/skills/patching-bugs
  # sec
  $F/flutter-add-widget-test $F/flutter-add-integration-test
  $T/differential-review/skills/differential-review $T/sharp-edges/skills/sharp-edges
  $T/variant-analysis/skills/variant-analysis $T/supply-chain-risk-auditor/skills/supply-chain-risk-auditor
  $T/firebase-apk-scanner/skills/firebase-apk-scanner $T/property-based-testing/skills/property-based-testing
  $T/mutation-testing/skills/mutation-testing $T/fp-check/skills/fp-check
  $T/post-patch-validation/skills/post-patch-validation $T/audit-context-building/skills/audit-context-building
  $T/entry-point-analyzer/skills/entry-point-analyzer $T/static-analysis/skills/semgrep
  $T/regression-hunt/skills/hunt-regressions
  # mandor
  $P/prd-development $P/user-story $P/problem-statement $P/jobs-to-be-done $P/customer-journey-map
  $P/prioritization-advisor $P/lean-ux-canvas $P/storyboard $P/opportunity-solution-tree
  $P/epic-breakdown-advisor
  $M/engineering/to-spec $M/engineering/prototype $M/engineering/to-tickets
  $M/productivity/grill-me $M/productivity/writing-for-agents
)

for s in "${skills[@]}"; do
  n=$(basename "$s")
  if [ -e "$DEST/$n" ] && [ ! -e "$DEST/ext-$n" ] && ! cmp -s "$s/SKILL.md" "$DEST/$n/SKILL.md"; then n="ext-$n"; fi
  if [ -e "$DEST/$n" ]; then echo "keep $n"; continue; fi
  cp -r "$s" "$DEST/$n" && echo "+ $n"
done

mkdir -p "$DEST/web-design-guidelines/references"
cp "$SRC/wig/command.md" "$DEST/web-design-guidelines/references/vercel-web-interface-guidelines.md"

here="$(cd "$(dirname "$0")/.." && pwd)"
[ -e "$DEST/mandor-prototype-spec" ] || cp -r "$here/skills/mandor-prototype-spec" "$DEST/"
echo "done: $DEST"
