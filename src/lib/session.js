import { DEFAULT_PARAMS, validateParams } from "./simulator.js";
export const DRAFT_KEY = "poker-bankroll:draft:v1";
export const BASE_SEED = 20260914;
export function editParam(params, key, value) {
  if (!Object.hasOwn(DEFAULT_PARAMS, key)) throw Error("未知参数。");
  const next = { ...params, [key]: value };
  if (key === "initialBankroll")
    next.targetBankroll = Math.round(
      value *
        Math.max(
          1.1,
          Math.min(5, params.targetBankroll / params.initialBankroll),
        ),
    );
  validateParams(next);
  return next;
}
export function decodeDraft(raw) {
  try {
    if (!raw || raw.length > 4000) return null;
    const d = JSON.parse(raw);
    if (
      d.version !== 1 ||
      !Number.isInteger(d.seed) ||
      d.seed < 0 ||
      d.seed > 0xffffffff
    )
      return null;
    const p = d.params;
    validateParams(p);
    if (
      p.initialBankroll < 1000 ||
      p.initialBankroll > 100000 ||
      p.buyIn < 100 ||
      p.buyIn > 5000 ||
      p.winRate < 0.45 ||
      p.winRate > 0.65 ||
      p.variance < 5 ||
      p.variance > 30 ||
      ![100, 500, 1000].includes(p.sessions) ||
      p.targetBankroll < p.initialBankroll * 1.1 ||
      p.targetBankroll > p.initialBankroll * 5
    )
      return null;
    return {
      params: Object.fromEntries(
        Object.keys(DEFAULT_PARAMS).map((k) => [k, p[k]]),
      ),
      seed: d.seed,
    };
  } catch {
    return null;
  }
}
export function snapshot(mc) {
  return {
    schemaVersion: 1,
    modelVersion: mc.modelVersion,
    params: mc.params,
    config: mc.config,
    results: {
      stopRate: mc.bustRate,
      zeroRate: mc.zeroRate,
      everReachTargetRate: mc.everReachTargetRate,
      terminalReachTargetRate: mc.reachTargetRate,
      stopInterval: mc.stopInterval,
      everReachInterval: mc.everReachInterval,
      terminalReachInterval: mc.terminalReachInterval,
      medianFinal: mc.medianFinal,
      p10Final: mc.p10Final,
      p90Final: mc.p90Final,
      medianMaxDrawdown: mc.medianMaxDrawdown,
      medianStopSession: mc.medianBustSession,
    },
    limits: [
      "仅合成模拟，不是实际扑克资金预测或下注建议。",
      "不足下一次基础额度即停止，保留剩余余额；不等于归零。",
      "达到目标后继续模拟，因此曾经达标与最终达标不同。",
      "95% Wilson 区间仅描述抽样误差，不包含胜率假设或收益分布的模型误差。",
      "独立同分布、无抽水，不包含真实玩家行为。",
    ],
  };
}
