#!/usr/bin/env bash
# bench/run.sh — start one benchmark run (mandordantukangv3).
# Usage: bench/run.sh <simple|medium|complex> <pair|single>
# Resets a dedicated bench repo to the fixture, creates the scenario task and assigns it.
# pair: needs `orca-pair "$BENCH_REPO"` running (Mandor + Tukang panes). single: Mandor does it alone.
# Results: (cd "$BENCH_REPO" && orca-bridge usage compare)
set -euo pipefail

scenario="${1:-}"; mode="${2:-}"
[[ "$scenario" =~ ^(simple|medium|complex)$ && "$mode" =~ ^(pair|single)$ ]] || { sed -n '2,6p' "$0"; exit 1; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BRIDGE="${BRIDGE:-$(command -v orca-bridge || echo "$HERE/../scripts/orca-bridge.sh")}"
BENCH_REPO="${BENCH_REPO:-$HOME/.cache/mandordantukangv3-bench/repo}"

if [[ ! -d "$BENCH_REPO/.git" ]]; then
  mkdir -p "$BENCH_REPO"
  cp -R "$HERE/fixture/." "$BENCH_REPO/"
  git -C "$BENCH_REPO" init -q
  git -C "$BENCH_REPO" add -A
  git -C "$BENCH_REPO" -c user.name=bench -c user.email=bench@localhost commit -qm "bench fixture"
  git -C "$BENCH_REPO" tag bench-base
fi
# Only this dedicated bench repo is reset; it holds nothing but the fixture.
git -C "$BENCH_REPO" reset -q --hard bench-base
git -C "$BENCH_REPO" clean -qfdx

id="$scenario-$mode-$(date +%Y%m%d-%H%M%S)"
spec="$(node -e '
  const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  Object.assign(s, { task_id: process.argv[2], mode: process.argv[3], scenario: process.argv[4] });
  process.stdout.write(JSON.stringify(s));' "$HERE/scenarios/$scenario.json" "$id" "$mode" "$scenario")"

cd "$BENCH_REPO"
printf '%s' "$spec" | "$BRIDGE" task new - >/dev/null
force=(); [[ "$scenario" == simple && "$mode" == pair ]] && force=(--force)  # measure the handoff cost SIMPLE normally avoids
"$BRIDGE" task assign "$id" ${force[@]+"${force[@]}"}
echo "run: $id  repo: $BENCH_REPO"
echo "after approve/reject, add Tukang usage if known: orca-bridge usage add $id --role tukang --in N --out N --source actual|estimated"
