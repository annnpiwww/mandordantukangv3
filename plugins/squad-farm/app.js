// plugins/squad-farm/app.js
// Squad Farm / Squad Office client engine: SSE sync, top-down 384x216 office renderer, waypoint walker,
// ZackD Films style cinematic cutscenes, and DOM HUD overlay.

(function () {
  const canvas = document.getElementById('farmCanvas');
  const ctx = canvas.getContext('2d');
  const hudOverlay = document.getElementById('hudOverlay');
  const taskListEl = document.getElementById('taskList');
  const repoNameEl = document.getElementById('repoName');
  const liveDotEl = document.getElementById('liveDot');
  const liveTextEl = document.getElementById('liveText');
  const totalTokensEl = document.getElementById('totalTokens');
  const totalCostEl = document.getElementById('totalCost');
  const costItemEl = document.getElementById('costItem');
  const liveAnnouncer = document.getElementById('liveAnnouncer');
  const farmViewport = document.getElementById('farmViewport');
  const cinematicLayer = document.getElementById('cinematicLayer');
  const cutsceneSubtitle = document.getElementById('cutsceneSubtitle');

  const B = window.SquadBehavior;
  const S = window.SquadSprites;

  const BASE_W = B.MAP_W; // 384
  const BASE_H = B.MAP_H; // 216

  let currentSnapshot = null;
  let previousTaskStates = new Map();
  let selectedWorkerRole = null;
  let selectedTaskId = null;
  const behaviorMemory = {};

  // Cutscene queue & active state
  const cutsceneQueue = [];
  let activeCutscene = null;
  let cutsceneElapsed = 0;
  let urlCutsceneTriggered = false;

  // Scripted demo cutscene state (?cutscene=demo)
  let demoActive = false;
  let demoStep = 0;
  let demoStepElapsed = 0;
  let demoSubtitle = '';
  let demoCamera = null;
  let demoEndCard = null;
  let demoStartTime = 0;
  window.__demoCues = [];

  function emitCue(type, extra = {}) {
    if (!demoActive) return;
    const t = Math.max(0, performance.now() - demoStartTime);
    const cue = { t: Math.round(t), type, ...extra };
    window.__demoCues.push(cue);
  }

  // Camera state in 384x216 world space
  const camera = {
    zoom: 1,
    cx: BASE_W / 2,
    cy: BASE_H / 2,
    shakeX: 0,
    shakeY: 0,
    tx: 0,
    ty: 0
  };

  const ROLE_LABELS = {
    mandor: 'Mandor',
    ui: 'UI',
    coder: 'Coder',
    sec: 'Security'
  };

  const DESK_COORDS = {
    ui: { x: 56, y: 58 },
    coder: { x: 144, y: 58 },
    sec: { x: 100, y: 134 }
  };

  // Character world entities
  const entities = {
    mandor: createEntity('mandor', 'mandor_desk'),
    ui: createEntity('ui', 'desk_ui'),
    coder: createEntity('coder', 'desk_coder'),
    sec: createEntity('sec', 'desk_sec')
  };

  function createEntity(role, startNode) {
    const pt = B.NODES[startNode] || { x: 192, y: 108 };
    return {
      role,
      x: pt.x,
      y: pt.y,
      currentNode: startNode,
      targetNode: startNode,
      path: [],
      facing: 'down',
      pose: 'idle',
      bubble: null,
      hidden: false,
      isMoving: false,
      initialized: false
    };
  }

  const PRAISE_LINES = [
    'Mandor: Mantap, rapi!',
    'Mandor: Nah gini dong, langsung approve!',
    'Mandor: Kerja bagus, lanjut!'
  ];

  const ANGRY_LINES = [
    'Mandor tidak terima.',
    'Mandor: Ini apa?! Ulang sesuai spec!',
    'Mandor: Jangan asal DONE, revisi!'
  ];

  function formatTokens(n) {
    if (n === null || n === undefined) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function formatHHMM(epochMs) {
    const d = new Date(epochMs);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function computeEtaInfo(task, nowMs) {
    if (!task || typeof task.eta_at !== 'number') return null;
    const isOpen = ['ASSIGNED', 'EXECUTING', 'VERIFYING', 'REVIEWING'].includes(task.state);
    const startMs = typeof task.plan_at === 'number' ? task.plan_at : (task.eta_at - 15 * 60000);
    const totalSpan = Math.max(60000, task.eta_at - startMs);
    const rawPct = ((nowMs - startMs) / totalSpan) * 100;
    const pct = Math.max(5, Math.min(100, Math.round(rawPct)));
    const isLate = isOpen && nowMs > task.eta_at;
    const lateMins = isLate ? Math.max(1, Math.round((nowMs - task.eta_at) / 60000)) : 0;
    const label = isLate ? `telat ${lateMins}m` : `ETA ${formatHHMM(task.eta_at)}`;
    return {
      label,
      pct: isLate ? 100 : pct,
      isLate,
      hhmm: formatHHMM(task.eta_at)
    };
  }

  function getTimePeriod() {
    const hr = new Date().getHours();
    if (hr >= 6 && hr < 17) return 'day';
    if (hr >= 17 && hr < 19) return 'sunset';
    return 'night';
  }

  // Viewport scaling (fills left area completely without wide letterbox bars)
  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resizeCanvas() {
    const rect = farmViewport.getBoundingClientRect();
    const w = Math.max(384, Math.floor(rect.width));
    const h = Math.max(216, Math.floor(rect.height));

    canvas.width = BASE_W;
    canvas.height = BASE_H;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    scaleX = w / BASE_W;
    scaleY = h / BASE_H;
    offsetX = 0;
    offsetY = 0;

    renderHudOverlay();
  }

  window.addEventListener('resize', resizeCanvas);

  // Maps a world coordinate (wx, wy) in 384x216 through the active camera transform to viewport px
  function worldToViewport(wx, wy) {
    const sx = wx * camera.zoom + camera.tx;
    const sy = wy * camera.zoom + camera.ty;
    return {
      x: offsetX + sx * scaleX,
      y: offsetY + sy * scaleY
    };
  }

  function cubicEaseInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function announce(text) {
    if (liveAnnouncer) {
      liveAnnouncer.textContent = text;
    }
  }

  // Queue a ZackD Films style cinematic cutscene
  function queueCutscene(opts) {
    cutsceneQueue.push({
      type: opts.type, // 'DONE' | 'APPROVED' | 'REJECTED' | 'STALL'
      worker: opts.worker || 'coder',
      subtitle: opts.subtitle,
      bubbleMandor: opts.bubbleMandor || null,
      bubbleWorker: opts.bubbleWorker || null,
      duration: opts.duration || 3500,
      holdMid: Boolean(opts.holdMid)
    });
  }

  const DEMO_STEPS = [
    // Step 0: [3.5s] Mandor reading at desk
    {
      duration: 3500,
      enter() {
        demoSubtitle = 'Mandor bagi tugas ke squad';
        entities.mandor.pose = 'reading';
        entities.mandor.bubble = 'Cek progress squad dulu...';
        demoCamera = { zoom: 1.0, cx: BASE_W / 2, cy: BASE_H / 2 };
        emitCue('scene', { text: demoSubtitle });
        emitCue('typing', { action: 'start' });
        emitCue('bubble', { role: 'mandor', text: entities.mandor.bubble });
      }
    },
    // Step 1: [5.8s] Mandor walks to Coder desk
    {
      duration: 5800,
      enter() {
        demoSubtitle = 'Sidak dadakan ke meja Coder...';
        entities.mandor.bubble = null;
        entities.mandor.speed = 38;
        entities.mandor.targetNode = 'desk_coder';
        const p = B.findPath('mandor_desk', 'desk_coder');
        entities.mandor.path = p.slice(1);
        demoCamera = { zoom: 1.0, cx: BASE_W / 2, cy: BASE_H / 2 };
        emitCue('scene', { text: demoSubtitle });
        emitCue('walk_start', { role: 'mandor' });
      }
    },
    // Step 2: [4.0s] Mandor inspects Coder
    {
      duration: 4000,
      enter() {
        demoSubtitle = 'Sidak: Mandor cek progress Coder.';
        entities.mandor.path = [];
        entities.mandor.isMoving = false;
        entities.mandor.x = 116;
        entities.mandor.y = 74;
        entities.mandor.facing = 'right';
        entities.mandor.pose = 'impatient';
        entities.mandor.bubble = 'Kerja beneran nih? Bukan scroll Threads?';

        entities.coder.facing = 'up';
        entities.coder.pose = 'typing';
        entities.coder.bubble = 'Lagi ngoding Bos, sumpah!';

        demoCamera = { zoom: 1.6, cx: 130, cy: 50 };
        emitCue('walk_stop', { role: 'mandor' });
        emitCue('scene', { text: demoSubtitle });
        emitCue('bubble', { role: 'mandor', text: entities.mandor.bubble });
        emitCue('bubble', { role: 'coder', text: entities.coder.bubble });
      }
    },
    // Step 3: [2.6s] Mandor walks to UI desk
    {
      duration: 2600,
      enter() {
        demoSubtitle = 'Mandor mampir ke meja UI...';
        entities.mandor.bubble = null;
        entities.coder.bubble = null;
        entities.mandor.speed = 36;
        entities.mandor.targetNode = 'desk_ui';
        const p = B.findPath('work_aisle_mid', 'desk_ui');
        entities.mandor.path = p.slice(1);
        demoCamera = { zoom: 1.8, cx: 100, cy: 80 };
        emitCue('scene', { text: demoSubtitle });
        emitCue('walk_start', { role: 'mandor' });
      }
    },
    // Step 4: [3.5s] Mandor inspects UI desk
    {
      duration: 3500,
      enter() {
        demoSubtitle = 'Sidak: Mandor cek progress UI.';
        entities.mandor.path = [];
        entities.mandor.isMoving = false;
        entities.mandor.x = 84;
        entities.mandor.y = 74;
        entities.mandor.facing = 'left';
        entities.mandor.pose = 'impatient';
        entities.mandor.bubble = 'Desainnya mana?';

        entities.ui.facing = 'up';
        entities.ui.pose = 'typing';
        entities.ui.bubble = 'Bentar Bos, lagi dipoles.';

        demoCamera = { zoom: 1.6, cx: 70, cy: 50 };
        emitCue('walk_stop', { role: 'mandor' });
        emitCue('scene', { text: demoSubtitle });
        emitCue('bubble', { role: 'mandor', text: entities.mandor.bubble });
        emitCue('bubble', { role: 'ui', text: entities.ui.bubble });
      }
    },
    // Step 5: [3.5s] Coder & Mandor walk to meeting room
    {
      duration: 3500,
      enter() {
        demoSubtitle = 'Coder selesai ngoding, setor ke meeting room...';
        entities.mandor.bubble = null;
        entities.ui.bubble = null;

        entities.coder.speed = 60;
        entities.coder.targetNode = 'meeting_2';
        entities.coder.path = B.findPath('desk_coder', 'meeting_2').slice(1);

        entities.mandor.speed = 65;
        entities.mandor.targetNode = 'meeting_4';
        entities.mandor.path = B.findPath('desk_ui', 'meeting_4').slice(1);

        demoCamera = { zoom: 1.4, cx: 240, cy: 110 };
        emitCue('scene', { text: demoSubtitle });
        emitCue('typing', { action: 'stop' });
        emitCue('walk_start', { role: 'coder' });
      }
    },
    // Step 6: [3.8s] DONE cutscene in meeting room
    {
      duration: 3800,
      enter() {
        demoSubtitle = '';
        entities.coder.path = [];
        entities.coder.isMoving = false;
        snapEntityToNode(entities.coder, 'meeting_2');
        entities.coder.facing = 'right';

        entities.mandor.path = [];
        entities.mandor.isMoving = false;
        snapEntityToNode(entities.mandor, 'meeting_4');
        entities.mandor.facing = 'left';

        queueCutscene({
          type: 'DONE',
          worker: 'coder',
          subtitle: 'Coder menyerahkan hasil kerja...',
          bubbleMandor: 'Coba sini dicek.',
          bubbleWorker: 'Setor DONE, Bos!',
          duration: 3800,
          holdMid: false
        });
        emitCue('walk_stop', { role: 'coder' });
        emitCue('done');
        emitCue('bubble', { role: 'coder', text: 'Setor DONE, Bos!' });
        emitCue('bubble', { role: 'mandor', text: 'Coba sini dicek.' });
      }
    },
    // Step 7: [4.0s] REJECTED cutscene (MARAH)
    {
      duration: 4000,
      enter() {
        demoSubtitle = '';
        queueCutscene({
          type: 'REJECTED',
          worker: 'coder',
          subtitle: 'Mandor review hasil kerja...',
          bubbleMandor: 'Ini apa?! Test merah! Ulang!',
          bubbleWorker: 'Siap Bos, revisi...',
          duration: 4000,
          holdMid: false
        });
        emitCue('angry');
        emitCue('bubble', { role: 'mandor', text: 'Ini apa?! Test merah! Ulang!' });
        emitCue('bubble', { role: 'coder', text: 'Siap Bos, revisi...' });
      }
    },
    // Step 8: [3.0s] Coder walks back to desk fast
    {
      duration: 3000,
      enter() {
        demoSubtitle = 'Coder buru-buru benerin bug...';
        entities.mandor.bubble = null;
        entities.coder.bubble = 'Aduh panik, gas fix!';
        entities.coder.speed = 70;
        entities.coder.targetNode = 'desk_coder';
        entities.coder.path = B.findPath('meeting_2', 'desk_coder').slice(1);
        demoCamera = { zoom: 1.5, cx: 180, cy: 90 };
        emitCue('scene', { text: demoSubtitle });
        emitCue('walk_start', { role: 'coder' });
        emitCue('bubble', { role: 'coder', text: 'Aduh panik, gas fix!' });
      }
    },
    // Step 9: [2.5s] Coder walks back to meeting room
    {
      duration: 2500,
      enter() {
        demoSubtitle = 'Coder kembali ke meeting room...';
        entities.coder.speed = 85;
        entities.coder.bubble = 'Dah hijau Bos!';
        entities.coder.targetNode = 'meeting_2';
        entities.coder.path = B.findPath('desk_coder', 'meeting_2').slice(1);
        demoCamera = { zoom: 1.6, cx: 250, cy: 110 };
        emitCue('walk_stop', { role: 'coder' });
        emitCue('typing', { action: 'start' });
        emitCue('scene', { text: demoSubtitle });
        emitCue('walk_start', { role: 'coder' });
        emitCue('bubble', { role: 'coder', text: 'Dah hijau Bos!' });
      }
    },
    // Step 10: [4.0s] APPROVED cutscene
    {
      duration: 4000,
      enter() {
        demoSubtitle = '';
        entities.coder.speed = B.WALK_SPEED;
        entities.coder.path = [];
        entities.coder.isMoving = false;
        snapEntityToNode(entities.coder, 'meeting_2');
        entities.coder.facing = 'right';

        entities.mandor.path = [];
        entities.mandor.isMoving = false;
        snapEntityToNode(entities.mandor, 'meeting_4');
        entities.mandor.facing = 'left';

        queueCutscene({
          type: 'APPROVED',
          worker: 'coder',
          subtitle: 'Test hijau. Approve.',
          bubbleMandor: 'Mantap, rapi! Approve!',
          bubbleWorker: 'Alhamdulillah!',
          duration: 4000,
          holdMid: false
        });
        emitCue('walk_stop', { role: 'coder' });
        emitCue('typing', { action: 'stop' });
        emitCue('approve');
        emitCue('bubble', { role: 'mandor', text: 'Mantap, rapi! Approve!' });
        emitCue('bubble', { role: 'coder', text: 'Alhamdulillah!' });
      }
    },
    // Step 11: [3.5s] End card
    {
      duration: 3500,
      enter() {
        demoSubtitle = '';
        demoCamera = { zoom: 1.0, cx: BASE_W / 2, cy: BASE_H / 2 };
        showEndCard();
        emitCue('endcard');
      }
    }
  ];

  function startDemoMode() {
    demoActive = true;
    demoStep = 0;
    demoStepElapsed = 0;
    demoStartTime = performance.now();
    window.__demoCues = [];

    for (const r of ['mandor', 'ui', 'coder', 'sec']) {
      entities[r].hidden = false;
      entities[r].initialized = true;
      entities[r].bubble = null;
      entities[r].path = [];
      entities[r].isMoving = false;
      entities[r].speed = B.WALK_SPEED;
    }

    snapEntityToNode(entities.mandor, 'mandor_desk');
    entities.mandor.facing = 'down';
    entities.mandor.pose = 'reading';

    snapEntityToNode(entities.ui, 'desk_ui');
    entities.ui.facing = 'up';
    entities.ui.pose = 'typing';

    snapEntityToNode(entities.coder, 'desk_coder');
    entities.coder.facing = 'up';
    entities.coder.pose = 'typing';

    snapEntityToNode(entities.sec, 'desk_sec');
    entities.sec.facing = 'up';
    entities.sec.pose = 'typing';

    demoCamera = { zoom: 1.0, cx: BASE_W / 2, cy: BASE_H / 2 };
  }

  function showEndCard() {
    if (demoEndCard) return;
    demoEndCard = document.createElement('div');
    demoEndCard.id = 'demoEndCard';
    demoEndCard.style.cssText = [
      'position: absolute',
      'inset: 0',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'background: rgba(10, 14, 23, 0.94)',
      'z-index: 50',
      'color: #ffffff',
      'text-align: center',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ].join('; ');

    demoEndCard.innerHTML = `
      <div style="font-size: 44px; font-weight: 800; color: #58a6ff; letter-spacing: 1.5px; margin-bottom: 12px; text-shadow: 0 0 24px rgba(88,166,255,0.45);">orca-squad</div>
      <div style="font-size: 20px; color: #8b949e; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.5px;">github.com/annnpii/mandordantukangv3</div>
    `;
    farmViewport.appendChild(demoEndCard);
  }

  function updateDemo(dtMs) {
    if (demoStep >= DEMO_STEPS.length) return;
    const currentStep = DEMO_STEPS[demoStep];
    if (demoStepElapsed === 0 && currentStep.enter) {
      currentStep.enter();
    }
    demoStepElapsed += dtMs;
    if (demoStepElapsed >= currentStep.duration) {
      demoStep++;
      demoStepElapsed = 0;
      if (demoStep >= DEMO_STEPS.length) {
        window.__demoDone = true;
      }
    }
  }

  function checkUrlCutscene(snap) {
    if (urlCutsceneTriggered) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('cutscene');
    if (!mode) return;
    urlCutsceneTriggered = true;

    if (mode === 'demo') {
      startDemoMode();
      return;
    }

    const targetTask = (snap && snap.tasks && snap.tasks[0]) || { worker: 'coder', id: 't-demo' };
    const workerRole = targetTask.worker || 'coder';
    const workerLabel = ROLE_LABELS[workerRole] || 'Coder';

    // Position acting worker and Mandor in Meeting Room so cutscene zoom frames both clearly
    const chairMap = { ui: 'meeting_1', coder: 'meeting_2', sec: 'meeting_3' };
    const wChair = chairMap[workerRole] || 'meeting_2';
    snapEntityToNode(entities[workerRole], wChair);
    entities[workerRole].facing = 'right';
    snapEntityToNode(entities.mandor, 'meeting_4');
    entities.mandor.facing = 'left';

    if (mode === 'rejected' || mode === 'angry') {
      queueCutscene({
        type: 'REJECTED',
        worker: workerRole,
        subtitle: 'Mandor tidak terima.',
        bubbleMandor: 'Ini apa?! Ulang!',
        bubbleWorker: 'Siap Bos, revisi...',
        duration: 4000,
        holdMid: true
      });
    } else if (mode === 'done' || mode === 'deliver') {
      queueCutscene({
        type: 'DONE',
        worker: workerRole,
        subtitle: `${workerLabel} menyerahkan hasil kerja...`,
        bubbleMandor: 'Coba sini dicek.',
        bubbleWorker: 'Setor DONE, Bos!',
        duration: 4000,
        holdMid: true
      });
    } else {
      queueCutscene({
        type: 'APPROVED',
        worker: workerRole,
        subtitle: 'Mandor: Mantap, rapi!',
        bubbleMandor: 'Mantap, rapi!',
        bubbleWorker: 'Alhamdulillah!',
        duration: 4000,
        holdMid: true
      });
    }
  }

  function diffSnapshot(newSnap) {
    if (demoActive) {
      for (const t of newSnap.tasks) {
        previousTaskStates.set(t.id, { state: t.state, retries: t.retries, alert: t.alert });
      }
      return;
    }

    if (!previousTaskStates.size) {
      for (const t of newSnap.tasks) {
        previousTaskStates.set(t.id, { state: t.state, retries: t.retries, alert: t.alert });
      }
      return;
    }

    for (const t of newSnap.tasks) {
      const prev = previousTaskStates.get(t.id);
      const wLabel = ROLE_LABELS[t.worker] || 'Coder';
      if (prev) {
        if ((t.state === 'REVIEWING' || t.state === 'VERIFYING') && (prev.state !== 'REVIEWING' && prev.state !== 'VERIFYING')) {
          queueCutscene({
            type: 'DONE',
            worker: t.worker,
            subtitle: `${wLabel} menyerahkan hasil kerja...`,
            bubbleWorker: 'Setor DONE, Bos!',
            bubbleMandor: 'Sini dicek dulu.',
            duration: 3400
          });
          announce(`${wLabel} menyerahkan hasil tugas ${t.id} ke ruang meeting`);
        } else if (t.state === 'APPROVED' && prev.state !== 'APPROVED') {
          const line = PRAISE_LINES[Math.floor(Math.random() * PRAISE_LINES.length)];
          queueCutscene({
            type: 'APPROVED',
            worker: t.worker,
            subtitle: line,
            bubbleMandor: 'Mantap, rapi!',
            bubbleWorker: 'Siap, makasih Bos!',
            duration: 3500
          });
          announce(`Mandor menyetujui tugas ${t.id} dari ${wLabel}`);
        } else if ((t.state === 'REJECTED' && prev.state !== 'REJECTED') || (t.retries > prev.retries)) {
          const line = ANGRY_LINES[Math.floor(Math.random() * ANGRY_LINES.length)];
          queueCutscene({
            type: 'REJECTED',
            worker: t.worker,
            subtitle: line,
            bubbleMandor: 'Ini apa?! Ulang!',
            bubbleWorker: 'Ampun Bos...',
            duration: 3500
          });
          announce(`Mandor menolak tugas ${t.id} dari ${wLabel}`);
        } else if (String(t.alert).toUpperCase().includes('STALL') && !String(prev.alert).toUpperCase().includes('STALL')) {
          queueCutscene({
            type: 'STALL',
            worker: t.worker,
            subtitle: `Mandor menegur ${wLabel} yang macet...`,
            bubbleMandor: 'Woi, masih idup?',
            duration: 3200
          });
          announce(`Tugas ${t.id} mengalami stall`);
        }
      }
      previousTaskStates.set(t.id, { state: t.state, retries: t.retries, alert: t.alert });
    }
  }

  function snapEntityToNode(ent, nodeName) {
    const pt = B.NODES[nodeName];
    if (!pt) return;
    ent.x = pt.x;
    ent.y = pt.y;
    ent.currentNode = nodeName;
    ent.targetNode = nodeName;
    ent.path = [];
    ent.isMoving = false;
  }

  function syncEntitiesFromSnapshot(snap, nowMs) {
    if (!snap) return;
    if (demoActive) return;
    const roles = ['mandor', 'ui', 'coder', 'sec'];

    for (const role of roles) {
      const ent = entities[role];
      const plan = B.planActivity(role, snap, nowMs, behaviorMemory);
      ent.hidden = Boolean(plan.hidden);
      ent.pose = plan.pose || 'idle';
      ent.bubble = plan.bubble || null;

      if (ent.hidden || !plan.node) {
        ent.path = [];
        ent.isMoving = false;
        continue;
      }

      if (!ent.initialized) {
        snapEntityToNode(ent, plan.node);
        ent.facing = plan.facing || 'down';
        ent.initialized = true;
        continue;
      }

      if (plan.node !== ent.targetNode) {
        ent.targetNode = plan.node;
        const rawPath = B.findPath(ent.currentNode, plan.node);
        ent.path = rawPath.length > 1 ? rawPath.slice(1) : rawPath;
      }

      if (!ent.isMoving && ent.path.length === 0) {
        ent.facing = plan.facing || ent.facing;
      }
    }
  }

  function stepEntities(dtSec) {
    for (const role of ['mandor', 'ui', 'coder', 'sec']) {
      const ent = entities[role];
      const speed = ent.speed || B.WALK_SPEED;
      if (ent.hidden || ent.path.length === 0) {
        ent.isMoving = false;
        continue;
      }

      const nextNodeName = ent.path[0];
      const targetPt = B.NODES[nextNodeName];
      if (!targetPt) {
        ent.path.shift();
        continue;
      }

      const dx = targetPt.x - ent.x;
      const dy = targetPt.y - ent.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= speed * dtSec) {
        ent.x = targetPt.x;
        ent.y = targetPt.y;
        ent.currentNode = nextNodeName;
        ent.path.shift();
        ent.isMoving = ent.path.length > 0;
      } else {
        ent.x += (dx / dist) * speed * dtSec;
        ent.y += (dy / dist) * speed * dtSec;
        ent.facing = B.directionBetween(0, 0, dx, dy);
        ent.isMoving = true;
      }
    }
  }

  function updateHUD(snap) {
    repoNameEl.textContent = snap.repo || 'Squad Office';
    totalTokensEl.textContent = formatTokens(snap.totals.tokens);

    if (snap.totals.cost_usd > 0) {
      costItemEl.style.display = 'flex';
      totalCostEl.textContent = '$' + snap.totals.cost_usd.toFixed(2);
    } else {
      costItemEl.style.display = 'none';
    }

    renderTaskList(snap.tasks);
    renderHudOverlay();
  }

  function renderTaskList(tasks) {
    taskListEl.innerHTML = '';
    if (!tasks || tasks.length === 0) {
      taskListEl.innerHTML = `
        <div class="task-empty">
          <div style="font-size:22px;">☕</div>
          <div>Belum ada tugas aktif</div>
          <div style="font-size:12px; color:#9ba8b8;">Squad sedang santai di pantry</div>
        </div>
      `;
      return;
    }

    const nowMs = Date.now();
    for (const t of tasks) {
      const card = document.createElement('div');
      card.className = 'task-card' + (selectedTaskId === t.id ? ' selected' : '');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Tugas ${t.id}: ${t.objective}`);

      const stateClass = (t.state || 'pending').toLowerCase();
      const idSuffix = t.id.slice(-4);
      const eta = computeEtaInfo(t, nowMs);

      let etaHtml = '';
      if (eta) {
        etaHtml = `
          <div class="task-eta-block">
            <div class="task-eta-row">
              <span class="task-eta-badge ${eta.isLate ? 'late' : ''}">${escapeHTML(eta.label)}</span>
              <span style="font-size:11px; color:#9ba8b8;">target ${eta.hhmm}</span>
            </div>
            <div class="task-eta-progress">
              <div class="task-eta-fill ${eta.isLate ? 'late' : ''}" style="width:${eta.pct}%;"></div>
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="task-card-header">
          <span class="task-id-tag">#${idSuffix} · <span class="task-card-worker ${t.worker}">${t.worker.toUpperCase()}</span></span>
          <span class="state-badge ${stateClass}">${t.state}</span>
        </div>
        <div class="task-obj">${escapeHTML(t.objective)}</div>
        ${etaHtml}
        <div class="task-card-footer">
          <span style="font-size:12px; color:#9ba8b8;">${t.type}</span>
          <span style="font-size:12px; color:#f1c40f; font-weight:700;">🪙 ${formatTokens(t.tokens.tukang + t.tokens.mandor)}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        selectTask(t.id, t.worker);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectTask(t.id, t.worker);
        }
      });

      taskListEl.appendChild(card);
    }
  }

  function escapeHTML(str) {
    return (str || '').replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function selectTask(taskId, workerRole) {
    selectedTaskId = (selectedTaskId === taskId) ? null : taskId;
    selectedWorkerRole = selectedTaskId ? workerRole : null;
    if (currentSnapshot) renderTaskList(currentSnapshot.tasks);
    renderHudOverlay();
  }

  function renderHudOverlay() {
    hudOverlay.innerHTML = '';
    if (!currentSnapshot) return;

    const nowMs = Date.now();
    const bubbleItems = [];

    // 1. Offline desk plates for offline workers
    if (!demoActive && currentSnapshot.workers) {
      for (const w of currentSnapshot.workers) {
        if (w.online === false || w.activity === 'offline') {
          const dCoord = DESK_COORDS[w.role];
          if (dCoord) {
            const vPos = worldToViewport(dCoord.x, dCoord.y);
            const plate = document.createElement('div');
            plate.className = 'offline-plate';
            plate.textContent = `${ROLE_LABELS[w.role]} · Offline`;
            plate.style.left = `${Math.round(vPos.x)}px`;
            plate.style.top = `${Math.round(vPos.y)}px`;
            hudOverlay.appendChild(plate);
          }
        }
      }
    }

    // 2. Name-tag pills above each visible character head
    const order = ['ui', 'coder', 'sec', 'mandor'];
    for (const role of order) {
      const ent = entities[role];
      if (!ent || ent.hidden) continue;

      const headWorldX = ent.x;
      const headWorldY = ent.y - 24;
      const pillPos = worldToViewport(headWorldX, headWorldY);

      const pill = document.createElement('div');
      pill.className = 'name-pill' + (selectedWorkerRole === role ? ' highlighted' : '');
      pill.style.left = `${Math.round(pillPos.x)}px`;
      pill.style.top = `${Math.round(pillPos.y)}px`;

      let extraChipHtml = '';
      if (role !== 'mandor') {
        const w = currentSnapshot.workers.find(x => x.role === role);
        const activeTask = w && w.task_id ? currentSnapshot.tasks.find(t => t.id === w.task_id) : null;
        if (activeTask) {
          const shortId = '#' + activeTask.id.slice(-4);
          const eta = computeEtaInfo(activeTask, nowMs);
          if (eta) {
            extraChipHtml = `
              <span class="pill-task-chip">${shortId}</span>
              <span class="pill-eta-chip ${eta.isLate ? 'late' : ''}">
                <span>${escapeHTML(eta.label)}</span>
                <span class="eta-mini-bar"><span class="eta-mini-fill" style="width:${eta.pct}%;"></span></span>
              </span>
            `;
          } else {
            extraChipHtml = `<span class="pill-task-chip">${shortId}</span>`;
          }
        }
      }

      pill.innerHTML = `
        <span class="name-pill-dot ${role}"></span>
        <span>${ROLE_LABELS[role]}</span>
        ${extraChipHtml}
      `;

      pill.addEventListener('click', () => {
        if (role !== 'mandor') {
          const w = currentSnapshot.workers.find(x => x.role === role);
          if (w && w.task_id) {
            selectTask(w.task_id, role);
            return;
          }
        }
        selectedWorkerRole = (selectedWorkerRole === role) ? null : role;
        renderHudOverlay();
      });

      hudOverlay.appendChild(pill);

      // Determine speech bubble text for this character
      let bubbleText = ent.bubble;
      let moodClass = '';

      if (activeCutscene) {
        if (role === 'mandor' && activeCutscene.bubbleMandor) {
          bubbleText = activeCutscene.bubbleMandor;
          moodClass = activeCutscene.type === 'APPROVED' ? 'happy' : (activeCutscene.type === 'REJECTED' ? 'angry' : 'impatient');
        } else if (role === activeCutscene.worker && activeCutscene.bubbleWorker) {
          bubbleText = activeCutscene.bubbleWorker;
        }
      } else if (role === 'mandor') {
        if (ent.pose === 'impatient') moodClass = 'impatient';
        else if (currentSnapshot.mandor.mood === 'happy') moodClass = 'happy';
        else if (currentSnapshot.mandor.mood === 'angry') moodClass = 'angry';
      }

      if (bubbleText) {
        bubbleItems.push({
          role,
          text: bubbleText,
          moodClass,
          x: Math.round(pillPos.x),
          y: Math.round(pillPos.y - 24)
        });
      }
    }

    // 3. Stack speech bubbles upward if any two overlap horizontally & vertically
    bubbleItems.sort((a, b) => a.y - b.y);
    const placedRects = [];
    const BUBBLE_W = 168;
    const BUBBLE_H = 38;

    const isCinematic = cinematicLayer.classList.contains('active');
    const letterboxTopPx = isCinematic ? Math.round(farmViewport.clientHeight * 0.12) : 0;
    const minTopY = Math.max(36, letterboxTopPx + 16);

    for (const item of bubbleItems) {
      let by = Math.max(minTopY, item.y);
      let bx = Math.max(96, Math.min(farmViewport.clientWidth - 96, item.x));

      let collision = true;
      let guard = 0;
      while (collision && guard < 6) {
        collision = false;
        for (const r of placedRects) {
          if (Math.abs(bx - r.x) < BUBBLE_W && Math.abs(by - r.y) < BUBBLE_H) {
            if (r.y - BUBBLE_H - 4 >= minTopY) {
              by = r.y - BUBBLE_H - 4;
            } else {
              by = r.y + BUBBLE_H + 4;
            }
            collision = true;
          }
        }
        guard++;
      }

      by = Math.max(minTopY, by);
      placedRects.push({ x: bx, y: by });

      const bEl = document.createElement('div');
      bEl.className = 'speech-bubble' + (item.role === 'mandor' ? ` mandor-bubble ${item.moodClass}` : '');
      bEl.textContent = item.text;
      bEl.style.left = `${bx}px`;
      bEl.style.top = `${by}px`;
      hudOverlay.appendChild(bEl);
    }
  }

  // Update cinematic camera & overlay state
  function updateCutsceneAndCamera(dtMs, nowMs) {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!activeCutscene && cutsceneQueue.length > 0) {
      activeCutscene = cutsceneQueue.shift();
      cutsceneElapsed = activeCutscene.holdMid ? 1250 : 0;
      cutsceneSubtitle.textContent = activeCutscene.subtitle || '';
      cinematicLayer.classList.add('active');
      cinematicLayer.classList.toggle('praise', activeCutscene.type === 'APPROVED');
      cinematicLayer.classList.toggle('angry', activeCutscene.type === 'REJECTED');
    }

    if (!activeCutscene) {
      if (demoActive && demoCamera) {
        const lerpFactor = Math.min(1, (dtMs / 1000) * 3.5);
        camera.zoom += (demoCamera.zoom - camera.zoom) * lerpFactor;
        camera.cx += (demoCamera.cx - camera.cx) * lerpFactor;
        camera.cy += (demoCamera.cy - camera.cy) * lerpFactor;

        const halfVisW = (BASE_W / 2) / camera.zoom;
        const halfVisH = (BASE_H / 2) / camera.zoom;
        camera.cx = Math.max(halfVisW, Math.min(BASE_W - halfVisW, camera.cx));
        camera.cy = Math.max(halfVisH, Math.min(BASE_H - halfVisH, camera.cy));
        camera.shakeX = 0;
        camera.shakeY = 0;
        camera.tx = Math.round(BASE_W / 2 - camera.cx * camera.zoom);
        camera.ty = Math.round(BASE_H / 2 - camera.cy * camera.zoom);

        if (demoSubtitle) {
          cinematicLayer.classList.add('active');
          cinematicLayer.classList.remove('praise', 'angry', 'slowmo');
          cutsceneSubtitle.textContent = demoSubtitle;
        } else {
          cinematicLayer.classList.remove('active', 'praise', 'angry', 'slowmo');
          cutsceneSubtitle.textContent = '';
        }
        return 1.0;
      }

      camera.zoom = 1;
      camera.cx = BASE_W / 2;
      camera.cy = BASE_H / 2;
      camera.shakeX = 0;
      camera.shakeY = 0;
      camera.tx = 0;
      camera.ty = 0;
      cinematicLayer.classList.remove('active', 'praise', 'angry', 'slowmo');
      return 1.0; // normal animation speed
    }

    if (!activeCutscene.holdMid) {
      cutsceneElapsed += dtMs;
    }

    const dur = activeCutscene.duration;
    if (cutsceneElapsed >= dur) {
      activeCutscene = null;
      cutsceneElapsed = 0;
      cinematicLayer.classList.remove('active', 'praise', 'angry', 'slowmo');
      return 1.0;
    }

    // Slow-mo window: 300ms around peak reaction (1100..1400ms)
    const inSlowMo = !prefersReduced && cutsceneElapsed >= 1100 && cutsceneElapsed <= 1400;
    cinematicLayer.classList.toggle('slowmo', inSlowMo);
    const speedFactor = inSlowMo ? 0.4 : 1.0;

    if (prefersReduced) {
      camera.zoom = 1;
      camera.cx = BASE_W / 2;
      camera.cy = BASE_H / 2;
      camera.tx = 0;
      camera.ty = 0;
      return 1.0;
    }

    // Determine focus point between Mandor and acting worker
    const wEnt = entities[activeCutscene.worker] || entities.coder;
    const mEnt = entities.mandor;
    let focusX = wEnt && !wEnt.hidden ? (wEnt.x + mEnt.x) / 2 : mEnt.x;
    let focusY = wEnt && !wEnt.hidden ? (wEnt.y + mEnt.y) / 2 - 8 : mEnt.y - 8;

    const targetZoom = 2.65;
    let zoomProgress = 1;
    if (cutsceneElapsed < 600) {
      zoomProgress = cubicEaseInOut(cutsceneElapsed / 600);
    } else if (cutsceneElapsed > dur - 600) {
      zoomProgress = cubicEaseInOut(Math.max(0, (dur - cutsceneElapsed) / 600));
    }

    camera.zoom = 1 + (targetZoom - 1) * zoomProgress;
    camera.cx = (BASE_W / 2) + (focusX - BASE_W / 2) * zoomProgress;
    camera.cy = (BASE_H / 2) + (focusY - BASE_H / 2) * zoomProgress;

    // Clamp camera center so zoomed view never goes outside map bounds
    const halfVisW = (BASE_W / 2) / camera.zoom;
    const halfVisH = (BASE_H / 2) / camera.zoom;
    camera.cx = Math.max(halfVisW, Math.min(BASE_W - halfVisW, camera.cx));
    camera.cy = Math.max(halfVisH, Math.min(BASE_H - halfVisH, camera.cy));

    // Shake inside zoom for REJECTED
    if (activeCutscene.type === 'REJECTED' && zoomProgress > 0.5) {
      camera.shakeX = Math.sin(nowMs * 0.065) * 2.5;
      camera.shakeY = Math.cos(nowMs * 0.085) * 2.0;
    } else {
      camera.shakeX = 0;
      camera.shakeY = 0;
    }

    camera.tx = Math.round(BASE_W / 2 - (camera.cx + camera.shakeX) * camera.zoom);
    camera.ty = Math.round(BASE_H / 2 - (camera.cy + camera.shakeY) * camera.zoom);

    return speedFactor;
  }

  // Main Animation Loop
  let lastTimestamp = performance.now();
  let virtualTime = 0;
  let lastHudSync = 0;

  function gameLoop(timestamp) {
    const rawDtMs = Math.min(100, Math.max(0, timestamp - lastTimestamp));
    lastTimestamp = timestamp;

    if (demoActive) {
      updateDemo(rawDtMs);
    }

    const speedFactor = updateCutsceneAndCamera(rawDtMs, timestamp);
    const effDtMs = rawDtMs * speedFactor;
    virtualTime += effDtMs;

    if (currentSnapshot && !demoActive) {
      syncEntitiesFromSnapshot(currentSnapshot, Date.now());
    }
    stepEntities(effDtMs / 1000);

    renderScene(virtualTime);

    if (timestamp - lastHudSync > 90 || activeCutscene || demoActive) {
      renderHudOverlay();
      lastHudSync = timestamp;
    }

    requestAnimationFrame(gameLoop);
  }

  function renderScene(vTime) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, BASE_W, BASE_H);

    // Apply camera transform with integer pixel snapping
    ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.tx, camera.ty);

    const period = getTimePeriod();
    S.drawOfficeMap(ctx, vTime, period, currentSnapshot);

    // Sort visible characters by Y coordinate for proper 3/4 depth occlusion
    const drawList = ['mandor', 'ui', 'coder', 'sec']
      .map(r => entities[r])
      .filter(e => e && !e.hidden)
      .sort((a, b) => a.y - b.y);

    for (const ent of drawList) {
      let pose = ent.pose;
      if (activeCutscene) {
        if (ent.role === 'mandor') {
          if (activeCutscene.type === 'APPROVED') pose = 'praise';
          else if (activeCutscene.type === 'REJECTED') pose = 'angry';
          else if (activeCutscene.type === 'STALL') pose = 'impatient';
        } else if (ent.role === activeCutscene.worker && activeCutscene.type === 'REJECTED') {
          pose = 'head_down';
        }
      }

      S.drawCharacter(ctx, ent.role, ent.x, ent.y, {
        facing: ent.facing,
        pose,
        isMoving: ent.isMoving,
        time: vTime
      });

      // Cutscene canvas sparkles / effects inside zoom
      if (activeCutscene && activeCutscene.type === 'APPROVED' && (ent.role === 'mandor' || ent.role === activeCutscene.worker)) {
        const frame = Math.floor(vTime / 140) % 4;
        S.drawHeartsStars(ctx, Math.round(ent.x) - 8, Math.round(ent.y) - 22, frame);
      }
    }

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // SSE setup
  function initSSE() {
    const sseUrl = window.location.search.includes('empty=1') ? '/events?empty=1' : '/events';
    const es = new EventSource(sseUrl);

    es.onopen = () => {
      liveDotEl.className = 'live-dot';
      liveTextEl.textContent = 'Live';
    };

    es.onmessage = (e) => {
      try {
        const snap = JSON.parse(e.data);
        diffSnapshot(snap);
        currentSnapshot = snap;
        syncEntitiesFromSnapshot(snap, Date.now());
        checkUrlCutscene(snap);
        updateHUD(snap);
      } catch (err) {
        console.error('SSE parse error', err);
      }
    };

    es.onerror = () => {
      liveDotEl.className = 'live-dot connecting';
      liveTextEl.textContent = 'Menyambung ulang...';
    };
  }

  // Init
  resizeCanvas();
  checkUrlCutscene();
  initSSE();
  requestAnimationFrame(gameLoop);
})();
