#!/usr/bin/env bash
# orca-pair — Spawn & Attach Orca Dual-Engine Multi-Agent Pair (Mandor: OMP/Claude + Tukang: Antigravity/Gemini)
# Usage: orca-pair [project_dir]

set -euo pipefail

TARGET_DIR="${1:-$(pwd)}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd -P)"
MANDOR_HOME="${MANDOR_HOME:-$HOME/.agents/skills/mandordantukangv3}"
BRIDGE="$(command -v orca-bridge || echo "${HOME}/.local/bin/orca-bridge")"
MANDOR_CMD="${MANDOR_CMD:-omp}"
TUKANG_CMD="${TUKANG_CMD:-agy}"

echo "🪐 [orca-pair] Initializing Dual-Engine Multi-Agent in: $TARGET_DIR"

# 1. Pastikan Orca runtime reachable (retry setelah orca open; gagal = stop, bukan lanjut buta)
if ! orca status --json >/dev/null 2>&1; then
  echo "⚡ Orca runtime belum aktif, mencoba membuka Orca..."
  orca open 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    orca status --json >/dev/null 2>&1 && break
  done
  orca status --json >/dev/null 2>&1 || { echo "❌ Orca runtime tidak bisa dihubungi. Buka Orca IDE lalu ulangi." >&2; exit 1; }
fi

# 2. Bootstrap AGENTS.md (salinan aturan kanonik), GEMINI.md & CLAUDE.md (symlink) jika belum ada
if [[ ! -f "$TARGET_DIR/AGENTS.md" ]]; then
  if [[ -f "$MANDOR_HOME/AGENTS.md" ]]; then
    echo "📄 Generating AGENTS.md di $TARGET_DIR dari $MANDOR_HOME/AGENTS.md..."
    { echo "# $(basename "$TARGET_DIR") - Project Guidelines & Dual-Engine Architecture"; echo
      tail -n +2 "$MANDOR_HOME/AGENTS.md"; } > "$TARGET_DIR/AGENTS.md"
    if [[ ! -e "$TARGET_DIR/GEMINI.md" ]]; then
      echo "🔗 Symlinking GEMINI.md -> AGENTS.md..."
      ln -sf AGENTS.md "$TARGET_DIR/GEMINI.md"
    fi
  else
    echo "⚠️  $MANDOR_HOME/AGENTS.md tidak ada (jalankan scripts/install.sh). AGENTS.md project tidak dibuat." >&2
  fi
fi
if [[ ! -e "$TARGET_DIR/CLAUDE.md" && -f "$TARGET_DIR/AGENTS.md" ]]; then
  echo "🔗 Symlinking CLAUDE.md -> AGENTS.md..."
  ln -sf AGENTS.md "$TARGET_DIR/CLAUDE.md"
fi

# 3. Setup local helper scripts/orca-bridge.sh
mkdir -p "$TARGET_DIR/scripts"
if [[ ! -e "$TARGET_DIR/scripts/orca-bridge.sh" ]]; then
  echo "🔗 Linking scripts/orca-bridge.sh -> $BRIDGE..."
  ln -sf "$BRIDGE" "$TARGET_DIR/scripts/orca-bridge.sh"
fi

# 4. Auto-index Code Intelligence & Dual Knowledge Graph in background (output dibuang total)
bg() { (cd "$TARGET_DIR" && "$@") >/dev/null 2>&1 & }
if command -v gitnexus >/dev/null 2>&1 && [[ ! -d "$TARGET_DIR/.gitnexus" ]]; then
  echo "⚡ [gitnexus] Indexing project architecture graph in background..."
  bg gitnexus analyze . --index-only
fi

if command -v semantex >/dev/null 2>&1 && [[ ! -d "$TARGET_DIR/.semantex" ]]; then
  echo "⚡ [semantex] Building hybrid semantic index in background..."
  bg semantex index .
fi

proj_prefix=$(basename "$TARGET_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')
if command -v xerj >/dev/null 2>&1 && curl -s --max-time 2 http://localhost:9200 >/dev/null 2>&1; then
  echo "⚡ [xerj] Autoindexing project codebase ($proj_prefix) in background..."
  bg xerj autoindex "$TARGET_DIR" --prefix "$proj_prefix" --yes
fi

if command -v codegraph >/dev/null 2>&1 && [[ ! -d "$TARGET_DIR/.codegraph" ]]; then
  echo "⚡ [codegraph] Initializing codegraph in background..."
  bg codegraph init
fi

if command -v graphify >/dev/null 2>&1 && [[ ! -d "$TARGET_DIR/graphify-out" ]]; then
  echo "⚡ [graphify] Extracting macro architecture graph in background..."
  bg bash -c 'graphify extract . --code-only && graphify cluster-only . && graphify export html'
fi

# 5. Cek terminal yang aktif di Orca untuk target directory secara spesifik
term_json=$(orca terminal list --json 2>/dev/null || echo '{"result":{"terminals":[]}}')

# Prints "<mandor handles>|<tukang handles>" (comma-separated) for live terminals in this worktree.
found=$(node -e '
  const targetDir = process.argv[2];
  const data = JSON.parse(process.argv[1]);
  const terms = (data.result?.terminals || []).filter(t => t.connected !== false && t.worktreePath && (t.worktreePath === targetDir || targetDir.startsWith(t.worktreePath + "/")));
  const m = terms.filter(t => /(^|[^a-z])(omp|claude|opus|mandor)([^a-z]|$)|(^|[\s:⠀-⣿])pi(\s|$)/i.test(t.title || "")).map(t => t.handle);
  const a = terms.filter(t => /antigravity|(^|[\s:])agy(\s|$)|gemini|tukang/i.test(t.title || "")).map(t => t.handle);
  process.stdout.write(m.join(",") + "|" + a.join(","));
' "$term_json" "$TARGET_DIR")
mandor_found="${found%%|*}"
tukang_found="${found#*|}"

# 6. Spawn terminal jika belum ada di worktree ini, lalu ikat handle-nya (routing deterministik)
spawn() { # spawn <title> <command> -> handle
  orca terminal create --worktree "path:$TARGET_DIR" --title "$1" --command "$2" --json \
    | node -e 'let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{const h=JSON.parse(b).result?.terminal?.handle;if(!h)process.exit(1);process.stdout.write(h)})'
}
bind() { # bind <role> <handle>
  (cd "$TARGET_DIR" && "$BRIDGE" pair bind "$1" "$2" >/dev/null) || echo "⚠️  gagal bind $1 -> $2" >&2
}
attach() { # attach <role> <found-csv> <title> <command> <label>
  local role="$1" found="$2" title="$3" cmd="$4" label="$5" h
  if [[ -z "$found" ]]; then
    echo "🚀 Membuka $label..."
    h="$(spawn "$title" "$cmd")" || { echo "❌ Gagal membuat terminal $label" >&2; exit 1; }
    bind "$role" "$h"
    orca terminal wait --terminal "$h" --for tui-idle --timeout-ms 30000 --json >/dev/null 2>&1 \
      || echo "⚠️  $label belum terkonfirmasi siap (cek manual sebelum delegate)." >&2
  elif [[ "$found" != *,* ]]; then
    echo "✅ $label sudah terdeteksi di worktree ini ($found)."
    bind "$role" "$found"
  else
    echo "⚠️  Lebih dari satu terminal $label ($found). Pilih satu: orca-bridge pair bind $role <handle>" >&2
  fi
}
attach mandor "$mandor_found" "OMP Mandor" "$MANDOR_CMD" "Pane 1: Mandor (OMP / Claude)"
attach tukang "$tukang_found" "Antigravity Tukang" "$TUKANG_CMD" "Pane 2: Tukang (Antigravity / Gemini)"

# 7. Tampilkan status bridge terkini
echo ""
(cd "$TARGET_DIR" && "$BRIDGE" status) || true
echo ""
echo "✨ Orca Dual-Engine Pair aktif & sepaket di $TARGET_DIR!"
echo "• Mandor = Arsitek (task SIMPLE ≤ 15 baris edit langsung; MEDIUM/COMPLEX delegasi pakai spec)"
echo "• Tukang = Eksekutor (koding, test runner, browser audit)"
echo "• Mulai delegasi: orca-bridge delegate --spec task.json"
