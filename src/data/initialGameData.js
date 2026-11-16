export const initialGameData = {
    version: 6,
    stage: 0,
    clicks: 0,
    inventory: {
        gold: 0,
        experience: 0
    },
    upgrades: {
        fieldTools: 0,
        swordDrills: 0,
        herbalistsKit: 0
    },
    player: {
        level: 1,
        hp: null
    },
    equipment: {
        head: null,
        chest: null,
        legs: null,
        feet: null,
        mainHand: null,
        offHand: null,
        ring: null
    },
    log: [
        {
            id: 1,
            message:
                "The road into the valley is quiet. Gather what you can before dark.",
            category: "important",
            tab: "log",
            timestamp: Date.now()
        },
        {
            id: 2,
            message:
                "Your journal begins here. Record every material, creature, and recipe you encounter.",
            category: "important",
            tab: "log",
            timestamp: Date.now()
        }
    ],
    events: {},
    logOnce: {},
    lastTick: Date.now(),
    logSequence: 2,
    tabReadIds: {
        log: 0,
        equipment: 0
    },
    unread: {
        items: {
            equipment: [],
            log: [1, 2]
        },
        pending: {
            equipment: [],
            log: []
        }
    },
    unlocks: {},
    appState: {
        navigation: { activeFieldId: null },
        trackerEnabled: false
    },
    progression: {
        currentStage: 1
    }
};
