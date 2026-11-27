// src/systems/PlayerDeathController.js
//
// Orchestrates the player death sequence:
//   pause world → skull → overlay 3·2·1 → teleport to spawn → resume
//
// State is ephemeral. Gold penalty + HP restoration happen synchronously
// in BattleSystem.finalizeDefeat; this controller is purely the UX bridge
// between "you died" and "you're back at spawn."

const RESPAWN_TICK_MS = 1000;
const RESPAWN_SECONDS = 3;

export default class PlayerDeathController {
    constructor({ getGame, worldHUD, save, onRespawn = null } = {}) {
        this.getGame = getGame;
        this.worldHUD = worldHUD;
        this.save = save ?? (() => {});
        this.onRespawn = onRespawn;

        this.running = false;
        this._timer = null;
    }

    isActive() {
        return this.running;
    }

    start({ battle, enemyEntity, scene } = {}) {
        if (this.running) return false;
        if (!scene) return false;

        this.running = true;

        const canvas = scene.canvas;
        if (!canvas) {
            this.running = false;
            return false;
        }

        // 1. Clear target panel; enemy is disengaging.
        this.worldHUD?.clearTarget();
        this.worldHUD?.clearCombat();

        // 2. Ensure enemy is neutral (BattleController already does
        //    this, but be defensive in case another path calls us).
        if (enemyEntity) {
            enemyEntity.inCombat = false;
        }

        // 3. Show player panel at 0 HP during the sequence.
        const maxHp = battle?.playerMaxHp;
        if (maxHp > 0) {
            this.worldHUD?.playerPanel?.update?.(0, maxHp);
        }

        // 4. Pause the world (freezes movement, enemy AI, onUpdate).
        canvas.pause();

        // 5. Swap to skull + show overlay.
        canvas.setPlayerDead(true);
        canvas.showDeathOverlay(RESPAWN_SECONDS);

        let remaining = RESPAWN_SECONDS;

        const tick = () => {
            remaining -= 1;

            if (remaining > 0) {
                canvas.updateDeathOverlay(remaining);
                this._timer = setTimeout(tick, RESPAWN_TICK_MS);
                return;
            }

            // 6. Respawn.
            canvas.hideDeathOverlay();
            canvas.respawnPlayer();
            canvas.setPlayerDead(false);
            canvas.resume();

            // 7. Refresh HUD to full HP.
            this.worldHUD?.playerPanel?.update?.();

            this.save();
            this.running = false;
            this._timer = null;

            this.onRespawn?.();
        };

        this._timer = setTimeout(tick, RESPAWN_TICK_MS);
        return true;
    }

    cancel() {
        if (this._timer) clearTimeout(this._timer);
        this._timer = null;
        this.running = false;
    }
}
