#!/usr/bin/env bash
# scripts/install.sh — Installer for Mandor dan Tukang (Orca Dual-Engine Architecture)
# Usage: scripts/install.sh [--force] [--global-rules] | --uninstall
#   --force         overwrite skill files you customized (a backup is kept)
#   --global-rules  make the flow global: Mandor block in ~/.omp/agent/RULES.md (omp), Tukang block in
#                   ~/.gemini/GEMINI.md (agy), skill link for agy. Marker-delimited, backed up, re-run safe.
#   --uninstall     remove installed binaries/lib + global blocks (restores the newest backup of each binary)
set -Eeuo pipefail

INSTALL_BIN_DIR="${INSTALL_BIN_DIR:-${HOME}/.local/bin}"
SKILLS_DIR="${MANDOR_HOME:-${SKILLS_DIR:-${HOME}/.agents/skills/mandordantukangv3}}"
SHARE_DIR="${SHARE_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mandordantukangv3}"
MARKER="mandordantukangv3"
OMP_RULES="${OMP_RULES:-$HOME/.omp/agent/RULES.md}"
AGY_RULES="${AGY_RULES:-$HOME/.gemini/GEMINI.md}"
AGY_SKILLS="${AGY_SKILLS:-$HOME/.gemini/config/skills}"
START="<!-- mandordantukangv3:start -->"
END="<!-- mandordantukangv3:end -->"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
NEW_VERSION="$(cat "$ROOT_DIR/VERSION" 2>/dev/null || sed -n 's/^MANDOR_VERSION="\(.*\)"/\1/p' "$SCRIPT_DIR/orca-bridge.sh")"
NEW_VERSION="${NEW_VERSION:-0.3.0}"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$SHARE_DIR/backups/$TS"

mode=install force=0 global=0
for a in "$@"; do
  case "$a" in
    --force) force=1 ;;
    --global-rules) global=1 ;;
    --uninstall) mode=uninstall ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 1 ;;
  esac
done

say() { echo "🪐 [mandordantukangv3] $*"; }
sum_of() { cksum < "$1" | cut -d' ' -f1; }

# set_block <file> <content-file|"">: replace the marker block (append if absent); "" removes it.
# Writes in place (keeps symlinks/inode); the previous file is backed up first.
set_block() {
  local f="$1" src="$2" tmp ns ne
  [[ -f "$f" || -n "$src" ]] || return 0
  mkdir -p "$(dirname "$f")"; touch "$f"
  ns="$(grep -cxF -- "$START" "$f" || true)"; ne="$(grep -cxF -- "$END" "$f" || true)"
  [[ "$ns" == "$ne" && "$ns" -le 1 ]] || { echo "❌ $f has unbalanced $MARKER markers; fix by hand" >&2; return 1; }
  tmp="$(mktemp)"
  awk -v s="$START" -v e="$END" -v src="$src" '
    function emit(  l) { print s; while ((getline l < src) > 0) print l; close(src); print e }
    $0 == s { skip = 1; if (src != "") emit(); done = 1; next }
    $0 == e { skip = 0; next }
    !skip { print }
    END { if (!done && src != "") { print ""; emit() } }' "$f" > "$tmp"
  if ! cmp -s "$tmp" "$f"; then
    mkdir -p "$BACKUP_DIR/rules"
    cp "$f" "$BACKUP_DIR/rules/$(printf '%s' "$f" | tr '/' '_')"
    cat "$tmp" > "$f"
    say "$([[ -n "$src" ]] && echo updated || echo removed) $MARKER block in $f"
  fi
  rm -f "$tmp"
}

# A skill file identical to any released version of itself is ours to upgrade (covers installs
# that predate the manifest).
released_blob() {
  git -C "$ROOT_DIR" rev-parse -q --git-dir >/dev/null 2>&1 || return 1
  local h raw
  h="$(git hash-object --no-filters -- "$2")"
  raw="$(git -C "$ROOT_DIR" log --all --format= --raw --no-abbrev -- "$1" 2>/dev/null || true)"
  [[ "$raw" == *"$h"* ]]
}

# ---------- uninstall ----------
if [[ "$mode" == uninstall ]]; then
  for b in orca-bridge orca-pair orca-squad; do
    dest="$INSTALL_BIN_DIR/$b"
    if [[ -f "$dest" && ! -L "$dest" ]] && grep -q "$MARKER" "$dest"; then
      rm -f "$dest"; say "removed $dest"
      last="$(ls -1d "$SHARE_DIR"/backups/*/bin/"$b" 2>/dev/null | sort | tail -n 1 || true)"
      if [[ -n "$last" ]]; then cp -P "$last" "$dest"; say "restored previous $b from $last"; fi
    else
      say "skip $dest (not installed by $MARKER)"
    fi
  done
  rm -f "$SHARE_DIR/mandor-lib.js" "$SHARE_DIR/VERSION" "$SHARE_DIR/manifest.tsv"
  set_block "$OMP_RULES" ""
  set_block "$AGY_RULES" ""
  if [[ -L "$AGY_SKILLS/mandordantukangv3" ]]; then rm -f "$AGY_SKILLS/mandordantukangv3"; say "removed agy skill link"; fi
  say "uninstalled. Kept: $SKILLS_DIR (your skill files), $SHARE_DIR/backups, task state in ~/.local/state/mandordantukangv3"
  exit 0
fi

# ---------- dependency checks ----------
missing=()
for c in git node cksum; do command -v "$c" >/dev/null 2>&1 || missing+=("$c"); done
[[ ${#missing[@]} -eq 0 ]] || { echo "❌ missing dependencies: ${missing[*]}" >&2; exit 1; }
node -e 'process.exit(+process.versions.node.split(".")[0] >= 16 ? 0 : 1)' || { echo "❌ node >= 16 required" >&2; exit 1; }
command -v orca >/dev/null 2>&1 || echo "⚠️  'orca' CLI not on PATH: orca-bridge/orca-pair need Orca IDE at runtime." >&2
command -v timeout >/dev/null 2>&1 || command -v gtimeout >/dev/null 2>&1 || echo "⚠️  no timeout(1): verify commands will run without a time limit." >&2

old_version="$(cat "$SHARE_DIR/VERSION" 2>/dev/null || echo none)"
say "installing v$NEW_VERSION (installed: $old_version)"

# ---------- stage + validate before touching anything ----------
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp "$SCRIPT_DIR/orca-bridge.sh" "$STAGE/orca-bridge"
cp "$SCRIPT_DIR/orca-pair.sh" "$STAGE/orca-pair"
cp "$SCRIPT_DIR/orca-squad.sh" "$STAGE/orca-squad"
cp "$SCRIPT_DIR/mandor-lib.js" "$STAGE/mandor-lib.js"
bash -n "$STAGE/orca-bridge" && bash -n "$STAGE/orca-pair" && bash -n "$STAGE/orca-squad" && node --check "$STAGE/mandor-lib.js" \
  || { echo "❌ staged files failed syntax check; nothing installed" >&2; exit 1; }

# ---------- transactional install with rollback ----------
DONE_DESTS=()   # "dest<TAB>backup-or-empty"
rollback() {
  local entry dest bak
  echo "❌ install failed; rolling back" >&2
  for entry in ${DONE_DESTS[@]+"${DONE_DESTS[@]}"}; do
    dest="${entry%%$'\t'*}"; bak="${entry#*$'\t'}"
    rm -f "$dest"
    [[ -n "$bak" ]] && cp -P "$bak" "$dest"
  done
  rm -rf "$STAGE"
}
trap 'rollback' ERR

# place <src> <dest> <backup-subpath>: back up whatever is at dest (a symlink is kept as a symlink,
# never followed, so a linked copy elsewhere is not overwritten), then install a regular file.
place() {
  local src="$1" dest="$2" bak=""
  mkdir -p "$(dirname "$dest")"
  if [[ -e "$dest" || -L "$dest" ]]; then
    if [[ ! -L "$dest" ]] && cmp -s "$src" "$dest"; then return 0; fi
    bak="$BACKUP_DIR/$3"; mkdir -p "$(dirname "$bak")"; cp -P "$dest" "$bak"
    rm -f "$dest"
  fi
  DONE_DESTS+=("$dest"$'\t'"$bak")
  cp "$src" "$dest"
}

mkdir -p "$INSTALL_BIN_DIR" "$SHARE_DIR"
say "installing tools to $INSTALL_BIN_DIR..."
place "$STAGE/orca-bridge" "$INSTALL_BIN_DIR/orca-bridge" bin/orca-bridge
place "$STAGE/orca-pair" "$INSTALL_BIN_DIR/orca-pair" bin/orca-pair
place "$STAGE/orca-squad" "$INSTALL_BIN_DIR/orca-squad" bin/orca-squad
chmod +x "$INSTALL_BIN_DIR/orca-bridge" "$INSTALL_BIN_DIR/orca-pair" "$INSTALL_BIN_DIR/orca-squad"
place "$STAGE/mandor-lib.js" "$SHARE_DIR/mandor-lib.js" share/mandor-lib.js

# Skill files: overwrite only files we installed and the user has not edited since (manifest),
# unless --force. Edited files get the new version alongside as <file>.new.
MANIFEST="$SHARE_DIR/manifest.tsv"
NEW_MANIFEST="$STAGE/manifest.tsv"; : > "$NEW_MANIFEST"
if [[ "$ROOT_DIR" == "$(cd "$SKILLS_DIR" 2>/dev/null && pwd -P || true)" ]]; then
  say "repo is the skill dir ($SKILLS_DIR); skill files already in place"
else
  say "installing skill to $SKILLS_DIR..."
  while IFS= read -r rel; do
    src="$ROOT_DIR/$rel"; dest="$SKILLS_DIR/$rel"
    [[ -f "$src" ]] || continue
    printf '%s\t%s\n' "$rel" "$(sum_of "$src")" >> "$NEW_MANIFEST"
    if [[ -f "$dest" ]] && ! cmp -s "$src" "$dest"; then
      prev="$(awk -F'\t' -v k="$rel" '$1==k {print $2}' "$MANIFEST" 2>/dev/null || true)"
      if [[ "$force" != 1 && "$prev" != "$(sum_of "$dest")" ]] && ! released_blob "$rel" "$dest"; then
        mkdir -p "$(dirname "$dest")"; cp "$src" "$dest.new"
        echo "⚠️  kept your edited $dest; new version saved as $dest.new (--force to overwrite)" >&2
        continue
      fi
    fi
    place "$src" "$dest" "skill/$rel"
  done < <(cd "$ROOT_DIR" && { git ls-files --cached --others --exclude-standard 2>/dev/null || find . -type f ! -path './.git/*' | sed 's|^\./||'; })
  cp "$NEW_MANIFEST" "$MANIFEST"
fi
if [[ -f "$ROOT_DIR/profile.example.md" && ! -e "$SKILLS_DIR/profile.local.md" ]]; then
  cp "$ROOT_DIR/profile.example.md" "$SKILLS_DIR/profile.local.md"
fi
printf '%s\n' "$NEW_VERSION" > "$SHARE_DIR/VERSION"

# ---------- post-install validation ----------
got="$("$INSTALL_BIN_DIR/orca-bridge" version)"
[[ "$got" == "orca-bridge $NEW_VERSION" ]] || { echo "❌ validation failed: '$got'" >&2; false; }
trap - ERR

if [[ "$global" == 1 ]]; then
  set_block "$OMP_RULES" "$ROOT_DIR/rules/mandor.md"
  if [[ -f "$ROOT_DIR/rules/tukang.md" ]]; then
    set_block "$AGY_RULES" "$ROOT_DIR/rules/tukang.md"
  else
    set_block "$AGY_RULES" "$ROOT_DIR/rules/common.md"
  fi
  if [[ -d "$AGY_SKILLS" && ! -e "$AGY_SKILLS/mandordantukangv3" ]]; then
    ln -s "$SKILLS_DIR" "$AGY_SKILLS/mandordantukangv3"; say "linked agy skill $AGY_SKILLS/mandordantukangv3"
  fi
fi

say "✅ installed v$NEW_VERSION$([[ -d "$BACKUP_DIR" ]] && echo " (backups: $BACKUP_DIR)" || true)"
case ":$PATH:" in *":$INSTALL_BIN_DIR:"*) ;; *) echo "⚠️  $INSTALL_BIN_DIR is not on PATH" >&2 ;; esac
echo "• Run 'orca-pair [project_dir]' to start a dual-agent session in Orca IDE."
echo "• Pane 1: Mandor (Claude Opus / Sonnet)"
echo "• Pane 2: Tukang Kerja (Gemini Flash / Haiku)"
echo "• Uninstall: $SCRIPT_DIR/install.sh --uninstall"
