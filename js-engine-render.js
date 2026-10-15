// Tank Tycoon (prototype 3) - js-engine-render.js (v0.0.1)
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
} from "./js-engine-world.js?v=0.0.1";

export const MODULE_VERSION = "v0.0.1";

// Render Constants & Tokens (md-spec-render.md §2)
export const VIEWPORT_BUFFER_CHUNKS = 1;
export const TRAJECTORY_LENGTH = 192;
export const CAMERA_LERP = 0.08;
export const CAMERA_LOOKAHEAD = 45;

export const PALETTE = Object.freeze({
  background: "#0b0e14",
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

  // 0: Grass
  tilePatternCanvases.set(
    TILE_GRASS,
    createTileCanvas((c, s) => {
      c.fillStyle = "#2d8a00";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#38b000";
      c.fillRect(2, 2, s - 4, s - 4);
      c.fillStyle = "#70e000";
      c.fillRect(8, 10, 4, 4);
      c.fillRect(28, 30, 4, 4);
      c.strokeStyle = "rgba(11, 14, 20, 0.14)";
      c.strokeRect(0.5, 0.5, s - 1, s - 1);
    })
  );

  // 1: Dirt
  tilePatternCanvases.set(
    TILE_DIRT,
    createTileCanvas((c, s) => {
      c.fillStyle = "#9c7a44";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#b79257";
      c.fillRect(2, 2, s - 4, s - 4);
      c.fillStyle = "#846332";
      c.fillRect(12, 14, 5, 5);
      c.fillRect(30, 26, 6, 4);
      c.strokeStyle = "rgba(11, 14, 20, 0.16)";
      c.strokeRect(0.5, 0.5, s - 1, s - 1);
    })
  );

  // 2: Sand / Gravel
  tilePatternCanvases.set(
    TILE_SAND,
    createTileCanvas((c, s) => {
      c.fillStyle = "#d4c18a";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#e9d8a6";
      c.fillRect(2, 2, s - 4, s - 4);
      c.fillStyle = "#bca66b";
      c.fillRect(10, 20, 3, 3);
      c.fillRect(32, 12, 4, 3);
      c.strokeStyle = "rgba(11, 14, 20, 0.14)";
      c.strokeRect(0.5, 0.5, s - 1, s - 1);
    })
  );

  // 3: Water
  tilePatternCanvases.set(
    TILE_WATER,
    createTileCanvas((c, s) => {
      c.fillStyle = "#005f92";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#0077b6";
      c.fillRect(2, 2, s - 4, s - 4);
      c.fillStyle = "rgba(0, 240, 255, 0.25)";
      c.fillRect(8, 14, 14, 3);
      c.fillRect(22, 32, 16, 3);
      c.strokeStyle = "rgba(0, 240, 255, 0.18)";
      c.strokeRect(0.5, 0.5, s - 1, s - 1);
    })
  );

  // 4: Base Concrete
  tilePatternCanvases.set(
    TILE_BASE_CONCRETE,
    createTileCanvas((c, s) => {
      c.fillStyle = "#2d3748";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#4a5568";
      c.fillRect(3, 3, s - 6, s - 6);
      c.strokeStyle = "#00f0ff";
      c.lineWidth = 1;
      c.strokeRect(1.5, 1.5, s - 3, s - 3);
      c.fillStyle = "#718096";
      c.fillRect(6, 6, 4, 4);
      c.fillRect(s - 10, 6, 4, 4);
      c.fillRect(6, s - 10, 4, 4);
      c.fillRect(s - 10, s - 10, 4, 4);
    })
  );

  // 5: Base Respawn Pad (Concrete + White/Green Plus Pad)
  tilePatternCanvases.set(
    TILE_BASE_RESPAWN,
    createTileCanvas((c, s) => {
      c.fillStyle = "#1e293b";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#334155";
      c.fillRect(3, 3, s - 6, s - 6);
      c.strokeStyle = "#2ec4b6";
      c.lineWidth = 2;
      c.strokeRect(2, 2, s - 4, s - 4);
      // White/green medical/respawn plus emblem
      c.fillStyle = "#2ec4b6";
      c.fillRect(s / 2 - 4, 10, 8, s - 20);
      c.fillRect(10, s / 2 - 4, s - 20, 8);
      c.fillStyle = "#ffffff";
      c.fillRect(s / 2 - 2, 13, 4, s - 26);
      c.fillRect(13, s / 2 - 2, s - 26, 4);
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
  const minWorldX = camera.x - halfW;
  const maxWorldX = camera.x + halfW;
  const minWorldY = camera.y - halfH;
  const maxWorldY = camera.y + halfH;

  const startChunkX =
    Math.floor(minWorldX / CHUNK_PIXEL_SIZE) - VIEWPORT_BUFFER_CHUNKS;
  const endChunkX =
    Math.floor(maxWorldX / CHUNK_PIXEL_SIZE) + VIEWPORT_BUFFER_CHUNKS;
  const startChunkY =
    Math.floor(minWorldY / CHUNK_PIXEL_SIZE) - VIEWPORT_BUFFER_CHUNKS;
  const endChunkY =
    Math.floor(maxWorldY / CHUNK_PIXEL_SIZE) + VIEWPORT_BUFFER_CHUNKS;

  for (let cy = startChunkY; cy <= endChunkY; cy++) {
    for (let cx = startChunkX; cx <= endChunkX; cx++) {
      const chunk = getChunk(cx, cy, worldState);
      const chunkOriginX = cx * CHUNK_PIXEL_SIZE;
      const chunkOriginY = cy * CHUNK_PIXEL_SIZE;

      for (let ty = 0; ty < CHUNK_TILES; ty++) {
        const worldY = chunkOriginY + ty * TILE_SIZE;
        const screenY = Math.floor(worldY - camera.y + halfH);
        if (screenY + TILE_SIZE < 0 || screenY > viewportHeight) continue;

        for (let tx = 0; tx < CHUNK_TILES; tx++) {
          const worldX = chunkOriginX + tx * TILE_SIZE;
          const screenX = Math.floor(worldX - camera.x + halfW);
          if (screenX + TILE_SIZE < 0 || screenX > viewportWidth) continue;

          const tileId = chunk.tiles[ty * CHUNK_TILES + tx];
          const patternCanvas =
            tilePatternCanvases.get(tileId) ||
            tilePatternCanvases.get(TILE_GRASS);
          if (patternCanvas) {
            ctx.drawImage(patternCanvas, screenX, screenY);
          }
        }
      }
    }
  }

  // Draw persistent Salvage Crates on the field
  const crates = worldState?.salvageCrates || [];
  for (const crate of crates) {
    const sx = crate.x - camera.x + halfW;
    const sy = crate.y - camera.y + halfH;
    if (sx < -48 || sx > viewportWidth + 48 || sy < -48 || sy > viewportHeight + 48) {
      continue;
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = "#161b24";
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

  const screenX = interpX - camera.x + halfW;
  const screenY = interpY - camera.y + halfH;

  if (
    screenX < -64 ||
    screenX > viewportWidth + 64 ||
    screenY < -64 ||
    screenY > viewportHeight + 64
  ) {
    return;
  }

  const hullColor = isPlayer
    ? tank.chassisCustomization?.hullColor || "#1b4332"
    : "#4a151b";
  const trimColor = isPlayer
    ? tank.chassisCustomization?.trimColor || PALETTE.hudCyan
    : PALETTE.alertCrimson;
  const turretColor = isPlayer
    ? tank.chassisCustomization?.turretColor || "#2d6a4f"
    : "#7f1d1d";

  // 1. Chassis & Treads
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(tank.chassisAngle || 0);

  // Left & Right Treads
  ctx.fillStyle = "#0b0e14";
  ctx.fillRect(-22, -20, 44, 8);
  ctx.fillRect(-22, 12, 44, 8);

  // Tread grousers
  ctx.fillStyle = "#334155";
  for (let gx = -18; gx <= 16; gx += 7) {
    ctx.fillRect(gx, -19, 3, 6);
    ctx.fillRect(gx, 13, 3, 6);
  }

  // Main Armored Hull
  ctx.fillStyle = hullColor;
  ctx.fillRect(-19, -13, 38, 26);
  ctx.strokeStyle = trimColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(-19, -13, 38, 26);

  // Forward Hull Chevron
  ctx.fillStyle = trimColor;
  ctx.fillRect(11, -6, 4, 12);
  ctx.restore();

  // 2. Decoupled Turret & Barrel with Recoil Offset
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(tank.turretAngle || 0);

  const recoilShift = -(tank.recoilOffset || 0);

  // Cannon Barrel
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(6 + recoilShift, -4, 24, 8);
  ctx.strokeStyle = "#0b0e14";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(6 + recoilShift, -4, 24, 8);

  // Muzzle Brake
  ctx.fillStyle = trimColor;
  ctx.fillRect(26 + recoilShift, -5, 5, 10);

  // Turret Dome
  ctx.fillStyle = turretColor;
  ctx.beginPath();
  ctx.arc(recoilShift * 0.35, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = trimColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Enemy overhead HP bar
  if (!isPlayer && tank.hp < tank.maxHp) {
    const barW = 38;
    const barH = 5;
    const pct = Math.max(0, Math.min(1, tank.hp / tank.maxHp));
    ctx.save();
    ctx.fillStyle = "rgba(11, 14, 20, 0.85)";
    ctx.fillRect(screenX - barW / 2, screenY - 32, barW, barH);
    ctx.fillStyle = PALETTE.alertCrimson;
    ctx.fillRect(screenX - barW / 2 + 1, screenY - 31, (barW - 2) * pct, barH - 2);
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

  // 1. Trajectory Guide from Player Muzzle (TRAJECTORY_LENGTH = 192px)
  if (player && !player.isDead) {
    const interpX =
      (player.prevX ?? player.x) + (player.x - (player.prevX ?? player.x)) * alpha;
    const interpY =
      (player.prevY ?? player.y) + (player.y - (player.prevY ?? player.y)) * alpha;
    const sx = interpX - camera.x + halfW;
    const sy = interpY - camera.y + halfH;
    const angle = player.turretAngle || 0;

    const muzzleX = sx + Math.cos(angle) * 30;
    const muzzleY = sy + Math.sin(angle) * 30;
    const endX = muzzleX + Math.cos(angle) * TRAJECTORY_LENGTH;
    const endY = muzzleY + Math.sin(angle) * TRAJECTORY_LENGTH;

    ctx.save();
    const grad = ctx.createLinearGradient(muzzleX, muzzleY, endX, endY);
    grad.addColorStop(0, "rgba(0, 240, 255, 0.55)");
    grad.addColorStop(1, "rgba(0, 240, 255, 0.08)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(muzzleX, muzzleY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Terminal lead dot
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(0, 240, 255, 0.65)";
    ctx.beginPath();
    ctx.arc(endX, endY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Dropped Scrap, Cash & Health Pickups
  for (const item of pickups) {
    const sx = item.x - camera.x + halfW;
    const sy = item.y - camera.y + halfH;
    ctx.save();
    ctx.translate(sx, sy);

    if (item.type === "hp_orb") {
      ctx.fillStyle = PALETTE.vitalityGreen;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (item.type === "cash") {
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(-9, -6, 18, 12);
      ctx.strokeStyle = PALETTE.vitalityGreen;
      ctx.strokeRect(-9, -6, 18, 12);
    } else {
      const colorMap = {
        steel: "#00f0ff",
        copper: "#ffb703",
        aluminum: "#cbd5e1"
      };
      ctx.fillStyle = colorMap[item.type] || "#00f0ff";
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeStyle = "#0b0e14";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-7, -7, 14, 14);
    }
    ctx.restore();
  }

  // 3. Active Projectiles
  for (const proj of projectiles) {
    const px =
      (proj.prevX ?? proj.x) + (proj.x - (proj.prevX ?? proj.x)) * alpha;
    const py =
      (proj.prevY ?? proj.y) + (proj.y - (proj.prevY ?? proj.y)) * alpha;
    const sx = px - camera.x + halfW;
    const sy = py - camera.y + halfH;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(proj.angle || 0);
    ctx.fillStyle = proj.fromEnemy ? PALETTE.alertCrimson : PALETTE.hudCyan;
    ctx.fillRect(-6, -2.5, 12, 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(2, -1.5, 4, 3);
    ctx.restore();
  }

  // 4. Muzzle Sparks & Spinning Brass Shell Casings
  for (const pt of particles) {
    const sx = pt.x - camera.x + halfW;
    const sy = pt.y - camera.y + halfH;
    const ratio = Math.max(0, pt.life / (pt.maxLife || 0.2));

    ctx.save();
    ctx.globalAlpha = ratio;
    ctx.translate(sx, sy);
    if (pt.kind === "casing") {
      ctx.rotate(pt.rotation || 0);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-3.5, -1.5, 7, 3);
    } else {
      ctx.fillStyle = pt.color || PALETTE.hazardAmber;
      ctx.fillRect(-2, -2, 4, 4);
    }
    ctx.restore();
  }

  // 5. Rising Floating Text (-10 HP, +1 STEEL, etc.)
  for (const ft of floatingTexts) {
    const sx = ft.x - camera.x + halfW;
    const sy = ft.y - camera.y + halfH;
    const ratio = Math.max(0, ft.life / (ft.maxLife || 1));

    ctx.save();
    ctx.globalAlpha = ratio;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#0b0e14";
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
  const span = TILE_SIZE * 2; // 2x2 tiles = 96x96px
  const sx = worldX - camera.x + halfW;
  const sy = worldY - camera.y + halfH;

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

    const sx = block.worldX - camera.x + halfW;
    const sy = block.worldY - 32 - camera.y + halfH;

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#161b24";
    ctx.beginPath();
    ctx.arc(sx, sy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.vitalityGreen;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(sx - 2, sy - 7, 4, 14);
    ctx.fillRect(sx - 7, sy - 2, 14, 4);
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
