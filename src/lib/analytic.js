// 破产概率的解析近似。
//
// 保留连续首次穿越零的数学近似，作为源码中的对照。
// 与离散“余额不足下一轮额度而停止”不是同一事件；近似吻合不证明实现正确，
// 差异也不能直接归因给实现错误。主界面不混合展示这两个事件。
//
// ── 推导 ─────────────────────────────────────────────────────────────
// 把「每场收益」看成一个随机游走步长 X（单位：买入）：
//   胜：X = +(1 + U)，U ~ Uniform(0, f)，f = 方差/10
//   负：X = −(1 + U)
// 步长均值   μ = E[X] = p(1 + f/2) − (1−p)(1 + f/2) = (2p − 1)(1 + f/2)
// 二阶矩     E[X²] = (1 + f/2)² 的修正：因为 (1+U)² 的期望是 1 + f + f²/3
// 步长方差   σ² = E[X²] − μ²
//
// 当场次足够多（T 大），资金过程逼近带漂移的布朗运动，从 x₀ 出发在 [0, T] 内
// 首次穿越 0 的概率有闭式解（reflection principle）：
//
//   P(穿越) = Φ((−x₀ − μT)/(σ√T)) + exp(−2μx₀/σ²) · Φ((−x₀ + μT)/(σ√T))
//
// 其中 x₀ 以「买入个数」为单位。这是标准的带漂移布朗运动首次穿越分布。
//
// ── 适用边界 ─────────────────────────────────────────────────────────
// 需要大场次、小相对步长等逼近条件；不为所有页面参数承诺误差范围或偏差方向。

/** 标准正态 CDF，Abramowitz & Stegun 26.2.17，绝对误差 < 7.5e-8。 */
export function normalCdf(z) {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const abs = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * abs);
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const tail =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z < 0 ? tail : 1 - tail;
}

/**
 * 解析解破产概率。
 * @returns {{prob:number, x0:number, mu:number, sigma:number, drift:string}}
 */
export function ruinProbabilityAnalytic(params) {
  const { initialBankroll, buyIn, winRate, variance, sessions } = params;
  const f = variance / 10;

  const x0 = initialBankroll / buyIn; // 以买入为单位的起始资金
  const mu = (2 * winRate - 1) * (1 + f / 2); // 每场期望收益（单位：买入）

  // E[(1+U)²] = 1 + f + f²/3，因为 E[U]=f/2, E[U²]=f²/3
  const secondMoment = 1 + f + (f * f) / 3;
  const varianceStep = secondMoment - mu * mu;
  const sigma = Math.sqrt(varianceStep);
  const sigmaT = sigma * Math.sqrt(sessions);

  if (varianceStep <= 1e-15)
    return {
      prob: mu < 0 && x0 + mu * sessions <= 0 ? 1 : 0,
      x0,
      mu,
      sigma: 0,
      drift: mu < 0 ? "负漂移" : "正漂移",
    };

  const a = normalCdf((-x0 - mu * sessions) / sigmaT);
  const z = (-x0 + mu * sessions) / sigmaT;
  const logPhi =
    z < -8
      ? (-z * z) / 2 -
        Math.log(-z) -
        0.5 * Math.log(2 * Math.PI) +
        Math.log(1 - 1 / (z * z) + 3 / z ** 4 - 15 / z ** 6)
      : Math.log(normalCdf(z));
  const b = Math.exp(Math.min(0, (-2 * mu * x0) / varianceStep + logPhi));
  const prob = Math.min(1, Math.max(0, a + b));

  return {
    prob,
    x0,
    mu,
    sigma,
    drift: mu > 0 ? "正漂移（长期赢）" : mu < 0 ? "负漂移（长期输）" : "零漂移",
  };
}
