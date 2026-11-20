// src/systems/StageSystem.js
//
// Quest-stage progression rules. Data definitions live in data/stages.js.

import { stageDefinitions } from "../data/stages.js";
import { getItemAmount } from "./InventorySystem.js";
import { ok, fail } from "../results.js";

export function getCurrentStage(game) {
    const id = game?.progression?.currentStage ?? 1;
    return stageDefinitions.find(stage => stage.id === id) ?? null;
}

export function getCompletedStages(game) {
    const id = game?.progression?.currentStage ?? 1;
    return stageDefinitions.filter(stage => stage.id < id);
}

export function getStageEntriesVisible(game) {
    const id = game?.progression?.currentStage ?? 1;
    return stageDefinitions.filter(
        stage => stage.id <= id && stage.originEntry
    );
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

    for (const [itemId, need] of Object.entries(
        stage.requirements.inventory
    )) {
        const have = getItemAmount(game, itemId);
        progress[itemId] = { have, need };

        if (have < need) met = false;
    }

    return {
        met,
        progress,
        complete: Object.keys(progress).length === 0
    };
}

/**
 * Idempotent. If the current stage's requirements are met, advances
 * to the next stage.
 *
 * Callers are responsible for saving + showing a toast when
 * `advanced` is true.
 */
export function tryAdvanceStage(game) {
    const current = getCurrentStage(game);
    if (!current) return fail("unknown-stage", { advanced: false });

    const { met } = checkRequirements(game, current);
    if (!met) {
        return ok({ advanced: false, from: current, to: null });
    }

    const next = stageDefinitions.find(
        stage => stage.id === current.id + 1
    );

    game.progression ??= { currentStage: 1 };
    game.progression.currentStage = current.id + 1;

    return ok({ advanced: true, from: current, to: next });
}
