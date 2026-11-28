// src/ui/world/ZoneRenderer.js
//
// Handles visual rendering of the exploration world.
// Receives current world state from ZoneCanvas and draws it.
//
// This class does not own or modify gameplay state.

const SPRITE_PX = 60;
const SPRITE_HALF = SPRITE_PX / 2;

const ENTITY_FALLBACK_COLORS = {
    gather: "rgba(120,255,180,0.75)",
    enemy: "rgba(255,100,100,0.75)",
    cache: "rgba(255,200,80,0.75)",
    cave: "rgba(120,140,255,0.75)",
    poi: "rgba(150,140,200,0.75)"
};

const ENTITY_MINIMAP_COLORS = {
    gather: "rgba(120,255,180,0.9)",
    enemy: "rgba(255,120,120,0.9)",
    cache: "rgba(255,200,80,0.9)",
    cave: "rgba(120,140,255,0.9)",
    poi: "rgba(200,180,255,0.9)"
};

const ENTITY_RING_COLORS = {
    gather: {
        fill: "rgba(120, 255, 180, 0.12)",
        stroke: alpha => `rgba(140, 255, 190, ${alpha})`
    },
    enemy: {
        fill: "rgba(255, 100, 100, 0.15)",
        stroke: alpha => `rgba(255, 130, 130, ${alpha})`
    },
    cache: {
        fill: "rgba(255, 200, 80, 0.15)",
        stroke: alpha => `rgba(255, 220, 110, ${alpha})`
    },
    cave: {
        fill: "rgba(120, 140, 255, 0.15)",
        stroke: alpha => `rgba(150, 170, 255, ${alpha})`
    },
    poi: {
        fill: "rgba(65, 220, 115, 0.18)",
        stroke: alpha => `rgba(90, 255, 145, ${alpha})`
    },
    loot: {
        fill: "rgba(255, 200, 80, 0.18)",
        stroke: alpha => `rgba(255, 220, 110, ${alpha})`
    }
};

/**
 * Loot drops are stored as "enemy" internally (so respawn rebuilds
 * an enemy) but render and color like a cache while loot is pending.
 */
function getEntityDisplayType(entity) {
    if (entity.type === "enemy" && entity.lootContainer?.items?.length > 0) {
        return "loot";
    }

    return entity.type;
}

export default class ZoneRenderer {
    constructor() {
        this.state = null;
    }

    // ---------------------------------------------------------------
    // Current render state
    // ---------------------------------------------------------------

    draw(state) {
        this.state = state;

        const ctx = this.ctx;
        const { width: w, height: h } = this;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#0b0f14";
        ctx.fillRect(0, 0, w, h);

        this.drawWorld();
        this.drawHUD();
        this.drawMinimap();
        this.drawActionProgressOverlay();
    }

    get ctx() {
        return this.state.ctx;
    }

    get overlayCtx() {
        return this.state.overlayCtx;
    }

    get width() {
        return this.state.width;
    }

    get height() {
        return this.state.height;
    }

    get camera() {
        return this.state.camera;
    }

    get world() {
        return this.state.world;
    }

    get player() {
        return this.state.player;
    }

    get entities() {
        return this.state.entities;
    }

    get time() {
        return this.state.time;
    }

    get title() {
        return this.state.title;
    }

    get backgroundCanvas() {
        return this.state.backgroundCanvas;
    }

    get regions() {
        return this.state.regions;
    }

    get showBoundaries() {
        return this.state.showBoundaries;
    }

    get showCombatRanges() {
        return this.state.showCombatRanges;
    }

    get selectedEntity() {
        return this.state.selectedEntity;
    }

    get actionProgress() {
        return this.state.actionProgress;
    }

    get lootDuration() {
        return this.state.lootDuration;
    }

    // Grid (visible range only).
    drawGrid() {
        const ctx = this.ctx;
        const { width: w, height: h } = this;
        const cam = this.camera;
        const g = 40;
        const startX = Math.floor(cam.x / g) * g;
        const startY = Math.floor(cam.y / g) * g;
        const endX = cam.x + w;
        const endY = cam.y + h;

        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += g) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += g) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }

    drawDebugBoundaries() {
        if (!this.showBoundaries || this.regions.length === 0) return;

        const ctx = this.ctx;

        ctx.save();
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.lineJoin = "round";

        for (const region of this.regions) {
            const shape = region.shape;
            if (!shape) continue;

            ctx.strokeStyle = region.debugColor ?? "#ffffff";
            ctx.globalAlpha = 0.9;
            ctx.beginPath();

            if (shape.type === "circle") {
                ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
            } else if (shape.type === "polygon" && shape.points?.length >= 3) {
                ctx.moveTo(shape.points[0].x, shape.points[0].y);

                for (let i = 1; i < shape.points.length; i++) {
                    ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }

                ctx.closePath();
            } else {
                continue;
            }

            ctx.stroke();

            if (region.label) {
                ctx.save();

                ctx.setLineDash([]);
                ctx.font = "bold 16px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                ctx.fillStyle = region.debugColor ?? "#ffffff";
                ctx.shadowColor = "#000000";
                ctx.shadowBlur = 5;

                ctx.fillText(region.name, region.label.x, region.label.y);

                ctx.restore();
            }
        }

        ctx.restore();
    }

    drawDebugCombatRanges() {
        if (!this.showCombatRanges) return;

        const ctx = this.ctx;

        ctx.save();
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);

        for (const entity of this.entities) {
            if (!entity.active || entity.type !== "enemy") continue;

            const ranges = [
                {
                    radius: entity.attackRange,
                    color: "#ff4545"
                },
                {
                    radius: entity.detectionRange,
                    color: "#ffad42"
                },
                {
                    radius: entity.pursuitRange,
                    color: "#4da6ff"
                }
            ];

            for (const range of ranges) {
                if (!Number.isFinite(range.radius) || range.radius <= 0) {
                    continue;
                }

                ctx.beginPath();
                ctx.strokeStyle = range.color;
                ctx.globalAlpha = 0.8;

                ctx.arc(entity.x, entity.y, range.radius, 0, Math.PI * 2);

                ctx.stroke();
            }
        }

        ctx.restore();
    }

    drawWorld() {
        const ctx = this.ctx;
        const cam = this.camera;
        const { width: w, height: h } = this;
        const { width: ww, height: wh } = this.world;

        // Background: one blit if we have a cache, else flat fill.
        if (this.backgroundCanvas) {
            ctx.drawImage(
                this.backgroundCanvas,
                cam.x,
                cam.y,
                w,
                h,
                0,
                0,
                w,
                h
            );
        } else {
            ctx.fillStyle = "#0b0f14";
            ctx.fillRect(0, 0, w, h);
        }

        ctx.save();
        ctx.translate(-cam.x, -cam.y);

        // Grid only when there's no background.
        if (!this.backgroundCanvas) {
            this.drawGrid();
        }

        // World bounds.
        ctx.strokeStyle = "rgba(120,200,255,0.25)";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, ww, wh);

        // Debug areas — drawn in world coordinates.
        this.drawDebugBoundaries();
        this.drawDebugCombatRanges();

        // Destination marker — visible only while moving.
        const distanceToDestination = Math.hypot(
            this.player.tx - this.player.x,
            this.player.ty - this.player.y
        );
        
        if (distanceToDestination > 1) {
            ctx.strokeStyle = "rgba(120,200,255,0.45)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.player.tx, this.player.ty, 7, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Player shadow.
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(
            this.player.x,
            this.player.y + SPRITE_HALF - 10,
            11,
            3.5,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Entities — cull to viewport with a small overscan so
        // entities straddling the edge don't pop in/out.
        const CULL_MARGIN = 80;
        const viewL = cam.x - CULL_MARGIN;
        const viewT = cam.y - CULL_MARGIN;
        const viewR = cam.x + w + CULL_MARGIN;
        const viewB = cam.y + h + CULL_MARGIN;

        for (const e of this.entities) {
            if (!e.active) continue;
            if (e.x < viewL || e.x > viewR || e.y < viewT || e.y > viewB) {
                continue;
            }

            // Hit shake.
            const sinceHit = this.time - (e.hitFlash ?? -999);
            const shakeAmt = sinceHit < 0.12 ? (1 - sinceHit / 0.12) * 3 : 0;
            const drawX =
                e.x + (shakeAmt ? (Math.random() - 0.5) * shakeAmt * 2 : 0);
            const drawY =
                e.y + (shakeAmt ? (Math.random() - 0.5) * shakeAmt * 2 : 0);

            const scale = e.scale ?? 1;
            const rotation = e.rotation ?? 0;
            const s = (e.r ?? 22) * 3;

            // 1. Ground shadow.
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.beginPath();
            ctx.ellipse(
                drawX,
                drawY + s * 0.35,
                s * 0.32 * scale,
                s * 0.1 * scale,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();

            // 2. Crumbs (gather only; harmless for others since []).
            if (e.crumbs) {
                for (const c of e.crumbs) {
                    ctx.globalAlpha = c.alpha;
                    ctx.fillStyle = c.color;
                    ctx.beginPath();
                    ctx.arc(
                        drawX + c.dx,
                        drawY + c.dy + s * 0.28,
                        c.r,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }

            // 3. Sprite / emoji / fallback color
            if (e.sprite && e.sprite.complete && e.sprite.naturalWidth) {
                ctx.save();
                ctx.translate(drawX, drawY);
                ctx.rotate(rotation);
                ctx.scale(scale, scale);
                ctx.drawImage(e.sprite, -s / 2, -s / 2, s, s);
                ctx.restore();
            } else if (e.icon) {
                ctx.save();

                // Backdrop tint. Always rendered for emoji entities —
                // it anchors the emoji, and the interaction ring sits
                // around it as the type signal.
                const displayType = getEntityDisplayType(e);

                ctx.fillStyle =
                    ENTITY_FALLBACK_COLORS[displayType] ??
                    ENTITY_FALLBACK_COLORS.gather;
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.arc(drawX, drawY, (e.r ?? 22) * 0.9, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;

                // Emoji on top.
                ctx.fillStyle = "#ffffff";
                ctx.font = `${Math.round(
                    (e.r ?? 22) * 1.6
                )}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(e.icon, drawX, drawY);
                ctx.restore();
            } else {
                const r = e.r ?? 22;
                const displayType = getEntityDisplayType(e);

                ctx.fillStyle =
                    ENTITY_FALLBACK_COLORS[displayType] ??
                    ENTITY_FALLBACK_COLORS.gather;
                ctx.beginPath();
                ctx.arc(drawX, drawY, r * scale, 0, Math.PI * 2);
                ctx.fill();
            }

            // 4. Combat aggro indicator.
            this.drawAggroIndicator(ctx, e, drawX, drawY);

            // 5. Interaction indicator.
            this.drawInteractionIndicator(ctx, e, drawX, drawY);

            // 6. Pending loot indicator.
            if (e.lootContainer?.items?.length > 0) {
                this.drawPendingLootIndicator(ctx, e, drawX, drawY);
            }

            // Cracks (gather only; enemies never add them).
            if (e.cracks && e.cracks.length > 0) {
                ctx.strokeStyle = "rgba(0,0,0,0.55)";
                ctx.lineWidth = 1.5;
                ctx.lineCap = "round";
                for (const c of e.cracks) {
                    ctx.beginPath();
                    ctx.moveTo(
                        drawX + Math.cos(c.angle) * c.innerR,
                        drawY + Math.sin(c.angle) * c.innerR
                    );
                    ctx.lineTo(
                        drawX + Math.cos(c.angle) * c.outerR,
                        drawY + Math.sin(c.angle) * c.outerR
                    );
                    ctx.stroke();
                }
            }

            // Sparkles (gather only; tier drives count).
            if (e.sparkleTier > 0 && e.sparkles) {
                for (const sp of e.sparkles) {
                    const angle = sp.baseAngle + this.time * sp.orbitSpeed;
                    const sx = drawX + Math.cos(angle) * sp.orbitRadius;
                    const sy = drawY + Math.sin(angle) * sp.orbitRadius;
                    const twinkle =
                        0.5 +
                        0.5 * Math.sin(this.time * sp.twinkleSpeed + sp.phase);

                    ctx.fillStyle = `rgba(160,255,200,${0.28 * twinkle})`;
                    ctx.beginPath();
                    ctx.arc(sx, sy, sp.size * 2.2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = `rgba(230,255,240,${0.55 + 0.4 * twinkle})`;
                    ctx.beginPath();
                    ctx.arc(sx, sy, sp.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        ctx.restore();
    }

    /**
     * Animated red aggro rays around enemies currently
     * engaged in combat with the player.
     */
    drawAggroIndicator(ctx, entity, drawX, drawY) {
        if (entity.type !== "enemy" || !entity.inCombat) {
            return;
        }

        const radius = entity.indicatorRadius ?? entity.r ?? 20;

        const rayCount = 12;
        const innerRadius = radius + 5;

        // Subtle pulsing effect.
        const pulse = 0.75 + 0.25 * Math.sin(this.time * 4);

        ctx.save();

        ctx.strokeStyle = `rgba(255, 55, 55, ${0.65 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";

        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2 + this.time * 0.12;

            // Alternate ray lengths for a slightly irregular
            // sunburst appearance.
            const length = i % 2 === 0 ? 9 : 6;

            const x1 = drawX + Math.cos(angle) * innerRadius;
            const y1 = drawY + Math.sin(angle) * innerRadius;

            const x2 = drawX + Math.cos(angle) * (innerRadius + length);
            const y2 = drawY + Math.sin(angle) * (innerRadius + length);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Universal interaction indicator.
     * A subtle colored ring drawn over any entity with
     * `showInteractionIndicator: true`. Ring color is determined by
     * `entity.type` (green = gather, red = enemy, gold = cache,
     * blue = cave, green = town POI). Anchor point is the entity's
     * (drawX, drawY) so the ring follows shake offsets together with
     * the sprite.
     */
    drawInteractionIndicator(ctx, entity, drawX, drawY) {
        if (this.selectedEntity !== entity) return;

        const displayType = getEntityDisplayType(entity);

        const colors =
            ENTITY_RING_COLORS[displayType] ?? ENTITY_RING_COLORS.gather;
        const radius = entity.indicatorRadius ?? entity.r ?? 20;

        // Very subtle pulse: oscillates the stroke alpha between
        // 0.55 and 0.85 over ~4 seconds. Never fully invisible.
        const pulse = 0.7 + 0.15 * Math.sin(this.time * 1.5);
        const strokeAlpha = Math.round(pulse * 100) / 100;

        ctx.save();

        // Transparent color fill.
        ctx.fillStyle = colors.fill;
        ctx.beginPath();
        ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Visible colored outline.
        ctx.strokeStyle = colors.stroke(strokeAlpha);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    drawPendingLootIndicator(ctx, entity, drawX, drawY) {
        const x = drawX;
        const y = drawY - (entity.r ?? 22) - 14;

        const duration = entity.lootDuration || this.lootDuration || 60;

        const remaining = Math.max(
            0,
            Math.min(1, (entity.lootExpiresAt - this.time) / duration)
        );

        const elapsed = 1 - remaining;

        const radius = 11;
        const startAngle = -Math.PI / 2;
        const fullCircle = Math.PI * 2;

        ctx.save();

        // Badge shadow and background.
        ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
        ctx.shadowBlur = 5;
        ctx.fillStyle = "rgba(35, 29, 18, 0.95)";

        ctx.beginPath();
        ctx.arc(x, y, 9, 0, fullCircle);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Elapsed time: dark yellow base ring.
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#806020";

        ctx.beginPath();
        ctx.arc(x, y, radius, startAngle, startAngle + fullCircle);
        ctx.stroke();

        // Remaining time: bright gold ring.
        if (remaining > 0) {
            ctx.strokeStyle = "#f2c66d";

            ctx.beginPath();
            ctx.arc(
                x,
                y,
                radius,
                startAngle,
                startAngle + fullCircle * remaining
            );
            ctx.stroke();
        }

        // Pickup arrow.
        ctx.fillStyle = "#ffe5a3";
        ctx.font = "bold 15px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("↓", x, y - 0.5);

        ctx.restore();
    }

    drawHUD() {
        const ctx = this.ctx;

        const heading = this.title ?? "Zone";

        ctx.fillStyle = "#e8f4ff";
        ctx.font = "600 15px system-ui, -apple-system, 'Segoe UI', sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText(heading, 12, 12);

        ctx.fillStyle = "rgba(180,210,240,0.6)";
        ctx.font = "400 11px system-ui, -apple-system, 'Segoe UI', sans-serif";
        ctx.fillText("Tap to move · drag to pan", 12, 32);
    }

    drawMinimap() {
        const ctx = this.ctx;
        const { width: w, height: h } = this;

        const mmW = 120;
        const mmH = 90;
        const mmX = w - mmW - 10;
        const mmY = h - mmH - 10;
        const sx = mmW / this.world.width;
        const sy = mmH / this.world.height;

        // Panel.
        ctx.fillStyle = "rgba(10,15,22,0.85)";
        ctx.fillRect(mmX, mmY, mmW, mmH);
        ctx.strokeStyle = "rgba(120,200,255,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX, mmY, mmW, mmH);

        // Viewport frame.
        ctx.strokeStyle = "rgba(120,200,255,0.4)";
        ctx.strokeRect(
            mmX + this.camera.x * sx,
            mmY + this.camera.y * sy,
            this.width * sx,
            this.height * sy
        );

        // Entities.
        for (const e of this.entities) {
            if (!e.active) continue;

            const displayType = getEntityDisplayType(e);

            ctx.fillStyle =
                ENTITY_MINIMAP_COLORS[displayType] ??
                ENTITY_MINIMAP_COLORS.gather;

            ctx.beginPath();
            ctx.arc(mmX + e.x * sx, mmY + e.y * sy, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player.
        ctx.fillStyle = "#7cc8ff";
        ctx.beginPath();
        ctx.arc(
            mmX + this.player.x * sx,
            mmY + this.player.y * sy,
            2.5,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    drawActionProgressOverlay() {
        const ctx = this.overlayCtx;
        const action = this.actionProgress;

        ctx.clearRect(0, 0, this.width, this.height);

        if (!action?.isActive || !action.entity?.active) return;

        const entity = action.entity;
        const cam = this.camera;

        // Don't draw progress bars outside the viewport.
        const screenX = entity.x - cam.x;
        const screenY = entity.y - cam.y;

        if (
            screenX < -80 ||
            screenX > this.width + 80 ||
            screenY < -80 ||
            screenY > this.height + 80
        ) {
            return;
        }

        const barWidth = 38;
        const barHeight = 5;
        const barX = screenX - barWidth / 2;
        const barY = screenY - (entity.r ?? 22) - 10;

        ctx.save();

        // Track.
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, 3);
        ctx.fill();

        // Progress.
        if (action.progress > 0) {
            ctx.fillStyle = "#42c9a0";
            ctx.beginPath();
            ctx.roundRect(barX, barY, barWidth * action.progress, barHeight, 3);
            ctx.fill();
        }

        ctx.restore();
    }
}
