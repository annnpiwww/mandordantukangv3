#!/usr/bin/env bash
# orca-squad — 2x2 Grid Multi-Agent Squad Launcher (1 Mandor + 3 Specialized Tukang)
# Layout:
# ┌───────────────────────────────┬───────────────────────────────┐
# │ 👑 [MANDOR]                   │ 🎨 [DESIGN]                   │
# ├───────────────────────────────┼───────────────────────────────┤
# │ ⚡ [CODER]                    │ 🛡️ [SECURITY]                 │
# └───────────────────────────────┴───────────────────────────────┘
# Usage: orca-squad [project_dir]

set -euo pipefail

TARGET_DIR="${1:-$(pwd)}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd -P)"
MANDOR_HOME="${MANDOR_HOME:-$HOME/.agents/skills/mandordantukangv3}"
BRIDGE="$(command -v orca-bridge || echo "${HOME}/.local/bin/orca-bridge")"

echo "🪐 [orca-squad] Initializing 2x2 Grid Multi-Agent Squad in: $TARGET_DIR"

# 1. Pastikan Orca runtime reachable
if ! orca status --json >/dev/null 2>&1; then
  echo "⚡ Orca runtime belum aktif, mencoba membuka Orca..."
  orca open 2>/dev/null || true
  for _ in {1..10}; do
    sleep 1
    orca status --json >/dev/null 2>&1 && break
  done
  orca status --json >/dev/null 2>&1 || { echo "❌ Orca runtime tidak bisa dihubungi. Buka Orca IDE lalu ulangi." >&2; exit 1; }
fi

# 2. Bootstrap AGENTS.md, CLAUDE.md, GEMINI.md
if [[ ! -f "$TARGET_DIR/AGENTS.md" ]]; then
  if [[ -f "$MANDOR_HOME/AGENTS.md" ]]; then
    echo "📄 Generating AGENTS.md di $TARGET_DIR..."
    { echo "# $(basename "$TARGET_DIR") - Project Guidelines & Multi-Agent Squad Architecture"; echo
      tail -n +2 "$MANDOR_HOME/AGENTS.md"; } > "$TARGET_DIR/AGENTS.md"
    [[ ! -e "$TARGET_DIR/GEMINI.md" ]] && ln -sf AGENTS.md "$TARGET_DIR/GEMINI.md"
  fi
fi
[[ ! -e "$TARGET_DIR/CLAUDE.md" && -f "$TARGET_DIR/AGENTS.md" ]] && ln -sf AGENTS.md "$TARGET_DIR/CLAUDE.md"

# 3. Setup local helper scripts/orca-bridge.sh
mkdir -p "$TARGET_DIR/scripts"
[[ ! -e "$TARGET_DIR/scripts/orca-bridge.sh" ]] && ln -sf "$BRIDGE" "$TARGET_DIR/scripts/orca-bridge.sh"

# 4. Deteksi terminal yang sudah ada di worktree
get_terms() {
  orca terminal list --json 2>/dev/null | node -e '
    const targetDir = process.argv[1];
    let b = "";
    process.stdin.on("data", c => b += c).on("end", () => {
      try {
        const d = JSON.parse(b);
        const terms = (d.result?.terminals || []).filter(t => t.connected !== false && t.worktreePath && (t.worktreePath === targetDir || targetDir.startsWith(t.worktreePath + "/")));
        process.stdout.write(JSON.stringify(terms));
      } catch { process.stdout.write("[]"); }
    });
  ' "$TARGET_DIR"
}

terms_json="$(get_terms)"
term_count="$(node -e 'console.log(JSON.parse(process.argv[1]).length)' "$terms_json")"

h_mandor=""
h_ui=""
h_coder=""
h_sec=""

if [[ "$term_count" -ge 4 ]]; then
  echo "✅ 4 terminal squad sudah aktif di worktree ini. Membaca handles..."
  h_mandor="$(node -e 'const t = JSON.parse(process.argv[1]); console.log(t[0]?.handle || "")' "$terms_json")"
  h_ui="$(node -e 'const t = JSON.parse(process.argv[1]); console.log(t[1]?.handle || "")' "$terms_json")"
  h_coder="$(node -e 'const t = JSON.parse(process.argv[1]); console.log(t[2]?.handle || "")' "$terms_json")"
  h_sec="$(node -e 'const t = JSON.parse(process.argv[1]); console.log(t[3]?.handle || "")' "$terms_json")"
else
  echo "🚀 Membangun layout 2x2 split grid untuk 4 terminal squad..."
  if [[ "$term_count" -eq 0 ]]; then
    # Spawn initial terminal for Mandor
    h_mandor="$(orca terminal create --worktree "path:$TARGET_DIR" --title "👑 [MANDOR]" --json | node -e 'let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{console.log(JSON.parse(b).result?.terminal?.handle||"")})')"
  else
    h_mandor="$(node -e 'const t = JSON.parse(process.argv[1]); console.log(t[0]?.handle || "")' "$terms_json")"
  fi

  # Rename Mandor Pane (Top-Left)
  orca terminal rename --terminal "$h_mandor" --title "👑 [MANDOR]" --json >/dev/null 2>&1 || true

  # Split vertical -> Top-Right: Design
  echo "📐 Splitting vertical -> 🎨 TUKANG DESIGN..."
  h_ui="$(orca terminal split --terminal "$h_mandor" --direction vertical --json | node -e 'let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{console.log(JSON.parse(b).result?.split?.handle||"")})')"
  orca terminal rename --terminal "$h_ui" --title "🎨 [DESIGN]" --json >/dev/null 2>&1 || true

  # Split horizontal on Mandor -> Bottom-Left: Coder
  echo "📐 Splitting horizontal -> ⚡ TUKANG CODER..."
  h_coder="$(orca terminal split --terminal "$h_mandor" --direction horizontal --json | node -e 'let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{console.log(JSON.parse(b).result?.split?.handle||"")})')"
  orca terminal rename --terminal "$h_coder" --title "⚡ [CODER]" --json >/dev/null 2>&1 || true

  # Split horizontal on Design -> Bottom-Right: Security
  echo "📐 Splitting horizontal -> 🛡️ TUKANG SECURITY..."
  h_sec="$(orca terminal split --terminal "$h_ui" --direction horizontal --json | node -e 'let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{console.log(JSON.parse(b).result?.split?.handle||"")})')"
  orca terminal rename --terminal "$h_sec" --title "🛡️ [SECURITY]" --json >/dev/null 2>&1 || true
fi

# 5. Ikat handle ke orca-bridge
echo "🔗 Binding squad handles to orca-bridge..."
(
  cd "$TARGET_DIR"
  "$BRIDGE" pair bind mandor "$h_mandor" >/dev/null
  "$BRIDGE" pair bind ui "$h_ui" >/dev/null
  "$BRIDGE" pair bind coder "$h_coder" >/dev/null
  "$BRIDGE" pair bind sec "$h_sec" >/dev/null
  "$BRIDGE" pair bind tukang "$h_coder" >/dev/null
)

# 6. Tampilkan status
echo ""
(cd "$TARGET_DIR" && "$BRIDGE" status) || true
echo ""
echo "✨ Orca 2x2 Grid Squad aktif di $TARGET_DIR!"
echo "┌───────────────────────────────┬───────────────────────────────┐"
echo "│ 👑 [MANDOR] Top-Left          │ 🎨 [DESIGN] Top-Right         │"
echo "├───────────────────────────────┼───────────────────────────────┤"
echo "│ ⚡ [CODER] Bottom-Left        │ 🛡️ [SECURITY] Bottom-Right    │"
echo "└───────────────────────────────┴───────────────────────────────┘"
