#!/usr/bin/env node
// plugins/squad-farm/add-sfx.mjs
// Adds tempo-synced sound effects and 8-bit BGM to Squad Farm demo MP4s without re-encoding video.

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SFX_DIR = path.join(__dirname, 'sfx');
const FFMPEG_BIN = '/usr/bin/ffmpeg';

// Ensure sfx directory and all 8 sound effects exist
function ensureSfxAssets() {
  fs.mkdirSync(SFX_DIR, { recursive: true });

  const generators = {
    'step.wav': ['-f', 'lavfi', '-i', 'anoisesrc=d=0.04:c=pink:r=44100,lowpass=f=400,afade=t=out:st=0.01:d=0.03,volume=0.8'],
    'type.wav': ['-f', 'lavfi', '-i', 'anoisesrc=d=0.18:c=white:r=44100,bandpass=f=1800:width_type=h:w=600,aeval=\'val(0)*mod(floor(t*24),2)\':c=mono,afade=t=out:st=0.12:d=0.06,volume=0.4'],
    'pop.wav': ['-f', 'lavfi', '-i', 'aevalsrc=\'0.6*sin(2*PI*(400+3500*t)*t)\':d=0.08:s=44100,afade=t=in:st=0:d=0.01,afade=t=out:st=0.04:d=0.04'],
    'whoosh.wav': ['-f', 'lavfi', '-i', 'anoisesrc=d=0.4:c=brown:r=44100,bandpass=f=1200:w=800,afade=t=in:st=0:d=0.15,afade=t=out:st=0.15:d=0.25,volume=0.5'],
    'angry.wav': ['-f', 'lavfi', '-i', 'aevalsrc=\'0.6*sgn(sin(2*PI*130*t))*(lte(mod(t,0.22),0.14))\':d=0.45:s=44100,lowpass=f=600,afade=t=out:st=0.35:d=0.1'],
    'ding.wav': ['-f', 'lavfi', '-i', 'aevalsrc=\'if(lt(t,0.18), 0.5*sin(2*PI*1046.5*t)*exp(-10*t), 0.6*sin(2*PI*1318.5*(t-0.18))*exp(-5*(t-0.18)))\':d=0.9:s=44100,afade=t=out:st=0.7:d=0.2'],
    'done.wav': ['-f', 'lavfi', '-i', 'aevalsrc=\'(0.4*sin(2*PI*783.99*t) + 0.4*sin(2*PI*1046.5*t))*exp(-4*t)\':d=0.8:s=44100,afade=t=out:st=0.5:d=0.3'],
    'endcard.wav': ['-f', 'lavfi', '-i', 'aevalsrc=\'0.4*sgn(sin(2*PI*(if(lt(t,0.14),523.25,if(lt(t,0.28),783.99,1046.5)))*t))*exp(-2*mod(t,0.14))\':d=0.7:s=44100,lowpass=f=2400,afade=t=out:st=0.5:d=0.2']
  };

  for (const [name, args] of Object.entries(generators)) {
    const filePath = path.join(SFX_DIR, name);
    if (!fs.existsSync(filePath)) {
      execFileSync(FFMPEG_BIN, ['-y', ...args, '-c:a', 'pcm_s16le', filePath], { stdio: 'pipe' });
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let video = null;
  let cues = null;
  let out = null;
  let noBgm = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--video' && args[i + 1]) video = args[++i];
    else if (a.startsWith('--video=')) video = a.split('=')[1];
    else if (a === '--cues' && args[i + 1]) cues = args[++i];
    else if (a.startsWith('--cues=')) cues = a.split('=')[1];
    else if (a === '--out' && args[i + 1]) out = args[++i];
    else if (a.startsWith('--out=')) out = a.split('=')[1];
    else if (a === '--no-bgm') noBgm = true;
  }

  if (!video) {
    console.error('Error: --video <path_to_mp4> is required.');
    process.exit(1);
  }

  if (video.startsWith('~/')) video = path.join(os.homedir(), video.slice(2));
  video = path.resolve(video);

  if (!fs.existsSync(video)) {
    console.error(`Error: Video file not found: ${video}`);
    process.exit(1);
  }

  if (!cues) cues = `${video}.cues.json`;
  if (cues.startsWith('~/')) cues = path.join(os.homedir(), cues.slice(2));
  cues = path.resolve(cues);

  if (!fs.existsSync(cues)) {
    console.error(`Error: Cues file not found: ${cues}`);
    process.exit(1);
  }

  if (!out) {
    const ext = path.extname(video);
    const dir = path.dirname(video);
    const base = path.basename(video, ext);
    out = path.join(dir, `${base}-sfx${ext}`);
  }
  if (out.startsWith('~/')) out = path.join(os.homedir(), out.slice(2));
  out = path.resolve(out);

  return { video, cues, out, noBgm };
}

function loadWavMono(filePath) {
  const buf = fs.readFileSync(filePath);
  let pos = 12;
  while (pos < buf.length - 8) {
    const chunkId = buf.toString('ascii', pos, pos + 4);
    const chunkSize = buf.readUInt32LE(pos + 4);
    if (chunkId === 'data') {
      const dataOffset = pos + 8;
      const numSamples = Math.floor(chunkSize / 2);
      const samples = new Float64Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = buf.readInt16LE(dataOffset + i * 2) / 32768.0;
      }
      return samples;
    }
    pos += 8 + chunkSize;
  }
  throw new Error(`Data chunk not found in ${filePath}`);
}

function writeWavMono(filePath, samples) {
  const numSamples = samples.length;
  const byteRate = 44100 * 2;
  const blockAlign = 2;
  const dataSize = numSamples * 2;
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // Mono
  buf.writeUInt32LE(44100, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34); // 16-bit
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1.0, Math.min(1.0, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 32768 : s * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buf);
}

function getVideoDuration(videoPath) {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    videoPath
  ], { encoding: 'utf8' }).trim();
  const d = parseFloat(out);
  if (isNaN(d) || d <= 0) throw new Error(`Could not determine video duration of ${videoPath}`);
  return d;
}

async function main() {
  const { video, cues: cuesPath, out, noBgm } = parseArgs();

  ensureSfxAssets();

  const rawCuesContent = fs.readFileSync(cuesPath, 'utf8');
  let cuesList;
  try {
    cuesList = JSON.parse(rawCuesContent);
  } catch (err) {
    console.error(`Error: Failed to parse cues JSON: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(cuesList)) {
    console.error('Error: Cues file must contain a JSON array.');
    process.exit(1);
  }

  for (const c of cuesList) {
    if (typeof c.t !== 'number' || typeof c.type !== 'string') {
      console.error('Error: Each cue entry must have a numerical t and a string type.');
      process.exit(1);
    }
  }

  const duration = getVideoDuration(video);
  const sampleRate = 44100;
  const totalSamples = Math.ceil(duration * sampleRate);
  const masterBuffer = new Float64Array(totalSamples);

  // Load sound effects
  const soundBanks = {
    step: loadWavMono(path.join(SFX_DIR, 'step.wav')),
    type: loadWavMono(path.join(SFX_DIR, 'type.wav')),
    pop: loadWavMono(path.join(SFX_DIR, 'pop.wav')),
    whoosh: loadWavMono(path.join(SFX_DIR, 'whoosh.wav')),
    angry: loadWavMono(path.join(SFX_DIR, 'angry.wav')),
    ding: loadWavMono(path.join(SFX_DIR, 'ding.wav')),
    done: loadWavMono(path.join(SFX_DIR, 'done.wav')),
    endcard: loadWavMono(path.join(SFX_DIR, 'endcard.wav'))
  };

  const soundEvents = [];

  // Parse stateful intervals: walk_start..walk_stop and typing start..stop
  let activeWalks = [];
  let activeTyping = null;

  for (const cue of cuesList) {
    if (cue.type === 'walk_start') {
      activeWalks.push({ start: cue.t });
    } else if (cue.type === 'walk_stop') {
      const w = activeWalks.shift() || { start: Math.max(0, cue.t - 3000) };
      for (let st = w.start; st < cue.t; st += 280) {
        soundEvents.push({ t: st, sound: 'step', type: 'walk_step' });
      }
    } else if (cue.type === 'typing') {
      if (cue.action === 'start') {
        activeTyping = cue.t;
      } else if (cue.action === 'stop' && activeTyping !== null) {
        for (let tt = activeTyping; tt < cue.t; tt += 320) {
          soundEvents.push({ t: tt, sound: 'type', type: 'typing_click' });
        }
        activeTyping = null;
      }
    } else if (cue.type === 'scene') {
      soundEvents.push({ t: cue.t, sound: 'whoosh', type: 'scene' });
    } else if (cue.type === 'bubble') {
      soundEvents.push({ t: cue.t, sound: 'pop', type: 'bubble' });
    } else if (cue.type === 'done') {
      soundEvents.push({ t: cue.t, sound: 'done', type: 'done' });
    } else if (cue.type === 'angry') {
      soundEvents.push({ t: cue.t, sound: 'angry', type: 'angry' });
    } else if (cue.type === 'approve') {
      soundEvents.push({ t: cue.t, sound: 'ding', type: 'approve' });
    } else if (cue.type === 'endcard') {
      soundEvents.push({ t: cue.t, sound: 'endcard', type: 'endcard' });
    }
  }

  // Sort sound events chronologically
  soundEvents.sort((a, b) => a.t - b.t);

  console.log(`\n=== Sound Cue Events Table (${soundEvents.length} events) ===`);
  console.log('Time (ms) | Cue Type        | Sound Asset');
  console.log('-----------------------------------------');
  for (const ev of soundEvents) {
    console.log(`${String(ev.t).padStart(9)} | ${ev.type.padEnd(15)} | ${ev.sound}`);
  }
  console.log('=========================================\n');

  // Mix SFX into master buffer
  for (const ev of soundEvents) {
    const samples = soundBanks[ev.sound];
    if (!samples) continue;
    const startIdx = Math.round((ev.t / 1000) * sampleRate);
    for (let i = 0; i < samples.length; i++) {
      const idx = startIdx + i;
      if (idx < totalSamples) {
        masterBuffer[idx] += samples[i];
      }
    }
  }

  // Generate and mix 8-bit chiptune BGM if enabled
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'squad-farm-sfx-'));
  if (!noBgm) {
    const bgmWav = path.join(tempDir, 'bgm.wav');
    console.log(`🎵 Generating tempo-synced 8-bit BGM (duration ${duration.toFixed(2)}s)...`);
    execFileSync(FFMPEG_BIN, [
      '-y',
      '-f', 'lavfi',
      '-i', `aevalsrc=exprs='0.08*sin(2*PI*(if(lt(mod(t\\,2)\\,0.5)\\,261.63\\,if(lt(mod(t\\,2)\\,1.0)\\,329.63\\,if(lt(mod(t\\,2)\\,1.5)\\,392.00\\,523.25))))*t)':d=${duration}:s=44100`,
      '-af', `lowpass=f=1200,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, duration - 2)}:d=2,volume=-22dB`,
      '-c:a', 'pcm_s16le',
      bgmWav
    ], { stdio: 'pipe' });

    const bgmSamples = loadWavMono(bgmWav);
    for (let i = 0; i < Math.min(totalSamples, bgmSamples.length); i++) {
      masterBuffer[i] += bgmSamples[i];
    }
  }

  // Peak limiter: target peak at -1.5 dB (max_volume <= -1 dB)
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const a = Math.abs(masterBuffer[i]);
    if (a > peak) peak = a;
  }

  const targetPeak = 0.8414; // -1.5 dBFS
  if (peak > 0) {
    const gain = Math.min(1.0, targetPeak / peak);
    for (let i = 0; i < totalSamples; i++) {
      masterBuffer[i] *= gain;
    }
  }

  const mixWav = path.join(tempDir, 'mix.wav');
  writeWavMono(mixWav, masterBuffer);

  // Mux audio into video (video stream copied untouched, audio AAC 160k)
  console.log(`⚙️  Muxing audio into video (copying video stream): ${out}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });

  execFileSync(FFMPEG_BIN, [
    '-y',
    '-i', video,
    '-i', mixWav,
    '-map', '0:v',
    '-map', '1:a',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-shortest',
    '-movflags', '+faststart',
    out
  ], { stdio: 'pipe' });

  // Cleanup temp files
  fs.rmSync(tempDir, { recursive: true, force: true });

  // Measure peak volume on output
  console.log('🔍 Measuring peak volume (volumedetect)...');
  const volReport = execFileSync(FFMPEG_BIN, [
    '-i', out,
    '-af', 'volumedetect',
    '-f', 'null',
    '-'
  ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  console.log(`✅ Audio-synced video created: ${out}`);
}

main().catch(err => {
  console.error('add-sfx failed:', err);
  process.exit(1);
});
