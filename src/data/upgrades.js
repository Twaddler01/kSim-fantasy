export const upgradeDefinitions = [
    {
        id: "zoneTools",
        name: "Zone Tools",
        icon: "🔨",
        description: "+1 bonus sample per successful gather, per level.",
        baseCost: { gold: 50 },
        maxLevel: 3
    },
    {
        id: "swordDrills",
        name: "Sword Drills",
        icon: "⚔️",
        description: "+2 attack in battle, per level.",
        baseCost: { gold: 100 },
        maxLevel: 5
    },
    {
        id: "herbalistsKit",
        name: "Herbalist's Kit",
        icon: "🌿",
        description: "+1 bonus potion per brew, per level.",
        baseCost: { gold: 75, sunpetal: 15 },
        maxLevel: 3,
        trigger: {
            type: "upgradeLevel",
            upgradeIds: ["zoneTools", "swordDrills"],
            minLevel: 1,
            match: "any"
        },
        unlockDescription:
            "Requires at least one level of Zone Tools or Sword Drills."
    }
];
