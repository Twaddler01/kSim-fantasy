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

    const stats = getDerivedStats(game);

    // Defensive: player should never start a battle at 0 HP.
    if (!game.player?.hp || game.player.hp <= 0) {
        game.player ??= {};
        game.player.hp = stats.maxHealth;
    }

    return ok({
        battle: {
            enemyId,
            enemy,
            enemyHp: enemy.hp,
            enemyMaxHp: enemy.hp,
            playerHp: game.player.hp,
            playerMaxHp: stats.maxHealth,
            playerStats: {
                attack: stats.attack,
                defense: stats.defense,
                crit: stats.crit
            },
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
    const stats = getDerivedStats(game);
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
