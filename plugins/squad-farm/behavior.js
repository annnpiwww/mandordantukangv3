// plugins/squad-farm/behavior.js
// UMD module: waypoint graph, BFS pathfinding, and deterministic character behavior

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SquadBehavior = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Logical map dimensions: 384x216 (24x13.5 tiles of 16px)
  const MAP_W = 384;
  const MAP_H = 216;
  const WALK_SPEED = 32; // px per second

  // Named waypoint nodes in 384x216 pixel coordinates
  const NODES = {
    // Work Area (left room)
    desk_ui: { x: 56, y: 72, room: 'work', type: 'desk' },
    desk_coder: { x: 144, y: 72, room: 'work', type: 'desk' },
    desk_sec: { x: 100, y: 148, room: 'work', type: 'desk' },
    work_aisle_top: { x: 100, y: 88, room: 'work', type: 'aisle' },
    work_aisle_mid: { x: 144, y: 88, room: 'work', type: 'aisle' },
    work_aisle_bot: { x: 100, y: 162, room: 'work', type: 'aisle' },

    // Doors & Central Hallway
    door_work_top: { x: 204, y: 88, room: 'door', type: 'door' },
    door_work_bot: { x: 204, y: 162, room: 'door', type: 'door' },
    hall_mandor: { x: 220, y: 60, room: 'hall', type: 'hall' },
    hall_top: { x: 220, y: 88, room: 'hall', type: 'hall' },
    hall_mid: { x: 220, y: 124, room: 'hall', type: 'hall' },
    hall_bot: { x: 220, y: 162, room: 'hall', type: 'hall' },
    hall_pantry: { x: 220, y: 186, room: 'hall', type: 'hall' },

    // Mandor Office (top-right room)
    door_mandor: { x: 238, y: 60, room: 'door', type: 'door' },
    mandor_desk: { x: 312, y: 60, room: 'mandor', type: 'desk' },

    // Meeting Room (middle-right room)
    door_meeting: { x: 238, y: 124, room: 'door', type: 'door' },
    meeting_1: { x: 274, y: 124, room: 'meeting', type: 'chair' },
    meeting_2: { x: 304, y: 106, room: 'meeting', type: 'chair' },
    meeting_3: { x: 304, y: 142, room: 'meeting', type: 'chair' },
    meeting_4: { x: 334, y: 124, room: 'meeting', type: 'stand' },

    // Pantry / Lounge (bottom-right room)
    door_pantry: { x: 238, y: 186, room: 'door', type: 'door' },
    coffee: { x: 256, y: 182, room: 'pantry', type: 'appliance' },
    cooler: { x: 286, y: 182, room: 'pantry', type: 'appliance' },
    vending: { x: 316, y: 182, room: 'pantry', type: 'appliance' },
    sofa_1: { x: 344, y: 192, room: 'pantry', type: 'sofa' },
    sofa_2: { x: 362, y: 192, room: 'pantry', type: 'sofa' }
  };

  // Undirected adjacency list (all segments avoid walls)
  const EDGES = {
    desk_ui: ['work_aisle_top'],
    desk_coder: ['work_aisle_mid'],
    desk_sec: ['work_aisle_bot'],
    work_aisle_top: ['desk_ui', 'work_aisle_mid', 'work_aisle_bot'],
    work_aisle_mid: ['desk_coder', 'work_aisle_top', 'door_work_top'],
    work_aisle_bot: ['desk_sec', 'work_aisle_top', 'door_work_bot'],

    door_work_top: ['work_aisle_mid', 'hall_top'],
    door_work_bot: ['work_aisle_bot', 'hall_bot'],

    hall_mandor: ['hall_top', 'door_mandor'],
    hall_top: ['hall_mandor', 'door_work_top', 'hall_mid'],
    hall_mid: ['hall_top', 'hall_bot', 'door_meeting'],
    hall_bot: ['hall_mid', 'door_work_bot', 'hall_pantry'],
    hall_pantry: ['hall_bot', 'door_pantry'],

    door_mandor: ['hall_mandor', 'mandor_desk'],
    mandor_desk: ['door_mandor'],

    door_meeting: ['hall_mid', 'meeting_1'],
    meeting_1: ['door_meeting', 'meeting_2', 'meeting_3'],
    meeting_2: ['meeting_1', 'meeting_4'],
    meeting_3: ['meeting_1', 'meeting_4'],
    meeting_4: ['meeting_2', 'meeting_3'],

    door_pantry: ['hall_pantry', 'coffee'],
    coffee: ['door_pantry', 'cooler'],
    cooler: ['coffee', 'vending'],
    vending: ['cooler', 'sofa_1'],
    sofa_1: ['vending', 'sofa_2'],
    sofa_2: ['sofa_1']
  };

  function findPath(startNode, endNode) {
    if (!startNode || !endNode) return [];
    if (!NODES[startNode] || !NODES[endNode]) return [];
    if (startNode === endNode) return [startNode];

    const queue = [[startNode]];
    const visited = new Set([startNode]);

    while (queue.length > 0) {
      const path = queue.shift();
      const curr = path[path.length - 1];
      const neighbors = EDGES[curr] || [];

      for (const next of neighbors) {
        if (visited.has(next)) continue;
        const nextNode = NODES[next];
        if (!nextNode || nextNode.type === 'wall') continue;

        const nextPath = path.concat(next);
        if (next === endNode) return nextPath;
        visited.add(next);
        queue.push(nextPath);
      }
    }
    return [startNode];
  }

  function seededHash(str, bucket) {
    const input = `${str}:${bucket}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function getWorkerReviewingTask(role, snapshot) {
    const tasks = snapshot?.tasks || [];
    for (const t of tasks) {
      if (t.worker === role && (t.state === 'VERIFYING' || t.state === 'REVIEWING')) {
        return t;
      }
    }
    const w = (snapshot?.workers || []).find(x => x.role === role);
    if (w && w.task_id) {
      const active = tasks.find(t => t.id === w.task_id);
      if (active && (active.state === 'VERIFYING' || active.state === 'REVIEWING')) {
        return active;
      }
    }
    return null;
  }

  function getCharMem(role, memory) {
    if (!memory || typeof memory !== 'object') return {};
    if (typeof memory.idleSince === 'number' && !memory[role]) {
      return memory;
    }
    if (!memory[role] || typeof memory[role] !== 'object') {
      memory[role] = {};
    }
    if (typeof memory.idleSince === 'number' && memory[role].idleSince === undefined) {
      memory[role].idleSince = memory.idleSince;
    }
    return memory[role];
  }

  function planActivity(role, snapshot, nowMs = Date.now(), memory = {}) {
    const mem = getCharMem(role, memory);
    const tasks = snapshot?.tasks || [];

    if (role === 'mandor') {
      const reviewingTask = tasks.find(t => t.state === 'VERIFYING' || t.state === 'REVIEWING');
      if (reviewingTask) {
        return {
          node: 'meeting_4',
          hidden: false,
          pose: 'review',
          facing: 'left',
          bubble: 'Cek hasil kerja...'
        };
      }
      const stalledTask = tasks.find(t =>
        ['ASSIGNED', 'EXECUTING', 'VERIFYING', 'REVIEWING'].includes(t.state) &&
        String(t.alert || '').toUpperCase().includes('STALL')
      );
      if (stalledTask) {
        const targetDesk = NODES['desk_' + stalledTask.worker] ? ('desk_' + stalledTask.worker) : 'desk_coder';
        return {
          node: targetDesk,
          hidden: false,
          pose: 'impatient',
          facing: 'down',
          bubble: 'Woi, masih idup?'
        };
      }
      const lateTask = tasks.find(t =>
        ['ASSIGNED', 'EXECUTING', 'VERIFYING', 'REVIEWING'].includes(t.state) &&
        typeof t.eta_at === 'number' &&
        nowMs > t.eta_at
      );
      if (lateTask) {
        const targetDesk = NODES['desk_' + lateTask.worker] ? ('desk_' + lateTask.worker) : 'desk_coder';
        const d = new Date(lateTask.eta_at);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return {
          node: targetDesk,
          hidden: false,
          pose: 'impatient',
          facing: 'down',
          bubble: `Katanya jam ${hh}:${mm}?`
        };
      }
      return {
        node: 'mandor_desk',
        hidden: false,
        pose: 'reading',
        facing: 'down',
        bubble: null
      };
    }

    const w = (snapshot?.workers || []).find(x => x.role === role);
    if (!w || w.online === false || w.activity === 'offline') {
      mem.idleSince = null;
      return {
        node: null,
        hidden: true,
        pose: 'offline',
        facing: 'down',
        bubble: null
      };
    }

    const revTask = getWorkerReviewingTask(role, snapshot);
    if (revTask) {
      mem.idleSince = null;
      const chairMap = { ui: 'meeting_1', coder: 'meeting_2', sec: 'meeting_3' };
      return {
        node: chairMap[role] || 'meeting_1',
        hidden: false,
        pose: 'sit_wait',
        facing: 'right',
        bubble: 'Nunggu review...'
      };
    }

    if (w.activity === 'working') {
      mem.idleSince = null;
      const deskNode = NODES['desk_' + role] ? ('desk_' + role) : 'desk_coder';
      return {
        node: deskNode,
        hidden: false,
        pose: 'typing',
        facing: 'up',
        bubble: w.doing || 'Working...'
      };
    }

    // Idle behavior
    if (mem.idleSince === null || mem.idleSince === undefined) {
      mem.idleSince = nowMs;
      if (memory && typeof memory === 'object' && memory.idleSince === undefined) {
        memory.idleSince = nowMs;
      }
    }

    const idleElapsed = nowMs - mem.idleSince;
    if (idleElapsed >= 5 * 60 * 1000) {
      const sofaNode = role === 'coder' ? 'sofa_2' : 'sofa_1';
      return {
        node: sofaNode,
        hidden: false,
        pose: 'sleep',
        facing: 'down',
        bubble: 'Zzz...'
      };
    }

    const bucket = Math.floor(nowMs / 30000);

    // Check if 2+ workers are idle simultaneously -> 30% chance to chat at water cooler
    const idleWorkers = (snapshot?.workers || []).filter(x =>
      x.online !== false &&
      x.activity !== 'offline' &&
      x.activity !== 'working' &&
      !getWorkerReviewingTask(x.role, snapshot)
    );
    if (idleWorkers.length >= 2) {
      const chatRoll = seededHash('cooler_chat', bucket) % 100;
      if (chatRoll < 30) {
        return {
          node: 'cooler',
          hidden: false,
          pose: 'chat',
          facing: 'down',
          bubble: '...'
        };
      }
    }

    const spots = [
      { node: 'coffee', pose: 'sip', facing: 'up', bubble: 'Ngopi dulu...' },
      { node: 'cooler', pose: 'drink', facing: 'up', bubble: 'Minum air...' },
      { node: 'vending', pose: 'snack', facing: 'up', bubble: 'Ambil cemilan...' },
      { node: role === 'coder' ? 'sofa_2' : 'sofa_1', pose: 'sit', facing: 'down', bubble: 'Rehat bentar' }
    ];

    const pickIdx = seededHash(role, bucket) % spots.length;
    const chosen = spots[pickIdx];
    return {
      node: chosen.node,
      hidden: false,
      pose: chosen.pose,
      facing: chosen.facing,
      bubble: chosen.bubble
    };
  }

  function directionBetween(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'down' : 'up';
  }

  return {
    MAP_W,
    MAP_H,
    WALK_SPEED,
    NODES,
    EDGES,
    findPath,
    seededHash,
    planActivity,
    directionBetween
  };
});
