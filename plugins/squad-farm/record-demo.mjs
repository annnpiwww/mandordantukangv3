#!/usr/bin/env node
// plugins/squad-farm/record-demo.mjs
// Records Squad Farm demo cutscene to H.264 MP4 (16:9 and vertical 9:16) via Playwright & ffmpeg

import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);

function resolvePlaywright() {
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const pwPath = require.resolve('playwright', { paths: [globalRoot] });
    return require(pwPath);
  } catch (err) {
    try {
      return require('playwright');
    } catch {
      console.error('Error: playwright is not found globally. Please install with: npm install -g playwright');
      process.exit(1);
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let url = 'http://127.0.0.1:24300/';
  let out = path.join(os.homedir(), 'Videos', 'squad-farm-demo.mp4');
  let size = '1920x1080';
  let vertical = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      url = args[++i];
    } else if (arg.startsWith('--url=')) {
      url = arg.split('=')[1];
    } else if (arg === '--out' && args[i + 1]) {
      out = args[++i];
    } else if (arg.startsWith('--out=')) {
      out = arg.split('=')[1];
    } else if (arg === '--size' && args[i + 1]) {
      size = args[++i];
    } else if (arg.startsWith('--size=')) {
      size = arg.split('=')[1];
    } else if (arg === '--vertical') {
      vertical = true;
    }
  }

  if (out.startsWith('~/')) {
    out = path.join(os.homedir(), out.slice(2));
  }
  out = path.resolve(out);

  const [wStr, hStr] = size.split('x');
  const width = parseInt(wStr, 10) || 1920;
  const height = parseInt(hStr, 10) || 1080;

  return { url, out, width, height, vertical };
}

async function checkServerReachable(url) {
  const base = url.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/snapshot.json`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    console.error(`Error: Squad Farm server at ${url} is not reachable.`);
    console.error(`Please run: plugins/squad-farm/launch.sh <project_dir> first.`);
    process.exit(1);
  }
}

async function record() {
  const { url, out, width, height, vertical } = parseArgs();

  await checkServerReachable(url);

  const { chromium } = resolvePlaywright();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'squad-farm-rec-'));

  console.log(`🎬 Recording demo cutscene from ${url} (${width}x${height})...`);

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    recordVideo: {
      dir: tempDir,
      size: { width, height }
    },
    viewport: { width, height }
  });

  const page = await context.newPage();

  const targetUrl = new URL(url);
  targetUrl.searchParams.set('cutscene', 'demo');

  await page.goto(targetUrl.href, { waitUntil: 'domcontentloaded' });

  let rawCues = [];
  try {
    await page.waitForFunction(() => window.__demoDone === true, null, { timeout: 120000 });
    await page.waitForTimeout(600);
    rawCues = await page.evaluate(() => window.__demoCues || []);
  } catch (err) {
    console.error('Error: Demo cutscene timed out after 120s waiting for window.__demoDone.');
    await context.close();
    await browser.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  await context.close();
  await browser.close();

  const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.webm'));
  if (files.length === 0) {
    console.error('Error: No recorded video file found in temporary directory.');
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  const webmPath = path.join(tempDir, files[0]);

  fs.mkdirSync(path.dirname(out), { recursive: true });

  const ffmpegBin = '/usr/bin/ffmpeg';

  console.log(`⚙️  Converting to H.264 MP4: ${out}`);

  execFileSync(ffmpegBin, [
    '-y',
    '-ss', '00:00:01.000',
    '-i', webmPath,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-movflags', '+faststart',
    '-an',
    out
  ], { stdio: 'pipe' });

  console.log(`✅ Saved 16:9 demo: ${out}`);

  const trimMs = 1000;
  const shiftedCues = rawCues
    .map(c => ({
      ...c,
      t: Math.max(0, c.t - trimMs)
    }))
    .filter(c => c.t >= 0);

  const cuesPath = `${out}.cues.json`;
  fs.writeFileSync(cuesPath, JSON.stringify(shiftedCues, null, 2));
  console.log(`📋 Saved cues: ${cuesPath}`);

  if (vertical) {
    const ext = path.extname(out);
    const baseName = path.basename(out, ext);
    const verticalOut = path.join(path.dirname(out), `${baseName}-vertical${ext}`);

    console.log(`⚙️  Rendering vertical 9:16 (1080x1920) version: ${verticalOut}`);

    const filter = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];[0:v]scale=1080:-1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2';

    execFileSync(ffmpegBin, [
      '-y',
      '-ss', '00:00:01.000',
      '-i', webmPath,
      '-filter_complex', filter,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-movflags', '+faststart',
      '-an',
      verticalOut
    ], { stdio: 'pipe' });

    console.log(`✅ Saved vertical demo: ${verticalOut}`);

    const verticalCuesPath = `${verticalOut}.cues.json`;
    fs.writeFileSync(verticalCuesPath, JSON.stringify(shiftedCues, null, 2));
    console.log(`📋 Saved vertical cues: ${verticalCuesPath}`);
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
}

record().catch(err => {
  console.error('Recording failed:', err);
  process.exit(1);
});
