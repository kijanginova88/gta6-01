// Drawing only: the world's state and the current screen in, pixels out.
// A camera follows the player over the 3200x2400 city; the 1280x720 view is scaled
// to fit the window and centred. Flat shapes with a fake-height shadow for buildings,
// canvas text for the HUD, panels and the minimap.

import {
  BEACH, CAR, CITY, FONT, MISSIONS, PALETTE, PARK, ROAD_X, ROAD_Y, VIEW, WORLD,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const PANEL = { width: 660, top: 150, line: 32, bottom: 76 };
const MINIMAP = { x: 1024, y: 16, w: 240, h: 180 };

function drawCarShape(ctx, x, y, angle, color, police, taxi) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
  ctx.fillStyle = police ? PALETTE.copCar : color;
  ctx.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
  ctx.fillStyle = '#20242c';
  ctx.fillRect(-CAR.length / 2 + 12, -CAR.width / 2 + 5, 14, CAR.width - 10);
  ctx.fillRect(CAR.length / 2 - 24, -CAR.width / 2 + 5, 12, CAR.width - 10);
  ctx.fillStyle = '#cfe8ff';
  ctx.fillRect(-CAR.length / 2 + 26, -CAR.width / 2 + 6, 10, CAR.width - 12);
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 6);
  ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 9, 3, 6);
  ctx.fillStyle = '#ff5a4e';
  ctx.fillRect(-CAR.length / 2, -CAR.width / 2 + 3, 3, 6);
  ctx.fillRect(-CAR.length / 2, CAR.width / 2 - 9, 3, 6);
  if (police) {
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-6, -CAR.width / 2 - 2, 5, 5);
    ctx.fillStyle = '#3b82ff';
    ctx.fillRect(1, -CAR.width / 2 - 2, 5, 5);
  }
  if (taxi) {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawCity(state, cam) {
    // Ground.
    context.fillStyle = PALETTE.grass;
    context.fillRect(cam.x - 40, cam.y - 40, VIEW.width + 80, VIEW.height + 80);
    // Beach + water at the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(cam.x - 40, BEACH.y, VIEW.width + 80, BEACH.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(cam.x - 40, BEACH.y + BEACH.height - 70, VIEW.width + 80, 70);
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cam.x - 40, BEACH.y + BEACH.height - 70);
    context.lineTo(cam.x + VIEW.width + 40, BEACH.y + BEACH.height - 70);
    context.stroke();
    // Park.
    context.fillStyle = PALETTE.parkGrass;
    context.fillRect(PARK.x, PARK.y, PARK.width, PARK.height);
    context.fillStyle = '#2f6b33';
    for (let i = 0; i < 9; i += 1) {
      const tx = PARK.x + 40 + (i % 3) * 150;
      const ty = PARK.y + 60 + Math.floor(i / 3) * 130;
      context.beginPath();
      context.arc(tx, ty, 22, 0, Math.PI * 2);
      context.fill();
    }
    // Roads: vertical roads run the full width; horizontal roads stop at the beach.
    context.fillStyle = PALETTE.road;
    for (const v of ROAD_X) {
      context.fillRect(v - CITY.roadWidth / 2, 0, CITY.roadWidth, BEACH.y);
    }
    for (const v of ROAD_Y) {
      context.fillRect(0, v - CITY.roadWidth / 2, WORLD.width, CITY.roadWidth);
    }
    // Centre dashes.
    context.strokeStyle = PALETTE.roadLine;
    context.lineWidth = 3;
    context.setLineDash([26, 30]);
    for (const v of ROAD_X) {
      context.beginPath();
      context.moveTo(v, 0);
      context.lineTo(v, BEACH.y);
      context.stroke();
    }
    for (const v of ROAD_Y) {
      context.beginPath();
      context.moveTo(0, v);
      context.lineTo(WORLD.width, v);
      context.stroke();
    }
    context.setLineDash([]);
    // Sidewalks.
    context.fillStyle = PALETTE.sidewalk;
    for (const v of ROAD_X) {
      context.fillRect(v - CITY.roadWidth / 2 - CITY.sidewalk, 0, CITY.sidewalk, BEACH.y);
      context.fillRect(v + CITY.roadWidth / 2, 0, CITY.sidewalk, BEACH.y);
    }
    for (const v of ROAD_Y) {
      context.fillRect(0, v - CITY.roadWidth / 2 - CITY.sidewalk, WORLD.width, CITY.sidewalk);
      context.fillRect(0, v + CITY.roadWidth / 2, WORLD.width, CITY.sidewalk);
    }
    // Buildings (fake height: offset top face).
    for (const b of state.buildings) {
      if (b.x + b.w < cam.x - 80 || b.x > cam.x + VIEW.width + 80 || b.y + b.h < cam.y - 80 || b.y > cam.y + VIEW.height + 80) continue;
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = PALETTE.building[b.color % PALETTE.building.length];
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.buildingRoof[b.color % PALETTE.buildingRoof.length];
      context.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 22) {
        for (let wy = b.y + 12; wy < b.y + b.h - 10; wy += 22) {
          context.fillRect(wx, wy, 8, 10);
        }
      }
    }
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      if (pk.kind === 'cash') {
        context.fillStyle = PALETTE.cash;
        context.fillRect(pk.x - 10, pk.y - 7 + bob, 20, 14);
        context.fillStyle = '#1d5c1d';
        context.font = 'bold 11px ' + FONT;
        context.textAlign = 'center';
        context.fillText('$', pk.x, pk.y + 4 + bob);
      } else if (pk.kind === 'health') {
        context.fillStyle = '#fff';
        context.fillRect(pk.x - 10, pk.y - 10 + bob, 20, 20);
        context.fillStyle = '#e5534b';
        context.fillRect(pk.x - 3, pk.y - 7 + bob, 6, 14);
        context.fillRect(pk.x - 7, pk.y - 3 + bob, 14, 6);
      } else {
        context.fillStyle = '#ffd23f';
        context.fillRect(pk.x - 8, pk.y - 5 + bob, 16, 10);
        context.fillStyle = '#7a5c00';
        context.font = 'bold 9px ' + FONT;
        context.textAlign = 'center';
        context.fillText('AMMO', pk.x, pk.y + 3 + bob);
      }
    }
  }

  function drawEntities(state) {
    // Mission target marker.
    const target = state.missionTarget;
    if (target) {
      const pulse = 26 + Math.sin(state.elapsed * 4) * 6;
      context.strokeStyle = PALETTE.missionMarker;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(target.x, target.y, pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.missionMarker;
      context.beginPath();
      context.arc(target.x, target.y, 6, 0, Math.PI * 2);
      context.fill();
    }
    drawPickups(state);
    // Pedestrians.
    for (const ped of state.peds) {
      context.save();
      context.translate(ped.x, ped.y);
      context.rotate(ped.angle);
      context.fillStyle = PALETTE.ped[ped.color % PALETTE.ped.length];
      context.beginPath();
      context.arc(0, 0, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#20242c';
      context.beginPath();
      context.arc(3, -3, 2, 0, Math.PI * 2);
      context.arc(3, 3, 2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // Cars.
    for (const car of state.cars) {
      const color = car.police ? PALETTE.copCar : car.taxi ? PALETTE.taxi : PALETTE.car[car.color % PALETTE.car.length];
      drawCarShape(context, car.x, car.y, car.angle, color, car.police, car.taxi);
      if (car.health < CAR.health) {
        context.fillStyle = '#111';
        context.fillRect(car.x - 20, car.y - 34, 40, 5);
        context.fillStyle = car.health > 40 ? PALETTE.health : PALETTE.damage;
        context.fillRect(car.x - 20, car.y - 34, 40 * (car.health / CAR.health), 5);
      }
    }
    // On-foot cops.
    for (const cop of state.cops) {
      context.save();
      context.translate(cop.x, cop.y);
      context.rotate(cop.angle);
      context.fillStyle = PALETTE.cop;
      context.beginPath();
      context.arc(0, 0, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.fillRect(-4, -3, 8, 6);
      context.restore();
    }
    // Bullets (tracer lines).
    context.strokeStyle = '#ffe66d';
    context.lineWidth = 2;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x - Math.cos(b.angle) * 26, b.y - Math.sin(b.angle) * 26);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // Particles.
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life);
      context.fillStyle = p.color;
      context.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    context.globalAlpha = 1;
    // Player.
    const pl = state.player;
    if (!pl.inCar) {
      if (pl.invulnerable === 0 || Math.floor(pl.invulnerable * 10) % 2 === 1) {
        context.save();
        context.translate(pl.x, pl.y);
        context.rotate(pl.angle);
        context.fillStyle = PALETTE.playerJacket;
        context.beginPath();
        context.arc(0, 0, 13, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#f2c98a';
        context.beginPath();
        context.arc(4, 0, 6, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#20242c';
        context.fillRect(8, -3, 10, 3);
        context.fillRect(8, 1, 10, 3);
        context.restore();
      }
    }
  }

  function drawHud(state, screen) {
    const pl = state.player;
    context.textBaseline = 'top';
    // Cash.
    context.fillStyle = PALETTE.panel;
    context.fillRect(16, 12, 210, 44);
    text(`$${state.cash.toLocaleString('en-US')}`, 28, 22, 26, PALETTE.cash, 'left', 'top');
    // Wanted stars.
    context.fillStyle = PALETTE.panel;
    context.fillRect(240, 12, 190, 44);
    for (let i = 0; i < 5; i += 1) {
      context.fillStyle = i < Math.ceil(state.wanted) ? PALETTE.star : PALETTE.starEmpty;
      context.font = '26px ' + FONT;
      context.textAlign = 'left';
      context.fillText('★', 252 + i * 34, 16);
    }
    // Health + ammo.
    context.fillStyle = PALETTE.panel;
    context.fillRect(16, 64, 210, 60);
    text('HEALTH', 28, 72, 14, PALETTE.muted, 'left', 'top');
    context.fillStyle = '#111';
    context.fillRect(28, 92, 170, 10);
    context.fillStyle = pl.health > 35 ? PALETTE.health : PALETTE.damage;
    context.fillRect(28, 92, 170 * Math.max(0, pl.health / 100), 10);
    text(`AMMO ${state.ammo}`, 28, 106, 14, PALETTE.text, 'left', 'top');
    if (pl.inCar) {
      context.fillStyle = PALETTE.panel;
      context.fillRect(16, 132, 210, 44);
      text('CAR', 28, 140, 14, PALETTE.muted, 'left', 'top');
      context.fillStyle = '#111';
      context.fillRect(28, 158, 170, 10);
      context.fillStyle = pl.inCar.health > 40 ? PALETTE.health : PALETTE.damage;
      context.fillRect(28, 158, 170 * Math.max(0, pl.inCar.health / 100), 10);
    }
    // Mission line.
    if (state.missionText) {
      context.fillStyle = PALETTE.panel;
      const w = Math.min(640, 40 + state.missionText.length * 8.5);
      context.fillRect((VIEW.width - w) / 2, 12, w, 44);
      text(state.missionText, VIEW.width / 2, 24, 17, PALETTE.text, 'center', 'top');
    }
    // Mission timer.
    if (state.missionTimer > 0) {
      text(`${Math.ceil(state.missionTimer)}s`, VIEW.width / 2, 62, 30, '#ff5ce1', 'center', 'top');
    }
    // Toast message.
    if (state.messageTimer > 0 && state.message) {
      context.fillStyle = PALETTE.panel;
      const w = Math.min(760, 40 + state.message.length * 8.5);
      context.fillRect((VIEW.width - w) / 2, VIEW.height - 64, w, 40);
      text(state.message, VIEW.width / 2, VIEW.height - 54, 18, '#ffd23f', 'center', 'top');
    }
    // Minimap.
    const scale = MINIMAP.w / WORLD.width;
    context.fillStyle = PALETTE.panel;
    context.fillRect(MINIMAP.x - 6, MINIMAP.y - 6, MINIMAP.w + 12, MINIMAP.h + 12);
    context.fillStyle = '#1c2733';
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.strokeStyle = '#4a5568';
    context.lineWidth = 1;
    for (const v of ROAD_X) {
      context.beginPath();
      context.moveTo(MINIMAP.x + v * scale, MINIMAP.y);
      context.lineTo(MINIMAP.x + v * scale, MINIMAP.y + MINIMAP.h);
      context.stroke();
    }
    for (const v of ROAD_Y) {
      context.beginPath();
      context.moveTo(MINIMAP.x, MINIMAP.y + v * scale);
      context.lineTo(MINIMAP.x + MINIMAP.w, MINIMAP.y + v * scale);
      context.stroke();
    }
    context.fillStyle = '#2e7fa8';
    context.fillRect(MINIMAP.x, MINIMAP.y + BEACH.y * scale, MINIMAP.w, 8);
    if (state.missionTarget) {
      context.fillStyle = PALETTE.missionMarker;
      context.beginPath();
      context.arc(MINIMAP.x + state.missionTarget.x * scale, MINIMAP.y + state.missionTarget.y * scale, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (!car.police) continue;
      context.fillStyle = '#5b8cff';
      context.fillRect(MINIMAP.x + car.x * scale - 2, MINIMAP.y + car.y * scale - 2, 4, 4);
    }
    context.fillStyle = '#ffd23f';
    context.beginPath();
    context.arc(MINIMAP.x + pl.x * scale, MINIMAP.y + pl.y * scale, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#fff';
    context.beginPath();
    context.moveTo(MINIMAP.x + pl.x * scale, MINIMAP.y + pl.y * scale);
    context.lineTo(MINIMAP.x + (pl.x + Math.cos(pl.angle) * 140) * scale, MINIMAP.y + (pl.y + Math.sin(pl.angle) * 140) * scale);
    context.stroke();
    text('NEON BAY', MINIMAP.x, MINIMAP.y + MINIMAP.h + 10, 13, PALETTE.muted, 'left', 'top');
    if (screen === SCREEN_PLAY) {
      text('WASD move/drive · E steal/exit · F punch · Space shoot · P pause · M mute', 16, VIEW.height - 24, 14, PALETTE.muted, 'left', 'top');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = '#ffd23f';
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 82, 52, '#ffd23f', 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 23, PALETTE.cash, 'center');
  }

  /** Paint one frame: the city under the camera, then the HUD or a panel. */
  function draw(state, screen, save) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0e14';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const cam = {
      x: Math.max(0, Math.min(WORLD.width - VIEW.width, state.player.x - VIEW.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - VIEW.height, state.player.y - VIEW.height / 2)),
    };
    context.save();
    context.translate(-cam.x, -cam.y);
    drawCity(state, cam);
    drawEntities(state);
    context.restore();
    if (screen === SCREEN_TITLE) {
      const lines = [
        'An open-world crime story in the sun-soaked city of Neon Bay.',
        'Steal cars, outrun the police, run missions for the crew.',
        `Missions cleared: ${save.missions} · Cash earned: $${save.cash.toLocaleString('en-US')}`,
        '',
        'WASD move & drive · E steal / exit car · F punch · Space shoot',
      ];
      drawPanel('NEON BAY', lines, save.missions > 0 ? 'Press Enter or click to continue' : 'Press Enter or click to start');
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one — except now.'], 'Press P to resume · M mute');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', [`The crew sends flowers. Cash kept: $${state.cash.toLocaleString('en-US')}.`, `Missions cleared: ${state.stats.missions}`], 'Press Enter or click to try again');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Neon Bay PD caught up with you.', `Cash kept: $${state.cash.toLocaleString('en-US')}.`], 'Press Enter or click to try again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
