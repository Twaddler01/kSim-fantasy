export const refinementRecipes = [
    {
        id: "smeltIron",
        name: "Smelt Iron",
        description: "Melt iron ore with coal into a usable ingot.",
        inputs: {
            ironOre: 2,
            coal: 1
        },
        outputs: {
            ironIngot: 1
        },
        durationSeconds: 6
    },
    {
        id: "smeltSteel",
        name: "Smelt Steel",
        description: "Combine iron and coal at high heat for steel.",
        inputs: {
            ironIngot: 2,
            coal: 2
        },
        outputs: {
            steelIngot: 1
        },
        durationSeconds: 12
    },
    {
        id: "brewHealingPotion",
        name: "Brew Healing Potion",
        description: "Steep sunpetal and moonbloom into a restorative draught.",
        inputs: {
            sunpetal: 3,
            moonbloom: 1
        },
        outputs: {
            healingPotion: 1
        },
        durationSeconds: 8
    },
    {
        id: "brewFocusTonic",
        name: "Brew Focus Tonic",
        description: "A moonbloom-dominant infusion that sharpens the mind.",
        inputs: {
            moonbloom: 3,
            sunpetal: 1
        },
        outputs: {
            focusTonic: 1
        },
        durationSeconds: 10
    }
];
