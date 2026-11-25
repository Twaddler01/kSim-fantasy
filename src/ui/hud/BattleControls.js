import { el } from "../components/Element.js";

export default class BattleControls {
    constructor({ onAttack, onFlee }) {
        this.onAttack = onAttack;
        this.onFlee = onFlee;

        this.playerFill = el("div", {
            className: "battle-progress-fill player-progress-fill"
        });

        this.enemyFill = el("div", {
            className: "battle-progress-fill enemy-progress-fill"
        });

        this.playerLabel = el("span", {
            className: "battle-progress-label",
            text: "Your attack"
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

        this.playerBar = this.createProgressBar(
            this.playerLabel,
            this.playerFill,
            "player"
        );

        this.enemyBar = this.createProgressBar(
            this.enemyLabel,
            this.enemyFill,
            "enemy"
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
                        className: "battle-progress-group"
                    },
                    [this.playerBar, this.enemyBar]
                ),

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

    createProgressBar(label, fill, type) {
        return el(
            "div",
            {
                className: `battle-progress battle-progress-${type}`
            },
            [
                label,
                el(
                    "div",
                    {
                        className: "battle-progress-track"
                    },
                    [fill]
                )
            ]
        );
    }

    update(battle) {
        const active = Boolean(battle && !battle.finished);

        this.element.classList.toggle("is-hidden", !active);

        if (!active) {
            this.setProgress(this.playerFill, 0);
            this.setProgress(this.enemyFill, 0);
            this.playerLabel.textContent = "Your attack";
            this.enemyLabel.textContent = "Enemy attack";
            this.attackButton.disabled = true;
            return;
        }

        const playerWindingUp = battle.playerWindupRemaining > 0;
        const playerCoolingDown = battle.playerCooldownRemaining > 0;

        const enemyWindingUp = battle.enemyWindupRemaining > 0;

        this.setProgress(
            this.playerFill,
            playerWindingUp ? battle.playerWindupProgress : 0
        );

        this.setProgress(
            this.enemyFill,
            enemyWindingUp ? battle.enemyWindupProgress : 0
        );

        this.playerLabel.textContent = playerWindingUp
            ? "Your attack..."
            : playerCoolingDown
              ? "Recovering..."
              : "Ready to attack";

        this.enemyLabel.textContent = enemyWindingUp
            ? `${battle.enemy.name} attacking...`
            : "Enemy attack";

        this.attackButton.disabled = playerWindingUp || playerCoolingDown;
    }

    setProgress(fill, progress) {
        const percent = Math.max(0, Math.min(1, Number(progress) || 0)) * 100;

        fill.style.width = `${percent}%`;
    }

    getElement() {
        return this.element;
    }
}
