import { el } from "../components/Element.js";
import PlayerStatusPanel from "./PlayerStatusPanel.js";
import TargetStatusPanel from "./TargetStatusPanel.js";

export default class WorldHUD {
    constructor({ getPlayer, getEquipment }) {
        this.playerPanel = new PlayerStatusPanel({
            getPlayer,
            getEquipment
        });

        this.targetPanel = new TargetStatusPanel();

        this.element = el("div", { className: "world-hud" }, [
            this.playerPanel.getElement(),
            this.targetPanel.getElement()
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
    }

    clearTarget() {
        this.targetPanel.update(null);
    }
}
