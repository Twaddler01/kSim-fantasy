import { isKnownItem } from "../data/items.js";
import { addItem } from "../systems/InventorySystem.js";

export function applyEffects(
    game,
    effects = [],
    { onProgress = () => {} } = {}
) {
    const applied = [];

    for (const effect of effects) {
        if (!effect || typeof effect !== "object") continue;

        if (effect.type !== "resource") continue;

        const { resource, amount } = effect;

        if (
            !resource ||
            !Number.isFinite(amount) ||
            !isKnownItem(resource)
        ) {
            continue;
        }

        const result = addItem(game, resource, amount);

        if (result.ok) {
            applied.push({ ...effect });
        }
    }

    if (applied.length > 0) {
        onProgress();
    }

    return applied;
}

export function describeEffects(effects = []) {
    return effects
        .filter(effect => effect?.type === "resource")
        .map(effect => `+${effect.amount} ${effect.resource}`)
        .join(", ");
}
