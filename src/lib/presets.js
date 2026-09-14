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
    comment: "40 个买入，胜率 53%，波动偏低。破产几乎不可能，代价是资金增长慢、达标要靠场次堆。",
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
    comment: "20 个买入 —— 就是网上那条经验规则。这个模拟器主要想回答的就是它到底够不够。",
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
    comment: "只有 10 个买入，靠更高的胜率硬扛更大的波动。翻三倍和归零都不稀奇。",
  },
];
