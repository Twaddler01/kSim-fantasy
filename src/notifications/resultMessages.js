// src/notifications/resultMessages.js
//
// Global mapping from result reason codes to player-facing copy.
// Systems emit codes only; UI/actions translate them here.

export const RESULT_MESSAGES = Object.freeze({
    // Generic
    "invalid-game": "Something went wrong. Try again.",
    "invalid-amount": "The amount is invalid.",
    "unknown-item": "That item doesn't exist.",
    "insufficient-items": "You don't have enough of that item.",
    "unknown-enemy": "That enemy doesn't exist.",

    // Gathering
    "unknown-material": "That material can't be found.",

    // Equipment
    "not-equippable": "That item cannot be equipped.",
    "unknown-slot": "That equipment slot doesn't exist.",
    "not-owned": "You don't have that item.",
    "not-equipped": "Nothing is equipped in that slot.",

    // Consumables
    "not-consumable": "That item cannot be used.",
    "battle-limit": "You've already used that item in this battle.",
    "invalid-effect": "This item's effect is invalid.",
    "health-full": "Your health is already full.",
    "consume-failed": "Couldn't use that item.",
    "unsupported-effect": "That item's effect isn't supported yet.",

    // Crafting
    "invalid-recipe": "This recipe is invalid.",
    "recipe-locked": "That recipe is locked.",
    "insufficient-materials": "You don't have the materials for that.",
    "invalid-outputs": "This recipe has invalid outputs.",
    "recipe-completed": "You've already completed that recipe.",

    // Caves
    "unknown-cave": "That cave can't be found.",
    "already-searched": "You've already searched this cave.",
    "missing-loot-table": "This cave appears empty.",

    // Battle
    "battle-finished": "The battle is already over.",

    // Stages
    "unknown-stage": "That objective doesn't exist."
});

export function getResultMessage(
    reason,
    fallback = "Something went wrong. Try again."
) {
    return RESULT_MESSAGES[reason] ?? fallback;
}
