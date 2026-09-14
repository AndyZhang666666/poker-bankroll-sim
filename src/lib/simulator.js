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
//   当前资金 < 买入金额 → 破产，之后全部记 0。
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

/**
 * 跑一条资金路径。返回长度 sessions + 1 的数组，下标 0 是起始资金。
 * 破产后余下的元素全是 0。
 */
export function simulatePath(params, rng) {
  const { initialBankroll, buyIn, winRate, variance, sessions } = params;
  const varianceFactor = variance / 10;
  const path = new Array(sessions + 1);
  path[0] = initialBankroll;

  let current = initialBankroll;
  let bust = false;
  for (let i = 1; i <= sessions; i++) {
    if (bust || current < buyIn) {
      bust = true;
      path[i] = 0;
      continue;
    }
    // 两次 rng 调用的顺序固定：先判胜负，再取波动。改顺序会让同一种子给出不同曲线。
    const isWin = rng() < winRate;
    const fluctuation = rng() * varianceFactor;
    const result = isWin ? buyIn * (1 + fluctuation) : -buyIn * (1 + fluctuation);
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
  const trials = options.trials ?? 1000;
  const seed = options.seed ?? 20260914;
  const keepPaths = options.keepPaths ?? 10;
  const rng = mulberry32(seed);

  const { sessions, targetBankroll } = params;
  const target = targetBankroll ?? params.initialBankroll * 2;

  const finals = new Array(trials);
  const drawdowns = new Array(trials);
  const bustAt = [];
  const samplePaths = [];

  // 中位数路径要逐场算，所以每一场都得攒全��� trials 的值。
  // trials=10000 × sessions=1000 = 1e7 个数，Float64 是 80MB —— 太重。
  // 用 Float32 并只在 keepPaths 之外的路径上做逐场累计，够用。
  const perSession = new Array(sessions + 1);
  for (let s = 0; s <= sessions; s++) perSession[s] = new Float32Array(trials);

  let bustCount = 0;
  let reachedCount = 0;

  for (let t = 0; t < trials; t++) {
    const path = simulatePath(params, rng);
    const final = path[sessions];
    finals[t] = final;
    drawdowns[t] = maxDrawdown(path);

    const b = bustSession(path);
    if (b !== null) {
      bustCount++;
      bustAt.push(b);
    }
    if (final >= target) reachedCount++;

    for (let s = 0; s <= sessions; s++) perSession[s][t] = path[s];
    if (t < keepPaths) samplePaths.push(path);
  }

  // 每一场的中位数 / 10% / 90% 分位数
  const medianPath = new Array(sessions + 1);
  const p10Path = new Array(sessions + 1);
  const p90Path = new Array(sessions + 1);
  for (let s = 0; s <= sessions; s++) {
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
    config: { trials, seed, keepPaths },
    bustRate: bustCount / trials,
    reachTargetRate: reachedCount / trials,
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
