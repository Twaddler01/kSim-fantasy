// src/systems/InventorySystem.js
//
// Authoritative inventory rules.
//
// Storage:
//   game.inventory.slots  - fixed-capacity item slots
//   game.inventory.stash  - unlimited material quantities
//   game.resources        - tracked resources such as gold and trophies
//
// This module never imports UI, saves, or shows messages.

import {
    getItemDefinition,
    itemDefinitions,
    isKnownItem,
    ITEM_STORAGE,
    INVENTORY_SLOT_COUNT
} from "../data/items.js";

import { ok, fail } from "../results.js";

// ===================================
// HELPERS
// ===================================

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

function getSlotItemAmount(game, itemId) {
    return (game.inventory?.slots ?? []).reduce((total, slot) => {
        if (slot?.itemId !== itemId) return total;

        return total + normalizeAmount(slot.quantity);
    }, 0);
}

function getStorageAmount(game, itemId) {
    const item = getItemDefinition(itemId);

    if (!item || !game) return 0;

    switch (item.storage) {
        case ITEM_STORAGE.RESOURCE:
            return normalizeAmount(game.resources?.[itemId]);

        case ITEM_STORAGE.SLOT:
            return getSlotItemAmount(game, itemId);

        case ITEM_STORAGE.STASH:
            return normalizeAmount(game.inventory?.stash?.[itemId]);

        default:
            return 0;
    }
}

function canFitInSlots(game, item, amount) {
    const slots = game.inventory.slots;
    const stackLimit = item.stackLimit ?? 1;

    let remaining = amount;

    // First use available space in existing stacks.
    for (const slot of slots) {
        if (slot?.itemId !== item.id) continue;

        remaining -= Math.max(0, stackLimit - normalizeAmount(slot.quantity));

        if (remaining <= 0) return true;
    }

    // Then count empty slots.
    const emptySlots = slots.filter(slot => !slot).length;

    return remaining <= emptySlots * stackLimit;
}

function addToSlots(game, item, amount) {
    const slots = game.inventory.slots;
    const stackLimit = item.stackLimit ?? 1;
    let remaining = amount;

    // Fill existing stacks first.
    for (const slot of slots) {
        if (slot?.itemId !== item.id) continue;

        const available = Math.max(
            0,
            stackLimit - normalizeAmount(slot.quantity)
        );

        const added = Math.min(available, remaining);

        slot.quantity += added;
        remaining -= added;

        if (remaining <= 0) return;
    }

    // Then use empty slots.
    for (let i = 0; i < slots.length && remaining > 0; i++) {
        if (slots[i]) continue;

        const added = Math.min(stackLimit, remaining);

        slots[i] = {
            itemId: item.id,
            quantity: added
        };

        remaining -= added;
    }
}

function removeFromSlots(game, itemId, amount) {
    const slots = game.inventory.slots;
    let remaining = amount;

    // Remove from the last matching stack first.
    for (let i = slots.length - 1; i >= 0; i--) {
        const slot = slots[i];

        if (slot?.itemId !== itemId) continue;

        const available = normalizeAmount(slot.quantity);
        const removed = Math.min(available, remaining);

        slot.quantity -= removed;
        remaining -= removed;

        if (slot.quantity <= 0) {
            slots[i] = null;
        }

        if (remaining <= 0) break;
    }
}

// ===================================
// READINESS
// ===================================

export function isInventoryReady(game) {
    return Boolean(
        Array.isArray(game?.inventory?.slots) &&
        game.inventory.stash &&
        game.inventoryDiscovered &&
        game.resources
    );
}

// ===================================
// INITIALIZATION
// ===================================

export function initializeInventory(game) {
    if (!game) return null;

    // Fresh inventory structure. Existing flat inventory saves are
    // intentionally not migrated during this redesign.
    if (!Array.isArray(game.inventory?.slots)) {
        game.inventory = {
            slots: Array(INVENTORY_SLOT_COUNT).fill(null),
            stash: {}
        };
    } else {
        game.inventory.slots.length = INVENTORY_SLOT_COUNT;
        game.inventory.stash ??= {};
    }

    game.inventoryDiscovered ??= {};
    game.resources ??= {};

    for (const item of itemDefinitions) {
        game.inventoryDiscovered[item.id] ??= Boolean(item.initiallyDiscovered);

        if (item.storage === ITEM_STORAGE.RESOURCE) {
            game.resources[item.id] = normalizeAmount(game.resources[item.id]);
        } else if (item.storage === ITEM_STORAGE.STASH) {
            game.inventory.stash[item.id] = normalizeAmount(
                game.inventory.stash[item.id]
            );
        }
    }

    // Normalize slot entries and discard invalid or unknown entries.
    // Normalize slots and discard invalid or unknown entries.
    const existingSlots = game.inventory.slots;

    game.inventory.slots = Array.from(
        { length: INVENTORY_SLOT_COUNT },
        (_, index) => {
            const slot = existingSlots[index];

            if (!slot || !isKnownItem(slot.itemId)) {
                return null;
            }

            const item = getItemDefinition(slot.itemId);

            if (item.storage !== ITEM_STORAGE.SLOT) {
                return null;
            }

            const quantity = normalizeAmount(slot.quantity);

            if (quantity <= 0) return null;

            return {
                itemId: item.id,
                quantity: Math.min(quantity, item.stackLimit ?? 1)
            };
        }
    );

    syncInventoryDiscovery(game);

    return game.inventory;
}

// ===================================
// QUERIES
// ===================================

export function getItemAmount(game, itemId) {
    return getStorageAmount(game, itemId);
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
    if (!game?.inventory || !game?.resources) return [];

    return itemDefinitions
        .map(item => ({
            item,
            amount: getItemAmount(game, item.id),
            discovered: isItemDiscovered(game, item.id)
        }))
        .filter(entry => {
            if (!entry.discovered) return false;

            // Hide owned equipment when none is currently in inventory.
            if (entry.item.equipment?.slot && entry.amount === 0) {
                return false;
            }

            return true;
        });
}

export function getInventorySlots(game) {
    return game?.inventory?.slots ?? [];
}

export function getInventoryCapacity() {
    return INVENTORY_SLOT_COUNT;
}

export function getUsedSlotCount(game) {
    return (game?.inventory?.slots ?? []).filter(Boolean).length;
}

export function getFreeSlotCount(game) {
    return Math.max(0, INVENTORY_SLOT_COUNT - getUsedSlotCount(game));
}

export function getStashItems(game) {
    if (!game?.inventory?.stash) return [];

    return Object.entries(game.inventory.stash)
        .filter(([, amount]) => normalizeAmount(amount) > 0)
        .map(([itemId, amount]) => ({
            item: getItemDefinition(itemId),
            itemId,
            amount: normalizeAmount(amount)
        }))
        .filter(entry => entry.item);
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
    return isKnownItem(itemId) && game?.inventoryDiscovered?.[itemId] === true;
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
    if (!game?.inventory || !game?.resources) return [];

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

export function moveInventoryStack(game, sourceIndex, destinationIndex, amount = null) {
    if (!isInventoryReady(game)) {
        return fail("invalid-game");
    }

    const slots = game.inventory.slots;

    if (
        !Number.isInteger(sourceIndex) ||
        !Number.isInteger(destinationIndex) ||
        sourceIndex < 0 ||
        destinationIndex < 0 ||
        sourceIndex >= slots.length ||
        destinationIndex >= slots.length
    ) {
        return fail("invalid-slot");
    }

    if (sourceIndex === destinationIndex) {
        return fail("same-slot");
    }

    const source = slots[sourceIndex];
    const destination = slots[destinationIndex];

    if (!source) return fail("empty-source");

    const sourceItem = getItemDefinition(source.itemId);

    if (!sourceItem || sourceItem.storage !== ITEM_STORAGE.SLOT) {
        return fail("invalid-item");
    }

    const requested = amount == null
        ? source.quantity
        : Math.floor(Number(amount));

    if (
        !Number.isFinite(requested) ||
        requested <= 0 ||
        requested > source.quantity
    ) {
        return fail("invalid-amount");
    }

    // Empty destination: move the requested quantity.
    if (!destination) {
        const transferred = requested;

        if (transferred === source.quantity) {
            slots[destinationIndex] = source;
            slots[sourceIndex] = null;
        } else {
            source.quantity -= transferred;

            slots[destinationIndex] = {
                itemId: source.itemId,
                quantity: transferred
            };
        }

        return ok({
            action: "moved",
            sourceIndex,
            destinationIndex,
            itemId: source.itemId,
            transferred,
            remaining: slots[sourceIndex]?.quantity ?? 0
        });
    }

    const destinationItem = getItemDefinition(destination.itemId);

    if (!destinationItem || destinationItem.storage !== ITEM_STORAGE.SLOT) {
        return fail("invalid-destination");
    }

    // Matching items: merge.
    if (source.itemId === destination.itemId) {
        const stackLimit = sourceItem.stackLimit ?? 1;
        const available = Math.max(0, stackLimit - destination.quantity);

        if (available <= 0) return fail("stack-full");

        const transferred = Math.min(requested, available);

        destination.quantity += transferred;
        source.quantity -= transferred;

        if (source.quantity <= 0) {
            slots[sourceIndex] = null;
        }

        return ok({
            action: "merged",
            sourceIndex,
            destinationIndex,
            itemId: source.itemId,
            transferred,
            remaining: slots[sourceIndex]?.quantity ?? 0
        });
    }

    // Swapping different items requires transferring the entire stack.
    if (requested !== source.quantity) {
        return fail("partial-swap");
    }

    slots[sourceIndex] = destination;
    slots[destinationIndex] = source;

    return ok({
        action: "swapped",
        sourceIndex,
        destinationIndex
    });
}

export function addItem(game, itemId, amount = 1) {
    if (!isInventoryReady(game)) {
        return fail("invalid-game");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return fail("invalid-amount", { itemId });
    }

    const item = getItemDefinition(itemId);

    if (!item) {
        return fail("unknown-item", { itemId });
    }

    const previous = getItemAmount(game, itemId);
    const total = previous + amount;

    if (item.storage === ITEM_STORAGE.SLOT) {
        if (!canFitInSlots(game, item, amount)) {
            return fail("inventory-full", {
                itemId,
                available: previous,
                requested: amount,
                freeSlots: getFreeSlotCount(game)
            });
        }

        addToSlots(game, item, amount);
    } else if (item.storage === ITEM_STORAGE.STASH) {
        game.inventory.stash[itemId] = total;
    } else if (item.storage === ITEM_STORAGE.RESOURCE) {
        game.resources[itemId] = total;
    } else {
        return fail("invalid-item-storage", { itemId });
    }

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

    const item = getItemDefinition(itemId);

    if (!item) {
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

    if (item.storage === ITEM_STORAGE.SLOT) {
        removeFromSlots(game, itemId, amount);
    } else if (item.storage === ITEM_STORAGE.STASH) {
        game.inventory.stash[itemId] = total;
    } else if (item.storage === ITEM_STORAGE.RESOURCE) {
        game.resources[itemId] = total;
    }

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

    // Validate everything before mutating so payment is atomic.
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
            isKnownItem(itemId) &&
            getItemAmount(game, itemId) >= required
        );
    });
}

export function payCost(game, cost = {}) {
    return removeItems(game, cost);
}
