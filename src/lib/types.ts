export interface SimParams {
  /** 起始资金 */
  initialBankroll: number;
  /** 每次买入金额，与起始资金同单位 */
  buyIn: number;
  /** 单场胜率，0~1 */
  winRate: number;
  /** 波动程度，5~30，方差因子 = variance / 10 */
  variance: number;
  /** 模拟场次 */
  sessions: number;
  /** 目标资金；缺省为起始资金 × 2 */
  targetBankroll?: number;
}

export interface MonteCarloOptions {
  trials?: number;
  seed?: number;
  keepPaths?: number;
}

export interface MonteCarloResult {
  params: Required<SimParams>;
  config: Required<MonteCarloOptions>;
  bustRate: number;
  reachTargetRate: number;
  medianMaxDrawdown: number;
  p90MaxDrawdown: number;
  medianBustSession: number | null;
  bustCount: number;
  medianFinal: number;
  meanFinal: number;
  p10Final: number;
  p90Final: number;
  medianPath: number[];
  p10Path: number[];
  p90Path: number[];
  samplePaths: number[][];
}

export interface PresetCase {
  id: string;
  name: string;
  tag: "conservative" | "balanced" | "aggressive";
  params: Required<SimParams>;
  /** 买入占起始资金的比例，展示用 */
  buyInRatio: number;
  comment: string;
}
