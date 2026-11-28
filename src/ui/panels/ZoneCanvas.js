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

import WorldCamera from "../world/WorldCamera.js";
import ZoneRenderer from "../world/ZoneRenderer.js";
import ZoneEntityManager from "../world/ZoneEntityManager.js";
import { isWithinRange, getDistance } from "../../systems/CombatRange.js";
import ActionProgress from "../../systems/ActionProgress.js";

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

export default class ZoneCanvas {
    constructor({
        entities = [],
        world = { width: 1200, height: 900 },
        regions = [],
        showBoundaries = false,
        showCombatRanges = false,
        respawnDelay = 3,
        lootDuration = 60,
        onLootExpired = null,
        backgroundCanvas = null,
        fallbackEntityCount = 10,
        title = null,
        onInteract,
        onRespawn,
        onSelect,
        onUpdate,
        showToast
    } = {}) {
        this.onInteract = onInteract;
        this.onRespawn = onRespawn;
        this.onSelect = onSelect;
        this.onUpdate = onUpdate;
        this.showToast = showToast;
        this.title = title;

        this.element = null;
        this.canvas = null;
        this.ctx = null;
        this.overlayCanvas = null;
        this.overlayCtx = null;
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
        this.lootDuration = lootDuration;
        this.onLootExpired = onLootExpired;
        this.backgroundCanvas = backgroundCanvas;
        this.regions = regions;
        this.showBoundaries = showBoundaries;
        this.showCombatRanges = showCombatRanges;
        this.fallbackEntityCount = fallbackEntityCount;

        this.camera = new WorldCamera(this.world);
        this.renderer = new ZoneRenderer();

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

        this.entityManager = new ZoneEntityManager({
            entities: this.entities,
            time: () => this.time,
            respawnDelay: this.respawnDelay,
            onRespawn: this.onRespawn,
            makeFallbackEntity: () => this.makeFallbackEntity(),
            makeSparkles: (tier, radius) =>
                this.makeSparkles(tier, radius),
            onConsume: (entity, message) =>
                this.consumeEntity(entity, message),
            onLootExpired: entity =>
                this.onLootExpired?.(entity)
        });

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
        // Currently running timed world action, if any.
        this.actionProgress = null;
        this.selectedEntity = null;
        this.selectedActionId = null;

        this.paused = false;
        this.playerSpawn = {
            x: this.world.width / 2,
            y: this.world.height / 2
        };
        this.deathOverlay = null;
        this.deathOverlayCountdown = null;
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

        this.overlayCanvas = document.createElement("canvas");
        this.overlayCanvas.className = "exploration-world-overlay";
        this.overlayCtx = this.overlayCanvas.getContext("2d");
        
        this.playerEl = document.createElement("div");
        this.playerEl.className = "exploration-player";
        this.playerEl.innerHTML = PLAYER_SVG;

        this.element = document.createElement("div");
        this.element.className = "exploration-world";
        
        this.element.appendChild(this.canvas);
        this.element.appendChild(this.playerEl);
        this.element.appendChild(this.overlayCanvas);

        // Observe the actual viewport container, not just window size.
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(this.element);
        }

        requestAnimationFrame(() => this.resize());

        if (this.entities.length === 0 && this.pendingEntities.length > 0) {
            this.entities.push(
                ...this.pendingEntities.map(e => ({
                    type: "gather",
                    ...e,
                    pulse: Math.random() * Math.PI * 2,
                    active: true,
                    respawnAt: 0,
                    strikesLanded: 0,
                    cracks: [],
                    sparkles: this.makeSparkles(
                        e.sparkleTier ?? 0,
                        e.r ?? 22
                    )
                }))
            );
        } else if (this.entities.length === 0) {
            this.spawnFallbackEntities(this.fallbackEntityCount);
        }

        return this.element;
    }

    draw() {
        // Position the SVG player overlay in screen space.
        const screenX = this.player.x - this.camera.x;
        const screenY = this.player.y - this.camera.y;
    
        this.playerEl.style.transform =
            `translate(${screenX - SPRITE_HALF}px, ${screenY - SPRITE_HALF}px)`;
    
        this.renderer.draw({
            ctx: this.ctx,
            overlayCtx: this.overlayCtx,
            width: this.width,
            height: this.height,
    
            camera: this.camera,
            world: this.world,
            player: this.player,
            entities: this.entities,
    
            time: this.time,
            title: this.title,
    
            backgroundCanvas: this.backgroundCanvas,
            regions: this.regions,
            showBoundaries: this.showBoundaries,
            showCombatRanges: this.showCombatRanges,
    
            selectedEntity: this.selectedEntity,
            actionProgress: this.actionProgress,
            lootDuration: this.lootDuration
        });
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

    pause() {
        this.paused = true;
        this.pointer = null;
        this.pendingAction = null;
        this.cancelActionProgress("interface");
        this.playerEl?.classList.remove("is-moving");
    }

    resume() {
        this.paused = false;
    }

    setPlayerSpawn(x, y) {
        this.playerSpawn = { x, y };
    }

    respawnPlayer() {
        const p = this.player;
        p.x = this.playerSpawn.x;
        p.y = this.playerSpawn.y;
        p.tx = this.playerSpawn.x;
        p.ty = this.playerSpawn.y;
        this.camera.centerOn(this.player.x, this.player.y);
    }

    setPlayerDead(dead) {
        this.playerEl?.classList.toggle("is-dead", dead);
    }

    showDeathOverlay(countdown) {
        if (this.deathOverlay) this.hideDeathOverlay();

        const overlay = document.createElement("div");
        overlay.className = "death-overlay";

        const title = document.createElement("div");
        title.className = "death-overlay-title";
        title.textContent = "YOU DIED";

        const countdownEl = document.createElement("div");
        countdownEl.className = "death-overlay-countdown";
        countdownEl.textContent = String(countdown);

        overlay.append(title, countdownEl);
        this.element.appendChild(overlay);

        void overlay.offsetHeight; // force reflow for transition
        overlay.classList.add("is-visible");

        this.deathOverlay = overlay;
        this.deathOverlayCountdown = countdownEl;

        this._popCountdown();
    }

    updateDeathOverlay(remaining) {
        if (!this.deathOverlayCountdown) return;
        this.deathOverlayCountdown.textContent = String(remaining);
        this._popCountdown();
    }

    _popCountdown() {
        const el = this.deathOverlayCountdown;
        if (!el) return;
        el.classList.remove("is-ticking");
        void el.offsetWidth;
        el.classList.add("is-ticking");
    }

    hideDeathOverlay() {
        const overlay = this.deathOverlay;
        if (!overlay) return;

        overlay.classList.remove("is-visible");
        this.deathOverlay = null;
        this.deathOverlayCountdown = null;

        setTimeout(() => overlay.remove(), 350);
    }

    // ---------------------------------------------------------------
    // Sizing / camera helpers
    // ---------------------------------------------------------------

    resize() {
        if (!this.canvas || !this.ctx) return;

        const rect = this.canvas.getBoundingClientRect();

        if (!rect.width || !rect.height) return;

        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.width = rect.width;
        this.height = rect.height;

        const pixelWidth = Math.round(this.width * this.dpr);
        const pixelHeight = Math.round(this.height * this.dpr);

        if (
            this.canvas.width !== pixelWidth ||
            this.canvas.height !== pixelHeight
        ) {
            this.canvas.width = pixelWidth;
            this.canvas.height = pixelHeight;
        }

        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        const overlayWidth = Math.round(this.width * this.dpr);
        const overlayHeight = Math.round(this.height * this.dpr);
        
        if (
            this.overlayCanvas.width !== overlayWidth ||
            this.overlayCanvas.height !== overlayHeight
        ) {
            this.overlayCanvas.width = overlayWidth;
            this.overlayCanvas.height = overlayHeight;
        }
        
        this.overlayCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        this.camera.resize(this.width, this.height, this.player);
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
            this.camera.panFrom(
                this.pointer.startCameraX,
                this.pointer.startCameraY,
                dx,
                dy
            );
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

                this.player.tx = this.camera.clampWorldX(worldX);
                this.player.ty = this.camera.clampWorldY(worldY);
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

        if (this.paused) {
            this.playerEl?.classList.remove("is-moving");
            return;
        }

        // Allow external systems (such as combat) to update
        // using the same clock as world movement and animation.
        this.onUpdate?.(dt);

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

        // Follow the player while moving.
        // Camera clamps naturally at the world boundaries.
        if (moving) {
            this.camera.centerOn(p.x, p.y);
        }

        this.playerEl.classList.toggle("is-moving", moving);

        // Execute the explicitly requested action when in reach.
        if (this.pendingAction) {
            const { entity, actionId } = this.pendingAction;

            if (!entity.active) {
                this.pendingAction = null;
            } else {
                const isLootDrop = entity.lootContainer?.items?.length > 0;
                const usesCombatRange =
                    actionId === "attack" &&
                    entity.type === "enemy" &&
                    !isLootDrop;

                const inRange = usesCombatRange
                    ? this.isEnemyInAttackRange(entity)
                    : this.inReach(entity);

                if (inRange) {
                    this.pendingAction = null;
                    this.executeAction(entity, actionId);
                }
            }
        }

        // Advance any active timed world action.
        this.updateActionProgress(dt);

        // 1. Complete entities whose loot has all been collected.
        // 2. Expire uncollected loot and begin normal entity respawning.
        // 3. Respawn via the scene so it can pick the right entity definition.
        this.entityManager.update();
        
        // Animate pulses.
        for (const e of this.entities) {
            e.pulse += dt * 3;
        }
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
            this.cancelActionProgress("selection-changed");
        }

        this.selectedActionId = actionId;
    }

    selectEntity(entity) {
        if (!entity?.active) return;

        if (this.selectedEntity === entity) {
            if (this.selectedActionId) {
                this.requestAction(entity, this.selectedActionId);
            }
            return;
        }

        this.cancelActionProgress("selection-changed");

        this.pendingAction = null;
        this.selectedActionId = null;
        this.selectedEntity = entity;

        // HUD gets first crack at the entity → action mapping.
        this.onSelect?.(entity);

        // Fallback for entity kinds the HUD doesn't map (e.g. loot
        // drops). Runs after onSelect so a real HUD mapping wins.
        if (this.selectedActionId === null) {
            this.selectedActionId = this.inferAction(entity);
        }
    }

    inferAction(entity) {
        if (entity.lootContainer?.items?.length > 0) return "loot";

        switch (entity.type) {
            case "gather":
                return "gather";
            case "enemy":
                return "attack";
            case "cache":
                return "open";
            case "cave":
                return "enter";
            default:
                return null;
        }
    }

    clearSelection() {
        if (!this.selectedEntity) return;

        this.pendingAction = null;
        this.cancelActionProgress("selection-changed");
        this.selectedEntity = null;
        this.selectedActionId = null;

        this.onSelect?.(null);
    }

    // Non-enemy entity range checker
    inReach(entity) {
        const p = this.player;
        return (
            Math.hypot(p.x - entity.x, p.y - entity.y) <=
            p.r + (entity.r ?? 22) + INTERACT_REACH
        );
    }

    // Measure distance between player and entity
    getDistanceTo(entity) {
        return getDistance(this.player, entity);
    }

    // Enemy range checker
    isEnemyInAttackRange(entity) {
        if (!entity || entity.type !== "enemy") {
            return false;
        }

        return isWithinRange(this.player, entity, entity.attackRange);
    }

    /**
     * Screen-space position of an entity in page coordinates.
     * Returns { x, y, rect } or null if the canvas isn't mounted.
     * Correctly tracks camera panning and (for enemies) any
     * pursuit movement, since x/y are read live.
     */
    getEntityScreenPosition(entity) {
        if (!entity) return null;

        const rect = this.canvas?.getBoundingClientRect();
        if (!rect || !rect.width) return null;

        return {
            x: entity.x - this.camera.x + rect.left,
            y: entity.y - this.camera.y + rect.top,
            rect
        };
    }

    /**
     * Screen-space position of the player sprite in page coordinates.
     */
    getPlayerScreenPosition() {
        const rect = this.canvas?.getBoundingClientRect();
        if (!rect || !rect.width) return null;

        return {
            x: this.player.x - this.camera.x + rect.left,
            y: this.player.y - this.camera.y + rect.top,
            rect
        };
    }

    requestAction(entity, actionId) {
        if (!entity?.active) return;

        // Loot drops (defeated enemies, gathered nodes whose loot is
        // pending) use touch range — not combat range — even when the
        // entity's stored type is "enemy".
        if (entity.lootContainer?.items?.length > 0) {
            this.requestReachAction(entity, actionId);
            return;
        }

        if (actionId === "attack" && entity.type === "enemy") {
            this.requestCombatAction(entity, actionId);
            return;
        }

        this.requestReachAction(entity, actionId);
    }

    requestReachAction(entity, actionId) {
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
            p.tx = this.camera.clampWorldX(entity.x - (dx / dist) * stopDist);
            p.ty = this.camera.clampWorldY(entity.y - (dy / dist) * stopDist);
        }

        this.pendingAction = { entity, actionId };
    }

    requestCombatAction(entity, actionId) {
        if (!entity?.active || !Number.isFinite(entity.attackRange)) {
            return;
        }

        // Already close enough: execute the attack request.
        if (this.isEnemyInAttackRange(entity)) {
            this.pendingAction = null;
            this.executeAction(entity, actionId);
            return;
        }

        const p = this.player;

        const dx = entity.x - p.x;
        const dy = entity.y - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist === 0) return;

        // Stop slightly inside the range boundary to avoid
        // floating-point precision issues at the exact edge.
        const stopDist = Math.max(0, entity.attackRange - 2);

        p.tx = this.camera.clampWorldX(entity.x - (dx / dist) * stopDist);
        p.ty = this.camera.clampWorldY(entity.y - (dy / dist) * stopDist);

        this.pendingAction = { entity, actionId };
    }

    // ---------------------------------------------------------------
    // Timed actions
    // ---------------------------------------------------------------

    startGathering(entity) {
        if (!entity?.active) return;

        // Tapping the same target again must not restart its timer.
        if (
            this.actionProgress?.isActive &&
            this.actionProgress.entity === entity
        ) {
            return;
        }

        this.cancelActionProgress("replaced");

        const duration = entity.gatherDuration ?? 3;

        const action = new ActionProgress({
            type: "gather",
            duration,

            canContinue: () => {
                if (!entity.active) return "target-unavailable";
                if (this.selectedEntity !== entity) {
                    return "selection-changed";
                }
                if (!this.inReach(entity)) return "out-of-range";

                return true;
            },

            onComplete: () => {
                this.actionProgress = null;
                this.completeEntity(entity, "gather");
            }
        });

        // Keep the target alongside the reusable progress object.
        action.entity = entity;

        this.actionProgress = action;
    }

    cancelActionProgress(reason = "cancelled") {
        if (!this.actionProgress) return;

        const action = this.actionProgress;
        this.actionProgress = null;

        action.cancel(reason);
    }

    updateActionProgress(dt) {
        const action = this.actionProgress;
        if (!action) return;

        action.update(dt);

        // Completion callbacks may already have cleared the reference.
        if (this.actionProgress === action && !action.isActive) {
            this.actionProgress = null;
        }
    }

    executeAction(entity, actionId) {
        if (!entity?.active) return;

        // Pending loot is already gathered.
        // Reopening its container should never require more strikes.
        if (entity.lootContainer?.items?.length > 0) {
            this.completeEntity(entity, actionId);
            return;
        }

        // Gathering uses the reusable timed-action system.
        if (entity.type === "gather" && actionId === "gather") {
            this.startGathering(entity);
            return;
        }

        // Other entity actions are dispatched directly to ZoneScene.
        this.completeEntity(entity, actionId);
    }

    completeEntity(entity, actionId) {
        const rect = this.canvas.getBoundingClientRect();
        const screenPos = {
            clientX: rect.left + (entity.x - this.camera.x),
            clientY: rect.top + (entity.y - this.camera.y)
        };

        const result = this.onInteract?.(entity, screenPos, actionId);

        if (result === false) {
            entity.strikesLanded = 0;
            entity.cracks = [];
            return;
        }

        // Loot is waiting to be collected.
        // Keep the entity active and start/reset its expiration timer.
        if (result?.keepActive) {
            entity.lootDuration = result.lootDuration ?? this.lootDuration;
            entity.lootExpiresAt = this.time + entity.lootDuration;

            entity.strikesLanded = 0;
            entity.cracks = [];
            return;
        }

        // Ordinary interactions still consume the entity.
        this.consumeEntity(entity);
    }

    consumeEntity(entity, message = null) {
        if (!entity?.active) return false;

        // Cancel any pending action involving this entity.
        if (this.pendingAction?.entity === entity) {
            this.pendingAction = null;
        }
        if (this.actionProgress?.entity === entity) {
            this.cancelActionProgress("target-unavailable");
        }

        // Clear selection if this was the selected entity.
        if (this.selectedEntity === entity) {
            this.clearSelection();
        }

        entity.active = false;

        entity.respawnAt =
            entity.respawnSeconds === null
                ? Infinity
                : this.time + (entity.respawnSeconds ?? this.respawnDelay);

        entity.strikesLanded = 0;
        entity.cracks = [];

        this.showToast?.(message ?? `${entity.label ?? "Object"} recovered`);

        return true;
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
