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
        return Boolean(this.battle && !this.battle.finished);
    }

    start(enemyId, entity, scene) {
        if (this.isActive) {
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

        this.worldHUD.setCombat(this.battle);

        return true;
    }

    beginAttack() {
        if (!this.isActive) return false;

        return beginPlayerAttack(this.battle);
    }

    update(dt, scene = this.scene) {
        if (!this.isActive) return;

        if (scene) {
            this.scene = scene;
        }

        updateBattle(this.getGame(), this.battle, dt);

        if (this.battle.finished) {
            this.finish();
        }
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

        // Only victory consumes the world enemy.
        if (battle.victory && this.enemyEntity) {
            this.scene?.consumeEntity(
                this.enemyEntity,
                `${battle.enemy.name} defeated`
            );
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
