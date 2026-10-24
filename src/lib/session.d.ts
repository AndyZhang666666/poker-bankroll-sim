import type { SimParams, MonteCarloResult } from "./types";
export const DRAFT_KEY: string;
export const BASE_SEED: number;
export function editParam(
  params: Required<SimParams>,
  key: keyof SimParams,
  value: number,
): Required<SimParams>;
export function decodeDraft(
  raw: string | null,
): { params: Required<SimParams>; seed: number } | null;
export function snapshot(mc: MonteCarloResult): object;
