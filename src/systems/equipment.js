// src/systems/equipment.js
//
// Equip / unequip logic. Mutates game.equipment and inventory through
// InventorySystem. Never touches the UI. Every mutation is reversible:
// unequip restores the item to inventory, equip returns any replaced item.
//
// The authoritative shape of game.equipment is:
//   { head: null | { id, slot, weaponType?, stats: {...} }, chest: ..., ... }
//
// The stored object is a *copy* of the source material's `equipment` block
// plus its `id`. It is not a reference to the material — if the material
// array is edited later, existing equipped items are unaffected until the
// player unequips and re-equips them.

import { getItemDefinition } from "../data/items.js";
import { getEquipmentSlot, isEquippable } from "../data/equipment.js";
import {
    addItem,
    getItemAmount,
    isInventoryReady,
    removeItem
} from "./InventorySystem.js";
import { ok, fail } from "../results.js";

export function equipItem(game, itemId) {
    if (!isInventoryReady(game)) {
        return fail("invalid-game");
    }

    // Migration safety: older saves may not have `equipment` yet.
    game.equipment ??= {};

    const item = getItemDefinition(itemId);
    if (!item) {
        return fail("unknown-item", { itemId });
    }

    if (!isEquippable(item)) {
        return fail("not-equippable", { itemId });
    }

    const slotId = item.equipment.slot;
    const slotDef = getEquipmentSlot(slotId);
    if (!slotDef) {
        return fail("unknown-slot", { slotId });
    }

    if (getItemAmount(game, itemId) < 1) {
        return fail("not-owned", { itemId });
    }

    const existing = game.equipment[slotId];
    if (existing?.id && !getItemDefinition(existing.id)) {
        return fail("unknown-item", { itemId: existing.id });
    }

    const removal = removeItem(game, itemId, 1);
    if (!removal.ok) {
        return fail(removal.reason, { itemId });
    }

    if (existing?.id) {
        const replaced = addItem(game, existing.id, 1);

        if (!replaced.ok) {
            // Roll back the equip so inventory stays consistent.
            addItem(game, itemId, 1);
            return fail(replaced.reason, { itemId: existing.id });
        }
    }

    game.equipment[slotId] = {
        id: itemId,
        ...item.equipment
    };

    return ok({
        slotId,
        item,
        replaced: existing?.id ?? null
    });
}

export function unequipItem(game, slotId) {
    if (!isInventoryReady(game) || !game?.equipment) {
        return fail("invalid-game");
    }

    const existing = game.equipment[slotId];
    if (!existing?.id) {
        return fail("not-equipped", { slotId });
    }

    const result = addItem(game, existing.id, 1);
    if (!result.ok) {
        return fail(result.reason, { itemId: existing.id, slotId });
    }

    game.equipment[slotId] = null;

    return ok({
        slotId,
        itemId: existing.id
    });
}

export function getEquipped(game, slotId) {
    return game?.equipment?.[slotId] ?? null;
}

export function isSlotOccupied(game, slotId) {
    return Boolean(game?.equipment?.[slotId]?.id);
}
