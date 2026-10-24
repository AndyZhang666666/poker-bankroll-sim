// 筹码管理模拟器的核心。
//
// 这个文件刻意写成纯 JS（不是 .ts）：页面（浏览器，经 Next 编译）和校验脚本
// （Node 直接 import）共用同一份代码。Node 22 原生不认 .ts，拆两份就会出现
// 「README 引用的数字」和「页面跑出来的数字」不同源的问题。类型在 simulator.d.ts。
//
// ── 单场收益（任务书 4.1 的简化模型）────────────────────────────────
//   单场收益 = (rand() < 胜率) ? +买入 × (1 + rand() × 方差因子)
//                             : −买入 × (1 + rand() × 方差因子)
//   方差因子 = 方差 / 10
// rand() 是 [0,1) 均匀分布。真实扑克收益是长尾偏态的，这里不追求真实分布，
// 只要能展示「资金曲线 + 破产概率」怎么随参数变就够了。
//
// ── 破产判定 ─────────────────────────────────────────────────────────
//   当前资金 < 买入金额 → 停止；剩余余额保留，不凭空归零。
//   注意是「不够下一次买入」就算破产，不是「资金归零」——手里剩 300 但买入要 500，
//   在牌桌上就是没得打了。
//
// ── 随机数 ───────────────────────────────────────────────────────────
//   mulberry32 种子随机。同一个种子跑出来的曲线完全一样，所以：
//   · 校验脚本用固定种子 → results/ 里的数字可复现
//   · 页面每点一次「重新模拟」换一个种子 → 用户能看到不同的随机路径
//   Math.random() 做不到前一条。

/** mulberry32：32 位状态，够快，够均匀，种子一样序列就一样。 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_PARAMS = {
  initialBankroll: 10000,
  buyIn: 500,
  winRate: 0.52,
  variance: 10,
  sessions: 500,
  targetBankroll: 20000,
};

export const SESSION_OPTIONS = [100, 500, 1000];
export const MODEL_VERSION = "retained-balance-v2-2026-10-24";

export function validateParams(params) {
  if (!params || typeof params !== "object") throw Error("缺少模拟参数。");
  for (const k of ["initialBankroll", "buyIn"])
    if (!Number.isFinite(params[k]) || params[k] <= 0 || params[k] > 1e9)
      throw Error("资金和基础额度须为 0–10 亿之间的正数。");
  if (
    !Number.isFinite(params.winRate) ||
    params.winRate < 0 ||
    params.winRate > 1
  )
    throw Error("胜率须在 0–1 之间。");
  if (
    !Number.isFinite(params.variance) ||
    params.variance < 0 ||
    params.variance > 100
  )
    throw Error("波动参数须在 0–100 之间。");
  if (
    !Number.isInteger(params.sessions) ||
    params.sessions < 1 ||
    params.sessions > 2000
  )
    throw Error("场次数须为 1–2000 的整数。");
  if (
    params.targetBankroll !== undefined &&
    (!Number.isFinite(params.targetBankroll) ||
      params.targetBankroll <= 0 ||
      params.targetBankroll > 5e9)
  )
    throw Error("目标须为有效正数。");
}

/**
 * 跑一条资金路径。返回长度 sessions + 1 的数组，下标 0 是起始资金。
 * 不够基础额度时停止，之后余额维持不变。
 */
export function simulatePath(params, rng) {
  validateParams(params);
  const { initialBankroll, buyIn, winRate, variance, sessions } = params;
  const varianceFactor = variance / 10;
  const path = new Array(sessions + 1);
  path[0] = initialBankroll;

  let current = initialBankroll;
  let bust = false;
  for (let i = 1; i <= sessions; i++) {
    if (bust || current < buyIn) {
      bust = true;
      path[i] = current;
      continue;
    }
    // 两次 rng 调用的顺序固定：先判胜负，再取波动。改顺序会让同一种子给出不同曲线。
    const isWin = rng() < winRate;
    const fluctuation = rng() * varianceFactor;
    const result = isWin
      ? buyIn * (1 + fluctuation)
      : -buyIn * (1 + fluctuation);
    current = Math.max(0, current + result);
    path[i] = current;
  }
  return path;
}

/** 一条路径的最大回撤（峰值到之后谷底的最大跌幅比例，0~1）。 */
export function maxDrawdown(path) {
  let peak = path[0];
  let worst = 0;
  for (let i = 1; i < path.length; i++) {
    const v = path[i];
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      if (dd > worst) worst = dd;
    }
  }
  return worst;
}

/** 路径首次变成 0 的场次（1-based）；没破产返回 null。 */
export function bustSession(path) {
  for (let i = 1; i < path.length; i++) {
    if (path[i] === 0) return i;
  }
  return null;
}

/** 首次不够下一轮基础额度；起始已不足返回 0。与余额为零分开。 */
export function stopSession(path, buyIn) {
  return path.findIndex((v) => v < buyIn) < 0
    ? null
    : path.findIndex((v) => v < buyIn);
}

/** Wilson 95% 区间，只描述有限随机样本误差，不包含模型误差。 */
export function proportionInterval(count, total) {
  if (
    !Number.isInteger(total) ||
    total < 1 ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > total
  )
    throw Error("无效的样本计数。");
  const z = 1.959963984540054,
    p = count / total,
    d = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / d,
    half =
      (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
      d;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

function median(sorted) {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * 蒙特卡洛主入口。
 *
 * @param params  见 DEFAULT_PARAMS
 * @param options.trials    跑多少条路径（页面默认 1000，校验脚本 10000）
 * @param options.seed      随机种子
 * @param options.keepPaths 保留前 N 条完整路径给图表画（其余只留统计量，省内存）
 */
export function runMonteCarlo(params, options = {}) {
  validateParams(params);
  const trials = options.trials ?? 1000;
  const seed = options.seed ?? 20260914;
  const keepPaths = options.keepPaths ?? Math.min(10, trials);
  const trajectories = options.trajectories ?? true;
  if (
    !Number.isInteger(trials) ||
    trials < 1 ||
    trials > 10000 ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isInteger(keepPaths) ||
    keepPaths < 0 ||
    keepPaths > trials ||
    typeof trajectories !== "boolean"
  )
    throw Error("无效的模拟次数、种子或路径设置。");
  const rng = mulberry32(seed);

  const { sessions, targetBankroll } = params;
  const target = targetBankroll ?? params.initialBankroll * 2;

  const finals = new Array(trials);
  const drawdowns = new Array(trials);
  const bustAt = [];
  const samplePaths = [];

  // 需要曲线时才攒逐场样本。参数扫描和案例摘要不分配这个矩阵。
  // trials=10000 × sessions=1000 = 1e7 个数，Float64 是 80MB —— 太重。
  // 用 Float32 并只在 keepPaths 之外的路径上做逐场累计，够用。
  const perSession = trajectories
    ? Array.from({ length: sessions + 1 }, () => new Float64Array(trials))
    : null;

  let bustCount = 0;
  let reachedCount = 0;
  let everReachedCount = 0;
  let zeroCount = 0;

  for (let t = 0; t < trials; t++) {
    const path = simulatePath(params, rng);
    const final = path[sessions];
    finals[t] = final;
    drawdowns[t] = maxDrawdown(path);

    const b = stopSession(path, params.buyIn);
    if (b !== null) {
      bustCount++;
      bustAt.push(b);
    }
    if (final >= target) reachedCount++;
    if (path.some((v) => v >= target)) everReachedCount++;
    if (final === 0) zeroCount++;

    if (perSession)
      for (let s = 0; s <= sessions; s++) perSession[s][t] = path[s];
    if (t < keepPaths) samplePaths.push(path);
  }

  // 每一场的中位数 / 10% / 90% 分位数
  const medianPath = [],
    p10Path = [],
    p90Path = [];
  for (let s = 0; perSession && s <= sessions; s++) {
    const arr = Array.from(perSession[s]).sort((a, b) => a - b);
    medianPath[s] = median(arr);
    p10Path[s] = quantile(arr, 0.1);
    p90Path[s] = quantile(arr, 0.9);
  }

  const sortedFinals = finals.slice().sort((a, b) => a - b);
  const sortedDD = drawdowns.slice().sort((a, b) => a - b);
  const sortedBust = bustAt.slice().sort((a, b) => a - b);

  return {
    params: { ...params, targetBankroll: target },
    config: { trials, seed, keepPaths, trajectories },
    modelVersion: MODEL_VERSION,
    bustRate: bustCount / trials,
    reachTargetRate: reachedCount / trials,
    everReachTargetRate: everReachedCount / trials,
    zeroRate: zeroCount / trials,
    stopInterval: proportionInterval(bustCount, trials),
    everReachInterval: proportionInterval(everReachedCount, trials),
    terminalReachInterval: proportionInterval(reachedCount, trials),
    // 最大回撤取所有路径的中位数：单条路径的回撤是随机的，中位数才代表"通常会经历多深的坑"
    medianMaxDrawdown: median(sortedDD),
    p90MaxDrawdown: quantile(sortedDD, 0.9),
    // 只看破产路径
    medianBustSession: median(sortedBust),
    bustCount,
    medianFinal: median(sortedFinals),
    meanFinal: finals.reduce((a, b) => a + b, 0) / trials,
    p10Final: quantile(sortedFinals, 0.1),
    p90Final: quantile(sortedFinals, 0.9),
    medianPath,
    p10Path,
    p90Path,
    samplePaths,
  };
}

/**
 * 单场收益的期望值（解析解），用来做手算校验和给「关于」页解释。
 *   E[收益] = 买入 × [ p × (1 + f/2) − (1−p) × (1 + f/2) ] = 买入 × (2p − 1) × (1 + f/2)
 * 其中 f = 方差因子，rand() 的期望是 1/2。
 */
export function expectedSessionProfit(params) {
  const f = params.variance / 10;
  return params.buyIn * (2 * params.winRate - 1) * (1 + f / 2);
}
