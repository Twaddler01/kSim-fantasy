// src/data/towns.js

export const TOWN_DEFINITIONS = [
    {
        id: "ashenbrook",
        name: "Ashenbrook",

        world: {
            width: 1200,
            height: 900
        },

        objects: [
            {
                id: "town-hall",
                label: "Town Hall",
                icon: "🏛️",
                x: 600,
                y: 300,
                r: 30,
                message: "The town hall. Important matters are handled here."
            },
            {
                id: "merchant",
                label: "Merchant",
                icon: "🛒",
                x: 350,
                y: 450,
                r: 28,
                message: "The merchant's shop isn't open just yet."
            },
            {
                id: "blacksmith",
                label: "Blacksmith",
                icon: "⚒️",
                x: 850,
                y: 450,
                r: 28,
                message: "The blacksmith's forge is quiet for now."
            },
            {
                id: "inn",
                label: "The Wayfarer's Rest",
                icon: "🏠",
                x: 600,
                y: 650,
                r: 30,
                message: "A warm bed and a hot meal await weary travelers."
            }
        ]
    }
];
