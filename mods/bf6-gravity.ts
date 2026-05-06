import { VectorLike } from "./bf6-easings";
import { RuntimeObject } from "./bf6-object-animation";

export interface GravityTarget {
    getPosition(): mod.Vector;
    setPosition(position: mod.Vector, delta: mod.Vector): void;
}

export interface GravityBodyOptions {
    velocity?: VectorLike;
    acceleration?: VectorLike;
    groundY?: number;
}

export interface GravityWorldOptions {
    gravity?: VectorLike;
}

export class GravityBody {
    readonly target: GravityTarget;
    private gravityBodyVelocity: mod.Vector;
    private gravityBodyAcceleration: mod.Vector;
    private gravityBodyGroundY: number | undefined;

    constructor(target: GravityTarget, options: GravityBodyOptions = {}) {
        this.target = target;
        this.gravityBodyVelocity = gravityToVector(options.velocity ?? [0, 0, 0]);
        this.gravityBodyAcceleration = gravityToVector(options.acceleration ?? [0, 0, 0]);
        this.gravityBodyGroundY = options.groundY;
    }

    get velocity(): mod.Vector {
        return this.gravityBodyVelocity;
    }

    set velocity(value: VectorLike) {
        this.gravityBodyVelocity = gravityToVector(value);
    }

    get acceleration(): mod.Vector {
        return this.gravityBodyAcceleration;
    }

    set acceleration(value: VectorLike) {
        this.gravityBodyAcceleration = gravityToVector(value);
    }

    get groundY(): number | undefined {
        return this.gravityBodyGroundY;
    }

    set groundY(value: number | undefined) {
        this.gravityBodyGroundY = value;
    }

    step(dt: number, gravity: VectorLike): void {
        if (dt <= 0) return;

        const totalAcceleration = gravityAddVector(gravityToVector(gravity), this.gravityBodyAcceleration);
        this.gravityBodyVelocity = gravityAddVector(this.gravityBodyVelocity, gravityScaleVector(totalAcceleration, dt));
        const currentPosition = this.target.getPosition();
        let nextPosition = gravityAddVector(currentPosition, gravityScaleVector(this.gravityBodyVelocity, dt));

        if (this.gravityBodyGroundY !== undefined && mod.YComponentOf(nextPosition) < this.gravityBodyGroundY) {
            nextPosition = mod.CreateVector(mod.XComponentOf(nextPosition), this.gravityBodyGroundY, mod.ZComponentOf(nextPosition));
            if (mod.YComponentOf(this.gravityBodyVelocity) < 0) {
                this.gravityBodyVelocity = mod.CreateVector(mod.XComponentOf(this.gravityBodyVelocity), 0, mod.ZComponentOf(this.gravityBodyVelocity));
            }
        }

        this.target.setPosition(nextPosition, gravitySubtractVector(nextPosition, currentPosition));
    }
}

export class GravityWorld {
    private gravityWorldBodies = new Set<GravityBody>();
    private gravityWorldGravity: mod.Vector;

    constructor(options: GravityWorldOptions = {}) {
        this.gravityWorldGravity = gravityToVector(options.gravity ?? [0, -9.8, 0]);
    }

    get gravity(): mod.Vector {
        return this.gravityWorldGravity;
    }

    set gravity(value: VectorLike) {
        this.gravityWorldGravity = gravityToVector(value);
    }

    get bodies(): Set<GravityBody> {
        return new Set(this.gravityWorldBodies);
    }

    add(body: GravityBody): GravityWorld {
        this.gravityWorldBodies.add(body);
        return this;
    }

    remove(body: GravityBody): GravityWorld {
        this.gravityWorldBodies.delete(body);
        return this;
    }

    clear(): GravityWorld {
        this.gravityWorldBodies.clear();
        return this;
    }

    step(dt: number): void {
        if (dt <= 0) return;

        for (const body of this.gravityWorldBodies) {
            body.step(dt, this.gravityWorldGravity);
        }
    }
}

export function uiGravityBody(widget: mod.UIWidget, options?: GravityBodyOptions): GravityBody {
    return new GravityBody({
        getPosition: () => mod.GetUIWidgetPosition(widget),
        setPosition: (position) => mod.SetUIWidgetPosition(widget, position),
    }, options);
}

export function objectGravityBody(object: mod.Object, options?: GravityBodyOptions): GravityBody {
    return new GravityBody({
        getPosition: () => mod.GetObjectPosition(object),
        setPosition: (position) => mod.SetObjectTransform(object, mod.CreateTransform(position, mod.GetObjectRotation(object))),
    }, options);
}

export function runtimeObjectGravityBody(object: RuntimeObject, options?: GravityBodyOptions): GravityBody {
    return new GravityBody({
        getPosition: () => object.worldPos,
        setPosition: (_position, delta) => {
            object.Move(delta);
            object.ApplyTransform();
        },
    }, options);
}

function gravityToVector(value: VectorLike): mod.Vector {
    if (Array.isArray(value)) {
        return mod.CreateVector(value[0], value[1], value.length > 2 ? value[2] : 0);
    }
    return value as mod.Vector;
}

function gravityAddVector(left: mod.Vector, right: mod.Vector): mod.Vector {
    return mod.CreateVector(
        mod.XComponentOf(left) + mod.XComponentOf(right),
        mod.YComponentOf(left) + mod.YComponentOf(right),
        mod.ZComponentOf(left) + mod.ZComponentOf(right),
    );
}

function gravitySubtractVector(left: mod.Vector, right: mod.Vector): mod.Vector {
    return mod.CreateVector(
        mod.XComponentOf(left) - mod.XComponentOf(right),
        mod.YComponentOf(left) - mod.YComponentOf(right),
        mod.ZComponentOf(left) - mod.ZComponentOf(right),
    );
}

function gravityScaleVector(value: mod.Vector, amount: number): mod.Vector {
    return mod.CreateVector(
        mod.XComponentOf(value) * amount,
        mod.YComponentOf(value) * amount,
        mod.ZComponentOf(value) * amount,
    );
}
