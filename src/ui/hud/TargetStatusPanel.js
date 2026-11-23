import { el } from "../components/Element.js";

const DEFAULT_PORTRAIT = new URL(
    "../../assets/portraits/default-target.svg",
    import.meta.url
).href;

export default class TargetStatusPanel {
    constructor() {
        this.portrait = el("img", {
            className: "status-panel-portrait",
            src: DEFAULT_PORTRAIT,
            alt: ""
        });

        this.nameElement = el("div", {
            className: "status-panel-name"
        });

        this.healthFill = el("div", {
            className: "status-bar-fill"
        });

        const healthTrack = el(
            "div",
            { className: "status-bar status-bar-health" },
            [this.healthFill]
        );

        const bars = el("div", { className: "status-panel-bars" }, [
            healthTrack
        ]);

        const info = el("div", { className: "status-panel-info" }, [
            this.nameElement,
            bars
        ]);

        const main = el("div", { className: "status-panel-main" }, [
            this.portrait,
            info
        ]);

        this.element = el(
            "div",
            {
                className: "target-status-panel is-hidden",
                "aria-label": "Selected target"
            },
            [main]
        );
    }

    getElement() {
        return this.element;
    }

    update(target = null) {
        if (!target) {
            this.element.classList.add("is-hidden");
            return;
        }

        this.element.classList.remove("is-hidden");

        this.nameElement.textContent = `${target.name} (Lv. ${target.level ?? 1})`;

        if (target.portrait) {
            this.portrait.src = target.portrait;
        }

        const hp = target.hp ?? 0;
        const maxHealth = target.maxHealth ?? 1;

        const ratio = Math.max(0, Math.min(1, hp / maxHealth));

        this.healthFill.style.width = `${ratio * 100}%`;
    }
}
