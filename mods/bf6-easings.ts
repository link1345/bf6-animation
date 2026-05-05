export const eases = {
    linear: (t: number) => t,
    inQuad: (t: number) => t * t,
    outQuad: (t: number) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    inCubic: (t: number) => t * t * t,
    outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    outBack: (t: number) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
} as const;
export type EaseName = keyof typeof eases;
export type EaseFunction = (t: number) => number;
export type VectorLike = mod.Vector | readonly [number, number] | readonly [number, number, number];