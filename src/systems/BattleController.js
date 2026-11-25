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
        onFinish = null
    }) {
        this.getGame = getGame;
        this.worldHUD = worldHUD;
        this.save = save;
        this.refreshUI = refreshUI;
        this.showToast = showToast;
        this.onFinish = onFinish;

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

    finish() {
        if (!this.battle) return;

        const battle = this.battle;

        // Remove the aggro indicator when combat ends.
        if (this.enemyEntity) {
            this.enemyEntity.inCombat = false;
        }

        // Only victory consumes the world enemy.
        if (battle.victory && this.enemyEntity) {
            this.scene?.consumeEntity(
                this.enemyEntity,
                `${battle.enemy.name} defeated`
            );
        }

        // Fleeing clears the target panel only if it is displaying
        // the enemy we just fled from.
        if (battle.fled && this.enemyEntity) {
            this.worldHUD.clearTargetIf(this.enemyEntity);
        }

        this.worldHUD.clearCombat();

        this.battle = null;
        this.enemyEntity = null;
        this.scene = null;

        this.save();
        this.refreshUI();

        this.onFinish?.(battle);

        if (battle.victory) {
            this.showToast(`${battle.enemy.name} defeated!`);
        } else if (battle.fled) {
            this.showToast("You retreat from the fight.");
        } else {
            this.showToast("You were defeated.");
        }
    }
}
