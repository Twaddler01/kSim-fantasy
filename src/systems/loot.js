// src/systems/loot.js
//
// Reward rolling for battle victories and (later) caches.
// Every item grant goes through addInventoryItem and checks .success —
// respects the deferred slot-system contract.

import { addInventoryItem } from "../data/inventory.js";
import { getMaterial } from "../data/materials.js";
import { gainXp } from "./character.js";

export function rollRewards(game, enemy) {
    // Persist current HP from battle before any level-up heal
    // (caller sets game.player.hp = battle.playerHp first).

    const gold = rollGold(enemy.goldRange ?? [0, 0]);
    if (gold > 0) {
        addInventoryItem(game, "gold", gold);
    }

    const xp = enemy.xp ?? 0;
    let levelUps = [];
    if (xp > 0) {
        const result = gainXp(game, xp);
        levelUps = result.levelUps ?? [];
    }

    const items = [];
    for (const entry of enemy.lootTable ?? []) {
        if (Math.random() * 100 >= entry.weight) continue;

        const qty = randomInt(entry.minQty ?? 1, entry.maxQty ?? 1);
        if (qty < 1) continue;

        const addResult = addInventoryItem(game, entry.itemId, qty);
        const name = getMaterial(entry.itemId)?.name ?? entry.itemId;

        if (!addResult.success) {
            items.push({
                itemId: entry.itemId,
                qty,
                name,
                failed: true,
                newlyDiscovered: false
            });
        } else {
            items.push({
                itemId: entry.itemId,
                qty,
                name,
                failed: false,
                newlyDiscovered: Boolean(addResult.newlyDiscovered)
            });
        }
    }

    return { gold, xp, levelUps, items };
}

export function formatRewardsText(rewards) {
    const parts = [];

    if (rewards.gold > 0) parts.push(`+${rewards.gold} gold`);
    if (rewards.xp > 0) parts.push(`+${rewards.xp} XP`);

    for (const item of rewards.items) {
        if (item.failed) {
            parts.push(`(bag full: ${item.qty}× ${item.name})`);
        } else {
            parts.push(`+${item.qty}× ${item.name}`);
        }
    }

    if (rewards.levelUps?.length > 0) {
        parts.push(`LEVEL ${rewards.levelUps.join(" → ")}`);
    }

    return parts.length > 0 ? parts.join(" · ") : "No rewards";
}

function rollGold(range) {
    if (!Array.isArray(range) || range.length < 2) return 0;
    const [min, max] = range;
    return randomInt(min, max);
}

function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}
