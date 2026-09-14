"use client";

import verifyData from "@/../results/verify.json";
import checkData from "@/../results/model-check.json";
import { fmtMoney } from "@/lib/hooks";
import styles from "@/styles/Simulator.module.css";

interface Props {
  trials: number;
  seed: number;
}

export default function AboutPanel({ trials, seed }: Props) {
  const v = verifyData as unknown as {
    config: { trials: number; seed: number };
    cases: Array<{
      id: string;
      name: string;
      buyInCount: number;
      bustRatePct: number;
      bustRateAnalyticPct: number;
      bustRateDiffPctPoints: number;
      reachTargetRatePct: number;
      medianMaxDrawdownPct: number;
      medianBustSession: number | null;
      medianFinal: number;
      p10Final: number;
      p90Final: number;
    }>;
    sensitivity: {
      buyIn: Array<{ buyIn: number; buyInCount: number; bustRatePct: number; medianFinal: number }>;
      winRate: Array<{ winRatePct: number; bustRatePct: number; medianFinal: number }>;
    };
    elapsedMs: number;
  };

  const c = checkData as unknown as { summary: { total: number; passed: number } };

  return (
    <div className="layout" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      <div>
        <div className="panel">
          <h2>算法</h2>
          <p className="small">每场的结果用简化模型，不追求真实扑克收益分布：</p>
          <div className="formula">{`单场收益 = 赢 ?  +买入 × (1 + rand() × f)
                : −买入 × (1 + rand() × f)

f = 波动程度 / 10     rand() ∈ [0, 1) 均匀分布

资金递推：  B(t+1) = max(0, B(t) + 单场收益)
破产判定：  B(t) < 买入  →  后面全部记 0`}</div>
          <ul className="tight">
            <li>
              <b>破产是「不够下一次买入」</b>，不是「余额归零」。手里剩 300 但买入要 500，
              在牌桌上就是没得打了 —— 这个差别会让破产率高出几个百分点。
            </li>
            <li>
              <b>每场期望收益</b>的解析形式：买入 × (2p − 1) × (1 + f/2)。
              胜率 50% 时期望正好为 0 —— 这才是「打平」的定义，不管波动多大。
            </li>
            <li>
              <b>随机数是种子随机</b>（mulberry32），不是 Math.random。
              同一种子跑出的曲线完全一致，所以 <span className="mono">results/</span> 里的数字可复现；
              页面上点「重新模拟」会换种子，让你看到不同的随机路径。
            </li>
          </ul>
        </div>

        <div className="panel">
          <h2>破产概率的解析近似</h2>
          <p className="small">
            蒙特卡洛自己证明不了自己对。所以额外实现了一份闭式解做交叉核对：把每场收益看成随机游走步长，
            场次足够多时逼近带漂移的布朗运动，从 x₀ 出发在 T 场内首次穿越 0 的概率有解析形式：
          </p>
          <div className="formula">{`P = Φ((−x₀ − μT)/(σ√T)) + e^(−2μx₀/σ²) · Φ((−x₀ + μT)/(σ√T))

μ = (2p − 1)(1 + f/2)         每场期望收益（单位：买入）
σ² = (1 + f + f²/3) − μ²      每场收益的方差
x₀ = 起始资金 / 买入           以买入为单位的起始资金`}</div>
          <p className="small" style={{ marginBottom: 0 }}>
            代码见 <span className="mono">src/lib/analytic.js</span>。两条完全不同的路径
            （数值模拟 vs 闭式公式）若给出同一结果，才说明模拟可信。
          </p>
        </div>

        <div className="panel">
          <h2>校验</h2>
          <p className="small">
            手算校验 <b>{c.summary.passed}/{c.summary.total}</b> 通过（
            <span className="mono">results/model-check.json</span>）。
            极端用例包括：胜率 100% + 波动 0 → 100 场后恰好 60000 且回撤为 0；
            胜率 0% + 波动 0 + 20 个买入 → 第 20 场精确归零；同种子两次结果逐位一致。
          </p>
          <table style={{ marginTop: 11 }}>
            <thead>
              <tr>
                <th>场景</th>
                <th className="num">模拟破产率</th>
                <th className="num">解析近似</th>
                <th className="num">差</th>
              </tr>
            </thead>
            <tbody>
              {v.cases.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="num">{r.bustRatePct}%</td>
                  <td className="num">{r.bustRateAnalyticPct}%</td>
                  <td className="num tiny">{r.bustRateDiffPctPoints} pp</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="note">
            三场景的模拟值与解析值相差 {Math.max(...v.cases.map((r) => r.bustRateDiffPctPoints))} 个百分点以内。
            误差主要来自布朗逼近本身（真实过程是离散跳跃，不是连续扩散），不是实现问题。
          </div>
        </div>
      </div>

      <div>
        <div className="panel">
          <h2>三场景汇总（{v.config.trials.toLocaleString()} 次模拟，种子 {v.config.seed}）</h2>
          <table>
            <thead>
              <tr>
                <th>场景</th>
                <th className="num">买入数</th>
                <th className="num">破产率</th>
                <th className="num">达标率</th>
                <th className="num">回撤中位数</th>
              </tr>
            </thead>
            <tbody>
              {v.cases.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="num">{r.buyInCount}</td>
                  <td className="num">{r.bustRatePct}%</td>
                  <td className="num">{r.reachTargetRatePct}%</td>
                  <td className="num">{r.medianMaxDrawdownPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny" style={{ marginTop: 9, marginBottom: 0 }}>
            完整数据（含分位数、破产场次中位数）见 <span className="mono">results/verify.json</span>。
          </p>
        </div>

        <div className="panel">
          <h2>买入金额敏感性（平衡型：10000 起始 / 52% 胜率 / 波动 10）</h2>
          <table>
            <thead>
              <tr>
                <th className="num">买入</th>
                <th className="num">个数</th>
                <th className="num">破产率</th>
                <th className="num">最终资金中位数</th>
              </tr>
            </thead>
            <tbody>
              {v.sensitivity.buyIn.map((r) => (
                <tr key={r.buyIn} className={r.buyIn === 500 ? "best" : ""}>
                  <td className="num">{fmtMoney(r.buyIn)}</td>
                  <td className="num">{r.buyInCount}</td>
                  <td className="num">{r.bustRatePct}%</td>
                  <td className="num">{fmtMoney(r.medianFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="note warn">
            这张表是「20 个买入够不够」的答案：买入从 250（40 个）加到 1000（10 个），
            破产率从 {v.sensitivity.buyIn[0].bustRatePct}% 涨到{" "}
            {v.sensitivity.buyIn[v.sensitivity.buyIn.length - 1].bustRatePct}% ——
            但最终资金中位数几乎没变好。减少买入金额降低的是破产风险，不是提高收益。
          </div>
        </div>

        <div className="panel">
          <h2>胜率敏感性</h2>
          <table>
            <thead>
              <tr>
                <th className="num">胜率</th>
                <th className="num">破产率</th>
                <th className="num">最终资金中位数</th>
              </tr>
            </thead>
            <tbody>
              {v.sensitivity.winRate.map((r) => (
                <tr key={r.winRatePct} className={r.winRatePct === 52 ? "best" : ""}>
                  <td className="num">{r.winRatePct}%</td>
                  <td className="num">{r.bustRatePct}%</td>
                  <td className="num">{fmtMoney(r.medianFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="note">
            胜率从 52% 掉到 50%，破产率从 {v.sensitivity.winRate[2].bustRatePct}% 跳到{" "}
            {v.sensitivity.winRate[1].bustRatePct}%。<b>两个百分点的胜率差，翻了一倍的风险。</b>
            而 52% → 55% 能把破产率降到 {v.sensitivity.winRate[3].bustRatePct}%。
            资金管理的杠杆点在这里，不在买入金额上。
          </div>
        </div>

        <div className="panel">
          <h2>运行参数</h2>
          <ul className="tight" style={{ marginBottom: 0 }}>
            <li>页面每次模拟：{trials.toLocaleString()} 条路径，种子 {seed}</li>
            <li>
              校验脚本：{v.config.trials.toLocaleString()} 条路径，种子 {v.config.seed}，耗时{" "}
              {(v.elapsedMs / 1000).toFixed(1)}s
            </li>
            <li>全部计算在浏览器本地完成，不上传任何数据，不连服务端</li>
          </ul>
        </div>

        <div className="panel">
          <h2>已知局限</h2>
          <ul className="tight" style={{ marginBottom: 0 }}>
            <li>
              <b>收益分布是简化的</b>：真实扑克的单场结果是长尾偏态的（偶尔一个巨大的锅），
              这里用「固定买入 ± 均匀波动」代替。定性结论（资金越薄越容易破产）成立，具体数字不能当预测。
            </li>
            <li>
              <b>不考虑抽水（rake）</b>：真实牌局每锅抽 5% 左右，会系统性降低胜率的有效值。
              如果你的胜率是「含抽水后的真实胜率」，那这个模型没问题；otherwise 要自己往下调。
            </li>
            <li>
              <b>不做资金层级调整</b>：真实玩家赢了会升级别（打更大的局），这里假设买入金额恒定。
            </li>
            <li>
              <b>场次之间独立</b>：不考虑疲劳、情绪（tilt）、对手适应等会让实际表现变差的因素。
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
