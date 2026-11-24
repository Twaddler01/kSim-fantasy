// src/ui/panels/ZoneScene.js
//
// Adapter between a zone definition and ZoneCanvas.
//
// ZoneScene owns:
//   · Initial entity spawning (mixed by type via zone.spawnTable)
//   · Respawn logic per entity type
//   · Dispatch of interactions to the appropriate scene callback
//     (onGather, onEncounter, onOpenCache, onEnterCave)
//
// ZoneCanvas owns:
//   · Rendering, camera, input, tap-to-move, auto-approach
//   · Per-entity strike counting (strikesRequired / strikesLanded)
//   · Deactivation and respawn timing
//
// Entity types this scene understands:
//   "gather"  → tap gathers a raw material (existing behavior)
//   "enemy"   → tap opens an encounter (wired in Phase 4.5)
//   "cache"   → tap opens a loot cache (Phase 4.7)
//   "cave"    → tap enters a dungeon / POI (Phase 4.7)
//
// Zones can mix types in one spawnTable. Entities that have no
// corresponding scene callback stay in place when tapped (they do not
// disappear) and log a one-time warning to the dev console.

import ZoneCanvas from "./ZoneCanvas.js";
import { materials } from "../../data/materials.js";
import { getEnemy } from "../../data/enemies.js";
import { getCrumbColors } from "../../assets/icons/materials/materialDrawings.js";
import { WORLD_DEBUG } from "../../data/zones.js";
import { buildBackgroundCache } from "../../data/backgroundCache.js";

// Deterministic per-zone RNG so a zone looks the same across renders.
function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
}

function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export default class ZoneScene {
    constructor({
        zone,
        onSelect,
        onGather,
        onEncounter,
        onOpenCache,
        onEnterCave,
        getSprites = () => ({}),
        getTiles = () => null
    }) {
        this.zone = zone;
        this.onSelect = onSelect;
        this.onGather = onGather;
        this.onEncounter = onEncounter;
        this.onOpenCache = onOpenCache;
        this.onEnterCave = onEnterCave;
        this.getSprites = getSprites;
        this.getTiles = getTiles;
        this.rawMaterials = materials.filter(m => m.category === "raw");

        // Resolve tuning from the zone, with legacy zone names as fallbacks.
        this.world = {
            width: zone.world?.width ?? 1200,
            height: zone.world?.height ?? 900
        };
        this.entityCount = zone.entityCount ?? zone.depositCount ?? 10;
        this.entityRadius = zone.entityRadius ?? zone.depositRadius ?? 22;
        this.respawnDelay = zone.respawnSeconds ?? 3;
        this.margin = zone.margin ?? 80;
        this.minSpacing = zone.minSpacing ?? 100;

        this.backgroundCanvas = buildBackgroundCache(
            this.zone,
            this.world.width,
            this.world.height
        );

        this.canvas = new ZoneCanvas({
            entities: this.buildInitialEntities(),
            world: this.world,
            respawnDelay: this.respawnDelay,
            backgroundCanvas: this.backgroundCanvas,
            title: this.zone.name,
            onSelect: entity => {
                this.onSelect?.(this.getSelectedEntityData(entity));
            },
            onInteract: (entity, screenPos, actionId) =>
                this.handleInteract(entity, screenPos, actionId),
            onRespawn: entity => this.buildRespawn(entity),
            showToast: null,
            regions: this.zone.regions ?? [],
            showBoundaries: WORLD_DEBUG.showBoundaries
        });

        this.collected = 0;
    }

    getElement() {
        return this.canvas.getElement();
    }

    update() {
        this.canvas.update();
    }

    deactivate() {
        this.canvas.deactivate();
    }

    // -----------------------------------------------------------------
    // Entity building
    // -----------------------------------------------------------------

    buildInitialEntities() {
        const rand = seededRandom(hashString(this.zone.id));
        const list = [];

        let index = 0;

        // 1. Guaranteed zone placements.
        const guaranteed = this.zone.guaranteedSpawns ?? [];

        const guaranteedCount = guaranteed.reduce(
            (s, g) => s + (g.count ?? 0),
            0
        );

        for (const spec of guaranteed) {
            for (let i = 0; i < (spec.count ?? 0); i++) {
                const spawn = {
                    ...spec,
                    weight: 1
                };

                const entity = this.buildEntityFromSpawn(spawn, rand, index++);

                this.placeEntity(entity, list, rand);
                list.push(entity);
            }
        }

        // 2. Regional populations.
        for (const region of this.zone.regions ?? []) {
            const count = region.entityCount ?? 0;

            for (let i = 0; i < count; i++) {
                const spawn = this.pickSpawn(rand, region.spawnTable, false);

                if (!spawn) continue;

                const entity = this.buildEntityFromSpawn(spawn, rand, index++);

                entity.regionId = region.id;

                this.placeEntity(entity, list, rand, region);
                list.push(entity);
            }
        }

        // 3. Remaining world population.
        const worldCount = Math.max(0, this.entityCount - guaranteedCount);

        for (let i = 0; i < worldCount; i++) {
            const spawn = this.pickSpawn(rand);
            const entity = this.buildEntityFromSpawn(spawn, rand, index++);

            this.placeEntity(entity, list, rand);
            list.push(entity);
        }

        return list;
    }

    /**
     * Place an entity at a random world position, respecting margin and
     * minimum spacing from already-placed entities. Mutates entity.x / y.
     */
    placeEntity(entity, list, rand, region = null) {
        const { margin, minSpacing } = this;
        const ww = this.world.width;
        const wh = this.world.height;

        let x;
        let y;

        for (let attempts = 0; attempts < 100; attempts++) {
            if (region) {
                const point = this.getRandomRegionPoint(region, rand);
                if (!point) break;

                x = point.x;
                y = point.y;
            } else {
                x = margin + rand() * (ww - margin * 2);
                y = margin + rand() * (wh - margin * 2);
            }

            const tooClose = list.some(
                e =>
                    e.active !== false &&
                    Math.hypot(e.x - x, e.y - y) < minSpacing
            );

            if (!tooClose) break;
        }

        // If a region couldn't produce a point, use the world as a fallback.
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            x = margin + rand() * (ww - margin * 2);
            y = margin + rand() * (wh - margin * 2);
        }

        entity.x = x;
        entity.y = y;
    }
    getRandomRegionPoint(region, rand) {
        const shape = region.shape;

        if (!shape) return null;

        // Circle: uniform random distribution within the circle.
        if (shape.type === "circle") {
            const angle = rand() * Math.PI * 2;
            const distance = Math.sqrt(rand()) * shape.radius;

            return {
                x: shape.x + Math.cos(angle) * distance,
                y: shape.y + Math.sin(angle) * distance
            };
        }

        // Polygon: rejection sampling within its bounding rectangle.
        if (shape.type === "polygon" && shape.points?.length >= 3) {
            const points = shape.points;

            const minX = Math.min(...points.map(p => p.x));
            const maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y));
            const maxY = Math.max(...points.map(p => p.y));

            for (let i = 0; i < 100; i++) {
                const point = {
                    x: minX + rand() * (maxX - minX),
                    y: minY + rand() * (maxY - minY)
                };

                if (this.isPointInPolygon(point, points)) {
                    return point;
                }
            }
        }

        return null;
    }

    isPointInPolygon(point, points) {
        let inside = false;

        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[i];
            const b = points[j];

            const intersects =
                a.y > point.y !== b.y > point.y &&
                point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;

            if (intersects) inside = !inside;
        }

        return inside;
    }

    buildEntityFromSpawn(spawn, rand, index) {
        const type = spawn.type ?? "gather";
        switch (type) {
            case "gather":
                return this.buildGatherEntity(spawn, rand, index);
            case "enemy":
                return this.buildEnemyEntity(spawn, rand, index);
            case "cache":
                return this.buildCacheEntity(spawn, rand, index);
            case "cave":
                return this.buildCaveEntity(spawn, rand, index);
            default:
                return this.buildGatherEntity(spawn, rand, index);
        }
    }

    buildGatherEntity(spawn, rand, index) {
        const material =
            materials.find(m => m.id === spawn.materialId) ??
            this.rawMaterials[0];

        const richness = this.selectRichness(rand);
        const rotation = (rand() - 0.5) * 0.35;
        const scale = 0.9 + rand() * 0.2;
        const crumbs = this.makeCrumbs(rand, material.id, this.entityRadius);

        return {
            id: `${this.zone.id}-ent-${index}`,
            type: "gather",
            r: this.entityRadius,
            materialId: material.id,
            richness,
            strikesRequired: this.selectStrikes(richness, material.id),
            sparkleTier: this.selectSparkleTier(richness, material.id),
            showInteractionIndicator: true,
            label: material.name,
            sprite: this.getSpriteFor(material.id) ?? null,
            rotation,
            scale,
            crumbs,
            respawnSeconds: spawn.respawnSeconds ?? this.respawnDelay
        };
    }

    buildEnemyEntity(spawn, rand, index) {
        const enemy = getEnemy(spawn.enemyId);
        return {
            id: `${this.zone.id}-ent-${index}`,
            type: "enemy",
            r: this.entityRadius,
            enemyId: spawn.enemyId,
            label: spawn.label ?? enemy?.name ?? spawn.enemyId ?? "Enemy",
            icon: enemy?.icon ?? "⚠️",
            showInteractionIndicator: true,
            sprite: null,
            strikesRequired: 1,
            sparkleTier: 0,
            rotation: 0,
            scale: 1,
            crumbs: [],
            respawnSeconds: spawn.respawnSeconds ?? 60
        };
    }

    buildCacheEntity(spawn, rand, index) {
        return {
            id: `${this.zone.id}-ent-${index}`,
            type: "cache",
            r: this.entityRadius,
            lootTableId: spawn.lootTableId,
            label: spawn.label ?? "Cache",
            icon: "📦",
            showInteractionIndicator: true,
            sprite: null,
            strikesRequired: 1,
            sparkleTier: 0,
            rotation: 0,
            scale: 1,
            crumbs: [],
            respawnSeconds: spawn.respawnSeconds ?? 300
        };
    }

    buildCaveEntity(spawn, rand, index) {
        return {
            id: `${this.zone.id}-ent-${index}`,
            type: "cave",
            r: this.entityRadius,
            dungeonId: spawn.dungeonId,
            label: spawn.label ?? "Cave Entrance",
            icon: "🕳️",
            showInteractionIndicator: true,
            sprite: null,
            strikesRequired: 1,
            sparkleTier: 0,
            rotation: 0,
            scale: 1,
            crumbs: [],
            consumeOnInteract: false,
            respawnSeconds: null
        };
    }

    buildRespawn(oldEntity) {
        const rand = Math.random;

        const region = oldEntity.regionId
            ? this.zone.regions?.find(r => r.id === oldEntity.regionId)
            : null;

        const spawn = region
            ? this.pickSpawn(rand, region.spawnTable, false)
            : this.pickSpawn(rand);

        // If the original table is no longer valid, reconstruct
        // the previous entity type as a fallback.
        const fallbackSpawn = {
            type: oldEntity.type,
            materialId: oldEntity.materialId,
            enemyId: oldEntity.enemyId,
            lootTableId: oldEntity.lootTableId,
            dungeonId: oldEntity.dungeonId,
            respawnSeconds: oldEntity.respawnSeconds,
            label: oldEntity.label,
            weight: 1
        };

        const entity = this.buildEntityFromSpawn(
            spawn ?? fallbackSpawn,
            rand,
            0
        );

        entity.id = oldEntity.id;

        if (region) {
            entity.regionId = region.id;
        }

        const nearbyEntities = (this.canvas?.entities ?? []).filter(
            e => e !== oldEntity
        );

        this.placeEntity(entity, nearbyEntities, rand, region);

        return entity;
    }

    // -----------------------------------------------------------------
    // Spawn selection
    // -----------------------------------------------------------------

    pickSpawn(
        rand = Math.random,
        table = this.zone.spawnTable,
        allowFallback = true
    ) {
        const valid = (table ?? []).filter(
            entry => entry.weight > 0 && this.isValidSpawn(entry)
        );

        if (valid.length === 0) {
            if (!allowFallback) return null;

            // Legacy fallback: zone declares a single materialId.
            const m = materials.find(m => m.id === this.zone.materialId);

            return {
                type: "gather",
                materialId: m?.id ?? this.rawMaterials[0]?.id,
                weight: 1
            };
        }

        const total = valid.reduce((s, e) => s + e.weight, 0);
        let roll = rand() * total;

        for (const entry of valid) {
            roll -= entry.weight;
            if (roll < 0) return entry;
        }

        return valid[valid.length - 1];
    }

    isValidSpawn(entry) {
        const type = entry.type ?? "gather";
        switch (type) {
            case "gather":
                return (
                    Boolean(entry.materialId) &&
                    materials.some(m => m.id === entry.materialId)
                );
            case "enemy":
                return Boolean(entry.enemyId);
            case "cache":
                return Boolean(entry.lootTableId);
            case "cave":
                return Boolean(entry.dungeonId);
            default:
                return false;
        }
    }

    getSelectedEntityData(entity) {
        if (!entity) return null;

        switch (entity.type) {
            case "enemy": {
                const enemy = getEnemy(entity.enemyId);

                if (!enemy) return null;

                return {
                    entity,
                    type: "enemy",
                    name: enemy.name,
                    subtitle: "Enemy",
                    icon: enemy.icon,
                    level: enemy.level,
                    hp: enemy.hp,
                    maxHealth: enemy.hp
                };
            }

            case "gather": {
                const material = materials.find(
                    m => m.id === entity.materialId
                );

                return {
                    entity,
                    type: "gather",
                    name: material?.name ?? entity.label ?? "Gatherable",
                    subtitle: "Gatherable",
                    icon: entity.icon ?? "🌿"
                };
            }

            case "cache":
                return {
                    entity,
                    type: "cache",
                    name: entity.label ?? "Cache",
                    subtitle: "Lootable",
                    icon: entity.icon ?? "📦"
                };

            case "cave":
                return {
                    entity,
                    type: "cave",
                    name: entity.label ?? "Cave Entrance",
                    subtitle: "Enterable",
                    icon: entity.icon ?? "🕳️"
                };

            default:
                return {
                    entity,
                    type: entity.type ?? "unknown",
                    name: entity.label ?? "Unknown Entity",
                    subtitle: "Interactable",
                    icon: entity.icon ?? "❔"
                };
        }
    }

    // -----------------------------------------------------------------
    // Requested entity actions
    // -----------------------------------------------------------------

    performAction(actionId, entity) {
        if (!entity || !entity.active) return;

        this.canvas.requestAction(entity, actionId);
    }

    setSelectedAction(actionId, entity) {
        if (!entity || !entity.active) {
            this.canvas.setSelectedAction(null, null);
            return;
        }

        this.canvas.setSelectedAction(actionId, entity);
    }

    // -----------------------------------------------------------------
    // Interaction dispatch
    // -----------------------------------------------------------------

    /**
     * Returns true if the interaction consumed the entity (ZoneCanvas
     * will deactivate and schedule a respawn). Returns false to leave
     * the entity in place — e.g. when a handler is not wired yet.
     */
    handleInteract(entity, screenPos, actionId) {
        switch (entity.type) {
            case "gather": {
                if (actionId !== "gather") return false;
                if (!this.onGather) {
                    console.warn(
                        "[ZoneScene] No onGather handler; entity not processed:",
                        entity.materialId
                    );
                    return false;
                }
                const ok = this.onGather(this.zone, screenPos, {
                    id: entity.materialId,
                    richness: entity.richness
                });
                return ok !== false;
            }

            case "enemy": {
                if (actionId !== "attack") return false;
                if (!this.onEncounter) {
                    console.warn(
                        "[ZoneScene] No onEncounter handler; enemy not processed:",
                        entity.enemyId
                    );
                    return false;
                }
                const handled = this.onEncounter(this.zone, screenPos, {
                    enemyId: entity.enemyId
                });
                return handled !== false;
            }

            case "cache": {
                if (actionId !== "loot") return false;
                if (!this.onOpenCache) {
                    console.warn(
                        "[ZoneScene] No onOpenCache handler; cache not processed:",
                        entity.lootTableId
                    );
                    return false;
                }
                this.onOpenCache(this.zone, screenPos, {
                    lootTableId: entity.lootTableId
                });
                return true;
            }

            case "cave": {
                if (actionId !== "enter") return false;
                if (!this.onEnterCave) {
                    console.warn(
                        "[ZoneScene] No onEnterCave handler; cave not processed:",
                        entity.dungeonId
                    );
                    return false;
                }
                this.onEnterCave(this.zone, screenPos, {
                    dungeonId: entity.dungeonId
                });
                // Caves are POIs: even with a handler, keep them present.
                return false;
            }

            default:
                return false;
        }
    }

    // -----------------------------------------------------------------
    // Sprites and background
    // -----------------------------------------------------------------

    getSpriteFor(materialId, variant = "zone") {
        const entry = this.getSprites()[materialId];
        if (!entry) return null;

        // Legacy flat cache: { stone: Image }
        if (!entry.core && !entry.zone) return entry;

        // Nested cache: { stone: { core, zone } }
        return entry[variant] ?? entry.core ?? null;
    }

    refreshSprites() {
        for (const e of this.canvas.entities) {
            if (e.type !== "gather") continue;
            e.sprite = this.getSpriteFor(e.materialId);
        }
    }

    refreshBackground() {
        if (!this.zone.background) return;
        const cache = buildBackgroundCache(
            this.zone,
            this.world.width,
            this.world.height
        );
        if (cache === this.backgroundCanvas) return;
        this.backgroundCanvas = cache;
        this.canvas?.setBackground(cache);
    }

    // -----------------------------------------------------------------
    // Random rolls (gather only)
    // -----------------------------------------------------------------

    selectRichness(rand = Math.random) {
        const table = this.zone.richnessTable ?? [{ amount: 1, weight: 1 }];

        const valid = table.filter(
            e =>
                Number.isFinite(e.amount) &&
                e.amount >= 1 &&
                Number.isFinite(e.weight) &&
                e.weight > 0
        );

        if (valid.length === 0) return 1;

        const total = valid.reduce((s, e) => s + e.weight, 0);
        let roll = rand() * total;
        for (const e of valid) {
            roll -= e.weight;
            if (roll < 0) return e.amount;
        }
        return valid[valid.length - 1].amount;
    }

    selectStrikes(richness, materialId) {
        // 1. Zone override (opt-in)
        const table = this.zone.strikeCountTable;
        if (Array.isArray(table)) {
            const entry = table.find(e => e.richness === richness);
            if (entry && Number.isFinite(entry.strikes)) {
                return Math.max(1, Math.round(entry.strikes));
            }
        }

        // 2. Material base + richness scaling
        const material = materials.find(m => m.id === materialId);
        const base = material?.mining?.strikesBase ?? 2;
        return Math.max(1, base + (richness - 1));
    }

    selectSparkleTier(richness, materialId) {
        // 1. Zone override (opt-in)
        const table = this.zone.sparkleTable;
        if (Array.isArray(table)) {
            const entry = table.find(e => e.richness === richness);
            if (entry && Number.isFinite(entry.tier)) {
                return Math.max(0, Math.min(3, entry.tier));
            }
        }

        // 2. Material base + richness scaling
        const material = materials.find(m => m.id === materialId);
        const base = material?.mining?.sparkleBase ?? 0;
        return Math.max(0, Math.min(3, base + (richness - 1)));
    }

    makeCrumbs(rand, materialId, depositRadius) {
        const colors = getCrumbColors(materialId) ?? ["#586378"];
        const count = 5 + Math.floor(rand() * 3); // 3–5 crumbs

        const crumbs = [];
        for (let i = 0; i < count; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = depositRadius * (0.8 + rand() * 0.8);

            crumbs.push({
                dx: Math.cos(angle) * dist,
                dy: Math.sin(angle) * dist * 0.7,
                r: 1 + rand() * 1.5,
                color: colors[Math.floor(rand() * colors.length)],
                alpha: 0.55 + rand() * 0.35
            });
        }
        return crumbs;
    }
}
