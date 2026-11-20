import { getItemAmount } from "../systems/InventorySystem.js";

/**
 * Shared, side-effect-free trigger condition evaluator.
 *
 * Returns true when a condition is satisfied.
 * Does not change game state or execute effects.
 */
export function evaluateTrigger(game, trigger) {
    if (!game || !trigger) return false;

    switch (trigger.type) {
        case "inventoryAmount":
            if (!trigger.item) return false;

            return (
                getItemAmount(game, trigger.item) >= (trigger.amount ?? 0)
            );

        case "upgradeLevel": {
            const ids = trigger.upgradeIds ?? [];

            if (ids.length === 0) return false;

            const minLevel = trigger.minLevel ?? 1;
            const matches = ids.map(
                id => (game.upgrades?.[id] ?? 0) >= minLevel
            );

            return trigger.match === "all"
                ? matches.every(Boolean)
                : matches.some(Boolean);
        }

        default:
            // Unknown conditions must not accidentally unlock content.
            return false;
    }
}
