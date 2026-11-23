// src/ui/overlays/OverlayManager.js

export default class OverlayManager {
    constructor({ panels = {}, onChange } = {}) {
        this.panels = panels;
        this.onChange = onChange;

        this.activeId = null;

        this.element = null;
        this.panelElement = null;
        this.titleElement = null;
        this.contentElement = null;
    }

    // ================================================
    // DOM
    // ================================================

    getElement() {
        if (this.element) return this.element;

        this.element = document.createElement("div");
        this.element.className = "overlay-layer";
        this.element.hidden = true;

        this.panelElement = document.createElement("section");
        this.panelElement.className = "game-overlay";
        this.panelElement.setAttribute("role", "dialog");
        this.panelElement.setAttribute("aria-modal", "false");

        const header = document.createElement("header");
        header.className = "game-overlay-header";

        this.titleElement = document.createElement("h2");
        this.titleElement.className = "game-overlay-title";

        const closeButton = document.createElement("button");
        closeButton.className = "game-overlay-close";
        closeButton.type = "button";
        closeButton.textContent = "×";
        closeButton.setAttribute("aria-label", "Close overlay");
        closeButton.addEventListener("click", () => this.close());

        header.append(this.titleElement, closeButton);

        this.contentElement = document.createElement("div");
        this.contentElement.className = "game-overlay-content";

        this.panelElement.append(header, this.contentElement);
        this.element.append(this.panelElement);

        // Clicking outside the panel closes the overlay.
        this.element.addEventListener("click", event => {
            if (event.target === this.element) {
                this.close();
            }
        });

        return this.element;
    }

    // ================================================
    // NAVIGATION
    // ================================================

    open(id) {
        const definition = this.panels[id];

        if (!definition) {
            console.warn(`[OverlayManager] Unknown overlay: ${id}`);
            return false;
        }

        this.getElement();

        definition.update?.();

        const panel = definition.getElement?.();

        if (!panel) {
            console.warn(`[OverlayManager] Overlay has no element: ${id}`);
            return false;
        }

        this.activeId = id;
        this.titleElement.textContent = definition.title ?? id;

        this.contentElement.replaceChildren(panel);
        this.element.hidden = false;

        this.onChange?.(id);

        return true;
    }

    close() {
        if (!this.activeId) return false;

        this.activeId = null;

        this.contentElement.replaceChildren();
        this.element.hidden = true;

        this.onChange?.(null);

        return true;
    }

    toggle(id) {
        if (this.activeId === id) {
            return this.close();
        }

        return this.open(id);
    }

    // ================================================
    // REFRESH
    // ================================================

    update() {
        if (!this.activeId) return this;

        const definition = this.panels[this.activeId];
        if (!definition) return this;

        definition.update?.();

        const panel = definition.getElement?.();

        if (panel && panel !== this.contentElement.firstElementChild) {
            this.contentElement.replaceChildren(panel);
        }

        return this;
    }

    isOpen(id) {
        return this.activeId === id;
    }
}
