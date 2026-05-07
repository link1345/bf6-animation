// Easing functions used by UI and object interpolation, keyed by name.
export const eases = {
    // Interpolates at a constant speed.
    linear: (t: number) => t,
    // Starts slowly and accelerates with a quadratic curve.
    inQuad: (t: number) => t * t,
    // Starts quickly and decelerates with a quadratic curve.
    outQuad: (t: number) => 1 - (1 - t) * (1 - t),
    // Accelerates in the first half and decelerates in the second half.
    inOutQuad: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    // Starts more slowly with a cubic curve.
    inCubic: (t: number) => t * t * t,
    // Ends more slowly with a cubic curve.
    outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
    // Applies cubic acceleration and deceleration across the animation.
    inOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    // Overshoots the target slightly and settles back.
    outBack: (t: number) => {
        // Controls the strength of the overshoot.
        const c1 = 1.70158;
        // Precomputed overshoot coefficient used by outBack.
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
} as const;

// Allows only easing names registered in eases.
export type EaseName = keyof typeof eases;

// Function type that maps a 0..1 progress value to eased progress.
export type EaseFunction = (t: number) => number;

// Input type that accepts mod.Vector or a compact coordinate tuple.
export type VectorLike = mod.Vector | readonly [number, number] | readonly [number, number, number];
