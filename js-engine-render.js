// Tank Tycoon (prototype 3) - js-engine-render.js (v0.0.2)
// Canvas Rendering Subsystem (Offscreen Tile Cache, Interpolated Camera, Combat FX)

import {
  CHUNK_TILES,
  TILE_SIZE,
  CHUNK_PIXEL_SIZE,
  TILE_GRASS,
  TILE_DIRT,
  TILE_SAND,
  TILE_WATER,
  TILE_BASE_CONCRETE,
  TILE_BASE_RESPAWN,
  getChunk,
  canPlaceBaseBlock
} from "./js-engine-world.js?v=0.0.2";

export const MODULE_VERSION = "v0.0.2";

// Render Constants & Tokens (md-spec-render.md §2)
export const CAMERA_ZOOM = 0.8;
export const VIEWPORT_BUFFER_CHUNKS = 1;
export const TRAJECTORY_LENGTH = 230;
export const CAMERA_LERP = 0.08;
export const CAMERA_LOOKAHEAD = 45;

export const PALETTE = Object.freeze({
  background: "#12171e",
  grass: "#475422",
  grassDeep: "#3e4a1c",
  dirt: "#635c49",
  sand: "#cbb185",
  sandWarm: "#d8be96",
  water: "#182633",
  waterDeep: "#111c27",
  playerHull: "#465866",
  playerTurret: "#5a6f7e",
  enemyHull: "#8a7b70",
  enemyTurret: "#9e8e82",
  hudCyan: "#00f0ff",
  vitalityGreen: "#2ec4b6",
  hazardAmber: "#ffb703",
  alertCrimson: "#e63946",
  ghostValid: "rgba(0, 240, 255, 0.45)",
  ghostInvalid: "rgba(230, 57, 70, 0.45)"
});

let canvasRef = null;
let ctx = null;
let viewportWidth = 1024;
let viewportHeight = 768;
let dpr = 1;
const tilePatternCanvases = new Map();

function buildOffscreenTileCache() {
  tilePatternCanvases.clear();
  if (typeof document === "undefined") return;

  const createTileCanvas = (drawFn) => {
    const off = document.createElement("canvas");
    off.width = TILE_SIZE;
    off.height = TILE_SIZE;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;
    drawFn(octx, TILE_SIZE);
    return off;
  };

  // 0: Grass (Muted military olive moss with subtle organic micro-stippling)
  tilePatternCanvases.set(
    TILE_GRASS,
    createTileCanvas((c, s) => {
      c.fillStyle = PALETTE.grass;
      c.fillRect(0, 0, s, s);
      c.fillStyle = PALETTE.grassDeep;
      c.fillRect(6, 8, 5, 4);
      c.fillRect(22, 18, 4, 5);
      c.fillRect(36, 10, 5, 3);
      c.fillRect(14, 34, 4, 4);
      c.fillRect(32, 38, 5, 4);
    })
  );

  // 1: Dirt (Desaturated basalt loam)
  tilePatternCanvases.set(
    TILE_DIRT,
    createTileCanvas((c, s) => {
      c.fillStyle = PALETTE.dirt;
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#534c3c";
      c.fillRect(10, 14, 6, 4);
      c.fillRect(28, 24, 5, 5);
      c.fillRect(18, 38, 4, 3);
    })
  );

  // 2: Sand / Beach (Contoured natural shore tan)
  tilePatternCanvases.set(
    TILE_SAND,
    createTileCanvas((c, s) => {
      c.fillStyle = PALETTE.sand;
      c.fillRect(0, 0, s, s);
      c.fillStyle = PALETTE.sandWarm;
      c.fillRect(8, 12, 7, 5);
      c.fillRect(26, 30, 8, 4);
      c.fillRect(34, 8, 5, 4);
    })
  );

  // 3: Water (Deep navy / dark pond slate)
  tilePatternCanvases.set(
    TILE_WATER,
    createTileCanvas((c, s) => {
      c.fillStyle = PALETTE.water;
      c.fillRect(0, 0, s, s);
      c.fillStyle = PALETTE.waterDeep;
      c.fillRect(10, 12, 14, 5);
      c.fillRect(24, 28, 16, 5);
    })
  );

  // 4: Base Concrete (Matte military reinforced carbon slab)
  tilePatternCanvases.set(
    TILE_BASE_CONCRETE,
    createTileCanvas((c, s) => {
      c.fillStyle = "#252b36";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#333b49";
      c.fillRect(2, 2, s - 4, s - 4);
      c.fillStyle = "#1e232c";
      c.fillRect(4, 4, 3, 3);
      c.fillRect(s - 7, 4, 3, 3);
      c.fillRect(4, s - 7, 3, 3);
      c.fillRect(s - 7, s - 7, 3, 3);
    })
  );

  // 5: Base Respawn Pad (Matte slab + vitality cross)
  tilePatternCanvases.set(
    TILE_BASE_RESPAWN,
    createTileCanvas((c, s) => {
      c.fillStyle = "#202630";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#2c3442";
      c.fillRect(2, 2, s - 4, s - 4);
      c.fillStyle = "#2ec4b6";
      c.fillRect(s / 2 - 3, 9, 6, s - 18);
      c.fillRect(9, s / 2 - 3, s - 18, 6);
      c.fillStyle = "#ffffff";
      c.fillRect(s / 2 - 1.5, 11, 3, s - 22);
      c.fillRect(11, s / 2 - 1.5, s - 22, 3);
    })
  );
}

export function resizeRenderer() {
  if (!canvasRef || !ctx) return;
  dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  viewportWidth = window.innerWidth || 1024;
  viewportHeight = window.innerHeight || 768;

  canvasRef.width = Math.floor(viewportWidth * dpr);
  canvasRef.height = Math.floor(viewportHeight * dpr);
  canvasRef.style.width = `${viewportWidth}px`;
  canvasRef.style.height = `${viewportHeight}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

export function initRenderer(canvasElement) {
  canvasRef = canvasElement;
  if (!canvasRef) return null;

  ctx = canvasRef.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;
  buildOffscreenTileCache();
  resizeRenderer();

  if (typeof window !== "undefined") {
    window.addEventListener("resize", resizeRenderer);
  }

  return {
    ctx,
    getViewport: () => ({ width: viewportWidth, height: viewportHeight, dpr })
  };
}

export function renderWorld(camera, chunks, worldState) {
  if (!ctx) return;

  const halfW = viewportWidth / 2;
  const halfH = viewportHeight / 2;
  const invZoom = 1 / CAMERA_ZOOM;
  const minWorldX = camera.x - halfW * invZoom;
  const maxWorldX = camera.x + halfW * invZoom;
  const minWorldY = camera.y - halfH * invZoom;
  const maxWorldY = camera.y + halfH * invZoom;

  const startChunkX =
    Math.floor(minWorldX / CHUNK_PIXEL_SIZE) - VIEWPORT_BUFFER_CHUNKS;
  const endChunkX =
    Math.floor(maxWorldX / CHUNK_PIXEL_SIZE) + VIEWPORT_BUFFER_CHUNKS;
  const startChunkY =
    Math.floor(minWorldY / CHUNK_PIXEL_SIZE) - VIEWPORT_BUFFER_CHUNKS;
  const endChunkY =
    Math.floor(maxWorldY / CHUNK_PIXEL_SIZE) + VIEWPORT_BUFFER_CHUNKS;

  const drawSize = Math.ceil(TILE_SIZE * CAMERA_ZOOM);

  for (let cy = startChunkY; cy <= endChunkY; cy++) {
    for (let cx = startChunkX; cx <= endChunkX; cx++) {
      const chunk = getChunk(cx, cy, worldState);
      const chunkOriginX = cx * CHUNK_PIXEL_SIZE;
      const chunkOriginY = cy * CHUNK_PIXEL_SIZE;

      for (let ty = 0; ty < CHUNK_TILES; ty++) {
        const worldY = chunkOriginY + ty * TILE_SIZE;
        const screenY = Math.floor((worldY - camera.y) * CAMERA_ZOOM + halfH);
        if (screenY + drawSize < 0 || screenY > viewportHeight) continue;

        for (let tx = 0; tx < CHUNK_TILES; tx++) {
          const worldX = chunkOriginX + tx * TILE_SIZE;
          const screenX = Math.floor((worldX - camera.x) * CAMERA_ZOOM + halfW);
          if (screenX + drawSize < 0 || screenX > viewportWidth) continue;

          const tileId = chunk.tiles[ty * CHUNK_TILES + tx];
          const patternCanvas =
            tilePatternCanvases.get(tileId) ||
            tilePatternCanvases.get(TILE_GRASS);
          if (patternCanvas) {
            ctx.drawImage(patternCanvas, screenX, screenY, drawSize, drawSize);
          }
        }
      }
    }
  }

  // Draw persistent Salvage Crates on the field
  const crates = worldState?.salvageCrates || [];
  for (const crate of crates) {
    const sx = Math.floor((crate.x - camera.x) * CAMERA_ZOOM + halfW);
    const sy = Math.floor((crate.y - camera.y) * CAMERA_ZOOM + halfH);
    if (sx < -48 || sx > viewportWidth + 48 || sy < -48 || sy > viewportHeight + 48) {
      continue;
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    ctx.fillStyle = "#1b222d";
    ctx.fillRect(-16, -16, 32, 32);
    ctx.strokeStyle = PALETTE.hazardAmber;
    ctx.lineWidth = 2;
    ctx.strokeRect(-16, -16, 32, 32);
    ctx.fillStyle = PALETTE.hazardAmber;
    ctx.fillRect(-10, -3, 20, 6);
    ctx.fillRect(-3, -10, 6, 20);
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SALVAGE", 0, -22);
    ctx.restore();
  }
}

function drawSingleTank(
  tank,
  camera,
  alpha,
  isPlayer = false
) {
  if (!ctx || !tank || tank.isDead) return;

  const halfW = viewportWidth / 2;
  const halfH = viewportHeight / 2;

  const interpX =
    (tank.prevX ?? tank.x) + (tank.x - (tank.prevX ?? tank.x)) * alpha;
  const interpY =
    (tank.prevY ?? tank.y) + (tank.y - (tank.prevY ?? tank.y)) * alpha;

  const screenX = Math.floor((interpX - camera.x) * CAMERA_ZOOM + halfW);
  const screenY = Math.floor((interpY - camera.y) * CAMERA_ZOOM + halfH);

  if (
    screenX < -80 ||
    screenX > viewportWidth + 80 ||
    screenY < -80 ||
    screenY > viewportHeight + 80
  ) {
    return;
  }

  const hullColor = isPlayer
    ? tank.chassisCustomization?.hullColor || PALETTE.playerHull
    : PALETTE.enemyHull;
  const turretColor = isPlayer
    ? tank.chassisCustomization?.turretColor || PALETTE.playerTurret
    : PALETTE.enemyTurret;

  // Soft elliptical drop-shadow beneath tank
  ctx.save();
  ctx.translate(screenX, screenY + 4 * CAMERA_ZOOM);
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 22 * CAMERA_ZOOM, 15 * CAMERA_ZOOM, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 1. Chassis & Treads
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.rotate(tank.chassisAngle || 0);

  // Treads (Deep matte carbon)
  ctx.fillStyle = "#14171c";
  ctx.fillRect(-22, -20, 44, 8);
  ctx.fillRect(-22, 12, 44, 8);

  // Tread links
  ctx.fillStyle = "#272c36";
  for (let gx = -18; gx <= 16; gx += 7) {
    ctx.fillRect(gx, -19, 3, 6);
    ctx.fillRect(gx, 13, 3, 6);
  }

  // Armored Hull
  ctx.fillStyle = hullColor;
  ctx.fillRect(-19, -13, 38, 26);
  ctx.strokeStyle = "#1b212b";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-19, -13, 38, 26);
  ctx.restore();

  // 2. Decoupled Turret Dome & Barrel
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.rotate(tank.turretAngle || 0);

  const recoilShift = -(tank.recoilOffset || 0);

  // Barrel
  ctx.fillStyle = "#333d49";
  ctx.fillRect(6 + recoilShift, -4, 25, 8);
  ctx.strokeStyle = "#1b212b";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(6 + recoilShift, -4, 25, 8);
  ctx.fillStyle = "#11161d";
  ctx.fillRect(29 + recoilShift, -3, 3, 6);

  // Turret Dome
  ctx.fillStyle = turretColor;
  ctx.beginPath();
  ctx.arc(recoilShift * 0.3, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#202833";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Subtle dome highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.beginPath();
  ctx.arc(recoilShift * 0.3 - 2, -2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Enemy overhead HP bar (Minimalist red bar matching screenshot)
  if (!isPlayer && tank.hp < tank.maxHp) {
    const barW = 34 * CAMERA_ZOOM;
    const barH = 4 * CAMERA_ZOOM;
    const pct = Math.max(0, Math.min(1, tank.hp / tank.maxHp));
    ctx.save();
    ctx.fillStyle = "rgba(18, 23, 30, 0.85)";
    ctx.fillRect(screenX - barW / 2, screenY - 28 * CAMERA_ZOOM, barW, barH);
    ctx.fillStyle = PALETTE.alertCrimson;
    ctx.fillRect(screenX - barW / 2, screenY - 28 * CAMERA_ZOOM, barW * pct, barH);
    ctx.restore();
  }
}

export function renderTanks(camera, player, enemies = [], alpha = 1) {
  for (let i = 0; i < enemies.length; i++) {
    drawSingleTank(enemies[i], camera, alpha, false);
  }
  if (player && !player.isDead) {
    drawSingleTank(player, camera, alpha, true);
  }
}

export function renderCombatFX(
  camera,
  projectiles = [],
  particles = [],
  player = null,
  pickups = [],
  floatingTexts = [],
  alpha = 1
) {
  if (!ctx) return;

  const halfW = viewportWidth / 2;
  const halfH = viewportHeight / 2;

  // 1. Thin white dashed trajectory guide matching screenshot reference
  if (player && !player.isDead) {
    const interpX =
      (player.prevX ?? player.x) + (player.x - (player.prevX ?? player.x)) * alpha;
    const interpY =
      (player.prevY ?? player.y) + (player.y - (player.prevY ?? player.y)) * alpha;
    const sx = Math.floor((interpX - camera.x) * CAMERA_ZOOM + halfW);
    const sy = Math.floor((interpY - camera.y) * CAMERA_ZOOM + halfH);
    const angle = player.turretAngle || 0;

    const muzzleDist = 32 * CAMERA_ZOOM;
    const trajDist = TRAJECTORY_LENGTH * CAMERA_ZOOM;
    const muzzleX = sx + Math.cos(angle) * muzzleDist;
    const muzzleY = sy + Math.sin(angle) * muzzleDist;
    const endX = muzzleX + Math.cos(angle) * trajDist;
    const endY = muzzleY + Math.sin(angle) * trajDist;

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(muzzleX, muzzleY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(endX, endY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Dropped Scrap & Cash Pickups (Screenshot glowing cash badge)
  for (const item of pickups) {
    const sx = Math.floor((item.x - camera.x) * CAMERA_ZOOM + halfW);
    const sy = Math.floor((item.y - camera.y) * CAMERA_ZOOM + halfH);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);

    if (item.type === "cash") {
      ctx.fillStyle = "rgba(46, 196, 182, 0.22)";
      ctx.fillRect(-18, -12, 36, 24);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(-14, -8, 28, 16);
      ctx.fillStyle = "#0f391b";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`$${item.quantity || 1}`, 0, 0);
    } else if (item.type === "hp_orb") {
      ctx.fillStyle = PALETTE.vitalityGreen;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      const colorMap = {
        steel: "#00f0ff",
        copper: "#ffb703",
        aluminum: "#cbd5e1"
      };
      ctx.fillStyle = colorMap[item.type] || "#00f0ff";
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeStyle = "#12171e";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-6, -6, 12, 12);
    }
    ctx.restore();
  }

  // 3. Projectiles
  for (const proj of projectiles) {
    const px =
      (proj.prevX ?? proj.x) + (proj.x - (proj.prevX ?? proj.x)) * alpha;
    const py =
      (proj.prevY ?? proj.y) + (proj.y - (proj.prevY ?? proj.y)) * alpha;
    const sx = Math.floor((px - camera.x) * CAMERA_ZOOM + halfW);
    const sy = Math.floor((py - camera.y) * CAMERA_ZOOM + halfH);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    ctx.rotate(proj.angle || 0);
    ctx.fillStyle = proj.fromEnemy ? PALETTE.alertCrimson : "#e2e8f0";
    ctx.fillRect(-6, -2, 12, 4);
    ctx.restore();
  }

  // 4. Muzzle Sparks & Shell Casings
  for (const pt of particles) {
    const sx = Math.floor((pt.x - camera.x) * CAMERA_ZOOM + halfW);
    const sy = Math.floor((pt.y - camera.y) * CAMERA_ZOOM + halfH);
    const ratio = Math.max(0, pt.life / (pt.maxLife || 0.2));

    ctx.save();
    ctx.globalAlpha = ratio;
    ctx.translate(sx, sy);
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    if (pt.kind === "casing") {
      ctx.rotate(pt.rotation || 0);
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(-3.5, -1.5, 7, 3);
    } else {
      ctx.fillStyle = pt.color || PALETTE.hazardAmber;
      ctx.fillRect(-2, -2, 4, 4);
    }
    ctx.restore();
  }

  // 5. Rising Floating Text
  for (const ft of floatingTexts) {
    const sx = Math.floor((ft.x - camera.x) * CAMERA_ZOOM + halfW);
    const sy = Math.floor((ft.y - camera.y) * CAMERA_ZOOM + halfH);
    const ratio = Math.max(0, ft.life / (ft.maxLife || 1));

    ctx.save();
    ctx.globalAlpha = ratio;
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#000000";
    ctx.fillText(ft.text, sx + 1, sy + 1);
    ctx.fillStyle = ft.color || PALETTE.hudCyan;
    ctx.fillText(ft.text, sx, sy);
    ctx.restore();
  }
}

export function renderPlacementGhost(camera, placementState, worldState) {
  if (!ctx || !placementState || !placementState.active) return;

  const halfW = viewportWidth / 2;
  const halfH = viewportHeight / 2;
  const gx = placementState.gridOriginX;
  const gy = placementState.gridOriginY;
  const valid = canPlaceBaseBlock(gx, gy, worldState);
  placementState.isValid = valid;

  const worldX = gx * TILE_SIZE;
  const worldY = gy * TILE_SIZE;
  const span = Math.ceil(TILE_SIZE * 2 * CAMERA_ZOOM);
  const sx = Math.floor((worldX - camera.x) * CAMERA_ZOOM + halfW);
  const sy = Math.floor((worldY - camera.y) * CAMERA_ZOOM + halfH);

  ctx.save();
  ctx.fillStyle = valid ? PALETTE.ghostValid : PALETTE.ghostInvalid;
  ctx.fillRect(sx, sy, span, span);

  ctx.strokeStyle = valid ? PALETTE.hudCyan : PALETTE.alertCrimson;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(sx, sy, span, span);

  if (!valid) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + span, sy + span);
    ctx.moveTo(sx + span, sy);
    ctx.lineTo(sx, sy + span);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderBaseInteractCue(camera, player, baseBlocks = []) {
  if (!ctx || !player || player.isDead || !Array.isArray(baseBlocks)) return;

  const halfW = viewportWidth / 2;
  const halfH = viewportHeight / 2;
  const pulse = 0.65 + 0.35 * Math.sin( performance.now() * 0.006 );

  for (const block of baseBlocks) {
    const inBlock =
      Math.abs(player.x - block.worldX) <= TILE_SIZE &&
      Math.abs(player.y - block.worldY) <= TILE_SIZE;
    if (!inBlock) continue;

    const sx = Math.floor((block.worldX - camera.x) * CAMERA_ZOOM + halfW);
    const sy = Math.floor((block.worldY - 32 - camera.y) * CAMERA_ZOOM + halfH);

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.translate(sx, sy);
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    ctx.fillStyle = "#161b24";
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.vitalityGreen;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-2, -7, 4, 14);
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }
}

export function renderFrame(renderState, alpha = 1) {
  if (!ctx || !renderState) return;

  const player = renderState.player;
  const camera = renderState.camera;

  if (player && camera) {
    const interpX =
      (player.prevX ?? player.x) + (player.x - (player.prevX ?? player.x)) * alpha;
    const interpY =
      (player.prevY ?? player.y) + (player.y - (player.prevY ?? player.y)) * alpha;

    const speed = Math.hypot(player.vx || 0, player.vy || 0);
    const leadX =
      speed > 5 ? (player.vx / speed) * CAMERA_LOOKAHEAD : 0;
    const leadY =
      speed > 5 ? (player.vy / speed) * CAMERA_LOOKAHEAD : 0;

    const targetCamX = interpX + leadX;
    const targetCamY = interpY + leadY;

    camera.x += (targetCamX - camera.x) * CAMERA_LERP;
    camera.y += (targetCamY - camera.y) * CAMERA_LERP;
  }

  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  renderWorld(camera, renderState.world?.chunks, renderState.world);
  renderPlacementGhost(camera, renderState.placementState, renderState.world);
  renderTanks(camera, player, renderState.enemies, alpha);
  renderCombatFX(
    camera,
    renderState.projectiles,
    renderState.particles,
    player,
    renderState.pickups,
    renderState.floatingTexts,
    alpha
  );
  renderBaseInteractCue(camera, player, renderState.baseBlocks);
}
