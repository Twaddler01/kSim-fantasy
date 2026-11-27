// src/systems/ActionProgress.js
//
// Reusable timing logic for in-world actions.
// Does not depend on the UI, player, entities, or game systems.

export default class ActionProgress {
    constructor({
        type = "action",
        duration,
        canContinue = null,
        onProgress = null,
        onComplete = null,
        onInterrupt = null
    }) {
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new Error("ActionProgress requires a positive duration.");
        }

        this.type = type;
        this.duration = duration;
        this.elapsed = 0;

        this.canContinue = canContinue;
        this.onProgress = onProgress;
        this.onComplete = onComplete;
        this.onInterrupt = onInterrupt;

        this.isActive = true;
        this.isComplete = false;
        this.isInterrupted = false;
        this.interruptReason = null;
    }

    get progress() {
        return Math.min(1, this.elapsed / this.duration);
    }

    update(dt) {
        if (!this.isActive) return;

        if (this.canContinue) {
            const result = this.canContinue();

            if (result !== true) {
                this.cancel(
                    typeof result === "string" ? result : "condition-failed"
                );
                return;
            }
        }

        this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));

        this.onProgress?.(this.progress, this.elapsed);

        if (this.elapsed >= this.duration) {
            this.isActive = false;
            this.isComplete = true;

            this.onComplete?.();
        }
    }

    cancel(reason = "cancelled") {
        if (!this.isActive) return;

        this.isActive = false;
        this.isInterrupted = true;
        this.interruptReason = reason;

        this.onInterrupt?.(reason);
    }
}
