import { getItemDefinition } from "../data/items.js";
import { ok, fail } from "../results.js";

/**
 * Calculates a gathered material reward.
 * Does not add anything to inventory.
 */
export function gatherMaterial(game, materialId, amount = 1) {
    const material = getItemDefinition(materialId);

    if (!material || material.category !== "raw") {
        return fail("unknown-material");
    }

    const quantity = Math.floor(Number(amount));

    if (!Number.isFinite(quantity) || quantity < 1) {
        return fail("invalid-amount");
    }

    return ok({
        item: material,
        itemId: material.id,
        amount: quantity,
        quantity
    });
}
