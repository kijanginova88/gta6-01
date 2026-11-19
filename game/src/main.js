// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// wasted and busted. Cash, missions cleared and the best run are saved in
// localStorage, so the title screen can offer to continue.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';

void ACTION_SHOOT;

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { cash: 0, missions: 0, best: 0, muted: false };
    const parsed = JSON.parse(raw);
    return {
      cash: Number(parsed.cash) || 0,
      missions: Number(parsed.missions) || 0,
      best: Number(parsed.best) || 0,
      muted: !!parsed.muted,
    };
  } catch {
    return { cash: 0, missions: 0, best: 0, muted: false };
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { cash: 0, missions: 0, best: 0 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let cash = save.cash;
  let missions = save.missions;
  let best = save.best;
  let accumulator = 0;
  let last = performance.now();
  let sirenTimer = 0;
  audio.setMuted(save.muted);

  function announce(message) {
    status.textContent = message;
  }

  function persist() {
    save = { cash, missions, best, muted: audio.isMuted() };
    writeSave(save);
  }

  function startGame() {
    world.reset();
    world.state.cash = cash;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Steal a car with E, follow the pink marker.');
  }

  function endRun(overScreen) {
    screen = overScreen;
    cash = world.state.cash;
    missions = Math.max(missions, world.state.stats.missions);
    best = Math.max(best, world.state.score);
    persist();
    audio.engine(0);
    audio.stopMusic();
    if (overScreen === SCREEN_OVER) {
      audio.busted();
      announce(`Wasted. Cash kept $${cash}. Missions cleared ${missions}.`);
    } else {
      audio.busted();
      announce(`Busted. Cash kept $${cash}. Missions cleared ${missions}.`);
    }
  }

  function stepWorld(dt, actions) {
    const move = input.move();
    const mouse = input.mouse();
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    // Aim in world coordinates: the camera centres on the player.
    const camX = Math.max(0, Math.min(3200 - 1280, world.state.player.x - 640));
    const camY = Math.max(0, Math.min(2400 - 720, world.state.player.y - 360));
    const aimX = camX + mouse.x * scaleX;
    const aimY = camY + mouse.y * scaleY;
    const ctl = {
      mx: move.x,
      my: move.y,
      shoot: input.shootHeld(),
      enter: !!(actions & ACTION_ENTER),
      punch: !!(actions & ACTION_PUNCH),
      aimX,
      aimY,
    };
    const events = world.step(dt, ctl);
    if (events & 1) audio.gunshot();
    if (events & 2) audio.punch();
    if (events & 4) audio.crash();
    if (events & 8) audio.pickup();
    if (events & 16) audio.cash();
    if (events & 32) audio.missionDone();
    if (events & 512) audio.crash();
    if (events & 256) audio.siren();
    return events;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      persist();
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_TITLE) {
      // The title's backdrop: the city lives, nobody gets hurt.
      world.step(STEP, { mx: 0, my: 0, shoot: false, enter: false, punch: false, aimX: 0, aimY: 0 });
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = stepWorld(STEP, actions);
        accumulator -= STEP;
        if (events & 64) { endRun(SCREEN_OVER); break; }
        if (events & 128) { endRun(SCREEN_BUSTED); break; }
      }
      // Sirens while the heat is on.
      sirenTimer -= 1 / 60;
      if (world.state.wanted >= 1 && sirenTimer <= 0) {
        audio.siren();
        sirenTimer = 3.5;
      }
      const pl = world.state.player;
      audio.engine(pl.inCar ? Math.min(1, Math.abs(pl.inCar.speed) / 520) : 0);
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { cash, missions, best });
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
