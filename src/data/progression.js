export const progressionUnlocks = [
    {
        id: "forgeMastery",
        name: "Forge Mastery",
        description:
            "Unlocks smithing, leatherworking, and weapon fabrication.",
        initialUnlocked: false,
        trigger: {
            type: "inventoryAmount",
            item: "ironIngot",
            amount: 3
        }
    }
];
