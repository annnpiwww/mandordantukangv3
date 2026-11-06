// plugins/squad-farm/test.js
// Automated tests for Squad Farm (node:test + node:assert, stdlib only)

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const { buildSnapshot, createServer, parseTerminalOutput } = require('./server.js');
const { NODES, findPath, planActivity } = require('./behavior.js');

test('parseTerminalOutput detects spinner glyphs and activities', () => {
  const workingText = `
    Some header
    Running test suite
    ⣟  Executing step 3/5
    ctrl+p commands
  `;
  const res1 = parseTerminalOutput(workingText);
  assert.strictEqual(res1.activity, 'working');
  assert.ok(res1.doing.length > 0);

  const idleText = `
    Completed successfully
    $ ready
  `;
  const res2 = parseTerminalOutput(idleText);
  assert.strictEqual(res2.activity, 'idle');
});

test('buildSnapshot correctly resolves state, handles, tokens, mood and skips corrupted tasks', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'squad-farm-test-'));
  const stateDir = path.join(tmpRoot, 'state');
  const repoDir = path.join(tmpRoot, 'repo');

  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(repoDir, { recursive: true });
  fs.mkdirSync(path.join(stateDir, 'pairs'), { recursive: true });

  const resolvedRepo = fs.realpathSync(repoDir);
  const repoName = 'testrepo-999';

  const pairData = {
    mandor: 'term_mandor_001',
    worktree: resolvedRepo,
    'tukang-ui': 'term_ui_002',
    'tukang-coder': 'term_coder_003',
    'tukang-sec': 'term_sec_004'
  };
  fs.writeFileSync(path.join(stateDir, 'pairs', `${repoName}.json`), JSON.stringify(pairData));

  const tasksBaseDir = path.join(stateDir, 'repos', repoName, 'tasks');
  fs.mkdirSync(tasksBaseDir, { recursive: true });

  const now = Date.now();

  // Task 1: APPROVED with usage
  const t1Dir = path.join(tasksBaseDir, 'task-001');
  fs.mkdirSync(t1Dir);
  fs.writeFileSync(path.join(t1Dir, 'task.json'), JSON.stringify({
    objective: 'Short objective 1',
    target_worker: 'tukang-ui',
    task_type: 'MEDIUM'
  }));
  fs.writeFileSync(path.join(t1Dir, 'state.json'), JSON.stringify({
    state: 'APPROVED',
    retries: 0,
    created_at: now - 60000,
    updated_at: now - 30000,
    monitor_alert: 'OK',
    checks: { verify: { exit: 0 } }
  }));
  fs.writeFileSync(path.join(t1Dir, 'usage.jsonl'), [
    JSON.stringify({ role: 'tukang', input: 100, output: 50, cost: 0.05, source: 'actual' }),
    JSON.stringify({ role: 'mandor', input: 200, output: 80, cost: 0.10, source: 'actual' })
  ].join('\n'));

  // Task 2: EXECUTING with STALL alert, long objective
  const longObjective = 'A'.repeat(200);
  const t2Dir = path.join(tasksBaseDir, 'task-002');
  fs.mkdirSync(t2Dir);
  fs.writeFileSync(path.join(t2Dir, 'task.json'), JSON.stringify({
    objective: longObjective,
    target_worker: 'tukang-coder',
    task_type: 'COMPLEX'
  }));
  fs.writeFileSync(path.join(t2Dir, 'state.json'), JSON.stringify({
    state: 'EXECUTING',
    retries: 0,
    created_at: now - 40000,
    updated_at: now - 10000,
    monitor_alert: 'STALL ALERT: no response',
    checks: {}
  }));

  // Task 3: Garbled state.json
  const t3Dir = path.join(tasksBaseDir, 'task-003');
  fs.mkdirSync(t3Dir);
  fs.writeFileSync(path.join(t3Dir, 'task.json'), JSON.stringify({ objective: 'Garbled task' }));
  fs.writeFileSync(path.join(t3Dir, 'state.json'), '{ "state": "BROKEN", unclosed json');

  // Stub terminal reader
  const stubTerminalReader = async (handle) => {
    if (handle === 'term_ui_002') return 'Running tests... ⣟ step 1';
    if (handle === 'term_coder_003') return 'idle in terminal\n$ echo done';
    if (handle === 'term_sec_004') throw new Error('Offline terminal');
    return '';
  };

  const snap = await buildSnapshot({
    repo: resolvedRepo,
    stateDir,
    terminalReader: stubTerminalReader
  });

  // Verify worker handles and activity
  assert.strictEqual(snap.mandor.handle, 'term_mandor_001');
  assert.strictEqual(snap.workers.length, 3);

  const uiWorker = snap.workers.find(w => w.role === 'ui');
  assert.strictEqual(uiWorker.handle, 'term_ui_002');
  assert.strictEqual(uiWorker.online, true);
  assert.strictEqual(uiWorker.activity, 'working');

  const coderWorker = snap.workers.find(w => w.role === 'coder');
  assert.strictEqual(coderWorker.handle, 'term_coder_003');
  assert.strictEqual(coderWorker.online, true);
  assert.strictEqual(coderWorker.activity, 'idle');
  assert.strictEqual(coderWorker.task_id, 'task-002');

  const secWorker = snap.workers.find(w => w.role === 'sec');
  assert.strictEqual(secWorker.handle, 'term_sec_004');
  assert.strictEqual(secWorker.online, false);
  assert.strictEqual(secWorker.activity, 'offline');
  assert.strictEqual(secWorker.doing, 'tidak terhubung');

  // Verify mood: Task 2 has STALL, so impatient overrides happy from Task 1
  assert.strictEqual(snap.mandor.mood, 'impatient');

  // Verify tasks: garbled task-003 must be skipped
  assert.strictEqual(snap.tasks.length, 2);

  const task2 = snap.tasks.find(t => t.id === 'task-002');
  assert.strictEqual(task2.objective.length, 140);
  assert.strictEqual(task2.alert, 'STALL ALERT: no response');

  const task1 = snap.tasks.find(t => t.id === 'task-001');
  assert.strictEqual(task1.tokens.tukang, 150);
  assert.strictEqual(task1.tokens.mandor, 280);
  assert.strictEqual(task1.tokens.source, 'actual');

  assert.strictEqual(snap.totals.tokens, 430);
  assert.strictEqual(snap.totals.cost_usd, 0.15);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('HTTP server serves static files, snapshot.json, blocks path traversal, binds 127.0.0.1', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'squad-farm-http-'));
  const stateDir = path.join(tmpRoot, 'state');
  const repoDir = path.join(tmpRoot, 'repo');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(repoDir, { recursive: true });

  const server = createServer({ repo: repoDir, stateDir });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const get = (urlPath) => new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }).on('error', reject);
  });

  // Verify static routes
  const rIndex = await get('/');
  assert.strictEqual(rIndex.status, 200);
  assert.ok(rIndex.data.includes('<canvas id="farmCanvas"'));

  const rApp = await get('/app.js');
  assert.strictEqual(rApp.status, 200);
  assert.ok(rApp.data.includes('Squad Farm'));

  const rSprites = await get('/sprites.js');
  assert.strictEqual(rSprites.status, 200);
  assert.ok(rSprites.data.includes('SquadSprites'));

  const rCss = await get('/style.css');
  assert.strictEqual(rCss.status, 200);
  assert.ok(rCss.data.includes('--font-mono'));

  // Verify snapshot.json
  const rSnap = await get('/snapshot.json');
  assert.strictEqual(rSnap.status, 200);
  const snapObj = JSON.parse(rSnap.data);
  assert.ok(snapObj.workers);

  // Path traversal attempts must return 404
  const rTrav1 = await get('/../../etc/passwd');
  assert.strictEqual(rTrav1.status, 404);

  const rTrav2 = await get('/../server.js');
  assert.strictEqual(rTrav2.status, 404);

  const rNotFound = await get('/unknown.file');
  assert.strictEqual(rNotFound.status, 404);

  server.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('diffing task transitions triggers praise on APPROVED and angry on REJECTED exactly once', () => {
  const previous = new Map([
    ['t1', { state: 'EXECUTING', retries: 0, alert: 'OK' }],
    ['t2', { state: 'VERIFYING', retries: 0, alert: 'OK' }]
  ]);
  const queue = [];

  function diff(tasks) {
    for (const t of tasks) {
      const prev = previous.get(t.id);
      if (prev) {
        if (t.state === 'APPROVED' && prev.state !== 'APPROVED') {
          queue.push({ type: 'APPROVED', taskId: t.id });
        } else if (t.state === 'REJECTED' && prev.state !== 'REJECTED') {
          queue.push({ type: 'REJECTED', taskId: t.id });
        }
      }
      previous.set(t.id, { state: t.state, retries: t.retries, alert: t.alert });
    }
  }

  // First transition: t1 flips to APPROVED, t2 flips to REJECTED
  diff([
    { id: 't1', state: 'APPROVED', retries: 0, alert: 'OK' },
    { id: 't2', state: 'REJECTED', retries: 0, alert: 'OK' }
  ]);

  assert.strictEqual(queue.length, 2);
  assert.strictEqual(queue[0].type, 'APPROVED');
  assert.strictEqual(queue[1].type, 'REJECTED');

  // Next snapshot arrives with same states: animation must NOT trigger again (plays exactly once)
  diff([
    { id: 't1', state: 'APPROVED', retries: 0, alert: 'OK' },
    { id: 't2', state: 'REJECTED', retries: 0, alert: 'OK' }
  ]);
  assert.strictEqual(queue.length, 2); // still 2, not repeated!
});

test('planActivity and findPath follow office waypoint rules and determinism', () => {
  const baseSnap = {
    workers: [
      { role: 'ui', online: true, activity: 'working', doing: 'Editing CSS', task_id: 't-ui' },
      { role: 'coder', online: true, activity: 'idle', doing: 'idle', task_id: 't-rev' },
      { role: 'sec', online: false, activity: 'offline', doing: 'tidak terhubung', task_id: null }
    ],
    tasks: [
      { id: 't-ui', worker: 'ui', state: 'EXECUTING', alert: 'OK' },
      { id: 't-rev', worker: 'coder', state: 'VERIFYING', alert: 'OK' }
    ],
    mandor: { mood: 'calm' }
  };

  // (a) working -> returns own desk node
  const pWorking = planActivity('ui', baseSnap, 100000, {});
  assert.strictEqual(pWorking.node, 'desk_ui');
  assert.strictEqual(pWorking.pose, 'typing');
  assert.strictEqual(pWorking.hidden, false);

  // (b) VERIFYING -> returns meeting chair node
  const pVerifying = planActivity('coder', baseSnap, 100000, {});
  assert.ok(['meeting_1', 'meeting_2', 'meeting_3'].includes(pVerifying.node));
  assert.strictEqual(pVerifying.bubble, 'Nunggu review...');

  // (c) idle -> returns one of coffee/cooler/vending/sofa and is deterministic for same seed+time bucket
  const idleSnap = {
    workers: [
      { role: 'ui', online: true, activity: 'idle', doing: 'idle', task_id: null }
    ],
    tasks: [],
    mandor: { mood: 'calm' }
  };
  const mem1 = { idleSince: 90000 };
  const mem2 = { idleSince: 90000 };
  const pIdleA = planActivity('ui', idleSnap, 100000, mem1);
  const pIdleB = planActivity('ui', idleSnap, 105000, mem2); // same 30s bucket (floor(100000/30000) === 3)
  assert.ok(['coffee', 'cooler', 'vending', 'sofa_1', 'sofa_2'].includes(pIdleA.node));
  assert.strictEqual(pIdleA.node, pIdleB.node);

  // (d) idle > 5 min -> sofa sleep
  const memLongIdle = { idleSince: 1000 };
  const pSleep = planActivity('ui', idleSnap, 1000 + 5 * 60 * 1000 + 500, memLongIdle);
  assert.ok(pSleep.node === 'sofa_1' || pSleep.node === 'sofa_2');
  assert.strictEqual(pSleep.pose, 'sleep');

  // (e) offline -> hidden true
  const pOffline = planActivity('sec', baseSnap, 100000, {});
  assert.strictEqual(pOffline.hidden, true);
  assert.strictEqual(pOffline.node, null);

  // (f) BFS path from desk_ui to coffee exists and never includes a wall tile
  const pathNodes = findPath('desk_ui', 'coffee');
  assert.ok(pathNodes.length >= 3);
  assert.strictEqual(pathNodes[0], 'desk_ui');
  assert.strictEqual(pathNodes[pathNodes.length - 1], 'coffee');
  for (const n of pathNodes) {
    assert.ok(NODES[n], `Node ${n} must exist`);
    assert.notStrictEqual(NODES[n].type, 'wall');
  }
});

test('buildSnapshot parses latest report PLAN eta:<N>m from events.log into task.eta_at', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'squad-farm-eta-'));
  const stateDir = path.join(tmpRoot, 'state');
  const repoDir = path.join(tmpRoot, 'repo');

  fs.mkdirSync(path.join(stateDir, 'pairs'), { recursive: true });
  fs.mkdirSync(repoDir, { recursive: true });
  const resolvedRepo = fs.realpathSync(repoDir);
  const repoName = 'etarepo-1';

  fs.writeFileSync(path.join(stateDir, 'pairs', `${repoName}.json`), JSON.stringify({
    mandor: 'term_m',
    worktree: resolvedRepo,
    'tukang-ui': 'term_u'
  }));

  const t1Dir = path.join(stateDir, 'repos', repoName, 'tasks', 'task-eta-1');
  const t2Dir = path.join(stateDir, 'repos', repoName, 'tasks', 'task-no-eta');
  fs.mkdirSync(t1Dir, { recursive: true });
  fs.mkdirSync(t2Dir, { recursive: true });

  const now = Date.now();
  const planIso1 = new Date(now - 600000).toISOString();
  const planIso2 = new Date(now - 300000).toISOString();

  fs.writeFileSync(path.join(t1Dir, 'task.json'), JSON.stringify({
    objective: 'Task with ETA',
    target_worker: 'tukang-ui',
    task_type: 'COMPLEX'
  }));
  fs.writeFileSync(path.join(t1Dir, 'state.json'), JSON.stringify({
    state: 'EXECUTING',
    retries: 0,
    created_at: now - 600000,
    updated_at: now - 60000
  }));
  fs.writeFileSync(path.join(t1Dir, 'events.log'), [
    `${planIso1}\treport PLAN: initial plan | eta: 10m`,
    `${planIso2}\treport PLAN: revised plan | files: a.js | eta: 25m`
  ].join('\n'));

  fs.writeFileSync(path.join(t2Dir, 'task.json'), JSON.stringify({
    objective: 'Task without ETA',
    target_worker: 'tukang-coder',
    task_type: 'MEDIUM'
  }));
  fs.writeFileSync(path.join(t2Dir, 'state.json'), JSON.stringify({
    state: 'EXECUTING',
    retries: 0,
    created_at: now - 300000,
    updated_at: now - 50000
  }));
  fs.writeFileSync(path.join(t2Dir, 'events.log'), `${planIso2}\tstate -> EXECUTING\n`);

  const snap = await buildSnapshot({
    repo: resolvedRepo,
    stateDir,
    terminalReader: async () => 'idle'
  });

  const taskWithEta = snap.tasks.find(t => t.id === 'task-eta-1');
  const taskNoEta = snap.tasks.find(t => t.id === 'task-no-eta');

  assert.strictEqual(taskWithEta.eta_at, Date.parse(planIso2) + 25 * 60000);
  assert.strictEqual(taskNoEta.eta_at, null);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
