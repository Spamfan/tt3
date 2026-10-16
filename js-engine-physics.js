// Tank Tycoon (prototype 3) - js-engine-physics.js (v0.0.3)
// Physics & Kinematics Subsystem (Fixed 60Hz Step, Swept AABB, Projectiles, Magnetism)

import {
  getTileAtWorldPos,
  calculateEnemyLoot,
  getChunk
} from "./js-engine-world.js?v=0.0.1";
import {
  CANNON_DAMAGE,
  ENEMY_CANNON_DAMAGE,
  FIRE_RATE,
  ENEMY_FIRE_RATE,
  AGGRO_RADIUS,
  ENEMY_MOVE_SPEED,
  modifyHealth,
  addInventory
} from "./js-state-player.js?v=0.0.1";

export const MODULE_VERSION = "v0.0.2";

// Clock & Integration Constants (md-spec-physics.md §2)
export const FIXED_STEP = 1 / 60;
export const MAX_ACCUMULATOR = 0.1;
export const CHASSIS_ACCEL = 480.0;
export const CHASSIS_DRAG = 0.88;
export const CHASSIS_TURN_SPEED = 3.6;
export const TURRET_TURN_SPEED = 8.0;
export const RECOIL_FORCE = 120.0;
export const PROJECTILE_SPEED = 620.0;
export const PROJECTILE_MAX_RANGE = 960.0;
export const MAGNET_RADIUS = 120.0;
export const MAGNET_ACCEL = 750.0;

function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerpAngle(current, target, maxStep) {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return normalizeAngle(current + Math.sign(diff) * maxStep);
}

export function resolveTankKinematics(tank, moveVector, currentTileSpeed, dt) {
  if (!tank) return;

  tank.prevX = tank.x;
  tank.prevY = tank.y;

  const speedScalar = Number.isFinite(currentTileSpeed) ? currentTileSpeed : 1.0;
  const mvX = Number(moveVector?.x ?? 0);
  const mvY = Number(moveVector?.y ?? 0);
  const mag = Math.hypot(mvX, mvY);

  let normX = 0;
  let normY = 0;
  if (mag > 0.001) {
    normX = mvX / Math.max(1, mag);
    normY = mvY / Math.max(1, mag);

    const accel = tank.isEnemy
      ? (tank.moveSpeed || ENEMY_MOVE_SPEED) * 4.0 * speedScalar
      : CHASSIS_ACCEL * speedScalar;

    tank.vx += normX * accel * dt;
    tank.vy += normY * accel * dt;

    const targetHeading = Math.atan2(normY, normX);
    tank.chassisAngle = lerpAngle(
      tank.chassisAngle,
      targetHeading,
      CHASSIS_TURN_SPEED * dt
    );
  }

  // Per-tick damping
  const tickScale = dt / FIXED_STEP;
  const dragFactor = Math.pow(CHASSIS_DRAG, tickScale);
  tank.vx *= dragFactor;
  tank.vy *= dragFactor;

  // Clamp top speed according to terrain speed multiplier
  const maxSpeed = (tank.isEnemy ? ENEMY_MOVE_SPEED : 260) * speedScalar;
  const currentSpeed = Math.hypot(tank.vx, tank.vy);
  if (currentSpeed > maxSpeed) {
    tank.vx = (tank.vx / currentSpeed) * maxSpeed;
    tank.vy = (tank.vy / currentSpeed) * maxSpeed;
  }

  if (Math.abs(tank.vx) < 0.5) tank.vx = 0;
  if (Math.abs(tank.vy) < 0.5) tank.vy = 0;

  tank.x += tank.vx * dt;
  tank.y += tank.vy * dt;

  // Independent turret rotation lerp
  if (typeof tank.targetTurretAngle === "number") {
    tank.turretAngle = lerpAngle(
      tank.turretAngle,
      tank.targetTurretAngle,
      TURRET_TURN_SPEED * dt
    );
  }

  // Decay visual barrel recoil offset
  if (tank.recoilOffset > 0) {
    tank.recoilOffset = Math.max(0, tank.recoilOffset - 36 * dt);
  }
}

export function checkSweptAABB(boxA, boxB, velocity) {
  const vx = Number(velocity?.vx ?? 0);
  const vy = Number(velocity?.vy ?? 0);

  let xInvEntry;
  let yInvEntry;
  let xInvExit;
  let yInvExit;

  if (vx > 0) {
    xInvEntry = boxB.x - (boxA.x + boxA.w);
    xInvExit = boxB.x + boxB.w - boxA.x;
  } else {
    xInvEntry = boxB.x + boxB.w - boxA.x;
    xInvExit = boxB.x - (boxA.x + boxA.w);
  }

  if (vy > 0) {
    yInvEntry = boxB.y - (boxA.y + boxA.h);
    yInvExit = boxB.y + boxB.h - boxA.y;
  } else {
    yInvEntry = boxB.y + boxB.h - boxA.y;
    yInvExit = boxB.y - (boxA.y + boxA.h);
  }

  let xEntry = vx === 0 ? -Infinity : xInvEntry / vx;
  let yEntry = vy === 0 ? -Infinity : yInvEntry / vy;
  let xExit = vx === 0 ? Infinity : xInvExit / vx;
  let yExit = vy === 0 ? Infinity : yInvExit / vy;

  const entryTime = Math.max(xEntry, yEntry);
  const exitTime = Math.min(xExit, yExit);

  if (
    entryTime > exitTime ||
    (xEntry < 0 && yEntry < 0) ||
    xEntry > 1 ||
    yEntry > 1
  ) {
    return { hit: false, time: 1, normalX: 0, normalY: 0 };
  }

  let normalX = 0;
  let normalY = 0;
  if (xEntry > yEntry) {
    normalX = xInvEntry < 0 ? 1 : -1;
  } else {
    normalY = yInvEntry < 0 ? 1 : -1;
  }

  return { hit: true, time: Math.max(0, entryTime), normalX, normalY };
}

export function applyRecoil(tank, turretAngle, kickForce = RECOIL_FORCE) {
  if (!tank) return;
  tank.vx -= Math.cos(turretAngle) * kickForce;
  tank.vy -= Math.sin(turretAngle) * kickForce;
  tank.recoilOffset = 8.0;
}

function spawnCannonProjectile(owner, gameState) {
  const muzzleDist = 30;
  const angle = owner.turretAngle;
  const startX = owner.x + Math.cos(angle) * muzzleDist;
  const startY = owner.y + Math.sin(angle) * muzzleDist;

  gameState.projectiles.push({
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    x: startX,
    y: startY,
    prevX: startX,
    prevY: startY,
    vx: Math.cos(angle) * PROJECTILE_SPEED,
    vy: Math.sin(angle) * PROJECTILE_SPEED,
    angle,
    distanceTraveled: 0,
    maxRange: PROJECTILE_MAX_RANGE,
    damage: owner.isEnemy ? ENEMY_CANNON_DAMAGE : CANNON_DAMAGE,
    fromEnemy: Boolean(owner.isEnemy)
  });

  // Spawn muzzle sparks & brass casing (md-spec-render.md §3)
  if (Array.isArray(gameState.particles)) {
    for (let i = 0; i < 5; i++) {
      const spread = angle + (Math.random() - 0.5) * 0.7;
      const spd = 90 + Math.random() * 140;
      gameState.particles.push({
        kind: "spark",
        x: startX,
        y: startY,
        vx: Math.cos(spread) * spd,
        vy: Math.sin(spread) * spd,
        life: 0.16,
        maxLife: 0.16,
        color: owner.isEnemy ? "#e63946" : "#ffb703"
      });
    }

    const ejectAngle = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.35;
    const ejectSpeed = 55 + Math.random() * 35;
    gameState.particles.push({
      kind: "casing",
      x: owner.x + Math.cos(angle) * 6,
      y: owner.y + Math.sin(angle) * 6,
      vx: Math.cos(ejectAngle) * ejectSpeed,
      vy: Math.sin(ejectAngle) * ejectSpeed,
      rotation: angle,
      spin: (Math.random() - 0.5) * 14,
      life: 0.55,
      maxLife: 0.55
    });
  }

  applyRecoil(owner, angle, owner.isEnemy ? RECOIL_FORCE * 0.45 : RECOIL_FORCE);
}

export function updateProjectiles(projectiles, entities, world, dt, gameState = null) {
  if (!Array.isArray(projectiles)) return;

  const player = entities?.player;
  const enemies = Array.isArray(entities?.enemies) ? entities.enemies : [];

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.prevX = p.x;
    p.prevY = p.y;

    const stepX = p.vx * dt;
    const stepY = p.vy * dt;
    p.x += stepX;
    p.y += stepY;
    p.distanceTraveled += Math.hypot(stepX, stepY);

    let hitSomething = false;

    if (p.fromEnemy) {
      if (player && !player.isDead) {
        const hitRadius = (player.radius || 24) + 5;
        const boxPlayer = {
          x: player.x - hitRadius,
          y: player.y - hitRadius,
          w: hitRadius * 2,
          h: hitRadius * 2
        };
        const boxProj = { x: p.prevX - 3, y: p.prevY - 3, w: 6, h: 6 };
        const swept = checkSweptAABB(boxProj, boxPlayer, { vx: stepX, vy: stepY });
        const distSq = (p.x - player.x) ** 2 + (p.y - player.y) ** 2;

        if (swept.hit || distSq <= hitRadius * hitRadius) {
          hitSomething = true;
          if (gameState?.floatingTexts) {
            gameState.floatingTexts.push({
              text: `-${p.damage} HP`,
              x: player.x,
              y: player.y - 24,
              vy: -38,
              life: 0.9,
              maxLife: 0.9,
              color: "#e63946"
            });
          }
          modifyHealth(player, -p.damage, {
            bases: gameState?.baseBlocks || world?.baseBlocks || [],
            world,
            eventBus: gameState?.eventBus || null
          });
          if (gameState?.onImmediateSave) {
            gameState.onImmediateSave();
          }
        }
      }
    } else {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const foe = enemies[j];
        const hitRadius = (foe.radius || 24) + 5;
        const boxFoe = {
          x: foe.x - hitRadius,
          y: foe.y - hitRadius,
          w: hitRadius * 2,
          h: hitRadius * 2
        };
        const boxProj = { x: p.prevX - 3, y: p.prevY - 3, w: 6, h: 6 };
        const swept = checkSweptAABB(boxProj, boxFoe, { vx: stepX, vy: stepY });
        const distSq = (p.x - foe.x) ** 2 + (p.y - foe.y) ** 2;

        if (swept.hit || distSq <= hitRadius * hitRadius) {
          hitSomething = true;
          foe.hp -= p.damage;

          if (gameState?.floatingTexts) {
            gameState.floatingTexts.push({
              text: `-${p.damage} HP`,
              x: foe.x,
              y: foe.y - 24,
              vy: -38,
              life: 0.85,
              maxLife: 0.85,
              color: "#ffb703"
            });
          }

          if (foe.hp <= 0) {
            const drops = calculateEnemyLoot(foe, player ? player.hp : 100);
            if (Array.isArray(gameState?.pickups)) {
              drops.forEach((drop, idx) => {
                const angle = (idx / Math.max(1, drops.length)) * Math.PI * 2 + Math.random() * 0.5;
                const offset = 14 + Math.random() * 14;
                gameState.pickups.push({
                  id: `drop_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
                  type: drop.type,
                  label: drop.label,
                  quantity: drop.quantity,
                  x: foe.x + Math.cos(angle) * offset,
                  y: foe.y + Math.sin(angle) * offset,
                  vx: Math.cos(angle) * 45,
                  vy: Math.sin(angle) * 45
                });
              });
            }
            const deadChunkKey = foe.chunkKey;
            enemies.splice(j, 1);
            if (deadChunkKey && !enemies.some((e) => e.chunkKey === deadChunkKey)) {
              const [cx, cy] = deadChunkKey.split(",").map(Number);
              const activeWorld = world || gameState?.world;
              const chunk = getChunk(cx, cy, activeWorld);
              if (chunk) {
                chunk.clearedEnemies = true;
                chunk.modified = true;
              }
            }
          }
          break;
        }
      }
    }

    if (hitSomething || p.distanceTraveled >= p.maxRange) {
      projectiles.splice(i, 1);
    }
  }
}

export function updateScrapMagnetism(player, pickups, dt, gameState = null) {
  if (!player || player.isDead || !Array.isArray(pickups)) return;

  for (let i = pickups.length - 1; i >= 0; i--) {
    const item = pickups[i];
    const dx = player.x - item.x;
    const dy = player.y - item.y;
    const dist = Math.hypot(dx, dy);

    if (dist < MAGNET_RADIUS && dist > 0.001) {
      const normX = dx / dist;
      const normY = dy / dist;
      item.vx = ((item.vx || 0) + normX * MAGNET_ACCEL * dt) * 0.94;
      item.vy = ((item.vy || 0) + normY * MAGNET_ACCEL * dt) * 0.94;
    } else {
      item.vx = (item.vx || 0) * 0.9;
      item.vy = (item.vy || 0) * 0.9;
    }

    item.x += (item.vx || 0) * dt;
    item.y += (item.vy || 0) * dt;

    if (dist <= 28) {
      addInventory(player, item.type, item.quantity, gameState?.eventBus || null);
      if (gameState?.floatingTexts) {
        const colorMap = {
          hp_orb: "#2ec4b6",
          cash: "#2ec4b6",
          steel: "#00f0ff",
          copper: "#ffb703",
          aluminum: "#e2e8f0"
        };
        gameState.floatingTexts.push({
          text: item.label || `+${item.quantity} ${String(item.type).toUpperCase()}`,
          x: player.x,
          y: player.y - 28,
          vy: -42,
          life: 1.0,
          maxLife: 1.0,
          color: colorMap[item.type] || "#00f0ff"
        });
      }
      pickups.splice(i, 1);
    }
  }
}

function updateSalvageCrateCollection(player, gameState) {
  if (!player || player.isDead || !Array.isArray(gameState?.salvageCrates)) return;

  for (let i = gameState.salvageCrates.length - 1; i >= 0; i--) {
    const crate = gameState.salvageCrates[i];
    const dist = Math.hypot(player.x - crate.x, player.y - crate.y);
    if (dist <= 40) {
      if (crate.steel > 0) addInventory(player, "steel", crate.steel, gameState.eventBus);
      if (crate.copper > 0) addInventory(player, "copper", crate.copper, gameState.eventBus);
      if (crate.aluminum > 0) addInventory(player, "aluminum", crate.aluminum, gameState.eventBus);
      if (crate.cash > 0) addInventory(player, "cash", crate.cash, gameState.eventBus);

      if (gameState.floatingTexts) {
        gameState.floatingTexts.push({
          text: "SALVAGE RECOVERED",
          x: player.x,
          y: player.y - 34,
          vy: -40,
          life: 1.2,
          maxLife: 1.2,
          color: "#00f0ff"
        });
      }
      gameState.salvageCrates.splice(i, 1);
      if (gameState.onImmediateSave) {
        gameState.onImmediateSave();
      }
    }
  }
}

function resolveTankSeparation(player, enemies) {
  const all = [player, ...enemies].filter((t) => t && !t.isDead);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = (a.radius || 24) + (b.radius || 24);
      if (dist > 0.001 && dist < minDist) {
        const overlap = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
      }
    }
  }
}

export function stepSinglePhysicsTick(dt, gameState) {
  if (!gameState || gameState.isPaused) return;
  const player = gameState.player;
  const world = gameState.world;
  const enemies = gameState.enemies || [];

  if (player && !player.isDead) {
    const tileInfo = getTileAtWorldPos(player.x, player.y, world);
    player.targetTurretAngle =
      typeof gameState.input?.aimAngle === "number"
        ? gameState.input.aimAngle
        : player.turretAngle;

    resolveTankKinematics(
      player,
      gameState.input?.moveVector || { x: 0, y: 0 },
      tileInfo.speedMultiplier,
      dt
    );

    if (player.fireCooldown > 0) {
      player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    }

    if (gameState.input?.isFiring && !gameState.placementState?.active) {
      if (player.fireCooldown <= 0) {
        spawnCannonProjectile(player, gameState);
        player.fireCooldown = 1 / FIRE_RATE;
      }
    }
  }

  // Update Enemy AI & Kinematics
  for (let i = 0; i < enemies.length; i++) {
    const foe = enemies[i];
    const dx = player ? player.x - foe.x : 0;
    const dy = player ? player.y - foe.y : 0;
    const dist = Math.hypot(dx, dy);
    const tileInfo = getTileAtWorldPos(foe.x, foe.y, world);

    let moveVec = { x: 0, y: 0 };
    if (player && !player.isDead && dist <= (foe.aggroRadius || AGGRO_RADIUS)) {
      foe.targetTurretAngle = Math.atan2(dy, dx);
      if (dist > 110) {
        moveVec = { x: dx / dist, y: dy / dist };
      }
      if (foe.fireCooldown > 0) {
        foe.fireCooldown = Math.max(0, foe.fireCooldown - dt);
      }
      if (foe.fireCooldown <= 0) {
        spawnCannonProjectile(foe, gameState);
        foe.fireCooldown = 1 / ENEMY_FIRE_RATE;
      }
    } else {
      foe.fireCooldown = Math.max(0.25, (foe.fireCooldown || 0) - dt);
    }

    resolveTankKinematics(foe, moveVec, tileInfo.speedMultiplier, dt);
  }

  resolveTankSeparation(player, enemies);

  updateProjectiles(
    gameState.projectiles,
    { player, enemies },
    world,
    dt,
    gameState
  );

  updateScrapMagnetism(player, gameState.pickups, dt, gameState);
  updateSalvageCrateCollection(player, gameState);

  // Advance short-lived particles & floating text
  if (Array.isArray(gameState.particles)) {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
      const pt = gameState.particles[i];
      pt.x += (pt.vx || 0) * dt;
      pt.y += (pt.vy || 0) * dt;
      if (pt.kind === "casing") {
        pt.vx *= 0.92;
        pt.vy *= 0.92;
        pt.rotation += (pt.spin || 0) * dt;
      }
      pt.life -= dt;
      if (pt.life <= 0) {
        gameState.particles.splice(i, 1);
      }
    }
  }

  if (Array.isArray(gameState.floatingTexts)) {
    for (let i = gameState.floatingTexts.length - 1; i >= 0; i--) {
      const ft = gameState.floatingTexts[i];
      ft.y += (ft.vy || -36) * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        gameState.floatingTexts.splice(i, 1);
      }
    }
  }
}

export function updatePhysics(dt, gameState) {
  if (!gameState || gameState.isPaused) return 0;

  if (typeof gameState.accumulator !== "number") {
    gameState.accumulator = 0;
  }

  const clampedDt = Math.min(Math.max(0, Number(dt) || 0), MAX_ACCUMULATOR);
  gameState.accumulator = Math.min(
    MAX_ACCUMULATOR,
    gameState.accumulator + clampedDt
  );

  while (gameState.accumulator >= FIXED_STEP) {
    stepSinglePhysicsTick(FIXED_STEP, gameState);
    gameState.accumulator -= FIXED_STEP;
  }

  return gameState.accumulator / FIXED_STEP;
}
