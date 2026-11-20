// src/systems/ConsumableSystem.js

import { getItemDefinition } from "../data/items.js";
import { getDerivedStats } from "./character.js";
import { getItemAmount, removeItem } from "./InventorySystem.js";
import { ok, fail } from "../results.js";

/**
 * Consume an item and apply its defined effect.
 */
export function consumeItem(game, itemId, { battle = null } = {}) {
    const item = getItemDefinition(itemId);

    if (!game?.player || !item?.consumable) {
        return fail("not-consumable");
    }

    const { effect, amount, percentage, battleLimitKey } = item.consumable;

    // Check inventory before applying anything.
    if (getItemAmount(game, itemId) < 1) {
        return fail("not-owned");
    }

    // Check the per-battle usage limit.
    if (battle && battleLimitKey && battle.consumablesUsed?.[battleLimitKey]) {
        return fail("battle-limit");
    }

    switch (effect) {
        case "restoreHealth": {
            if (
                    (percentage !== undefined && percentage <= 0 || percentage > 1) ||
                    (amount !== undefined && !Number.isFinite(amount))
               ) {
                return fail("invalid-effect");
            }
            
            const stats = getDerivedStats(game);

            const maxHealth = battle ? battle.playerMaxHp : stats.maxHealth;

            const currentHp = battle
                ? battle.playerHp
                : (game.player.hp ?? maxHealth);

            if (currentHp >= maxHealth) {
                return fail("health-full");
            }

            const isPercentage = percentage < 1 && percentage >= 0;
            const restored = Math.min(
                Math.round(isPercentage ? maxHealth * percentage : amount),
                maxHealth - currentHp
            );

            const removal = removeItem(game, itemId, 1);

            if (!removal.ok) {
                return fail("consume-failed");
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

            return ok({
                effect,
                restored,
                current: currentHp + restored,
                maximum: maxHealth
            });
        }

        default:
            return fail("unsupported-effect");
    }
}
