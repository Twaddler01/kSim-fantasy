import { addLog } from "../functions.js";
import { getItemDefinition } from "../data/items.js";
import { addItem } from "./InventorySystem.js";
import { ok, fail } from "../results.js";

/**
 * Adds a fixed amount of a defined raw material to inventory.
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

    const result = addItem(game, material.id, quantity);

    if (!result.ok) {
        return fail(result.reason);
    }

    addLog(game, `MATERIAL RECOVERY: +${quantity} ${material.name}.`, {
        category: "activity"
    });

    return ok({
        item: material,
        amount: quantity,
        total: result.total,
        newlyDiscovered: result.newlyDiscovered
    });
}
