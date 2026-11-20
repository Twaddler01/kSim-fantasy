// src/ui/panels/BattleModal.js
//
// Full-screen battle UI. Wraps a BattleSystem battle object. Calls
// attackAction / fleeAction on the system and re-renders. Rewards and
// penalties are already applied to game state by the time the modal
// shows VICTORY / DEFEAT / FLED.

import { el } from "../components/Element.js";
import {
    attackAction,
    fleeAction,
    useConsumableAction
} from "../../systems/BattleSystem.js";
import { getResultMessage } from "../../notifications/resultMessages.js";
import { getItemAmount } from "../../systems/InventorySystem.js";

export default class BattleModal {
    constructor({ getGame, save, refreshUI, showToast, onClose } = {}) {
        if (typeof getGame !== "function") {
            throw new Error("BattleModal requires getGame().");
        }

        this.getGame = getGame;
        this.save = save ?? (() => {});
        this.refreshUI = refreshUI ?? (() => {});
        this.showToast = showToast ?? (() => {});
        this.onClose = onClose ?? (() => {});

        this.battle = null;
        this.visible = false;

        this.buildDOM();
        document.body.append(this.element);

        this.onKeyDown = event => {
            if (!this.visible) return;
            if (event.key === "Escape" && this.battle?.finished) {
                this.close();
            }
        };
        document.addEventListener("keydown", this.onKeyDown);
    }

    get game() {
        return this.getGame();
    }

    // ==================================================
    // DOM
    // ==================================================

    buildDOM() {
        this.backdrop = el("div", {
            className: "battle-backdrop",
            role: "presentation"
        });

        this.panel = el("section", {
            className: "battle-modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "battle-enemy-name"
        });

        this.backdrop.append(this.panel);
        this.element = this.backdrop;
    }

    // ==================================================
    // PUBLIC API
    // ==================================================

    show(battle) {
        if (!battle) return;

        this.battle = battle;
        this.render();

        this.element.classList.add("is-visible");
        document.body.classList.add("modal-open", "battle-open");
        this.visible = true;
    }

    close() {
        if (!this.visible) return;
        this.visible = false;
        this.element.classList.remove("is-visible");
        document.body.classList.remove("modal-open", "battle-open");

        try {
            this.save();
            this.refreshUI({ database: true });
        } finally {
            this.onClose?.();
        }
    }

    destroy() {
        document.removeEventListener("keydown", this.onKeyDown);
        document.body.classList.remove("modal-open", "battle-open");
        this.element.remove();
    }

    // ==================================================
    // ACTIONS
    // ==================================================

    doAttack() {
        if (!this.battle || this.battle.finished) return;
        attackAction(this.game, this.battle);
        this.render();
    }

    doFlee() {
        if (!this.battle || this.battle.finished) return;
        fleeAction(this.game, this.battle);
        this.render();
    }

    doUseItem(itemId) {
        if (!this.battle || this.battle.finished) return;

        const result = useConsumableAction(this.game, this.battle, itemId);

        if (!result.ok) {
            this.showToast(
                getResultMessage(result.reason, "Unable to use item.")
            );

            return;
        }

        this.render();
    }

    // ==================================================
    // RENDER
    // ==================================================

    render() {
        if (!this.battle) return;

        const battle = this.battle;

        this.panel.replaceChildren(
            this.renderEnemy(battle),
            this.renderPlayer(battle),
            this.renderLog(battle),
            this.renderActions(battle)
        );
    }

    renderEnemy(battle) {
        const pct =
            battle.enemyMaxHp > 0
                ? Math.round((battle.enemyHp / battle.enemyMaxHp) * 100)
                : 0;

        const hpFill = el("div", { className: "battle-enemy-hp-fill" });
        hpFill.style.width = `${pct}%`;

        return el("header", { className: "battle-enemy" }, [
            el("div", {
                className: "battle-enemy-icon",
                text: battle.enemy.icon ?? "❔"
            }),
            el("div", {
                className: "battle-enemy-name",
                id: "battle-enemy-name",
                text: battle.enemy.name
            }),
            el("div", {
                className: "battle-enemy-level",
                text: `Level ${battle.enemy.level}`
            }),
            el("div", { className: "battle-enemy-hp-bar" }, [hpFill]),
            el("div", {
                className: "battle-enemy-hp-text",
                text: `${battle.enemyHp} / ${battle.enemyMaxHp}`
            })
        ]);
    }

    renderPlayer(battle) {
        const pct =
            battle.playerMaxHp > 0
                ? Math.round((battle.playerHp / battle.playerMaxHp) * 100)
                : 0;

        const hpFill = el("div", { className: "battle-player-hp-fill" });
        hpFill.style.width = `${pct}%`;

        return el("div", { className: "battle-player" }, [
            el("div", { className: "battle-player-name", text: "You" }),
            el("div", {
                className: "battle-player-stats",
                text: `ATK ${battle.playerStats.attack} · DEF ${battle.playerStats.defense} · CRIT ${(battle.playerStats.crit * 100).toFixed(1)}%`
            }),
            el("div", { className: "battle-player-hp-bar" }, [hpFill]),
            el("div", {
                className: "battle-player-hp-text",
                text: `${battle.playerHp} / ${battle.playerMaxHp}`
            })
        ]);
    }

    renderLog(battle) {
        const log = el("div", {
            className: "battle-log",
            role: "log",
            "aria-live": "polite"
        });

        for (const entry of battle.log) {
            log.append(
                el("div", {
                    className: `battle-log-entry kind-${entry.kind}`,
                    text: entry.text
                })
            );
        }

        // Scroll to bottom after render (deferred to next frame so layout
        // is ready).
        requestAnimationFrame(() => {
            log.scrollTop = log.scrollHeight;
        });

        return log;
    }

    renderActions(battle) {
        const footer = el("footer", { className: "battle-actions" });

        if (battle.finished) {
            const label = battle.victory
                ? "CONTINUE"
                : battle.fled
                  ? "RETREAT"
                  : "RECOVER";

            footer.append(
                el("button", {
                    type: "button",
                    className: "battle-action battle-action-primary",
                    text: label,
                    onClick: () => this.close()
                })
            );

            return footer;
        }

        const potionCount = getItemAmount(this.game, "healingPotion");
        const potionUsed = Boolean(battle.consumablesUsed?.healing);
        
        if (potionCount > 0 || potionUsed) {
            footer.append(
                el("button", {
                    type: "button",
                    className: "battle-action",
                    text: potionUsed ? "POTION USED" : "USE POTION",
                    disabled:
                        potionUsed ||
                        potionCount < 1 ||
                        battle.playerHp >= battle.playerMaxHp,
                    onClick: () => this.doUseItem("healingPotion")
                })
            );
        }
        
        footer.append(
            el("button", {
                type: "button",
                className: "battle-action battle-action-primary",
                text: "ATTACK",
                onClick: () => this.doAttack()
            }),
            el("button", {
                type: "button",
                className: "battle-action",
                text: "FLEE",
                onClick: () => this.doFlee()
            })
        );

        return footer;
    }
}
