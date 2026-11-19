// Neon Bay — the game's rules and state, with no drawing and no browser in it:
// the city, the player on foot and in cars, traffic, pedestrians, police, the
// wanted system, missions, combat and pickups. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sound, screens)
// without the world knowing about them.

import {
  BEACH, CAR, CASH, CITY, GUN, MISSIONS, PARK, PEDS, PLAYER, POLICE, ROAD_X, ROAD_Y, TRAFFIC, WANTED, WORLD,
} from './config.js';
import { angleDelta, clamp, dist } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_CASH = 16;
export const EVENT_MISSION_DONE = 32;
export const EVENT_WASTED = 64;
export const EVENT_BUSTED = 128;
export const EVENT_SIREN = 256;
export const EVENT_STEAL = 512;
export const EVENT_HIT = 1024;

const TAU = Math.PI * 2;

/** Is (x, y) on a road (not sidewalk or block)? */
export function isOnRoad(x, y) {
  const rx = ((x % CITY.roadStep) + CITY.roadStep) % CITY.roadStep;
  const ry = ((y % CITY.roadStep) + CITY.roadStep) % CITY.roadStep;
  const half = CITY.roadWidth / 2;
  return (rx < half || rx > CITY.roadStep - half || ry < half || ry > CITY.roadStep - half)
    && y < BEACH.y;
}

export function createWorld(random) {
  // ---- city (fixed at creation, from the seed) ----
  const buildings = [];
  const centersX = ROAD_X;
  const centersY = ROAD_Y;
  for (let ix = 0; ix < centersX.length - 1; ix += 1) {
    for (let iy = 0; iy < centersY.length - 1; iy += 1) {
      const bx = centersX[ix] + CITY.roadWidth / 2 + CITY.blockMargin;
      const by = centersY[iy] + CITY.roadWidth / 2 + CITY.blockMargin;
      const bw = CITY.roadStep - CITY.roadWidth - CITY.blockMargin * 2;
      const bh = CITY.roadStep - CITY.roadWidth - CITY.blockMargin * 2;
      if (by + bh > BEACH.y) continue;
      if (bx > PARK.x - 40 && bx < PARK.x + PARK.width + 40 && by > PARK.y - 40 && by < PARK.y + PARK.height + 40) continue;
      const n = random.int(1, 3);
      for (let k = 0; k < n; k += 1) {
        const w = random.range(bw * 0.3, bw * 0.62);
        const h = random.range(bh * 0.3, bh * 0.62);
        buildings.push({
          x: bx + random.range(0, bw - w),
          y: by + random.range(0, bh - h),
          w, h,
          color: random.int(0, 6),
          height: random.range(14, 46),
        });
      }
    }
  }

  // ---- entities ----
  const player = {
    x: WORLD.width / 2, y: WORLD.height / 2, angle: -Math.PI / 2,
    health: PLAYER.health, inCar: null, speed: 0, punchTimer: 0, gunTimer: 0,
    invulnerable: 0, bustedTimer: 0,
  };
  const cars = [];
  const peds = [];
  const cops = [];
  const pickups = [];
  const particles = [];
  const bullets = [];

  const state = {
    player, cars, peds, cops, pickups, particles, bullets, buildings,
    cash: 0, wanted: 0, ammo: GUN.ammoStart,
    missionIndex: 0, missionStage: 0, missionDone: false, missionTimer: 0,
    missionTarget: null, missionText: '',
    elapsed: 0, score: 0, busted: false, wasted: false,
    stats: { stolen: 0, busted: 0, missions: 0 },
    message: '', messageTimer: 0,
  };

  function say(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 3;
  }

  function spawnParticle(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random.next() * TAU;
      const s = random.range(speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(0.3, 0.8), color });
    }
  }

  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, WANTED.maxStars);
  }

  function nearestCar(x, y, maxDist, want) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (want && !want(car)) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function spawnParkedCar() {
    // Parked along a road edge, facing along the road.
    const horizontal = random.next() < 0.5;
    const road = horizontal ? random.pick(ROAD_Y.slice(1, -1)) : random.pick(ROAD_X.slice(1, -1));
    const along = horizontal ? random.range(300, WORLD.width - 300) : random.range(300, BEACH.y - 300);
    const side = random.next() < 0.5 ? -1 : 1;
    const off = CITY.roadWidth / 2 - 12;
    const car = {
      x: horizontal ? along : road + side * off,
      y: horizontal ? road + side * off : along,
      angle: horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: 0, health: CAR.health, color: random.int(0, 6),
      taxi: random.next() < 0.12, police: false, driver: 'parked',
      axis: horizontal ? 'h' : 'v', dir: 1, cruise: 0, stuck: 0,
    };
    cars.push(car);
    return car;
  }

  function spawnTrafficCar() {
    const horizontal = random.next() < 0.5;
    const road = horizontal ? random.pick(ROAD_Y.slice(0, -1)) : random.pick(ROAD_X.slice(0, -1));
    const along = horizontal ? random.range(0, WORLD.width) : random.range(0, BEACH.y);
    const dir = random.next() < 0.5 ? 1 : -1;
    const lane = CITY.roadWidth / 2 - 22;
    const car = {
      x: horizontal ? along : road + (dir > 0 ? lane : -lane),
      y: horizontal ? road + (dir > 0 ? lane : -lane) : along,
      angle: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: random.range(TRAFFIC.speedMin, TRAFFIC.speedMax),
      health: CAR.health, color: random.int(0, 6),
      taxi: random.next() < 0.12, police: false, driver: 'traffic',
      axis: horizontal ? 'h' : 'v', dir, cruise: random.range(TRAFFIC.speedMin, TRAFFIC.speedMax), stuck: 0,
    };
    cars.push(car);
    return car;
  }

  function spawnPed(x, y) {
    peds.push({
      x: x ?? random.range(200, WORLD.width - 200),
      y: y ?? random.range(200, BEACH.y - 200),
      angle: random.next() * TAU, speed: random.range(PEDS.speedMin, PEDS.speedMax),
      color: random.int(0, 4), health: 100, flee: 0, panic: 0,
      targetX: 0, targetY: 0, retarget: 0,
    });
  }

  function spawnCopCar() {
    const a = random.next() * TAU;
    const r = 900;
    const car = {
      x: clamp(player.x + Math.cos(a) * r, 100, WORLD.width - 100),
      y: clamp(player.y + Math.sin(a) * r, 100, BEACH.y - 100),
      angle: 0, speed: 0, health: CAR.health, color: 0, taxi: false, police: true,
      driver: 'police', axis: 'h', dir: 1, cruise: POLICE.chaseSpeed, stuck: 0,
    };
    cars.push(car);
    return car;
  }

  function spawnCopFoot() {
    const a = random.next() * TAU;
    cops.push({
      x: clamp(player.x + Math.cos(a) * 420, 60, WORLD.width - 60),
      y: clamp(player.y + Math.sin(a) * 420, 60, BEACH.y - 60),
      angle: 0, health: 100, speed: POLICE.onFootSpeed, punchTimer: 0,
    });
  }

  function spawnPickup(kind, x, y) {
    pickups.push({ kind, x, y, bob: random.next() * TAU });
  }

  /** A point inside a building (with a small margin) — cars and people walk around these. */
  function buildingAt(x, y, margin) {
    for (const b of buildings) {
      if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return b;
    }
    return null;
  }

  function pushOutOfBuildings(ent, radius) {
    const b = buildingAt(ent.x, ent.y, radius);
    if (!b) return;
    const left = ent.x - (b.x - radius);
    const right = (b.x + b.w + radius) - ent.x;
    const top = ent.y - (b.y - radius);
    const bottom = (b.y + b.h + radius) - ent.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) ent.x = b.x - radius;
    else if (m === right) ent.x = b.x + b.w + radius;
    else if (m === top) ent.y = b.y - radius;
    else ent.y = b.y + b.h + radius;
  }

  function missionTargetFor(mission, stage) {
    // Fixed landmarks: docks (west), club (east), park (centre), beach (south).
    const docks = { x: 240, y: 1200 };
    const club = { x: 2960, y: 400 };
    const park = { x: PARK.x + PARK.width / 2, y: PARK.y + PARK.height / 2 };
    const beach = { x: 1600, y: 2260 };
    const bank = { x: 2800, y: 2000 };
    switch (mission.type) {
      case 'steal-deliver': return stage === 0 ? null : club;
      case 'fetch': return stage === 0 ? docks : club;
      case 'lose-heat': return null;
      case 'collect': return stage < 3 ? { x: 600 + stage * 900, y: 600 + (stage % 2) * 800 } : null;
      case 'timed': return bank;
      case 'survive': return park;
      default: return null;
    }
    // beach is the hideout for later free-roam pickups, not a mission target.
    void beach;
  }

  function setMission(index, stage) {
    state.missionIndex = index;
    state.missionStage = stage;
    const m = MISSIONS[index];
    if (!m) {
      state.missionTarget = null;
      state.missionText = 'Free roam — Neon Bay is yours. Cause trouble, lose the heat, get rich.';
      return;
    }
    state.missionTarget = missionTargetFor(m, stage);
    state.missionText = `Mission ${m.id}: ${m.name} — ${m.brief}`;
    if (m.type === 'timed') state.missionTimer = 90;
    if (m.type === 'survive') state.missionTimer = 90;
    say(state.missionText, 5);
  }

  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    const reward = CASH.mission[state.missionIndex] || 500;
    state.cash += reward;
    state.stats.missions += 1;
    state.score += reward;
    say(`Mission complete: ${m ? m.name : ''} — +$${reward}`, 4);
    spawnPickup('cash', player.x + 40, player.y);
    const next = state.missionIndex + 1;
    if (next < MISSIONS.length) setMission(next, 0);
    else {
      state.missionIndex = MISSIONS.length;
      state.missionStage = 0;
      state.missionTarget = null;
      state.missionText = 'All missions done — you are the King of Neon Bay.';
    }
    return EVENT_MISSION_DONE | EVENT_CASH;
  }

  function reset() {
    player.x = WORLD.width / 2;
    player.y = WORLD.height / 2;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.inCar = null;
    player.speed = 0;
    player.punchTimer = 0;
    player.gunTimer = 0;
    player.invulnerable = 0;
    player.bustedTimer = 0;
    cars.length = 0;
    peds.length = 0;
    cops.length = 0;
    pickups.length = 0;
    particles.length = 0;
    bullets.length = 0;
    state.cash = 0;
    state.wanted = 0;
    state.ammo = GUN.ammoStart;
    state.elapsed = 0;
    state.score = 0;
    state.busted = false;
    state.wasted = false;
    state.stats = { stolen: 0, busted: 0, missions: 0 };
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (let i = 0; i < 8; i += 1) spawnParkedCar();
    for (let i = 0; i < PEDS.count; i += 1) spawnPed();
    spawnPickup('health', player.x + 120, player.y - 80);
    spawnPickup('ammo', player.x - 140, player.y + 60);
    spawnPickup('cash', 600, 600);
    spawnPickup('cash', 2600, 1800);
    setMission(0, 0);
  }

  /** One fixed step. `ctl` carries the frame's input: { mx, my, shoot, enter, punch, aimX, aimY }. */
  function step(dt, ctl) {
    let events = 0;
    if (state.busted || state.wasted) return events;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.gunTimer > 0) player.gunTimer -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    const mission = MISSIONS[state.missionIndex];

    // ---- wanted decay: heat fades while no police can see the player ----
    let copNear = false;
    for (const car of cars) if (car.police && dist(car.x, car.y, player.x, player.y) < WANTED.hideRadius) copNear = true;
    for (const cop of cops) if (dist(cop.x, cop.y, player.x, player.y) < WANTED.hideRadius) copNear = true;
    if (!copNear && state.wanted > 0) {
      state.wanted = Math.max(0, state.wanted - WANTED.decayPerSecond * dt);
      if (mission && mission.type === 'lose-heat' && state.wanted === 0 && state.missionStage === 1) {
        events |= completeMission();
      }
    }

    // ---- police spawns ----
    const wantCops = Math.floor(state.wanted);
    const policeCars = cars.filter((c) => c.police).length;
    if (wantCops > 0 && policeCars < Math.min(POLICE.maxCars, wantCops + 1)) {
      if (Math.random() < dt / POLICE.spawnInterval) {
        spawnCopCar();
        events |= EVENT_SIREN;
      }
    }
    if (wantCops >= 2 && cops.length < wantCops - 1 && !player.inCar) {
      if (Math.random() < dt / (POLICE.spawnInterval * 1.5)) spawnCopFoot();
    }

    // ---- player ----
    if (player.inCar) {
      const car = player.inCar;
      const steer = ctl.mx;
      const accel = ctl.my < 0;
      const brake = ctl.my > 0;
      const handbrake = ctl.shoot;
      const forward = car.speed >= 0 ? 1 : -1;
      if (accel) car.speed += CAR.accel * dt * (car.speed < 0 ? 1.6 : 1);
      else if (brake) {
        if (car.speed > 1) car.speed -= CAR.brake * dt;
        else car.speed -= CAR.reverseAccel * dt;
      } else {
        car.speed -= car.speed * CAR.drag * dt;
        if (Math.abs(car.speed) < 4) car.speed = 0;
      }
      if (handbrake) car.speed -= car.speed * 2.2 * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const offRoad = !isOnRoad(car.x, car.y);
      if (offRoad) car.speed *= 1 - 0.9 * dt;
      car.angle += steer * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * forward;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 40, WORLD.width - 40);
      car.y = clamp(car.y, 40, WORLD.height - 40);
      if (buildingAt(car.x, car.y, 18)) {
        pushOutOfBuildings(car, 18);
        if (Math.abs(car.speed) > 180) {
          car.health -= 8;
          car.speed *= -0.3;
          spawnParticle(car.x, car.y, '#e8b13f', 8, 160);
          events |= EVENT_CRASH;
        } else car.speed *= 0.4;
      }
      if (car.health <= 0) {
        spawnParticle(car.x, car.y, '#ff7a2f', 26, 320);
        spawnParticle(car.x, car.y, '#3a3a3a', 16, 200);
        events |= EVENT_CRASH;
        const idx = cars.indexOf(car);
        if (idx >= 0) cars.splice(idx, 1);
        player.inCar = null;
        player.x = car.x + 50;
        player.y = car.y;
        player.health = Math.max(20, player.health - 15);
        addWanted(WANTED.wreckCar);
        say('Your car blew up! The whole bay heard that.', 3);
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      if (ctl.enter) {
        player.inCar = null;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
        car.speed = 0;
      }
    } else {
      const run = ctl.shoot;
      const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const len = Math.hypot(ctl.mx, ctl.my);
      if (len > 0) {
        const nx = ctl.mx / len;
        const ny = ctl.my / len;
        player.x += nx * speed * dt;
        player.y += ny * speed * dt;
        player.angle = Math.atan2(ny, nx);
      }
      player.x = clamp(player.x, 30, WORLD.width - 30);
      player.y = clamp(player.y, 30, BEACH.y + BEACH.height - 30);
      pushOutOfBuildings(player, PLAYER.radius);
      if (ctl.enter) {
        const car = nearestCar(player.x, player.y, 64, (c) => !c.police);
        if (car) {
          if (car.driver === 'parked' || car.driver === 'traffic') {
            // Stealing: yank the driver out if there is one.
            if (car.driver === 'traffic') {
              spawnPed(car.x, car.y);
              say('You yanked the driver out — that car is yours now.', 3);
            }
            car.driver = 'player';
            player.inCar = car;
            state.stats.stolen += 1;
            addWanted(WANTED.stealCar);
            events |= EVENT_STEAL;
            if (mission && mission.type === 'steal-deliver' && state.missionStage === 0) {
              state.missionStage = 1;
              state.missionTarget = missionTargetFor(mission, 1);
              say('Got wheels. Now bring the car to the pink marker.', 4);
            }
          }
        }
      }
      if (ctl.punch && player.punchTimer <= 0) {
        player.punchTimer = PLAYER.punchCooldown;
        events |= EVENT_PUNCH;
        const px = player.x + Math.cos(player.angle) * PLAYER.punchRange;
        const py = player.y + Math.sin(player.angle) * PLAYER.punchRange;
        let hit = false;
        for (const ped of peds) {
          if (dist(px, py, ped.x, ped.y) < 30) {
            ped.health -= PLAYER.punchDamage;
            ped.flee = 2.5;
            hit = true;
            if (ped.health <= 0) {
              spawnParticle(ped.x, ped.y, '#e5534b', 10, 140);
              spawnPickup('cash', ped.x, ped.y);
              addWanted(WANTED.killPed);
            }
          }
        }
        for (const cop of cops) {
          if (dist(px, py, cop.x, cop.y) < 30) {
            cop.health -= PLAYER.punchDamage;
            hit = true;
            if (cop.health <= 0) {
              spawnParticle(cop.x, cop.y, '#2e5fd8', 12, 160);
              addWanted(WANTED.killCop);
            }
          }
        }
        if (hit && mission && mission.type === 'collect') {
          state.missionStage += 1;
          say(`Debtor dealt with. ${3 - state.missionStage} left.`, 3);
          if (state.missionStage >= 3) events |= completeMission();
        } else if (hit) addWanted(WANTED.punch);
      }
      if (ctl.shoot && player.gunTimer <= 0 && state.ammo > 0) {
        player.gunTimer = GUN.cooldown;
        state.ammo -= 1;
        events |= EVENT_SHOT;
        const ax = ctl.aimX;
        const ay = ctl.aimY;
        const aim = Math.atan2(ay - player.y, ax - player.x);
        player.angle = aim;
        const gx = player.x + Math.cos(aim) * 20;
        const gy = player.y + Math.sin(aim) * 20;
        bullets.push({ x: gx, y: gy, angle: aim, life: 0.12 });
        let bestD = GUN.range;
        let target = null;
        let targetKind = '';
        for (const ped of peds) {
          const d = dist(player.x, player.y, ped.x, ped.y);
          if (d > bestD) continue;
          const ang = Math.atan2(ped.y - player.y, ped.x - player.x);
          if (Math.abs(angleDelta(aim, ang)) < 0.12) { bestD = d; target = ped; targetKind = 'ped'; }
        }
        for (const cop of cops) {
          const d = dist(player.x, player.y, cop.x, cop.y);
          if (d > bestD) continue;
          const ang = Math.atan2(cop.y - player.y, cop.x - player.x);
          if (Math.abs(angleDelta(aim, ang)) < 0.12) { bestD = d; target = cop; targetKind = 'cop'; }
        }
        for (const car of cars) {
          if (car.driver === 'player') continue;
          const d = dist(player.x, player.y, car.x, car.y);
          if (d > bestD) continue;
          const ang = Math.atan2(car.y - player.y, car.x - player.x);
          if (Math.abs(angleDelta(aim, ang)) < 0.14) { bestD = d; target = car; targetKind = 'car'; }
        }
        if (target) {
          spawnParticle(target.x, target.y, '#ffd23f', 6, 180);
          if (targetKind === 'ped') {
            target.health -= GUN.damage;
            target.flee = 3;
            if (target.health <= 0) { spawnPickup('cash', target.x, target.y); addWanted(WANTED.killPed); }
          } else if (targetKind === 'cop') {
            target.health -= GUN.damage;
            if (target.health <= 0) addWanted(WANTED.killCop);
          } else {
            target.health -= GUN.damage;
            if (target.health <= 0) {
              spawnParticle(target.x, target.y, '#ff7a2f', 20, 260);
              const idx = cars.indexOf(target);
              if (idx >= 0) cars.splice(idx, 1);
              addWanted(WANTED.wreckCar);
            }
          }
          addWanted(WANTED.shoot);
          for (const ped of peds) if (dist(ped.x, ped.y, player.x, player.y) < 500) ped.flee = 2;
        }
      }
    }

    // ---- traffic ----
    for (const car of cars) {
      if (car.driver !== 'traffic') continue;
      const ahead = { x: car.x + Math.cos(car.angle) * 70, y: car.y + Math.sin(car.angle) * 70 };
      let blocked = false;
      for (const other of cars) {
        if (other === car) continue;
        if (dist(ahead.x, ahead.y, other.x, other.y) < 52) { blocked = true; break; }
      }
      if (!blocked) {
        car.speed = car.cruise;
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
      } else {
        car.speed = Math.max(0, car.speed - 300 * dt);
      }
      // Turn at intersections, sometimes.
      const cx = car.axis === 'h' ? car.x : car.y;
      const nearest = Math.round(cx / CITY.roadStep) * CITY.roadStep;
      if (Math.abs(cx - nearest) < 8 && random.next() < dt * 0.25) {
        const turn = random.next() < 0.5 ? -1 : 1;
        const horizontal = car.axis === 'h';
        car.axis = horizontal ? 'v' : 'h';
        car.angle = horizontal
          ? (turn > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (turn > 0 ? 0 : Math.PI);
        car.dir = 1;
      }
      if (car.x < -80 || car.x > WORLD.width + 80 || car.y < -80 || car.y > BEACH.y + 80) {
        // Recycle far-away traffic back near the player.
        car.x = clamp(player.x + (random.next() < 0.5 ? -1 : 1) * random.range(700, 1100), 100, WORLD.width - 100);
        car.y = clamp(player.y + (random.next() < 0.5 ? -1 : 1) * random.range(500, 800), 100, BEACH.y - 100);
        const horizontal = random.next() < 0.5;
        car.axis = horizontal ? 'h' : 'v';
        car.angle = horizontal ? 0 : Math.PI / 2;
      }
    }

    // ---- police cars: chase and ram ----
    for (const car of cars) {
      if (!car.police) continue;
      const want = Math.atan2(player.y - car.y, player.x - car.x);
      car.angle += clamp(angleDelta(car.angle, want), -2.4 * dt, 2.4 * dt);
      const d = dist(car.x, car.y, player.x, player.y);
      const target = d > 260 ? POLICE.chaseSpeed : POLICE.chaseSpeed * 0.75;
      car.speed += (target - car.speed) * Math.min(1, 1.4 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 40, WORLD.width - 40);
      car.y = clamp(car.y, 40, BEACH.y - 40);
      if (buildingAt(car.x, car.y, 18)) {
        pushOutOfBuildings(car, 18);
        car.speed *= 0.5;
      }
      if (d < 70) {
        if (player.inCar) {
          player.inCar.health -= POLICE.ramDamage * dt;
          car.speed *= 0.6;
          if (Math.random() < dt * 2) events |= EVENT_CRASH;
        } else if (player.invulnerable === 0) {
          player.health -= POLICE.ramDamage * 2 * dt;
          player.invulnerable = 0.4;
          events |= EVENT_HIT;
        }
      }
    }

    // ---- on-foot cops: chase and brawl ----
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      if (cop.health <= 0) { cops.splice(i, 1); continue; }
      const d = dist(cop.x, cop.y, player.x, player.y);
      const want = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle = want;
      if (d > 30) {
        cop.x += Math.cos(want) * cop.speed * dt;
        cop.y += Math.sin(want) * cop.speed * dt;
      }
      pushOutOfBuildings(cop, 12);
      if (d < POLICE.bustedRange && !player.inCar) {
        player.bustedTimer += dt;
        if (player.bustedTimer > POLICE.bustedTime) {
          state.busted = true;
          state.stats.busted += 1;
          return EVENT_BUSTED;
        }
      } else {
        player.bustedTimer = Math.max(0, player.bustedTimer - dt * 2);
      }
      if (d < 34 && cop.punchTimer <= 0 && player.invulnerable === 0) {
        cop.punchTimer = 0.9;
        player.health -= 12;
        player.invulnerable = 0.5;
        events |= EVENT_HIT;
      }
      if (cop.punchTimer > 0) cop.punchTimer -= dt;
      if (d > 1400) cops.splice(i, 1);
    }

    // ---- pedestrians: stroll the sidewalks, flee from trouble ----
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const ped = peds[i];
      if (ped.health <= 0) { peds.splice(i, 1); continue; }
      if (ped.flee > 0) {
        ped.flee -= dt;
        const away = Math.atan2(ped.y - player.y, ped.x - player.x);
        ped.x += Math.cos(away) * ped.speed * 2.2 * dt;
        ped.y += Math.sin(away) * ped.speed * 2.2 * dt;
      } else {
        ped.retarget -= dt;
        if (ped.retarget <= 0) {
          ped.retarget = random.range(2, 6);
          const road = random.pick(ROAD_Y.slice(0, -1));
          ped.targetX = random.range(200, WORLD.width - 200);
          ped.targetY = road + (random.next() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + 8);
        }
        const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
        if (d > 8) {
          const a = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
          ped.angle = a;
          ped.x += Math.cos(a) * ped.speed * dt;
          ped.y += Math.sin(a) * ped.speed * dt;
        }
      }
      ped.x = clamp(ped.x, 40, WORLD.width - 40);
      ped.y = clamp(ped.y, 40, BEACH.y + BEACH.height - 40);
      pushOutOfBuildings(ped, 10);
    }
    if (peds.length < PEDS.count && Math.random() < dt * 0.5) spawnPed();

    // ---- car vs car bumps (player car vs traffic) ----
    if (player.inCar) {
      for (const car of cars) {
        if (car === player.inCar || car.driver === 'player') continue;
        if (dist(car.x, car.y, player.inCar.x, player.inCar.y) < 56) {
          const push = Math.atan2(car.y - player.inCar.y, car.x - player.inCar.x);
          car.x += Math.cos(push) * 60 * dt;
          car.y += Math.sin(push) * 60 * dt;
          player.inCar.speed *= 1 - 1.4 * dt;
          player.inCar.health -= 6 * dt;
          if (Math.random() < dt * 3) events |= EVENT_CRASH;
        }
      }
    }

    // ---- pickups ----
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pk = pickups[i];
      pk.bob += dt * 3;
      if (dist(pk.x, pk.y, player.x, player.y) < 40) {
        if (pk.kind === 'cash') { state.cash += CASH.pickup; state.score += CASH.pickup; events |= EVENT_CASH; }
        else if (pk.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + 50); events |= EVENT_PICKUP; }
        else if (pk.kind === 'ammo') { state.ammo = Math.min(GUN.ammoMax, state.ammo + 24); events |= EVENT_PICKUP; }
        pickups.splice(i, 1);
      }
    }

    // ---- bullets and particles fade ----
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      bullets[i].life -= dt;
      if (bullets[i].life <= 0) bullets.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // ---- mission progress ----
    if (mission) {
      if (mission.type === 'timed' || mission.type === 'survive') {
        state.missionTimer -= dt;
        if (mission.type === 'timed' && state.missionTimer <= 0) {
          say('Too slow — the drop window closed. The mission resets.', 4);
          setMission(state.missionIndex, 0);
        }
        if (mission.type === 'survive' && state.missionTimer <= 0) {
          events |= completeMission();
        }
      }
      if (mission.type === 'lose-heat' && state.missionStage === 0 && state.wanted >= 3) {
        state.missionStage = 1;
        say('3 stars! Now disappear — stay out of sight until the heat dies.', 4);
      }
      if (mission.type === 'survive' && state.missionStage === 0) {
        state.missionStage = 1;
        state.wanted = WANTED.maxStars;
      }
      const target = state.missionTarget;
      if (target && dist(player.x, player.y, target.x, target.y) < 70) {
        if (mission.type === 'steal-deliver' && state.missionStage === 1 && player.inCar) {
          events |= completeMission();
        } else if (mission.type === 'fetch') {
          if (state.missionStage === 0) {
            state.missionStage = 1;
            state.missionTarget = missionTargetFor(mission, 1);
            say('Package grabbed. Now take it to the club, east side.', 4);
          } else {
            events |= completeMission();
          }
        } else if (mission.type === 'timed') {
          events |= completeMission();
        }
      }
    }

    // ---- death ----
    if (player.health <= 0) {
      state.wasted = true;
      spawnParticle(player.x, player.y, '#e5534b', 24, 260);
      return events | EVENT_WASTED;
    }
    return events;
  }

  reset();
  return { state, reset, step, setMission, completeMission, say, spawnCopCar, spawnTrafficCar, spawnPed };
}
