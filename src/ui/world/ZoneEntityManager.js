export default class ZoneEntityManager {
    constructor({
        entities = [],
        time = () => 0,
        respawnDelay = 3,
        onRespawn = null,
        makeFallbackEntity = null,
        makeSparkles = null,
        onConsume = null,
        onLootExpired = null
    } = {}) {
        this.entities = entities;
        this.getTime = time;
        this.respawnDelay = respawnDelay;
        this.onRespawn = onRespawn;
        this.makeFallbackEntity = makeFallbackEntity;
        this.makeSparkles = makeSparkles;
        this.onConsume = onConsume;
        this.onLootExpired = onLootExpired;
    }

    update() {
        this.completeCollectedLoot();
        this.expireLoot();
        this.respawnEntities();
    }

    completeCollectedLoot() {
        for (const entity of this.entities) {
            if (
                !entity.active ||
                !entity.lootContainer ||
                entity.lootContainer.items.length > 0
            ) {
                continue;
            }

            entity.lootContainer = null;
            entity.lootDuration = 0;
            entity.lootExpiresAt = 0;

            this.onConsume?.(entity, `${entity.label ?? "Object"} recovered`);
        }
    }

    expireLoot() {
        const now = this.getTime();

        for (const entity of this.entities) {
            if (
                !entity.active ||
                !entity.lootContainer ||
                !Number.isFinite(entity.lootExpiresAt) ||
                now < entity.lootExpiresAt
            ) {
                continue;
            }

            this.onLootExpired?.(entity);

            entity.lootContainer = null;
            entity.lootDuration = 0;
            entity.lootExpiresAt = 0;

            this.onConsume?.(
                entity,
                `${entity.label ?? "Object"} loot expired`
            );
        }
    }

    respawnEntities() {
        const now = this.getTime();

        for (const entity of this.entities) {
            if (entity.active || now < entity.respawnAt) continue;

            const fresh = this.onRespawn
                ? this.onRespawn(entity)
                : this.makeFallbackEntity?.();

            if (!fresh) continue;

            Object.assign(entity, fresh, {
                pulse: 0,
                active: true,
                respawnAt: 0,
                strikesLanded: 0,
                cracks: []
            });

            entity.sparkles =
                this.makeSparkles?.(entity.sparkleTier ?? 0, entity.r ?? 22) ??
                [];
        }
    }
}
