
import { VectorLike, EaseFunction, EaseName, eases } from "./bf6-easings";

export interface TweenProps {
    x?: number;
    y?: number;
    z?: number;
    position?: VectorLike;
    width?: number;
    height?: number;
    size?: VectorLike;
    bgAlpha?: number;
    bgColor?: VectorLike;
    padding?: number;
    visible?: boolean;
    textAlpha?: number;
    textColor?: VectorLike;
    textSize?: number;
    imageAlpha?: number;
    imageColor?: VectorLike;
    buttonAlphaBase?: number;
    buttonAlphaDisabled?: number;
    buttonAlphaPressed?: number;
    buttonAlphaHover?: number;
    buttonAlphaFocused?: number;
    buttonColorBase?: VectorLike;
    buttonColorDisabled?: VectorLike;
    buttonColorPressed?: VectorLike;
    buttonColorHover?: VectorLike;
    buttonColorFocused?: VectorLike;
}

export interface TweenOptions {
    duration?: number;
    ease?: EaseName | EaseFunction;
    step?: number;
}

export interface TimelineOptions extends TweenOptions {
    loop?: boolean | number;
}

export interface UIPhysicsStepper {
    step(dt: number): void;
}

export interface UIPhysicsOptions {
    duration?: number;
    step?: number;
}

export interface UITimelineItem {
    target: mod.UIWidget;
    props: TweenProps;
}

export interface Timeline {
    to(widget: mod.UIWidget, props: TweenProps, options?: TweenOptions): Timeline;
    to(items: UITimelineItem[], options?: TweenOptions): Timeline;
    physics(world: UIPhysicsStepper, options?: UIPhysicsOptions): Timeline;
    wait(seconds: number): Timeline;
    call(fn: () => void | Promise<void>): Timeline;
    play(): Promise<void>;
    stop(): void;
}

type NumberTween = {
    from: number;
    to: number;
    apply: (value: number) => void;
};

type VectorTween = {
    from: mod.Vector;
    to: mod.Vector;
    apply: (value: mod.Vector) => void;
};

type TimelineStep =
    | { type: "to"; widget: mod.UIWidget; props: TweenProps; options?: TweenOptions }
    | { type: "toMany"; items: UITimelineItem[]; options?: TweenOptions }
    | { type: "physics"; world: UIPhysicsStepper; options?: UIPhysicsOptions }
    | { type: "wait"; seconds: number }
    | { type: "call"; fn: () => void | Promise<void> };

const defaultTweenOptions: Required<Pick<TweenOptions, "duration" | "step">> & { ease: EaseName } = {
    duration: 0.3, // 0.3 seconds
    ease: "outCubic",
    step: 1 / 15, // 15 FPS
};

function clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function resolveEase(ease: TweenOptions["ease"]): EaseFunction {
    if (typeof ease === "function") return ease;
    return eases[ease ?? defaultTweenOptions.ease];
}

function vectorX(value: mod.Vector): number {
    return mod.XComponentOf(value);
}

function vectorY(value: mod.Vector): number {
    return mod.YComponentOf(value);
}

function vectorZ(value: mod.Vector): number {
    return mod.ZComponentOf(value);
}

function toVector(value: VectorLike): mod.Vector {
    if (Array.isArray(value)) {
        return mod.CreateVector(value[0], value[1], value.length > 2 ? value[2] : 0);
    }
    return value as mod.Vector;
}

function lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
}

function lerpVector(from: mod.Vector, to: mod.Vector, amount: number): mod.Vector {
    return mod.CreateVector(
        lerp(vectorX(from), vectorX(to), amount),
        lerp(vectorY(from), vectorY(to), amount),
        lerp(vectorZ(from), vectorZ(to), amount),
    );
}

function hasOwn<K extends keyof TweenProps>(props: TweenProps, key: K): boolean {
    return Object.prototype.hasOwnProperty.call(props, key);
}

function buildPositionTarget(current: mod.Vector, props: TweenProps): mod.Vector | undefined {
    if (!hasOwn(props, "position") && !hasOwn(props, "x") && !hasOwn(props, "y") && !hasOwn(props, "z")) {
        return undefined;
    }

    const base = props.position === undefined ? current : toVector(props.position);
    return mod.CreateVector(
        props.x ?? vectorX(base),
        props.y ?? vectorY(base),
        props.z ?? vectorZ(base),
    );
}

function buildSizeTarget(current: mod.Vector, props: TweenProps): mod.Vector | undefined {
    if (!hasOwn(props, "size") && !hasOwn(props, "width") && !hasOwn(props, "height")) {
        return undefined;
    }

    const base = props.size === undefined ? current : toVector(props.size);
    return mod.CreateVector(
        props.width ?? vectorX(base),
        props.height ?? vectorY(base),
        vectorZ(base),
    );
}

function addNumberTween(tweens: NumberTween[], props: TweenProps, key: keyof TweenProps, from: () => number, apply: (value: number) => void): void {
    const target = props[key];
    if (typeof target !== "number") return;

    tweens.push({
        from: from(),
        to: target,
        apply,
    });
}

function addVectorTween(tweens: VectorTween[], props: TweenProps, key: keyof TweenProps, from: () => mod.Vector, apply: (value: mod.Vector) => void): void {
    const target = props[key];
    if (target === undefined || typeof target === "number" || typeof target === "boolean") return;

    tweens.push({
        from: from(),
        to: toVector(target),
        apply,
    });
}

function buildTweens(widget: mod.UIWidget, props: TweenProps): { numbers: NumberTween[]; vectors: VectorTween[] } {
    const numbers: NumberTween[] = [];
    const vectors: VectorTween[] = [];

    const currentPosition = mod.GetUIWidgetPosition(widget);
    const targetPosition = buildPositionTarget(currentPosition, props);
    if (targetPosition) {
        vectors.push({
            from: currentPosition,
            to: targetPosition,
            apply: (value) => mod.SetUIWidgetPosition(widget, value),
        });
    }

    const currentSize = mod.GetUIWidgetSize(widget);
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

function applyTweens(numbers: NumberTween[], vectors: VectorTween[], amount: number): void {
    for (const tween of numbers) {
        tween.apply(lerp(tween.from, tween.to, amount));
    }
    for (const tween of vectors) {
        tween.apply(lerpVector(tween.from, tween.to, amount));
    }
}

async function runTween(widget: mod.UIWidget, props: TweenProps, options: TweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    if (props.visible === true) {
        mod.SetUIWidgetVisible(widget, true);
    }

    const duration = options?.duration ?? defaultTweenOptions.duration;
    const step = options?.step ?? defaultTweenOptions.step;
    const ease = resolveEase(options?.ease);
    const { numbers, vectors } = buildTweens(widget, props);

    if (duration <= 0) {
        applyTweens(numbers, vectors, 1);
        if (props.visible === false) mod.SetUIWidgetVisible(widget, false);
        return;
    }

    applyTweens(numbers, vectors, 0);

    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
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

async function runManyTweens(items: UITimelineItem[], options: TweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    for (const item of items) {
        if (item.props.visible === true) mod.SetUIWidgetVisible(item.target, true);
    }

    const duration = options?.duration ?? defaultTweenOptions.duration;
    const step = options?.step ?? defaultTweenOptions.step;
    const ease = resolveEase(options?.ease);
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

    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        elapsed += waitSeconds;
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

async function runUIPhysics(world: UIPhysicsStepper, options: UIPhysicsOptions | undefined, shouldStop: () => boolean): Promise<void> {
    const step = options?.step ?? defaultTweenOptions.step;
    const duration = options?.duration ?? step;

    if (duration <= 0 || step <= 0) return;

    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        world.step(waitSeconds);
        elapsed += waitSeconds;
    }
}

export function uiAnimate(widget: mod.UIWidget): { to(props: TweenProps, options?: TweenOptions): Promise<void> } {
    return {
        to(props: TweenProps, options?: TweenOptions) {
            return runTween(widget, props, options, () => false);
        },
    };
}

export function uiTimeline(options?: TimelineOptions): Timeline {
    const steps: TimelineStep[] = [];
    let stopped = false;
    const loopCount = typeof options?.loop === "number" ? Math.max(0, Math.floor(options.loop)) : options?.loop === true ? Infinity : 1;

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
