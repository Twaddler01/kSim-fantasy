// src/systems/equipment.js
//
// Equip / unequip logic. Mutates game.inventory and game.equipment only.
// Never touches the UI. Every mutation is reversible: unequip restores the
// item to inventory, equip returns any replaced item to inventory.
//
// The authoritative shape of game.equipment is:
//   { head: null | { id, slot, weaponType?, stats: {...} }, chest: ..., ... }
//
// The stored object is a *copy* of the source material's `equipment` block
// plus its `id`. It is not a reference to the material — if the material
// array is edited later, existing equipped items are unaffected until the
// player unequips and re-equips them.

import { getMaterial } from "../data/materials.js";
import { getEquipmentSlot, isEquippable } from "../data/equipment.js";

export function equipItem(game, itemId) {
    if (!game?.inventory) {
        return { ok: false, reason: "Invalid game state." };
    }

    // Migration safety: older saves may not have `equipment` yet.
    game.equipment ??= {};

    const material = getMaterial(itemId);
    if (!material) {
        return { ok: false, reason: `Unknown item: ${itemId}` };
    }

    if (!isEquippable(material)) {
        return {
            ok: false,
            reason: `${material.name ?? itemId} cannot be equipped.`
        };
    }

    const slotId = material.equipment.slot;
    const slotDef = getEquipmentSlot(slotId);
    if (!slotDef) {
        return { ok: false, reason: `Unknown equipment slot: ${slotId}` };
    }

    const available = game.inventory[itemId] ?? 0;
    if (available < 1) {
        return { ok: false, reason: "You don't have that item." };
    }

    // Return whatever is currently in the slot to inventory first.
    const existing = game.equipment[slotId];
    if (existing?.id) {
        game.inventory[existing.id] = (game.inventory[existing.id] ?? 0) + 1;
    }

    // Move one from inventory to the slot.
    game.inventory[itemId] -= 1;
    game.equipment[slotId] = {
        id: itemId,
        ...material.equipment
    };

    return {
        ok: true,
        slotId,
        item: material,
        replaced: existing?.id ?? null
    };
}

export function unequipItem(game, slotId) {
    if (!game?.inventory || !game?.equipment) {
        return { ok: false, reason: "Invalid game state." };
    }

    const existing = game.equipment[slotId];
    if (!existing?.id) {
        return { ok: false, reason: `Nothing equipped in ${slotId}.` };
    }

    game.inventory[existing.id] = (game.inventory[existing.id] ?? 0) + 1;
    game.equipment[slotId] = null;

    return {
        ok: true,
        slotId,
        itemId: existing.id
    };
}

export function getEquipped(game, slotId) {
    return game?.equipment?.[slotId] ?? null;
}

export function isSlotOccupied(game, slotId) {
    return Boolean(game?.equipment?.[slotId]?.id);
}
