// src/ui/world/WorldCamera.js
//
// Owns the in-world camera position, viewport, and world boundaries.
// Does not know about rendering, entities, or DOM elements.

export default class WorldCamera {
    constructor(world) {
        this.world = {
            width: world.width,
            height: world.height
        };

        this.x = 0;
        this.y = 0;

        this.width = 0;
        this.height = 0;
    }

    resize(width, height, target) {
        const hadViewport = this.width > 0 && this.height > 0;

        // Preserve the previous viewport center when resizing.
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        this.width = width;
        this.height = height;

        if (hadViewport) {
            this.setPosition(centerX - width / 2, centerY - height / 2);
        } else if (target) {
            this.centerOn(target.x, target.y);
        }
    }

    centerOn(x, y) {
        this.setPosition(x - this.width / 2, y - this.height / 2);
    }

    // dx/dy represent the direction the user's finger moved.
    panFrom(startX, startY, dx, dy) {
        this.setPosition(startX - dx, startY - dy);
    }

    setPosition(x, y) {
        this.x = this.clampX(x);
        this.y = this.clampY(y);
    }

    clampX(x) {
        return Math.max(0, Math.min(x, this.world.width - this.width));
    }

    clampY(y) {
        return Math.max(0, Math.min(y, this.world.height - this.height));
    }

    clampWorldX(x) {
        return Math.max(0, Math.min(x, this.world.width));
    }

    clampWorldY(y) {
        return Math.max(0, Math.min(y, this.world.height));
    }
}
