#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || -z "${1:-}" ]]; then
  echo "Usage: $(basename "$0") <target_dir>" >&2
  exit 2
fi

if [[ ! -d "$1" ]]; then
  echo "Usage: $(basename "$0") <target_dir>" >&2
  exit 2
fi

TARGET_DIR="$(cd "$1" && pwd -P)"
FARM_JS="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)/server.js"

if [[ ! -f "$FARM_JS" ]]; then
  echo "⚠️  Squad Farm: server.js not found at $FARM_JS" >&2
  exit 1
fi

# Prints "reuse <port>" for a farm already serving this repo, else "start <port>" for the first free port.
farm="$(node -e '
  const http = require("http"), net = require("net");
  const [base, repo] = [+process.argv[1], process.argv[2]];
  const snap = p => new Promise(r => http.get({ host: "127.0.0.1", port: p, path: "/snapshot.json", timeout: 800 }, res => {
    let b = ""; res.on("data", c => b += c).on("end", () => { try { r(JSON.parse(b).repo); } catch { r(null); } });
  }).on("error", () => r(undefined)).on("timeout", function () { this.destroy(); }));
  const free = p => new Promise(r => { const s = net.createServer().once("error", () => r(false)).listen(p, "127.0.0.1", () => s.close(() => r(true))); });
  (async () => {
    for (let p = base; p < base + 10; p++) {
      const got = await snap(p);
      if (got === repo) return console.log("reuse " + p);
      if (got === undefined && await free(p)) return console.log("start " + p);
    }
  })();
' "${SQUAD_FARM_PORT:-24300}" "$(basename "$TARGET_DIR")")"
farm_port="${farm#* }"
if [[ -z "$farm" ]]; then
  echo "⚠️  Squad Farm: no free port in ${SQUAD_FARM_PORT:-24300}..+9, skipped."
  exit 0
fi

if [[ "$farm" == start* ]]; then
    farm_log="${XDG_STATE_HOME:-$HOME/.local/state}/squad-farm/squad-farm-$farm_port.log"
  mkdir -p "$(dirname "$farm_log")"
  nohup setsid node "$FARM_JS" --port "$farm_port" --repo "$TARGET_DIR" >"$farm_log" 2>&1 </dev/null &
  for _ in {1..20}; do
    (exec 3<>"/dev/tcp/127.0.0.1/$farm_port") 2>/dev/null && break
    sleep 0.25
  done
fi
farm_url="http://127.0.0.1:$farm_port/"
# Reuse an existing tab pointed at this port (also fixes a stale https:// tab), else open a new one.
farm_page="$(orca tab list --worktree "path:$TARGET_DIR" --json 2>/dev/null | node -e '
  let b = ""; process.stdin.on("data", c => b += c).on("end", () => {
    try {
      const re = new RegExp("^https?://(127\\.0\\.0\\.1|localhost):" + process.argv[1] + "(/|$)");
      const t = (JSON.parse(b).result?.tabs || []).find(t => re.test(t.url || ""));
      process.stdout.write(t?.browserPageId || "");
    } catch {}
  });
' "$farm_port")"
if [[ -n "$farm_page" ]]; then
  orca goto --url "$farm_url" --page "$farm_page" --worktree "path:$TARGET_DIR" --json >/dev/null 2>&1 || true
else
  orca tab create --url "$farm_url" --worktree "path:$TARGET_DIR" --json >/dev/null 2>&1 || true
fi
echo "🎮 Squad Farm live: $farm_url"
