// src/data/inventory.js

import { resourceDefinitions } from "./resources.js";
import { materials } from "./materials.js";

// ===================================
// INVENTORY DEFINITIONS
// ===================================

export const inventoryItems = [
    ...resourceDefinitions.map(item => ({
        ...item,
        category: "resource",
        inventoryType: "resource"
    })),

    ...materials.map(item => ({
        ...item,
        icon: item.icon || "◈",
        inventoryType: "material"
    }))
];

// ===================================
// ITEM LOOKUP
// ===================================

export function getInventoryItem(itemId) {
    return inventoryItems.find(item => item.id === itemId) ?? null;
}

function hasInventoryItem(game, itemId) {
    return (
        getInventoryItem(itemId) !== null &&
        Object.prototype.hasOwnProperty.call(game.inventory, itemId)
    );
}

// ===================================
// DISCOVERY
// ===================================

export function unlockInventoryItem(game, itemId) {
    if (!game?.inventory || !game.inventoryDiscovered) {
        return false;
    }

    if (!hasInventoryItem(game, itemId)) {
        return false;
    }

    if (game.inventoryDiscovered[itemId]) {
        return false;
    }

    game.inventoryDiscovered[itemId] = true;

    return true;
}

export function syncInventoryDiscovery(game) {
    if (!game?.inventory) return [];

    game.inventoryDiscovered ??= {};

    const newlyDiscovered = [];

    for (const item of inventoryItems) {
        if ((game.inventory[item.id] ?? 0) > 0) {
            if (unlockInventoryItem(game, item.id)) {
                newlyDiscovered.push(item.id);
            }
        }
    }

    return newlyDiscovered;
}

// ===================================
// INITIALIZATION
// ===================================

export function initializeInventory(game) {
    if (!game) return null;

    game.inventory ??= {};
    game.inventoryDiscovered ??= {};

    for (const item of inventoryItems) {
        if (!Number.isFinite(game.inventory[item.id])) {
            game.inventory[item.id] = 0;
        }

        game.inventoryDiscovered[item.id] ??= Boolean(item.initiallyDiscovered);
    }

    syncInventoryDiscovery(game);

    return game.inventory;
}

// ===================================
// OPERATION RESULTS
// ===================================

function inventoryResult({
    success,
    reason = null,
    amount = 0,
    newlyDiscovered = false
}) {
    return {
        success,
        reason,
        amount,
        newlyDiscovered
    };
}

// ===================================
// ADD ITEM
// ===================================

/**
 * Adds an item to inventory and automatically discovers it.
 *
 * Returns:
 * {
 *     success: boolean,
 *     reason: string | null,
 *     amount: number,
 *     newlyDiscovered: boolean
 * }
 */
export function addInventoryItem(game, itemId, amount = 1) {
    if (!game?.inventory || !game.inventoryDiscovered) {
        return inventoryResult({
            success: false,
            reason: "invalid-game"
        });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return inventoryResult({
            success: false,
            reason: "invalid-amount"
        });
    }

    if (!hasInventoryItem(game, itemId)) {
        return inventoryResult({
            success: false,
            reason: "unknown-item"
        });
    }

    const currentAmount = game.inventory[itemId];

    if (!Number.isFinite(currentAmount) || currentAmount < 0) {
        return inventoryResult({
            success: false,
            reason: "invalid-game"
        });
    }

    game.inventory[itemId] = currentAmount + amount;

    const newlyDiscovered = unlockInventoryItem(game, itemId);

    return inventoryResult({
        success: true,
        amount: game.inventory[itemId],
        newlyDiscovered
    });
}

// ===================================
// REMOVE ITEM
// ===================================

/**
 * Removes an item if sufficient quantity exists.
 *
 * Returns the same standardized result as addInventoryItem().
 */
export function removeInventoryItem(game, itemId, amount = 1) {
    if (!game?.inventory || !game.inventoryDiscovered) {
        return inventoryResult({
            success: false,
            reason: "invalid-game"
        });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return inventoryResult({
            success: false,
            reason: "invalid-amount"
        });
    }

    if (!hasInventoryItem(game, itemId)) {
        return inventoryResult({
            success: false,
            reason: "unknown-item"
        });
    }

    const currentAmount = game.inventory[itemId];

    if (!Number.isFinite(currentAmount) || currentAmount < 0) {
        return inventoryResult({
            success: false,
            reason: "invalid-game"
        });
    }

    if (currentAmount < amount) {
        return inventoryResult({
            success: false,
            reason: "insufficient-items",
            amount: currentAmount
        });
    }

    game.inventory[itemId] = currentAmount - amount;

    return inventoryResult({
        success: true,
        amount: game.inventory[itemId]
    });
}
