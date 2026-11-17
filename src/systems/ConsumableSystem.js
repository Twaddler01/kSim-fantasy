// src/systems/ConsumableSystem.js

import { getInventoryItem, removeInventoryItem } from "../data/inventory.js";
import { getDerivedStats } from "./character.js";

/**
 * Consume an item and apply its defined effect.
 */
export function consumeItem(game, itemId, { battle = null } = {}) {
    const item = getInventoryItem(itemId);

    if (!game?.player || !item?.consumable) {
        return { success: false, reason: "not-consumable" };
    }

    const { effect, amount, percentage, battleLimitKey } = item.consumable;

    // Check inventory before applying anything.
    if ((game.inventory?.[itemId] ?? 0) < 1) {
        return { success: false, reason: "not-owned" };
    }

    // Check the per-battle usage limit.
    if (battle && battleLimitKey && battle.consumablesUsed?.[battleLimitKey]) {
        return { success: false, reason: "battle-limit" };
    }

    switch (effect) {
        case "restoreHealth": {
            if (
                    (percentage !== undefined && percentage <= 0 || percentage > 1) ||
                    (amount !== undefined && !Number.isFinite(amount))
               ) {
                return { success: false, reason: "invalid-effect" };
            }
            
            const stats = getDerivedStats(game);

            const maxHealth = battle ? battle.playerMaxHp : stats.maxHealth;

            const currentHp = battle
                ? battle.playerHp
                : (game.player.hp ?? maxHealth);

            if (currentHp >= maxHealth) {
                return { success: false, reason: "health-full" };
            }

            const isPercentage = percentage < 1 && percentage >= 0;
            const restored = Math.min(
                Math.round(isPercentage ? maxHealth * percentage : amount),
                maxHealth - currentHp
            );

            const removal = removeInventoryItem(game, itemId, 1);

            if (!removal.success) {
                return { success: false, reason: "consume-failed" };
            }

            if (battle) {
                battle.playerHp += restored;

                battle.consumablesUsed ??= {};

                if (battleLimitKey) {
                    battle.consumablesUsed[battleLimitKey] = true;
                }
            } else {
                game.player.hp = currentHp + restored;
            }

            return {
                success: true,
                effect,
                restored,
                current: currentHp + restored,
                maximum: maxHealth
            };
        }

        default:
            return {
                success: false,
                reason: "unsupported-effect"
            };
    }
}
