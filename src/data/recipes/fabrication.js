// src/data/fabrication.js

export const fabricationRecipes = [
    {
        id: "forgeIronDagger",
        name: "Forge Iron Dagger",
        description: "A short blade for close work.",
        unlockId: "forgeMastery",
        inputs: {
            ironIngot: 1,
            oakLog: 1
        },
        outputs: {
            ironDagger: 1
        },
        durationSeconds: 15
    },
    {
        id: "forgeIronSword",
        name: "Forge Iron Sword",
        description: "A full-length blade forged from steel.",
        unlockId: "forgeMastery",
        inputs: {
            steelIngot: 2,
            oakLog: 2
        },
        outputs: {
            ironSword: 1
        },
        durationSeconds: 30
    },
    {
        id: "sewLeatherVest",
        name: "Sew Leather Vest",
        description: "Stitch wolf hide into simple armor.",
        unlockId: "forgeMastery",
        inputs: {
            wolfHide: 3,
            oakLog: 1
        },
        outputs: {
            leatherVest: 1
        },
        durationSeconds: 20
    }
];
