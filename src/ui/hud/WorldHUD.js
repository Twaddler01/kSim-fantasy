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
        this.playerPanel.update();
    }

    setTarget(target) {
        this.targetPanel.update(target);
        this.actionSelector.update(target);
    }

    clearTarget() {
        this.targetPanel.update(null);
        this.actionSelector.update(null);
    }
}
