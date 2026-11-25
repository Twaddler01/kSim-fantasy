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

        this.target = null;
        this.battle = null;
        this.battleEnemyEntity = null;

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

    isBattleTarget() {
        return Boolean(
            this.battle &&
            this.battleEnemyEntity &&
            this.target?.entity === this.battleEnemyEntity
        );
    }

    update() {
        if (this.battle) {
            this.playerPanel.update(
                this.battle.playerHp,
                this.battle.playerMaxHp
            );
        } else {
            this.playerPanel.update();
        }

        const isBattleTarget = this.isBattleTarget();

        this.targetPanel.setCombat(isBattleTarget);

        if (isBattleTarget) {
            this.targetPanel.updateCombatHealth(
                this.battle.enemyHp,
                this.battle.enemyMaxHp
            );
        }
    }

    setTarget(target) {
        this.target = target;

        this.targetPanel.update(target);
        this.actionSelector.update(target);

        this.update();
    }

    clearTarget() {
        this.target = null;

        this.targetPanel.update(null);
        this.targetPanel.setCombat(false);
        this.actionSelector.update(null);
    }

    clearTargetIf(entity) {
        if (this.target?.entity !== entity) return false;

        this.clearTarget();
        return true;
    }

    setCombat(battle, enemyEntity = null) {
        this.battle = battle ?? null;
        this.battleEnemyEntity = battle ? enemyEntity : null;

        const active = Boolean(battle);

        this.playerPanel.setCombat(active);
        this.actionSelector.setCombat(active);

        this.update();
    }

    clearCombat() {
        this.setCombat(null);
    }
}
