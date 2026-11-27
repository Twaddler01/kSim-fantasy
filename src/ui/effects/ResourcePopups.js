import { el } from "../components/Element.js";
import { ItemIcon } from "../components/ItemIcon.js";
import { getItemDefinition } from "../../data/items.js";

const DEFAULT_DURATION_MS = 2200; // was effectively ~1000ms

export default class ResourcePopups {
    constructor({
        formatNumber,
        maxVisible = 5,
        durationMs = DEFAULT_DURATION_MS
    } = {}) {
        this.formatNumber = formatNumber ?? (value => String(value));
        this.maxVisible = maxVisible;
        this.durationMs = durationMs;
        this.active = [];
    }

    show(gains, anchor = null) {
        if (!Array.isArray(gains) || !gains.length) return;

        const point = this.resolveAnchor(anchor);

        for (const [index, rawGain] of gains.entries()) {
            if (!rawGain || !rawGain.amount) continue;

            const gain = this.resolveGain(rawGain);

            while (this.active.length >= this.maxVisible) {
                this.remove(this.active[0]);
            }

            const stackOffset = this.active.length * 24;

            const horizontalSpacing = 70;
            const horizontalOffset =
                (index - (gains.length - 1) / 2) * horizontalSpacing;

            // Tone determines color. Explicit `tone` wins; otherwise the
            // sign of the amount decides gain (green) vs. loss (red).
            const tone = gain.tone ?? (gain.amount < 0 ? "loss" : "gain");

            const classes = ["resource-float", `resource-${tone}`];
            if (gain.critical) classes.push("resource-float-critical");

            const children = [
                el("span", {
                    className: "resource-float-amount",
                    text: `${gain.amount < 0 ? "−" : "+"}${this.formatNumber(
                        Math.abs(gain.amount)
                    )}`
                }),
                this.createIcon(gain)
            ];

            if (gain.name) {
                children.push(
                    el("span", {
                        className: "resource-float-name",
                        text: gain.name
                    })
                );
            }

            const popup = el(
                "div",
                {
                    className: classes.join(" "),
                    style: {
                        left: `${point.x + horizontalOffset}px`,
                        top: `${point.y - stackOffset}px`,
                        "--resource-float-duration": `${this.durationMs}ms`
                    },
                    "aria-hidden": "true"
                },
                children
            );

            const entry = { element: popup, timer: null };
            this.active.push(entry);
            document.body.append(popup);

            popup.addEventListener("animationend", () => this.remove(entry), {
                once: true
            });

            entry.timer = setTimeout(
                () => this.remove(entry),
                this.durationMs + 250
            );
        }
    }

    resolveAnchor(anchor) {
        if (!anchor) {
            return {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2
            };
        }

        if (typeof anchor.getBoundingClientRect === "function") {
            const rect = anchor.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }

        if (
            typeof anchor.clientX === "number" &&
            typeof anchor.clientY === "number"
        ) {
            return { x: anchor.clientX, y: anchor.clientY };
        }

        if (typeof anchor.x === "number" && typeof anchor.y === "number") {
            return { x: anchor.x, y: anchor.y };
        }

        return {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
        };
    }

    resolveGain(gain) {
        if (gain.name !== undefined) return gain;
        if (!gain.itemId) return gain;

        try {
            const item = getItemDefinition(gain.itemId);
            if (!item?.name) return gain;
            return { ...gain, name: item.name };
        } catch {
            return gain;
        }
    }

    // --------------------------------------------------
    // Icon resolution
    // --------------------------------------------------
    // Priority:
    //   1. materialId → MaterialIcon (SVG, has built-in fallback)
    //   2. itemId      → item's own ItemIcon (SVG if available, else item.icon)
    //   3. rawIcon     → text/emoji fallback for gains without an item
    //   4. "?"         → ItemIcon's last-resort fallback
    //
    // This means passing BOTH itemId/materialId *and* rawIcon prefers the
    // SVG and only falls back to the emoji when no SVG-path item exists.
    createIcon(gain) {
        const iconSource = this.resolveIconSource(gain);

        if (iconSource) {
            return ItemIcon(iconSource, {
                size: 20,
                className: "resource-float-icon",
                materialId: gain.materialId
            });
        }

        if (gain.rawIcon) {
            return el("span", {
                className: "resource-float-icon resource-float-emoji",
                text: gain.rawIcon
            });
        }

        return ItemIcon(null, {
            size: 20,
            className: "resource-float-icon"
        });
    }

    resolveIconSource(gain) {
        if (gain.materialId) {
            // Hand a minimal item shape to ItemIcon so it takes the
            // MaterialIcon path. Name only used for aria if ever needed.
            return { materialId: gain.materialId, name: gain.name };
        }

        if (gain.itemId) {
            try {
                return getItemDefinition(gain.itemId) ?? null;
            } catch {
                return null;
            }
        }

        return null;
    }

    remove(entry) {
        if (!entry) return;

        entry.element.remove();

        if (entry.timer !== null) {
            clearTimeout(entry.timer);
            entry.timer = null;
        }

        const index = this.active.indexOf(entry);
        if (index !== -1) {
            this.active.splice(index, 1);
        }
    }

    destroy() {
        for (const entry of [...this.active]) {
            this.remove(entry);
        }
    }
}
