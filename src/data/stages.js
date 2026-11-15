// src/data/stages.js
//
// Quest spine for the valley. Each stage is one primary objective that
// pulls the whole game forward. Requirements are checked against
// game.inventory and game.discoveries after every refreshUI().

export const stageDefinitions = [
    {
        id: 1,
        name: "Establish Camp",
        shortName: "Camp",
        objective: "Gather enough wood and herbs to make camp.",
        flavor:
            "The valley is quiet, but not empty. You will need a shelter " +
            "before you can do anything else.",
        requirements: {
            inventory: { oakLog: 10, sunpetal: 5 }
        },
        cass: "The valley is quiet. Gather what you need before the light fades.",
        originEntry: {
            title: "ORIGIN LOG — 01",
            body:
                "The road into the valley took three days.\n\n" +
                "The old map showed a meadow and a hillside cut, but " +
                "nothing else useful. You have a knife, a pack, and no " +
                "clear idea of what you are doing here.\n\n" +
                "Procedure: gather. Shelter. Survive the night."
        },
        completion: {
            title: "CAMP ESTABLISHED",
            message:
                "The fire is lit. A lean-to stands against the rock. Now you can begin."
        }
    },
    {
        id: 2,
        name: "First Forge",
        shortName: "Forge",
        objective: "Smelt iron into usable ingots.",
        flavor:
            "Iron sleeps in the hills. Wake it — and a forge-master's " +
            "trade opens to you.",
        requirements: {
            inventory: { ironIngot: 3 }
        },
        cass: "Iron in the hills, coal in the cut. The rest is fire and patience.",
        originEntry: {
            title: "ORIGIN LOG — 02",
            body:
                "The lean-to is up. The first night was cold but survivable.\n\n" +
                "The hillside cut has iron — enough for a forge. Three " +
                "ingots should be enough to prove the trade.\n\n" +
                "Note: smelting requires coal. The cut has some."
        },
        completion: {
            title: "FORGE MASTERY UNLOCKED",
            message:
                "Three ingots, cool on the stone. You know what to do with them now."
        }
    },
    {
        id: 3,
        name: "Wolfpine Warning",
        shortName: "Wolves",
        objective: "Deal with the wolves prowling the southern woods.",
        flavor:
            "Wolves. Three at least. Something is driving them toward " +
            "the camp.",
        requirements: {
            inventory: { wolfHide: 3, ironDagger: 1 }
        },
        cass: "Wolves don't come this close without a reason. Be ready for the wrong reason.",
        originEntry: {
            title: "ORIGIN LOG — 03",
            body:
                "Tracks in the southern pines. Fresh. Three wolves, " +
                "maybe more.\n\n" +
                "The camp is on their path. Whatever is driving them " +
                "south, it has not reached us yet.\n\n" +
                "Recommendation: forge a blade before the next moon."
        },
        completion: {
            title: "THE WOLVES ARE GONE",
            message:
                "Three pelts, salted and drying. The camp will hold through winter."
        }
    }
];

// --------------------------------------------------
// STAGE LOOKUP + ADVANCEMENT
// --------------------------------------------------

export function getCurrentStage(game) {
    const id = game?.progression?.currentStage ?? 1;
    return stageDefinitions.find(s => s.id === id) ?? null;
}

export function getCompletedStages(game) {
    const id = game?.progression?.currentStage ?? 1;
    return stageDefinitions.filter(s => s.id < id);
}

export function getStageEntriesVisible(game) {
    const id = game?.progression?.currentStage ?? 1;
    return stageDefinitions.filter(s => s.id <= id && s.originEntry);
}

/**
 * Returns { met, progress: { [key]: { have, need } }, complete }.
 * "complete" = no requirements left. "met" = all requirements satisfied.
 */
export function checkRequirements(game, stage) {
    if (!stage?.requirements?.inventory) {
        return { met: true, progress: {}, complete: true };
    }

    const progress = {};
    let met = true;

    for (const [itemId, need] of Object.entries(stage.requirements.inventory)) {
        const have = game.inventory?.[itemId] ?? 0;
        progress[itemId] = { have, need };
        if (have < need) met = false;
    }

    return { met, progress, complete: Object.keys(progress).length === 0 };
}

/**
 * Idempotent. If the current stage's requirements are met, advances
 * to the next stage. Returns { advanced: boolean, from, to }.
 *
 * Callers are responsible for saving + showing a toast when
 * `advanced` is true.
 */
export function tryAdvanceStage(game) {
    const current = getCurrentStage(game);
    if (!current) return { advanced: false };

    const { met } = checkRequirements(game, current);
    if (!met) return { advanced: false };

    const next = stageDefinitions.find(s => s.id === current.id + 1);

    game.progression ??= { currentStage: 1 };
    game.progression.currentStage = current.id + 1;

    return { advanced: true, from: current, to: next };
}
