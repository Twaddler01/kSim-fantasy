// src/ui/components/TooltipManager.js

export default class TooltipManager {
    constructor() {
        this.element = this.createElement();
        this.activeTarget = null;
        this.isPinned = false;
        this.hideTimer = null;

        this.hoverEnabled = window.matchMedia(
            "(hover: hover) and (pointer: fine)"
        ).matches;

        document.body.appendChild(this.element);

        this.handleOutsidePointerDown =
            this.handleOutsidePointerDown.bind(this);

        this.handleKeyDown = this.handleKeyDown.bind(this);

        document.addEventListener("pointerdown", this.handleOutsidePointerDown);

        document.addEventListener("keydown", this.handleKeyDown);

        this.element.addEventListener("pointerenter", () => {
            this.clearHideTimer();
        });
        
        this.element.addEventListener("pointerleave", () => {
            if (!this.isPinned) {
                this.scheduleHide();
            }
        });
    }

    createElement() {
        const element = document.createElement("div");

        element.className = "game-tooltip";
        element.hidden = true;
        element.setAttribute("role", "tooltip");

        return element;
    }

    show({ target, content, pinned = false }) {
        if (!target || !content) return;

        this.clearHideTimer();

        this.activeTarget = target;
        this.isPinned = pinned;

        this.element.replaceChildren();

        if (content instanceof Node) {
            this.element.appendChild(content);
        } else {
            this.element.textContent = String(content);
        }

        this.element.hidden = false;
        this.element.classList.add("is-visible");

        this.position();
    }

    hide() {
        this.clearHideTimer();

        this.activeTarget = null;
        this.isPinned = false;

        this.element.classList.remove("is-visible");
        this.element.hidden = true;
        this.element.replaceChildren();
    }

    position() {
        if (!this.activeTarget || this.element.hidden) return;

        const targetRect = this.activeTarget.getBoundingClientRect();

        const tooltipRect = this.element.getBoundingClientRect();

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const margin = 12;
        const gap = 10;

        // Horizontal position: center on target when possible.
        let left =
            targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;

        left = Math.max(
            margin,
            Math.min(left, viewportWidth - tooltipRect.width - margin)
        );

        // Vertical position: prefer above, otherwise below.
        const spaceAbove = targetRect.top - margin;
        const spaceBelow = viewportHeight - targetRect.bottom - margin;

        let top;

        if (
            tooltipRect.height + gap <= spaceAbove ||
            spaceAbove >= spaceBelow
        ) {
            top = targetRect.top - tooltipRect.height - gap;
        } else {
            top = targetRect.bottom + gap;
        }

        // Keep the tooltip inside the viewport.
        top = Math.max(
            margin,
            Math.min(top, viewportHeight - tooltipRect.height - margin)
        );

        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
    }

    bind(target, contentFactory) {
        if (!target || typeof contentFactory !== "function") return;

        if (this.hoverEnabled) {
            target.addEventListener("pointerenter", () => {
                if (this.isPinned) return;

                this.show({
                    target,
                    content: contentFactory(),
                    pinned: false
                });
            });

            target.addEventListener("pointerleave", () => {
                if (this.isPinned) return;

                this.scheduleHide();
            });
        }

        target.addEventListener("click", event => {
            event.stopPropagation();

            if (this.activeTarget === target && this.isPinned) {
                this.hide();
                return;
            }

            this.show({
                target,
                content: contentFactory(),
                pinned: true
            });
        });
    }

    scheduleHide() {
        this.clearHideTimer();

        this.hideTimer = setTimeout(() => {
            if (!this.isPinned) {
                this.hide();
            }
        }, 150);
    }

    clearHideTimer() {
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }

    handleOutsidePointerDown(event) {
        if (this.element.hidden) return;

        if (
            this.element.contains(event.target) ||
            this.activeTarget?.contains(event.target)
        ) {
            return;
        }

        this.hide();
    }

    handleKeyDown(event) {
        if (event.key === "Escape") {
            this.hide();
        }
    }

    destroy() {
        this.hide();

        document.removeEventListener(
            "pointerdown",
            this.handleOutsidePointerDown
        );

        document.removeEventListener("keydown", this.handleKeyDown);

        this.element.remove();
    }
}
