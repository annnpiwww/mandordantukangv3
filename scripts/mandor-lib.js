#!/usr/bin/env node
// mandor-lib.js: JSON helpers for orca-bridge (spec validation, terminal routing,
// scope check, usage tracking). No dependencies; called from orca-bridge.sh.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const MANDOR_HOME = process.env.MANDOR_HOME || path.join(os.homedir(), '.agents/skills/mandordantukangv3');
const V2_RULES = path.join(MANDOR_HOME, 'rules');

const die = (msg, code = 1) => { process.stderr.write(msg.endsWith('\n') ? msg : msg + '\n'); process.exit(code); };
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJsonAtomic = (f, obj) => {
  const tmp = `${f}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1) + '\n');
  fs.renameSync(tmp, f);
};

const TASK_TYPES = ['SIMPLE', 'MEDIUM', 'COMPLEX'];
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const DEFAULT_SENSITIVE = [
  '.env', '.env.*', '*.env', '*.pem', '*.key', '*.p12', '*.secret', 'id_rsa*', 'id_ed25519*',
  '.git/**', '.mcp.json', '.cursor/mcp.json', '.github/workflows/**',
  'AGENTS.md', 'CLAUDE.md', 'GEMINI.md',
];
const sensitivePatterns = () => DEFAULT_SENSITIVE.concat((process.env.MANDOR_SENSITIVE || '').split(':').filter(Boolean));

// gitignore-ish glob: `**` any depth, `*`/`?` within a segment, trailing `/` = whole dir,
// slash-less pattern also matches the basename at any depth.
function globToRegex(glob) {
  let g = glob.endsWith('/') ? glob + '**' : glob;
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
function matchesAny(file, patterns) {
  const base = path.posix.basename(file);
  return patterns.some((p) => {
    const re = globToRegex(p);
    return re.test(file) || (!p.includes('/') && re.test(base));
  });
}

function normRelPath(p) {
  if (typeof p !== 'string' || !p.trim()) return { err: 'empty path' };
  if (p.includes('\0')) return { err: 'NUL byte' };
  const s = p.trim().replace(/^\.\//, '');
  if (s.startsWith('/') || /^[A-Za-z]:/.test(s)) return { err: `absolute path not allowed: ${p}` };
  if (s.split('/').includes('..')) return { err: `'..' not allowed: ${p}` };
  if (s.startsWith('-')) return { err: `path may not start with '-': ${p}` };
  return { ok: s };
}

const strArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim());

// ---------- validate ----------
const SPEC_KEYS = new Set(['task_id', 'task_type', 'objective', 'allowed_files', 'required_changes',
  'acceptance_criteria', 'verification_command', 'constraints', 'expected_report', 'isolate', 'max_retries',
  'verify_timeout', 'allow_sensitive', 'tukang_model', 'mode', 'scenario', 'target_worker', 'worker']);

function validate([inFile, outFile, taskId, detectedVerify]) {
  let spec;
  try { spec = JSON.parse(fs.readFileSync(inFile === '-' ? 0 : inFile, 'utf8')); } catch (e) { die(`spec: invalid JSON (${e.message})`); }
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) die('spec: must be a JSON object');
  const errs = [];
  const warns = [];
  for (const k of Object.keys(spec)) if (!SPEC_KEYS.has(k)) errs.push(`unknown field '${k}'`);
  const id = spec.task_id || taskId;
  if (!ID_RE.test(id || '')) errs.push(`task_id must match ${ID_RE}`);
  if (!TASK_TYPES.includes(spec.task_type)) errs.push(`task_type must be one of ${TASK_TYPES.join('|')}`);
  if (typeof spec.objective !== 'string' || !spec.objective.trim()) errs.push('objective required');
  if (!strArr(spec.allowed_files) || !spec.allowed_files.length) errs.push('allowed_files: non-empty string array required');
  if (!strArr(spec.required_changes) || !spec.required_changes.length) errs.push('required_changes: non-empty string array required');
  if (!strArr(spec.acceptance_criteria) || !spec.acceptance_criteria.length) errs.push('acceptance_criteria: non-empty string array required');
  if (spec.constraints !== undefined && !strArr(spec.constraints)) errs.push('constraints: string array');
  if (spec.expected_report !== undefined && typeof spec.expected_report !== 'string') errs.push('expected_report: string');
  if (spec.isolate !== undefined && typeof spec.isolate !== 'boolean') errs.push('isolate: boolean');
  if (spec.allow_sensitive !== undefined && typeof spec.allow_sensitive !== 'boolean') errs.push('allow_sensitive: boolean');
  if (spec.max_retries !== undefined && !(Number.isInteger(spec.max_retries) && spec.max_retries >= 0 && spec.max_retries <= 5)) errs.push('max_retries: integer 0..5');
  if (spec.verify_timeout !== undefined && !(Number.isInteger(spec.verify_timeout) && spec.verify_timeout > 0 && spec.verify_timeout <= 7200)) errs.push('verify_timeout: integer seconds 1..7200');
  if (spec.mode !== undefined && !['pair', 'single'].includes(spec.mode)) errs.push("mode: 'pair'|'single'");
  for (const k of ['tukang_model', 'scenario', 'target_worker', 'worker']) if (spec[k] !== undefined && typeof spec[k] !== 'string') errs.push(`${k}: string`);

  let verify = spec.verification_command;
  let verifySource = 'mandor';
  if (verify === undefined || verify === '') {
    if (detectedVerify) { verify = detectedVerify; verifySource = 'detected'; }
    else errs.push("verification_command required (none detected; use \"none\" to explicitly skip)");
  } else if (typeof verify !== 'string') errs.push('verification_command: string');

  const allowed = [];
  if (strArr(spec.allowed_files)) {
    for (const p of spec.allowed_files) {
      const r = normRelPath(p);
      if (r.err) { errs.push(`allowed_files: ${r.err}`); continue; }
      allowed.push(r.ok);
      if (matchesAny(r.ok, sensitivePatterns()) && !spec.allow_sensitive) errs.push(`allowed_files: '${r.ok}' is sensitive; set allow_sensitive=true (forces COMPLEX)`);
    }
  }
  if (spec.allow_sensitive && spec.task_type !== 'COMPLEX') errs.push('allow_sensitive requires task_type COMPLEX');
  if (spec.task_type === 'SIMPLE' && allowed.length > 2) warns.push('SIMPLE task with >2 files: check classification');
  if (spec.task_type === 'COMPLEX' && !spec.isolate) warns.push('COMPLEX task without isolate=true: changes land directly in the shared tree');
  if (errs.length) die('spec invalid:\n- ' + errs.join('\n- '));

  const task = {
    task_id: id,
    task_type: spec.task_type,
    objective: spec.objective.trim(),
    allowed_files: allowed,
    required_changes: spec.required_changes,
    acceptance_criteria: spec.acceptance_criteria,
    verification_command: verify,
    verification_source: verifySource,
    constraints: spec.constraints || [],
    expected_report: spec.expected_report || '1-line summary',
    isolate: !!spec.isolate,
    max_retries: spec.max_retries ?? Number(process.env.MANDOR_MAX_RETRIES || 1),
    verify_timeout: spec.verify_timeout ?? 900,
    allow_sensitive: !!spec.allow_sensitive,
    mode: spec.mode || 'pair',
  };
  if (spec.tukang_model) task.tukang_model = spec.tukang_model;
  if (spec.scenario) task.scenario = spec.scenario;
  const tw = spec.target_worker || spec.worker;
  if (tw) task.target_worker = String(tw).toLowerCase();
  writeJsonAtomic(outFile, task);
  for (const w of warns) process.stderr.write(`warn: ${w}\n`);
}

// ---------- handoff ----------
function handoff([taskFile, workdir, attempt, correction]) {
  const t = readJson(taskFile);
  const spec = {
    objective: t.objective, allowed_files: t.allowed_files, required_changes: t.required_changes,
    acceptance_criteria: t.acceptance_criteria, constraints: t.constraints, report: t.expected_report,
  };
  const targetTag = t.target_worker ? ` | TARGET: ${t.target_worker.toUpperCase()}` : '';
  const lines = [`[MANDOR TASK ${t.task_id} | ${t.task_type}${targetTag}${Number(attempt) > 0 ? ` | RETRY ${attempt}` : ''}]`];
  if (workdir) lines.push(`WORKDIR ${workdir}  (edit files HERE only)`);
  if (correction) lines.push(`FIX ${correction}`);
  lines.push('SPEC ' + JSON.stringify(spec));
  const role = t.target_worker && normRole(t.target_worker);
  if (role && role !== 'tukang' && role !== 'mandor') {
    const intro = { 'tukang-ui': 'Design', 'tukang-coder': 'Coder', 'tukang-sec': 'Security' }[role] || role;
    lines.push(`ROLE first message this session only: reply one line "Tukang ${intro} ready." then read and follow ${V2_RULES}/common.md and ${V2_RULES}/${role}.md`);
  }
  lines.push('LANG English only for ALL your output (chat, thoughts shown to user, summaries, reports), overriding any reply-language rule from the user profile or AGENTS.md; Mandor translates for the user.');
  lines.push('RULES edit only allowed_files; no repo-wide scan; no self-approve; bridge runs verify+diff check itself.');
  const lessons = lessonsFor(t.target_worker);
  if (lessons.length) lines.push('LESSONS past mistakes Mandor rejected; repeating one = instant reject: ' + lessons.map((l) => `(${l.text})`).join(' '));
  const repeated = complaintTally().filter((c) => c.n >= 2).slice(0, 5);
  if (repeated.length) lines.push('USER REPEATED COMPLAINTS (the user is angry about these; never cause them): ' + repeated.map((c) => `x${c.n} ${c.topic}: ${c.last}`).join(' | '));
  lines.push(`BLOCKED orca-bridge report BLOCKED --task ${t.task_id} "<file>: <why>"`);
  lines.push(`DONE orca-bridge report DONE --task ${t.task_id} "<${t.expected_report}>"`);
  process.stdout.write(lines.join('\n'));
}

// ---------- get / set ----------
function get([file, key]) {
  const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), readJson(file));
  if (v === undefined || v === null) process.exit(3);
  process.stdout.write(typeof v === 'string' ? v : Array.isArray(v) && v.every((x) => typeof x === 'string') ? v.join('\n') : JSON.stringify(v));
}
function set([file, ...pairs]) {
  const obj = fs.existsSync(file) ? readJson(file) : {};
  for (let i = 0; i < pairs.length; i += 2) {
    const raw = pairs[i + 1];
    let val;
    try { val = JSON.parse(raw); } catch { val = raw; }
    const keys = pairs[i].split('.');
    let o = obj;
    for (const k of keys.slice(0, -1)) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {};
    o[keys[keys.length - 1]] = val;
  }
  writeJsonAtomic(file, obj);
}

// ---------- resolve terminal ----------
const ROLE_RE = {
  mandor: /(^|[^a-z])(omp|claude|opus|mandor)([^a-z]|$)|(^|[\s:⠀-⣿])pi(\s|$)/i,
  tukang: /antigravity|(^|[\s:])agy(\s|$)|gemini|tukang/i,
  'tukang-ui': /(^|[^a-z])(ui|ux|design|frontend)([^a-z]|$)/i,
  'tukang-coder': /(^|[^a-z])(coder|logic|backend|core)([^a-z]|$)/i,
  'tukang-sec': /(^|[^a-z])(sec|security|qa|tester|audit)([^a-z]|$)/i,
};
const normRole = (r) => {
  if (['ui', 'tukang-ui', 'frontend'].includes(r)) return 'tukang-ui';
  if (['coder', 'tukang-coder', 'logic', 'backend'].includes(r)) return 'tukang-coder';
  if (['sec', 'security', 'tukang-sec', 'qa', 'tester'].includes(r)) return 'tukang-sec';
  if (['omp', 'claude', 'opus', 'mandor'].includes(r)) return 'mandor';
  return 'tukang';
};
function resolve([role, termsFile, worktree, self, pairFile]) {
  const data = readJson(termsFile);
  const terms = data.result?.terminals || [];
  const inTree = (t) => t.worktreePath && (worktree === t.worktreePath || worktree.startsWith(t.worktreePath + '/'));
  const usable = (t) => t.connected !== false && t.orphaned !== true;
  const out = (h, src) => { process.stdout.write(`${h}\t${src}`); process.exit(0); };

  const nRole = normRole(role);
  const envKey = nRole === 'mandor' ? 'MANDOR_HANDLE' : nRole === 'tukang-ui' ? 'TUKANG_UI_HANDLE' : nRole === 'tukang-coder' ? 'TUKANG_CODER_HANDLE' : nRole === 'tukang-sec' ? 'TUKANG_SEC_HANDLE' : 'TUKANG_HANDLE';
  const envHandle = process.env[envKey] || (nRole.startsWith('tukang-') ? process.env.TUKANG_HANDLE : undefined);
  if (envHandle) {
    const t = terms.find((x) => x.handle === envHandle);
    if (!t || !usable(t)) die(`${role}: env handle ${envHandle} not live`, 2);
    out(envHandle, 'env');
  }
  if (pairFile && fs.existsSync(pairFile)) {
    const pairData = readJson(pairFile);
    const h = pairData[nRole] || pairData[role] || (nRole.startsWith('tukang-') ? pairData.tukang : null);
    if (h) {
      const t = terms.find((x) => x.handle === h);
      if (t && usable(t) && inTree(t)) out(h, 'pair');
      process.stderr.write(`warn: bound ${role} handle ${h} is gone or moved; falling back to title match\n`);
    }
  }
  const pool = terms.filter((t) => inTree(t) && usable(t) && t.handle !== self);
  const re = ROLE_RE[nRole] || ROLE_RE[role] || ROLE_RE.tukang;
  const hits = pool.filter((t) => re.test(t.title || ''));
  if (hits.length === 1) out(hits[0].handle, 'title');
  if (hits.length === 0 && nRole.startsWith('tukang-')) {
    const defaultHits = pool.filter((t) => ROLE_RE.tukang.test(t.title || ''));
    if (defaultHits.length === 1) out(defaultHits[0].handle, 'title-fallback');
  }
  // Layout fallback: Orca's 2-pane split (left=mandor, right=tukang), only if it names exactly one live pane.
  const vl = (data.result?.visualLayouts || []).find((v) => v.worktreePath && inTree({ worktreePath: v.worktreePath }));
  const side = vl?.root?.type === 'split' ? vl.root[nRole === 'mandor' ? 'first' : 'second'] : null;
  const tabs = side?.tabs || [];
  const tab = tabs.find((x) => x.tabId === side?.activeTabId) || (tabs.length === 1 ? tabs[0] : null);
  const leaf = tab?.panes?.type === 'terminal' ? tab.panes.handle : null;
  if (!hits.length && leaf && pool.some((t) => t.handle === leaf)) out(leaf, 'layout');
  const list = (hits.length ? hits : pool).map((t) => `  ${t.handle}  "${t.title}"`).join('\n') || '  (none)';
  die(`${role}: ${hits.length > 1 ? 'ambiguous' : 'no'} terminal match in ${worktree}. Candidates:\n${list}\nFix: orca-bridge pair bind ${role} <handle>`, 2);
}

// ---------- scope check ----------
function scope([taskFile, changedFile]) {
  const t = readJson(taskFile);
  const changed = fs.readFileSync(changedFile, 'utf8').split('\n').filter(Boolean);
  const allowRe = t.allowed_files;
  const sens = sensitivePatterns();
  const out_of_scope = changed.filter((f) => !matchesAny(f, allowRe));
  const sensitive = changed.filter((f) => matchesAny(f, sens) && !(t.allow_sensitive && matchesAny(f, allowRe)));
  process.stdout.write(JSON.stringify({ ok: !out_of_scope.length && !sensitive.length, changed, out_of_scope, sensitive }));
}

// ---------- usage ----------
function usageOmp([sessionsDir, project, fromMs, toMs]) {
  const from = Number(fromMs); const to = Number(toMs);
  const acc = { role: 'mandor', source: 'actual', kind: 'omp-session', input: 0, output: 0, cache_read: 0, cache_write: 0, cost: 0, calls: 0, models: [] };
  const files = [];
  if (fs.existsSync(sessionsDir)) {
    for (const d of fs.readdirSync(sessionsDir)) {
      const dir = path.join(sessionsDir, d);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir)) if (f.endsWith('.jsonl')) files.push(path.join(dir, f));
    }
  }
  for (const f of files) {
    if (fs.statSync(f).mtimeMs < from) continue;
    const text = fs.readFileSync(f, 'utf8');
    const head = text.slice(0, 4096).split('\n').find((l) => l.includes('"type":"session"'));
    try { if (!head || JSON.parse(head).cwd !== project) continue; } catch { continue; }
    for (const line of text.split('\n')) {
      if (!line.includes('"usage"')) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      const m = o.message; const u = m?.usage;
      const ts = typeof m?.timestamp === 'number' ? m.timestamp : Date.parse(o.timestamp);
      if (!u || m.role !== 'assistant' || ts < from || ts > to) continue;
      acc.input += u.input || 0; acc.output += u.output || 0;
      acc.cache_read += u.cacheRead || 0; acc.cache_write += u.cacheWrite || 0;
      acc.cost += u.cost?.total || 0; acc.calls += 1;
      if (m.model && !acc.models.includes(m.model)) acc.models.push(m.model);
    }
  }
  if (!acc.calls) die('no omp usage in window', 4);
  acc.model = acc.models.join('+'); delete acc.models;
  acc.cost = Math.round(acc.cost * 1e6) / 1e6;
  acc.attribution = 'time-window';
  process.stdout.write(JSON.stringify(acc));
}

// Tukang usage from Antigravity CLI transcripts: each worker step after a USER_INPUT that names a task id
// belongs to that task, so two queued tasks in one worker session are not double counted.
function usageAgy([brainDir, taskId, fromMs, toMs]) {
  const from = Number(fromMs); const to = Number(toMs);
  const acc = { role: 'tukang', source: 'actual', kind: 'agy-session', model: 'agy-gemini', input: 0, output: 0, cache_read: 0, cache_write: 0, calls: 0, attribution: 'task-id' };
  const idRe = /t\d{8}-\d{6}-[0-9a-f]{4}/;
  if (fs.existsSync(brainDir)) {
    for (const d of fs.readdirSync(brainDir)) {
      const f = path.join(brainDir, d, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(f) || fs.statSync(f).mtimeMs < from) continue;
      const text = fs.readFileSync(f, 'utf8');
      if (!text.includes(taskId)) continue;
      let current = null;
      for (const line of text.split('\n')) {
        if (!line) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.type === 'USER_INPUT') { const m = idRe.exec(o.content || ''); if (m) current = m[0]; continue; }
        if (current !== taskId || o.source !== 'MODEL' || typeof o.input_tokens !== 'number') continue;
        const ts = Date.parse(o.created_at);
        if (ts < from || ts > to) continue;
        acc.input += o.input_tokens; acc.output += o.output_tokens || 0; acc.cache_read += o.cache_read_tokens || 0; acc.calls += 1;
      }
    }
  }
  if (!acc.calls) die('no agy usage for task', 4);
  process.stdout.write(JSON.stringify(acc));
}

function readUsage(dir) {
  const f = path.join(dir, 'usage.jsonl');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function summarize(dir) {
  const task = readJson(path.join(dir, 'task.json'));
  const st = fs.existsSync(path.join(dir, 'state.json')) ? readJson(path.join(dir, 'state.json')) : {};
  const all = readUsage(dir);
  // Handoff payload sizes are bridge-side estimates, not a model's total usage: report them apart.
  const rows = all.filter((x) => x.kind !== 'handoff');
  const handoffEst = all.filter((x) => x.kind === 'handoff').reduce((a, x) => a + (Number(x.input) || 0), 0);
  const role = (r) => {
    const act = rows.filter((x) => x.role === r && x.source === 'actual');
    const pick = act.length ? act : rows.filter((x) => x.role === r && x.source === 'estimated');
    if (!pick.length) return { in: null, out: null, cost: null, calls: 0, src: 'n/a', model: null };
    const sum = (k) => pick.reduce((a, x) => a + (Number(x[k]) || 0), 0);
    const hasCost = pick.some((x) => typeof x.cost === 'number');
    return {
      in: sum('input') + sum('cache_read') + sum('cache_write'), out: sum('output'),
      cost: hasCost ? sum('cost') : null, calls: sum('calls'),
      src: act.length ? 'actual' : 'estimated',
      model: [...new Set(pick.map((x) => x.model).filter(Boolean))].join('+') || null,
    };
  };
  const m = role('mandor'); const t = role('tukang');
  const parts = [m, t].filter((x) => x.src !== 'n/a');
  const total = parts.length ? parts.reduce((a, x) => a + x.in + x.out, 0) : null;
  const srcs = [...new Set(parts.map((x) => x.src))];
  // A pair-mode total missing one role understates usage; flag it instead of hiding it.
  const incomplete = parts.length < ((task.mode || 'pair') === 'single' ? 1 : 2);
  const costs = [m, t].filter((x) => x.cost != null);
  const end = st.closed_at || Date.now();
  return {
    task_id: task.task_id, scenario: task.scenario || '', mode: task.mode || 'pair', complexity: task.task_type,
    mandor_model: m.model || 'n/a', tukang_model: t.model || task.tukang_model || 'n/a',
    mandor_in: m.in, mandor_out: m.out, mandor_src: m.src,
    tukang_in: t.in, tukang_out: t.out, tukang_src: t.src,
    total_tokens: total,
    total_src: !parts.length ? 'n/a' : (srcs.length === 1 ? srcs[0] : 'mixed') + (incomplete ? '+incomplete' : ''),
    cost_usd: costs.length ? Math.round(costs.reduce((a, x) => a + x.cost, 0) * 1e4) / 1e4 : null,
    cost_src: !costs.length ? 'n/a' : costs.length < parts.length ? 'partial' : new Set(costs.map((x) => x.src)).size === 1 ? costs[0].src : 'mixed',
    duration_s: st.created_at ? Math.round((end - st.created_at) / 1000) : null,
    model_calls: m.calls + t.calls, retries: st.retries || 0,
    verify: st.verify ? (st.verify.skipped ? 'skipped' : `exit ${st.verify.exit}`) : 'not run',
    approval: st.state || 'PENDING',
    handoff_tokens_est: handoffEst || null,
  };
}

const COLS = ['task_id', 'scenario', 'mode', 'complexity', 'mandor_model', 'tukang_model', 'mandor_in', 'mandor_out', 'mandor_src',
  'tukang_in', 'tukang_out', 'tukang_src', 'total_tokens', 'total_src', 'cost_usd', 'cost_src', 'duration_s', 'model_calls',
  'retries', 'verify', 'approval', 'handoff_tokens_est'];
const fmt = (v) => (v === null || v === undefined ? 'n/a' : String(v));

function taskDirs(tasksDir, id) {
  if (!fs.existsSync(tasksDir)) return [];
  return fs.readdirSync(tasksDir).filter((d) => (!id || d === id) && fs.existsSync(path.join(tasksDir, d, 'task.json'))).map((d) => path.join(tasksDir, d));
}

function usageReport(args) {
  const csv = args.includes('--csv');
  const [tasksDir, id] = args.filter((a) => a !== '--csv');
  const rows = taskDirs(tasksDir, id).map(summarize);
  if (!rows.length) die('no tasks', 3);
  if (csv) { process.stdout.write([COLS.join(','), ...rows.map((r) => COLS.map((c) => JSON.stringify(fmt(r[c]))).join(','))].join('\n') + '\n'); return; }
  const tbl = [COLS, ...rows.map((r) => COLS.map((c) => fmt(r[c])))];
  process.stdout.write(tbl.map((r) => '| ' + r.join(' | ') + ' |').join('\n').replace(/^(.*)\n/, `$1\n|${COLS.map(() => '---').join('|')}|\n`) + '\n');
  process.stdout.write('src: actual = provider-reported usage; estimated = bytes/4 approximation; n/a = not recorded.\n');
}

function usageCompare([tasksDir]) {
  const rows = taskDirs(tasksDir).map(summarize).filter((r) => r.scenario);
  if (!rows.length) die('no tasks with a scenario field', 3);
  const groups = {};
  for (const r of rows) (groups[`${r.scenario}\t${r.mode}`] ||= []).push(r);
  const out = ['| scenario | mode | runs | success | avg_total_tokens | avg_cost_usd | avg_duration_s | avg_retries | token_src |', '|---|---|---|---|---|---|---|---|---|'];
  const avg = (xs) => { const v = xs.filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100 : 'n/a'; };
  for (const [k, rs] of Object.entries(groups).sort()) {
    const [sc, mode] = k.split('\t');
    out.push(`| ${sc} | ${mode} | ${rs.length} | ${rs.filter((r) => r.approval === 'APPROVED').length}/${rs.length} | ${avg(rs.map((r) => r.total_tokens))} | ${avg(rs.map((r) => r.cost_usd))} | ${avg(rs.map((r) => r.duration_s))} | ${avg(rs.map((r) => r.retries))} | ${[...new Set(rs.map((r) => r.total_src))].join('/')} |`);
  }
  process.stdout.write(out.join('\n') + '\n');
}

// ---------- task bookkeeping ----------
const ACTIVE = ['ASSIGNED', 'EXECUTING', 'VERIFYING', 'REVIEWING'];

function recordCheck([stateFile, scopeFile, cmd, rc, secs, logFile, fp, stat, mainChangedFile]) {
  const st = readJson(stateFile);
  const scope = readJson(scopeFile);
  const lines = (f) => (f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : []);
  const verify = cmd === 'none' ? { cmd, skipped: true } : { cmd, exit: Number(rc), secs: Number(secs), timed_out: Number(rc) === 124 };
  const main_changed = lines(mainChangedFile);
  st.checks = { at: Date.now(), scope, verify, fingerprint: fp, diffstat: stat, main_changed };
  st.verify = verify;
  writeJsonAtomic(stateFile, st);
  const approvable = scope.ok && scope.changed.length > 0 && (verify.skipped || verify.exit === 0);
  const s = { scope: scope.ok ? 'ok' : 'VIOLATION', changed: scope.changed };
  if (scope.out_of_scope.length) s.out_of_scope = scope.out_of_scope;
  if (scope.sensitive.length) s.sensitive = scope.sensitive;
  if (!scope.changed.length) s.note = 'no changes';
  s.verify = verify.skipped ? 'skipped' : { cmd, exit: verify.exit, secs: verify.secs, ...(verify.timed_out && { timed_out: true }) };
  s.diffstat = stat;
  if (main_changed.length) s.main_tree_changed = main_changed;
  s.approvable = approvable;
  let out = 'CHECK ' + JSON.stringify(s);
  if (!verify.skipped && verify.exit !== 0) out += '\nVERIFY_TAIL\n' + lines(logFile).slice(-15).join('\n');
  process.stdout.write(out + '\n');
  process.exit(approvable ? 0 : 5);
}

function amendAllow([taskFile, ...paths]) {
  const t = readJson(taskFile);
  for (const p of paths) {
    const r = normRelPath(p);
    if (r.err) die(`allow: ${r.err}`);
    if (matchesAny(r.ok, sensitivePatterns()) && !t.allow_sensitive) die(`allow: '${r.ok}' is sensitive; recreate the task with allow_sensitive=true`);
    if (!t.allowed_files.includes(r.ok)) t.allowed_files.push(r.ok);
  }
  writeJsonAtomic(taskFile, t);
  process.stdout.write(JSON.stringify(t.allowed_files));
}

function list([tasksDir, which]) {
  for (const d of taskDirs(tasksDir)) {
    const t = readJson(path.join(d, 'task.json'));
    const sf = path.join(d, 'state.json');
    const s = fs.existsSync(sf) ? readJson(sf) : {};
    const state = s.state || 'PENDING';
    if (which === 'active' && !ACTIVE.includes(state)) continue;
    if (which === 'shared' && (!ACTIVE.includes(state) || t.isolate)) continue;
    const v = s.verify ? (s.verify.skipped ? 'verify:skip' : `verify:${s.verify.exit}`) : 'verify:-';
    process.stdout.write([t.task_id, state, t.task_type, t.isolate ? 'iso' : 'shared', `retry:${s.retries || 0}/${t.max_retries}`, v,
      new Date(s.updated_at || s.created_at || 0).toISOString()].join('\t') + '\n');
  }
}

// ---------- parallel shared-tree tasks ----------
const isGlob = (p) => /[*?]/.test(p) || p.endsWith('/');
const staticPrefix = (p) => (p.includes('/') ? p.split(/[*?]/)[0] : '');
// honey: glob vs glob compares static prefixes only (lib/** vs src/** disjoint, *.dart vs anything overlaps).
const globsClash = (p, q) => { const a = staticPrefix(p), b = staticPrefix(q); return a.startsWith(b) || b.startsWith(a); };
// overlap <taskA> <taskB>: exit 1 + offending patterns when the allowlists can touch the same file.
function overlap([taskA, taskB]) {
  const a = readJson(taskA).allowed_files, b = readJson(taskB).allowed_files;
  const hit = new Set();
  for (const [x, y] of [[a, b], [b, a]]) {
    for (const p of x) {
      const clash = isGlob(p) ? y.some((q) => (isGlob(q) ? globsClash(p, q) : matchesAny(q, [p]))) : matchesAny(p, y);
      if (clash) hit.add(p);
    }
  }
  if (hit.size) { process.stdout.write([...hit].join(' ')); process.exit(1); }
}
// drop-peers <selfTask> <changedFile> <peerTask...>: changed files minus those owned by parallel peers.
function dropPeers([selfTask, changedFile, ...peerTasks]) {
  const own = readJson(selfTask).allowed_files;
  const peer = peerTasks.flatMap((f) => readJson(f).allowed_files);
  const sens = sensitivePatterns();
  const keep = fs.readFileSync(changedFile, 'utf8').split('\n').filter(Boolean)
    .filter((f) => matchesAny(f, own) || matchesAny(f, sens) || !matchesAny(f, peer));
  process.stdout.write(keep.map((f) => f + '\n').join(''));
}

// ---------- memory: tukang lessons, user complaints, Mandor scorecard ----------
const STATE_BASE = process.env.MANDOR_STATE_DIR || path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local/state'), 'mandordantukangv3');
const LESSONS = path.join(STATE_BASE, 'lessons.jsonl');
const COMPLAINTS = path.join(STATE_BASE, 'complaints.jsonl');
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)
  .flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } }) : []);
const appendJsonl = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, JSON.stringify(o) + '\n'); };
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 300);
const lessonRole = (r) => (r === 'all' ? 'all' : normRole(r || 'tukang'));

// lesson-add <role|all> <source> <task|-> <text...>: dedup by role+text.
function lessonAdd([role, source, task, ...text]) {
  const r = lessonRole(role), t = oneLine(text.join(' '));
  if (!t) die('lesson text required');
  if (readJsonl(LESSONS).some((l) => l.role === r && l.text === t)) return;
  appendJsonl(LESSONS, { ts: Date.now(), role: r, source: source || 'manual', task: task && task !== '-' ? task : null, text: t });
  process.stdout.write(`lesson saved for ${r}\n`);
}
// honey: newest 10 per role go into every handoff; older ones stay in the file. Raise n if lessons get lost.
function lessonsFor(role, n = 10) {
  const r = lessonRole(role), seen = new Set();
  return readJsonl(LESSONS).filter((l) => l.role === 'all' || l.role === r).reverse()
    .filter((l) => !seen.has(l.text) && seen.add(l.text)).slice(0, n);
}
function lessons([role]) {
  const rows = role ? lessonsFor(role, 1e9) : readJsonl(LESSONS).reverse();
  process.stdout.write(rows.map((l) => `${new Date(l.ts).toISOString().slice(0, 10)}\t${l.role}\t${l.source}\t${l.task || '-'}\t${l.text}`).join('\n') + (rows.length ? '\n' : 'no lessons\n'));
}

function complaintTally() {
  const by = {};
  for (const c of readJsonl(COMPLAINTS)) { const k = c.topic; by[k] = { topic: k, n: (by[k]?.n || 0) + 1, last: c.text, ts: c.ts }; }
  return Object.values(by).sort((a, b) => b.n - a.n || b.ts - a.ts);
}
// complaint-add <topic> <text...>: prints the running count so Mandor sees a repeat at once.
function complaintAdd([topic, ...text]) {
  const k = oneLine(topic).toLowerCase(), t = oneLine(text.join(' '));
  if (!k || !t) die('usage: complaint add "<topic>" "<what the user said>"');
  appendJsonl(COMPLAINTS, { ts: Date.now(), topic: k, text: t });
  const n = complaintTally().find((c) => c.topic === k).n;
  process.stdout.write(n >= 2 ? `REPEAT x${n}: '${k}'. Same complaint again: fix the cause in rules/lessons now.\n` : `complaint logged: '${k}'\n`);
}
function complaints() {
  const rows = complaintTally();
  process.stdout.write(rows.length ? rows.map((c) => `x${c.n}\t${c.topic}\t${c.last}`).join('\n') + '\n' : 'no complaints\n');
}

// scorecard [days]: Mandor's leadership result across every repo. Verdict rules live here, not in prompts.
function scorecard([days]) {
  const d = Number(days) > 0 ? Number(days) : 1, since = Date.now() - d * 864e5;
  const reposDir = path.join(STATE_BASE, 'repos');
  const dirs = fs.existsSync(reposDir) ? fs.readdirSync(reposDir).flatMap((r) => taskDirs(path.join(reposDir, r, 'tasks'))) : [];
  const closed = dirs.map((dir) => { const sf = path.join(dir, 'state.json'); return fs.existsSync(sf) ? readJson(sf) : {}; })
    .filter((s) => (s.closed_at || 0) >= since);
  const approved = closed.filter((s) => s.state === 'APPROVED');
  const firstPass = approved.filter((s) => !Number(s.retries)).length;
  const failed = closed.filter((s) => s.state === 'REJECTED' || s.state === 'FAILED').length;
  const rejects = closed.reduce((a, s) => a + (Number(s.retries) || 0), 0);
  const cs = readJsonl(COMPLAINTS).filter((c) => c.ts >= since);
  const tally = complaintTally();
  const repeats = [...new Set(cs.map((c) => c.topic))].filter((k) => tally.find((t) => t.topic === k).n >= 2);
  const rate = closed.length ? Math.round(firstPass / closed.length * 100) : null;
  const verdict = cs.length >= 3 || repeats.length >= 2 || (rate !== null && rate < 50) ? 'RESIGN'
    : repeats.length || cs.length || (rate !== null && rate < 80) ? 'WARNING' : 'KEEP';
  process.stdout.write([
    `SCORECARD last ${d}d`,
    `tasks closed ${closed.length} | approved first pass ${firstPass} | rejects sent ${rejects} | failed/rejected ${failed} | first-pass rate ${rate === null ? 'n/a' : rate + '%'}`,
    `user complaints ${cs.length}${repeats.length ? ` | REPEATED: ${repeats.join(', ')}` : ''}`,
    `lessons learned ${readJsonl(LESSONS).filter((l) => l.ts >= since).length}`,
    `VERDICT ${verdict}  (RESIGN: >=3 complaints, >=2 repeated topics, or first-pass <50%; WARNING: any complaint/repeat or first-pass <80%)`,
  ].join('\n') + '\n');
}

const cmds = { validate, handoff, get, set, resolve, scope, 'record-check': recordCheck, 'amend-allow': amendAllow, list,
  overlap, 'drop-peers': dropPeers, 'usage-omp': usageOmp, 'usage-agy': usageAgy, 'usage-report': usageReport, 'usage-compare': usageCompare,
  'lesson-add': lessonAdd, lessons, 'complaint-add': complaintAdd, complaints, scorecard };
const [cmd, ...rest] = process.argv.slice(2);
if (!cmds[cmd]) die(`mandor-lib: unknown command '${cmd}'`);
cmds[cmd](rest);
