// plugins/squad-farm/server.js
// Realtime Harvest Moon style pixel-art web view of Orca squad

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const terminalCache = new Map(); // handle -> { text, ts, err }

function findStateDir(customDir) {
  if (customDir && fs.existsSync(customDir)) return customDir;
  if (process.env.MANDOR_STATE_DIR && fs.existsSync(process.env.MANDOR_STATE_DIR)) {
    return process.env.MANDOR_STATE_DIR;
  }
  const home = os.homedir();
  const v3 = path.join(home, '.local/state/mandordantukangv3');
  const v2 = path.join(home, '.local/state/mandordantukang');
  // A dir without pairs/ has no live squad (e.g. created only by tests or logs).
  for (const dir of [v3, v2]) if (fs.existsSync(path.join(dir, 'pairs'))) return dir;
  if (fs.existsSync(v3)) return v3;
  if (fs.existsSync(v2)) return v2;
  return v3;
}

function resolveRepo(repoPath) {
  const target = repoPath || process.cwd();
  try {
    return fs.realpathSync(target);
  } catch (e) {
    return path.resolve(target);
  }
}

function parseTerminalOutput(rawText) {
  if (!rawText) return { activity: 'idle', doing: 'idle' };
  const cleanAnsi = rawText.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
  const cleanBoxes = cleanAnsi.replace(/[─│┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬█▀▄▌▐░▒▓]/g, ' ');
  const lines = cleanBoxes.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { activity: 'idle', doing: 'idle' };

  const last15 = lines.slice(-15);
  const textLast15 = last15.join(' ');
  const isWorking = /[⠁-⣿]/.test(textLast15) ||
    /esc interrupt/i.test(textLast15) ||
    /(Editing|Running|Reading|Thinking|Exploring)/i.test(textLast15);

  let doing = 'idle';
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/^(ctrl\+p commands|shift\+tab|● Bash|⎿|\? for shortcuts|Model set to)/i.test(line)) continue;
    if (/^[>#$]\s*$/.test(line)) continue;
    if (line.length > 2) {
      doing = line.slice(0, 90);
      break;
    }
  }

  return {
    activity: isWorking ? 'working' : 'idle',
    doing: doing || (isWorking ? 'working' : 'idle')
  };
}

function readTerminal(handle, customReader) {
  if (!handle) return Promise.resolve(null);
  if (customReader) {
    return Promise.resolve(customReader(handle)).catch(() => null);
  }
  const cached = terminalCache.get(handle);
  const now = Date.now();
  if (cached && (now - cached.ts < 2000)) {
    if (cached.err) return Promise.resolve(null);
    return Promise.resolve(cached.text);
  }

  return new Promise((resolve) => {
    execFile('orca', ['terminal', 'read', '--terminal', handle], { timeout: 3000 }, (err, stdout) => {
      if (err) {
        terminalCache.set(handle, { text: null, ts: now, err: true });
        resolve(null);
      } else {
        terminalCache.set(handle, { text: stdout, ts: now, err: false });
        resolve(stdout);
      }
    });
  });
}

async function buildSnapshot(opts = {}) {
  const now = Date.now();
  const repo = resolveRepo(opts.repo);
  const stateDir = findStateDir(opts.stateDir);
  const repoBaseName = path.basename(repo);

  if (opts.empty) {
    return {
      ts: now,
      repo: repoBaseName,
      workers: [
        { role: 'ui', handle: null, online: true, activity: 'idle', doing: 'idle', task_id: null },
        { role: 'coder', handle: null, online: true, activity: 'idle', doing: 'idle', task_id: null },
        { role: 'sec', handle: null, online: true, activity: 'idle', doing: 'idle', task_id: null }
      ],
      mandor: { handle: null, mood: 'calm' },
      tasks: [],
      totals: { tokens: 0, cost_usd: 0 }
    };
  }

  let pairData = null;
  let repoKey = null;

  if (stateDir && fs.existsSync(stateDir)) {
    const pairsDir = path.join(stateDir, 'pairs');
    if (fs.existsSync(pairsDir)) {
      try {
        const files = fs.readdirSync(pairsDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const raw = fs.readFileSync(path.join(pairsDir, file), 'utf8');
            const data = JSON.parse(raw);
            let pairWorktree = data.worktree;
            try { pairWorktree = fs.realpathSync(pairWorktree); } catch (_) {}
            if (pairWorktree === repo) {
              pairData = data;
              repoKey = path.basename(file, '.json');
              break;
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
  }

  const mandorHandle = pairData?.mandor || null;
  const workerRoles = [
    { role: 'ui', handleKey: 'tukang-ui' },
    { role: 'coder', handleKey: 'tukang-coder' },
    { role: 'sec', handleKey: 'tukang-sec' }
  ];

  const tasks = [];
  let totalTokens = 0;
  let totalCostUsd = 0;
  let hasCost = false;

  if (stateDir && repoKey) {
    const tasksDir = path.join(stateDir, 'repos', repoKey, 'tasks');
    if (fs.existsSync(tasksDir)) {
      try {
        const taskDirs = fs.readdirSync(tasksDir);
        for (const tId of taskDirs) {
          const tDir = path.join(tasksDir, tId);
          try {
            const stat = fs.statSync(tDir);
            if (!stat.isDirectory()) continue;
          } catch (_) { continue; }

          const taskJsonPath = path.join(tDir, 'task.json');
          const stateJsonPath = path.join(tDir, 'state.json');
          if (!fs.existsSync(taskJsonPath) || !fs.existsSync(stateJsonPath)) continue;

          let taskMeta = null;
          let stateMeta = null;
          try {
            taskMeta = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
            stateMeta = JSON.parse(fs.readFileSync(stateJsonPath, 'utf8'));
          } catch (_) {
            continue; // skip garbled json safely
          }

          const updatedAt = Number(stateMeta.updated_at) || Number(stateMeta.created_at) || now;
          if (now - updatedAt > 24 * 3600 * 1000) continue; // last 24h only

          let objective = (taskMeta.objective || '').trim();
          if (objective.length > 140) objective = objective.slice(0, 140);

          let targetWorker = stateMeta.target_worker || taskMeta.target_worker || 'coder';
          let workerRole = targetWorker.replace(/^tukang-?/, '');
          if (!['ui', 'coder', 'sec'].includes(workerRole)) workerRole = 'coder';

          let tokenTukang = 0;
          let tokenMandor = 0;
          let taskCost = null;
          const sources = new Set();

          const usagePath = path.join(tDir, 'usage.jsonl');
          if (fs.existsSync(usagePath)) {
            try {
              const lines = fs.readFileSync(usagePath, 'utf8').split('\n');
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const u = JSON.parse(line);
                  const inp = Number(u.input) || 0;
                  const out = Number(u.output) || 0;
                  const sum = inp + out;
                  if (u.role === 'mandor') tokenMandor += sum;
                  else tokenTukang += sum;

                  if (u.cost !== undefined && u.cost !== null) {
                    if (taskCost === null) taskCost = 0;
                    taskCost += Number(u.cost) || 0;
                  }
                  if (u.source) sources.add(u.source);
                } catch (_) {}
              }
            } catch (_) {}
          }

          let tokenSource = 'none';
          if (sources.has('actual') && sources.has('estimated')) tokenSource = 'mixed';
          else if (sources.has('actual')) tokenSource = 'actual';
          else if (sources.has('estimated')) tokenSource = 'estimated';

          totalTokens += (tokenTukang + tokenMandor);
          if (taskCost !== null) {
            hasCost = true;
            totalCostUsd += taskCost;
          }

          let lastEvent = '';
          let etaAt = null;
          let planAt = null;
          const eventsPath = path.join(tDir, 'events.log');
          if (fs.existsSync(eventsPath)) {
            try {
              const elines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n');
              if (elines.length > 0) {
                const parts = elines[elines.length - 1].split('\t');
                lastEvent = (parts.length > 1 ? parts.slice(1).join('\t') : parts[0]).trim();
              }
              for (const eline of elines) {
                const tabIdx = eline.indexOf('\t');
                if (tabIdx === -1) continue;
                const isoTs = eline.slice(0, tabIdx).trim();
                const msg = eline.slice(tabIdx + 1);
                const m = msg.match(/report PLAN:.*\beta:\s*(\d+)m/i);
                if (m) {
                  const parsedTs = Date.parse(isoTs);
                  const mins = parseInt(m[1], 10);
                  if (!Number.isNaN(parsedTs) && !Number.isNaN(mins)) {
                    planAt = parsedTs;
                    etaAt = parsedTs + mins * 60000;
                  }
                }
              }
            } catch (_) {}
          }

          let verifyExit = null;
          if (stateMeta.checks?.verify?.exit !== undefined) {
            verifyExit = Number(stateMeta.checks.verify.exit);
          }

          tasks.push({
            id: tId,
            worker: workerRole,
            type: taskMeta.task_type || 'MEDIUM',
            objective,
            state: stateMeta.state || 'PENDING',
            retries: Number(stateMeta.retries) || 0,
            updated_at: updatedAt,
            plan_at: planAt,
            eta_at: etaAt,
            tokens: {
              tukang: tokenTukang,
              mandor: tokenMandor,
              cost_usd: taskCost !== null ? Number(taskCost.toFixed(4)) : null,
              source: tokenSource
            },
            last_event: lastEvent,
            verify_exit: verifyExit,
            alert: stateMeta.monitor_alert || 'OK'
          });
        }
      } catch (_) {}
    }
  }

  tasks.sort((a, b) => b.updated_at - a.updated_at);

  let isAngry = false;
  let isImpatient = false;
  let isHappy = false;

  for (const t of tasks) {
    const isRecent = (now - t.updated_at) <= 120000;
    if (isRecent && (t.state === 'REJECTED' || t.retries > 0)) {
      isAngry = true;
    }
    const isOpen = !['APPROVED', 'REJECTED', 'FAILED', 'DISCARDED'].includes(t.state);
    if (isOpen && (String(t.alert).toUpperCase().includes('STALL') || (t.eta_at && now > t.eta_at))) {
      isImpatient = true;
    }
    if (isRecent && t.state === 'APPROVED') {
      isHappy = true;
    }
  }

  let mood = 'calm';
  if (isAngry) mood = 'angry';
  else if (isImpatient) mood = 'impatient';
  else if (isHappy) mood = 'happy';

  const workers = [];
  for (const w of workerRoles) {
    const handle = pairData ? (pairData[w.handleKey] || (w.role === 'coder' ? pairData.tukang : null) || null) : null;
    let activeTaskId = null;
    for (const t of tasks) {
      const isOpen = ['ASSIGNED', 'EXECUTING', 'VERIFYING', 'REVIEWING'].includes(t.state);
      if (isOpen && t.worker === w.role) {
        activeTaskId = t.id;
        break;
      }
    }

    let online = false;
    let activity = 'offline';
    let doing = 'tidak terhubung';

    if (handle) {
      const termRaw = await readTerminal(handle, opts.terminalReader);
      if (termRaw !== null) {
        online = true;
        const parsed = parseTerminalOutput(termRaw);
        activity = parsed.activity;
        doing = parsed.doing;
      }
    }

    workers.push({
      role: w.role,
      handle,
      online,
      activity,
      doing,
      task_id: activeTaskId
    });
  }

  return {
    ts: now,
    repo: repoBaseName,
    workers,
    mandor: {
      handle: mandorHandle,
      mood
    },
    tasks,
    totals: {
      tokens: totalTokens,
      cost_usd: hasCost ? Number(totalCostUsd.toFixed(2)) : 0
    }
  };
}

function createServer(opts = {}) {
  const staticMap = {
    '/': { file: 'index.html', mime: 'text/html; charset=utf-8' },
    '/index.html': { file: 'index.html', mime: 'text/html; charset=utf-8' },
    '/app.js': { file: 'app.js', mime: 'application/javascript; charset=utf-8' },
    '/sprites.js': { file: 'sprites.js', mime: 'application/javascript; charset=utf-8' },
    '/behavior.js': { file: 'behavior.js', mime: 'application/javascript; charset=utf-8' },
    '/style.css': { file: 'style.css', mime: 'text/css; charset=utf-8' }
  };

  const sseClients = new Set();

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;

    const isEmpty = parsedUrl.searchParams.get('empty') === '1' || opts.empty;
    const reqOpts = isEmpty ? { ...opts, empty: true } : opts;

    if (pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(': connected\n\n');

      const clientInfo = { res, empty: isEmpty };
      sseClients.add(clientInfo);
      req.on('close', () => sseClients.delete(clientInfo));

      try {
        const snap = await buildSnapshot(reqOpts);
        res.write(`data: ${JSON.stringify(snap)}\n\n`);
      } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      }
      return;
    }

    if (pathname === '/snapshot.json') {
      try {
        const snap = await buildSnapshot(reqOpts);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(snap));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    const route = staticMap[pathname];
    if (route) {
      const filePath = path.join(__dirname, route.file);
      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': route.mime });
        res.end(content);
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  const intervalId = setInterval(async () => {
    if (sseClients.size === 0) return;
    try {
      let normalData = null;
      let emptyData = null;
      for (const client of sseClients) {
        if (client.empty) {
          if (!emptyData) {
            const snap = await buildSnapshot({ ...opts, empty: true });
            emptyData = `data: ${JSON.stringify(snap)}\n\n`;
          }
          client.res.write(emptyData);
        } else {
          if (!normalData) {
            const snap = await buildSnapshot(opts);
            normalData = `data: ${JSON.stringify(snap)}\n\n`;
          }
          client.res.write(normalData);
        }
      }
    } catch (_) {}
  }, 2000);

  server.on('close', () => {
    clearInterval(intervalId);
    sseClients.clear();
  });

  return server;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let port = 24300;
  let repo = process.cwd();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--repo' && args[i + 1]) {
      repo = args[i + 1];
      i++;
    }
  }

  const server = createServer({ repo });
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`Squad Farm live at http://127.0.0.1:${port} (repo: ${repo})\n`);
  });
}

module.exports = {
  buildSnapshot,
  createServer,
  parseTerminalOutput
};
