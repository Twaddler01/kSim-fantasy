// src/systems/InventorySystem.js
//
// Authoritative inventory rules. Reads and mutates game.inventory and
// game.inventoryDiscovered only. Never imports UI, saves, or shows messages.

import {
    getItemDefinition,
    itemDefinitions,
    isKnownItem
} from "../data/items.js";
import { ok, fail } from "../results.js";

export function isInventoryReady(game) {
    return Boolean(game?.inventory && game.inventoryDiscovered);
}

function normalizeAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function markDiscovered(game, itemId) {
    if (game.inventoryDiscovered[itemId]) {
        return false;
    }

    game.inventoryDiscovered[itemId] = true;

    return true;
}

// ===================================
// INITIALIZATION
// ===================================

export function initializeInventory(game) {
    if (!game) return null;

    game.inventory ??= {};
    game.inventoryDiscovered ??= {};

    for (const item of itemDefinitions) {
        const current = game.inventory[item.id];

        if (!Number.isFinite(current) || current < 0) {
            game.inventory[item.id] = 0;
        }

        game.inventoryDiscovered[item.id] ??= Boolean(
            item.initiallyDiscovered
        );
    }

    syncInventoryDiscovery(game);

    return game.inventory;
}

// ===================================
// QUERIES
// ===================================

export function getItemAmount(game, itemId) {
    return normalizeAmount(game?.inventory?.[itemId]);
}

export function getItemEntry(game, itemId) {
    const item = getItemDefinition(itemId);

    if (!item) return null;

    return {
        item,
        amount: getItemAmount(game, itemId),
        discovered: isItemDiscovered(game, itemId)
    };
}

export function getVisibleItems(game) {
    if (!game?.inventory) return [];

    return itemDefinitions
        .map(item => ({
            item,
            amount: getItemAmount(game, item.id),
            discovered: isItemDiscovered(game, item.id)
        }))
        .filter(entry => {
            if (!entry.discovered) return false;

            // Equippable items disappear from the list when none are owned.
            if (entry.item.equipment?.slot && entry.amount === 0) {
                return false;
            }

            return true;
        });
}

export function hasItem(game, itemId, amount = 1) {
    const required = Number(amount);

    return (
        isKnownItem(itemId) &&
        Number.isFinite(required) &&
        required > 0 &&
        getItemAmount(game, itemId) >= required
    );
}

export function isItemDiscovered(game, itemId) {
    return (
        isKnownItem(itemId) &&
        game?.inventoryDiscovered?.[itemId] === true
    );
}

// ===================================
// DISCOVERY
// ===================================

export function discoverItem(game, itemId) {
    if (!isInventoryReady(game)) {
        return fail("invalid-game");
    }

    if (!isKnownItem(itemId)) {
        return fail("unknown-item", { itemId });
    }

    return ok({
        itemId,
        newlyDiscovered: markDiscovered(game, itemId)
    });
}

export function syncInventoryDiscovery(game) {
    if (!game?.inventory) return [];

    game.inventoryDiscovered ??= {};

    const newlyDiscovered = [];

    for (const item of itemDefinitions) {
        if (getItemAmount(game, item.id) <= 0) continue;

        if (markDiscovered(game, item.id)) {
            newlyDiscovered.push(item.id);
        }
    }

    return newlyDiscovered;
}

// ===================================
// MUTATIONS
// ===================================

export function addItem(game, itemId, amount = 1) {
    if (!isInventoryReady(game)) {
        return fail("invalid-game");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return fail("invalid-amount", { itemId });
    }

    if (!isKnownItem(itemId)) {
        return fail("unknown-item", { itemId });
    }

    const previous = getItemAmount(game, itemId);
    const total = previous + amount;

    game.inventory[itemId] = total;

    return ok({
        itemId,
        previous,
        total,
        delta: amount,
        newlyDiscovered: markDiscovered(game, itemId)
    });
}

export function removeItem(game, itemId, amount = 1) {
    if (!isInventoryReady(game)) {
        return fail("invalid-game");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return fail("invalid-amount", { itemId });
    }

    if (!isKnownItem(itemId)) {
        return fail("unknown-item", { itemId });
    }

    const previous = getItemAmount(game, itemId);

    if (previous < amount) {
        return fail("insufficient-items", {
            itemId,
            available: previous,
            required: amount
        });
    }

    const total = previous - amount;

    game.inventory[itemId] = total;

    return ok({
        itemId,
        previous,
        total,
        delta: -amount,
        newlyDiscovered: false
    });
}

export function addItems(game, entries = {}) {
    const results = [];

    for (const [itemId, amount] of Object.entries(entries)) {
        const result = addItem(game, itemId, amount);

        if (!result.ok) {
            return fail(result.reason, {
                ...result,
                results
            });
        }

        results.push(result);
    }

    return ok({ results });
}

export function removeItems(game, entries = {}) {
    const pending = Object.entries(entries);

    if (!isInventoryReady(game)) {
        return fail("invalid-game");
    }

    // Validate everything before mutating so a failed payment is atomic.
    for (const [itemId, amount] of pending) {
        if (!Number.isFinite(amount) || amount <= 0) {
            return fail("invalid-amount", { itemId });
        }

        if (!isKnownItem(itemId)) {
            return fail("unknown-item", { itemId });
        }

        const available = getItemAmount(game, itemId);

        if (available < amount) {
            return fail("insufficient-items", {
                itemId,
                available,
                required: amount
            });
        }
    }

    const results = pending.map(([itemId, amount]) =>
        removeItem(game, itemId, amount)
    );

    return ok({ results });
}

// ===================================
// COSTS
// ===================================

export function canAfford(game, cost = {}) {
    return Object.entries(cost).every(([itemId, amount]) => {
        const required = Number(amount);

        return (
            Number.isFinite(required) &&
            required > 0 &&
            getItemAmount(game, itemId) >= required
        );
    });
}

export function payCost(game, cost = {}) {
    return removeItems(game, cost);
}
