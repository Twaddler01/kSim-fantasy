import { el } from "../components/Element.js";

const DEFAULT_PORTRAIT = new URL(
    "../../assets/portraits/default-target.svg",
    import.meta.url
).href;

const ENTITY_ACTIONS = {
    enemy: [{ id: "attack", label: "Attack" }],
    gather: [{ id: "gather", label: "Gather" }],
    cache: [{ id: "loot", label: "Loot" }],
    cave: [{ id: "enter", label: "Enter" }]
};

export default class SelectedEntityPanel {
    constructor({ onAction = null } = {}) {
        this.onAction = onAction;
        this.selectedEntity = null;

        this.portrait = el("img", {
            className: "status-panel-portrait",
            src: DEFAULT_PORTRAIT,
            alt: ""
        });

        this.icon = el("div", {
            className: "status-panel-portrait status-panel-icon",
            textContent: ""
        });

        this.nameElement = el("div", {
            className: "status-panel-name"
        });

        this.subtitleElement = el("div", {
            className: "status-panel-subtitle"
        });

        this.healthFill = el("div", {
            className: "status-bar-fill"
        });

        const healthTrack = el(
            "div",
            { className: "status-bar status-bar-health" },
            [this.healthFill]
        );

        this.bars = el("div", { className: "status-panel-bars" }, [
            healthTrack
        ]);

        this.actionsElement = el("div", {
            className: "selected-entity-actions"
        });

        const info = el("div", { className: "status-panel-info" }, [
            this.nameElement,
            this.subtitleElement,
            this.bars,
            this.actionsElement
        ]);

        const main = el("div", { className: "status-panel-main" }, [
            this.portrait,
            this.icon,
            info
        ]);

        this.element = el(
            "div",
            {
                className:
                    "target-status-panel selected-entity-panel is-hidden",
                "aria-label": "Selected entity"
            },
            [main]
        );
    }

    getElement() {
        return this.element;
    }

    update(target = null) {
        this.selectedEntity = target;

        if (!target) {
            this.element.classList.add("is-hidden");
            this.updateActions(null);
            return;
        }

        this.element.classList.remove("is-hidden");

        // Name and optional level.
        this.nameElement.textContent =
            target.level != null
                ? `${target.name} (Lv. ${target.level})`
                : target.name;

        // Secondary entity description.
        this.subtitleElement.textContent = target.subtitle ?? "";

        this.subtitleElement.className = `status-panel-subtitle status-panel-${target.type ?? "unknown"}`;

        // Portrait image or entity icon.
        if (target.portrait) {
            this.portrait.src = target.portrait;
            this.portrait.style.display = "";
            this.icon.style.display = "none";
        } else {
            this.portrait.style.display = "none";
            this.icon.style.display = "grid";
            this.icon.textContent = target.icon ?? "❔";
        }

        // Health is only displayed for entities that have it.
        const hasHealth =
            Number.isFinite(target.hp) &&
            Number.isFinite(target.maxHealth) &&
            target.maxHealth > 0;

        this.bars.style.display = hasHealth ? "" : "none";

        if (hasHealth) {
            const ratio = Math.max(
                0,
                Math.min(1, target.hp / target.maxHealth)
            );

            this.healthFill.style.width = `${ratio * 100}%`;
        }

        this.updateActions(target);
    }

    updateActions(target) {
        this.actionsElement.replaceChildren();

        const actions = ENTITY_ACTIONS[target?.type] ?? [];

        for (const action of actions) {
            const button = el("button", {
                className: "selected-entity-action",
                textContent: action.label,
                onclick: () => {
                    this.onAction?.(action.id, this.selectedEntity);
                }
            });

            this.actionsElement.append(button);
        }
    }
}
