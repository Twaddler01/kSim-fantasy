// src/systems/character.js
//
// Player character: base stats, derived combat stats, XP, level, HP.
//
// State ownership:
//   player    — name, level, xp, hp, resource, maxResource
//   equipment — equipped items and their stat bonuses
//
// Max HP, attack, defense, and crit are derived or calculated.
// Character progression and current resource values are stored.

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
const BASE_RESOURCE = 100;
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
// CHARACTER PROGRESSION
// --------------------------------------------------

export function getPlayerLevel(player) {
    return Math.max(1, Number(player?.level) || 1);
}

export function getPlayerXp(player) {
    return Math.max(0, Number(player?.xp) || 0);
}

export function getXpToNext(player) {
    return computeXpToNext(getPlayerLevel(player));
}

// --------------------------------------------------
// STAT SOURCES
// --------------------------------------------------

export function getBaseStats(player) {
    const level = getPlayerLevel(player);
    const gains = level - 1;

    return {
        strength: BASE_STATS.strength + WARRIOR_LEVEL_GAINS.strength * gains,

        agility: BASE_STATS.agility + WARRIOR_LEVEL_GAINS.agility * gains,

        vitality: BASE_STATS.vitality + WARRIOR_LEVEL_GAINS.vitality * gains
    };
}

export function getEquipmentStats(equipment) {
    const total = {
        strength: 0,
        agility: 0,
        vitality: 0,
        attack: 0,
        defense: 0,
        health: 0,
        crit: 0
    };

    for (const equipped of Object.values(equipment ?? {})) {
        if (!equipped?.stats) continue;

        for (const [key, value] of Object.entries(equipped.stats)) {
            if (typeof value === "number" && key in total) {
                total[key] += value;
            }
        }
    }

    return total;
}

// --------------------------------------------------
// DERIVED STATS
// --------------------------------------------------

export function getDerivedStats(player, equipment) {
    const base = getBaseStats(player);
    const gear = getEquipmentStats(equipment);

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
// CHARACTER DATA
// --------------------------------------------------

/**
 * Returns the complete read-only data needed by character UI.
 *
 * XP progress is a ratio from 0 to 1.
 */
export function getCharacterData(player, equipment) {
    const stats = getDerivedStats(player, equipment);
    const level = getPlayerLevel(player);
    const xp = getPlayerXp(player);
    const xpToNext = computeXpToNext(level);
    const maxResource =
        Number.isFinite(player?.maxResource) && player.maxResource > 0
            ? player.maxResource
            : BASE_RESOURCE;

    const resource = Math.max(
        0,
        Math.min(maxResource, Number(player?.resource) || 0)
    );

    return {
        name: player?.name || "Adventurer",

        level,
        xp,
        xpToNext,
        xpRemaining: Math.max(0, xpToNext - xp),
        xpProgress: Math.min(1, xp / xpToNext),

        hp: player?.hp ?? stats.maxHealth,
        maxHealth: stats.maxHealth,

        resource,
        maxResource,
        resourceProgress: resource / maxResource,

        stats
    };
}

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

/**
 * Ensures the player state exists and is valid.
 *
 * Existing HP is preserved when possible, but clamped to the
 * current maximum if equipment or stats have changed.
 */
export function ensurePlayerInitialized(player, equipment) {
    if (!player || typeof player !== "object") {
        throw new TypeError(
            "[CharacterSystem] A valid player object is required."
        );
    }

    player.level = getPlayerLevel(player);
    player.xp = getPlayerXp(player);

    const stats = getDerivedStats(player, equipment);

    // Health
    if (player.hp == null || !Number.isFinite(player.hp)) {
        player.hp = stats.maxHealth;
    } else {
        player.hp = Math.max(0, Math.min(stats.maxHealth, player.hp));
    }

    // Name
    player.name =
        typeof player.name === "string" && player.name.trim()
            ? player.name.trim()
            : "Adventurer";

    // Resource
    player.maxResource =
        Number.isFinite(player.maxResource) && player.maxResource > 0
            ? player.maxResource
            : BASE_RESOURCE;

    if (!Number.isFinite(player.resource)) {
        player.resource = player.maxResource;
    } else {
        player.resource = Math.max(
            0,
            Math.min(player.maxResource, player.resource)
        );
    }

    return player;
}

// --------------------------------------------------
// XP / LEVEL
// --------------------------------------------------

/**
 * Awards XP and processes any resulting level-ups.
 *
 * Returns levelUps as an array of level numbers.
 */
export function gainXp(player, amount, equipment) {
    ensurePlayerInitialized(player, equipment);

    const gained = Math.max(0, Math.floor(Number(amount) || 0));
    const before = player.xp;

    if (gained === 0) {
        return {
            gained: 0,
            before,
            after: before,
            levelUps: [],
            level: player.level
        };
    }

    player.xp += gained;

    const levelUps = [];

    while (player.xp >= getXpToNext(player)) {
        const required = getXpToNext(player);

        player.xp -= required;
        player.level += 1;

        levelUps.push(player.level);

        // Leveling up fully restores health.
        player.hp = getDerivedStats(player, equipment).maxHealth;
    }

    return {
        gained,
        before,
        after: player.xp,
        levelUps,
        level: player.level
    };
}

// --------------------------------------------------
// HP
// --------------------------------------------------

export function healPlayer(player, amount, equipment) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    ensurePlayerInitialized(player, equipment);

    const max = getDerivedStats(player, equipment).maxHealth;
    const before = player.hp;

    player.hp = Math.min(max, before + amount);

    return player.hp - before;
}

export function damagePlayer(player, amount, equipment) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    ensurePlayerInitialized(player, equipment);

    const before = player.hp;

    player.hp = Math.max(0, before - amount);

    return before - player.hp;
}

export function isPlayerDead(player) {
    return (player?.hp ?? 0) <= 0;
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
