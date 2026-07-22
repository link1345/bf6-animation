import { VectorLike } from "./bf6-easings";
import { RuntimeObject, type TransformableObject } from "./bf6-object-animation";

// Common interface used by gravity code to read and write positions.
export interface GravityTarget {
    // Returns the current position.
    getPosition(): mod.Vector;
    // Applies the next position and movement delta to the target.
    setPosition(position: mod.Vector, delta: mod.Vector): void;
}

// Options for initial velocity, extra acceleration, and ground height.
export interface GravityBodyOptions {
    // Initial velocity for the body.
    velocity?: VectorLike;
    // Extra acceleration applied only to this body.
    acceleration?: VectorLike;
    // Ground Y position that prevents the body from falling below it.
    groundY?: number;
}

// Options for gravity applied to the whole GravityWorld.
export interface GravityWorldOptions {
    // Shared gravity acceleration applied to every body in the world.
    gravity?: VectorLike;
}

// Simple physics body that moves a positional target with velocity and acceleration.
export class GravityBody {
    // Target whose position is actually updated.
    readonly target: GravityTarget;
    // Current velocity vector.
    private gravityBodyVelocity: mod.Vector;
    // Additional acceleration specific to this body.
    private gravityBodyAcceleration: mod.Vector;
    // Ground Y coordinate that stops downward movement.
    private gravityBodyGroundY: number | undefined;

    // Creates a physics body from a target and initial options.
    constructor(target: GravityTarget, options: GravityBodyOptions = {}) {
        this.target = target;
        this.gravityBodyVelocity = gravityToVector(options.velocity ?? [0, 0, 0]);
        this.gravityBodyAcceleration = gravityToVector(options.acceleration ?? [0, 0, 0]);
        this.gravityBodyGroundY = options.groundY;
    }

    // Returns the current velocity.
    get velocity(): mod.Vector {
        return this.gravityBodyVelocity;
    }

    // Converts VectorLike velocity to mod.Vector and stores it.
    set velocity(value: VectorLike) {
        this.gravityBodyVelocity = gravityToVector(value);
    }

    // Returns the current extra acceleration.
    get acceleration(): mod.Vector {
        return this.gravityBodyAcceleration;
    }

    // Converts VectorLike acceleration to mod.Vector and stores it.
    set acceleration(value: VectorLike) {
        this.gravityBodyAcceleration = gravityToVector(value);
    }

    // Returns the current ground Y coordinate.
    get groundY(): number | undefined {
        return this.gravityBodyGroundY;
    }

    // Sets the ground Y coordinate; undefined disables ground collision.
    set groundY(value: number | undefined) {
        this.gravityBodyGroundY = value;
    }

    // Advances velocity and position by dt seconds, clamping to ground if needed.
    step(dt: number, gravity: VectorLike): void {
        if (dt <= 0) return;

        // Combined acceleration from world gravity and body-specific acceleration.
        const totalAcceleration = gravityAddVector(gravityToVector(gravity), this.gravityBodyAcceleration);
        this.gravityBodyVelocity = gravityAddVector(this.gravityBodyVelocity, gravityScaleVector(totalAcceleration, dt));
        // Position before this update.
        const currentPosition = this.target.getPosition();
        // Next position after integrating velocity over dt seconds.
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

// Simple physics world that applies one gravity vector to multiple bodies.
export class GravityWorld {
    // Physics bodies registered in this world.
    private gravityWorldBodies = new Set<GravityBody>();
    // Gravity acceleration shared by the whole world.
    private gravityWorldGravity: mod.Vector;

    // Creates a world from gravity options.
    constructor(options: GravityWorldOptions = {}) {
        this.gravityWorldGravity = gravityToVector(options.gravity ?? [0, -9.8, 0]);
    }

    // Returns the current world gravity.
    get gravity(): mod.Vector {
        return this.gravityWorldGravity;
    }

    // Converts VectorLike gravity to mod.Vector and stores it.
    set gravity(value: VectorLike) {
        this.gravityWorldGravity = gravityToVector(value);
    }

    // Returns a copy of the registered bodies.
    get bodies(): Set<GravityBody> {
        return new Set(this.gravityWorldBodies);
    }

    // Adds a body to the world.
    add(body: GravityBody): GravityWorld {
        this.gravityWorldBodies.add(body);
        return this;
    }

    // Removes a body from the world.
    remove(body: GravityBody): GravityWorld {
        this.gravityWorldBodies.delete(body);
        return this;
    }

    // Removes all registered bodies.
    clear(): GravityWorld {
        this.gravityWorldBodies.clear();
        return this;
    }

    // Advances all registered bodies by dt seconds.
    step(dt: number): void {
        if (dt <= 0) return;

        for (const body of this.gravityWorldBodies) {
            body.step(dt, this.gravityWorldGravity);
        }
    }
}

// Creates an adapter that treats a UIWidget as a GravityBody target.
export function uiGravityBody(widget: mod.UIWidget, options?: GravityBodyOptions): GravityBody {
    return new GravityBody({
        getPosition: () => mod.GetUIWidgetPosition(widget),
        setPosition: (position) => mod.SetUIWidgetPosition(widget, position),
    }, options);
}

// Creates an adapter that treats an SDK-transformable object as a GravityBody target.
export function objectGravityBody(object: TransformableObject, options?: GravityBodyOptions): GravityBody {
    return new GravityBody({
        getPosition: () => mod.GetObjectPosition(object),
        setPosition: (position) => mod.SetObjectTransform(object, mod.CreateTransform(position, mod.GetObjectRotation(object))),
    }, options);
}

// Creates an adapter that treats a RuntimeObject as a GravityBody target.
export function runtimeObjectGravityBody(object: RuntimeObject, options?: GravityBodyOptions): GravityBody {
    return new GravityBody({
        getPosition: () => object.worldPos,
        setPosition: (_position, delta) => {
            object.Move(delta);
            object.ApplyTransform();
        },
    }, options);
}

// Normalizes VectorLike input into mod.Vector.
function gravityToVector(value: VectorLike): mod.Vector {
    if (Array.isArray(value)) {
        return mod.CreateVector(value[0], value[1], value.length > 2 ? value[2] : 0);
    }
    return value as mod.Vector;
}

// Adds two vectors component by component.
function gravityAddVector(left: mod.Vector, right: mod.Vector): mod.Vector {
    return mod.CreateVector(
        mod.XComponentOf(left) + mod.XComponentOf(right),
        mod.YComponentOf(left) + mod.YComponentOf(right),
        mod.ZComponentOf(left) + mod.ZComponentOf(right),
    );
}

// Subtracts two vectors component by component.
function gravitySubtractVector(left: mod.Vector, right: mod.Vector): mod.Vector {
    return mod.CreateVector(
        mod.XComponentOf(left) - mod.XComponentOf(right),
        mod.YComponentOf(left) - mod.YComponentOf(right),
        mod.ZComponentOf(left) - mod.ZComponentOf(right),
    );
}

// Scales each vector component by the given amount.
function gravityScaleVector(value: mod.Vector, amount: number): mod.Vector {
    return mod.CreateVector(
        mod.XComponentOf(value) * amount,
        mod.YComponentOf(value) * amount,
        mod.ZComponentOf(value) * amount,
    );
}
