"use client";
import data from "@/../results/verify.json";
import checks from "@/../results/model-check.json";
export default function AboutPanel({
  trials,
  seed,
}: {
  trials: number;
  seed: number;
}) {
  return (
    <div className="aboutLayout">
      <section className="panel">
        <h2>模型先说明白</h2>
        <p>
          单场独立地抽取胜负，再抽取均匀波动。这里的“波动程度”是幅度参数，不是经实际牌局估计的统计方差。
        </p>
        <pre className="formula">{`f = 波动程度 / 10
单场变化 = ±基础额度 × (1 + U × f)，U ∈ [0,1)
下一场余额 = max(0, 当前余额 + 单场变化)
当前余额 < 基础额度时停止；余额原样保留。`}</pre>
        <p className="small">
          本模型允许单场亏损超过一个基础额度，只在余额零处截断；因此它不是严格的“一次买入最多损失一次买入”牌桌模拟。
        </p>
        <p className="small">
          未受余额截断时，单场期望为 基础额度 × (2p−1) ×
          (1+f/2)。停止和截断会改变整条路径的统计量，不能直接乘场次数推最终收益。
        </p>
      </section>
      <section className="panel">
        <h2>三个事件，不混为一谈</h2>
        <ul className="tight">
          <li>
            停止：起始或任一场后，余额不足下一轮基础额度；不等于余额为零。
          </li>
          <li>曾经达标：包含起始时点和所有模拟时点，任一余额不低于目标。</li>
          <li>
            最终达标：最后一个时点的余额不低于目标。达到目标后不自动停止。
          </li>
          <li>
            逐场分位带是横截面的离散分位数，不是某一条路径，也不是置信区间。
          </li>
        </ul>
      </section>
      <section className="panel">
        <h2>随机性与不确定性</h2>
        <p>
          固定参数与 mulberry32 种子可复现；换种子用来观察有限抽样波动。95%
          Wilson 区间只描述随机样本的比例误差，不包含胜率估错或分布假设错误。
        </p>
        <p className="small">
          页面 {trials.toLocaleString()} 条路径，当前种子 {seed}；固定案例{" "}
          {data.config.trials.toLocaleString()} 条，种子 {data.config.seed}
          。风险扫描不储存逐场分位矩阵，并逐点计算、允许取消，不在切换页面时同步运行数万次完整轨迹排序。
        </p>
      </section>
      <section className="panel">
        <h2>验证证明什么，不证明什么</h2>
        <p>
          确定性与手算回归 {checks.summary.passed}/{checks.summary.total}{" "}
          通过。结果由当前模型版本 {data.modelVersion}{" "}
          生成；新增边界测试与真实浏览器流程另见仓库验收记录。
        </p>
        <p>
          布朗运动首次穿越零的近似仍保留在源码，供数学对照；连续穿越零与“离散余额不够下一轮额度”不是同一事件，因此不把两者吻合写作实现正确的证明，也不混进主结果图。
        </p>
        <p className="small">
          无实际玩家数据、无抽水、无玩家适应行为，不验证真实收益或建议下注额度。全部数据在浏览器本地，不上传；导出含输入、种子、结果定义和局限。
        </p>
      </section>
    </div>
  );
}
