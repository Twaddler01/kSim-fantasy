// src/data/enemies.js
//
// Enemy stat blocks and loot tables. Pure data plus a lookup.
// Fixed stats — no scaling to player level. Elite variants get their own
// entry when they exist.

export const enemies = [
    {
        id: "meadowWolf",
        name: "Meadow Wolf",
        icon: "🐺",
        description: "Lean, gray, and hungry. Rarely alone for long.",
        level: 1,
        hp: 30,
        attack: 6,
        defense: 2,
        crit: 0.05,
        attackSpeed: 2.5,
        
        // World-unit distances, measured center to center.
        attackRange: 85,
        detectionRange: 260,
        pursuitRange: 380,
        
        xp: 15,
        goldRange: [3, 8],
        lootTable: [
            { itemId: "wolfHide", weight: 80, minQty: 1, maxQty: 2 },
            { itemId: "sunpetal", weight: 20, minQty: 1, maxQty: 1 }
        ]
    }
];

export function getEnemy(enemyId) {
    return enemies.find(e => e.id === enemyId) ?? null;
}
