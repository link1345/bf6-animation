import { VectorLike, EaseFunction, EaseName, eases } from "./bf6-easings";

export type RuntimeObjectPrefab = Parameters<typeof mod.SpawnObject>[0];

type RuntimeObjectQuaternion = [number, number, number, number];

export interface RuntimeObjectTweenProps {
    moveBy?: VectorLike;
    qRotateBy?: {
        axis: VectorLike;
        angle: number;
        rotCenter?: VectorLike;
    };
}

export interface RuntimeObjectTimelineItem {
    target: RuntimeObject;
    props: RuntimeObjectTweenProps;
}

export class RuntimeObject {
    readonly object: mod.Object | undefined;
    readonly id: number | undefined;
    readonly prefabEnum: RuntimeObjectPrefab | undefined;
    readonly offset: mod.Vector;

    private runtimeObjectPos: mod.Vector;
    private runtimeObjectRotState: RuntimeObjectQuaternion;
    private runtimeObjectDeltaPos: mod.Vector = mod.CreateVector(0, 0, 0);
    private runtimeObjectDeltaRot: RuntimeObjectQuaternion = [1, 0, 0, 0];
    private runtimeObjectIsTransform = false;
    private runtimeObjectEffPos: mod.Vector;
    private runtimeObjectEffRotState: RuntimeObjectQuaternion;
    private runtimeObjectParent: RuntimeObject | undefined;
    private runtimeObjectChildren = new Set<RuntimeObject>();

    get worldPos(): mod.Vector {
        return this.runtimeObjectPos;
    }

    get localPos(): mod.Vector {
        if (!this.runtimeObjectParent) return this.runtimeObjectPos;
        return this.runtimeObjectParent.WorldToLocalVector(mod.Subtract(this.runtimeObjectPos, this.runtimeObjectParent.runtimeObjectPos));
    }

    get effWorldPos(): mod.Vector {
        return this.runtimeObjectEffPos;
    }

    get effLocalPos(): mod.Vector {
        if (!this.runtimeObjectParent) return this.runtimeObjectEffPos;
        return this.runtimeObjectParent.EffWorldToLocalVector(mod.Subtract(this.runtimeObjectEffPos, this.runtimeObjectParent.runtimeObjectEffPos));
    }

    get parent(): RuntimeObject | undefined {
        return this.runtimeObjectParent;
    }

    get children(): Set<RuntimeObject> {
        return new Set(this.runtimeObjectChildren);
    }

    constructor(prefabEnum: RuntimeObjectPrefab | undefined, pos: VectorLike, offset: VectorLike, axis: VectorLike, angle: number, scale: VectorLike = [1, 1, 1]) {
        this.prefabEnum = prefabEnum;
        this.runtimeObjectPos = runtimeObjectToVector(pos);
        this.offset = runtimeObjectToVector(offset);
        this.runtimeObjectRotState = RuntimeObject.runtimeObjectMakeRotQ(runtimeObjectToVector(axis), angle);
        this.runtimeObjectEffPos = this.runtimeObjectPos;
        this.runtimeObjectEffRotState = [...this.runtimeObjectRotState];

        if (prefabEnum !== undefined) {
            this.object = mod.SpawnObject(
                prefabEnum,
                mod.Add(this.runtimeObjectPos, RuntimeObject.runtimeObjectQRotateVector(this.offset, this.runtimeObjectRotState)),
                RuntimeObject.runtimeObjectQToEuler(this.runtimeObjectRotState),
                runtimeObjectToVector(scale),
            ) as mod.Object;
            this.id = this.object === undefined ? undefined : mod.GetObjId(this.object);
        } else {
            this.object = undefined;
            this.id = undefined;
        }
    }

    Move(dpos: VectorLike): void {
        let moveDelta = runtimeObjectToVector(dpos);
        if (this.runtimeObjectParent) moveDelta = this.runtimeObjectParent.EffLocalToWorldVector(moveDelta);

        this.runtimeObjectDeltaPos = mod.Add(this.runtimeObjectDeltaPos, moveDelta);
        this.runtimeObjectUpdateEff();
        this.runtimeObjectIsTransform = true;

        const childDelta = this.EffWorldToLocalVector(moveDelta);
        for (const child of this.runtimeObjectChildren) {
            child.Move(childDelta);
        }
    }

    QRotation(axis: VectorLike, angle: number, rotCenter?: VectorLike): void {
        let rotationAxis = runtimeObjectToVector(axis);
        if (this.runtimeObjectParent) rotationAxis = this.runtimeObjectParent.EffLocalToWorldVector(rotationAxis);

        const deltaRot = RuntimeObject.runtimeObjectMakeRotQ(rotationAxis, angle);
        this.runtimeObjectDeltaRot = RuntimeObject.runtimeObjectQProduct(deltaRot, this.runtimeObjectDeltaRot);

        const center = rotCenter === undefined ? this.runtimeObjectEffPos : runtimeObjectToVector(rotCenter);
        const distanceCenter = mod.Subtract(this.runtimeObjectEffPos, center);
        const deltaPos = mod.Subtract(RuntimeObject.runtimeObjectQRotateVector(distanceCenter, deltaRot), distanceCenter);
        this.runtimeObjectDeltaPos = mod.Add(this.runtimeObjectDeltaPos, deltaPos);
        this.runtimeObjectUpdateEff();
        this.runtimeObjectIsTransform = true;

        const childAxis = this.EffWorldToLocalVector(rotationAxis);
        for (const child of this.runtimeObjectChildren) {
            child.QRotation(childAxis, angle, center);
        }
    }

    ApplyTransform(): void {
        if (this.runtimeObjectIsTransform) {
            const centerPos = mod.Add(this.runtimeObjectPos, this.runtimeObjectDeltaPos);
            const finalRot = RuntimeObject.runtimeObjectQProduct(this.runtimeObjectDeltaRot, this.runtimeObjectRotState);

            if (this.object) {
                const rotatedOffset = RuntimeObject.runtimeObjectQRotateVector(this.offset, finalRot);
                mod.SetObjectTransform(this.object, mod.CreateTransform(mod.Add(centerPos, rotatedOffset), RuntimeObject.runtimeObjectQToEuler(finalRot)));
            }

            this.runtimeObjectPos = centerPos;
            this.runtimeObjectRotState = finalRot;
            this.runtimeObjectDeltaPos = mod.CreateVector(0, 0, 0);
            this.runtimeObjectDeltaRot = [1, 0, 0, 0];
            this.runtimeObjectUpdateEff();
            this.runtimeObjectIsTransform = false;
        }

        for (const child of this.runtimeObjectChildren) {
            child.ApplyTransform();
        }
    }

    NewChild(prefabEnum: RuntimeObjectPrefab | undefined, pos: VectorLike, offset: VectorLike, axis: VectorLike, angle: number, scale: VectorLike = [1, 1, 1]): RuntimeObject {
        const child = new RuntimeObject(
            prefabEnum,
            mod.Add(this.runtimeObjectEffPos, this.EffLocalToWorldVector(runtimeObjectToVector(pos))),
            offset,
            [0, 1, 0],
            0,
            scale,
        );
        child.runtimeObjectParent = this;
        this.runtimeObjectChildren.add(child);
        child.runtimeObjectDeltaRot = RuntimeObject.runtimeObjectQProduct(
            RuntimeObject.runtimeObjectMakeRotQ(this.EffLocalToWorldVector(runtimeObjectToVector(axis)), angle),
            this.runtimeObjectEffRotState,
        );
        child.runtimeObjectUpdateEff();
        child.runtimeObjectIsTransform = true;
        child.ApplyTransform();
        return child;
    }

    Remove(): void {
        const children = [...this.runtimeObjectChildren];
        for (const child of children) {
            child.Remove();
        }
        if (this.object) mod.UnspawnObject(this.object);
        if (this.runtimeObjectParent) this.runtimeObjectParent.runtimeObjectChildren.delete(this);
        this.runtimeObjectChildren.clear();
        this.runtimeObjectParent = undefined;
    }

    LocalToWorldVector(vector: VectorLike): mod.Vector {
        return RuntimeObject.runtimeObjectQRotateVector(runtimeObjectToVector(vector), this.runtimeObjectRotState);
    }

    WorldToLocalVector(vector: VectorLike): mod.Vector {
        return RuntimeObject.runtimeObjectQRotateVector(runtimeObjectToVector(vector), RuntimeObject.runtimeObjectInverseQ(this.runtimeObjectRotState));
    }

    EffLocalToWorldVector(vector: VectorLike): mod.Vector {
        return RuntimeObject.runtimeObjectQRotateVector(runtimeObjectToVector(vector), this.runtimeObjectEffRotState);
    }

    EffWorldToLocalVector(vector: VectorLike): mod.Vector {
        return RuntimeObject.runtimeObjectQRotateVector(runtimeObjectToVector(vector), RuntimeObject.runtimeObjectInverseQ(this.runtimeObjectEffRotState));
    }

    private runtimeObjectUpdateEff(): void {
        this.runtimeObjectEffPos = mod.Add(this.runtimeObjectPos, this.runtimeObjectDeltaPos);
        this.runtimeObjectEffRotState = RuntimeObject.runtimeObjectQProduct(this.runtimeObjectDeltaRot, this.runtimeObjectRotState);
    }

    private static runtimeObjectQNormalize(q: readonly [number, number, number, number]): RuntimeObjectQuaternion {
        let [qw, qx, qy, qz] = q;
        const qnorm = Math.sqrt(qw ** 2 + qx ** 2 + qy ** 2 + qz ** 2);
        if (qnorm === 0) {
            mod.SendErrorReport(mod.Message("The norm of the quaternion is zero."));
            return [1, 0, 0, 0];
        }
        qw /= qnorm;
        qx /= qnorm;
        qy /= qnorm;
        qz /= qnorm;
        return [qw, qx, qy, qz];
    }

    private static runtimeObjectInverseQ(q: readonly [number, number, number, number]): RuntimeObjectQuaternion {
        const [qw, qx, qy, qz] = q;
        return [qw, -qx, -qy, -qz];
    }

    private static runtimeObjectQProduct(q1: readonly [number, number, number, number], q2: readonly [number, number, number, number]): RuntimeObjectQuaternion {
        const [qw1, qx1, qy1, qz1] = q1;
        const [qw2, qx2, qy2, qz2] = q2;
        return RuntimeObject.runtimeObjectQNormalize([
            qw1 * qw2 - qx1 * qx2 - qy1 * qy2 - qz1 * qz2,
            qw1 * qx2 + qx1 * qw2 + qy1 * qz2 - qz1 * qy2,
            qw1 * qy2 - qx1 * qz2 + qy1 * qw2 + qz1 * qx2,
            qw1 * qz2 + qx1 * qy2 - qy1 * qx2 + qz1 * qw2,
        ]);
    }

    private static runtimeObjectQRotateVector(vector: mod.Vector, q: readonly [number, number, number, number]): mod.Vector {
        const [qw, qx, qy, qz] = q;
        const vecX = mod.XComponentOf(vector);
        const vecY = mod.YComponentOf(vector);
        const vecZ = mod.ZComponentOf(vector);
        return mod.CreateVector(
            (qw ** 2 + qx ** 2 - qy ** 2 - qz ** 2) * vecX + 2 * (qx * qy - qw * qz) * vecY + 2 * (qx * qz + qw * qy) * vecZ,
            2 * (qx * qy + qw * qz) * vecX + (qw ** 2 - qx ** 2 + qy ** 2 - qz ** 2) * vecY + 2 * (qy * qz - qw * qx) * vecZ,
            2 * (qx * qz - qw * qy) * vecX + 2 * (qy * qz + qw * qx) * vecY + (qw ** 2 - qx ** 2 - qy ** 2 + qz ** 2) * vecZ,
        );
    }

    private static runtimeObjectMakeRotQ(axis: mod.Vector, angle: number): RuntimeObjectQuaternion {
        if (mod.DotProduct(axis, axis) === 0) {
            mod.SendErrorReport(mod.Message("Rotation has been disabled because a zero vector was specified for the rotation axis."));
            return [1, 0, 0, 0];
        }

        const normalizedAxis = mod.Normalize(axis);
        const halfAngle = angle / 2;
        return [
            Math.cos(halfAngle),
            mod.XComponentOf(normalizedAxis) * Math.sin(halfAngle),
            mod.YComponentOf(normalizedAxis) * Math.sin(halfAngle),
            mod.ZComponentOf(normalizedAxis) * Math.sin(halfAngle),
        ];
    }

    private static runtimeObjectQToEuler(q: readonly [number, number, number, number]): mod.Vector {
        const [qw, qx, qy, qz] = RuntimeObject.runtimeObjectQNormalize(q);
        return mod.CreateVector(
            Math.atan2(2 * (qy * qz + qw * qx), qw ** 2 - qx ** 2 - qy ** 2 + qz ** 2),
            Math.asin(Math.max(-1, Math.min(1, 2 * (qw * qy - qx * qz)))),
            Math.atan2(2 * (qx * qy + qw * qz), qw ** 2 + qx ** 2 - qy ** 2 - qz ** 2),
        );
    }
}

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

export interface ObjectTimelineOptions extends ObjectTweenOptions {
    loop?: boolean | number;
}

export interface ObjectPhysicsStepper {
    step(dt: number): void;
}

export interface ObjectPhysicsOptions {
    duration?: number;
    step?: number;
}

export interface ObjectTimelineItem {
    target: mod.Object;
    props: ObjectTweenProps;
}

export interface ObjectTimeline {
    to(object: mod.Object, props: ObjectTweenProps, options?: ObjectTweenOptions): ObjectTimeline;
    to(items: ObjectTimelineItem[], options?: ObjectTweenOptions): ObjectTimeline;
    to(object: RuntimeObject, props: RuntimeObjectTweenProps, options?: ObjectTweenOptions): ObjectTimeline;
    to(items: RuntimeObjectTimelineItem[], options?: ObjectTweenOptions): ObjectTimeline;
    physics(world: ObjectPhysicsStepper, options?: ObjectPhysicsOptions): ObjectTimeline;
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
    | { type: "toMany"; items: ObjectTimelineItem[]; options?: ObjectTweenOptions }
    | { type: "runtimeTo"; items: RuntimeObjectTimelineItem[]; options?: ObjectTweenOptions }
    | { type: "physics"; world: ObjectPhysicsStepper; options?: ObjectPhysicsOptions }
    | { type: "wait"; seconds: number }
    | { type: "call"; fn: () => void | Promise<void> };

const objectDefaultTweenOptions: Required<Pick<ObjectTweenOptions, "duration" | "step">> & { ease: EaseName } = {
    duration: 0.3,
    ease: "outCubic",
    step: 1 / 15,
};

function runtimeObjectToVector(value: VectorLike): mod.Vector {
    if (Array.isArray(value)) {
        return mod.CreateVector(value[0], value[1], value.length > 2 ? value[2] : 0);
    }
    return value as mod.Vector;
}

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

function objectScaleVector(value: mod.Vector, amount: number): mod.Vector {
    return mod.CreateVector(
        objectVectorX(value) * amount,
        objectVectorY(value) * amount,
        objectVectorZ(value) * amount,
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

async function runManyObjectTweens(items: ObjectTimelineItem[], options: ObjectTweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    for (const item of items) {
        if (item.props.enabled === true) mod.EnableSpatialObject(item.target as mod.SpatialObject, true);
    }

    const duration = options?.duration ?? objectDefaultTweenOptions.duration;
    const step = options?.step ?? objectDefaultTweenOptions.step;
    const ease = objectResolveEase(options?.ease);
    const built = items.map((item) => ({ item, vectors: buildObjectTweens(item.target, item.props) }));

    if (duration <= 0) {
        for (const entry of built) {
            applyObjectTweens(entry.vectors, 1);
            if (entry.item.props.enabled === false) mod.EnableSpatialObject(entry.item.target as mod.SpatialObject, false);
        }
        return;
    }

    for (const entry of built) {
        applyObjectTweens(entry.vectors, 0);
    }

    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        elapsed += waitSeconds;
        const amount = ease(objectClamp01(elapsed / duration));
        for (const entry of built) {
            applyObjectTweens(entry.vectors, amount);
        }
    }

    if (!shouldStop()) {
        for (const entry of built) {
            applyObjectTweens(entry.vectors, 1);
            if (entry.item.props.enabled === false) mod.EnableSpatialObject(entry.item.target as mod.SpatialObject, false);
        }
    }
}

function objectApplyRuntimeItems(items: RuntimeObjectTimelineItem[], progressDelta: number): void {
    if (progressDelta === 0) return;

    for (const item of items) {
        if (item.props.moveBy) {
            item.target.Move(objectScaleVector(runtimeObjectToVector(item.props.moveBy), progressDelta));
        }
        if (item.props.qRotateBy) {
            item.target.QRotation(
                runtimeObjectToVector(item.props.qRotateBy.axis),
                item.props.qRotateBy.angle * progressDelta,
                item.props.qRotateBy.rotCenter,
            );
        }
    }

    const targets = items.map((item) => item.target);
    for (const target of targets) {
        if (!objectHasRuntimeAncestorIn(target, targets)) target.ApplyTransform();
    }
}

function objectHasRuntimeAncestorIn(target: RuntimeObject, targets: RuntimeObject[]): boolean {
    let parent = target.parent;
    while (parent) {
        if (targets.includes(parent)) return true;
        parent = parent.parent;
    }
    return false;
}

async function runRuntimeObjectTween(items: RuntimeObjectTimelineItem[], options: ObjectTweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    const duration = options?.duration ?? objectDefaultTweenOptions.duration;
    const step = options?.step ?? objectDefaultTweenOptions.step;
    const ease = objectResolveEase(options?.ease);

    if (duration <= 0) {
        objectApplyRuntimeItems(items, 1);
        return;
    }

    let elapsed = 0;
    let previousAmount = 0;
    while (elapsed < duration && !shouldStop()) {
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        elapsed += waitSeconds;
        const amount = ease(objectClamp01(elapsed / duration));
        objectApplyRuntimeItems(items, amount - previousAmount);
        previousAmount = amount;
    }

    if (!shouldStop() && previousAmount < 1) {
        objectApplyRuntimeItems(items, 1 - previousAmount);
    }
}

async function runObjectPhysics(world: ObjectPhysicsStepper, options: ObjectPhysicsOptions | undefined, shouldStop: () => boolean): Promise<void> {
    const step = options?.step ?? objectDefaultTweenOptions.step;
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

export function objectAnimate(object: mod.Object): { to(props: ObjectTweenProps, options?: ObjectTweenOptions): Promise<void> } {
    return {
        to(props: ObjectTweenProps, options?: ObjectTweenOptions) {
            return runObjectTween(object, props, options, () => false);
        },
    };
}

export function objectTimeline(options?: ObjectTimelineOptions): ObjectTimeline {
    const steps: ObjectTimelineStep[] = [];
    let stopped = false;
    const objectLoopCount = typeof options?.loop === "number" ? Math.max(0, Math.floor(options.loop)) : options?.loop === true ? Infinity : 1;

    const api: ObjectTimeline = {
        to(target: mod.Object | RuntimeObject | ObjectTimelineItem[] | RuntimeObjectTimelineItem[], propsOrOptions?: ObjectTweenProps | RuntimeObjectTweenProps | ObjectTweenOptions, tweenOptions?: ObjectTweenOptions) {
            if (Array.isArray(target)) {
                if (target.length > 0 && target[0].target instanceof RuntimeObject) {
                    steps.push({ type: "runtimeTo", items: target as RuntimeObjectTimelineItem[], options: { ...options, ...(propsOrOptions as ObjectTweenOptions | undefined) } });
                } else {
                    steps.push({ type: "toMany", items: target as ObjectTimelineItem[], options: { ...options, ...(propsOrOptions as ObjectTweenOptions | undefined) } });
                }
            } else if (target instanceof RuntimeObject) {
                steps.push({
                    type: "runtimeTo",
                    items: [{ target, props: propsOrOptions as RuntimeObjectTweenProps }],
                    options: { ...options, ...tweenOptions },
                });
            } else {
                steps.push({ type: "to", object: target, props: propsOrOptions as ObjectTweenProps, options: { ...options, ...tweenOptions } });
            }
            return api;
        },
        physics(world: ObjectPhysicsStepper, physicsOptions?: ObjectPhysicsOptions) {
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
            if (steps.length === 0 || objectLoopCount <= 0) return;

            let objectPlayed = 0;
            while (!stopped && objectPlayed < objectLoopCount) {
                for (const step of steps) {
                    if (stopped) return;
                    if (step.type === "to") {
                        await runObjectTween(step.object, step.props, step.options, () => stopped);
                    } else if (step.type === "toMany") {
                        await runManyObjectTweens(step.items, step.options, () => stopped);
                    } else if (step.type === "runtimeTo") {
                        await runRuntimeObjectTween(step.items, step.options, () => stopped);
                    } else if (step.type === "physics") {
                        await runObjectPhysics(step.world, step.options, () => stopped);
                    } else if (step.type === "wait") {
                        if (step.seconds > 0) await mod.Wait(step.seconds);
                    } else {
                        await step.fn();
                    }
                }
                objectPlayed += 1;
            }
        },
        stop() {
            stopped = true;
        },
    };

    return api;
}
