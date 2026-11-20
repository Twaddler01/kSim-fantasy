// src/data/items.js
//
// Canonical item definitions. This module is pure data plus lookups — it
// never reads or mutates game state.

import { resourceDefinitions } from "./resources.js";
import { materials } from "./materials.js";

export const ITEM_TYPES = Object.freeze({
    RESOURCE: "resource",
    MATERIAL: "material"
});

export const itemDefinitions = Object.freeze([
    ...resourceDefinitions.map(item =>
        Object.freeze({
            ...item,
            category: "resource",
            inventoryType: ITEM_TYPES.RESOURCE
        })
    ),

    ...materials.map(item =>
        Object.freeze({
            ...item,
            icon: item.icon || "◈",
            inventoryType: ITEM_TYPES.MATERIAL
        })
    )
]);

const itemsById = new Map(
    itemDefinitions.map(item => [item.id, item])
);

export function getItemDefinition(itemId) {
    return itemsById.get(itemId) ?? null;
}

export function getItemsByType(inventoryType) {
    return itemDefinitions.filter(
        item => item.inventoryType === inventoryType
    );
}

export function isKnownItem(itemId) {
    return itemsById.has(itemId);
}
