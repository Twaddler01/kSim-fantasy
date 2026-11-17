// src/data/towns.js
//
// Town definitions.
//
// `decorations` are pure scenery — rendered into the background, never
// interactable. `buildings` are drawn into the background AND spawn a POI
// entity at `interaction.x/y` (the door) with a green interaction ring.

export const TOWN_DEFINITIONS = [
    {
        id: "ashenbrook",
        name: "Ashenbrook",

        world: {
            width: 1200,
            height: 900
        },

        square: {
            x: 600,
            y: 455,
            width: 390,
            height: 310
        },

        decorations: [
            { type: "tree", x: 100, y: 130, size: 1.2 },
            { type: "tree", x: 1080, y: 150, size: 1 },
            { type: "tree", x: 105, y: 720, size: 1.1 },
            { type: "bush", x: 390, y: 230, size: 1 },
            { type: "bush", x: 790, y: 230, size: 1.2 },
            { type: "bush", x: 400, y: 700, size: 0.9 }
        ],

        buildings: [
            {
                id: "town-hall",
                label: "Town Hall",
                style: "hall",
                x: 600,
                y: 205,
                width: 220,
                height: 150,
                wallColor: "#b9a88b",
                roofColor: "#66504a",
                doorColor: "#49362b",
                sign: "HALL",
                interaction: {
                    x: 600,
                    y: 305,
                    icon: "🏛️",
                    message:
                        "The town hall. Important matters are handled here."
                }
            },
            {
                id: "merchant",
                label: "Merchant",
                style: "shop",
                x: 265,
                y: 425,
                width: 170,
                height: 125,
                wallColor: "#c5a77c",
                roofColor: "#76513d",
                doorColor: "#49362b",
                sign: "GOODS",
                interaction: {
                    x: 265,
                    y: 515,
                    icon: "🛒",
                    message: "The merchant's shop isn't open just yet."
                }
            },
            {
                id: "blacksmith",
                label: "Blacksmith",
                style: "forge",
                x: 935,
                y: 425,
                width: 175,
                height: 125,
                wallColor: "#8e8177",
                roofColor: "#49464a",
                doorColor: "#382e2b",
                sign: "FORGE",
                interaction: {
                    x: 935,
                    y: 515,
                    icon: "⚒️",
                    message: "The blacksmith's forge is quiet for now."
                }
            },
            {
                id: "inn",
                label: "The Wayfarer's Rest",
                style: "inn",
                x: 600,
                y: 730,
                width: 210,
                height: 140,
                wallColor: "#b99a77",
                roofColor: "#72513d",
                doorColor: "#49362b",
                sign: "INN",
                interaction: {
                    x: 600,
                    y: 825,
                    icon: "🏠",
                    message: "A warm bed and a hot meal await weary travelers."
                }
            }
        ]
    }
];
