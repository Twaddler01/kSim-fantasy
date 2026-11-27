import {
    startBattle,
    updateBattle,
    beginPlayerAttack,
    fleeBattle
} from "./BattleSystem.js";

import { getResultMessage } from "../notifications/resultMessages.js";

// Coordinates a battle with the world scene and HUD.
// BattleSystem remains responsible for combat rules and calculations.

export default class BattleController {
    constructor({
        getGame,
        worldHUD,
        save,
        refreshUI,
        showToast,
        lootSystem = null,
        onFinish = null,
        onPlayerDeath = null,
        resourcePopups = null,
        getEnemyAnchor = null,
        getPlayerAnchor = null
    }) {
        this.getGame = getGame;
        this.worldHUD = worldHUD;
        this.save = save;
        this.refreshUI = refreshUI;
        this.showToast = showToast;
        this.lootSystem = lootSystem;
        this.onFinish = onFinish;
        this.onPlayerDeath = onPlayerDeath;

        this.resourcePopups = resourcePopups;
        this._getEnemyAnchorOverride = getEnemyAnchor;
        this._getPlayerAnchorOverride = getPlayerAnchor;

        this.battle = null;
        this.enemyEntity = null;
        this.scene = null;
    }

    get isActive() {
        return Boolean(
            this.battle && this.battle.combatStarted && !this.battle.finished
        );
    }

    start(enemyId, entity, scene) {
        // If combat is already active, tapping the current enemy
        // acts as the player's next attack command.
        if (this.battle && !this.battle.finished) {
            if (this.enemyEntity === entity) {
                // The opening attack is still resolving.
                if (!this.battle.combatStarted) {
                    return false;
                }

                return this.beginAttack();
            }

            this.showToast("You are already in combat.");
            return false;
        }

        const result = startBattle(this.getGame(), enemyId);

        if (!result.ok) {
            this.showToast(getResultMessage(result.reason));
            return false;
        }

        this.battle = result.battle;
        this.enemyEntity = entity;
        this.scene = scene;

        // Automatically begin the opening attack.
        // Combat itself does not start until this attack lands.
        beginPlayerAttack(this.battle);

        return true;
    }

    beginAttack() {
        if (!this.isActive) return false;

        return beginPlayerAttack(this.battle);
    }

    update(dt, scene = this.scene) {
        // Continue updating while the opening attack is resolving,
        // even though combat has not officially started yet.
        if (!this.battle || this.battle.finished) return;

        if (scene) {
            this.scene = scene;
        }

        const result = updateBattle(this.getGame(), this.battle, dt, {
            isPlayerInRange: () =>
                this.scene?.isEnemyInAttackRange(this.enemyEntity) ?? false
        });

        this.showCombatPopups(result.newEvents);

        // Activate combat only after the first successful hit.
        if (this.battle.combatStarted && !this.enemyEntity.inCombat) {
            this.enemyEntity.inCombat = true;
            this.worldHUD.setCombat(this.battle, this.enemyEntity);
        }

        // A successful enemy strike pulls the target panel's
        // focus back to the enemy, without changing world selection.
        const enemyLandedHit = result.newEvents.some(
            event =>
                event.kind === "enemy-attack" || event.kind === "enemy-crit"
        );

        if (enemyLandedHit) {
            this.scene?.focusEntity(this.enemyEntity);
        }

        if (result.playerOutOfRange) {
            this.showToast("⚠️ Out of range!");

            // If the opening attack failed, discard the pending encounter.
            // The player can initiate a fresh encounter by clicking again.
            if (!this.battle.combatStarted) {
                this.cancelPendingEncounter();
                return;
            }
        }

        if (this.battle.finished) {
            this.finish();
        }
    }

    showCombatPopups(events) {
        if (!this.resourcePopups || !events?.length) return;

        for (const event of events) {
            if (event.damage && event.target) {
                const isPlayer = event.target === "player";
                const anchor = isPlayer
                    ? this.getPlayerAnchor()
                    : this.getEnemyAnchor();

                if (!anchor) continue;

                this.resourcePopups.show(
                    [
                        {
                            amount: -event.damage,
                            rawIcon: "❤️",
                            name:
                                event.targetName ??
                                (isPlayer ? "You" : this.battle?.enemy?.name),
                            critical: Boolean(event.critical)
                        }
                    ],
                    anchor
                );
            } else if (event.heal && event.target === "player") {
                const anchor = this.getPlayerAnchor();
                if (!anchor) continue;

                this.resourcePopups.show(
                    [
                        {
                            amount: event.heal,
                            rawIcon: "❤️",
                            name: event.targetName ?? "You"
                        }
                    ],
                    anchor
                );
            }
        }
    }

    getEnemyAnchor() {
        if (this._getEnemyAnchorOverride) {
            return this._getEnemyAnchorOverride(this.enemyEntity, this.scene);
        }

        const canvas = this.scene?.canvas;
        const entity = this.enemyEntity;
        if (!canvas || !entity) return null;

        // Uses the live entity position, so a pursuing enemy
        // anchors to wherever it is at the instant of the hit.
        const pos = canvas.getEntityScreenPosition?.(entity);
        if (!pos) return null;

        // Float above the sprite / emoji so it doesn't overlap the ring.
        // Sprite height ≈ entity.r * 3, so ~2×r puts the popup
        // comfortably above the top of the icon.
        const offset = (entity.r ?? 22) * 2 + 10;

        return { x: pos.x, y: pos.y - offset };
    }

    getPlayerAnchor() {
        if (this._getPlayerAnchorOverride) {
            return this._getPlayerAnchorOverride(this.enemyEntity, this.scene);
        }

        const canvas = this.scene?.canvas;
        if (!canvas) return null;

        const pos = canvas.getPlayerScreenPosition?.();
        if (!pos) return null;

        // Player sprite is 60px tall, centered on player.x/y.
        // 52px above center is ~22px above the character's head.
        return { x: pos.x, y: pos.y - 52 };
    }

    cancelPendingEncounter() {
        if (!this.battle || this.battle.combatStarted) return;

        // The opening attack never connected, so combat never began.
        if (this.enemyEntity) {
            this.enemyEntity.inCombat = false;
        }

        this.battle = null;
        this.enemyEntity = null;
        this.scene = null;
    }

    flee() {
        if (!this.isActive) return false;

        const result = fleeBattle(this.getGame(), this.battle);

        if (!result.ok) return false;

        this.finish();
        return true;
    }

    /**
     * Hand the defeated enemy off to the world as a loot drop.
     *
     * The entity is repurposed in place: same id, same x/y, but its
     * icon swaps to a loot symbol and the enemy-specific fields
     * (attack range etc.) are zeroed so it can't re-enter combat.
     * Respawn still runs through `ZoneScene.buildRespawn()` —
     * `oldEntity.type` stays "enemy", so the zone's spawn table
     * still rebuilds an enemy when the timer fires.
     */
    dropLoot(battle) {
        const entity = this.enemyEntity;
        const scene = this.scene;
        if (!entity || !scene) return;

        const rewardItems = (battle.rewards?.items ?? []).filter(
            entry => entry?.itemId
        );

        if (!rewardItems.length || !this.lootSystem) {
            scene.consumeEntity(entity, `${battle.enemy.name} defeated`);
            return;
        }

        const container = this.lootSystem.createContainer({
            title: `${battle.enemy.name} Remains`,
            icon: "💰",
            sourceType: "enemy",
            items: rewardItems
        });

        if (!container?.items?.length) {
            scene.consumeEntity(entity, `${battle.enemy.name} defeated`);
            return;
        }

        scene.spawnLootDrop(entity, container, {
            icon: "💰",
            label: `${battle.enemy.name} Remains`,
            lootDuration: 60
        });

        // If the corpse is still the selected target, re-emit
        // its data so the HUD swaps to Loot and the loot action
        // lands on the canvas via setTarget → onActionChange.
        if (scene.canvas?.selectedEntity === entity) {
            scene.focusEntity?.(entity);
        }
    }

    finish() {
        if (!this.battle) return;

        const battle = this.battle;
        const scene = this.scene;
        const enemyEntity = this.enemyEntity;

        if (enemyEntity) {
            enemyEntity.inCombat = false;
        }

        if (battle.victory && enemyEntity) {
            this.dropLoot(battle);
        }

        if (battle.victory && battle.rewards?.xp > 0) {
            this.resourcePopups?.show(
                [
                    {
                        amount: battle.rewards.xp,
                        name: "XP",
                        rawIcon: "✨",
                        tone: "xp"
                    }
                ],
                this.getPlayerAnchor()
            );
        }

        if (battle.fled && enemyEntity) {
            this.worldHUD.clearTargetIf(enemyEntity);
        }

        this.worldHUD.clearCombat();

        this.battle = null;
        this.enemyEntity = null;
        this.scene = null;

        this.save();
        this.refreshUI();

        this.onFinish?.(battle);

        // Player death: hand off BEFORE the toast.
        if (battle.playerDefeated) {
            this.onPlayerDeath?.({ battle, enemyEntity, scene });
            return;
        }

        if (battle.victory) {
            this.showToast(`${battle.enemy.name} defeated!`);
        } else if (battle.fled) {
            this.showToast("You retreat from the fight.");
        } else {
            this.showToast("You were defeated.");
        }
    }
}
