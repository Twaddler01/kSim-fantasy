// src/data/equipment.js
//
// Slot definitions for the character sheet. This file is pure data plus
// tiny lookup helpers. It does not know about items, stats, or battle —
// those live in src/systems/equipment.js and src/systems/character.js.
//
// If you add a slot, add it here. Nothing else needs to change until
// an item is authored that occupies it.

export const EQUIPMENT_SLOTS = [
    { id: "head", name: "Head", accepts: ["equipment"] },
    { id: "chest", name: "Chest", accepts: ["equipment"] },
    { id: "legs", name: "Legs", accepts: ["equipment"] },
    { id: "feet", name: "Feet", accepts: ["equipment"] },
    { id: "mainHand", name: "Main Hand", accepts: ["equipment"] },
    { id: "offHand", name: "Off Hand", accepts: ["equipment"] },
    { id: "ring", name: "Ring", accepts: ["equipment"] }
];

export const EQUIPMENT_SLOT_IDS = EQUIPMENT_SLOTS.map(slot => slot.id);

export function getEquipmentSlot(slotId) {
    return EQUIPMENT_SLOTS.find(slot => slot.id === slotId) ?? null;
}

export function isEquippable(item) {
    return Boolean(item?.equipment?.slot);
}
