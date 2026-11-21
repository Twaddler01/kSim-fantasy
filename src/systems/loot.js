// src/systems/loot.js
//
// Loot rolling. One primitive: rollFromLootTable(game, table). Enemies
// and non-enemy reward sources (caches, caves, future quest rewards) all
// funnel through it. Every item grant goes through InventorySystem.

import { getItemDefinition } from "../data/items.js";
import { addItem } from "./InventorySystem.js";
import { gainXp } from "./character.js";

/**
 * Roll a percentage-weighted loot table and grant the results.
 * Returns an array of { itemId, qty, name, failed, newlyDiscovered }.
 */
export function rollFromLootTable(game, table) {
    if (!Array.isArray(table)) return [];

    const items = [];

    for (const entry of table) {
        if (Math.random() * 100 >= (entry.weight ?? 0)) continue;

        const qty = randomInt(entry.minQty ?? 1, entry.maxQty ?? 1);
        if (qty < 1) continue;

        const addResult = addItem(game, entry.itemId, qty);
        const name =
            getItemDefinition(entry.itemId)?.name ?? entry.itemId;

        items.push({
            itemId: entry.itemId,
            qty,
            name,
            failed: !addResult.ok,
            newlyDiscovered: Boolean(addResult.newlyDiscovered)
        });
    }

    return items;
}

export function rollRewards(game, enemy) {
    const gold = rollGold(enemy.goldRange ?? [0, 0]);
    if (gold > 0) addItem(game, "gold", gold);

    const xp = enemy.xp ?? 0;
    let levelUps = [];
    if (xp > 0) {
        const result = gainXp(game.player, xp, game.equipment);
        levelUps = result.levelUps ?? [];
    }

    const items = rollFromLootTable(game, enemy.lootTable ?? []);

    return { gold, xp, levelUps, items };
}

export function formatRewardsText(rewards) {
    const parts = [];

    if (rewards.gold > 0) parts.push(`+${rewards.gold} gold`);
    if (rewards.xp > 0) parts.push(`+${rewards.xp} XP`);

    for (const item of rewards.items ?? []) {
        if (item.failed) {
            parts.push(`(bag full: ${item.qty}× ${item.name})`);
        } else {
            parts.push(`+${item.qty}× ${item.name}`);
        }
    }

    if (rewards.levelUps?.length > 0) {
        parts.push(`LEVEL ${rewards.levelUps.join(" → ")}`);
    }

    return parts.length > 0 ? parts.join(" · ") : "Nothing";
}

function rollGold(range) {
    if (!Array.isArray(range) || range.length < 2) return 0;
    const [min, max] = range;
    return randomInt(min, max);
}

function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}
