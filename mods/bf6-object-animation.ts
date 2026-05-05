import { VectorLike, EaseFunction, EaseName, eases } from "./bf6-easings";

export interface ObjectTweenProps {
    x?: number;
    y?: number;
    z?: number;
    position?: VectorLike;
    pitch?: number;
    yaw?: number;
    roll?: number;
    rotation?: VectorLike;
    enabled?: boolean;
}

export interface ObjectTweenOptions {
    duration?: number;
    ease?: EaseName | EaseFunction;
    step?: number;
}

export interface ObjectTimeline {
    to(object: mod.Object, props: ObjectTweenProps, options?: ObjectTweenOptions): ObjectTimeline;
    wait(seconds: number): ObjectTimeline;
    call(fn: () => void | Promise<void>): ObjectTimeline;
    play(): Promise<void>;
    stop(): void;
}

type ObjectVectorTween = {
    from: mod.Vector;
    to: mod.Vector;
    apply: (value: mod.Vector) => void;
};

type ObjectTimelineStep =
    | { type: "to"; object: mod.Object; props: ObjectTweenProps; options?: ObjectTweenOptions }
    | { type: "wait"; seconds: number }
    | { type: "call"; fn: () => void | Promise<void> };

const objectDefaultTweenOptions: Required<Pick<ObjectTweenOptions, "duration" | "step">> & { ease: EaseName } = {
    duration: 0.3,
    ease: "outCubic",
    step: 1 / 15,
};

function objectClamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function objectResolveEase(ease: ObjectTweenOptions["ease"]): EaseFunction {
    if (typeof ease === "function") return ease;
    return eases[ease ?? objectDefaultTweenOptions.ease];
}

function objectVectorX(value: mod.Vector): number {
    return mod.XComponentOf(value);
}

function objectVectorY(value: mod.Vector): number {
    return mod.YComponentOf(value);
}

function objectVectorZ(value: mod.Vector): number {
    return mod.ZComponentOf(value);
}

function objectToVector(value: VectorLike): mod.Vector {
    if (Array.isArray(value)) {
        return mod.CreateVector(value[0], value[1], value.length > 2 ? value[2] : 0);
    }
    return value as mod.Vector;
}

function objectLerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
}

function objectLerpVector(from: mod.Vector, to: mod.Vector, amount: number): mod.Vector {
    return mod.CreateVector(
        objectLerp(objectVectorX(from), objectVectorX(to), amount),
        objectLerp(objectVectorY(from), objectVectorY(to), amount),
        objectLerp(objectVectorZ(from), objectVectorZ(to), amount),
    );
}

function objectHasOwn<K extends keyof ObjectTweenProps>(props: ObjectTweenProps, key: K): boolean {
    return Object.prototype.hasOwnProperty.call(props, key);
}

function buildObjectPositionTarget(current: mod.Vector, props: ObjectTweenProps): mod.Vector | undefined {
    if (!objectHasOwn(props, "position") && !objectHasOwn(props, "x") && !objectHasOwn(props, "y") && !objectHasOwn(props, "z")) {
        return undefined;
    }

    const base = props.position === undefined ? current : objectToVector(props.position);
    return mod.CreateVector(
        props.x ?? objectVectorX(base),
        props.y ?? objectVectorY(base),
        props.z ?? objectVectorZ(base),
    );
}

function buildObjectRotationTarget(current: mod.Vector, props: ObjectTweenProps): mod.Vector | undefined {
    if (!objectHasOwn(props, "rotation") && !objectHasOwn(props, "pitch") && !objectHasOwn(props, "yaw") && !objectHasOwn(props, "roll")) {
        return undefined;
    }

    const base = props.rotation === undefined ? current : objectToVector(props.rotation);
    return mod.CreateVector(
        props.pitch ?? objectVectorX(base),
        props.yaw ?? objectVectorY(base),
        props.roll ?? objectVectorZ(base),
    );
}

function buildObjectTweens(object: mod.Object, props: ObjectTweenProps): ObjectVectorTween[] {
    const vectors: ObjectVectorTween[] = [];
    const currentTransform = mod.GetObjectTransform(object);
    const currentPosition = mod.GetTransformPosition(currentTransform);
    const currentRotation = mod.GetTransformRotation(currentTransform);
    let nextPosition = currentPosition;
    let nextRotation = currentRotation;

    const targetPosition = buildObjectPositionTarget(currentPosition, props);
    if (targetPosition) {
        vectors.push({
            from: currentPosition,
            to: targetPosition,
            apply: (value) => {
                nextPosition = value;
                mod.SetObjectTransform(object, mod.CreateTransform(nextPosition, nextRotation));
            },
        });
    }

    const targetRotation = buildObjectRotationTarget(currentRotation, props);
    if (targetRotation) {
        vectors.push({
            from: currentRotation,
            to: targetRotation,
            apply: (value) => {
                nextRotation = value;
                mod.SetObjectTransform(object, mod.CreateTransform(nextPosition, nextRotation));
            },
        });
    }

    return vectors;
}

function applyObjectTweens(vectors: ObjectVectorTween[], amount: number): void {
    for (const tween of vectors) {
        tween.apply(objectLerpVector(tween.from, tween.to, amount));
    }
}

async function runObjectTween(object: mod.Object, props: ObjectTweenProps, options: ObjectTweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    if (props.enabled === true) {
        mod.EnableSpatialObject(object as mod.SpatialObject, true);
    }

    const duration = options?.duration ?? objectDefaultTweenOptions.duration;
    const step = options?.step ?? objectDefaultTweenOptions.step;
    const ease = objectResolveEase(options?.ease);
    const vectors = buildObjectTweens(object, props);

    if (duration <= 0) {
        applyObjectTweens(vectors, 1);
        if (props.enabled === false) mod.EnableSpatialObject(object as mod.SpatialObject, false);
        return;
    }

    applyObjectTweens(vectors, 0);

    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        elapsed += waitSeconds;
        applyObjectTweens(vectors, ease(objectClamp01(elapsed / duration)));
    }

    if (!shouldStop()) {
        applyObjectTweens(vectors, 1);
        if (props.enabled === false) mod.EnableSpatialObject(object as mod.SpatialObject, false);
    }
}

export function objectAnimate(object: mod.Object): { to(props: ObjectTweenProps, options?: ObjectTweenOptions): Promise<void> } {
    return {
        to(props: ObjectTweenProps, options?: ObjectTweenOptions) {
            return runObjectTween(object, props, options, () => false);
        },
    };
}

export function objectTimeline(options?: ObjectTweenOptions): ObjectTimeline {
    const steps: ObjectTimelineStep[] = [];
    let stopped = false;

    const api: ObjectTimeline = {
        to(object: mod.Object, props: ObjectTweenProps, tweenOptions?: ObjectTweenOptions) {
            steps.push({ type: "to", object, props, options: { ...options, ...tweenOptions } });
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
            for (const step of steps) {
                if (stopped) return;
                if (step.type === "to") {
                    await runObjectTween(step.object, step.props, step.options, () => stopped);
                } else if (step.type === "wait") {
                    if (step.seconds > 0) await mod.Wait(step.seconds);
                } else {
                    await step.fn();
                }
            }
        },
        stop() {
            stopped = true;
        },
    };

    return api;
}
