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
        spawnTable: [
            { type: "enemy", enemyId: "meadowWolf", weight: 15 },
            { type: "gather", materialId: "sunpetal", weight: 50 },
            { type: "gather", materialId: "oakLog", weight: 22 },
            { type: "gather", materialId: "moonbloom", weight: 13 }
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
        spawnTable: [
            { type: "gather", materialId: "ironOre", weight: 45 },
            { type: "gather", materialId: "copperOre", weight: 30 },
            { type: "gather", materialId: "coal", weight: 25 }
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

export function getFieldSpawnBreakdown(field) {
    const table = (field?.spawnTable ?? []).filter(
        e => (e.type ?? "gather") === "gather"
    );
    const total = table.reduce((s, e) => s + (e.weight > 0 ? e.weight : 0), 0);
    if (total <= 0) return [];

    return table
        .filter(e => e.weight > 0)
        .map(e => ({
            materialId: e.materialId,
            weight: e.weight,
            percent: (e.weight / total) * 100
        }))
        .sort((a, b) => b.weight - a.weight);
}
