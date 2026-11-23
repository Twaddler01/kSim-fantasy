// src/ui/navigation/NavigationBar.js

/* Owns the navigation DOM and updates
the buttons without rebuilding the 
entire bar. */

import { el } from "../components/Element.js";
import { createNavigationItem } from "./createNavigationItem.js";

export default class NavigationBar {
    constructor({
        destinations = [],
        unreadManager,
        getActiveId,
        onSelect
    } = {}) {
        this.destinations = destinations;
        this.unreadManager = unreadManager;
        this.getActiveId = getActiveId;
        this.onSelect = onSelect;

        this.element = el("nav", {
            className: "game-navigation",
            "aria-label": "Game navigation"
        });

        this.update();
    }

    update() {
        const activeId = this.getActiveId?.();

        this.element.replaceChildren(
            ...this.destinations.map(destination =>
                createNavigationItem(destination, {
                    active: destination.id === activeId,
                    unreadManager: this.unreadManager,
                    onSelect: this.onSelect
                })
            )
        );

        return this;
    }

    setDestinations(destinations) {
        this.destinations = destinations;
        return this.update();
    }

    getElement() {
        return this.element;
    }
}
