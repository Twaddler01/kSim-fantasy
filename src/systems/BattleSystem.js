// src/systems/BattleSystem.js
//
// Turn-based combat. Pure game state manipulation — no UI.
//
// Battle object shape:
//   {
//     enemyId, enemy,                 // reference to enemies.js entry
//     enemyHp, enemyMaxHp,
//     playerHp, playerMaxHp,
//     playerStats: { attack, defense, crit },  // cached at battle start
//     log: [{ kind, text }],
//     turn,
//     finished, victory, fled,
//     rewards: null | { gold, xp, items, levelUps } | { goldLost }
//   }
//
// game.player.hp is synced at finalize (victory/defeat/flee). Mid-battle,
// battle.playerHp is the source of truth and is NOT persisted — losing a
// battle to a browser crash just restores pre-battle HP.

import { getEnemy } from "../data/enemies.js";
import { getDerivedStats } from "./character.js";
import { rollRewards, formatRewardsText } from "./loot.js";
import { getItemDefinition } from "../data/items.js";
import { consumeItem } from "./ConsumableSystem.js";
import { getItemAmount, removeItem } from "./InventorySystem.js";
import { ok, fail } from "../results.js";

export function startBattle(game, enemyId) {
    const enemy = getEnemy(enemyId);

    if (!enemy) {
        console.warn("[BattleSystem] Unknown enemy:", enemyId);
        return fail("unknown-enemy", { enemyId });
    }

    const stats = getDerivedStats(game.player, game.equipment);

    if (!game.player?.hp || game.player.hp <= 0) {
        game.player ??= {};
        game.player.hp = stats.maxHealth;
    }

    const enemyAttackInterval = enemy.attackSpeed ?? 2.5;

    return ok({
        battle: {
            enemyId,
            enemy,
            combatStarted: false,

            enemyHp: enemy.hp,
            enemyMaxHp: enemy.hp,

            playerHp: game.player.hp,
            playerMaxHp: stats.maxHealth,

            playerStats: {
                attack: stats.attack,
                defense: stats.defense,
                crit: stats.crit
            },

            // Player attack timing.
            playerAttackInterval: 1.5,
            playerWindupDuration: 0.6,
            playerWindupRemaining: 0,
            playerCooldownRemaining: 0,

            // Enemy attack timing.
            // Enemy waits until the player's first attack lands.
            enemyAttackInterval,
            enemyWindupDuration: 0.8,
            enemyWindupRemaining: 0,
            enemyCooldownRemaining: 0,
            enemyCanAttack: false,

            // Progress values used by the UI.
            playerWindupProgress: 0,
            playerCooldownProgress: 1,
            enemyWindupProgress: 0,

            consumablesUsed: {},

            log: [
                {
                    kind: "info",
                    text: `A ${enemy.name} blocks your path.`
                }
            ],

            turn: 0,
            finished: false,
            victory: false,
            fled: false,
            rewards: null
        }
    });
}

// ==================================================
// REAL-TIME COMBAT
// ==================================================

export function beginPlayerAttack(battle) {
    if (!battle || battle.finished) {
        return fail("battle-finished");
    }

    if (
        battle.playerWindupRemaining > 0 ||
        battle.playerCooldownRemaining > 0
    ) {
        return fail("attack-not-ready");
    }

    battle.playerWindupRemaining = battle.playerWindupDuration;
    battle.playerCooldownRemaining = battle.playerAttackInterval;

    return ok({ battle });
}

export function updateBattle(
    game,
    battle,
    dt,
    { isPlayerInRange = () => true } = {}
) {
    if (!battle || battle.finished || dt <= 0) {
        return { battle, newEvents: [] };
    }

    const previousLogLength = battle.log.length;

    // ----------------------------------------------
    // PLAYER ATTACK
    // ----------------------------------------------

    let playerAttackResolved = false;
    let playerOutOfRange = false;

    battle.playerCooldownRemaining = Math.max(
        0,
        battle.playerCooldownRemaining - dt
    );

    if (battle.playerWindupRemaining > 0) {
        battle.playerWindupRemaining = Math.max(
            0,
            battle.playerWindupRemaining - dt
        );

        if (battle.playerWindupRemaining <= 0) {
            const result = resolvePlayerAttack(
                game,
                battle,
                isPlayerInRange
            );
        
            playerAttackResolved = true;
        
            if (result === "out-of-range") {
                playerOutOfRange = true;
            }
        }
    }

    // Victory can end combat before the enemy attacks.
    if (battle.finished) {
        updateBattleProgress(battle);

        return {
            battle,
            newEvents: battle.log.slice(previousLogLength),
            playerOutOfRange
        };
    }

    // ----------------------------------------------
    // ENEMY ATTACK
    // ----------------------------------------------

    // The enemy cannot act until the player's first
    // attack has successfully landed.
    if (battle.enemyCanAttack && !playerAttackResolved) {
        if (battle.enemyWindupRemaining > 0) {
            battle.enemyWindupRemaining = Math.max(
                0,
                battle.enemyWindupRemaining - dt
            );

            if (battle.enemyWindupRemaining <= 0) {
                resolveRealtimeEnemyAttack(
                    game,
                    battle,
                    isPlayerInRange
                );
            }
        } else {
            battle.enemyCooldownRemaining = Math.max(
                0,
                battle.enemyCooldownRemaining - dt
            );

            if (battle.enemyCooldownRemaining <= 0) {
                battle.enemyWindupRemaining = battle.enemyWindupDuration;
            }
        }
    }

    updateBattleProgress(battle);

    return {
        battle,
        newEvents: battle.log.slice(previousLogLength),
        playerOutOfRange
    };
}

export function fleeBattle(game, battle) {
    if (!battle || battle.finished) {
        return fail("battle-finished");
    }

    battle.finished = true;
    battle.fled = true;
    battle.victory = false;

    // Preserve any damage already received.
    game.player.hp = battle.playerHp;

    battle.log.push({
        kind: "fled",
        text: "You retreat from the fight."
    });

    return ok({
        battle,
        newEvents: [battle.log[battle.log.length - 1]]
    });
}

// ==================================================
// REAL-TIME ATTACK RESOLUTION
// ==================================================

function resolvePlayerAttack(game, battle, isPlayerInRange) {
    if (battle.finished) return "finished";

    // Validate distance at the exact moment of impact.
    if (!isPlayerInRange()) {
        return "out-of-range";
    }

    const result = rollDamage(
        battle.playerStats.attack,
        battle.enemy.defense,
        battle.playerStats.crit
    );

    battle.enemyHp = Math.max(0, battle.enemyHp - result.damage);

    // The opening hit officially starts combat.
    battle.combatStarted = true;

    battle.log.push({
        kind: result.critical ? "player-crit" : "player-attack",
        text: result.critical
            ? `Critical strike! You hit for ${result.damage}.`
            : `You hit for ${result.damage}.`
    });

    if (battle.enemyHp <= 0) {
        battle.finished = true;
        battle.victory = true;

        battle.log.push({
            kind: "victory",
            text: `${battle.enemy.name} is defeated!`
        });

        finalizeVictory(game, battle);
        return "hit";
    }

    // The enemy gets its first attack opportunity
    // only after surviving the player's first hit.
    if (!battle.enemyCanAttack) {
        battle.enemyCanAttack = true;
        battle.enemyWindupRemaining = battle.enemyWindupDuration;
    }

    return "hit";
}

function resolveRealtimeEnemyAttack(game, battle, isPlayerInRange) {
    if (battle.finished) return;

    // Enemy attacks are silently cancelled if the player
    // has moved outside the enemy's attack range.
    if (!isPlayerInRange()) {
        battle.enemyCooldownRemaining = battle.enemyAttackInterval;
        return;
    }

    const result = rollDamage(
        battle.enemy.attack,
        battle.playerStats.defense,
        battle.enemy.crit ?? 0.05
    );

    battle.playerHp = Math.max(0, battle.playerHp - result.damage);

    battle.log.push({
        kind: result.critical ? "enemy-crit" : "enemy-attack",
        text: result.critical
            ? `${battle.enemy.name} critically hits you for ${result.damage}.`
            : `${battle.enemy.name} hits you for ${result.damage}.`
    });

    battle.turn += 1;

    if (battle.playerHp <= 0) {
        battle.finished = true;
        battle.victory = false;

        battle.log.push({
            kind: "defeat",
            text: "You fall to the ground..."
        });

        finalizeDefeat(game, battle);
        return;
    }

    // Begin the enemy's next cooldown.
    battle.enemyCooldownRemaining = battle.enemyAttackInterval;
}

function updateBattleProgress(battle) {
    battle.playerWindupProgress =
        battle.playerWindupDuration > 0
            ? 1 - battle.playerWindupRemaining / battle.playerWindupDuration
            : 0;

    battle.playerCooldownProgress =
        battle.playerAttackInterval > 0
            ? 1 - battle.playerCooldownRemaining / battle.playerAttackInterval
            : 1;

    battle.enemyWindupProgress =
        battle.enemyWindupDuration > 0
            ? 1 - battle.enemyWindupRemaining / battle.enemyWindupDuration
            : 0;
}

function resolveEnemyTurn(game, battle) {
    if (battle.finished) return;

    const eRoll = rollDamage(
        battle.enemy.attack,
        battle.playerStats.defense,
        battle.enemy.crit ?? 0.05
    );

    battle.playerHp = Math.max(0, battle.playerHp - eRoll.damage);

    battle.log.push({
        kind: eRoll.critical ? "enemy-crit" : "enemy-attack",
        text: eRoll.critical
            ? `${battle.enemy.name} critically hits you for ${eRoll.damage}.`
            : `${battle.enemy.name} hits you for ${eRoll.damage}.`
    });

    if (battle.playerHp <= 0) {
        battle.finished = true;
        battle.victory = false;

        battle.log.push({
            kind: "defeat",
            text: "You fall to the ground..."
        });

        finalizeDefeat(game, battle);
    }

    battle.turn += 1;
}

export function attackAction(game, battle) {
    if (battle.finished) {
        return { battle, newEvents: [] };
    }

    const prevLen = battle.log.length;

    // Player attacks
    const pRoll = rollDamage(
        battle.playerStats.attack,
        battle.enemy.defense,
        battle.playerStats.crit
    );
    battle.enemyHp = Math.max(0, battle.enemyHp - pRoll.damage);
    battle.log.push({
        kind: pRoll.critical ? "player-crit" : "player-attack",
        text: pRoll.critical
            ? `Critical strike! You hit for ${pRoll.damage}.`
            : `You hit for ${pRoll.damage}.`
    });

    if (battle.enemyHp <= 0) {
        battle.finished = true;
        battle.victory = true;
        battle.log.push({
            kind: "victory",
            text: `${battle.enemy.name} is defeated!`
        });
        finalizeVictory(game, battle);
        return { battle, newEvents: battle.log.slice(prevLen) };
    }

    // Enemy attacks
    resolveEnemyTurn(game, battle);

    return { battle, newEvents: battle.log.slice(prevLen) };
}

export function fleeAction(game, battle) {
    if (battle.finished) {
        return { battle, newEvents: [] };
    }

    battle.finished = true;
    battle.fled = true;
    battle.victory = false;

    // Persist HP loss so fleeing after taking damage still hurts.
    game.player.hp = battle.playerHp;

    battle.log.push({
        kind: "fled",
        text: "You retreat from the fight."
    });

    return {
        battle,
        newEvents: [battle.log[battle.log.length - 1]]
    };
}

// -----------------------------------------------------------------
// INTERNALS
// -----------------------------------------------------------------

function rollDamage(attack, defense, crit) {
    // Base damage: attack − 50% of defense, with ±2 variance, min 1.
    const variance = Math.round((Math.random() - 0.5) * 4); // -2..+2
    let damage = Math.max(1, Math.round(attack + variance - defense * 0.5));

    let critical = false;
    if (Math.random() < crit) {
        critical = true;
        damage = Math.round(damage * 1.5);
    }

    return { damage, critical };
}

function finalizeVictory(game, battle) {
    // Persist HP from battle first, so a level-up heal applies on top.
    game.player.hp = battle.playerHp;

    const rewards = rollRewards(game, battle.enemy);
    battle.rewards = rewards;

    // Sync back in case gainXp refilled HP on level-up.
    battle.playerHp = game.player.hp;

    battle.log.push({
        kind: "rewards",
        text: formatRewardsText(rewards)
    });
}

function finalizeDefeat(game, battle) {
    const stats = getDerivedStats(game.player, game.equipment);
    const goldBefore = getItemAmount(game, "gold");
    const goldLost = Math.min(goldBefore, Math.floor(goldBefore * 0.1));

    if (goldLost > 0) {
        removeItem(game, "gold", goldLost);
    }
    game.player.hp = stats.maxHealth;
    battle.playerHp = game.player.hp;
    battle.rewards = { goldLost, healed: true };

    battle.log.push({
        kind: "defeat-penalty",
        text:
            goldLost > 0
                ? `You wake at camp. ${goldLost} gold missing.`
                : "You wake at camp."
    });
}

export function useConsumableAction(game, battle, itemId) {
    if (!battle || battle.finished) {
        return fail("battle-finished", { newEvents: [] });
    }

    const prevLen = battle.log.length;

    const result = consumeItem(game, itemId, { battle });

    if (!result.ok) {
        return {
            ...result,
            battle,
            newEvents: []
        };
    }

    const item = getItemDefinition(itemId);

    battle.log.push({
        kind: "player-heal",
        text: `You use ${item.name} and restore ${result.restored} HP.`
    });

    // Using a potion consumes the player's turn.
    resolveEnemyTurn(game, battle);

    return {
        ...result,
        battle,
        newEvents: battle.log.slice(prevLen)
    };
}
