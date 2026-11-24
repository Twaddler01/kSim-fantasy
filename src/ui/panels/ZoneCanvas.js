// src/ui/panels/ZoneCanvas.js
//
// Top-down exploration canvas.
//   · Camera pans over a world larger than the viewport
//   · Tap  = walk player to world position under finger
//   · Drag = pan camera (does not move player)
//   · Interactable entities live in the world; each may respawn after
//     being consumed. Entity types ("gather", "enemy", "cache", "cave",
//     "poi") are handled by ZoneScene via the onInteract callback.
//   · Entities with `showInteractionIndicator: true` render a green
//     ring over their interaction point — the universal "tap here" cue
//     shared by town doors, future NPCs, and any POI that otherwise
//     blends into the background.

const INTERACT_REACH = 12; // px beyond touching that counts as "in reach"
const TAP_HIT_RADIUS = 1.6; // tap hit detection, × entity.r

const SPRITE_PX = 60;
const SPRITE_HALF = SPRITE_PX / 2;

const TAP_THRESHOLD = 10; // px of movement that promotes a tap to a pan

const PLAYER_SPEED = 200; // world units / second

const PLAYER_SVG = `
<svg class="sprite" viewBox="0 0 48 48" aria-hidden="true">

  <!-- Legs -->
  <path d="M17 35 L31 35 L30 43 L26 45 L22 45 L18 43 Z"
        fill="#493b35" stroke="#302923" stroke-width="1"/>

  <!-- Boots -->
  <path d="M17 41 L24 41 L24 46 L15 46 Q14 44 17 41 Z"
        fill="#65452f" stroke="#382b24" stroke-width="1"/>
  <path d="M25 41 L31 41 Q34 44 32 46 L24 46 Z"
        fill="#65452f" stroke="#382b24" stroke-width="1"/>

  <!-- Tunic -->
  <path d="M13 23 Q16 20 21 20 L27 20 Q32 20 35 23
           L38 39 Q31 42 24 42 Q17 42 10 39 Z"
        fill="#587d91" stroke="#354f60" stroke-width="1.2"
        stroke-linejoin="round"/>

  <!-- Tunic shading -->
  <path d="M15 25 Q19 23 21 24 L21 39 Q16 39 12 38 Z"
        fill="#7394a5" opacity="0.55"/>
  <path d="M33 25 Q29 23 27 24 L27 39 Q32 39 36 38 Z"
        fill="#3f6378" opacity="0.55"/>

  <!-- Neck -->
  <path d="M20 18 L20 24 Q24 28 28 24 L28 18 Z"
        fill="#c99470"/>

  <!-- Head -->
  <ellipse cx="24" cy="15" rx="9" ry="10"
           fill="#d5a77e" stroke="#a77b5d" stroke-width="0.7"/>

  <!-- Ears -->
  <ellipse cx="15" cy="16" rx="2" ry="3" fill="#d5a77e"/>
  <ellipse cx="33" cy="16" rx="2" ry="3" fill="#d5a77e"/>

  <!-- Hair -->
  <path d="M15 17
           Q13 8 19 5
           Q25 1 31 7
           Q35 11 33 19
           L30 14
           L27 11
           L22 10
           L17 14 Z"
        fill="#49352d" stroke="#34251f" stroke-width="0.8"
        stroke-linejoin="round"/>

  <!-- Hair fringe -->
  <path d="M16 13 Q19 8 23 9 Q27 7 31 12
           L27 14 L23 12 L19 15 Z"
        fill="#49352d"/>

  <!-- Eyes -->
  <circle cx="20.5" cy="16" r="0.8" fill="#392c27"/>
  <circle cx="27.5" cy="16" r="0.8" fill="#392c27"/>

  <!-- Simple mouth -->
  <path d="M22 21 Q24 22 26 21"
        fill="none" stroke="#98664f" stroke-width="0.8"
        stroke-linecap="round"/>

  <!-- Belt -->
  <path d="M12 35 Q24 38 36 35 L36 38 Q24 41 12 38 Z"
        fill="#795333" stroke="#513b29" stroke-width="0.8"/>
  <rect x="22" y="36" width="4" height="3" rx="0.5"
        fill="#c6a45f" stroke="#75552f" stroke-width="0.6"/>

</svg>
`;

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
    }
};

export default class ZoneCanvas {
    constructor({
        entities = [],
        world = { width: 1200, height: 900 },
        regions = [],
        showBoundaries = false,
        respawnDelay = 3,
        backgroundCanvas = null,
        fallbackEntityCount = 10,
        title = null,
        onInteract,
        onRespawn,
        onSelect,
        showToast
    } = {}) {
        this.onInteract = onInteract;
        this.onRespawn = onRespawn;
        this.onSelect = onSelect;
        this.showToast = showToast;
        this.title = title;

        this.element = null;
        this.canvas = null;
        this.ctx = null;
        this.playerEl = null;
        this.rafId = null;
        this.lastTime = 0;
        this.active = false;

        this.dpr = 1;
        this.width = 0;
        this.height = 0;

        // Clone so caller mutations don't leak in.
        this.world = { width: world.width, height: world.height };
        this.respawnDelay = respawnDelay;
        this.backgroundCanvas = backgroundCanvas;
        this.regions = regions;
        this.showBoundaries = showBoundaries;
        this.fallbackEntityCount = fallbackEntityCount;

        this.camera = { x: 0, y: 0 };
        this.cameraInitialized = false;

        this.player = {
            x: this.world.width / 2,
            y: this.world.height / 2,
            tx: this.world.width / 2,
            ty: this.world.height / 2,
            r: 22,
            speed: PLAYER_SPEED
        };

        this.pendingEntities = entities;
        this.entities = [];
        this.time = 0;

        // Active pointer state, or null when no pointer is down.
        this.pointer = null;

        this._loop = t => this.tick(t);
        this._onResize = () => this.resize();

        this.resizeObserver = null;
        this._onPointerDown = e => this.handlePointerDown(e);
        this._onPointerMove = e => this.handlePointerMove(e);
        this._onPointerUp = e => this.handlePointerUp(e);
        this._onPointerCancel = e => this.handlePointerCancel(e);

        this.pendingAction = null;
        this.selectedEntity = null;
        this.selectedActionId = null;
    }

    setBackground(canvas) {
        this.backgroundCanvas = canvas;
    }

    setTitle(title) {
        this.title = title;
    }

    // ---------------------------------------------------------------
    // DOM
    // ---------------------------------------------------------------

    getElement() {
        if (this.element) return this.element;

        this.canvas = document.createElement("canvas");
        Object.assign(this.canvas.style, {
            display: "block",
            width: "100%",
            height: "100%",
            background: "#0b0f14",
            cursor: "grab",
            touchAction: "none"
        });
        this.ctx = this.canvas.getContext("2d");

        this.playerEl = document.createElement("div");
        this.playerEl.className = "exploration-player";
        this.playerEl.innerHTML = PLAYER_SVG;

        this.element = document.createElement("div");
        this.element.className = "exploration-demo";
        this.element.appendChild(this.canvas);
        this.element.appendChild(this.playerEl);

        // Observe the actual viewport container, not just window size.
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(this.element);
        }

        requestAnimationFrame(() => this.resize());

        if (this.entities.length === 0 && this.pendingEntities.length > 0) {
            this.entities = this.pendingEntities.map(e => ({
                type: "gather",
                ...e,
                pulse: Math.random() * Math.PI * 2,
                active: true,
                respawnAt: 0,
                strikesLanded: 0,
                cracks: [],
                sparkles: this.makeSparkles(e.sparkleTier ?? 0, e.r ?? 22)
            }));
        } else if (this.entities.length === 0) {
            this.spawnFallbackEntities(this.fallbackEntityCount);
        }

        return this.element;
    }

    update() {
        this.activate();
    }

    activate() {
        if (this.active || !this.canvas) return;
        this.active = true;

        this.resize();
        this.canvas.addEventListener("pointerdown", this._onPointerDown);
        this.canvas.addEventListener("pointermove", this._onPointerMove);
        this.canvas.addEventListener("pointerup", this._onPointerUp);
        this.canvas.addEventListener("pointercancel", this._onPointerCancel);

        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this._loop);
    }

    deactivate() {
        this.active = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.canvas?.removeEventListener("pointerdown", this._onPointerDown);
        this.canvas?.removeEventListener("pointermove", this._onPointerMove);
        this.canvas?.removeEventListener("pointerup", this._onPointerUp);
        this.canvas?.removeEventListener(
            "pointercancel",
            this._onPointerCancel
        );
        this.pointer = null;
    }

    // ---------------------------------------------------------------
    // Sizing / camera helpers
    // ---------------------------------------------------------------

    resize() {
        if (!this.canvas || !this.ctx) return;

        const rect = this.canvas.getBoundingClientRect();

        if (!rect.width || !rect.height) return;

        const previousWidth = this.width;
        const previousHeight = this.height;

        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.width = rect.width;
        this.height = rect.height;

        const pixelWidth = Math.round(this.width * this.dpr);
        const pixelHeight = Math.round(this.height * this.dpr);

        // Only reset the canvas backing store when necessary.
        if (
            this.canvas.width !== pixelWidth ||
            this.canvas.height !== pixelHeight
        ) {
            this.canvas.width = pixelWidth;
            this.canvas.height = pixelHeight;
        }

        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        if (!this.cameraInitialized) {
            this.centerCameraOnPlayer();
            this.cameraInitialized = true;
            return;
        }

        // Preserve the current camera center during resizing.
        const centerX = this.camera.x + previousWidth / 2;
        const centerY = this.camera.y + previousHeight / 2;

        this.camera.x = this.clampCameraX(centerX - this.width / 2);

        this.camera.y = this.clampCameraY(centerY - this.height / 2);
    }

    centerCameraOnPlayer() {
        this.camera.x = this.clampCameraX(this.player.x - this.width / 2);
        this.camera.y = this.clampCameraY(this.player.y - this.height / 2);
    }

    clampCameraX(x) {
        return Math.max(0, Math.min(x, this.world.width - this.width));
    }

    clampCameraY(y) {
        return Math.max(0, Math.min(y, this.world.height - this.height));
    }

    clampWorldX(x) {
        return Math.max(0, Math.min(x, this.world.width));
    }

    clampWorldY(y) {
        return Math.max(0, Math.min(y, this.world.height));
    }

    // ---------------------------------------------------------------
    // Fallback entities (used only if the scene provides none)
    // ---------------------------------------------------------------

    spawnFallbackEntities(count) {
        for (let i = 0; i < count; i++) {
            this.entities.push(this.makeFallbackEntity());
        }
    }

    makeFallbackEntity() {
        const m = 60;
        for (let attempt = 0; attempt < 60; attempt++) {
            const x = m + Math.random() * (this.world.width - m * 2);
            const y = m + Math.random() * (this.world.height - m * 2);

            const tooClose = this.entities.some(
                e => e.active && Math.hypot(e.x - x, e.y - y) < 100
            );
            const tooCloseToPlayer =
                Math.hypot(this.player.x - x, this.player.y - y) < 120;

            if (!tooClose && !tooCloseToPlayer) {
                return this.createFallbackEntityAt(x, y);
            }
        }
        return this.createFallbackEntityAt(
            m + Math.random() * (this.world.width - m * 2),
            m + Math.random() * (this.world.height - m * 2)
        );
    }

    createFallbackEntityAt(x, y) {
        return {
            type: "gather",
            x,
            y,
            r: 22,
            pulse: Math.random() * Math.PI * 2,
            active: true,
            respawnAt: 0,
            strikesLanded: 0,
            cracks: []
        };
    }

    // ---------------------------------------------------------------
    // Pointer — tap vs. swipe
    // ---------------------------------------------------------------

    handlePointerDown(event) {
        event.preventDefault();
        if (this.pointer) return; // ignore secondary touches

        const rect = this.canvas.getBoundingClientRect();
        this.pointer = {
            id: event.pointerId,
            startX: event.clientX - rect.left,
            startY: event.clientY - rect.top,
            startCameraX: this.camera.x,
            startCameraY: this.camera.y,
            hasPanned: false
        };
        this.canvas.setPointerCapture?.(event.pointerId);
    }

    handlePointerMove(event) {
        if (!this.pointer || event.pointerId !== this.pointer.id) return;
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const dx = x - this.pointer.startX;
        const dy = y - this.pointer.startY;

        if (!this.pointer.hasPanned && Math.hypot(dx, dy) > TAP_THRESHOLD) {
            this.pointer.hasPanned = true;
            this.canvas.style.cursor = "grabbing";
        }

        if (this.pointer.hasPanned) {
            this.camera.x = this.clampCameraX(this.pointer.startCameraX - dx);
            this.camera.y = this.clampCameraY(this.pointer.startCameraY - dy);
        }
    }

    handlePointerUp(event) {
        if (!this.pointer || event.pointerId !== this.pointer.id) return;

        if (!this.pointer.hasPanned) {
            const rect = this.canvas.getBoundingClientRect();
            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;
            const worldX = screenX + this.camera.x;
            const worldY = screenY + this.camera.y;

            const hit = this.hitEntity(worldX, worldY);
            if (hit) {
                this.selectEntity(hit);
            } else {
                this.clearSelection();

                this.player.tx = this.clampWorldX(worldX);
                this.player.ty = this.clampWorldY(worldY);
            }
        }

        this.canvas.releasePointerCapture?.(event.pointerId);
        this.canvas.style.cursor = "grab";
        this.pointer = null;
    }

    handlePointerCancel(event) {
        if (!this.pointer || event.pointerId !== this.pointer.id) return;
        this.canvas.style.cursor = "grab";
        this.pointer = null;
    }

    // ---------------------------------------------------------------
    // Loop
    // ---------------------------------------------------------------

    tick(now) {
        if (!this.active) return;
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;

        this.step(dt);
        this.draw();

        this.rafId = requestAnimationFrame(this._loop);
    }

    step(dt) {
        this.time += dt;

        const p = this.player;
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy);
        const moving = dist > 1;

        if (moving) {
            const step = Math.min(dist, p.speed * dt);
            p.x += (dx / dist) * step;
            p.y += (dy / dist) * step;
        }

        this.playerEl.classList.toggle("is-moving", moving);

        // Execute the explicitly requested action when in reach.
        if (this.pendingAction) {
            const { entity, actionId } = this.pendingAction;

            if (!entity.active) {
                this.pendingAction = null;
            } else if (this.inReach(entity)) {
                this.pendingAction = null;
                this.executeAction(entity, actionId);
            }
        }

        // Respawn via the scene so it can pick the right entity definition.
        for (const e of this.entities) {
            if (e.active || this.time < e.respawnAt) continue;

            const fresh = this.onRespawn
                ? this.onRespawn(e)
                : this.makeFallbackEntity();

            if (fresh) {
                Object.assign(e, fresh, {
                    pulse: 0,
                    active: true,
                    respawnAt: 0,
                    strikesLanded: 0,
                    cracks: []
                });
                e.sparkles = this.makeSparkles(e.sparkleTier ?? 0, e.r ?? 22);
            }
            // If onRespawn returns null, entity stays gone (finite zone).
        }

        // Animate pulses.
        for (const e of this.entities) {
            e.pulse += dt * 3;
        }
    }

    draw() {
        const ctx = this.ctx;
        const { width: w, height: h } = this;

        // Position the SVG overlay in screen space.
        const screenX = this.player.x - this.camera.x;
        const screenY = this.player.y - this.camera.y;
        this.playerEl.style.transform = `translate(${screenX - SPRITE_HALF}px, ${screenY - SPRITE_HALF}px)`;

        // Background.
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#0b0f14";
        ctx.fillRect(0, 0, w, h);

        this.drawWorld();
        this.drawHUD();
        this.drawMinimap();
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
            
                ctx.fillText(
                    region.name,
                    region.label.x,
                    region.label.y
                );
            
                ctx.restore();
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

        // Debug geography — drawn in world coordinates.
        this.drawDebugBoundaries();

        // Destination marker.
        ctx.strokeStyle = "rgba(120,200,255,0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.player.tx, this.player.ty, 7, 0, Math.PI * 2);
        ctx.stroke();

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
                ctx.fillStyle =
                    ENTITY_FALLBACK_COLORS[e.type] ??
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
                ctx.fillStyle =
                    ENTITY_FALLBACK_COLORS[e.type] ??
                    ENTITY_FALLBACK_COLORS.gather;
                ctx.beginPath();
                ctx.arc(drawX, drawY, r * scale, 0, Math.PI * 2);
                ctx.fill();
            }

            // 4. Interaction indicator — the universal "tap here" ring.
            //    Only entities with showInteractionIndicator render it.
            this.drawInteractionIndicator(ctx, e, drawX, drawY);

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

            // Progress pips (gather only, since others have strikesRequired 1).
            const required = e.strikesRequired ?? 1;
            if (required > 1 && e.strikesLanded > 0) {
                const pipY = drawY - e.r - 10;
                const gap = 6;
                const startX = drawX - ((required - 1) * gap) / 2;
                for (let i = 0; i < required; i++) {
                    ctx.fillStyle =
                        i < e.strikesLanded
                            ? "#7cc8ff"
                            : "rgba(255,255,255,0.18)";
                    ctx.beginPath();
                    ctx.arc(startX + i * gap, pipY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        ctx.restore();
    }

    /**
     * Universal interaction indicator.
     * A subtle green ring drawn over any entity with
     * `showInteractionIndicator: true`. Anchor point is the entity's
     * (drawX, drawY) — callers pass those so the ring follows shake
     * offsets together with the sprite.
     *//**
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

        const colors =
            ENTITY_RING_COLORS[entity.type] ?? ENTITY_RING_COLORS.gather;

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
            ctx.fillStyle =
                ENTITY_MINIMAP_COLORS[e.type] ?? ENTITY_MINIMAP_COLORS.gather;
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

    hitEntity(worldX, worldY) {
        for (const e of this.entities) {
            if (!e.active) continue;
            const r = (e.r ?? 22) * TAP_HIT_RADIUS;
            if (Math.hypot(worldX - e.x, worldY - e.y) <= r) return e;
        }
        return null;
    }

    setSelectedAction(actionId, entity) {
        if (!entity || entity !== this.selectedEntity || !entity.active) {
            this.selectedActionId = null;
            return;
        }

        if (this.selectedActionId !== actionId) {
            this.pendingAction = null;
        }

        this.selectedActionId = actionId;
    }

    selectEntity(entity) {
        if (!entity?.active) return;

        // Tapping the already-selected entity executes its active action.
        if (this.selectedEntity === entity) {
            if (this.selectedActionId) {
                this.requestAction(entity, this.selectedActionId);
            }
            return;
        }

        // Selecting a different entity cancels any previous action.
        this.pendingAction = null;
        this.selectedActionId = null;
        this.selectedEntity = entity;

        // The HUD will choose the new entity's default action.
        this.onSelect?.(entity);
    }

    clearSelection() {
        if (!this.selectedEntity) return;

        this.pendingAction = null;
        this.selectedEntity = null;
        this.selectedActionId = null;

        this.onSelect?.(null);
    }

    inReach(entity) {
        const p = this.player;
        return (
            Math.hypot(p.x - entity.x, p.y - entity.y) <=
            p.r + (entity.r ?? 22) + INTERACT_REACH
        );
    }

    requestAction(entity, actionId) {
        if (!entity?.active) return;

        const p = this.player;

        if (this.inReach(entity)) {
            this.pendingAction = null;
            this.executeAction(entity, actionId);
            return;
        }

        const dx = entity.x - p.x;
        const dy = entity.y - p.y;
        const dist = Math.hypot(dx, dy);

        const stopDist = p.r + (entity.r ?? 22) + INTERACT_REACH * 0.5;

        if (dist > stopDist) {
            p.tx = this.clampWorldX(entity.x - (dx / dist) * stopDist);

            p.ty = this.clampWorldY(entity.y - (dy / dist) * stopDist);
        }

        this.pendingAction = { entity, actionId };
    }

    executeAction(entity, actionId) {
        if (!entity?.active) return;

        // Gathering retains its existing multi-strike progression.
        if (entity.type === "gather" && actionId === "gather") {
            this.strikeEntity(entity);
            return;
        }

        // Other entity actions are dispatched directly to ZoneScene.
        this.completeEntity(entity, actionId);
    }

    strikeEntity(entity) {
        if (!entity.active) return;
        const required = entity.strikesRequired ?? 1;
        if (entity.strikesLanded >= required) return;

        entity.strikesLanded++;
        entity.hitFlash = this.time;

        // Cracks are a gather-specific visual. Enemies / caches / caves /
        // POIs skip them.
        if (entity.type === "gather") {
            entity.cracks.push(this.makeCrack(entity));
        }

        if (entity.strikesLanded >= required) {
            this.completeEntity(entity, "gather");
        }
    }

    makeCrack(entity) {
        const r = entity.r ?? 22;
        return {
            angle: Math.random() * Math.PI * 2,
            innerR: r * (0.15 + Math.random() * 0.1),
            outerR: r * (0.75 + Math.random() * 0.35)
        };
    }

    completeEntity(entity, actionId) {
        const rect = this.canvas.getBoundingClientRect();
        const screenPos = {
            clientX: rect.left + (entity.x - this.camera.x),
            clientY: rect.top + (entity.y - this.camera.y)
        };

        // The scene decides whether this interaction consumes the entity.
        // Returning false (or omitting a handler) leaves the entity in
        // place so it can be retried once the scene wires its callback.
        const consumed =
            this.onInteract?.(entity, screenPos, actionId) !== false;

        if (!consumed) {
            entity.strikesLanded = 0;
            entity.cracks = [];
            return;
        }

        entity.active = false;
        if (this.selectedEntity === entity) {
            this.clearSelection();
        }
        entity.respawnAt =
            entity.respawnSeconds === null
                ? Infinity
                : this.time + (entity.respawnSeconds ?? this.respawnDelay);
        entity.strikesLanded = 0;
        entity.cracks = [];

        this.showToast?.(`${entity.label ?? "Object"} recovered`);
    }

    makeSparkles(tier, radius) {
        const count = [0, 2, 3, 5][tier] ?? 0;
        const sparkles = [];
        for (let i = 0; i < count; i++) {
            sparkles.push({
                baseAngle: (i / count) * Math.PI * 2 + Math.random() * 0.5,
                orbitSpeed: 0.35 + Math.random() * 0.45,
                orbitRadius: radius * (1.5 + Math.random() * 0.5),
                twinkleSpeed: 1.8 + Math.random() * 2.2,
                phase: Math.random() * Math.PI * 2,
                size: 1.4 + Math.random() * 1.6
            });
        }
        return sparkles;
    }
}
