#!/usr/bin/env bash
# tests/run.sh — behavior tests for orca-bridge / orca-pair / install.sh against a fake `orca` CLI.
# Usage: tests/run.sh [name-filter]
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
B="$ROOT/scripts/orca-bridge.sh"
export PATH="$HERE/fake-bin:$PATH" MANDOR_NO_MONITOR=1
FILTER="${1:-}"
PASS=0; FAIL=0; FAILED=()

ok() { PASS=$((PASS + 1)); echo "  ok   $1"; }
bad() { FAIL=$((FAIL + 1)); FAILED+=("$CUR: $1"); echo "  FAIL $1"; [[ -n "${2:-}" ]] && echo "$2" | sed 's/^/       /'; }
# yes <desc> <cmd...>: command must succeed. no <desc> <cmd...>: command must fail.
yes() { local d="$1" out; shift; if out="$("$@" 2>&1)"; then ok "$d"; else bad "$d" "$out"; fi; }
no() { local d="$1" out; shift; if out="$("$@" 2>&1)"; then bad "$d (unexpected success)" "$out"; else ok "$d"; fi; }
has() { local d="$1" needle="$2" hay="$3"; if [[ "$hay" == *"$needle"* ]]; then ok "$d"; else bad "$d" "missing '$needle' in: $hay"; fi; }
hasnt() { local d="$1" needle="$2" hay="$3"; if [[ "$hay" != *"$needle"* ]]; then ok "$d"; else bad "$d" "unexpected '$needle' in: $hay"; fi; }

# setup: fresh state dir, git repo with tests, fake Orca with a Mandor, a Tukang and a plain shell.
setup() {
  T="$(mktemp -d)"
  export MANDOR_STATE_DIR="$T/state" FAKE_ORCA_LOG="$T/sends.log" FAKE_ORCA_TERMS="$T/terms.json"
  unset FAKE_ORCA_SEND_FAIL FAKE_ORCA_WAIT_RC MANDOR_HANDLE TUKANG_HANDLE FAKE_ORCA_READ MANDOR_STALL_MIN
  : > "$FAKE_ORCA_LOG"
  REPO="$T/repo"; mkdir -p "$REPO/src"
  printf 'module.exports = 1;\n' > "$REPO/src/a.js"
  printf 'module.exports = 2;\n' > "$REPO/src/b.js"
  printf 'node_modules/\n.env\n' > "$REPO/.gitignore"
  printf 'SECRET=1\n' > "$REPO/.env"
  printf '#!/bin/sh\ngrep -q "1" src/a.js\n' > "$REPO/check.sh"; chmod +x "$REPO/check.sh"
  git -C "$REPO" init -q
  git -C "$REPO" add -A
  git -C "$REPO" -c user.name=t -c user.email=t@t commit -qm init
  terms "$REPO" '[{"handle":"term_m","title":"⠋ Pi"},{"handle":"term_a","title":"Antigravity Tukang"},{"handle":"term_f","title":"~/user/repo - fish"}]'
}
# terms <worktree> <json array of {handle,title}> [visualLayouts json]
terms() {
  node -e '
    const [wt, arr, vl] = process.argv.slice(1);
    const t = JSON.parse(arr).map(x => ({ connected: true, writable: true, worktreePath: wt, ...x }));
    console.log(JSON.stringify({ result: { terminals: t, visualLayouts: vl ? JSON.parse(vl) : [] } }));' "$1" "$2" "${3:-}" > "$FAKE_ORCA_TERMS"
}
mandor() { (cd "$REPO" && ORCA_TERMINAL_HANDLE=term_m "$B" "$@"); }
tukang() { (cd "$REPO" && ORCA_TERMINAL_HANDLE=term_a "$B" "$@"); }
spec() { # spec <extra-json-fields> -> spec file path
  local f="$T/spec.json"
  node -e 'const base={task_type:"MEDIUM",objective:"change a",allowed_files:["src/a.js"],required_changes:["a returns 11"],
    acceptance_criteria:["a.js exports 11"],verification_command:"./check.sh",constraints:[]};
    console.log(JSON.stringify(Object.assign(base, JSON.parse(process.argv[1]||"{}"))))' "${1:-}" > "$f"
  echo "$f"
}
new_task() { mandor task new "$(spec "${1:-}")" 2>/dev/null; }
state_of() { mandor task status "$1" | sed -n 's/^state: //p'; }
sent_to() { awk -v h="$1" '/^---SEND /{p=($2==h)} p' "$FAKE_ORCA_LOG"; }
run() { CUR="$1"; [[ -z "$FILTER" || "$1" == *"$FILTER"* ]] || return 0; echo "# $1"; setup; "$1"; rm -rf "$T"; }

# ---------------- routing ----------------
t_routing_title_match() {
  has "status finds both panes by title" "term_a (title)" "$(mandor status)"
  has "mandor resolved by title" "term_m (title)" "$(mandor status)"
  yes "send to agy succeeds" mandor send agy hello
  has "message delivered to term_a" "hello" "$(sent_to term_a)"
}
t_routing_no_arbitrary_fallback() {
  terms "$REPO" '[{"handle":"term_m","title":"⠋ Pi"},{"handle":"term_x","title":"Terminal 2"},{"handle":"term_f","title":"~/user/repo - fish"}]'
  no "unknown pane is not picked by array index" mandor send agy hi
  has "error lists candidates + bind hint" "pair bind tukang" "$(mandor send agy hi 2>&1)"
  hasnt "nothing was sent" "SEND" "$(cat "$FAKE_ORCA_LOG")"
}
t_routing_ambiguous() {
  terms "$REPO" '[{"handle":"term_m","title":"OMP"},{"handle":"term_a","title":"agy"},{"handle":"term_b","title":"Gemini"}]'
  has "two tukang candidates -> ambiguous error" "ambiguous" "$(mandor send agy hi 2>&1)"
  yes "pair bind resolves ambiguity" mandor pair bind tukang term_b
  yes "send after bind" mandor send agy hi
  has "bound terminal got it" "hi" "$(sent_to term_b)"
}
t_routing_other_worktree_ignored() {
  terms "$T/other" '[{"handle":"term_m","title":"OMP"},{"handle":"term_a","title":"agy"}]'
  no "terminals of another worktree are never used" mandor send agy hi
}
t_routing_self_send_refused() {
  yes "bind tukang to mandor's own handle" mandor pair bind tukang term_m
  has "self-send refused" "refusing self-send" "$(mandor send agy hi 2>&1)"
  no "bind to dead handle refused" mandor pair bind tukang term_zzz
}
t_routing_layout_fallback() {
  terms "$REPO" '[{"handle":"term_1","title":"Terminal 1"},{"handle":"term_2","title":"Terminal 2"}]' \
    "[{\"worktreePath\":\"$REPO\",\"root\":{\"type\":\"split\",\"first\":{\"activeTabId\":\"a\",\"tabs\":[{\"tabId\":\"a\",\"panes\":{\"type\":\"terminal\",\"handle\":\"term_1\"}}]},\"second\":{\"activeTabId\":\"b\",\"tabs\":[{\"tabId\":\"b\",\"panes\":{\"type\":\"terminal\",\"handle\":\"term_2\"}}]}}}]"
  has "right split pane = tukang (layout)" "term_2 (layout)" "$(mandor status)"
}
t_opencode_skips_altm_flush() {
  terms "$REPO" '[{"handle":"term_m","title":"OMP Mandor"},{"handle":"term_ui","title":"AGY UI"},{"handle":"term_sec","title":"OC | Testing"}]'
  mandor pair bind ui term_ui >/dev/null; mandor pair bind sec term_sec >/dev/null
  yes "send to agy pane" mandor send ui hi
  yes "send to OpenCode pane" mandor send sec hi
  has "agy pane gets text + Alt+M (2 sends)" 2 "$(grep -c '^---SEND term_ui$' "$FAKE_ORCA_LOG")"
  has "OpenCode pane gets text only (1 send)" 1 "$(grep -c '^---SEND term_sec$' "$FAKE_ORCA_LOG")"
}
t_routing_squad_workers() {
  terms "$REPO" '[{"handle":"term_m","title":"OMP Mandor"},{"handle":"term_ui","title":"AGY UI Specialist"},{"handle":"term_cd","title":"AGY Coder Specialist"},{"handle":"term_sec","title":"AGY Security Specialist"}]'
  yes "bind UI worker" mandor pair bind ui term_ui
  yes "bind Coder worker" mandor pair bind coder term_cd
  yes "bind Security worker" mandor pair bind sec term_sec
  yes "delegate to UI worker" mandor delegate --to ui "Fix CSS" '- Allowed Files: [style.css]\n- Verify Command: ./check.sh'
  has "UI worker got delegation" "style.css" "$(sent_to term_ui)"
  mkdir -p "$REPO/docs/security_references"
  local id; id="$(mandor task new "$(spec '{"target_worker":"sec"}')")"
  yes "assign to sec worker" mandor task assign "$id"
  has "Security worker got task" "$id" "$(sent_to term_sec)"
  has "sec handoff points at its role rules" "mandordantukangv3/rules/tukang-sec.md" "$(sent_to term_sec)"
  hasnt "sec handoff does not load ui rules" "tukang-ui.md" "$(sent_to term_sec)"
  has "sec handoff lists its reference folder" "REFS docs/security_references/" "$(sent_to term_sec)"
  hasnt "ui handoff has no refs when folder missing" "REFS" "$(sent_to term_ui)"
}
t_wait_and_send_failures() {
  export FAKE_ORCA_WAIT_RC=1
  no "wait timeout exits non-zero" mandor wait agy 10
  hasnt "no false 'idle' message on timeout" "is idle" "$(mandor wait agy 10 2>&1)"
  unset FAKE_ORCA_WAIT_RC
  yes "wait succeeds when idle" mandor wait agy 10
  export FAKE_ORCA_SEND_FAIL=1
  no "send failure exits non-zero" mandor send agy hi
}

# ---------------- legacy delegate ----------------
t_legacy_delegate_contract() {
  no "legacy delegate without allowlist refused" mandor delegate "Fix" "just do it"
  yes "legacy delegate with contract" mandor delegate "Fix" '- Allowed Files: [src/a.js]\n- Verify Command: ./check.sh'
  local s; s="$(sent_to term_a)"
  has "literal \\n became newline" $'[src/a.js]\n- Verify Command' "$s"
  hasnt "no hardcoded npm test instruction" "Verifikasi dengan 'npm test'" "$s"
  yes "--force keeps old free-form behaviour" mandor delegate --force "Fix" "free text"
}

# ---------------- spec validation ----------------
t_spec_validation() {
  no "missing acceptance_criteria" mandor task new "$(spec '{"acceptance_criteria":[]}')"
  no "path traversal" mandor task new "$(spec '{"allowed_files":["../x.js"]}')"
  no "absolute path" mandor task new "$(spec '{"allowed_files":["/etc/passwd"]}')"
  no "sensitive file needs allow_sensitive" mandor task new "$(spec '{"allowed_files":[".env"]}')"
  no "allow_sensitive needs COMPLEX" mandor task new "$(spec '{"allowed_files":[".env"],"allow_sensitive":true}')"
  no "unknown field (typo) rejected" mandor task new "$(spec '{"alowed_files":["x"]}')"
  no "bad task_type" mandor task new "$(spec '{"task_type":"EASY"}')"
  no "bad task_id (path chars)" mandor task new "$(spec '{"task_id":"../../x"}')"
  yes "valid spec accepted" mandor task new "$(spec)"
  no "duplicate task_id refused" bash -c "cd '$REPO' && '$B' task new '$(spec '{"task_id":"dup"}')' && '$B' task new '$(spec '{"task_id":"dup"}')'"
}
t_verify_detection() {
  local d="$T/d"; mkdir -p "$d"
  echo '{"scripts":{"test":"echo \"Error: no test specified\" && exit 1"}}' > "$d/package.json"
  no "npm placeholder test is not a verify command" "$B" detect-verify "$d"
  echo '{"scripts":{"test":"vitest"}}' > "$d/package.json"
  has "npm default" "npm test" "$("$B" detect-verify "$d")"
  touch "$d/pnpm-lock.yaml"; has "pnpm lockfile" "pnpm test" "$("$B" detect-verify "$d")"; rm "$d/pnpm-lock.yaml"
  touch "$d/yarn.lock"; has "yarn lockfile" "yarn test" "$("$B" detect-verify "$d")"; rm "$d/yarn.lock"
  touch "$d/bun.lock"; has "bun lockfile" "bun run test" "$("$B" detect-verify "$d")"; rm "$d/bun.lock" "$d/package.json"
  touch "$d/Cargo.toml"; has "cargo" "cargo test" "$("$B" detect-verify "$d")"; rm "$d/Cargo.toml"
  touch "$d/go.mod"; has "go" "go test ./..." "$("$B" detect-verify "$d")"; rm "$d/go.mod"
  touch "$d/pyproject.toml"; has "pytest" "pytest" "$("$B" detect-verify "$d")"; rm "$d/pyproject.toml"
  printf 'test:\n\ttrue\n' > "$d/Makefile"; has "make" "make test" "$("$B" detect-verify "$d")"
  local id; id="$(mandor task new "$(spec '{"verification_command":""}')" 2>&1)"
  has "no detectable verify -> spec refused (never silent success)" "verification_command required" "$id"
}

# ---------------- lifecycle ----------------
t_happy_path_shared() {
  local id; id="$(new_task)"
  yes "assign sends handoff" mandor task assign "$id"
  local h; h="$(sent_to term_a)"
  has "handoff carries task id" "[MANDOR TASK $id | MEDIUM]" "$h"
  has "handoff is compact JSON spec" 'SPEC {"objective":"change a","allowed_files":["src/a.js"]' "$h"
  hasnt "handoff does not leak verify command to re-run" "npm test" "$h"
  no "duplicate assign refused" mandor task assign "$id"
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  local r; r="$(tukang report DONE --task "$id" "a now 11")"
  has "bridge ran verify itself" '"verify":{"cmd":"./check.sh","exit":0' "$r"
  has "approvable" '"approvable":true' "$r"
  has "mandor got CHECK evidence" '"scope":"ok"' "$(sent_to term_m)"
  has "state REVIEWING" REVIEWING "$(state_of "$id")"
  yes "approve" mandor task approve "$id"
  has "state APPROVED" APPROVED "$(state_of "$id")"
}
t_report_autodetects_single_active_task() {
  local id; id="$(new_task)"; mandor task assign "$id" >/dev/null
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  has "report without --task attaches the only active task" "[TUKANG REPORT $id DONE]" "$(tukang report DONE "done"; sent_to term_m)"
}
t_report_from_wrong_terminal() {
  local id; id="$(new_task)"; mandor task assign "$id" >/dev/null
  terms "$REPO" '[{"handle":"term_m","title":"⠋ Pi"},{"handle":"term_a","title":"Antigravity Tukang"},{"handle":"term_z","title":"zsh"}]'
  no "report from another terminal refused" bash -c "cd '$REPO' && ORCA_TERMINAL_HANDLE=term_z '$B' report DONE --task $id x"
}
t_scope_violation_and_revert() {
  local id; id="$(new_task)"; mandor task assign "$id" >/dev/null
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  printf 'module.exports = 22;\n' > "$REPO/src/b.js"
  printf 'x\n' > "$REPO/new.txt"
  local r; r="$(tukang report DONE --task "$id" done)"
  has "out-of-scope edit detected" '"out_of_scope":["new.txt","src/b.js"]' "$r"
  has "not approvable" '"approvable":false' "$r"
  no "approve refused on violation" mandor task approve "$id"
  yes "revert outside-only" mandor task revert "$id" --outside-only
  has "b.js restored" "= 2;" "$(cat "$REPO/src/b.js")"
  [[ ! -e "$REPO/new.txt" ]] && ok "new out-of-scope file removed" || bad "new.txt still exists"
  has "allowed change kept" "= 11;" "$(cat "$REPO/src/a.js")"
  yes "re-check passes" mandor task check "$id"
  yes "approve after cleanup" mandor task approve "$id"
}
t_verify_failure_blocks_approval() {
  local id; id="$(new_task '{"verification_command":"echo boom; exit 3"}')"; mandor task assign "$id" >/dev/null
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  local r; r="$(tukang report DONE --task "$id" done)"
  has "real exit code reported" '"exit":3' "$r"
  has "log tail attached on failure" "boom" "$r"
  no "approve refused" mandor task approve "$id"
}
t_verify_timeout() {
  local id; id="$(new_task '{"verification_command":"sleep 5","verify_timeout":1}')"; mandor task assign "$id" >/dev/null
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  has "timeout recorded" '"timed_out":true' "$(tukang report DONE --task "$id" done)"
}
t_change_after_verify() {
  local id; id="$(new_task)"; mandor task assign "$id" >/dev/null
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  tukang report DONE --task "$id" done >/dev/null
  printf 'module.exports = 12;\n' > "$REPO/src/a.js"
  has "edit after verify blocks approve" "changed after verification" "$(mandor task approve "$id" 2>&1)"
  mandor task check "$id" >/dev/null
  printf 'x\n' > "$REPO/src/extra.js"
  has "new file after verify blocks approve" "changed after verification" "$(mandor task approve "$id" 2>&1)"
}
t_baseline_dirty_files() {
  printf 'user wip\n' >> "$REPO/src/b.js"       # user's uncommitted work before the task
  local id; id="$(new_task)"; mandor task assign "$id" >/dev/null
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  local r; r="$(tukang report DONE --task "$id" done)"
  has "pre-existing dirty file not blamed on Tukang" '"changed":["src/a.js"]' "$r"
  mandor task reject "$id" "x" >/dev/null
  git -C "$REPO" checkout -q -- src/b.js          # Tukang reverts the user's work
  has "reverting user's dirty file is detected" '"src/b.js"' "$(tukang report DONE --task "$id" done)"
  mandor task revert "$id" >/dev/null
  has "revert restores the user's pre-task content" "user wip" "$(cat "$REPO/src/b.js")"
}
t_secret_file_detection() {
  local id; id="$(new_task)"; mandor task assign "$id" >/dev/null
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  printf 'SECRET=2\n' > "$REPO/.env"             # gitignored, invisible to git diff
  local r; r="$(tukang report DONE --task "$id" done)"
  has "ignored .env edit flagged sensitive" '"sensitive":[".env"]' "$r"
  no "approve refused" mandor task approve "$id"
}
t_reject_retry_limit() {
  local id; id="$(new_task)"; mandor task assign "$id" >/dev/null
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  tukang report DONE --task "$id" done >/dev/null
  no "reject needs a targeted fix" mandor task reject "$id"
  yes "reject with fix -> retry" mandor task reject "$id" "use 11 not eleven"
  has "correction delivered" "FIX use 11 not eleven" "$(sent_to term_a)"
  has "back to EXECUTING" EXECUTING "$(state_of "$id")"
  tukang report DONE --task "$id" done >/dev/null
  yes "second reject exceeds max_retries=1" mandor task reject "$id" "again"
  has "REJECTED, Mandor takes over" REJECTED "$(state_of "$id")"
  local next; next="$(new_task)"; mandor task assign "$next" >/dev/null
  has "reject fix rides along as a lesson in the next handoff" "(use 11 not eleven)" "$(sent_to term_a)"
}
t_simple_task_not_delegated() {
  local id; id="$(new_task '{"task_type":"SIMPLE"}')"
  has "SIMPLE delegation refused" "direct edit" "$(mandor task assign "$id" 2>&1)"
  yes "--force overrides" mandor task assign "$id" --force
}
t_concurrent_shared_tasks() {
  local a b; a="$(new_task)"; b="$(new_task '{"allowed_files":["src/b.js"]}')"
  mandor task assign "$a" >/dev/null
  yes "disjoint shared task runs in parallel" mandor task assign "$b"
  has "overlapping shared task refused" "overlapping allowed_files" "$(mandor task assign "$(new_task)" 2>&1)"
  printf 'module.exports = 17;\n' > "$REPO/src/a.js"; printf 'module.exports = 8;\n' > "$REPO/src/b.js"
  has "peer's file not blamed on task a" '"changed":["src/a.js"]' "$(mandor task check "$a" 2>&1)"
  yes "approve a" mandor task approve "$a"
  has "closed peer's file still not blamed on task b" '"changed":["src/b.js"]' "$(mandor task check "$b" 2>&1)"
  yes "isolated task may run concurrently" mandor task assign "$(new_task '{"isolate":true,"allowed_files":["src/b.js"]}')"
}
t_isolated_task() {
  local id wt; id="$(new_task '{"isolate":true}')"; mandor task assign "$id" >/dev/null
  wt="$(sent_to term_a | sed -n 's/^WORKDIR \(.*\)  (edit.*/\1/p')"
  [[ -d "$wt" ]] && ok "worktree created and announced" || bad "no worktree: '$wt'"
  printf 'module.exports = 11;\n' > "$wt/src/a.js"
  has "main tree untouched before approve" "= 1;" "$(cat "$REPO/src/a.js")"
  local r; r="$(cd "$wt" && ORCA_TERMINAL_HANDLE=term_a "$B" report DONE --task "$id" done)"
  has "report from inside worktree routes + verifies" '"approvable":true' "$r"
  yes "approve" mandor task approve "$id"
  has "patch applied to main tree" "= 11;" "$(cat "$REPO/src/a.js")"
  [[ ! -d "$wt" ]] && ok "worktree removed" || bad "worktree left behind"
}
t_isolated_reject_never_lands() {
  local id wt; id="$(new_task '{"isolate":true,"max_retries":0}')"; mandor task assign "$id" >/dev/null
  wt="$(sent_to term_a | sed -n 's/^WORKDIR \(.*\)  (edit.*/\1/p')"
  printf 'module.exports = 99;\n' > "$wt/src/a.js"
  tukang report DONE --task "$id" done >/dev/null
  yes "reject (no retries left)" mandor task reject "$id" "wrong"
  has "rejected change never reached main tree" "= 1;" "$(cat "$REPO/src/a.js")"
  yes "discard worktree" mandor task discard "$id"
  [[ ! -d "$wt" ]] && ok "worktree gone" || bad "worktree left"
}
t_recovery_after_send_failure() {
  local id; id="$(new_task)"
  export FAKE_ORCA_SEND_FAIL=1
  no "assign fails when Tukang unreachable" mandor task assign "$id"
  has "state FAILED (not stuck)" FAILED "$(state_of "$id")"
  unset FAKE_ORCA_SEND_FAIL
  yes "resume re-sends" mandor task resume "$id"
  has "EXECUTING again" EXECUTING "$(state_of "$id")"
  has "events logged" "handoff delivery failed" "$(mandor task log "$id")"
}
t_blocked_amend_resume() {
  local id; id="$(new_task)"; mandor task assign "$id" >/dev/null
  yes "Tukang reports BLOCKED" tukang report BLOCKED --task "$id" "src/b.js: needs export"
  no "approve refused while blocked" mandor task approve "$id"
  no "amend rejects traversal" mandor task amend "$id" --allow ../x
  yes "amend allowlist" mandor task amend "$id" --allow src/b.js
  yes "resume" mandor task resume "$id"
  has "resumed handoff includes amended allowlist" '"allowed_files":["src/a.js","src/b.js"]' "$(sent_to term_a)"
}
t_lock_stale_and_busy() {
  local id; id="$(new_task)"
  local tdir; tdir="$(ls -d "$MANDOR_STATE_DIR"/repos/*/tasks/"$id")"
  mkdir "$tdir/.lock"; echo 999999 > "$tdir/.lock/pid"
  yes "stale lock reclaimed" mandor task assign "$id"
  mkdir "$tdir/.lock"; echo $$ > "$tdir/.lock/pid"
  has "live lock blocks concurrent mutation" "task busy" "$(mandor task check "$id" 2>&1)"
  rm -rf "$tdir/.lock"
}
t_monitor_stall_and_loop() {
  local id; id="$(new_task)"; mandor task assign "$id" >/dev/null
  has "fresh task is OK" "OK" "$(mandor monitor)"
  has "no activity past threshold is STALL" "STALL" "$(MANDOR_STALL_MIN=0 mandor monitor)"
  node -e 'const l=[]; for (let i=0;i<4;i++) l.push("● ManageTask(status task-1)"); l.push("● ManageTask(kill task-1)");
    process.stdout.write(JSON.stringify({result:{terminal:{tail:l}}}))' > "$T/tail.json"
  export FAKE_ORCA_READ="$T/tail.json"
  has "repeated status polls are LOOP" "LOOP" "$(mandor monitor)"
  timeout 3 bash -c "cd '$REPO' && ORCA_TERMINAL_HANDLE=term_m '$B' monitor --watch 30" >/dev/null 2>&1 || true
  has "watch alerts Mandor" "[MONITOR $id LOOP]" "$(sent_to term_m)"
  timeout 3 bash -c "cd '$REPO' && ORCA_TERMINAL_HANDLE=term_m '$B' monitor --watch 30" >/dev/null 2>&1 || true
  [[ "$(sent_to term_m | grep -c "MONITOR $id LOOP")" == 1 ]] && ok "same verdict alerts only once" || bad "duplicate monitor alert"
  no "watch interval below 30s refused" mandor monitor --watch 5
}

# ---------------- usage tracker ----------------
t_usage_tracking() {
  local id; id="$(new_task '{"scenario":"s1"}')"; mandor task assign "$id" >/dev/null
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  tukang report DONE --task "$id" done >/dev/null
  # fake omp session for the Mandor, inside the task window
  local sd="$T/sessions/p"; mkdir -p "$sd"
  local ts; ts=$(( $(date +%s) * 1000 ))
  { echo "{\"type\":\"session\",\"cwd\":\"$REPO\"}"
    echo "{\"type\":\"message\",\"message\":{\"role\":\"assistant\",\"model\":\"opus\",\"timestamp\":$ts,\"usage\":{\"input\":10,\"output\":5,\"cacheRead\":100,\"cacheWrite\":0,\"cost\":{\"total\":0.5}}}}"
  } > "$sd/x.jsonl"
  MANDOR_OMP_SESSIONS="$T/sessions" mandor task approve "$id" >/dev/null
  no "usage add refuses missing --source" mandor usage add "$id" --role tukang --in 5 --out 5
  yes "usage add estimated" mandor usage add "$id" --role tukang --in 400 --out 100 --source estimated
  local r; r="$(mandor usage report "$id" --csv)"
  has "mandor actual from omp session (input+cache)" '"110","5","actual"' "$r"
  has "tukang marked estimated" '"400","100","estimated"' "$r"
  has "mixed total flagged" '"mixed"' "$r"
  has "verify + approval columns" '"exit 0","APPROVED"' "$r"
  has "handoff size kept apart" "handoff_tokens_est" "$(mandor usage report "$id")"
  has "compare groups by scenario/mode" "| s1 | pair | 1 | 1/1 |" "$(mandor usage compare)"
}
t_single_mode() {
  local id; id="$(new_task '{"mode":"single","task_type":"SIMPLE"}')"
  yes "single-agent assign (no handoff)" mandor task assign "$id"
  hasnt "nothing sent to Tukang" "SEND" "$(cat "$FAKE_ORCA_LOG")"
  printf 'module.exports = 11;\n' > "$REPO/src/a.js"
  yes "check" mandor task check "$id"
  yes "approve" mandor task approve "$id"
}

# ---------------- orca-pair ----------------
t_orca_pair_binds_spawned_terminals() {
  terms "$REPO" '[]'
  local home="$T/home"; mkdir -p "$home/.agents/skills/mandordantukangv3" "$home/bin"
  cp "$ROOT/AGENTS.md" "$home/.agents/skills/mandordantukangv3/"
  ln -s "$B" "$home/bin/orca-bridge"
  local out; out="$(cd "$REPO" && HOME="$home" PATH="$home/bin:$PATH" MANDOR_HOME="$home/.agents/skills/mandordantukangv3" bash "$ROOT/scripts/orca-pair.sh" "$REPO" 2>&1)"
  has "spawned mandor bound" "term_new_OMPMandor (pair)" "$out"
  has "spawned tukang bound" "term_new_AntigravityTukang (pair)" "$out"
  has "AGENTS.md generated from canonical source" "ANTI-HANDOFF-LEAK" "$(cat "$REPO/AGENTS.md")"
  [[ -L "$REPO/CLAUDE.md" && -L "$REPO/GEMINI.md" ]] && ok "CLAUDE.md/GEMINI.md symlinked" || bad "symlinks missing"
  local again; again="$(cd "$REPO" && HOME="$home" PATH="$home/bin:$PATH" bash "$ROOT/scripts/orca-pair.sh" "$REPO" 2>&1)"
  has "re-run detects existing panes, no duplicates" "sudah terdeteksi" "$again"
}

# ---------------- install.sh ----------------
t_install_lifecycle() {
  local home="$T/home" other="$T/other-bridge.sh"
  mkdir -p "$home/.local/bin"
  echo '#!/bin/sh' > "$other"; echo 'echo custom' >> "$other"
  ln -s "$other" "$home/.local/bin/orca-bridge"          # user's own symlinked bridge (real setup today)
  yes "install" env HOME="$home" XDG_DATA_HOME="$home/.local/share" bash "$ROOT/scripts/install.sh"
  has "symlink target NOT overwritten" "echo custom" "$(cat "$other")"
  has "installed bridge works" "orca-bridge $("$B" version | awk '{print $2}')" "$("$home/.local/bin/orca-bridge" version)"
  [[ -L "$(ls -d "$home"/.local/share/mandordantukangv3/backups/*/bin/orca-bridge)" ]] && ok "old symlink backed up as symlink" || bad "no symlink backup"
  echo "my note" >> "$home/.agents/skills/mandordantukangv3/skills/antislop.md"
  yes "re-install" env HOME="$home" XDG_DATA_HOME="$home/.local/share" bash "$ROOT/scripts/install.sh"
  has "user-edited skill file kept" "my note" "$(cat "$home/.agents/skills/mandordantukangv3/skills/antislop.md")"
  [[ -f "$home/.agents/skills/mandordantukangv3/skills/antislop.md.new" ]] && ok "new version offered as .new" || bad "no .new file"
  yes "uninstall" env HOME="$home" XDG_DATA_HOME="$home/.local/share" bash "$ROOT/scripts/install.sh" --uninstall
  [[ -L "$home/.local/bin/orca-bridge" && "$(readlink "$home/.local/bin/orca-bridge")" == "$other" ]] \
    && ok "uninstall restored the user's original symlink" || bad "original symlink not restored"
}
t_install_rollback() {
  local home="$T/home" fake="$T/fakeroot"
  mkdir -p "$home/.local/bin"
  cp -R "$ROOT/." "$fake"; rm -rf "$fake/.git"
  printf 'old\n' > "$home/.local/bin/orca-pair"
  echo 'exit 3' > "$fake/scripts/orca-bridge.sh"            # valid syntax, broken at runtime -> validation fails
  no "install with a broken bridge fails" env HOME="$home" XDG_DATA_HOME="$home/.local/share" bash "$fake/scripts/install.sh"
  has "previous orca-pair restored by rollback" "old" "$(cat "$home/.local/bin/orca-pair")"
}

t_install_global_rules() {
  local home="$T/home" r="$T/home/.omp/agent/RULES.md" g="$T/home/.gemini/GEMINI.md"
  mkdir -p "$home/.omp/agent" "$home/.gemini/config/skills"
  printf '# mine\nkeep top\n<!-- mandordantukangv3:start -->\nold block\n<!-- mandordantukangv3:end -->\nkeep bottom\n' > "$r"
  printf '# agy rules\nkeep\n' > "$g"
  local env=(env HOME="$home" XDG_DATA_HOME="$home/.local/share")
  yes "install --global-rules" "${env[@]}" bash "$ROOT/scripts/install.sh" --global-rules
  has "omp block replaced in place" $'keep top\n<!-- mandordantukangv3:start -->\n## Orca Multi-Agent Squad: MANDOR' "$(cat "$r")"
  has "omp text after block kept" "keep bottom" "$(cat "$r")"
  hasnt "old block content gone" "old block" "$(cat "$r")"
  has "agy block appended" "GLOBAL RULES" "$(cat "$g")"
  has "agy own rules kept" "keep" "$(cat "$g")"
  [[ -L "$home/.gemini/config/skills/mandordantukangv3" ]] && ok "agy skill linked" || bad "agy skill link missing"
  yes "re-run" "${env[@]}" bash "$ROOT/scripts/install.sh" --global-rules
  [[ "$(grep -c 'mandordantukangv3:start' "$g")" == 1 ]] && ok "re-run does not duplicate block" || bad "duplicate block"
  yes "uninstall" "${env[@]}" bash "$ROOT/scripts/install.sh" --uninstall
  hasnt "omp block removed" "mandordantukangv3:start" "$(cat "$r")"
  has "user omp rules intact" $'keep top\nkeep bottom' "$(cat "$r")"
  [[ ! -e "$home/.gemini/config/skills/mandordantukangv3" ]] && ok "agy link removed" || bad "agy link left"
  printf '<!-- mandordantukangv3:start -->\nno end\n' > "$g"
  no "unbalanced markers refused (no truncation)" "${env[@]}" bash "$ROOT/scripts/install.sh" --global-rules
  has "file untouched" "no end" "$(cat "$g")"
}
t_install_upgrade_from_v01() {
  git -C "$ROOT" cat-file -e 716364c:AGENTS.md 2>/dev/null || { ok "skip (no v0.1 history)"; return; }
  local home="$T/home" sk="$T/home/.agents/skills/mandordantukangv3"
  mkdir -p "$sk"
  git -C "$ROOT" show 716364c:AGENTS.md > "$sk/AGENTS.md"     # pristine v0.1 copy, no manifest
  printf 'mine\n' > "$sk/GEMINI.md"                           # user-edited file
  yes "install over v0.1 skill dir" env HOME="$home" XDG_DATA_HOME="$home/.local/share" bash "$ROOT/scripts/install.sh"
  cmp -s "$ROOT/AGENTS.md" "$sk/AGENTS.md" && ok "unedited v0.1 file upgraded" || bad "v0.1 file not upgraded"
  has "edited file kept" "mine" "$(cat "$sk/GEMINI.md")"
}

# ---------------- docs ----------------
# Every skills/<name>.md the agents are told to read must exist (rules/mandor.md is copied into global RULES.md).
t_skill_refs_resolve() {
  local refs r missing=""
  refs="$(cd "$ROOT" && grep -ohE 'skills/[a-z0-9-]+\.md' AGENTS.md CLAUDE.md GEMINI.md SKILL.md README.md rules/*.md skills/*.md | sort -u)"
  [[ -n "$refs" ]] || { bad "no skill references found"; return; }
  for r in $refs; do [[ -f "$ROOT/$r" ]] || missing+=" $r"; done
  [[ -z "$missing" ]] && ok "all skill references resolve" || bad "missing skill files:$missing"
}

TESTS=(t_routing_title_match t_opencode_skips_altm_flush t_routing_no_arbitrary_fallback t_routing_ambiguous t_routing_other_worktree_ignored
  t_routing_self_send_refused t_routing_layout_fallback t_routing_squad_workers t_wait_and_send_failures t_legacy_delegate_contract
  t_spec_validation t_verify_detection t_happy_path_shared t_report_autodetects_single_active_task
  t_report_from_wrong_terminal t_scope_violation_and_revert t_verify_failure_blocks_approval t_verify_timeout
  t_change_after_verify t_baseline_dirty_files t_secret_file_detection t_reject_retry_limit
  t_simple_task_not_delegated t_concurrent_shared_tasks t_isolated_task t_isolated_reject_never_lands
  t_recovery_after_send_failure t_blocked_amend_resume t_lock_stale_and_busy t_monitor_stall_and_loop t_usage_tracking t_single_mode
  t_orca_pair_binds_spawned_terminals t_install_lifecycle t_install_rollback t_install_global_rules t_install_upgrade_from_v01
  t_skill_refs_resolve)
for t in "${TESTS[@]}"; do run "$t"; done

echo
echo "passed: $PASS  failed: $FAIL"
for f in ${FAILED[@]+"${FAILED[@]}"}; do echo "  - $f"; done
[[ "$FAIL" -eq 0 ]]
