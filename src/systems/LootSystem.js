// src/systems/LootSystem.js
//
// Owns temporary loot containers and transfers their contents into inventory.
//
// Loot is NOT added to inventory when a container is created.
// InventorySystem remains the authority for all inventory changes.

import { addItem } from "./InventorySystem.js";
import { getItemDefinition } from "../data/items.js";

let nextContainerId = 1;

export default class LootSystem {
    /**
     * Create a temporary loot container.
     *
     * Accepted item formats:
     *   { itemId: "healthPotion", quantity: 2 }
     *   { itemId: "healthPotion", qty: 2 }
     *
     * Duplicate item IDs are combined into one stack.
     */
    createContainer({
        title = "Loot",
        icon = "🎁",
        sourceType = "unknown",
        items = []
    } = {}) {
        const combined = new Map();

        for (const entry of items) {
            if (!entry?.itemId) continue;

            const quantity = Number(entry.quantity ?? entry.qty);

            if (!Number.isInteger(quantity) || quantity <= 0) {
                continue;
            }

            const item = getItemDefinition(entry.itemId);

            if (!item) {
                console.warn(`LootSystem: Unknown item "${entry.itemId}".`);
                continue;
            }

            const current = combined.get(entry.itemId) ?? 0;

            combined.set(entry.itemId, current + quantity);
        }

        const containerItems = [...combined.entries()].map(
            ([itemId, quantity]) => ({
                itemId,
                quantity
            })
        );

        return {
            id: `loot-${Date.now()}-${nextContainerId++}`,
            title,
            icon,
            sourceType,
            items: containerItems
        };
    }

    /**
     * Transfer one complete stack from a container into inventory.
     *
     * If the inventory cannot accept the entire stack, the loot remains
     * untouched in the container.
     */
    takeItem(game, container, itemId) {
        if (!game || !container || !Array.isArray(container.items)) {
            return {
                ok: false,
                reason: "invalid-container"
            };
        }

        const index = container.items.findIndex(
            entry => entry.itemId === itemId
        );

        if (index === -1) {
            return {
                ok: false,
                reason: "item-not-in-container",
                itemId
            };
        }

        const entry = container.items[index];

        const result = addItem(game, entry.itemId, entry.quantity);

        if (!result.ok) {
            return {
                ok: false,
                reason: result.reason ?? "inventory-transfer-failed",
                itemId: entry.itemId,
                quantity: entry.quantity,
                inventoryResult: result
            };
        }

        // Only remove the loot after InventorySystem confirms success.
        container.items.splice(index, 1);

        return {
            ok: true,
            itemId: entry.itemId,
            quantity: entry.quantity,
            newlyDiscovered: result.newlyDiscovered ?? false,
            remainingCount: container.items.length
        };
    }

    /**
     * Attempt to transfer every remaining stack.
     *
     * Each stack is handled independently. One failed transfer does not
     * prevent later stacks from being attempted.
     */
    takeAll(game, container) {
        if (!game || !container || !Array.isArray(container.items)) {
            return {
                ok: false,
                reason: "invalid-container",
                taken: [],
                failed: []
            };
        }

        const taken = [];
        const failed = [];

        // Use a copy because takeItem removes successful entries.
        const entries = [...container.items];

        for (const entry of entries) {
            const result = this.takeItem(game, container, entry.itemId);

            if (result.ok) {
                taken.push(result);
            } else {
                failed.push({
                    ...result,
                    itemId: entry.itemId
                });
            }
        }

        return {
            ok: failed.length === 0,
            taken,
            failed,
            remainingCount: container.items.length
        };
    }

    isEmpty(container) {
        return !container?.items?.length;
    }
}
