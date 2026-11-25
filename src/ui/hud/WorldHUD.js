import { el } from "../components/Element.js";
import PlayerStatusPanel from "./PlayerStatusPanel.js";
import SelectedEntityPanel from "./SelectedEntityPanel.js";
import ActionSelector from "./ActionSelector.js";

export default class WorldHUD {
    constructor({ getPlayer, getEquipment, onActionChange = null }) {
        this.playerPanel = new PlayerStatusPanel({
            getPlayer,
            getEquipment
        });

        this.targetPanel = new SelectedEntityPanel();

        this.actionSelector = new ActionSelector({
            onChange: onActionChange
        });

        this.statusPanels = el(
            "div",
            { className: "world-hud-status-panels" },
            [this.playerPanel.getElement(), this.targetPanel.getElement()]
        );

        this.element = el("div", { className: "world-hud" }, [
            this.statusPanels,
            this.actionSelector.getElement()
        ]);
    }

    getElement() {
        return this.element;
    }

    update() {
        if (this.battle) {
            this.playerPanel.update(
                this.battle.playerHp,
                this.battle.playerMaxHp
            );

            this.targetPanel.updateCombatHealth(
                this.battle.enemyHp,
                this.battle.enemyMaxHp
            );
        } else {
            this.playerPanel.update();
        }
    }

    setTarget(target) {
        this.targetPanel.update(target);
        this.actionSelector.update(target);
    }

    clearTarget() {
        this.targetPanel.update(null);
        this.actionSelector.update(null);
    }

    setCombat(battle) {
        this.battle = battle ?? null;
        this.isInCombat = Boolean(battle);

        this.playerPanel.setCombat(this.isInCombat);
        this.targetPanel.setCombat(this.isInCombat);
        this.actionSelector.setCombat(this.isInCombat);
    }

    clearCombat() {
        this.setCombat(null);
    }
}
