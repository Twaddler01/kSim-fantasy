export const WORLD_DEBUG = {
    showBoundaries: true
};

export const ZONE_DEFINITIONS = [
    {
        id: "whisperingMeadow",
        name: "Whispering Meadow",
        visualVariant: "meadow",
        icon: "🌿",
        mapPosition: { x: 32, y: 73 },
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
        regions: [
            {
                id: "flowerMeadow",
                name: "Flower Meadow",

                population: {
                    initial: 6,
                    max: 6,
                    respawnSeconds: 20
                },

                shape: {
                    type: "circle",
                    x: 300,
                    y: 300,
                    radius: 140
                },

                debugColor: "#4ade80",

                label: {
                    x: 300,
                    y: 170
                },

                spawnTable: [
                    { type: "gather", materialId: "sunpetal", weight: 70 },
                    { type: "gather", materialId: "moonbloom", weight: 30 }
                ]
            },

            {
                id: "wolfTerritory",
                name: "Wolf Territory",

                population: {
                    initial: 4,
                    max: 4,
                    respawnSeconds: 60
                },

                shape: {
                    type: "polygon",
                    points: [
                        { x: 620, y: 140 },
                        { x: 850, y: 170 },
                        { x: 900, y: 340 },
                        { x: 790, y: 480 },
                        { x: 610, y: 410 },
                        { x: 560, y: 260 }
                    ]
                },

                debugColor: "#f87171",

                label: {
                    x: 730,
                    y: 190
                },

                spawnTable: [
                    { type: "enemy", enemyId: "meadowWolf", weight: 100 }
                ]
            }
        ],
        margin: 80,
        minSpacing: 100,
        entityRadius: 22,
        strikeCountTable: null,
        sparkleTable: null,

        // Guaranteed spawns — placed first, always present, unaffected by RNG.
        guaranteedSpawns: [
            { type: "enemy", enemyId: "meadowWolf", count: 2 },
            { type: "cache", lootTableId: "meadowCache", count: 1 },
            {
                type: "cave",
                dungeonId: "whisperingCave",
                lootTableId: "whisperingCaveLoot",
                count: 1
            }
        ],

        spawnTable: [
            { type: "gather", materialId: "oakLog", weight: 22 },
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
        mapPosition: { x: 75, y: 38 },
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
    },
    {
        id: "ashenbrook",
        name: "Ashenbrook",
        type: "town",
        townId: "ashenbrook",
        visualVariant: "town",
        icon: "🏘️",
        mapPosition: { x: 52, y: 52 },
        description:
            "A small settlement nestled in the valley. A welcome refuge for travelers.",
        unlockTrigger: null
    }
];

export function getZoneIconMaterialId(zone) {
    if (!zone) return null;
    if (zone.materialId) return zone.materialId;

    const entries = [
        ...(zone.spawnTable ?? []),
        ...(zone.regions ?? []).flatMap(r => r.spawnTable ?? [])
    ];

    const spawn = entries
        .filter(e => (e.type ?? "gather") === "gather" && e.weight > 0)
        .sort((a, b) => b.weight - a.weight)[0];

    return spawn?.materialId ?? null;
}

/**
 * Gatherable-material breakdown for the zone selector card.
 * Includes guaranteed gather spawns (e.g. iron veins) so the card
 * reflects what the player will actually see, not just the weighted
 * table. Non-gather guaranteed spawns (enemies, caches, caves) are
 * intentionally excluded — the card shows materials only.
 */
export function getZoneSpawnBreakdown(zone) {
    const guaranteedGathers = (zone.guaranteedSpawns ?? [])
        .filter(g => g.type === "gather" && g.materialId)
        .flatMap(g =>
            Array.from({ length: g.count ?? 0 }, () => ({
                materialId: g.materialId,
                weight: 1
            }))
        );

    const weightedGathers = [
        ...(zone.spawnTable ?? []),
        ...(zone.regions ?? []).flatMap(r => r.spawnTable ?? [])
    ].filter(e => (e.type ?? "gather") === "gather" && e.weight > 0);

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
