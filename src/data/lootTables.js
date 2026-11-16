// src/data/lootTables.js
//
// Standalone loot tables for caches and caves. Enemies carry their own
// tables inline (enemies.js); these are for world-side reward sources.
//
// Same entry shape everywhere: { itemId, weight, minQty, maxQty }.
// weight is a percentage (0–100).

export const lootTables = {
    meadowCache: [
        { itemId: "sunpetal", weight: 60, minQty: 2, maxQty: 4 },
        { itemId: "oakLog", weight: 30, minQty: 1, maxQty: 2 },
        { itemId: "ironDagger", weight: 10, minQty: 1, maxQty: 1 }
    ],

    whisperingCaveLoot: [
        { itemId: "moonbloom", weight: 50, minQty: 1, maxQty: 2 },
        { itemId: "focusTonic", weight: 30, minQty: 1, maxQty: 1 },
        { itemId: "voidShard", weight: 20, minQty: 1, maxQty: 1 }
    ]
};

export function getLootTable(lootTableId) {
    return lootTables[lootTableId] ?? null;
}
