// src/data/materials.js

export const materials = [
    // ==========================================
    // RAW — gathered from zones or dropped
    // ==========================================
    {
        id: "ironOre",
        name: "Iron Ore",
        category: "raw",
        subtype: "ore",
        tier: 1,
        icon: "🪨",
        description:
            "A chunk of rock heavy with iron. Smelts into usable ingots.",
        mining: { strikesBase: 6, sparkleBase: 0 }
    },
    {
        id: "copperOre",
        name: "Copper Ore",
        category: "raw",
        subtype: "ore",
        tier: 1,
        icon: "🟠",
        description: "A softer ore, useful for early tools and alloys.",
        mining: { strikesBase: 5, sparkleBase: 0 }
    },
    {
        id: "coal",
        name: "Coal",
        category: "raw",
        subtype: "mineral",
        tier: 1,
        icon: "⬛",
        description: "Black, brittle, and burns hot. Fuel for the forge.",
        mining: { strikesBase: 4, sparkleBase: 0 }
    },
    {
        id: "sunpetal",
        name: "Sunpetal",
        category: "raw",
        subtype: "herb",
        tier: 1,
        icon: "🌻",
        description:
            "A small golden flower, warm to the touch. Common in meadows.",
        mining: { strikesBase: 3, sparkleBase: 0 }
    },
    {
        id: "moonbloom",
        name: "Moonbloom",
        category: "raw",
        subtype: "herb",
        tier: 2,
        icon: "🌙",
        description: "A pale blue flower that only opens under moonlight.",
        mining: { strikesBase: 5, sparkleBase: 1 }
    },
    {
        id: "oakLog",
        name: "Oak Log",
        category: "raw",
        subtype: "wood",
        tier: 1,
        icon: "🌳",
        description:
            "A sturdy log, useful for handles and simple construction.",
        mining: { strikesBase: 4, sparkleBase: 0 }
    },
    {
        id: "wolfHide",
        name: "Wolf Hide",
        category: "raw",
        subtype: "hide",
        tier: 1,
        icon: "🐺",
        description: "A rough pelt, still smelling of pine and blood.",
        // Not mined from a zone — dropped by creatures in battle.
        mining: { strikesBase: 1, sparkleBase: 0 }
    },
    {
        id: "voidShard",
        name: "Void Shard",
        category: "raw",
        subtype: "anomalous",
        tier: 3,
        icon: "💠",
        description: "A crystal that seems to drink the light around it.",
        mining: { strikesBase: 12, sparkleBase: 2 }
    },

    // ==========================================
    // PROCESSED — crafted from raw
    // ==========================================
    {
        id: "ironIngot",
        name: "Iron Ingot",
        category: "processed",
        subtype: "metal",
        tier: 1,
        icon: "🔩",
        description: "A refined bar of iron. The base of most smithing work."
    },
    {
        id: "steelIngot",
        name: "Steel Ingot",
        category: "processed",
        subtype: "metal",
        tier: 2,
        icon: "⚙️",
        description: "Iron hardened with coal. Suitable for weapons."
    },
    {
        id: "healingPotion",
        name: "Healing Potion",
        category: "processed",
        subtype: "potion",
        tier: 1,
        icon: "🧪",
        description: "Restores a modest amount of health when consumed."
    },
    {
        id: "focusTonic",
        name: "Focus Tonic",
        category: "processed",
        subtype: "potion",
        tier: 1,
        icon: "🍶",
        description: "Sharpens the mind and restores mana."
    },

    // ==========================================
    // CRAFTED — finished equipment
    // ==========================================
    {
        id: "ironDagger",
        name: "Iron Dagger",
        category: "crafted",
        subtype: "equipment",
        tier: 1,
        icon: "🗡️",
        description: "A basic iron blade. Light and quick.",
        equipment: {
            slot: "mainHand",
            weaponType: "melee",
            stats: { attack: 4 }
        }
    },
    {
        id: "ironSword",
        name: "Iron Sword",
        category: "crafted",
        subtype: "equipment",
        tier: 2,
        icon: "⚔️",
        description:
            "A serviceable steel sword. No one will write a song about it.",
        equipment: {
            slot: "mainHand",
            weaponType: "melee",
            stats: { attack: 8 }
        }
    },
    {
        id: "leatherVest",
        name: "Leather Vest",
        category: "crafted",
        subtype: "equipment",
        tier: 1,
        icon: "🦺",
        description: "Simple hide armor. Better than nothing.",
        equipment: {
            slot: "chest",
            stats: { defense: 3, health: 10 }
        }
    },
    {
        id: "runedDagger",
        name: "Runed Dagger",
        category: "crafted",
        subtype: "equipment",
        tier: 3,
        icon: "🔮",
        description:
            "A steel dagger marked with void-touched runes. Warmer than it should be.",
        equipment: {
            slot: "mainHand",
            weaponType: "melee",
            stats: { attack: 12, agility: 2 }
        }
    }
];

// --------------------------------------------------
// LOOKUP HELPERS
// --------------------------------------------------

export function getMaterial(materialId) {
    return materials.find(material => material.id === materialId) ?? null;
}

export function getMaterialsByCategory(category) {
    return materials.filter(material => material.category === category);
}

export function getMaterialsByTier(tier) {
    return materials.filter(material => material.tier === tier);
}

export function getZoneMaterials(zoneId) {
    return materials.filter(material => material.zone?.id === zoneId);
}
