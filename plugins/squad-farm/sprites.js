// plugins/squad-farm/sprites.js
// Procedural top-down 3/4 pixel-art office renderer (384x216 base, 16px tiles)

const PALETTE = {
  trans: null,
  white: '#ffffff',
  black: '#181818',
  outline: '#1c1e24',

  // Sky / Window tints
  skyDay: '#7ec0ee',
  skySunset: '#e8845c',
  skyNight: '#16192b',
  sun: '#f9d342',
  moon: '#f4f4f4',

  // Floors & Walls
  wallTop: '#2c323d',
  wallPlaster: '#dfd5c6',
  wallWainscot: '#8c6239',
  wallTrim: '#4a3520',
  glassFrame: '#3a4654',
  glassPane: '#8cd2e6',

  woodFloor1: '#c69363',
  woodFloor2: '#b88454',
  woodFloor3: '#d19f6f',
  woodSeam: '#9c6b3f',

  hallTile1: '#7a8490',
  hallTile2: '#6b7580',
  hallSeam: '#545d66',

  mandorCarpet1: '#6e2c35',
  mandorCarpet2: '#5c222a',
  mandorTrim: '#d4ac0d',

  meetCarpet1: '#35495e',
  meetCarpet2: '#2c3e50',

  pantryTile1: '#e8dac8',
  pantryTile2: '#cfa57e',

  rugBase: '#225560',
  rugInner: '#2c6b78',
  rugTrim: '#e6c670',

  // Furniture
  deskTop: '#a66f43',
  deskFront: '#784c29',
  deskDark: '#4d2e16',
  execDeskTop: '#6e3524',
  execDeskFront: '#4a2014',
  chairBack: '#363f4a',
  chairSeat: '#262d36',
  sofaBase: '#b04632',
  sofaLight: '#cc5842',
  sofaDark: '#7a2b1d',
  plantLeaf1: '#2ecc71',
  plantLeaf2: '#229954',
  plantLeaf3: '#196f3d',
  plantPot: '#b85d3b',

  // Characters
  skinLight: '#ffe0bd',
  skinBase: '#e8b88a',
  skinRed: '#ff7675',
  strawHat: '#e6c575',
  hatBand: '#b03a2e',
  overalls: '#2980b9',
  shirtRed: '#c0392b',
  mustache: '#4a2c11',
  uiBeret: '#16a085',
  uiSmock: '#8e44ad',
  coderBand: '#27ae60',
  coderTunic: '#2c3e50',
  secHelmet: '#f39c12',
  secArmor: '#7f8c8d',

  coinGold: '#f1c40f',
  coinDark: '#d4ac0d',
  sweat: '#3498db',
  steam: '#ecf0f1',
  heart: '#e74c3c',
  star: '#f39c12'
};

const CHAR_MAP = {
  '0': PALETTE.black,
  '1': PALETTE.white,
  's': PALETTE.skinLight,
  'S': PALETTE.skinBase,
  'R': PALETTE.skinRed,
  'h': PALETTE.strawHat,
  'b': PALETTE.hatBand,
  'o': PALETTE.overalls,
  'r': PALETTE.shirtRed,
  'm': PALETTE.mustache,
  'u': PALETTE.uiBeret,
  'p': PALETTE.uiSmock,
  'c': PALETTE.coderBand,
  't': PALETTE.coderTunic,
  'H': PALETTE.secHelmet,
  'a': PALETTE.secArmor,
  'z': PALETTE.sweat,
  'g': PALETTE.coinGold,
  'w': PALETTE.deskTop,
  'W': PALETTE.deskFront
};

function renderMatrix(ctx, matrix, x, y, pixelSize = 1, colorMap = CHAR_MAP) {
  if (!matrix) return;
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    for (let c = 0; c < row.length; c++) {
      const char = row[c];
      if (char === '.' || char === ' ') continue;
      const color = colorMap[char] || PALETTE[char];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(x + c * pixelSize), Math.floor(y + r * pixelSize), pixelSize, pixelSize);
      }
    }
  }
}

// Legacy compatibility arrays exported for any external checks
const MANDOR_IDLE = [
  ".....0hhhh0.....",
  "....0hhhhhh0....",
  "...00bbbbbb00...",
  "...0hhhhhhhh0...",
  "....0ssssss0....",
  "....0s0ss0s0....",
  "....0ssmmms0....",
  "....00rrrr00....",
  "...0rw0oo0wr0...",
  "...0wW0oo0Ww0...",
  "....00oooo00....",
  "....0oo00oo0....",
  "....000..000...."
];
const MANDOR_IMPATIENT = MANDOR_IDLE;
const MANDOR_HAPPY = MANDOR_IDLE;
const UI_IDLE = MANDOR_IDLE;
const UI_WORKING_1 = MANDOR_IDLE;
const UI_WORKING_2 = MANDOR_IDLE;
const CODER_IDLE = MANDOR_IDLE;
const CODER_WORKING_1 = MANDOR_IDLE;
const CODER_WORKING_2 = MANDOR_IDLE;
const SEC_IDLE = MANDOR_IDLE;
const SEC_WORKING_1 = MANDOR_IDLE;
const SEC_WORKING_2 = MANDOR_IDLE;
const CARRY_CRATE = MANDOR_IDLE;

function drawShadowEllipse(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(Math.floor(cx - rx), Math.floor(cy - ry + 1), rx * 2, ry * 2 - 2);
  ctx.fillRect(Math.floor(cx - rx + 2), Math.floor(cy - ry), rx * 2 - 4, ry * 2);
}

function drawOutlinedBox(ctx, x, y, w, h, topH, topColor, frontColor, outlineColor = PALETTE.outline) {
  ctx.fillStyle = outlineColor;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = topColor;
  ctx.fillRect(x + 1, y + 1, w - 2, topH - 1);
  ctx.fillStyle = frontColor;
  ctx.fillRect(x + 1, y + topH, w - 2, h - topH - 1);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 1, y + topH, w - 2, 1);
}

function drawOfficeMap(ctx, time, period, snapshot) {
  const W = 384;
  const H = 216;

  // Outer perimeter background
  ctx.fillStyle = '#141820';
  ctx.fillRect(0, 0, W, H);

  // --- ROOM A: WORK AREA FLOOR (x: 8..202, y: 24..208) ---
  for (let y = 24; y < 208; y += 8) {
    for (let x = 8; x < 202; x += 16) {
      const hash = ((x * 13 + y * 7) % 5);
      ctx.fillStyle = hash === 0 ? PALETTE.woodFloor2 : (hash === 1 ? PALETTE.woodFloor3 : PALETTE.woodFloor1);
      ctx.fillRect(x, y, 16, 8);
      ctx.fillStyle = PALETTE.woodSeam;
      ctx.fillRect(x, y + 7, 16, 1);
      const jointX = x + ((y % 16 === 0) ? 0 : 8);
      if (jointX < 202) ctx.fillRect(jointX, y, 1, 7);
    }
  }

  // Work Area Center Rug (x: 64, y: 96, w: 72, h: 28)
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(63, 95, 74, 30);
  ctx.fillStyle = PALETTE.rugTrim;
  ctx.fillRect(64, 96, 72, 28);
  ctx.fillStyle = PALETTE.rugBase;
  ctx.fillRect(66, 98, 68, 24);
  ctx.fillStyle = PALETTE.rugInner;
  ctx.fillRect(72, 102, 56, 16);

  // --- CENTRAL HALLWAY FLOOR (x: 202..238, y: 24..208) ---
  for (let y = 24; y < 208; y += 12) {
    for (let x = 202; x < 238; x += 12) {
      const even = ((Math.floor(x / 12) + Math.floor(y / 12)) % 2 === 0);
      ctx.fillStyle = even ? PALETTE.hallTile1 : PALETTE.hallTile2;
      ctx.fillRect(x, y, 12, 12);
      ctx.fillStyle = PALETTE.hallSeam;
      ctx.fillRect(x, y + 11, 12, 1);
    }
  }

  // --- ROOM B: MANDOR OFFICE FLOOR (x: 238..376, y: 24..88) ---
  ctx.fillStyle = PALETTE.mandorCarpet2;
  ctx.fillRect(238, 24, 138, 64);
  ctx.fillStyle = PALETTE.mandorTrim;
  ctx.fillRect(242, 28, 130, 56);
  ctx.fillStyle = PALETTE.mandorCarpet1;
  ctx.fillRect(244, 30, 126, 52);

  // --- ROOM C: MEETING ROOM FLOOR (x: 238..376, y: 92..154) ---
  ctx.fillStyle = PALETTE.meetCarpet2;
  ctx.fillRect(238, 92, 138, 62);
  ctx.fillStyle = PALETTE.meetCarpet1;
  ctx.fillRect(244, 96, 126, 54);

  // --- ROOM D: PANTRY / LOUNGE FLOOR (x: 238..376, y: 158..208) ---
  for (let y = 158; y < 208; y += 8) {
    for (let x = 238; x < 376; x += 8) {
      const even = (((x >> 3) + (y >> 3)) % 2 === 0);
      ctx.fillStyle = even ? PALETTE.pantryTile1 : PALETTE.pantryTile2;
      ctx.fillRect(x, y, 8, 8);
    }
  }

  // --- TOP WALL STRIP (y: 0..24) ---
  ctx.fillStyle = PALETTE.wallTop;
  ctx.fillRect(6, 0, 372, 4);
  ctx.fillStyle = PALETTE.wallPlaster;
  ctx.fillRect(8, 4, 368, 14);
  ctx.fillStyle = PALETTE.wallWainscot;
  ctx.fillRect(8, 18, 368, 5);
  ctx.fillStyle = PALETTE.wallTrim;
  ctx.fillRect(8, 17, 368, 1);
  ctx.fillRect(8, 23, 368, 1);

  // Top Wall Props (Work Area side)
  drawBookshelf(ctx, 18, 3, 34, 20);
  drawWindow(ctx, 64, 4, 58, 15, period);
  drawWallClock(ctx, 134, 5, time);
  drawWhiteboard(ctx, 156, 4, 40, 14, false);

  // Top Wall Props (Mandor Office side)
  drawBookshelf(ctx, 246, 3, 28, 20);
  // Gold framed certificate
  ctx.fillStyle = PALETTE.mandorTrim;
  ctx.fillRect(282, 6, 14, 10);
  ctx.fillStyle = '#fef9e7';
  ctx.fillRect(284, 8, 10, 6);
  // Mandor Master Task Board
  drawWhiteboard(ctx, 304, 4, 52, 14, true);

  // --- INTERIOR WALLS & GLASS PARTITIONS ---
  // Left wall between Work Area and Hallway (x: 200..204) with doors at y: 76..98 and y: 150..172
  drawWallSegment(ctx, 200, 24, 4, 52);
  drawWallSegment(ctx, 200, 98, 4, 52);
  drawWallSegment(ctx, 200, 172, 4, 36);

  // Right wall between Hallway and Right Rooms (x: 234..238)
  // Mandor office wall (y: 24..48, door 48..70, wall 70..88)
  drawWallSegment(ctx, 234, 24, 4, 24);
  drawWallSegment(ctx, 234, 70, 4, 18);
  // Horizontal wall between Mandor Office and Meeting Room (y: 88..92)
  drawGlassWallH(ctx, 234, 88, 142);
  // Meeting room glass left wall (y: 92..114, door 114..134, glass 134..154)
  drawGlassWallV(ctx, 234, 92, 22);
  drawGlassWallV(ctx, 234, 134, 20);
  // Horizontal glass wall between Meeting Room and Pantry (y: 154..158)
  drawGlassWallH(ctx, 234, 154, 142);
  // Pantry left wall (y: 158..174, door 174..196, wall 196..208)
  drawWallSegment(ctx, 234, 158, 4, 16);
  drawWallSegment(ctx, 234, 196, 4, 12);

  // Outer side & bottom walls
  ctx.fillStyle = PALETTE.wallTop;
  ctx.fillRect(4, 0, 4, 212);
  ctx.fillRect(376, 0, 4, 212);
  ctx.fillRect(4, 208, 376, 4);

  // Window light beam on Work Area floor
  if (period === 'day') {
    ctx.fillStyle = 'rgba(255, 250, 200, 0.10)';
    ctx.fillRect(66, 24, 54, 18);
  } else if (period === 'sunset') {
    ctx.fillStyle = 'rgba(255, 140, 80, 0.14)';
    ctx.fillRect(66, 24, 54, 20);
  }

  // --- FURNITURE & PROPS ---
  // Work Area props
  drawPlant(ctx, 12, 26);
  drawPlant(ctx, 184, 26);
  drawPrinter(ctx, 12, 110);
  drawTrashBin(ctx, 14, 138);
  drawPlant(ctx, 12, 186);

  // Mandor Office furniture
  drawPlant(ctx, 358, 26);
  drawMandorDesk(ctx, 290, 40, period);

  // Meeting Room furniture
  drawPlant(ctx, 358, 96);
  drawMeetingTableAndChairs(ctx, 304, 124);

  // Pantry / Lounge furniture
  drawCoffeeStation(ctx, 246, 158, time);
  drawWaterCooler(ctx, 280, 158, time);
  drawVendingMachine(ctx, 308, 156);
  drawLoungeSofa(ctx, 336, 180);

  // Worker Desks (UI, Coder, Security)
  const workers = snapshot?.workers || [];
  const wUi = workers.find(w => w.role === 'ui');
  const wCoder = workers.find(w => w.role === 'coder');
  const wSec = workers.find(w => w.role === 'sec');

  drawWorkerDesk(ctx, 38, 48, 'UI', '#16a085', wUi, time, period);
  drawWorkerDesk(ctx, 126, 48, 'CODER', '#2ecc71', wCoder, time, period);
  drawWorkerDesk(ctx, 82, 124, 'SEC', '#f39c12', wSec, time, period);
}

function drawWallSegment(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE.wallTop;
  ctx.fillRect(x + 1, y, w - 2, h);
}

function drawGlassWallH(ctx, x, y, w) {
  ctx.fillStyle = PALETTE.glassFrame;
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = PALETTE.glassPane;
  for (let gx = x + 4; gx < x + w - 4; gx += 14) {
    ctx.fillRect(gx, y + 1, 10, 2);
  }
}

function drawGlassWallV(ctx, x, y, h) {
  ctx.fillStyle = PALETTE.glassFrame;
  ctx.fillRect(x, y, 4, h);
  ctx.fillStyle = PALETTE.glassPane;
  for (let gy = y + 3; gy < y + h - 3; gy += 8) {
    ctx.fillRect(x + 1, gy, 2, 5);
  }
}

function drawBookshelf(ctx, x, y, w, h) {
  drawOutlinedBox(ctx, x, y, w, h, 4, PALETTE.deskTop, PALETTE.deskDark);
  const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22'];
  for (let row = 0; row < 2; row++) {
    const sy = y + 5 + row * 7;
    ctx.fillStyle = PALETTE.deskFront;
    ctx.fillRect(x + 2, sy + 5, w - 4, 2);
    for (let bx = x + 3; bx < x + w - 5; bx += 4) {
      ctx.fillStyle = colors[(bx + row * 3) % colors.length];
      ctx.fillRect(bx, sy, 3, 5);
    }
  }
}

function drawWindow(ctx, x, y, w, h, period) {
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = period === 'day' ? PALETTE.skyDay : (period === 'sunset' ? PALETTE.skySunset : PALETTE.skyNight);
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

  if (period === 'night') {
    ctx.fillStyle = PALETTE.moon;
    ctx.fillRect(x + w - 14, y + 4, 5, 5);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(x + 10, y + 5, 1, 1);
    ctx.fillRect(x + 26, y + 8, 1, 1);
  } else {
    ctx.fillStyle = PALETTE.sun;
    ctx.fillRect(x + w - 16, y + 4, 6, 6);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(x + 8, y + 5, 12, 3);
  }

  // Window mullions
  ctx.fillStyle = PALETTE.wallTrim;
  ctx.fillRect(x + Math.floor(w / 3), y + 1, 2, h - 2);
  ctx.fillRect(x + Math.floor((w * 2) / 3), y + 1, 2, h - 2);
}

function drawWallClock(ctx, x, y, time) {
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x, y, 11, 11);
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(x + 1, y + 1, 9, 9);
  const now = new Date();
  const cx = x + 5;
  const cy = y + 5;
  ctx.fillStyle = PALETTE.black;
  ctx.fillRect(cx, cy, 1, 1);
  // Hour hand
  const hr = now.getHours() % 12;
  const hx = Math.round(Math.sin((hr / 12) * Math.PI * 2) * 2);
  const hy = -Math.round(Math.cos((hr / 12) * Math.PI * 2) * 2);
  ctx.fillRect(cx + hx, cy + hy, 1, 1);
  // Minute hand
  const min = now.getMinutes();
  const mx = Math.round(Math.sin((min / 60) * Math.PI * 2) * 3);
  const my = -Math.round(Math.cos((min / 60) * Math.PI * 2) * 3);
  ctx.fillStyle = PALETTE.shirtRed;
  ctx.fillRect(cx + mx, cy + my, 1, 1);
}

function drawWhiteboard(ctx, x, y, w, h, isTaskBoard) {
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = isTaskBoard ? '#6e4726' : '#f5f7fa';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (isTaskBoard) {
    const cards = ['#2ecc71', '#f1c40f', '#3498db', '#e74c3c', '#9b59b6'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = cards[i];
      ctx.fillRect(x + 4 + i * 9, y + 3 + (i % 2) * 4, 7, 5);
    }
  } else {
    ctx.fillStyle = '#3498db';
    ctx.fillRect(x + 4, y + 4, 12, 2);
    ctx.fillRect(x + 4, y + 8, 18, 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x + 26, y + 4, 8, 6);
  }
}

function drawPlant(ctx, x, y) {
  drawShadowEllipse(ctx, x + 6, y + 13, 5, 2);
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x + 3, y + 8, 6, 6);
  ctx.fillStyle = PALETTE.plantPot;
  ctx.fillRect(x + 4, y + 9, 4, 4);

  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x + 1, y + 1, 10, 8);
  ctx.fillStyle = PALETTE.plantLeaf2;
  ctx.fillRect(x + 2, y + 2, 8, 6);
  ctx.fillStyle = PALETTE.plantLeaf1;
  ctx.fillRect(x + 2, y + 2, 3, 3);
  ctx.fillRect(x + 6, y + 3, 3, 3);
}

function drawPrinter(ctx, x, y) {
  drawShadowEllipse(ctx, x + 9, y + 19, 9, 3);
  drawOutlinedBox(ctx, x, y, 18, 18, 8, '#d0d7de', '#8c959f');
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(x + 4, y - 2, 10, 4);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(x + 13, y + 5, 2, 2);
}

function drawTrashBin(ctx, x, y) {
  drawOutlinedBox(ctx, x, y, 10, 11, 3, '#57606a', '#424a53');
}

function drawWorkerDesk(ctx, x, y, label, accentColor, worker, time, period) {
  // Desk shadow
  drawShadowEllipse(ctx, x + 18, y + 20, 19, 4);
  // Desk 3/4 box (36x20: top 12px, front 8px)
  drawOutlinedBox(ctx, x, y, 36, 20, 12, PALETTE.deskTop, PALETTE.deskFront);

  // Role accent stripe on front of desk
  ctx.fillStyle = accentColor;
  ctx.fillRect(x + 10, y + 14, 16, 3);

  // Monitor on desk (facing down toward chair)
  const isOffline = !worker || worker.online === false || worker.activity === 'offline';
  const isWorking = worker && worker.activity === 'working';

  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x + 10, y - 4, 16, 10);
  if (isOffline) {
    ctx.fillStyle = '#1f242d';
    ctx.fillRect(x + 11, y - 3, 14, 8);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x + 15, y, 6, 2);
  } else if (isWorking) {
    ctx.fillStyle = '#162436';
    ctx.fillRect(x + 11, y - 3, 14, 8);
    const flicker = Math.floor(time / 180) % 3;
    ctx.fillStyle = accentColor;
    ctx.fillRect(x + 12, y - 2, 6 + flicker * 2, 2);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(x + 12, y + 1, 9 - flicker, 2);
  } else {
    ctx.fillStyle = '#22303c';
    ctx.fillRect(x + 11, y - 3, 14, 8);
    ctx.fillStyle = '#5c7080';
    ctx.fillRect(x + 13, y, 8, 2);
  }
  // Monitor stand
  ctx.fillStyle = '#57606a';
  ctx.fillRect(x + 16, y + 6, 4, 2);

  // Keyboard
  ctx.fillStyle = '#363f4a';
  ctx.fillRect(x + 12, y + 8, 12, 3);

  // Desk lamp on left corner
  ctx.fillStyle = PALETTE.coinGold;
  ctx.fillRect(x + 3, y - 1, 4, 4);
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x + 4, y + 3, 2, 4);
  if (period !== 'day') {
    ctx.fillStyle = 'rgba(241, 196, 15, 0.22)';
    ctx.fillRect(x - 1, y - 3, 12, 12);
  }

  // Mug on right corner
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(x + 30, y + 5, 3, 4);

  // Desk chair at (x + 12, y + 20)
  drawShadowEllipse(ctx, x + 18, y + 28, 7, 3);
  drawOutlinedBox(ctx, x + 12, y + 19, 12, 9, 5, PALETTE.chairBack, PALETTE.chairSeat);
}

function drawMandorDesk(ctx, x, y, period) {
  drawShadowEllipse(ctx, x + 22, y + 21, 23, 5);
  drawOutlinedBox(ctx, x, y, 44, 21, 12, PALETTE.execDeskTop, PALETTE.execDeskFront);
  // Gold trim on Mandor desk
  ctx.fillStyle = PALETTE.mandorTrim;
  ctx.fillRect(x + 14, y + 15, 16, 3);
  // Laptop & clipboard on desk
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(x + 16, y + 2, 12, 7);
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(x + 6, y + 4, 6, 7);
  // Lamp
  ctx.fillStyle = PALETTE.mandorTrim;
  ctx.fillRect(x + 35, y + 1, 5, 5);
  if (period !== 'day') {
    ctx.fillStyle = 'rgba(241, 196, 15, 0.25)';
    ctx.fillRect(x + 30, y - 2, 14, 14);
  }
}

function drawMeetingTableAndChairs(ctx, cx, cy) {
  // Chairs around table
  // Left chair (meeting_1)
  drawOutlinedBox(ctx, cx - 34, cy - 4, 10, 10, 5, PALETTE.chairBack, PALETTE.chairSeat);
  // Right chair (meeting_4)
  drawOutlinedBox(ctx, cx + 24, cy - 4, 10, 10, 5, PALETTE.chairBack, PALETTE.chairSeat);
  // Top chair (meeting_2)
  drawOutlinedBox(ctx, cx - 5, cy - 20, 10, 9, 5, PALETTE.chairBack, PALETTE.chairSeat);
  // Bottom chair (meeting_3)
  drawOutlinedBox(ctx, cx - 5, cy + 12, 10, 9, 5, PALETTE.chairBack, PALETTE.chairSeat);

  // Table shadow
  drawShadowEllipse(ctx, cx, cy + 6, 20, 8);
  // Table 3/4 oval-ish box
  drawOutlinedBox(ctx, cx - 20, cy - 10, 40, 20, 13, PALETTE.deskTop, PALETTE.deskFront);
  // Blueprint/spec sheet on meeting table
  ctx.fillStyle = '#ebf5fb';
  ctx.fillRect(cx - 8, cy - 6, 16, 7);
  ctx.fillStyle = '#2980b9';
  ctx.fillRect(cx - 6, cy - 4, 12, 3);
}

function drawCoffeeStation(ctx, x, y, time) {
  // Counter + Espresso machine
  drawOutlinedBox(ctx, x, y, 26, 18, 9, '#d0d7de', '#6e4726');
  // Coffee maker
  drawOutlinedBox(ctx, x + 4, y - 6, 12, 11, 5, '#2c3e50', '#1a252f');
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(x + 6, y - 4, 2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 18, y - 1, 4, 4);
  // Rising steam particles
  const p = Math.floor(time / 250) % 4;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillRect(x + 9, y - 8 - p, 2, 2);
  ctx.fillRect(x + 11, y - 10 - ((p + 2) % 4), 2, 2);
}

function drawWaterCooler(ctx, x, y, time) {
  drawShadowEllipse(ctx, x + 6, y + 17, 6, 2);
  // Blue jug on top
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x + 2, y - 6, 8, 8);
  ctx.fillStyle = '#5dade2';
  ctx.fillRect(x + 3, y - 5, 6, 6);
  // Bubble inside jug
  const b = Math.floor(time / 400) % 3;
  ctx.fillStyle = '#ebf5fb';
  ctx.fillRect(x + 5, y - 2 - b, 2, 1);
  // White cooler body
  drawOutlinedBox(ctx, x + 1, y + 2, 10, 15, 8, '#f8f9f9', '#d0d3d4');
  ctx.fillStyle = '#3498db';
  ctx.fillRect(x + 4, y + 6, 2, 2);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(x + 7, y + 6, 2, 2);
}

function drawVendingMachine(ctx, x, y) {
  drawShadowEllipse(ctx, x + 10, y + 22, 10, 3);
  drawOutlinedBox(ctx, x, y - 4, 20, 25, 16, '#2c3e50', '#1a252f');
  // Lit display window
  ctx.fillStyle = '#fef9e7';
  ctx.fillRect(x + 3, y - 1, 10, 12);
  // Snack rows
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(x + 4, y, 8, 2);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(x + 4, y + 4, 8, 2);
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(x + 4, y + 8, 8, 2);
  // Coin slot
  ctx.fillStyle = PALETTE.coinGold;
  ctx.fillRect(x + 15, y + 3, 2, 3);
}

function drawLoungeSofa(ctx, x, y) {
  drawShadowEllipse(ctx, x + 18, y + 18, 18, 4);
  drawOutlinedBox(ctx, x, y, 36, 17, 9, PALETTE.sofaLight, PALETTE.sofaBase);
  // Armrests
  ctx.fillStyle = PALETTE.sofaDark;
  ctx.fillRect(x + 1, y + 3, 4, 12);
  ctx.fillRect(x + 31, y + 3, 4, 12);
  // Cushion divider
  ctx.fillRect(x + 18, y + 2, 1, 13);
}

// Procedural 16x24 Top-Down 3/4 Character Renderer
const ROLE_STYLES = {
  mandor: {
    hat: PALETTE.strawHat,
    band: PALETTE.hatBand,
    top: PALETTE.shirtRed,
    bottom: PALETTE.overalls,
    hasMustache: true,
    hasClipboard: true
  },
  ui: {
    hat: PALETTE.uiBeret,
    band: '#117864',
    top: PALETTE.uiSmock,
    bottom: '#2c3e50',
    hasMustache: false,
    hasClipboard: false
  },
  coder: {
    hat: PALETTE.coderBand,
    band: '#1e8449',
    top: PALETTE.coderTunic,
    bottom: '#1f618d',
    hasHeadphones: true
  },
  sec: {
    hat: PALETTE.secHelmet,
    band: '#b7950b',
    top: PALETTE.secArmor,
    bottom: '#2c3e50',
    hasBadge: true
  }
};

function drawCharacter(ctx, role, cx, cy, state = {}) {
  const style = ROLE_STYLES[role] || ROLE_STYLES.coder;
  const facing = state.facing || 'down';
  const pose = state.pose || 'idle';
  const time = state.time || 0;
  const isWalking = pose === 'walk';
  const walkStep = isWalking ? (Math.floor(time / 140) % 2) : 0;
  const bob = isWalking ? (walkStep === 0 ? -1 : 0) : (pose === 'happy' ? -((Math.floor(time / 120) % 2) * 3) : 0);

  // Top-left of 16x24 sprite anchored so feet are near (cx, cy)
  const x = Math.floor(cx - 8);
  const y = Math.floor(cy - 20 + bob);

  // Shadow under character
  drawShadowEllipse(ctx, cx, cy + 2, 6, 2);

  // Head slump when rejected
  const headDrop = pose === 'head_down' ? 2 : 0;
  const skinColor = pose === 'angry' ? PALETTE.skinRed : PALETTE.skinLight;

  // 1. Legs / Feet (y + 17..22)
  ctx.fillStyle = PALETTE.outline;
  if (pose === 'sit' || pose === 'typing' || pose === 'sit_wait' || pose === 'reading') {
    ctx.fillRect(x + 4, y + 17, 8, 4);
    ctx.fillStyle = style.bottom;
    ctx.fillRect(x + 5, y + 17, 6, 3);
  } else {
    const leftLegY = y + 17 + (isWalking && walkStep === 0 ? -1 : 0);
    const rightLegY = y + 17 + (isWalking && walkStep === 1 ? -1 : 0);
    ctx.fillRect(x + 4, leftLegY, 3, 5);
    ctx.fillRect(x + 9, rightLegY, 3, 5);
    ctx.fillStyle = style.bottom;
    ctx.fillRect(x + 5, leftLegY, 2, 3);
    ctx.fillRect(x + 9, rightLegY, 2, 3);
  }

  // 2. Torso / Outfit (y + 10..17)
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x + 3, y + 10, 10, 8);
  ctx.fillStyle = style.top;
  ctx.fillRect(x + 4, y + 11, 8, 6);

  if (role === 'mandor') {
    // Overalls straps
    ctx.fillStyle = PALETTE.overalls;
    ctx.fillRect(x + 5, y + 11, 2, 6);
    ctx.fillRect(x + 9, y + 11, 2, 6);
    ctx.fillRect(x + 4, y + 14, 8, 3);
  } else if (role === 'sec') {
    // Gold security badge on vest
    ctx.fillStyle = PALETTE.coinGold;
    ctx.fillRect(x + 9, y + 12, 2, 2);
  }

  // Arms
  const armSwing = (pose === 'typing') ? (Math.floor(time / 120) % 2) : 0;
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x + 2, y + 11 - armSwing, 2, 5);
  ctx.fillRect(x + 12, y + 11 + armSwing, 2, 5);
  ctx.fillStyle = skinColor;
  ctx.fillRect(x + 2, y + 14 - armSwing, 2, 2);
  ctx.fillRect(x + 12, y + 14 + armSwing, 2, 2);

  // Props in hand
  if (style.hasClipboard && facing !== 'up') {
    ctx.fillStyle = PALETTE.deskTop;
    ctx.fillRect(x + 11, y + 12, 4, 5);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(x + 12, y + 13, 2, 3);
  } else if (pose === 'sip') {
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(x + 12, y + 11, 3, 3);
  } else if (pose === 'drink') {
    ctx.fillStyle = '#5dade2';
    ctx.fillRect(x + 12, y + 11, 3, 3);
  } else if (pose === 'snack') {
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(x + 12, y + 11, 3, 3);
  }

  // 3. Head (y + 3..10)
  const hy = y + 3 + headDrop;
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(x + 3, hy, 10, 8);
  ctx.fillStyle = skinColor;
  ctx.fillRect(x + 4, hy + 1, 8, 6);

  // Face details depending on direction
  if (facing !== 'up') {
    ctx.fillStyle = PALETTE.black;
    if (pose === 'sleep') {
      ctx.fillRect(x + 5, hy + 4, 2, 1);
      ctx.fillRect(x + 9, hy + 4, 2, 1);
    } else if (facing === 'left') {
      ctx.fillRect(x + 4, hy + 3, 1, 2);
      ctx.fillRect(x + 7, hy + 3, 1, 2);
    } else if (facing === 'right') {
      ctx.fillRect(x + 8, hy + 3, 1, 2);
      ctx.fillRect(x + 11, hy + 3, 1, 2);
    } else {
      ctx.fillRect(x + 5, hy + 3, 1, 2);
      ctx.fillRect(x + 10, hy + 3, 1, 2);
    }

    if (style.hasMustache) {
      ctx.fillStyle = PALETTE.mustache;
      ctx.fillRect(x + 5, hy + 5, 6, 2);
    }
  } else {
    // Hair back when facing up
    ctx.fillStyle = '#3b2614';
    ctx.fillRect(x + 4, hy + 2, 8, 4);
  }

  // Coder headphones
  if (style.hasHeadphones) {
    ctx.fillStyle = '#181818';
    ctx.fillRect(x + 2, hy + 2, 2, 4);
    ctx.fillRect(x + 12, hy + 2, 2, 4);
  }

  // 4. Hat / Headgear (hy - 3..hy + 2)
  ctx.fillStyle = PALETTE.outline;
  if (role === 'mandor') {
    ctx.fillRect(x + 1, hy - 2, 14, 4);
    ctx.fillRect(x + 3, hy - 4, 10, 3);
    ctx.fillStyle = style.hat;
    ctx.fillRect(x + 2, hy - 1, 12, 2);
    ctx.fillRect(x + 4, hy - 3, 8, 2);
    ctx.fillStyle = style.band;
    ctx.fillRect(x + 4, hy - 1, 8, 1);
  } else {
    ctx.fillRect(x + 2, hy - 3, 12, 5);
    ctx.fillStyle = style.hat;
    ctx.fillRect(x + 3, hy - 2, 10, 3);
    ctx.fillStyle = style.band;
    ctx.fillRect(x + 3, hy, 10, 1);
  }

  // 5. Status / Pose Particles
  // Sweat drop every ~8s when working
  if (pose === 'typing' && (time % 8000) < 2200) {
    const dropOffset = Math.floor((time % 2200) / 500);
    ctx.fillStyle = PALETTE.sweat;
    ctx.fillRect(x + 14, hy + dropOffset, 2, 3);
  }

  if (pose === 'sleep') {
    drawZzz(ctx, x, hy - 2, Math.floor(time / 400));
  }
  if (pose === 'happy') {
    drawHeartsStars(ctx, x, hy, Math.floor(time / 160));
  }
  if (pose === 'angry') {
    drawSteamPuffs(ctx, x, hy, Math.floor(time / 160));
  }
}

function drawCoinIcon(ctx, x, y) {
  ctx.fillStyle = PALETTE.coinDark;
  ctx.fillRect(x, y + 1, 6, 5);
  ctx.fillRect(x + 1, y, 4, 7);
  ctx.fillStyle = PALETTE.coinGold;
  ctx.fillRect(x + 1, y + 1, 4, 5);
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(x + 2, y + 2, 2, 2);
}

function drawHeartsStars(ctx, x, y, frame) {
  const f = Math.floor(frame % 4);
  ctx.fillStyle = PALETTE.heart;
  ctx.fillRect(x - 4 - f, y - 6 - f, 4, 4);
  ctx.fillRect(x + 14 + f, y - 8 - f, 4, 4);
  ctx.fillStyle = PALETTE.star;
  ctx.fillRect(x + 6, y - 10 - f, 3, 3);
}

function drawSteamPuffs(ctx, x, y, frame) {
  const f = Math.floor(frame % 4);
  ctx.fillStyle = PALETTE.steam;
  ctx.fillRect(x - 4 - f, y - 4 - f * 2, 5, 4);
  ctx.fillRect(x + 14 + f, y - 4 - f * 2, 5, 4);
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(x - 3 - f, y - 3 - f * 2, 2, 2);
  ctx.fillRect(x + 15 + f, y - 3 - f * 2, 2, 2);
}

function drawZzz(ctx, x, y, frame) {
  const f = Math.floor(frame % 3);
  ctx.fillStyle = PALETTE.white;
  ctx.font = '7px monospace';
  ctx.fillText('z', x + 12, y - f * 2);
  ctx.fillText('Z', x + 16, y - 4 - f * 2);
}

const exported = {
  PALETTE,
  CHAR_MAP,
  renderMatrix,
  drawOfficeMap,
  drawCharacter,
  drawCoinIcon,
  drawHeartsStars,
  drawSteamPuffs,
  drawZzz,
  MANDOR_IDLE,
  MANDOR_IMPATIENT,
  MANDOR_HAPPY,
  UI_IDLE,
  UI_WORKING_1,
  UI_WORKING_2,
  CODER_IDLE,
  CODER_WORKING_1,
  CODER_WORKING_2,
  SEC_IDLE,
  SEC_WORKING_1,
  SEC_WORKING_2,
  CARRY_CRATE
};

if (typeof window !== 'undefined') {
  window.SquadSprites = exported;
}
if (typeof module === 'object' && module.exports) {
  module.exports = exported;
}
