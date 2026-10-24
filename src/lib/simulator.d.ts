import type { SimParams, MonteCarloOptions, MonteCarloResult } from "./types";

export const DEFAULT_PARAMS: Required<SimParams>;
export const SESSION_OPTIONS: number[];
export const MODEL_VERSION: string;
export function validateParams(params: SimParams): void;
export function stopSession(path: number[], buyIn: number): number | null;
export function proportionInterval(count: number, total: number): number[];
export function mulberry32(seed: number): () => number;
export function simulatePath(params: SimParams, rng: () => number): number[];
export function maxDrawdown(path: number[]): number;
export function bustSession(path: number[]): number | null;
export function runMonteCarlo(
  params: SimParams,
  options?: MonteCarloOptions,
): MonteCarloResult;
export function expectedSessionProfit(params: SimParams): number;
