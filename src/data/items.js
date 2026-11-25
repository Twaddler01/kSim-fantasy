// src/data/items.js
//
// Canonical item definitions. This module is pure data plus lookups.
// It never reads or mutates game state.

import { resourceDefinitions } from "./resources.js";
import { materials } from "./materials.js";

export const ITEM_TYPES = Object.freeze({
    RESOURCE: "resource",
    MATERIAL: "material"
});

export const ITEM_STORAGE = Object.freeze({
    RESOURCE: "resource",
    SLOT: "slot",
    STASH: "stash"
});

export const INVENTORY_SLOT_COUNT = 20;
export const DEFAULT_CONSUMABLE_STACK_LIMIT = 10;

function getMaterialStorage(item) {
    if (item.equipment?.slot || item.consumable) {
        return ITEM_STORAGE.SLOT;
    }

    return ITEM_STORAGE.STASH;
}

function getMaterialStackLimit(item) {
    if (item.equipment?.slot) return 1;
    if (item.consumable) return DEFAULT_CONSUMABLE_STACK_LIMIT;

    return null;
}

export const itemDefinitions = Object.freeze([
    ...resourceDefinitions.map(item =>
        Object.freeze({
            ...item,
            category: "resource",
            inventoryType: ITEM_TYPES.RESOURCE,
            storage: ITEM_STORAGE.RESOURCE
        })
    ),

    ...materials.map(item =>
        Object.freeze({
            ...item,
            icon: item.icon || "◈",
            inventoryType: ITEM_TYPES.MATERIAL,
            storage: getMaterialStorage(item),
            stackLimit: getMaterialStackLimit(item)
        })
    )
]);

const itemsById = new Map(itemDefinitions.map(item => [item.id, item]));

export function getItemDefinition(itemId) {
    return itemsById.get(itemId) ?? null;
}

export function getItemsByType(inventoryType) {
    return itemDefinitions.filter(item => item.inventoryType === inventoryType);
}

export function getItemsByStorage(storage) {
    return itemDefinitions.filter(item => item.storage === storage);
}

export function isKnownItem(itemId) {
    return itemsById.has(itemId);
}
