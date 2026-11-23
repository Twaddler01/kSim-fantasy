import { el } from "../components/Element.js";
import { getCharacterData } from "../../systems/character.js";

const DEFAULT_PORTRAIT = new URL(
    "../../assets/portraits/default-player.svg",
    import.meta.url
).href;

export default class PlayerStatusPanel {
    constructor({ getPlayer, getEquipment }) {
        this.getPlayer = getPlayer;
        this.getEquipment = getEquipment;

        // Portrait
        this.portrait = el("img", {
            className: "status-panel-portrait",
            src: DEFAULT_PORTRAIT,
            alt: ""
        });

        // Name and level
        this.nameElement = el("div", {
            className: "status-panel-name"
        });

        // Health bar
        this.healthFill = el("div", {
            className: "status-bar-fill"
        });

        const healthTrack = el(
            "div",
            { className: "status-bar status-bar-health" },
            [this.healthFill]
        );

        // Resource bar
        this.resourceFill = el("div", {
            className: "status-bar-fill"
        });

        const resourceTrack = el(
            "div",
            { className: "status-bar status-bar-resource" },
            [this.resourceFill]
        );

        const bars = el("div", { className: "status-panel-bars" }, [
            healthTrack,
            resourceTrack
        ]);

        const info = el("div", { className: "status-panel-info" }, [
            this.nameElement,
            bars
        ]);

        const main = el("div", { className: "status-panel-main" }, [
            this.portrait,
            info
        ]);

        // XP strip
        this.xpFill = el("div", {
            className: "status-panel-xp-fill"
        });

        const xpTrack = el("div", { className: "status-panel-xp" }, [
            this.xpFill
        ]);

        this.element = el(
            "div",
            {
                className: "player-status-panel",
                "aria-label": "Player status"
            },
            [main, xpTrack]
        );
    }

    getElement() {
        return this.element;
    }

    update() {
        const data = getCharacterData(this.getPlayer(), this.getEquipment());

        this.nameElement.textContent = `${data.name} (Lv. ${data.level})`;

        this.setFill(this.healthFill, data.hp, data.maxHealth);

        this.setFill(this.resourceFill, data.resource, data.maxResource);

        this.setFill(this.xpFill, data.xp, data.xpToNext);
    }

    setFill(fill, current, maximum) {
        const ratio =
            maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0;

        fill.style.width = `${ratio * 100}%`;
    }
}
