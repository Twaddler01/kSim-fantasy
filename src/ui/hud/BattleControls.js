import { el } from "../components/Element.js";

export default class BattleControls {
    constructor({ onAttack, onFlee, onFocusEnemy }) {
        this.onAttack = onAttack;
        this.onFlee = onFlee;
        this.onFocusEnemy = onFocusEnemy;

        this.enemyIcon = el("button", {
            className: "battle-enemy-focus",
            type: "button",
            text: "❔",
            title: "Focus battle enemy",
            "aria-label": "Focus battle enemy",
            onClick: () => this.onFocusEnemy?.()
        });

        this.rangeLabel = el("span", {
            className: "battle-range-label",
            text: "OUT OF RANGE"
        });

        this.enemyFill = el("div", {
            className: "battle-progress-fill enemy-progress-fill"
        });

        this.enemyLabel = el("span", {
            className: "battle-progress-label",
            text: "Enemy attack"
        });

        this.attackButton = el("button", {
            className: "battle-button attack-button",
            text: "⚔ Attack",
            type: "button",
            onClick: () => this.onAttack?.()
        });

        this.fleeButton = el("button", {
            className: "battle-button flee-button",
            text: "Flee",
            type: "button",
            onClick: () => this.onFlee?.()
        });

        this.enemyBar = el(
            "div",
            {
                className: "battle-progress battle-progress-enemy"
            },
            [
                this.enemyLabel,
                el(
                    "div",
                    {
                        className: "battle-progress-track"
                    },
                    [this.enemyFill]
                )
            ]
        );

        this.element = el(
            "div",
            {
                className: "battle-controls is-hidden"
            },
            [
                el(
                    "div",
                    {
                        className: "battle-header"
                    },
                    [
                        el("span", {
                            className: "battle-title",
                            text: "BATTLE"
                        }),
                        this.enemyIcon,
                        this.rangeLabel
                    ]
                ),

                this.enemyBar,

                el(
                    "div",
                    {
                        className: "battle-button-row"
                    },
                    [this.attackButton, this.fleeButton]
                )
            ]
        );

        this.update(null);
    }

    update(battle, { enemy = null, inRange = false } = {}) {
        const active = Boolean(battle && !battle.finished);

        this.element.classList.toggle("is-hidden", !active);

        if (!active) {
            this.setProgress(0);
            this.attackButton.disabled = true;
            this.enemyIcon.textContent = "❔";
            this.setRange(false);
            return;
        }

        this.enemyIcon.textContent = enemy?.icon ?? battle.enemy?.icon ?? "❔";

        this.setRange(inRange);

        const enemyWindingUp = battle.enemyWindupRemaining > 0;

        this.setProgress(
            inRange && enemyWindingUp ? battle.enemyWindupProgress : 0
        );

        this.enemyLabel.textContent = enemyWindingUp
            ? "Enemy attacking..."
            : "Enemy attack";

        this.enemyBar.classList.toggle("is-inactive", !inRange);

        const playerWindingUp = battle.playerWindupRemaining > 0;
        const playerCoolingDown = battle.playerCooldownRemaining > 0;

        this.attackButton.disabled = playerWindingUp || playerCoolingDown;
    }

    setRange(inRange) {
        this.rangeLabel.textContent = inRange ? "IN RANGE" : "OUT OF RANGE";

        this.rangeLabel.classList.toggle("is-in-range", inRange);
        this.rangeLabel.classList.toggle("is-out-of-range", !inRange);
    }

    setProgress(progress) {
        const percent = Math.max(0, Math.min(1, Number(progress) || 0)) * 100;

        this.enemyFill.style.width = `${percent}%`;
    }

    getElement() {
        return this.element;
    }
}
