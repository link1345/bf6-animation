import { VectorLike, EaseFunction, EaseName, eases } from "./bf6-easings";

// Alias for the prefab type accepted by mod.SpawnObject.
export type RuntimeObjectPrefab = Parameters<typeof mod.SpawnObject>[0];

// Internal quaternion tuple stored as [w, x, y, z].
type RuntimeObjectQuaternion = [number, number, number, number];

// Relative movement and quaternion rotation settings for RuntimeObject timelines.
export interface RuntimeObjectTweenProps {
    // Relative movement from the current position.
    moveBy?: VectorLike;
    // Relative rotation around the given axis and angle.
    qRotateBy?: {
        // Rotation axis.
        axis: VectorLike;
        // Rotation angle in radians.
        angle: number;
        // Rotation center; defaults to the target effective position.
        rotCenter?: VectorLike;
    };
}

// Target and properties for moving RuntimeObjects together in a timeline.
export interface RuntimeObjectTimelineItem {
    // RuntimeObject targeted by the animation.
    target: RuntimeObject;
    // Tween properties applied to the RuntimeObject.
    props: RuntimeObjectTweenProps;
}

// Runtime object that handles parent-child links, relative movement, and quaternion rotation.
export class RuntimeObject {
    // Spawned mod.Object; undefined when no prefab was provided.
    readonly object: mod.Object | undefined;
    // ID of the mod.Object; undefined when no prefab was provided.
    readonly id: number | undefined;
    // Prefab used for spawning.
    readonly prefabEnum: RuntimeObjectPrefab | undefined;
    // Local offset added to the rendered position.
    readonly offset: mod.Vector;

    // Committed center position.
    private runtimeObjectPos: mod.Vector;
    // Committed rotation state.
    private runtimeObjectRotState: RuntimeObjectQuaternion;
    // Pending movement delta accumulated before ApplyTransform.
    private runtimeObjectDeltaPos: mod.Vector = mod.CreateVector(0, 0, 0);
    // Pending rotation delta accumulated before ApplyTransform.
    private runtimeObjectDeltaRot: RuntimeObjectQuaternion = [1, 0, 0, 0];
    // Tracks whether there is a pending transform.
    private runtimeObjectIsTransform = false;
    // Effective world position including pending deltas.
    private runtimeObjectEffPos: mod.Vector;
    // Effective rotation state including pending deltas.
    private runtimeObjectEffRotState: RuntimeObjectQuaternion;
    // Parent RuntimeObject.
    private runtimeObjectParent: RuntimeObject | undefined;
    // Set of child RuntimeObjects.
    private runtimeObjectChildren = new Set<RuntimeObject>();

    // Returns the committed world position.
    get worldPos(): mod.Vector {
        return this.runtimeObjectPos;
    }

    // Returns local position relative to the parent when one exists.
    get localPos(): mod.Vector {
        if (!this.runtimeObjectParent) return this.runtimeObjectPos;
        return this.runtimeObjectParent.WorldToLocalVector(mod.Subtract(this.runtimeObjectPos, this.runtimeObjectParent.runtimeObjectPos));
    }

    // Returns world position including pending deltas.
    get effWorldPos(): mod.Vector {
        return this.runtimeObjectEffPos;
    }

    // Returns local position including pending deltas.
    get effLocalPos(): mod.Vector {
        if (!this.runtimeObjectParent) return this.runtimeObjectEffPos;
        return this.runtimeObjectParent.EffWorldToLocalVector(mod.Subtract(this.runtimeObjectEffPos, this.runtimeObjectParent.runtimeObjectEffPos));
    }

    // Returns the parent RuntimeObject.
    get parent(): RuntimeObject | undefined {
        return this.runtimeObjectParent;
    }

    // Returns a copy of child RuntimeObjects.
    get children(): Set<RuntimeObject> {
        return new Set(this.runtimeObjectChildren);
    }

    // Creates a RuntimeObject and spawns a game object when a prefab is provided.
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

    // Accumulates local or world movement delta and propagates it to children.
    Move(dpos: VectorLike): void {
        // Converts local delta to world delta using the parent effective rotation when present.
        let moveDelta = runtimeObjectToVector(dpos);
        if (this.runtimeObjectParent) moveDelta = this.runtimeObjectParent.EffLocalToWorldVector(moveDelta);

        this.runtimeObjectDeltaPos = mod.Add(this.runtimeObjectDeltaPos, moveDelta);
        this.runtimeObjectUpdateEff();
        this.runtimeObjectIsTransform = true;

        // Converts this world movement back to local delta before passing it to children.
        const childDelta = this.EffWorldToLocalVector(moveDelta);
        for (const child of this.runtimeObjectChildren) {
            child.Move(childDelta);
        }
    }

    // Accumulates quaternion rotation by axis and angle and propagates it to children.
    QRotation(axis: VectorLike, angle: number, rotCenter?: VectorLike): void {
        // Converts local axis to world axis using the parent effective rotation when present.
        let rotationAxis = runtimeObjectToVector(axis);
        if (this.runtimeObjectParent) rotationAxis = this.runtimeObjectParent.EffLocalToWorldVector(rotationAxis);

        // Rotation delta added by this call.
        const deltaRot = RuntimeObject.runtimeObjectMakeRotQ(rotationAxis, angle);
        this.runtimeObjectDeltaRot = RuntimeObject.runtimeObjectQProduct(deltaRot, this.runtimeObjectDeltaRot);

        // Computes positional delta caused by rotation around the center.
        const center = rotCenter === undefined ? this.runtimeObjectEffPos : runtimeObjectToVector(rotCenter);
        const distanceCenter = mod.Subtract(this.runtimeObjectEffPos, center);
        const deltaPos = mod.Subtract(RuntimeObject.runtimeObjectQRotateVector(distanceCenter, deltaRot), distanceCenter);
        this.runtimeObjectDeltaPos = mod.Add(this.runtimeObjectDeltaPos, deltaPos);
        this.runtimeObjectUpdateEff();
        this.runtimeObjectIsTransform = true;

        // Converts this world rotation axis back to local axis before passing it to children.
        const childAxis = this.EffWorldToLocalVector(rotationAxis);
        for (const child of this.runtimeObjectChildren) {
            child.QRotation(childAxis, angle, center);
        }
    }

    // Commits accumulated movement and rotation to the actual object.
    ApplyTransform(): void {
        if (this.runtimeObjectIsTransform) {
            // Final center position after adding pending movement.
            const centerPos = mod.Add(this.runtimeObjectPos, this.runtimeObjectDeltaPos);
            // Final rotation after composing pending rotation.
            const finalRot = RuntimeObject.runtimeObjectQProduct(this.runtimeObjectDeltaRot, this.runtimeObjectRotState);

            if (this.object) {
                // Rotates the offset by the final rotation and adds it to the rendered position.
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

    // Creates a child RuntimeObject using local position under this parent.
    NewChild(prefabEnum: RuntimeObjectPrefab | undefined, pos: VectorLike, offset: VectorLike, axis: VectorLike, angle: number, scale: VectorLike = [1, 1, 1]): RuntimeObject {
        // Builds the child initial world position from the parent effective position and rotation.
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

    // Removes this object and its children from the game and clears parent-child links.
    Remove(): void {
        // Copies the Set to an array before removal because the Set changes during traversal.
        const children = [...this.runtimeObjectChildren];
        for (const child of children) {
            child.Remove();
        }
        if (this.object) mod.UnspawnObject(this.object);
        if (this.runtimeObjectParent) this.runtimeObjectParent.runtimeObjectChildren.delete(this);
        this.runtimeObjectChildren.clear();
        this.runtimeObjectParent = undefined;
    }

    // Converts a local vector to world space using committed rotation.
    LocalToWorldVector(vector: VectorLike): mod.Vector {
        return RuntimeObject.runtimeObjectQRotateVector(runtimeObjectToVector(vector), this.runtimeObjectRotState);
    }

    // Converts a world vector to local space using committed rotation.
    WorldToLocalVector(vector: VectorLike): mod.Vector {
        return RuntimeObject.runtimeObjectQRotateVector(runtimeObjectToVector(vector), RuntimeObject.runtimeObjectInverseQ(this.runtimeObjectRotState));
    }

    // Converts a local vector to world space using effective rotation.
    EffLocalToWorldVector(vector: VectorLike): mod.Vector {
        return RuntimeObject.runtimeObjectQRotateVector(runtimeObjectToVector(vector), this.runtimeObjectEffRotState);
    }

    // Converts a world vector to local space using effective rotation.
    EffWorldToLocalVector(vector: VectorLike): mod.Vector {
        return RuntimeObject.runtimeObjectQRotateVector(runtimeObjectToVector(vector), RuntimeObject.runtimeObjectInverseQ(this.runtimeObjectEffRotState));
    }

    // Updates effective position and rotation from committed values and pending deltas.
    private runtimeObjectUpdateEff(): void {
        this.runtimeObjectEffPos = mod.Add(this.runtimeObjectPos, this.runtimeObjectDeltaPos);
        this.runtimeObjectEffRotState = RuntimeObject.runtimeObjectQProduct(this.runtimeObjectDeltaRot, this.runtimeObjectRotState);
    }

    // Normalizes a quaternion to unit length.
    private static runtimeObjectQNormalize(q: readonly [number, number, number, number]): RuntimeObjectQuaternion {
        // Quaternion components.
        let [qw, qx, qy, qz] = q;
        // Quaternion length.
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

    // Returns the inverse quaternion that cancels the rotation.
    private static runtimeObjectInverseQ(q: readonly [number, number, number, number]): RuntimeObjectQuaternion {
        // Quaternion components.
        const [qw, qx, qy, qz] = q;
        return [qw, -qx, -qy, -qz];
    }

    // Composes two quaternions.
    private static runtimeObjectQProduct(q1: readonly [number, number, number, number], q2: readonly [number, number, number, number]): RuntimeObjectQuaternion {
        // Components of the left quaternion.
        const [qw1, qx1, qy1, qz1] = q1;
        // Components of the right quaternion.
        const [qw2, qx2, qy2, qz2] = q2;
        return RuntimeObject.runtimeObjectQNormalize([
            qw1 * qw2 - qx1 * qx2 - qy1 * qy2 - qz1 * qz2,
            qw1 * qx2 + qx1 * qw2 + qy1 * qz2 - qz1 * qy2,
            qw1 * qy2 - qx1 * qz2 + qy1 * qw2 + qz1 * qx2,
            qw1 * qz2 + qx1 * qy2 - qy1 * qx2 + qz1 * qw2,
        ]);
    }

    // Applies quaternion rotation to a vector.
    private static runtimeObjectQRotateVector(vector: mod.Vector, q: readonly [number, number, number, number]): mod.Vector {
        // Quaternion components used for rotation.
        const [qw, qx, qy, qz] = q;
        // X component of the vector being rotated.
        const vecX = mod.XComponentOf(vector);
        // Y component of the vector being rotated.
        const vecY = mod.YComponentOf(vector);
        // Z component of the vector being rotated.
        const vecZ = mod.ZComponentOf(vector);
        return mod.CreateVector(
            (qw ** 2 + qx ** 2 - qy ** 2 - qz ** 2) * vecX + 2 * (qx * qy - qw * qz) * vecY + 2 * (qx * qz + qw * qy) * vecZ,
            2 * (qx * qy + qw * qz) * vecX + (qw ** 2 - qx ** 2 + qy ** 2 - qz ** 2) * vecY + 2 * (qy * qz - qw * qx) * vecZ,
            2 * (qx * qz - qw * qy) * vecX + 2 * (qy * qz + qw * qx) * vecY + (qw ** 2 - qx ** 2 - qy ** 2 + qz ** 2) * vecZ,
        );
    }

    // Creates a quaternion from a rotation axis and angle.
    private static runtimeObjectMakeRotQ(axis: mod.Vector, angle: number): RuntimeObjectQuaternion {
        if (mod.DotProduct(axis, axis) === 0) {
            mod.SendErrorReport(mod.Message("Rotation has been disabled because a zero vector was specified for the rotation axis."));
            return [1, 0, 0, 0];
        }

        // Normalized rotation axis used for stable rotation math.
        const normalizedAxis = mod.Normalize(axis);
        // Half angle used to build the quaternion.
        const halfAngle = angle / 2;
        return [
            Math.cos(halfAngle),
            mod.XComponentOf(normalizedAxis) * Math.sin(halfAngle),
            mod.YComponentOf(normalizedAxis) * Math.sin(halfAngle),
            mod.ZComponentOf(normalizedAxis) * Math.sin(halfAngle),
        ];
    }

    // Converts a quaternion to Euler angles for mod.SetObjectTransform.
    private static runtimeObjectQToEuler(q: readonly [number, number, number, number]): mod.Vector {
        // Components of the normalized quaternion.
        const [qw, qx, qy, qz] = RuntimeObject.runtimeObjectQNormalize(q);
        return mod.CreateVector(
            Math.atan2(2 * (qy * qz + qw * qx), qw ** 2 - qx ** 2 - qy ** 2 + qz ** 2),
            Math.asin(Math.max(-1, Math.min(1, 2 * (qw * qy - qx * qz)))),
            Math.atan2(2 * (qx * qy + qw * qz), qw ** 2 + qx ** 2 - qy ** 2 - qz ** 2),
        );
    }
}

// Properties that can be animated on a normal mod.Object.
export interface ObjectTweenProps {
    // Changes only the X coordinate.
    x?: number;
    // Changes only the Y coordinate.
    y?: number;
    // Changes only the Z coordinate.
    z?: number;
    // Changes the full position vector.
    position?: VectorLike;
    // Changes only the X-axis rotation.
    pitch?: number;
    // Changes only the Y-axis rotation.
    yaw?: number;
    // Changes only the Z-axis rotation.
    roll?: number;
    // Changes the full rotation vector.
    rotation?: VectorLike;
    // Toggles the SpatialObject enabled state.
    enabled?: boolean;
}

// Settings for duration, easing, and update interval of one object tween.
export interface ObjectTweenOptions {
    // Duration of the animation in seconds.
    duration?: number;
    // Easing name or a custom easing function.
    ease?: EaseName | EaseFunction;
    // Interval in seconds between value updates.
    step?: number;
}

// Common tween settings and loop settings for an object timeline.
export interface ObjectTimelineOptions extends ObjectTweenOptions {
    // true loops forever; a number plays that many times.
    loop?: boolean | number;
}

// Common interface for advancing physics inside an object timeline.
export interface ObjectPhysicsStepper {
    // Advances the physics state by dt seconds.
    step(dt: number): void;
}

// Duration and update interval for physics inside an object timeline.
export interface ObjectPhysicsOptions {
    // Duration in seconds for running physics.
    duration?: number;
    // Physics step interval in seconds.
    step?: number;
}

// Target and properties used when tweening multiple objects together.
export interface ObjectTimelineItem {
    // mod.Object targeted by the animation.
    target: mod.Object;
    // Tween properties applied to the target.
    props: ObjectTweenProps;
}

// API for queueing and playing Object and RuntimeObject animation steps in order.
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

// Start vector, end vector, and apply callback for one vector property.
type ObjectVectorTween = {
    // Vector at the start of interpolation.
    from: mod.Vector;
    // Vector at the end of interpolation.
    to: mod.Vector;
    // Applies the interpolated vector to the actual object.
    apply: (value: mod.Vector) => void;
};

// Internal type for one queued ObjectTimeline step.
type ObjectTimelineStep =
    | { type: "to"; object: mod.Object; props: ObjectTweenProps; options?: ObjectTweenOptions }
    | { type: "toMany"; items: ObjectTimelineItem[]; options?: ObjectTweenOptions }
    | { type: "runtimeTo"; items: RuntimeObjectTimelineItem[]; options?: ObjectTweenOptions }
    | { type: "physics"; world: ObjectPhysicsStepper; options?: ObjectPhysicsOptions }
    | { type: "wait"; seconds: number }
    | { type: "call"; fn: () => void | Promise<void> };

// Default values used when ObjectTweenOptions are omitted.
const objectDefaultTweenOptions: Required<Pick<ObjectTweenOptions, "duration" | "step">> & { ease: EaseName } = {
    duration: 0.3,
    ease: "outCubic",
    step: 1 / 15,
};

// Normalizes VectorLike input into mod.Vector for RuntimeObject use.
function runtimeObjectToVector(value: VectorLike): mod.Vector {
    if (Array.isArray(value)) {
        return mod.CreateVector(value[0], value[1], value.length > 2 ? value[2] : 0);
    }
    return value as mod.Vector;
}

// Clamps a progress value to the 0..1 range.
function objectClamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

// Resolves an easing name or function to the function that will be called.
function objectResolveEase(ease: ObjectTweenOptions["ease"]): EaseFunction {
    if (typeof ease === "function") return ease;
    return eases[ease ?? objectDefaultTweenOptions.ease];
}

// Returns the X component of a mod.Vector.
function objectVectorX(value: mod.Vector): number {
    return mod.XComponentOf(value);
}

// Returns the Y component of a mod.Vector.
function objectVectorY(value: mod.Vector): number {
    return mod.YComponentOf(value);
}

// Returns the Z component of a mod.Vector.
function objectVectorZ(value: mod.Vector): number {
    return mod.ZComponentOf(value);
}

// Normalizes an array or mod.Vector input into mod.Vector.
function objectToVector(value: VectorLike): mod.Vector {
    if (Array.isArray(value)) {
        return mod.CreateVector(value[0], value[1], value.length > 2 ? value[2] : 0);
    }
    return value as mod.Vector;
}

// Linearly interpolates two numbers by amount.
function objectLerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
}

// Linearly interpolates two vectors by amount.
function objectLerpVector(from: mod.Vector, to: mod.Vector, amount: number): mod.Vector {
    return mod.CreateVector(
        objectLerp(objectVectorX(from), objectVectorX(to), amount),
        objectLerp(objectVectorY(from), objectVectorY(to), amount),
        objectLerp(objectVectorZ(from), objectVectorZ(to), amount),
    );
}

// Scales each vector component by the given amount.
function objectScaleVector(value: mod.Vector, amount: number): mod.Vector {
    return mod.CreateVector(
        objectVectorX(value) * amount,
        objectVectorY(value) * amount,
        objectVectorZ(value) * amount,
    );
}

// Checks whether props explicitly owns the given key.
function objectHasOwn<K extends keyof ObjectTweenProps>(props: ObjectTweenProps, key: K): boolean {
    return Object.prototype.hasOwnProperty.call(props, key);
}

// Builds the final position vector from position or x/y/z fields.
function buildObjectPositionTarget(current: mod.Vector, props: ObjectTweenProps): mod.Vector | undefined {
    if (!objectHasOwn(props, "position") && !objectHasOwn(props, "x") && !objectHasOwn(props, "y") && !objectHasOwn(props, "z")) {
        return undefined;
    }

    // Uses the current value as a base when position is omitted, allowing x/y/z-only updates.
    const base = props.position === undefined ? current : objectToVector(props.position);
    return mod.CreateVector(
        props.x ?? objectVectorX(base),
        props.y ?? objectVectorY(base),
        props.z ?? objectVectorZ(base),
    );
}

// Builds the final rotation vector from rotation or pitch/yaw/roll fields.
function buildObjectRotationTarget(current: mod.Vector, props: ObjectTweenProps): mod.Vector | undefined {
    if (!objectHasOwn(props, "rotation") && !objectHasOwn(props, "pitch") && !objectHasOwn(props, "yaw") && !objectHasOwn(props, "roll")) {
        return undefined;
    }

    // Uses the current value as a base when rotation is omitted, allowing pitch/yaw/roll-only updates.
    const base = props.rotation === undefined ? current : objectToVector(props.rotation);
    return mod.CreateVector(
        props.pitch ?? objectVectorX(base),
        props.yaw ?? objectVectorY(base),
        props.roll ?? objectVectorZ(base),
    );
}

// Converts ObjectTweenProps into vector tweens with current values.
function buildObjectTweens(object: mod.Object, props: ObjectTweenProps): ObjectVectorTween[] {
    // List of vector tweens for position, rotation, and similar values.
    const vectors: ObjectVectorTween[] = [];
    // Current transform.
    const currentTransform = mod.GetObjectTransform(object);
    // Current position.
    const currentPosition = mod.GetTransformPosition(currentTransform);
    // Current rotation.
    const currentRotation = mod.GetTransformRotation(currentTransform);
    // Next position cached so position and rotation tweens do not overwrite each other.
    let nextPosition = currentPosition;
    // Next rotation cached so position and rotation tweens do not overwrite each other.
    let nextRotation = currentRotation;

    // Target position built from props.
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

    // Target rotation built from props.
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

// Applies progress amount to the prepared object tweens.
function applyObjectTweens(vectors: ObjectVectorTween[], amount: number): void {
    for (const tween of vectors) {
        tween.apply(objectLerpVector(tween.from, tween.to, amount));
    }
}

// Runs a tween for one mod.Object.
async function runObjectTween(object: mod.Object, props: ObjectTweenProps, options: ObjectTweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    if (props.enabled === true) {
        mod.EnableSpatialObject(object as mod.SpatialObject, true);
    }

    // Playback duration in seconds.
    const duration = options?.duration ?? objectDefaultTweenOptions.duration;
    // Time interval between value updates.
    const step = options?.step ?? objectDefaultTweenOptions.step;
    // Easing function applied to progress.
    const ease = objectResolveEase(options?.ease);
    // Prepared vector tweens built from props.
    const vectors = buildObjectTweens(object, props);

    if (duration <= 0) {
        applyObjectTweens(vectors, 1);
        if (props.enabled === false) mod.EnableSpatialObject(object as mod.SpatialObject, false);
        return;
    }

    applyObjectTweens(vectors, 0);

    // Elapsed playback time in seconds.
    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
        // Wait time for this tick, capped by remaining duration.
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

// Runs tweens for multiple mod.Objects on the same timeline.
async function runManyObjectTweens(items: ObjectTimelineItem[], options: ObjectTweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    for (const item of items) {
        if (item.props.enabled === true) mod.EnableSpatialObject(item.target as mod.SpatialObject, true);
    }

    // Playback duration in seconds.
    const duration = options?.duration ?? objectDefaultTweenOptions.duration;
    // Time interval between value updates.
    const step = options?.step ?? objectDefaultTweenOptions.step;
    // Easing function applied to progress.
    const ease = objectResolveEase(options?.ease);
    // Per-object prepared tween data built from current values.
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

    // Elapsed playback time in seconds.
    let elapsed = 0;
    while (elapsed < duration && !shouldStop()) {
        // Wait time for this tick, capped by remaining duration.
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        elapsed += waitSeconds;
        // Eased progress shared by every target.
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

// Applies only the progress delta to RuntimeObject timeline items.
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

    // RuntimeObject targets affected by this timeline tick.
    const targets = items.map((item) => item.target);
    for (const target of targets) {
        if (!objectHasRuntimeAncestorIn(target, targets)) target.ApplyTransform();
    }
}

// Checks whether a target has an ancestor that is already being transformed.
function objectHasRuntimeAncestorIn(target: RuntimeObject, targets: RuntimeObject[]): boolean {
    // Current ancestor being inspected.
    let parent = target.parent;
    while (parent) {
        if (targets.includes(parent)) return true;
        parent = parent.parent;
    }
    return false;
}

// Runs relative movement and rotation tweens for RuntimeObjects.
async function runRuntimeObjectTween(items: RuntimeObjectTimelineItem[], options: ObjectTweenOptions | undefined, shouldStop: () => boolean): Promise<void> {
    // Playback duration in seconds.
    const duration = options?.duration ?? objectDefaultTweenOptions.duration;
    // Time interval between value updates.
    const step = options?.step ?? objectDefaultTweenOptions.step;
    // Easing function applied to progress.
    const ease = objectResolveEase(options?.ease);

    if (duration <= 0) {
        objectApplyRuntimeItems(items, 1);
        return;
    }

    // Elapsed playback time in seconds.
    let elapsed = 0;
    // Previous eased progress used to calculate this tick's delta.
    let previousAmount = 0;
    while (elapsed < duration && !shouldStop()) {
        // Wait time for this tick, capped by remaining duration.
        const waitSeconds = Math.min(step, duration - elapsed);
        await mod.Wait(waitSeconds);
        elapsed += waitSeconds;
        // Current eased progress.
        const amount = ease(objectClamp01(elapsed / duration));
        objectApplyRuntimeItems(items, amount - previousAmount);
        previousAmount = amount;
    }

    if (!shouldStop() && previousAmount < 1) {
        objectApplyRuntimeItems(items, 1 - previousAmount);
    }
}

// Advances a physics stepper for a fixed duration on the object timeline.
async function runObjectPhysics(world: ObjectPhysicsStepper, options: ObjectPhysicsOptions | undefined, shouldStop: () => boolean): Promise<void> {
    // Physics update step size.
    const step = options?.step ?? objectDefaultTweenOptions.step;
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

// Returns a small helper API for tweening a single object.
export function objectAnimate(object: mod.Object): { to(props: ObjectTweenProps, options?: ObjectTweenOptions): Promise<void> } {
    return {
        to(props: ObjectTweenProps, options?: ObjectTweenOptions) {
            return runObjectTween(object, props, options, () => false);
        },
    };
}

// Creates a timeline that queues and plays object animation steps in order.
export function objectTimeline(options?: ObjectTimelineOptions): ObjectTimeline {
    // Steps processed in order during playback.
    const steps: ObjectTimelineStep[] = [];
    // Tracks whether stop() has been called.
    let stopped = false;
    // Playback count derived from the loop option.
    const objectLoopCount = typeof options?.loop === "number" ? Math.max(0, Math.floor(options.loop)) : options?.loop === true ? Infinity : 1;

    // ObjectTimeline control object returned to callers.
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

            // Number of completed timeline playthroughs.
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
