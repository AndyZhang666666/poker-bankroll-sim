"use client";

import { useMemo, useState } from "react";
import ParamSlider from "./ParamSlider";
import SensitivityChart from "./SensitivityChart";
import { runMonteCarlo } from "@/lib/simulator";
import { ruinProbabilityAnalytic } from "@/lib/analytic";
import { fmtMoney, fmtPct } from "@/lib/hooks";
import type { SimParams } from "@/lib/types";
import styles from "@/styles/Simulator.module.css";

interface Props {
  params: Required<SimParams>;
  trials: number;
}

type AxisKey = "buyIn" | "winRate" | "variance" | "sessions";

const AXES: Record<AxisKey, { label: string; unit: string; range: (p: Required<SimParams>) => number[]; fmt: (v: number) => string }> = {
  buyIn: {
    label: "买入金额",
    unit: "元",
    range: (p) => {
      const step = Math.max(50, Math.round(p.initialBankroll / 40 / 50) * 50);
      const max = Math.round(p.initialBankroll / 3);
      const out: number[] = [];
      for (let v = step; v <= max; v += step) out.push(v);
      return out.slice(0, 24);
    },
    fmt: (v) => fmtMoney(v),
  },
  winRate: {
    label: "胜率",
    unit: "%",
    range: () => [0.44, 0.46, 0.48, 0.5, 0.52, 0.54, 0.56, 0.58, 0.6, 0.62, 0.64],
    fmt: (v) => `${(v * 100).toFixed(0)}%`,
  },
  variance: {
    label: "波动程度",
    unit: "",
    range: () => Array.from({ length: 20 }, (_, i) => 5 + i),
    fmt: (v) => String(v),
  },
  sessions: {
    label: "模拟场次",
    unit: "场",
    range: () => [50, 100, 200, 300, 500, 700, 1000, 1500, 2000],
    fmt: (v) => `${v}`,
  },
};

export default function RiskPanel({ params, trials }: Props) {
  const [axisKey, setAxisKey] = useState<AxisKey>("buyIn");
  const axis = AXES[axisKey];

  const values = useMemo(() => axis.range(params), [axisKey, params.initialBankroll]);

  // 每次扫描都要跑 len(values) × trials 条路径。buyIn 24 个点 × 1000 次 = 24000 条，
  // 在浏览器里大约 1 秒。为了滑条跟手，扫描次数降到 trials/2，但不少于 400。
  const sweepTrials = Math.max(400, Math.min(trials, 800));

  const rows = useMemo(() => {
    return values.map((v) => {
      const p = { ...params, [axisKey]: v };
      const mc = runMonteCarlo(p, { trials: sweepTrials, seed: 20260914, keepPaths: 0 });
      const analytic = ruinProbabilityAnalytic(p);
      return {
        v,
        bust: mc.bustRate,
        analytic: analytic.prob,
        reach: mc.reachTargetRate,
        medianFinal: mc.medianFinal,
        buyInCount: p.initialBankroll / p.buyIn,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisKey, params.initialBankroll, params.buyIn, params.winRate, params.variance, params.sessions, params.targetBankroll, sweepTrials]);

  const labels = values.map((v) => axis.fmt(v));
  const maxBust = Math.max(...rows.map((r) => r.bust), 0.01);

  const series = useMemo(
    () => [
      {
        label: "破产概率（模拟）",
        data: rows.map((r) => r.bust * 100),
        color: "#c0392b",
        fill: false,
      },
      {
        label: "破产概率（解析近似）",
        data: rows.map((r) => r.analytic * 100),
        color: "#a8721b",
        dash: true,
      },
      {
        label: "达标概率",
        data: rows.map((r) => r.reach * 100),
        color: "#2f7d4f",
      },
      {
        label: "最终资金中位数",
        data: rows.map((r) => r.medianFinal),
        color: "#2b4c7e",
        type: "bar" as const,
        axis: "y1" as const,
      },
    ],
    [rows],
  );

  // 找"破产概率首次超过 20%"和"超过 50%"的临界点 —— 这才是真正能拿去做决策的数字
  const thresholds = useMemo(() => {
    const find = (limit: number) => {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].bust >= limit && rows[i - 1].bust < limit) {
          // 线性插值，给出更精确的临界值
          const t = (limit - rows[i - 1].bust) / (rows[i].bust - rows[i - 1].bust);
          return rows[i - 1].v + t * (rows[i].v - rows[i - 1].v);
        }
      }
      return null;
    };
    return { t20: find(0.2), t50: find(0.5) };
  }, [rows]);

  const currentIdx = values.findIndex((v) => v >= (params[axisKey] as number));
  const isBuyIn = axisKey === "buyIn";

  return (
    <div className="layout" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
      <div>
        <div className="panel">
          <h2>扫哪个参数</h2>
          <div className="row wrap tight">
            {(Object.keys(AXES) as AxisKey[]).map((k) => (
              <button
                key={k}
                className={`btn seg ${axisKey === k ? "on" : ""}`}
                onClick={() => setAxisKey(k)}
              >
                {AXES[k].label}
              </button>
            ))}
          </div>
          <p className="small" style={{ marginTop: 11, marginBottom: 0 }}>
            其他参数沿用模拟器页的当前设置。每条线扫 {values.length} 个点、每点 {sweepTrials} 次模拟。
          </p>
        </div>

        <div className="panel">
          <h2>临界点</h2>
          {isBuyIn ? (
            thresholds.t20 || thresholds.t50 ? (
              <>
                <p className="small">买入金额超过以下值时，破产概率跨过这条线：</p>
                <table>
                  <tbody>
                    {thresholds.t20 !== null && (
                      <tr>
                        <td>20%</td>
                        <td className="num">
                          <b>{fmtMoney(thresholds.t20)}</b>
                        </td>
                        <td className="tiny">
                          {(params.initialBankroll / thresholds.t20).toFixed(1)} 个买入
                        </td>
                      </tr>
                    )}
                    {thresholds.t50 !== null && (
                      <tr>
                        <td>50%</td>
                        <td className="num">
                          <b>{fmtMoney(thresholds.t50)}</b>
                        </td>
                        <td className="tiny">
                          {(params.initialBankroll / thresholds.t50).toFixed(1)} 个买入
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="note">
                  这就是「20 个买入够不够」的答案所在：不是够不够，而是你想把破产概率压到多少。
                  压到 20% 以下需要 {(params.initialBankroll / (thresholds.t20 ?? params.buyIn)).toFixed(0)} 个买入，
                  压到 50% 以下需要 {(params.initialBankroll / (thresholds.t50 ?? params.buyIn)).toFixed(0)} 个。
                </div>
              </>
            ) : (
              <p className="small" style={{ marginBottom: 0 }}>
                扫过的区间里破产概率始终没到 20%，说明资金相对买入很充足。
              </p>
            )
          ) : (
            <p className="small" style={{ marginBottom: 0 }}>
              临界点只在扫「买入金额」时给出。换到买入轴去看「多少个买入才够」这个问题。
            </p>
          )}
        </div>

        <div className="panel">
          <h2>怎么读这张图</h2>
          <ul className="tight">
            <li>
              <b>红色实线</b>是模拟出来的破产概率，<b>橙色虚线</b>是布朗运动的解析近似。
              两条几乎重合 —— 这是模拟没写错的证据。
            </li>
            <li>
              <b>绿色线</b>是达标概率。它和破产概率<b>不是互补的</b>：既没破产也没达标的那部分人，
              是钱还剩着但没翻到目标。
            </li>
            <li>
              <b>蓝柱</b>是最终资金中位数（右轴）。注意它在破产率高的区域反而可能更高 ——
              因为输光的人被封在 0，活下来的人不受限制，分布被拉长了。
            </li>
          </ul>
        </div>
      </div>

      <div>
        <div className="panel">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>破产 / 达标概率 vs {axis.label}</h2>
            <span className="tiny">左轴：百分比 · 右轴：资金</span>
          </div>
          <SensitivityChart
            labels={labels}
            series={series}
            height={330}
            xTitle={axis.label}
            yTitle="概率"
            y1Title="最终资金中位数"
            ySuffix="%"
          />
        </div>

        <div className="panel">
          <h2>明细</h2>
          <table className={styles.sensTable}>
            <thead>
              <tr>
                <th>{axis.label}</th>
                {isBuyIn && <th className="num">买入个数</th>}
                <th className="num">破产率（模拟）</th>
                <th className="num">解析近似</th>
                <th className="num">达标率</th>
                <th className="barCell">破产率</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i === currentIdx ? "best" : ""}>
                  <td>{axis.fmt(r.v)}</td>
                  {isBuyIn && <td className="num">{r.buyInCount.toFixed(1)}</td>}
                  <td className="num">{fmtPct(r.bust)}</td>
                  <td className="num tiny">{fmtPct(r.analytic)}</td>
                  <td className="num">{fmtPct(r.reach)}</td>
                  <td className="barCell">
                    <div className="barTrack">
                      <i
                        style={{
                          width: `${(r.bust / maxBust) * 100}%`,
                          background: r.bust > 0.5 ? "#c0392b" : r.bust > 0.2 ? "#a8721b" : "#2f7d4f",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="note">
            标 ▸ 的那一行是你当前参数所在的档位。解析近似那一列用的是布朗运动闭式解
            （见 <span className="mono">src/lib/analytic.js</span>），和模拟的偏差来自布朗逼近本身，
            不是实现错误 —— 两者差 1~2 个百分点以内属于正常。
          </div>
        </div>
      </div>
    </div>
  );
}
