// src/ui/panels/FieldScene.js
//
// Adapter between a field definition and FieldCanvas.
//
// FieldScene owns:
//   · Initial entity spawning (mixed by type via field.spawnTable)
//   · Respawn logic per entity type
//   · Dispatch of interactions to the appropriate scene callback
//     (onGather, onEncounter, onOpenCache, onEnterCave)
//
// FieldCanvas owns:
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
// Fields can mix types in one spawnTable. Entities that have no
// corresponding scene callback stay in place when tapped (they do not
// disappear) and log a one-time warning to the dev console.

import FieldCanvas from "./FieldCanvas.js";
import { materials } from "../../data/materials.js";
import { getCrumbColors } from "../../assets/icons/materials/materialDrawings.js";
import { buildBackgroundCache } from "../../data/backgroundCache.js";

// Deterministic per-field RNG so a field looks the same across renders.
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

export default class FieldScene {
    constructor({
        field,
        onGather,
        onEncounter,
        onOpenCache,
        onEnterCave,
        getSprites = () => ({}),
        getTiles = () => null
    }) {
        this.field = field;
        this.onGather = onGather;
        this.onEncounter = onEncounter;
        this.onOpenCache = onOpenCache;
        this.onEnterCave = onEnterCave;
        this.getSprites = getSprites;
        this.getTiles = getTiles;
        this.rawMaterials = materials.filter(m => m.category === "raw");

        // Resolve tuning from the field, with legacy field names as fallbacks.
        this.world = {
            width: field.world?.width ?? 1200,
            height: field.world?.height ?? 900
        };
        this.entityCount = field.entityCount ?? field.depositCount ?? 10;
        this.entityRadius = field.entityRadius ?? field.depositRadius ?? 22;
        this.respawnDelay = field.respawnSeconds ?? 3;
        this.margin = field.margin ?? 80;
        this.minSpacing = field.minSpacing ?? 100;

        this.backgroundCanvas = buildBackgroundCache(
            this.field,
            this.world.width,
            this.world.height
        );

        this.canvas = new FieldCanvas({
            entities: this.buildInitialEntities(),
            world: this.world,
            respawnDelay: this.respawnDelay,
            backgroundCanvas: this.backgroundCanvas,
            title: this.field.name,
            onInteract: (entity, screenPos) =>
                this.handleInteract(entity, screenPos),
            onRespawn: entity => this.buildRespawn(entity),
            showToast: null
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
        const rand = seededRandom(hashString(this.field.id));
        const list = [];
        const { margin, minSpacing, entityRadius, entityCount } = this;
        const ww = this.world.width;
        const wh = this.world.height;

        for (let i = 0; i < entityCount; i++) {
            const spawn = this.pickSpawn(rand);
            const entity = this.buildEntityFromSpawn(spawn, rand, i);

            let x,
                y,
                attempts = 0;
            do {
                x = margin + rand() * (ww - margin * 2);
                y = margin + rand() * (wh - margin * 2);
                attempts++;
            } while (
                attempts < 40 &&
                list.some(e => Math.hypot(e.x - x, e.y - y) < minSpacing)
            );

            entity.x = x;
            entity.y = y;
            list.push(entity);
        }

        return list;
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
            id: `${this.field.id}-ent-${index}`,
            type: "gather",
            r: this.entityRadius,
            materialId: material.id,
            richness,
            strikesRequired: this.selectStrikes(richness, material.id),
            sparkleTier: this.selectSparkleTier(richness, material.id),
            label: material.name,
            sprite: this.getSpriteFor(material.id) ?? null,
            rotation,
            scale,
            crumbs,
            respawnSeconds: spawn.respawnSeconds ?? this.respawnDelay
        };
    }

    buildEnemyEntity(spawn, rand, index) {
        return {
            id: `${this.field.id}-ent-${index}`,
            type: "enemy",
            r: this.entityRadius,
            enemyId: spawn.enemyId,
            label: spawn.label ?? spawn.enemyId ?? "Enemy",
            sprite: null, // populated in Phase 4.3 when enemy icons exist
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
            id: `${this.field.id}-ent-${index}`,
            type: "cache",
            r: this.entityRadius,
            lootTableId: spawn.lootTableId,
            label: spawn.label ?? "Cache",
            sprite: null, // Phase 4.7 will add a chest sprite
            strikesRequired: 1,
            sparkleTier: 0,
            rotation: 0,
            scale: 1,
            crumbs: [],
            respawnSeconds:
                spawn.respawnSeconds === undefined
                    ? null // caches default to one-shot
                    : spawn.respawnSeconds
        };
    }

    buildCaveEntity(spawn, rand, index) {
        return {
            id: `${this.field.id}-ent-${index}`,
            type: "cave",
            r: this.entityRadius,
            dungeonId: spawn.dungeonId,
            label: spawn.label ?? "Cave Entrance",
            sprite: null, // Phase 4.7 will add a cave sprite
            strikesRequired: 1,
            sparkleTier: 0,
            rotation: 0,
            scale: 1,
            crumbs: [],
            // Caves are POIs: they do not disappear when entered.
            consumeOnInteract: false,
            respawnSeconds: null
        };
    }

    buildRespawn(oldEntity) {
        const rand = Math.random;
        const { margin } = this;
        const ww = this.world.width;
        const wh = this.world.height;

        const spawn = {
            type: oldEntity.type,
            materialId: oldEntity.materialId,
            enemyId: oldEntity.enemyId,
            lootTableId: oldEntity.lootTableId,
            dungeonId: oldEntity.dungeonId,
            respawnSeconds: oldEntity.respawnSeconds,
            label: oldEntity.label,
            weight: 1
        };

        const entity = this.buildEntityFromSpawn(spawn, rand, 0);
        entity.id = oldEntity.id;

        entity.x = margin + rand() * (ww - margin * 2);
        entity.y = margin + rand() * (wh - margin * 2);

        return entity;
    }

    // -----------------------------------------------------------------
    // Spawn selection
    // -----------------------------------------------------------------

    pickSpawn(rand = Math.random) {
        const table = this.field.spawnTable ?? [];
        const valid = table.filter(
            entry => entry.weight > 0 && this.isValidSpawn(entry)
        );

        if (valid.length === 0) {
            // Legacy fallback: field declares a single materialId.
            const m = materials.find(m => m.id === this.field.materialId);
            return {
                type: "gather",
                materialId: m?.id ?? this.rawMaterials[0]?.id,
                weight: 1
            };
        }

        const total = valid.reduce((s, e) => s + e.weight, 0);
        let roll = rand() * total;
        for (const e of valid) {
            roll -= e.weight;
            if (roll < 0) return e;
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

    // -----------------------------------------------------------------
    // Interaction dispatch
    // -----------------------------------------------------------------

    /**
     * Returns true if the interaction consumed the entity (FieldCanvas
     * will deactivate and schedule a respawn). Returns false to leave
     * the entity in place — e.g. when a handler is not wired yet.
     */
    handleInteract(entity, screenPos) {
        switch (entity.type) {
            case "gather": {
                if (!this.onGather) {
                    console.warn(
                        "[FieldScene] No onGather handler; entity not processed:",
                        entity.materialId
                    );
                    return false;
                }
                const ok = this.onGather(this.field, screenPos, {
                    id: entity.materialId,
                    richness: entity.richness
                });
                return ok !== false;
            }

            case "enemy": {
                if (!this.onEncounter) {
                    console.warn(
                        "[FieldScene] No onEncounter handler; enemy not processed:",
                        entity.enemyId
                    );
                    return false;
                }
                this.onEncounter(this.field, screenPos, {
                    enemyId: entity.enemyId
                });
                return true;
            }

            case "cache": {
                if (!this.onOpenCache) {
                    console.warn(
                        "[FieldScene] No onOpenCache handler; cache not processed:",
                        entity.lootTableId
                    );
                    return false;
                }
                this.onOpenCache(this.field, screenPos, {
                    lootTableId: entity.lootTableId
                });
                return true;
            }

            case "cave": {
                if (!this.onEnterCave) {
                    console.warn(
                        "[FieldScene] No onEnterCave handler; cave not processed:",
                        entity.dungeonId
                    );
                    return false;
                }
                this.onEnterCave(this.field, screenPos, {
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

    getSpriteFor(materialId, variant = "field") {
        const entry = this.getSprites()[materialId];
        if (!entry) return null;

        // Legacy flat cache: { stone: Image }
        if (!entry.core && !entry.field) return entry;

        // Nested cache: { stone: { core, field } }
        return entry[variant] ?? entry.core ?? null;
    }

    refreshSprites() {
        for (const e of this.canvas.entities) {
            if (e.type !== "gather") continue;
            e.sprite = this.getSpriteFor(e.materialId);
        }
    }

    refreshBackground() {
        if (!this.field.background) return;
        const cache = buildBackgroundCache(
            this.field,
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
        const table = this.field.richnessTable ?? [{ amount: 1, weight: 1 }];

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
        // 1. Field override (opt-in)
        const table = this.field.strikeCountTable;
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
        // 1. Field override (opt-in)
        const table = this.field.sparkleTable;
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
