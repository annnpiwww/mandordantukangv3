#!/usr/bin/env bash
# scripts/orca-bridge.sh — Inter-Agent Relay & Cross-Platform Orchestration Bridge (mandordantukangv3)
# Architecture: Mandor (Pane 1) <--> Tukang (Pane 2) in Orca IDE

set -euo pipefail

MANDOR_VERSION="0.3.0"
SELF_PATH="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
STATE_BASE="${MANDOR_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/mandordantukangv3}"
SELF_HANDLE="${ORCA_TERMINAL_HANDLE:-}"

# One temp dir per invocation (subshells write here too); lock dirs are released on exit.
TMPD="$(mktemp -d)"
CLEANUP=("$TMPD")
cleanup() { local p; for p in "${CLEANUP[@]}"; do rm -rf -- "$p"; done; }
trap cleanup EXIT
tmpf() { mktemp "$TMPD/x.XXXXXX"; }

die() { echo "[orca-bridge] error: $*" >&2; exit 1; }
log() { echo "[orca-bridge] $*"; }
now_ms() { echo $(( $(date +%s) * 1000 )); }
key_of() { printf '%s-%s' "$(basename "$1" | tr -cd 'A-Za-z0-9._-')" "$(printf '%s' "$1" | cksum | cut -d' ' -f1)"; }

LIB=""
need_lib() {
  [[ -n "$LIB" ]] && return 0
  local c
  for c in "${MANDOR_LIB:-}" "$(dirname "$SELF_PATH")/mandor-lib.js" "${XDG_DATA_HOME:-$HOME/.local/share}/mandordantukangv3/mandor-lib.js"; do
    if [[ -n "$c" && -f "$c" ]]; then LIB="$c"; return 0; fi
  done
  die "mandor-lib.js not found (reinstall: scripts/install.sh)"
}
lib() { need_lib; node "$LIB" "$@"; }

role_of() {
  case "$1" in
    omp|claude|otak|mandor) echo mandor ;;
    agy|antigravity|gemini|worker|tukang) echo tukang ;;
    ui|tukang-ui|frontend) echo tukang-ui ;;
    coder|tukang-coder|logic|backend) echo tukang-coder ;;
    sec|security|tukang-sec|qa|tester) echo tukang-sec ;;
    *) return 1 ;;
  esac
}

# ---------- paths & state ----------
# An isolated task worktree lives under $STATE_BASE/repos/<repo>/tasks/<id>/wt; calls made from
# inside it route and store state as if made from the worktree that created the task.
ORIGIN_CWD=""
origin_cwd() {
  [[ -n "$ORIGIN_CWD" ]] && { echo "$ORIGIN_CWD"; return; }
  local cwd; cwd="$(pwd -P)"
  if [[ "$cwd" == "$STATE_BASE"/repos/*/tasks/*/wt || "$cwd" == "$STATE_BASE"/repos/*/tasks/*/wt/* ]]; then
    local tdir="${cwd%%/wt*}"
    cwd="$(lib get "$tdir/state.json" origin_cwd 2>/dev/null || echo "$cwd")"
  fi
  ORIGIN_CWD="$cwd"; echo "$cwd"
}
in_git() { git -C "$(origin_cwd)" rev-parse --git-dir >/dev/null 2>&1; }
repo_root() { git -C "$(origin_cwd)" rev-parse --show-toplevel 2>/dev/null || origin_cwd; }
pair_file() { mkdir -p "$STATE_BASE/pairs"; echo "$STATE_BASE/pairs/$(key_of "$(repo_root)").json"; }
tasks_dir() {
  in_git || die "task commands need a git repository (diff validation)"
  local common; common="$(cd "$(origin_cwd)" && cd "$(git rev-parse --git-common-dir)" && pwd -P)"
  [[ "$(basename "$common")" == .git ]] && common="$(dirname "$common")"
  local d="$STATE_BASE/repos/$(key_of "$common")/tasks"
  mkdir -p "$d"; echo "$d"
}
task_dir() {
  local id="${1:-}"
  [[ "$id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || die "invalid task id '$id'"
  local d; d="$(tasks_dir)/$id"
  [[ -f "$d/task.json" ]] || die "unknown task '$id' (orca-bridge task list)"
  echo "$d"
}
event() { printf '%s\t%s\n' "$(date -u +%FT%TZ)" "$2" >> "$1/events.log"; }
tstate() { lib get "$1/state.json" state 2>/dev/null || echo PENDING; }
set_state() { lib set "$1/state.json" state "$2" updated_at "$(now_ms)"; event "$1" "state -> $2${3:+ ($3)}"; }
require_state() {
  local cur; cur="$(tstate "$1")"; shift
  local s; for s in "$@"; do [[ "$cur" == "$s" ]] && return 0; done
  die "task is $cur; allowed here: $*"
}

# Per-task mutex: mkdir is atomic; a lock whose pid is dead is stale and reclaimed.
lock_task() {
  local l="$1/.lock" pid
  if ! mkdir "$l" 2>/dev/null; then
    pid="$(cat "$l/pid" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then die "task busy (pid $pid holds $l)"; fi
    rm -rf -- "$l"; mkdir "$l" || die "cannot lock $l"
  fi
  echo $$ > "$l/pid"; CLEANUP+=("$l")
}

# ---------- terminal routing ----------
TERMS_FILE=""
terms_file() {
  if [[ -z "$TERMS_FILE" ]]; then
    local json
    json="$(orca terminal list --json 2>/dev/null || true)"
    [[ -n "$json" ]] || die "cannot reach Orca runtime. Is Orca open?"
    TERMS_FILE="$(tmpf)"
    printf '%s' "$json" > "$TERMS_FILE"
  fi
  echo "$TERMS_FILE"
}
HANDLE=""; HANDLE_SRC=""
# resolve_handle <role> [exclude_self=1]: pair binding > title match (unique only) > Orca split layout.
resolve_handle() {
  local role="$1" excl="${2:-1}" out self=""
  terms_file >/dev/null
  [[ "$excl" == 1 ]] && self="$SELF_HANDLE"
  out="$(lib resolve "$role" "$TERMS_FILE" "$(origin_cwd)" "$self" "$(pair_file)")" || return 1
  HANDLE="${out%%$'\t'*}"; HANDLE_SRC="${out#*$'\t'}"
}
target_handle() {
  local role; role="$(role_of "$1")" || die "unknown target '$1'. Use omp|agy (mandor|tukang|ui|coder|sec)."
  resolve_handle "$role" || exit 1
  [[ -n "$SELF_HANDLE" && "$HANDLE" == "$SELF_HANDLE" ]] && die "$role resolves to this terminal ($HANDLE); refusing self-send. Fix: orca-bridge pair bind $role <handle>"
  return 0
}
# deliver <role> <handle> <text>: send + Enter; tukang (agy TUI) also gets the Alt+M queue flush.
# OpenCode panes (title "OC | ..." / "opencode") skip it: Alt+M is agy-only.
deliver() {
  orca terminal send --terminal "$2" --text "$3" --enter --json >/dev/null 2>&1 || die "send to $1 ($2) failed"
  if [[ "$1" == tukang* ]] && ! node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const t=(d.result?.terminals||[]).find(t=>t.handle===process.argv[2]);process.exit(/^OC \||opencode/i.test(t?.title||"")?0:1)' "$(terms_file)" "$2"; then
    sleep 0.15
    orca terminal send --terminal "$2" --text "$(printf '\033m')" --json >/dev/null 2>&1 || true
  fi
}

# ---------- verification ----------
detect_verify() {
  local d="$1" pm
  if [[ -f "$d/package.json" ]] && pm="$(node -e '
      const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const t = (p.scripts || {}).test;
      if (!t || /no test specified/.test(t)) process.exit(1);
      process.stdout.write(String(p.packageManager || "").split("@")[0]);' "$d/package.json" 2>/dev/null)"; then
    if [[ "$pm" == bun || -f "$d/bun.lockb" || -f "$d/bun.lock" ]]; then echo "bun run test"
    elif [[ "$pm" == pnpm || -f "$d/pnpm-lock.yaml" ]]; then echo "pnpm test"
    elif [[ "$pm" == yarn || -f "$d/yarn.lock" ]]; then echo "yarn test"
    else echo "npm test"; fi
  elif [[ -f "$d/Cargo.toml" ]]; then echo "cargo test"
  elif [[ -f "$d/go.mod" ]]; then echo "go test ./..."
  elif [[ -f "$d/pytest.ini" || -f "$d/pyproject.toml" || -f "$d/setup.cfg" || -f "$d/tox.ini" ]]; then echo "python3 -m pytest -q"
  elif [[ -f "$d/deno.json" || -f "$d/deno.jsonc" ]]; then echo "deno test"
  elif [[ -f "$d/Makefile" ]] && grep -qE '^test:' "$d/Makefile"; then echo "make test"
  else return 1; fi
}

VERIFY_RC=0; VERIFY_SECS=0
run_verify() {
  local dir="$1" cmd="$2" to="$3" logf="$4" start=$SECONDS t=""
  command -v timeout >/dev/null 2>&1 && t=timeout
  [[ -z "$t" ]] && command -v gtimeout >/dev/null 2>&1 && t=gtimeout
  VERIFY_RC=0
  if [[ -n "$t" ]]; then
    (cd "$dir" && "$t" -k 10 "$to" bash -c "$cmd") >"$logf" 2>&1 || VERIFY_RC=$?
  else
    echo "[orca-bridge] warn: no timeout(1); verify runs unbounded" >&2
    (cd "$dir" && bash -c "$cmd") >"$logf" 2>&1 || VERIFY_RC=$?
  fi
  VERIFY_SECS=$((SECONDS - start))
}

# ---------- diff accounting ----------
hash_of() { if [[ -e "$1" || -L "$1" ]]; then git hash-object --no-filters -- "$1"; else echo DELETED; fi; }
is_sensitive_name() {
  case "${1##*/}" in .env|.env.*|*.env|*.pem|*.key|*.p12|*.secret|id_rsa*|id_ed25519*) return 0 ;; esac
  return 1
}
# Baseline = files already dirty/untracked before the task (content stored as blobs so `task revert`
# can restore them) + gitignored secret files (hashed only, never written to the object store).
snapshot_baseline() {
  local root="$1" tdir="$2" e p h
  : > "$tdir/baseline.tsv"; : > "$tdir/secrets.tsv"
  while IFS= read -r -d '' e; do
    p="${e:3}"
    if [[ -e "$root/$p" ]] && ! is_sensitive_name "$p"; then h="$(git -C "$root" hash-object -w --no-filters -- "$p")"; else h="$(cd "$root" && hash_of "$p")"; fi
    printf '%s\t%s\n' "$p" "$h" >> "$tdir/baseline.tsv"
  done < <(git -C "$root" status --porcelain=v1 -z --untracked-files=all --no-renames)
  list_secrets "$root" > "$tdir/secrets.tsv"
}
list_secrets() {
  local root="$1" p
  while IFS= read -r -d '' p; do
    [[ "$p" == */ ]] && continue
    is_sensitive_name "$p" && printf '%s\t%s\n' "$p" "$(cd "$root" && hash_of "$p")"
  done < <(git -C "$root" ls-files -z --others --ignored --exclude-standard --directory)
  return 0
}
tsv_get() { awk -F'\t' -v k="$2" '$1==k {print $2; exit}' "$1"; }

# changed_shared <root> <tdir> <base>: files whose content differs from what the task started with.
changed_shared() {
  local root="$1" tdir="$2" base="$3" f b cand
  cand="$(tmpf)"
  { git -C "$root" diff --name-only --no-renames -z "$base" --; git -C "$root" ls-files -z --others --exclude-standard; } \
    | tr '\0' '\n' | sort -u > "$cand"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    b="$(tsv_get "$tdir/baseline.tsv" "$f")"
    if [[ -n "$b" && "$b" == "$(cd "$root" && hash_of "$f")" ]]; then continue; fi
    echo "$f"
  done < "$cand"
  # Baseline-dirty files restored to the base version no longer show in the diff but did change.
  while IFS=$'\t' read -r f b; do
    [[ -z "$f" ]] || grep -qxF -- "$f" "$cand" && continue
    [[ "$b" != "$(cd "$root" && hash_of "$f")" ]] && echo "$f"
  done < "$tdir/baseline.tsv"
  diff_secrets "$root" "$tdir"
}
diff_secrets() {
  local root="$1" tdir="$2" now f h
  now="$(tmpf)"
  list_secrets "$root" > "$now"
  while IFS=$'\t' read -r f h; do [[ -n "$f" && "$(tsv_get "$tdir/secrets.tsv" "$f")" != "$h" ]] && echo "$f"; done < "$now"
  while IFS=$'\t' read -r f h; do [[ -n "$f" && -z "$(tsv_get "$now" "$f")" ]] && echo "$f"; done < "$tdir/secrets.tsv"
  return 0
}
changed_iso() {
  local wt="$1" base="$2"
  git -C "$wt" add -A >/dev/null
  git -C "$wt" diff --cached --name-only --no-renames "$base"
}
fingerprint() { local dir="$1" f; while IFS= read -r f; do [[ -n "$f" ]] && printf '%s\t%s\n' "$f" "$(cd "$dir" && hash_of "$f")"; done < "$2" | cksum | cut -d' ' -f1; }

# ---------- task lifecycle ----------
task_new() {
  local spec="${1:-}" tmp id dv tdir
  [[ -n "$spec" ]] || die "usage: orca-bridge task new <spec.json|->"
  tmp="$(tmpf)"
  if [[ "$spec" == - ]]; then cat > "$tmp"; else [[ -f "$spec" ]] || die "spec not found: $spec"; cp "$spec" "$tmp"; fi
  id="t$(date +%Y%m%d-%H%M%S)-$(printf '%04x' $((RANDOM % 65536)))"
  dv="$(detect_verify "$(repo_root)" || true)"
  local out="$tmp.task"; CLEANUP+=("$out")
  lib validate "$tmp" "$out" "$id" "$dv" >&2 || exit 1
  id="$(lib get "$out" task_id)"
  tdir="$(tasks_dir)/$id"
  mkdir "$tdir" 2>/dev/null || die "task '$id' already exists (no duplicate execution)"
  mv "$out" "$tdir/task.json"
  lib set "$tdir/state.json" state PENDING retries 0 resumes 0 created_at "$(now_ms)" updated_at "$(now_ms)" origin_cwd "$(origin_cwd)" root "$(repo_root)"
  event "$tdir" "created ($(lib get "$tdir/task.json" task_type), verify: $(lib get "$tdir/task.json" verification_command) [$(lib get "$tdir/task.json" verification_source)])"
  echo "$id"
}

send_handoff() {
  local tdir="$1" attempt="$2" fix="${3:-}" wt="" msg target_worker refs
  wt="$(lib get "$tdir/state.json" isolate_dir 2>/dev/null || true)"
  msg="$(lib handoff "$tdir/task.json" "$wt" "$attempt" "$fix")"
  target_worker="$(lib get "$tdir/task.json" target_worker 2>/dev/null || echo tukang)"
  [[ -z "$target_worker" || "$target_worker" == "null" ]] && target_worker="tukang"
  # Per-role project references (read-only): docs/{design,coder,security}_references/ when the repo has them.
  case "$(role_of "$target_worker" 2>/dev/null)" in
    tukang-ui) refs="docs/design_references" ;; tukang-coder) refs="docs/coder_references" ;; tukang-sec) refs="docs/security_references" ;; *) refs="" ;;
  esac
  if [[ -n "$refs" && -d "$(lib get "$tdir/state.json" root)/$refs" ]]; then
    msg+=$'\n'"REFS $refs/ read-only, never edit: README.md first, then only the guideline sections and images relevant to this task."
  fi
  target_handle "$target_worker"
  deliver "$target_worker" "$HANDLE" "$msg"
  lib set "$tdir/state.json" tukang_handle "$HANDLE" mandor_handle "$SELF_HANDLE" target_worker "$target_worker"
  printf '{"ts":%s,"role":"tukang","kind":"handoff","source":"estimated","input":%s}\n' "$(now_ms)" $(( (${#msg} + 3) / 4 )) >> "$tdir/usage.jsonl"
  event "$tdir" "handoff sent to $HANDLE ($HANDLE_SRC, $target_worker), ${#msg} chars"
}

# ensure_monitor: one background `monitor --watch` per repo while tasks are active (it exits on its own when none are),
# so a dead/wrong terminal or a looping worker reaches Mandor as a STALL/LOOP alert instead of silence.
ensure_monitor() {
  [[ -n "${MANDOR_NO_MONITOR:-}" ]] && return 0
  local pf; pf="$STATE_BASE/monitor-$(key_of "$(repo_root)").pid"
  [[ -f "$pf" ]] && kill -0 "$(cat "$pf")" 2>/dev/null && return 0
  (cd "$(repo_root)" && setsid nohup "$SELF_PATH" monitor --watch 120 </dev/null >/dev/null 2>&1 & echo $! > "$pf")
}

task_assign() {
  local id="" force=0 a
  for a in "$@"; do case "$a" in --force) force=1 ;; *) id="$a" ;; esac; done
  local tdir; tdir="$(task_dir "$id")"
  lock_task "$tdir"
  require_state "$tdir" PENDING
  local type mode; type="$(lib get "$tdir/task.json" task_type)"; mode="$(lib get "$tdir/task.json" mode)"
  if [[ "$type" == SIMPLE && "$force" != 1 && "$mode" != single ]]; then
    die "SIMPLE task: a handoff costs more tokens than a direct edit. Mandor edits it directly (or --force)."
  fi
  local root base iso
  root="$(repo_root)"
  base="$(git -C "$root" rev-parse --verify -q HEAD)" || die "repository has no commits; commit once before delegating"
  iso="$(lib get "$tdir/task.json" isolate)"
  if [[ "$iso" != true ]]; then
    # Parallel shared-tree tasks are allowed only with disjoint allowlists; each records the other as a peer.
    local o conflict
    : > "$tdir/peers.txt"
    while IFS= read -r o; do
      [[ -z "$o" || "$o" == "$id" ]] && continue
      conflict="$(lib overlap "$tdir/task.json" "$(task_dir "$o")/task.json")" \
        || die "shared-tree task $o has overlapping allowed_files ($conflict). Wait for it, use literal disjoint paths, or \"isolate\": true."
      echo "$o" >> "$tdir/peers.txt"; echo "$id" >> "$(task_dir "$o")/peers.txt"
    done < <(lib list "$(tasks_dir)" shared | cut -f1)
  fi
  snapshot_baseline "$root" "$tdir"
  lib set "$tdir/state.json" base "$base"
  if [[ "$iso" == true ]]; then
    git -C "$root" worktree add --detach "$tdir/wt" "$base" >/dev/null 2>&1 || die "git worktree add failed"
    lib set "$tdir/state.json" isolate_dir "$tdir/wt"
    event "$tdir" "isolated worktree $tdir/wt @ ${base:0:12}"
  fi
  set_state "$tdir" ASSIGNED
  if [[ "$mode" == single ]]; then
    # Single-agent baseline (benchmarks): same gate and accounting, no handoff.
    set_state "$tdir" EXECUTING single
    log "task $id (single-agent): Mandor implements it, then: orca-bridge task check $id && orca-bridge task approve $id"
    return 0
  fi
  # Subshell so a routing/send failure (which exits) still lets us record FAILED; recover with task resume.
  if ! (send_handoff "$tdir" 0); then set_state "$tdir" FAILED "handoff delivery failed"; exit 1; fi
  set_state "$tdir" EXECUTING
  ensure_monitor
  log "task $id -> Tukang ($(lib get "$tdir/state.json" tukang_handle)). Waiting for: orca-bridge report DONE --task $id"
}

# drop_peer_files <tdir> <out>: remove files owned by parallel peer tasks (active or already closed).
drop_peer_files() {
  local tdir="$1" out="$2" p f peers=()
  [[ -s "$tdir/peers.txt" ]] || return 0
  while IFS= read -r p; do
    [[ -n "$p" && -f "$(tasks_dir)/$p/task.json" ]] && peers+=("$(tasks_dir)/$p/task.json")
  done < <(sort -u "$tdir/peers.txt")
  ((${#peers[@]})) || return 0
  f="$(tmpf)"; lib drop-peers "$tdir/task.json" "$out" "${peers[@]}" > "$f"; mv "$f" "$out"
}

# collect_changed <tdir> <out> <main_out>: sorted task change set. Isolated tasks: worktree diff plus
# secret files touched in the main tree; main-tree edits go to <main_out> (may be Mandor's own work).
collect_changed() {
  local tdir="$1" out="$2" mainf="$3" root base wt sec
  root="$(lib get "$tdir/state.json" root)"; base="$(lib get "$tdir/state.json" base)"
  wt="$(lib get "$tdir/state.json" isolate_dir 2>/dev/null || true)"
  : > "$mainf"
  if [[ -n "$wt" ]]; then
    [[ -d "$wt" ]] || return 1
    sec="$(tmpf)"; diff_secrets "$root" "$tdir" > "$sec"
    changed_shared "$root" "$tdir" "$base" | grep -vxF -f "$sec" | sort -u > "$mainf" || true
    { changed_iso "$wt" "$base"; cat "$sec"; } | sort -u > "$out"
  else
    changed_shared "$root" "$tdir" "$base" | sort -u > "$out"
    drop_peer_files "$tdir" "$out"
  fi
}

# task_check <tdir>: verification + scope, run by the bridge itself (never trusts a self-report).
# Verify runs first so files it generates are part of the checked (and fingerprinted) change set.
task_check() {
  local tdir="$1" root base wt changed scopef dir cmd to rc=0 stat fp mainf
  root="$(lib get "$tdir/state.json" root)"; base="$(lib get "$tdir/state.json" base)"
  wt="$(lib get "$tdir/state.json" isolate_dir 2>/dev/null || true)"
  dir="${wt:-$root}"
  [[ -z "$wt" || -d "$wt" ]] || { set_state "$tdir" FAILED "isolated worktree missing"; die "worktree $wt missing"; }
  set_state "$tdir" VERIFYING
  changed="$tdir/changed.txt"; scopef="$tdir/scope.json"; mainf="$tdir/main_changed.txt"
  cmd="$(lib get "$tdir/task.json" verification_command)"
  to="$(lib get "$tdir/task.json" verify_timeout)"
  if [[ "$cmd" == none ]]; then VERIFY_RC=0; VERIFY_SECS=0; else run_verify "$dir" "$cmd" "$to" "$tdir/verify.log"; fi
  collect_changed "$tdir" "$changed" "$mainf"
  if [[ -n "$wt" ]]; then
    stat="$(git -C "$wt" diff --cached --shortstat "$base" | sed 's/^ //')"
  else
    stat="$(git -C "$root" diff --shortstat "$base" | sed 's/^ //')"
    local nu; nu="$(git -C "$root" ls-files --others --exclude-standard | grep -cxF -f "$changed" || true)"
    [[ "${nu:-0}" -gt 0 ]] && stat="${stat:+$stat, }$nu untracked"
  fi
  lib scope "$tdir/task.json" "$changed" > "$scopef"
  fp="$(fingerprint "$dir" "$changed")"
  event "$tdir" "check: verify exit $VERIFY_RC in ${VERIFY_SECS}s, $(wc -l < "$changed" | tr -d ' ') changed"
  lib record-check "$tdir/state.json" "$scopef" "$cmd" "$VERIFY_RC" "$VERIFY_SECS" "$tdir/verify.log" "$fp" "${stat:-0 files}" "$mainf" || rc=$?
  set_state "$tdir" REVIEWING
  return $rc
}

task_approve() {
  local id="" allow_empty=0 a
  for a in "$@"; do case "$a" in --allow-empty) allow_empty=1 ;; *) id="$a" ;; esac; done
  local tdir; tdir="$(task_dir "$id")"
  lock_task "$tdir"
  require_state "$tdir" REVIEWING
  [[ "$(lib get "$tdir/state.json" blocked 2>/dev/null || echo false)" == true ]] && die "task is BLOCKED by Tukang; amend + resume, or reject"
  lib get "$tdir/state.json" checks >/dev/null 2>&1 || die "no check recorded; run: orca-bridge task check $id"
  [[ "$(lib get "$tdir/state.json" checks.scope.ok)" == true ]] || die "scope violation: $(lib get "$tdir/state.json" checks.scope). Revert (task revert $id --outside-only) or amend, then task check."
  local v; v="$(lib get "$tdir/state.json" checks.verify)"
  if [[ "$(lib get "$tdir/state.json" checks.verify.skipped 2>/dev/null || echo false)" != true ]]; then
    [[ "$(lib get "$tdir/state.json" checks.verify.exit)" == 0 ]] || die "verification failed: $v"
  fi
  local changed="$tdir/changed.txt" wt root dir now
  [[ -s "$changed" || "$allow_empty" == 1 ]] || die "no changes recorded (use --allow-empty if intended)"
  wt="$(lib get "$tdir/state.json" isolate_dir 2>/dev/null || true)"
  root="$(lib get "$tdir/state.json" root)"
  dir="${wt:-$root}"
  # Re-derive the change set: a file edited or added after verification must not ride along unverified.
  now="$(tmpf)"; collect_changed "$tdir" "$now" "$(tmpf)"
  if ! cmp -s "$now" "$changed" || [[ "$(fingerprint "$dir" "$now")" != "$(lib get "$tdir/state.json" checks.fingerprint)" ]]; then
    die "files changed after verification; run: orca-bridge task check $id"
  fi
  if [[ -n "$wt" ]]; then
    local patch="$tdir/approved.patch" base
    base="$(lib get "$tdir/state.json" base)"
    git -C "$wt" diff --cached --binary "$base" > "$patch"
    if [[ -s "$patch" ]]; then
      # Stale base: main committed changes to the same files after the task started; refuse before touching the tree.
      local stale
      stale="$(comm -12 <(git -C "$root" diff --name-only "$base" HEAD | sort) <(git -C "$wt" diff --cached --name-only "$base" | sort) | tr '\n' ' ')"
      [[ -z "$stale" ]] || die "stale base: main changed since task start in: $stale. Main tree untouched. Redo on current HEAD: task reject $id --final, then delegate again."
      # Plain apply is atomic; --3way was dropped because it left conflict markers in the main tree.
      git -C "$root" apply --binary "$patch" \
        || die "patch does not apply to $root (kept: $patch). Main tree untouched. Resolve, then re-run approve."
    fi
    git -C "$root" worktree remove --force "$wt" >/dev/null 2>&1 || true
    lib set "$tdir/state.json" isolate_dir null
    event "$tdir" "applied isolated patch to $root"
  fi
  lib set "$tdir/state.json" closed_at "$(now_ms)"
  set_state "$tdir" APPROVED
  usage_collect "$tdir" >/dev/null 2>&1 || true
  log "APPROVED $id. Criteria: $(lib get "$tdir/task.json" acceptance_criteria | tr '\n' ';')"
}

task_reject() {
  local id="" final=0 fix="" a
  for a in "$@"; do case "$a" in --final) final=1 ;; *) if [[ -z "$id" ]]; then id="$a"; else fix="${fix:+$fix }$a"; fi ;; esac; done
  local tdir; tdir="$(task_dir "$id")"
  lock_task "$tdir"
  require_state "$tdir" REVIEWING
  local r max
  r=$(( $(lib get "$tdir/state.json" retries) + 1 )); max="$(lib get "$tdir/task.json" max_retries)"
  [[ "$final" == 1 || "$r" -gt "$max" ]] || [[ -n "$fix" ]] || die "reject needs a targeted correction: orca-bridge task reject $id \"<what to fix>\""
  # Every correction becomes a lesson that rides along in this worker's future handoffs.
  [[ -n "$fix" ]] && { lib lesson-add "$(lib get "$tdir/task.json" target_worker 2>/dev/null || echo tukang)" reject "$id" "$fix" >/dev/null || true; }
  lib set "$tdir/state.json" blocked false
  if [[ "$final" == 1 || "$r" -gt "$max" ]]; then
    lib set "$tdir/state.json" closed_at "$(now_ms)" retries "$r"
    set_state "$tdir" REJECTED "${fix:-final}"
    usage_collect "$tdir" >/dev/null 2>&1 || true
    if [[ -n "$(lib get "$tdir/state.json" isolate_dir 2>/dev/null || true)" ]]; then
      log "REJECTED $id. Main tree untouched; drop the worktree with: orca-bridge task discard $id"
    else
      log "REJECTED $id (retry limit $max). Tukang's edits are still in the tree: inspect 'task diff $id', undo with 'task revert $id'. Mandor takes over."
    fi
    return 0
  fi
  (send_handoff "$tdir" "$r" "$fix") || die "correction not delivered; state unchanged (REVIEWING). Retry reject or task resume."
  lib set "$tdir/state.json" retries "$r"
  set_state "$tdir" EXECUTING "retry $r/$max"
  log "retry $r/$max sent to Tukang"
}

task_resume() {
  local tdir; tdir="$(task_dir "${1:-}")"
  lock_task "$tdir"
  require_state "$tdir" ASSIGNED EXECUTING VERIFYING REVIEWING FAILED
  [[ -n "$(lib get "$tdir/state.json" base 2>/dev/null || true)" ]] || die "task was never assigned; use task assign"
  lib set "$tdir/state.json" resumes $(( $(lib get "$tdir/state.json" resumes) + 1 )) blocked false
  (send_handoff "$tdir" "$(lib get "$tdir/state.json" retries)" "RESUME: continue this task where it stopped; allowed_files may have been amended.") \
    || die "resume not delivered; state unchanged"
  set_state "$tdir" EXECUTING resume
  ensure_monitor
  log "task ${1} re-sent to Tukang"
}

task_revert() {
  local id="" outside=0 a
  for a in "$@"; do case "$a" in --outside-only) outside=1 ;; *) id="$a" ;; esac; done
  local tdir; tdir="$(task_dir "$id")"
  lock_task "$tdir"
  [[ -z "$(lib get "$tdir/state.json" isolate_dir 2>/dev/null || true)" ]] || die "isolated task: nothing in the main tree to revert (use task discard)"
  local root base f b list
  root="$(lib get "$tdir/state.json" root)"; base="$(lib get "$tdir/state.json" base)"
  list="$(tmpf)"
  if [[ "$outside" == 1 ]]; then
    node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const f of [...s.out_of_scope,...s.sensitive])console.log(f)' "$tdir/scope.json" | sort -u > "$list"
  else
    changed_shared "$root" "$tdir" "$base" | sort -u > "$list"
  fi
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    b="$(tsv_get "$tdir/baseline.tsv" "$f")"
    if is_sensitive_name "$f" && [[ -z "$b" ]] && [[ -n "$(tsv_get "$tdir/secrets.tsv" "$f")" ]]; then
      echo "[orca-bridge] cannot restore secret file '$f' (never copied); fix it by hand" >&2; continue
    fi
    if [[ "$b" == DELETED ]]; then rm -f -- "$root/$f"
    elif [[ -n "$b" ]] && git -C "$root" cat-file -e "$b" 2>/dev/null; then mkdir -p "$(dirname "$root/$f")"; git -C "$root" cat-file blob "$b" > "$root/$f"
    elif git -C "$root" cat-file -e "$base:$f" 2>/dev/null; then mkdir -p "$(dirname "$root/$f")"; git -C "$root" show "$base:$f" > "$root/$f"
    else rm -f -- "$root/$f"; fi
    echo "reverted $f"
  done < "$list"
  event "$tdir" "revert ($([[ $outside == 1 ]] && echo outside-only || echo all))"
  [[ "$(tstate "$tdir")" == REVIEWING ]] && log "re-run: orca-bridge task check $id"
  return 0
}

task_diff() {
  local id="" statonly=0 a
  for a in "$@"; do case "$a" in --stat) statonly=1 ;; *) id="$a" ;; esac; done
  local tdir root base wt f
  tdir="$(task_dir "$id")"
  root="$(lib get "$tdir/state.json" root)"; base="$(lib get "$tdir/state.json" base 2>/dev/null)" || die "task not assigned yet"
  wt="$(lib get "$tdir/state.json" isolate_dir 2>/dev/null || true)"
  local flag=(--no-ext-diff); [[ "$statonly" == 1 ]] && flag+=(--stat)
  if [[ -n "$wt" ]]; then git -C "$wt" add -A >/dev/null; git -C "$wt" --no-pager diff --cached "${flag[@]}" "$base"; return; fi
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if git -C "$root" cat-file -e "$base:$f" 2>/dev/null; then git -C "$root" --no-pager diff "${flag[@]}" "$base" -- "$f"
    elif [[ -e "$root/$f" ]]; then git -C "$root" --no-pager diff --no-index "${flag[@]}" /dev/null "$root/$f" || true; fi
  done < <(changed_shared "$root" "$tdir" "$base" | sort -u)
}

usage_collect() {
  local tdir="$1" from to out
  from="$(lib get "$tdir/state.json" created_at)"; to="$(lib get "$tdir/state.json" closed_at 2>/dev/null || now_ms)"
  out="$(lib usage-omp "${MANDOR_OMP_SESSIONS:-$HOME/.omp/agent/sessions}" "$(lib get "$tdir/state.json" origin_cwd)" "$from" "$to")" || return 1
  # Replace any earlier collector rows so repeated collects don't double count.
  if [[ -f "$tdir/usage.jsonl" ]]; then grep -vE '"kind":"(omp|agy)-session"' "$tdir/usage.jsonl" > "$tdir/usage.jsonl.tmp" || true; mv "$tdir/usage.jsonl.tmp" "$tdir/usage.jsonl"; fi
  printf '%s\n' "${out%\}},\"ts\":$(now_ms)}" >> "$tdir/usage.jsonl"
  local agy
  if agy="$(lib usage-agy "${AGY_BRAIN_DIR:-$HOME/.gemini/antigravity-cli/brain}" "$(lib get "$tdir/task.json" task_id)" "$from" "$to" 2>/dev/null)"; then
    printf '%s\n' "${agy%\}},\"ts\":$(now_ms)}" >> "$tdir/usage.jsonl"
  fi
  echo "$out"
}

usage_add() {
  local id="${1:-}"; shift || true
  local tdir role="" model="" in="" out="" cost="" calls=1 src="" note=""
  tdir="$(task_dir "$id")"
  while [[ $# -gt 0 ]]; do
    [[ $# -ge 2 ]] || die "flag $1 needs a value"
    case "$1" in
      --role) role="$2" ;; --model) model="$2" ;;
      --in) in="$2" ;; --out) out="$2" ;;
      --cost) cost="$2" ;; --calls) calls="$2" ;;
      --source) src="$2" ;; --note) note="$2" ;;
      *) die "unknown flag $1" ;;
    esac
    shift 2
  done
  [[ "$role" == mandor || "$role" == tukang ]] || die "--role mandor|tukang required"
  [[ "$src" == actual || "$src" == estimated ]] || die "--source actual|estimated required (never present estimates as actual)"
  [[ "$in" =~ ^[0-9]+$ && "$out" =~ ^[0-9]+$ && "$calls" =~ ^[0-9]+$ ]] || die "--in/--out/--calls must be integers"
  [[ -z "$cost" || "$cost" =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "--cost must be a number (USD)"
  node -e 'const [ts,role,model,i,o,cost,calls,src,note]=process.argv.slice(1);
    const r={ts:+ts,role,kind:"manual",source:src,input:+i,output:+o,calls:+calls};
    if(model)r.model=model; if(cost)r.cost=+cost; if(note)r.note=note; console.log(JSON.stringify(r));' \
    "$(now_ms)" "$role" "$model" "$in" "$out" "$cost" "$calls" "$src" "$note" >> "$tdir/usage.jsonl"
  log "usage recorded for $id ($role, $src)"
}

# ---------- commands ----------
command="${1:-status}"

case "$command" in
  # 1. CORE RELAY: Send message
  send)
    target="${2:-}"
    shift 2 || true
    message="$*"
    if [[ -z "$target" || -z "$message" ]]; then
      echo "Usage: orca-bridge send <omp|agy> <message>" >&2
      exit 1
    fi
    target_handle "$target"
    log "Sending to $target ($HANDLE via $HANDLE_SRC)..."
    deliver "$(role_of "$target")" "$HANDLE" "$message"
    log "Sent."
    ;;

  # 2. CORE RELAY: Read terminal
  read)
    target="${2:-}"
    limit="${3:-40}"
    if [[ -z "$target" ]]; then
      echo "Usage: orca-bridge read <omp|agy> [lines]" >&2
      exit 1
    fi
    role="$(role_of "$target")" || die "unknown target '$target'"
    resolve_handle "$role" 0 || exit 1
    orca terminal read --terminal "$HANDLE" --limit "$limit" 2>/dev/null || orca terminal show --terminal "$HANDLE"
    ;;

  # 3. CORE RELAY: Wait for idle (exit 1 when not confirmed; never a false "ready")
  wait)
    target="${2:-}"
    timeout_ms="${3:-60000}"
    if [[ -z "$target" ]]; then
      echo "Usage: orca-bridge wait <omp|agy> [timeout_ms]" >&2
      exit 1
    fi
    [[ "$timeout_ms" =~ ^[0-9]+$ ]] || die "timeout_ms must be an integer"
    role="$(role_of "$target")" || die "unknown target '$target'"
    resolve_handle "$role" 0 || exit 1
    log "Waiting for $target ($HANDLE) to become idle (timeout: ${timeout_ms}ms)..."
    if orca terminal wait --terminal "$HANDLE" --for tui-idle --timeout-ms "$timeout_ms" --json >/dev/null 2>&1; then
      log "$target is idle."
    else
      log "$target NOT confirmed idle (timeout or terminal gone)."
      exit 1
    fi
    ;;

  # 4. DELEGATE TASK: Mandor -> Tukang
  #    Structured: delegate --spec <file|-> [--force]   (validated JSON handoff, task state, bridge-run verify)
  #    Legacy:     delegate <title> <details>          (details must name Allowed Files + Verify Command)
  delegate)
    shift || true
    worker="tukang"
    if [[ "${1:-}" == --to ]]; then
      worker="$(role_of "${2:-}")" || die "unknown worker role '${2:-}'. Use ui|coder|sec|tukang"
      shift 2 || true
    fi
    pre_force=()
    if [[ "${1:-}" == --force && "${2:-}" == --spec ]]; then pre_force=(--force); shift; fi
    if [[ "${1:-}" == --spec ]]; then
      spec="${2:-}"; shift 2 || true
      id="$(task_new "$spec")"
      if [[ "$worker" != "tukang" ]]; then
        lib set "$(task_dir "$id")/task.json" target_worker "$worker"
      fi
      task_assign "$id" "$@" "${pre_force[@]}"
      exit 0
    fi
    force=0
    if [[ "${1:-}" == --force ]]; then force=1; shift; fi
    title="${1:-}"
    shift || true
    details="$*"
    details="${details//\\n/$'\n'}"
    if [[ -z "$title" ]]; then
      echo "Usage: orca-bridge delegate [--to <worker>] --spec <spec.json|-> | delegate [--to <worker>] [--force] <task_title> <instructions>" >&2
      exit 1
    fi
    if [[ "$force" != 1 ]] && ! { grep -qi 'allowed files' <<<"$details" && grep -qi 'verify command' <<<"$details"; }; then
      die "Anti-Handoff-Leak: instructions need 'Allowed Files:' and 'Verify Command:' (or use --spec / --force)"
    fi
    formatted="[TASK DARI MANDOR${worker:+ | ${worker^^}}]
📌 Title: $title
📋 Detail & Instruksi:
$details

⚡ Catatan Eksekusi:
- Sentuh HANYA Allowed Files; jangan scan repo.
- Verifikasi pakai Verify Command dari Mandor di atas (bukan default npm test).
- Selesai: orca-bridge report DONE \"<ringkas>\" | butuh file lain: orca-bridge report BLOCKED \"<file>: <alasan>\""
    target_handle "$worker"
    log "Delegating task '$title' to $worker ($HANDLE via $HANDLE_SRC)..."
    deliver "$worker" "$HANDLE" "$formatted"
    log "Task delegated."
    ;;

  # 5. REPORT TASK: Tukang -> Mandor. With a task, the bridge runs scope + verify itself and
  #    attaches the evidence, so Mandor reviews facts instead of re-exploring.
  report)
    shift || true
    id=""
    if [[ "${1:-}" == --task ]]; then id="${2:-}"; shift 2 || true; fi
    status="${1:-DONE}"
    shift || true
    if [[ "${1:-}" == --task ]]; then id="${2:-}"; shift 2 || true; fi
    summary="$*"
    if [[ -z "$summary" ]]; then
      echo "Usage: orca-bridge report <DONE|PLAN|QUESTION|NEEDS_REVISION|BLOCKED> [--task <id>] <summary...>" >&2
      exit 1
    fi
    case "$status" in DONE|PLAN|QUESTION|NEEDS_REVISION|BLOCKED) ;; *) die "status must be DONE|PLAN|QUESTION|NEEDS_REVISION|BLOCKED" ;; esac
    if [[ -z "$id" ]] && in_git; then
      active="$(lib list "$(tasks_dir)" active | awk -F'\t' '$2=="EXECUTING"{print $1}')"
      [[ "$(grep -c . <<<"$active")" == 1 ]] && id="$active"
    fi
    check=""
    if [[ -n "$id" ]]; then
      tdir="$(task_dir "$id")"
      lock_task "$tdir"
      require_state "$tdir" EXECUTING
      th="$(lib get "$tdir/state.json" tukang_handle 2>/dev/null || true)"
      [[ -n "$SELF_HANDLE" && -n "$th" && "$SELF_HANDLE" != "$th" ]] && die "task $id belongs to terminal $th, not $SELF_HANDLE"
      event "$tdir" "report $status: $summary"
      if [[ "$status" == DONE ]]; then
        check="$(task_check "$tdir" || true)"
      elif [[ "$status" == PLAN || "$status" == QUESTION ]]; then
        :
      else
        lib set "$tdir/state.json" blocked true
        set_state "$tdir" REVIEWING "$status"
      fi
    fi
    # PLAN is non-blocking: log only, do not wake Mandor (each wake re-sends its whole context).
    if [[ "$status" == PLAN && -n "$id" ]]; then
      log "Plan logged. Mandor is not woken; keep working and report DONE/QUESTION/BLOCKED."
      exit 0
    fi
    formatted="[TUKANG REPORT${id:+ $id} $status] $summary"
    [[ -n "$check" ]] && formatted+=$'\n'"$check"
    if [[ -n "$id" ]]; then
      if [[ "$status" == DONE ]]; then
        formatted+=$'\n'"NEXT orca-bridge task approve $id | task reject $id \"<fix>\" | task diff $id"
      elif [[ "$status" == PLAN ]]; then
        formatted+=$'\n'"NEXT (non-blocking, worker continues) wrong plan: orca-bridge send <ui|coder|sec> \"CORRECTION $id: <fix>\""
      elif [[ "$status" == QUESTION ]]; then
        formatted+=$'\n'"NEXT (worker waits) orca-bridge send <ui|coder|sec> \"ANSWER $id: <answer>\"  (ask the user first if it is their decision)"
      else
        formatted+=$'\n'"NEXT orca-bridge task amend $id --allow <file> && task resume $id | task reject $id --final"
      fi
    else
      formatted+=$'\n'"Review git diff + jalankan Verify Command sebelum approve."
    fi
    target_handle omp
    if [[ -n "$id" ]]; then
      printf '{"ts":%s,"role":"mandor","kind":"handoff","source":"estimated","input":%s}\n' "$(now_ms)" $(( (${#formatted} + 3) / 4 )) >> "$tdir/usage.jsonl"
    fi
    log "Sending report to Mandor ($HANDLE via $HANDLE_SRC)..."
    deliver mandor "$HANDLE" "$formatted"
    [[ -n "$id" ]] && event "$tdir" "report delivered to mandor $HANDLE ($HANDLE_SRC)"
    [[ -n "$check" ]] && echo "$check"
    log "Report sent."
    ;;

  # 6. TASK STATE MACHINE
  task)
    sub="${2:-list}"
    shift 2 || true
    case "$sub" in
      new) task_new "$@" ;;
      assign) task_assign "$@" ;;
      check)
        tdir="$(task_dir "${1:-}")"; lock_task "$tdir"
        require_state "$tdir" EXECUTING VERIFYING REVIEWING
        task_check "$tdir"
        ;;
      approve) task_approve "$@" ;;
      reject) task_reject "$@" ;;
      resume) task_resume "$@" ;;
      revert) task_revert "$@" ;;
      amend)
        id="${1:-}"; shift || true
        [[ "${1:-}" == --allow && $# -ge 2 ]] || die "usage: orca-bridge task amend <id> --allow <path>..."
        shift
        tdir="$(task_dir "$id")"; lock_task "$tdir"
        require_state "$tdir" PENDING EXECUTING REVIEWING
        allowed="$(lib amend-allow "$tdir/task.json" "$@")" || exit 1
        log "allowed_files: $allowed"
        event "$tdir" "amend allow: $*"
        ;;
      fail)
        id="${1:-}"; shift || true
        tdir="$(task_dir "$id")"; lock_task "$tdir"
        require_state "$tdir" PENDING ASSIGNED EXECUTING VERIFYING REVIEWING
        lib set "$tdir/state.json" closed_at "$(now_ms)"
        set_state "$tdir" FAILED "${*:-manual}"
        log "FAILED $id. Recover with: orca-bridge task resume $id"
        ;;
      discard)
        tdir="$(task_dir "${1:-}")"; lock_task "$tdir"
        require_state "$tdir" REJECTED FAILED
        wt="$(lib get "$tdir/state.json" isolate_dir 2>/dev/null || true)"
        if [[ -n "$wt" ]]; then
          git -C "$(lib get "$tdir/state.json" root)" worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf -- "$wt"
          lib set "$tdir/state.json" isolate_dir null
        fi
        event "$tdir" "discarded worktree"
        log "discarded ${1}"
        ;;
      diff) task_diff "$@" ;;
      status)
        tdir="$(task_dir "${1:-}")"
        echo "state: $(tstate "$tdir")"
        lib get "$tdir/state.json" checks 2>/dev/null && echo || true
        ;;
      list) lib list "$(tasks_dir)" "${1:-all}" ;;
      log)
        tdir="$(task_dir "${1:-}")"
        cat "$tdir/events.log"
        [[ -f "$tdir/verify.log" ]] && { echo "--- verify.log (tail)"; tail -n 30 "$tdir/verify.log"; }
        ;;
      *) echo "Usage: orca-bridge task <new|assign|check|approve|reject|resume|revert|amend|fail|discard|diff|status|list|log>" >&2; exit 1 ;;
    esac
    ;;

  # 7. TOKEN EFFICIENCY TRACKER
  usage)
    sub="${2:-report}"
    shift 2 || true
    case "$sub" in
      add) usage_add "$@" ;;
      collect) usage_collect "$(task_dir "${1:-}")" || die "no omp usage found for this task window" ;;
      report) lib usage-report "$(tasks_dir)" "$@" ;;
      compare) lib usage-compare "$(tasks_dir)" ;;
      *) echo "Usage: orca-bridge usage <add <id> --role R --in N --out N --source actual|estimated [--model M --cost USD --calls N]|collect <id>|report [id] [--csv]|compare>" >&2; exit 1 ;;
    esac
    ;;

  # 8. PAIR BINDING: deterministic terminal routing
  pair)
    sub="${2:-show}"
    case "$sub" in
      bind)
        role="$(role_of "${3:-}")" || die "usage: orca-bridge pair bind <mandor|tukang|ui|coder|sec> <handle>"
        h="${4:-}"
        [[ "$h" == term_* ]] || die "handle must look like term_..."
        node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.exit((d.result?.terminals||[]).some(t=>t.handle===process.argv[2])?0:1)' "$(terms_file)" "$h" \
          || die "handle $h is not a live Orca terminal"
        lib set "$(pair_file)" "$role" "$h" worktree "$(repo_root)"
        log "bound $role -> $h"
        ;;
      show) cat "$(pair_file)" 2>/dev/null || echo "{} (no binding; routing uses title/layout match)" ;;
      clear) rm -f -- "$(pair_file)"; log "binding cleared" ;;
      *) echo "Usage: orca-bridge pair <bind <mandor|tukang> <handle>|show|clear>" >&2; exit 1 ;;
    esac
    ;;

  detect-verify) detect_verify "${2:-$(repo_root)}" || { echo "none detected" >&2; exit 1; } ;;

  # 9. BROWSER INSPECTION: Shared Orca Browser
  browser)
    subcmd="${2:-snapshot}"
    terms_file >/dev/null
    # Orca worktree containing cwd (longest match), else cwd: browser tabs are keyed by Orca worktree.
    wt="$(node -e '
      const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const cwd = process.argv[2];
      const hit = (d.result?.terminals || []).map(t => t.worktreePath).filter(p => p && (cwd === p || cwd.startsWith(p + "/")))
        .sort((a, b) => b.length - a.length)[0];
      process.stdout.write(hit || cwd);' "$TERMS_FILE" "$(origin_cwd)")"
    wt_arg=()
    if [[ -n "$wt" ]]; then
      wt_arg=(--worktree "path:$wt")
    fi

    case "$subcmd" in
      snapshot)
        echo "[orca-bridge] Taking accessibility DOM tree snapshot in $wt..."
        orca snapshot "${wt_arg[@]}"
        ;;
      screenshot)
        out="${3:-/tmp/orca-screenshot.png}"
        mkdir -p "$(dirname "$out")"
        echo "[orca-bridge] Capturing screenshot to $out..."
        orca screenshot "${wt_arg[@]}" --json 2>/dev/null | node -e '
          let buf = "";
          process.stdin.on("data", c => buf += c);
          process.stdin.on("end", () => {
            try {
              const d = JSON.parse(buf);
              if (d.result?.data) {
                const b = Buffer.from(d.result.data, "base64");
                require("fs").writeFileSync(process.argv[1], b);
                console.log("[orca-bridge] Screenshot saved: " + process.argv[1] + " (" + b.length + " bytes)");
              } else {
                console.error("[orca-bridge] Screenshot failed: " + (d.error?.message || "No data"));
                process.exitCode = 1;
              }
            } catch (e) {
              console.error("[orca-bridge] Screenshot error: " + e.message);
              process.exitCode = 1;
            }
          });
        ' "$out"
        ;;
      errors|console)
        echo "[orca-bridge] Checking browser console entries in $wt..."
        orca console --limit 50 "${wt_arg[@]}" --json 2>/dev/null | node -e '
          const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
          const msgs = data.result?.messages || [];
          if (msgs.length === 0) { console.log("No console errors/warnings recorded."); process.exit(0); }
          for (const m of msgs) {
            console.log(`[${m.type.toUpperCase()}] ${m.text}`);
          }
        '
        ;;
      network)
        echo "[orca-bridge] Checking recent browser network requests in $wt..."
        orca network --limit 50 "${wt_arg[@]}" --json 2>/dev/null | node -e '
          const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
          const reqs = data.result?.requests || [];
          if (reqs.length === 0) { console.log("No network logs recorded."); process.exit(0); }
          for (const r of reqs.slice(-20)) {
            console.log(`${r.status || "---"} ${r.method || "GET"} ${r.url}`);
          }
        '
        ;;
      open|goto)
        url="${3:-http://localhost:3999}"
        echo "[orca-bridge] Navigating browser to $url..."
        orca goto --url "$url" "${wt_arg[@]}" 2>/dev/null || orca tab create --url "$url" "${wt_arg[@]}"
        ;;
      *)
        echo "Usage: orca-bridge browser <snapshot|screenshot|errors|network|goto <url>>" >&2
        exit 1
        ;;
    esac
    ;;

  # 10. WORKTREE HELPER: Git worktree management
  worktree)
    subcmd="${2:-list}"
    case "$subcmd" in
      list)
        orca worktree list
        ;;
      create)
        wt_name="${3:-}"
        if [[ -z "$wt_name" ]]; then
          echo "Usage: orca-bridge worktree create <name>" >&2
          exit 1
        fi
        echo "[orca-bridge] Creating isolated worktree '$wt_name'..."
        orca worktree create --name "$wt_name"
        ;;
      current)
        orca worktree current
        ;;
      *)
        echo "Usage: orca-bridge worktree <list|create <name>|current>" >&2
        exit 1
        ;;
    esac
    ;;

  # 11a. MEMORY: lessons for workers, user complaints, Mandor's scorecard
  lesson)
    case "${2:-list}" in
      add) [[ $# -ge 4 ]] || die 'usage: orca-bridge lesson add <ui|coder|sec|all> "<rule the worker must not break again>"'
           lib lesson-add "$3" manual - "${@:4}" ;;
      list) lib lessons "${3:-}" ;;
      *) die "usage: orca-bridge lesson <add <role|all> <text>|list [role]>" ;;
    esac
    ;;
  complaint)
    case "${2:-list}" in
      add) [[ $# -ge 4 ]] || die 'usage: orca-bridge complaint add "<topic>" "<what the user said>"'
           lib complaint-add "$3" "${@:4}" ;;
      list) lib complaints ;;
      *) die "usage: orca-bridge complaint <add <topic> <text>|list>" ;;
    esac
    ;;
  scorecard) lib scorecard "${2:-1}" ;;

  # 11b. MONITOR: health of active tasks (STALL = no file/event activity, LOOP = repeated polls/kills/reruns).
  #      monitor            one-shot table for Mandor
  #      monitor --watch N  re-check every N s (>=30); alert Mandor once per new STALL/LOOP; exits when no active task
  monitor)
    shift || true
    watch=0; interval=120
    if [[ "${1:-}" == --watch ]]; then watch=1; interval="${2:-120}"; fi
    [[ "$interval" =~ ^[0-9]+$ && "$interval" -ge 30 ]] || die "interval must be an integer >= 30 seconds"
    stall_min="${MANDOR_STALL_MIN:-15}"
    [[ "$stall_min" =~ ^[0-9]+$ ]] || die "MANDOR_STALL_MIN must be an integer"
    while :; do
      TERMS_FILE=""
      ids="$(lib list "$(tasks_dir)" active | cut -f1 || true)"
      if [[ -z "$ids" ]]; then echo "no active tasks"; exit 0; fi
      now_s="$(date +%s)"
      while IFS= read -r id; do
        [[ -n "$id" ]] || continue
        tdir="$(task_dir "$id")"; st="$(tstate "$tdir")"
        worker="$(lib get "$tdir/state.json" target_worker 2>/dev/null || echo tukang)"
        handle="$(lib get "$tdir/state.json" tukang_handle 2>/dev/null || true)"
        root="$(lib get "$tdir/state.json" isolate_dir 2>/dev/null || lib get "$tdir/state.json" root 2>/dev/null || repo_root)"
        last=0
        while IFS= read -r f; do
          [[ -n "$f" && -e "$root/$f" ]] || continue
          m="$(stat -c %Y "$root/$f" 2>/dev/null || echo 0)"; (( m > last )) && last="$m"
        done < <(lib get "$tdir/task.json" allowed_files 2>/dev/null || true)
        ev="$(tail -n 1 "$tdir/events.log" 2>/dev/null | cut -f1)"
        ev_s="$(date -d "$ev" +%s 2>/dev/null || echo 0)"; (( ev_s > last )) && last="$ev_s"
        idle=$(( (now_s - last) / 60 ))
        sig="polls=0 kills=0 rerun=0"
        if [[ -n "$handle" ]]; then
          sig="$(orca terminal read --terminal "$handle" --limit 150 --json 2>/dev/null | node -e '
            let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => {
              let tail = []; try { tail = JSON.parse(s).result.terminal.tail || []; } catch { process.stdout.write("polls=? kills=? rerun=?"); return; }
              const polls = tail.filter((l) => /ManageTask\(status/.test(l)).length;
              const kills = tail.filter((l) => /ManageTask\(kill/.test(l)).length;
              const runs = {}; for (const l of tail) { const m = /● Bash\((.*)\)/.exec(l); if (m) runs[m[1]] = (runs[m[1]] || 0) + 1; }
              const rerun = Math.max(0, ...Object.values(runs));
              process.stdout.write(`polls=${polls} kills=${kills} rerun=${rerun}`);
            });' 2>/dev/null || echo "polls=? kills=? rerun=?")"
        fi
        polls="${sig#polls=}"; polls="${polls%% *}"; kills="${sig#*kills=}"; kills="${kills%% *}"; rerun="${sig##*rerun=}"
        verdict=OK
        if [[ "$st" != EXECUTING && "$st" != ASSIGNED ]]; then verdict="-"
        elif [[ "$polls" =~ ^[0-9]+$ ]] && (( polls >= 4 || kills >= 2 || rerun >= 3 )); then verdict=LOOP
        elif (( idle >= stall_min )); then verdict=STALL
        fi
        printf '%s\t%s\t%s\tidle %sm\t%s\t%s\n' "$id" "$worker" "$st" "$idle" "$sig" "$verdict"
        if [[ "$watch" == 1 ]]; then
          prev="$(lib get "$tdir/state.json" monitor_alert 2>/dev/null || echo OK)"
          if [[ ( "$verdict" == LOOP || "$verdict" == STALL ) && "$verdict" != "$prev" ]]; then
            if resolve_handle mandor 0 2>/dev/null; then
              deliver mandor "$HANDLE" "[MONITOR $id $verdict] $worker idle ${idle}m, $sig
NEXT orca-bridge read $worker 150 | orca-bridge send $worker \"CORRECTION $id: <fix>\" | orca-bridge task resume $id"
              event "$tdir" "monitor alert $verdict ($sig, idle ${idle}m)"
            fi
          fi
          [[ "$verdict" == LOOP || "$verdict" == STALL ]] || verdict=OK
          lib set "$tdir/state.json" monitor_alert "$verdict" >/dev/null
        fi
      done <<< "$ids"
      [[ "$watch" == 1 ]] || exit 0
      sleep "$interval"
    done
    ;;

  # 11. STATUS OVERVIEW
  status)
    m="not found"; a="not found"; u="not found"; c="not found"; s="not found"
    if resolve_handle mandor 0 2>/dev/null; then m="$HANDLE ($HANDLE_SRC)"; fi
    if resolve_handle tukang 0 2>/dev/null; then a="$HANDLE ($HANDLE_SRC)"; fi
    if resolve_handle tukang-ui 0 2>/dev/null; then u="$HANDLE ($HANDLE_SRC)"; fi
    if resolve_handle tukang-coder 0 2>/dev/null; then c="$HANDLE ($HANDLE_SRC)"; fi
    if resolve_handle tukang-sec 0 2>/dev/null; then s="$HANDLE ($HANDLE_SRC)"; fi
    active="-"
    if in_git; then active="$(lib list "$(tasks_dir)" active | cut -f1,2 | tr '\t\n' ': ' || true)"; fi
    echo "=========================================================="
    echo " 🪐 Orca Dual-Engine Multi-Agent Bridge Status (v$MANDOR_VERSION)"
    echo "=========================================================="
    echo " [PANE 1] Mandor (OMP / Claude) : $m"
    echo " [PANE 2] Tukang (Antigravity)  : $a"
    if [[ "$u" != "not found" || "$c" != "not found" || "$s" != "not found" ]]; then
      echo " [SQUAD WORKERS]"
      [[ "$u" != "not found" ]] && echo "  • Tukang UI/UX    : $u"
      [[ "$c" != "not found" ]] && echo "  • Tukang Coder    : $c"
      [[ "$s" != "not found" ]] && echo "  • Tukang Security : $s"
    fi
    echo " [WORKTREE] $(repo_root)"
    echo " [ACTIVE TASKS] ${active:--}"
    echo "----------------------------------------------------------"
    echo " Perintah Cepat:"
    echo " • orca-bridge delegate [--to <ui|coder|sec>] --spec task.json"
    echo " • orca-bridge report DONE --task <id> <text>   (Tukang -> Mandor, auto verify)"
    echo " • orca-bridge task approve|reject <id>         (gate Mandor)"
    echo " • orca-bridge usage report                     (token tracker)"
    echo " • orca-bridge pair bind <mandor|tukang|ui|coder|sec> <handle>"
    echo " • orca-bridge browser <snapshot|screenshot|errors|network>"
    echo "=========================================================="
    ;;

  version|--version|-v) echo "orca-bridge $MANDOR_VERSION" ;;

  *)
    echo "Usage: orca-bridge <send|read|wait|delegate|report|task|usage|pair|detect-verify|browser|worktree|monitor|status|version> [args...]"
    exit 1
    ;;
esac
