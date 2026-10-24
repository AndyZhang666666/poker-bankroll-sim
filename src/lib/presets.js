// 三个预设场景（任务书第 8 节）。页面和校验脚本共用，保证案例库里的参数
// 和 results/ 里的数字对得上。
export const PRESET_CASES = [
  {
    id: "case1_conservative",
    name: "保守型",
    tag: "conservative",
    buyInRatio: 0.025,
    params: {
      initialBankroll: 20000,
      buyIn: 500,
      winRate: 0.53,
      variance: 8,
      sessions: 500,
      targetBankroll: 30000,
    },
    comment:
      "较高的起始额度比搭配较低波动。即使停止比例低，也不能用它证明真实牌局安全；输入假设并未经过真实数据校准。",
  },
  {
    id: "case2_balanced",
    name: "平衡型",
    tag: "balanced",
    buyInRatio: 0.05,
    params: {
      initialBankroll: 10000,
      buyIn: 500,
      winRate: 0.52,
      variance: 10,
      sessions: 500,
      targetBankroll: 20000,
    },
    comment:
      "起始余额相当于 20 个基础额度。重点比较曾经达到目标与最终仍达标的差距，而不是把一个经验倍数当作安全保证。",
  },
  {
    id: "case3_aggressive",
    name: "激进型",
    tag: "aggressive",
    buyInRatio: 0.1,
    params: {
      initialBankroll: 5000,
      buyIn: 500,
      winRate: 0.54,
      variance: 15,
      sessions: 500,
      targetBankroll: 15000,
    },
    comment:
      "较低的额度比、更高的获胜假设与更大波动同时改变。先用这组参数观察分布，再到风险分析一次只改一个变量，避免把结果归因给单个因素。",
  },
];
