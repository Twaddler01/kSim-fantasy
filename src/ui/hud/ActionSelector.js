import { el } from "../components/Element.js";

const ENTITY_ACTIONS = {
    enemy: [{ id: "attack", label: "⚔ Attack" }],
    gather: [{ id: "gather", label: "🌿 Gather" }],
    cache: [{ id: "loot", label: "📦 Loot" }],
    cave: [{ id: "enter", label: "🕳 Enter" }]
};

export default class ActionSelector {
    constructor({ onChange = null } = {}) {
        this.onChange = onChange;
        this.target = null;
        this.actions = [];
        this.activeActionId = null;
        this.isInCombat = false;

        this.actionLabel = el("div", {
            className: "action-selector-label"
        });

        this.changeButton = el("button", {
            className: "action-selector-change",
            textContent: "↻ Change"
        });

        this.changeButton.addEventListener("click", () => {
            this.cycleAction();
        });

        this.element = el("div", { className: "action-selector is-hidden" }, [
            this.actionLabel,
            this.changeButton
        ]);
    }

    getElement() {
        return this.element;
    }

    setCombat(active) {
        this.isInCombat = active;
        this.updateVisibility();
    }

    updateVisibility() {
        const hasActions = this.actions.length > 0;

        this.element.classList.toggle(
            "is-hidden",
            this.isInCombat || !this.target || !hasActions
        );
    }

    update(target) {
        this.target = target;
        this.actions = target
            ? (target.actions ?? ENTITY_ACTIONS[target.type] ?? [])
            : [];

        if (!target || this.actions.length === 0) {
            this.activeActionId = null;
            this.updateVisibility();
            return;
        }

        const defaultAction = target.defaultAction ?? this.actions[0].id;

        this.activeActionId = this.actions.some(
            action => action.id === defaultAction
        )
            ? defaultAction
            : this.actions[0].id;

        this.updateVisibility();

        this.changeButton.style.display = this.actions.length > 1 ? "" : "none";

        this.render();
        this.notifyChange();
    }

    cycleAction() {
        if (this.actions.length < 2) return;

        const currentIndex = this.actions.findIndex(
            action => action.id === this.activeActionId
        );

        const nextIndex = (currentIndex + 1) % this.actions.length;

        this.activeActionId = this.actions[nextIndex].id;

        this.render();
        this.notifyChange();
    }

    render() {
        const action = this.actions.find(
            item => item.id === this.activeActionId
        );

        this.actionLabel.textContent = action
            ? `ACTION: ${action.label}`
            : "ACTION";
    }

    notifyChange() {
        this.onChange?.(this.activeActionId, this.target);
    }
}
