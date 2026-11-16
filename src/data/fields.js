export const FIELD_DEFINITIONS = [
    {
        id: "whisperingMeadow",
        name: "Whispering Meadow",
        visualVariant: "meadow",
        icon: "🌿",
        description:
            "A quiet meadow at the valley's edge. Herbs grow thick here, and old oak branches lie scattered in the grass.",
        unlockTrigger: null,

        background: {
            tileset: "grassland",
            tileSize: 40,
            baseColor: "#2d3d2a",
            patchScale: 1.6,
            baseTiles: [
                { tile: "grassA", weight: 60 },
                { tile: "grassB", weight: 40 }
            ],
            scatter: [
                { tile: "flowers", weight: 7 },
                { tile: "smallRock", weight: 2 }
            ],
            scatterDensity: 0.14
        },
        entityCount: 10,
        respawnSeconds: 5,
        world: { width: 1200, height: 900 },
        margin: 80,
        minSpacing: 100,
        entityRadius: 22,
        strikeCountTable: null,
        sparkleTable: null,

        // Guaranteed spawns — placed first, always present, unaffected by RNG.
        guaranteedSpawns: [
            { type: "enemy", enemyId: "meadowWolf", count: 2 },
            { type: "cache", lootTableId: "meadowCache", count: 1 }
        ],

        spawnTable: [
            { type: "enemy", enemyId: "meadowWolf", weight: 15 },
            { type: "gather", materialId: "sunpetal", weight: 45 },
            { type: "gather", materialId: "oakLog", weight: 22 },
            { type: "gather", materialId: "moonbloom", weight: 10 },
            { type: "cache", lootTableId: "meadowCache", weight: 8 }
        ],
        richnessTable: [
            { amount: 1, weight: 70 },
            { amount: 2, weight: 20 },
            { amount: 3, weight: 8 },
            { amount: 4, weight: 2 }
        ]
    },
    {
        id: "ironhollowMine",
        name: "Ironhollow Mine",
        visualVariant: "mine",
        icon: "⛏️",
        description:
            "An old prospecting cut in the hillside. Iron, copper, and coal — if you can find a vein.",
        unlockTrigger: {
            type: "inventoryAmount",
            item: "oakLog",
            amount: 5
        },

        background: {
            tileset: "grassland",
            tileSize: 40,
            baseColor: "#252a26",
            patchScale: 1.5,
            baseTiles: [
                { tile: "grassA", weight: 70 },
                { tile: "grassB", weight: 30 }
            ],
            scatter: [{ tile: "smallRock", weight: 5 }],
            scatterDensity: 0.09
        },
        entityCount: 10,
        respawnSeconds: 6,
        world: { width: 1200, height: 900 },
        margin: 80,
        minSpacing: 100,
        entityRadius: 22,
        strikeCountTable: null,
        sparkleTable: null,

        // The mine always has at least 3 iron veins. Prevents Quest 2 from
        // stalling on an unlucky seed.
        guaranteedSpawns: [{ type: "gather", materialId: "ironOre", count: 3 }],

        spawnTable: [
            { type: "gather", materialId: "ironOre", weight: 35 },
            { type: "gather", materialId: "copperOre", weight: 30 },
            { type: "gather", materialId: "coal", weight: 35 }
        ],
        richnessTable: [
            { amount: 1, weight: 55 },
            { amount: 2, weight: 25 },
            { amount: 3, weight: 15 },
            { amount: 5, weight: 5 }
        ]
    }
];

export function getFieldIconMaterialId(field) {
    if (!field) return null;
    if (field.materialId) return field.materialId;

    const spawn = [...(field.spawnTable ?? [])]
        .filter(e => (e.type ?? "gather") === "gather" && e.weight > 0)
        .sort((a, b) => b.weight - a.weight)[0];

    return spawn?.materialId ?? null;
}

/**
 * Gatherable-material breakdown for the field selector card.
 * Includes guaranteed gather spawns (e.g. iron veins) so the card
 * reflects what the player will actually see, not just the weighted
 * table. Non-gather guaranteed spawns (enemies, caches, caves) are
 * intentionally excluded — the card shows materials only.
 */
export function getFieldSpawnBreakdown(field) {
    const guaranteedGathers = (field.guaranteedSpawns ?? [])
        .filter(g => g.type === "gather" && g.materialId)
        .flatMap(g =>
            Array.from({ length: g.count ?? 0 }, () => ({
                materialId: g.materialId,
                weight: 1
            }))
        );

    const weightedGathers = (field.spawnTable ?? []).filter(
        e => (e.type ?? "gather") === "gather" && e.weight > 0
    );

    const combined = [...guaranteedGathers, ...weightedGathers];
    const total = combined.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) return [];

    // Merge same-material entries (e.g. guaranteed iron + weighted iron)
    // so the card shows one chip per material, not duplicates.
    const byMaterial = new Map();
    for (const entry of combined) {
        byMaterial.set(
            entry.materialId,
            (byMaterial.get(entry.materialId) ?? 0) + entry.weight
        );
    }

    return [...byMaterial.entries()]
        .map(([materialId, weight]) => ({
            materialId,
            weight,
            percent: (weight / total) * 100
        }))
        .sort((a, b) => b.percent - a.percent);
}
