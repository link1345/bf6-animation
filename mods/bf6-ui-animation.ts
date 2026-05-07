
import { VectorLike, EaseFunction, EaseName, eases } from "./bf6-easings";

// Properties that can be animated on a UIWidget.
export interface TweenProps {
    // Changes only the X coordinate.
    x?: number;
    // Changes only the Y coordinate.
    y?: number;
    // Changes only the Z coordinate.
    z?: number;
    // Changes the full position vector.
    position?: VectorLike;
    // Changes only the width.
    width?: number;
    // Changes only the height.
    height?: number;
    // Changes the full size vector.
    size?: VectorLike;
    // Changes the background alpha.
    bgAlpha?: number;
    // Changes the background color.
    bgColor?: VectorLike;
    // Changes the UIWidget padding.
    padding?: number;
    // Toggles visibility.
    visible?: boolean;
    // Changes the text alpha.
    textAlpha?: number;
    // Changes the text color.
    textColor?: VectorLike;
    // Changes the text size.
    textSize?: number;
    // Changes the image alpha.
    imageAlpha?: number;
    // Changes the image color.
    imageColor?: VectorLike;
    // Changes the button base-state alpha.
    buttonAlphaBase?: number;
    // Changes the button disabled-state alpha.
    buttonAlphaDisabled?: number;
    // Changes the button pressed-state alpha.
    buttonAlphaPressed?: number;
    // Changes the button hover-state alpha.
    buttonAlphaHover?: number;
    // Changes the button focused-state alpha.
    buttonAlphaFocused?: number;
    // Changes the button base-state color.
    buttonColorBase?: VectorLike;
    // Changes the button disabled-state color.
    buttonColorDisabled?: VectorLike;
    // Changes the button pressed-state color.
    buttonColorPressed?: VectorLike;
    // Changes the button hover-state color.
    buttonColorHover?: VectorLike;
    // Changes the button focused-state color.
    buttonColorFocused?: VectorLike;
}

// Settings for duration, easing, and update interval of one tween.
export interface TweenOptions {
    // Duration of the animation in seconds.
    duration?: number;
    // Easing name or a custom easing function.
    ease?: EaseName | EaseFunction;
    // Interval in seconds between value updates.
    step?: number;
}

// Common tween settings and loop settings for a timeline.
export interface TimelineOptions extends TweenOptions {
    // true loops forever; a number plays that many times.
    loop?: boolean | number;
}

// Common interface for advancing physics inside a UI timeline.
export interface UIPhysicsStepper {
    // Advances the physics state by dt seconds.
    step(dt: number): void;
}

// Duration and update interval for physics inside a UI timeline.
export interface UIPhysicsOptions {
    // Duration in seconds for running physics.
    duration?: number;
    // Physics step interval in seconds.
    step?: number;
}

// Target and properties used when tweening multiple widgets together.
export interface UITimelineItem {
    // UIWidget targeted by the animation.
    target: mod.UIWidget;
    // Tween properties applied to the target.
    props: TweenProps;
}

// API for queueing and playing UI animation steps in order.
export interface Timeline {
    to(widget: mod.UIWidget, props: TweenProps, options?: TweenOptions): Timeline;
    to(items: UITimelineItem[], options?: TweenOptions): Timeline;
    physics(world: UIPhysicsStepper, options?: UIPhysicsOptions): Timeline;
    wait(seconds: number): Timeline;
    call(fn: () => void | Promise<void>): Timeline;
    play(): Promise<void>;
    stop(): void;
}

// Start value, end value, and apply callback for one numeric property.
type NumberTween = {
    // Numeric value at the start of interpolation.
    from: number;
    // Numeric value at the end of interpolation.
    to: number;
    // Applies the interpolated value to the actual widget.
    apply: (value: number) => void;
};

// Start vector, end vector, and apply callback for one vector property.
type VectorTween = {
    // Vector at the start of interpolation.
    from: mod.Vector;
    // Vector at the end of interpolation.
    to: mod.Vector;
    // Applies the interpolated vector to the actual widget.
    apply: (value: mod.Vector) => void;
};

// Internal type for one queued timeline step.
type TimelineStep =
    | { type: "to"; widget: mod.UIWidget; props: TweenProps; options?: TweenOptions }
    | { type: "toMany"; items: UITimelineItem[]; options?: TweenOptions }
    | { type: "physics"; world: UIPhysicsStepper; options?: UIPhysicsOptions }
    | { type: "wait"; seconds: number }
    | { type: "call"; fn: () => void | Promise<void> };

// Default values used when TweenOptions are omitted.
const defaultTweenOptions: Required<Pick<TweenOptions, "duration" | "step">> & { ease: EaseName } = {
    duration: 0.3, // 0.3 seconds
    ease: "outCubic",
    step: 1 / 15, // 15 FPS
};

// Clamps a progress value to the 0..1 range.
function clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

// Resolves an easing name or function to the function that will be called.
function resolveEase(ease: TweenOptions["ease"]): EaseFunction {
    if (typeof ease === "function") return ease;
    return eases[ease ?? defaultTweenOptions.ease];
}

// Returns the X component of a mod.Vector.
function vectorX(value: mod.Vector): number {
    return mod.XComponentOf(value);
}

// Returns the Y component of a mod.Vector.
function vectorY(value: mod.Vector): number {
    return mod.YComponentOf(value);
}

// Returns the Z component of a mod.Vector.
function vectorZ(value: mod.Vector): number {
    return mod.ZComponentOf(value);
}

// Normalizes an array or mod.Vector input into mod.Vector.
function toVector(value: VectorLike): mod.Vector {
    if (Array.isArray(value)) {
        return mod.CreateVector(value[0], value[1], value.length > 2 ? value[2] : 0);
    }
    return value as mod.Vector;
}

// Linearly interpolates two numbers by amount.
function lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
}

// Linearly interpolates two vectors by amount.
function lerpVector(from: mod.Vector, to: mod.Vector, amount: number): mod.Vector {
    return mod.CreateVector(
        lerp(vectorX(from), vectorX(to), amount),
        lerp(vectorY(from), vectorY(to), amount),
        lerp(vectorZ(from), vectorZ(to), amount),
    );
}

// Checks whether props explicitly owns the given key.
function hasOwn<K extends keyof TweenProps>(props: TweenProps, key: K): boolean {
    return Object.prototype.hasOwnProperty.call(props, key);
}

// Builds the final position vector from position or x/y/z fields.
function buildPositionTarget(current: mod.Vector, props: TweenProps): mod.Vector | undefined {
    if (!hasOwn(props, "position") && !hasOwn(props, "x") && !hasOwn(props, "y") && !hasOwn(props, "z")) {
        return undefined;
    }

    // Uses the current value as a base when position is omitted, allowing x/y/z-only updates.
    const base = props.position === undefined ? current : toVector(props.position);
    return mod.CreateVector(
        props.x ?? vectorX(base),
        props.y ?? vectorY(base),
        props.z ?? vectorZ(base),
    );
}

// Builds the final size vector from size or width/height fields.
function buildSizeTarget(current: mod.Vector, props: TweenProps): mod.Vector | undefined {
    if (!hasOwn(props, "size") && !hasOwn(props, "width") && !hasOwn(props, "height")) {
        return undefined;
    }

    // Uses the current value as a base when size is omitted, allowing width/height-only updates.
    const base = props.size === undefined ? current : toVector(props.size);
    return mod.CreateVector(
        props.width ?? vectorX(base),
        props.height ?? vectorY(base),
        vectorZ(base),
    );
}

// Adds a numeric property to the tween list when it is specified.
function addNumberTween(tweens: NumberTween[], props: TweenProps, key: keyof TweenProps, from: () => number, apply: (value: number) => void): void {
    // Target value from props; non-numeric values do not create a tween.
    const target = props[key];
    if (typeof target !== "number") return;

    tweens.push({
        from: from(),
        to: target,
        apply,
    });
}

// Adds a vector property to the tween list when it is specified.
function addVectorTween(tweens: VectorTween[], props: TweenProps, key: keyof TweenProps, from: () => mod.Vector, apply: (value: mod.Vector) => void): void {
    // Target value from props; numbers and booleans are not treated as vectors.
    const target = props[key];
    if (target === undefined || typeof target === "number" || typeof target === "boolean") return;

    tweens.push({
        from: from(),
        to: toVector(target),
        apply,
    });
}

// Converts TweenProps into numeric and vector tweens with current values.
function buildTweens(widget: mod.UIWidget, props: TweenProps): { numbers: NumberTween[]; vectors: VectorTween[] } {
    // List of numeric property tweens.
    const numbers: NumberTween[] = [];
    // List of vector property tweens.
    const vectors: VectorTween[] = [];

    // Current widget position.
    const currentPosition = mod.GetUIWidgetPosition(widget);
    // Target position built from props.
    const targetPosition = buildPositionTarget(currentPosition, props);
    if (targetPosition) {
        vectors.push({
            from: currentPosition,
            to: targetPosition,
            apply: (value) => mod.SetUIWidgetPosition(widget, value),
        });
    }

    // Current widget size.
    const currentSize = mod.GetUIWidgetSize(widget);
    // Target size built from props.
    const targetSize = buildSizeTarget(currentSize, props);
    if (targetSize) {
        vectors.push({
            from: currentSize,
            to: targetSize,
            apply: (value) => mod.SetUIWidgetSize(widget, value),
        });
    }

    addNumberTween(numbers, props, "bgAlpha", () => mod.GetUIWidgetBgAlpha(widget), (value) => mod.SetUIWidgetBgAlpha(widget, value));
    addVectorTween(vectors, props, "bgColor", () => mod.GetUIWidgetBgColor(widget), (value) => mod.SetUIWidgetBgColor(widget, value));
    addNumberTween(numbers, props, "padding", () => mod.GetUIWidgetPadding(widget), (value) => mod.SetUIWidgetPadding(widget, value));
    addNumberTween(numbers, props, "textAlpha", () => mod.GetUITextAlpha(widget), (value) => mod.SetUITextAlpha(widget, value));
    addVectorTween(vectors, props, "textColor", () => mod.GetUITextColor(widget), (value) => mod.SetUITextColor(widget, value));
    addNumberTween(numbers, props, "textSize", () => mod.GetUITextSize(widget), (value) => mod.SetUITextSize(widget, value));
    addNumberTween(numbers, props, "imageAlpha", () => mod.GetUIImageAlpha(widget), (value) => mod.SetUIImageAlpha(widget, value));
    addVectorTween(vectors, props, "imageColor", () => mod.GetUIImageColor(widget), (value) => mod.SetUIImageColor(widget, value));
    addNumberTween(numbers, props, "buttonAlphaBase", () => mod.GetUIButtonAlphaBase(widget), (value) => mod.SetUIButtonAlphaBase(widget, value));
    addNumberTween(numbers, props, "buttonAlphaDisabled", () => mod.GetUIButtonAlphaDisabled(widget), (value) => mod.SetUIButtonAlphaDisabled(widget, value));
    addNumberTween(numbers, props, "buttonAlphaPressed", () => mod.GetUIButtonAlphaPressed(widget), (value) => mod.SetUIButtonAlphaPressed(widget, value));
    addNumberTween(numbers, props, "buttonAlphaHover", () => mod.GetUIButtonAlphaHover(widget), (value) => mod.SetUIButtonAlphaHover(widget, value));
    addNumberTween(numbers, props, "buttonAlphaFocused", () => mod.GetUIButtonAlphaFocused(widget), (value) => mod.SetUIButtonAlphaFocused(widget, value));
    addVectorTween(vectors, props, "buttonColorBase", () => mod.GetUIButtonColorBase(widget), (value) => mod.SetUIButtonColorBase(widget, value));
    addVectorTween(vectors, props, "buttonColorDisabled", () => mod.GetUIButtonColorDisabled(widget), (value) => mod.SetUIButtonColorDisabled(widget, value));
    addVectorTween(vectors, props, "buttonColorPressed", () => mod.GetUIButtonColorPressed(widget), (value) => mod.SetUIButtonColorPressed(widget, value));
    addVectorTween(vectors, props, "buttonColorHover", () => mod.GetUIButtonColorHover(widget), (value) => mod.SetUIButtonColorHover(widget, value));
    addVectorTween(vectors, props, "buttonColorFocused", () => mod.GetUIButtonColorFocused(widget), (value) => mod.SetUIButtonColorFocused(widget, value));

    return { numbers, vectors };
}

// Applies progress amount to the prepared tweens.
function applyTweens(numbers: NumberTween[], vectors: VectorTween[], amount: number): void {
    for (const tween of numbers) {
        tween.apply(lerp(tween.from, tween.to, amount));
    }
    for (const tween of vectors) {
        tween.apply(lerpVector(tween.from, tween.to, amount));
    }
}

// Runs a tween for one UIWidget.
async function runTween(widget: mod.UIWidget, props: TweenProps, options: TweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    if (props.visible === true) {
        mod.SetUIWidgetVisible(widget, true);
    }

    // Playback duration in seconds.
    const duration = options?.duration ?? defaultTweenOptions.duration;
    // Time interval between value updates.
    const step = options?.step ?? defaultTweenOptions.step;
    // Easing function applied to progress.
    const ease = resolveEase(options?.ease);
    // Prepared tween list built from props.
    const { numbers, vectors } = buildTweens(widget, props);

    if (duration <= 0) {
        applyTweens(numbers, vectors, 1);
        if (props.visible === false) mod.SetUIWidgetVisible(widget, false);
        return;
    }

    applyTweens(numbers, vectors, 0);

    // Elapsed playback time in seconds.
    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
        // Wait time for this tick, capped by remaining duration.
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        elapsed += waitSeconds;
        applyTweens(numbers, vectors, ease(clamp01(elapsed / duration)));
    }

    if (!shouldStop()) {
        applyTweens(numbers, vectors, 1);
        if (props.visible === false) mod.SetUIWidgetVisible(widget, false);
    }
}

// Runs tweens for multiple UIWidgets on the same timeline.
async function runManyTweens(items: UITimelineItem[], options: TweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    for (const item of items) {
        if (item.props.visible === true) mod.SetUIWidgetVisible(item.target, true);
    }

    // Playback duration in seconds.
    const duration = options?.duration ?? defaultTweenOptions.duration;
    // Time interval between value updates.
    const step = options?.step ?? defaultTweenOptions.step;
    // Easing function applied to progress.
    const ease = resolveEase(options?.ease);
    // Per-widget prepared tween data built from current values.
    const built = items.map((item) => ({ item, tweens: buildTweens(item.target, item.props) }));

    if (duration <= 0) {
        for (const entry of built) {
            applyTweens(entry.tweens.numbers, entry.tweens.vectors, 1);
            if (entry.item.props.visible === false) mod.SetUIWidgetVisible(entry.item.target, false);
        }
        return;
    }

    for (const entry of built) {
        applyTweens(entry.tweens.numbers, entry.tweens.vectors, 0);
    }

    // Elapsed playback time in seconds.
    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
        // Wait time for this tick, capped by remaining duration.
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        elapsed += waitSeconds;
        // Eased progress shared by every target.
        const amount = ease(clamp01(elapsed / duration));
        for (const entry of built) {
            applyTweens(entry.tweens.numbers, entry.tweens.vectors, amount);
        }
    }

    if (!shouldStop()) {
        for (const entry of built) {
            applyTweens(entry.tweens.numbers, entry.tweens.vectors, 1);
            if (entry.item.props.visible === false) mod.SetUIWidgetVisible(entry.item.target, false);
        }
    }
}

// Advances a physics stepper for a fixed duration on the timeline.
async function runUIPhysics(world: UIPhysicsStepper, options: UIPhysicsOptions | undefined, shouldStop: () => boolean): Promise<void> {
    // Physics update step size.
    const step = options?.step ?? defaultTweenOptions.step;
    // Duration in seconds for running physics.
    const duration = options?.duration ?? step;

    if (duration <= 0 || step <= 0) return;

    // Elapsed physics time in seconds.
    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
        // Wait time for this tick, capped by remaining duration.
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        world.step(waitSeconds);
        elapsed += waitSeconds;
    }
}

// Returns a small helper API for tweening a single widget.
export function uiAnimate(widget: mod.UIWidget): { to(props: TweenProps, options?: TweenOptions): Promise<void> } {
    return {
        to(props: TweenProps, options?: TweenOptions) {
            return runTween(widget, props, options, () => false);
        },
    };
}

// Creates a timeline that queues and plays UI animation steps in order.
export function uiTimeline(options?: TimelineOptions): Timeline {
    // Steps processed in order during playback.
    const steps: TimelineStep[] = [];
    // Tracks whether stop() has been called.
    let stopped = false;
    // Playback count derived from the loop option.
    const loopCount = typeof options?.loop === "number" ? Math.max(0, Math.floor(options.loop)) : options?.loop === true ? Infinity : 1;

    // Timeline control object returned to callers.
    const api: Timeline = {
        to(target: mod.UIWidget | UITimelineItem[], propsOrOptions?: TweenProps | TweenOptions, tweenOptions?: TweenOptions) {
            if (Array.isArray(target)) {
                steps.push({ type: "toMany", items: target, options: { ...options, ...(propsOrOptions as TweenOptions | undefined) } });
            } else {
                steps.push({ type: "to", widget: target, props: propsOrOptions as TweenProps, options: { ...options, ...tweenOptions } });
            }
            return api;
        },
        physics(world: UIPhysicsStepper, physicsOptions?: UIPhysicsOptions) {
            steps.push({ type: "physics", world, options: physicsOptions });
            return api;
        },
        wait(seconds: number) {
            steps.push({ type: "wait", seconds });
            return api;
        },
        call(fn: () => void | Promise<void>) {
            steps.push({ type: "call", fn });
            return api;
        },
        async play() {
            stopped = false;
            if (steps.length === 0 || loopCount <= 0) return;

            // Number of completed timeline playthroughs.
            let played = 0;
            while (!stopped && played < loopCount) {
                for (const step of steps) {
                    if (stopped) return;
                    if (step.type === "to") {
                        await runTween(step.widget, step.props, step.options, () => stopped);
                    } else if (step.type === "toMany") {
                        await runManyTweens(step.items, step.options, () => stopped);
                    } else if (step.type === "physics") {
                        await runUIPhysics(step.world, step.options, () => stopped);
                    } else if (step.type === "wait") {
                        if (step.seconds > 0) await mod.Wait(step.seconds);
                    } else {
                        await step.fn();
                    }
                }
                played += 1;
            }
        },
        stop() {
            stopped = true;
        },
    };

    return api;
}
