// src/systems/character.js
//
// Player character: base stats, derived combat stats, XP, level, HP.
//
// Stat model (warrior only for v1):
//   strength  — base attack contribution
//   agility   — attack + crit contribution
//   vitality  — max health + defense contribution
//
// XP is stored as the "experience" resource in inventory (consistent with
// gold). Levels are stored on game.player. Max HP, attack, defense, and
// crit are always derived — never stored — so tuning the formulas is safe
// for existing saves.

import { addInventoryItem } from "../data/inventory.js";

// --------------------------------------------------
// TUNING CONSTANTS
// --------------------------------------------------

const BASE_STATS = {
    strength: 5,
    agility: 3,
    vitality: 5
};

const WARRIOR_LEVEL_GAINS = {
    strength: 2,
    agility: 1,
    vitality: 2
};

const BASE_HEALTH = 40;
const HP_PER_VITALITY = 5;
const DEFENSE_PER_VITALITY = 0.3;
const ATTACK_PER_STRENGTH = 1;
const ATTACK_PER_AGILITY = 0.5;
const BASE_CRIT = 0.05;
const CRIT_PER_AGILITY = 0.005;

const BASE_XP_TO_LEVEL = 100;
const XP_CURVE = 1.5;

// --------------------------------------------------
// XP CURVE
// --------------------------------------------------

export function computeXpToNext(level) {
    const lvl = Math.max(1, Number(level) || 1);
    return Math.round(BASE_XP_TO_LEVEL * Math.pow(XP_CURVE, lvl - 1));
}

// --------------------------------------------------
// STAT SOURCES
// --------------------------------------------------

export function getPlayerLevel(game) {
    return Math.max(1, game?.player?.level ?? 1);
}

export function getPlayerXp(game) {
    return Math.max(0, game?.inventory?.experience ?? 0);
}

export function getXpToNext(game) {
    return computeXpToNext(getPlayerLevel(game));
}

export function getBaseStats(game) {
    const level = getPlayerLevel(game);
    const gains = level - 1;
    return {
        strength: BASE_STATS.strength + WARRIOR_LEVEL_GAINS.strength * gains,
        agility: BASE_STATS.agility + WARRIOR_LEVEL_GAINS.agility * gains,
        vitality: BASE_STATS.vitality + WARRIOR_LEVEL_GAINS.vitality * gains
    };
}

export function getEquipmentStats(game) {
    const total = {
        strength: 0,
        agility: 0,
        vitality: 0,
        attack: 0,
        defense: 0,
        health: 0,
        crit: 0
    };

    const equipment = game?.equipment ?? {};

    for (const equipped of Object.values(equipment)) {
        if (!equipped?.stats) continue;
        for (const [key, value] of Object.entries(equipped.stats)) {
            if (typeof value === "number" && key in total) {
                total[key] += value;
            }
        }
    }

    return total;
}

export function getDerivedStats(game) {
    const base = getBaseStats(game);
    const gear = getEquipmentStats(game);

    const strength = base.strength + gear.strength;
    const agility = base.agility + gear.agility;
    const vitality = base.vitality + gear.vitality;

    return {
        strength,
        agility,
        vitality,
        maxHealth: Math.round(
            BASE_HEALTH + vitality * HP_PER_VITALITY + gear.health
        ),
        attack: round1(
            strength * ATTACK_PER_STRENGTH +
                agility * ATTACK_PER_AGILITY +
                gear.attack
        ),
        defense: round1(vitality * DEFENSE_PER_VITALITY + gear.defense),
        crit: round3(BASE_CRIT + agility * CRIT_PER_AGILITY + gear.crit)
    };
}

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

export function ensurePlayerInitialized(game) {
    if (!game) return null;

    game.player ??= {};
    game.player.level ??= 1;

    if (game.player.hp == null) {
        game.player.hp = getDerivedStats(game).maxHealth;
    }

    return game.player;
}

// --------------------------------------------------
// XP / LEVEL
// --------------------------------------------------

export function gainXp(game, amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
        return { gained: 0, levelUps: [], level: getPlayerLevel(game) };
    }

    ensurePlayerInitialized(game);

    const before = {
        level: game.player.level,
        xp: getPlayerXp(game)
    };

    addInventoryItem(game, "experience", amount);

    const levelUps = [];
    let toNext = computeXpToNext(game.player.level);

    while (game.inventory.experience >= toNext) {
        game.inventory.experience -= toNext;
        game.player.level += 1;
        game.player.hp = getDerivedStats(game).maxHealth;
        levelUps.push(game.player.level);
        toNext = computeXpToNext(game.player.level);
    }

    return {
        gained: amount,
        before,
        after: {
            level: game.player.level,
            xp: game.inventory.experience
        },
        levelUps,
        level: game.player.level
    };
}

// --------------------------------------------------
// HP
// --------------------------------------------------

export function healPlayer(game, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    ensurePlayerInitialized(game);

    const max = getDerivedStats(game).maxHealth;
    const before = game.player.hp;
    game.player.hp = Math.min(max, before + amount);
    return game.player.hp - before;
}

export function damagePlayer(game, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    ensurePlayerInitialized(game);

    const before = game.player.hp;
    game.player.hp = Math.max(0, before - amount);
    return before - game.player.hp;
}

export function isPlayerDead(game) {
    return (game?.player?.hp ?? 0) <= 0;
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function round1(value) {
    return Math.round(value * 10) / 10;
}

function round3(value) {
    return Math.round(value * 1000) / 1000;
}
