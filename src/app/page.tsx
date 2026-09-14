"use client";

import { useCallback, useMemo, useState } from "react";
import SimulatorPanel from "@/components/SimulatorPanel";
import RiskPanel from "@/components/RiskPanel";
import CasePanel from "@/components/CasePanel";
import AboutPanel from "@/components/AboutPanel";
import { DEFAULT_PARAMS, runMonteCarlo } from "@/lib/simulator";
import { useComputed, useTabs } from "@/lib/hooks";
import type { SimParams } from "@/lib/types";

const TABS = [
  { id: "sim", label: "模拟器" },
  { id: "risk", label: "风险分析" },
  { id: "cases", label: "案例库" },
  { id: "about", label: "关于" },
];

/** 页面每次读数跑 1000 条路径；1000 次在浏览器里约 50ms，拖滑条不会卡。 */
const PAGE_TRIALS = 1000;
const BASE_SEED = 20260914;

/** 任务书第 8 节给的「预期结果」区间，用来在案例库里对照实际数字。 */
const EXPECTATIONS: Record<string, { bustRange: [number, number]; reachRange: [number, number] }> = {
  case1_conservative: { bustRange: [0, 0.05], reachRange: [0.3, 0.4] },
  case2_balanced: { bustRange: [0.1, 0.15], reachRange: [0.4, 0.5] },
  case3_aggressive: { bustRange: [0.2, 0.3], reachRange: [0.5, 0.6] },
};

export default function Home() {
  const { tab, go } = useTabs("sim");
  const [params, setParams] = useState<Required<SimParams>>(DEFAULT_PARAMS as Required<SimParams>);
  // 手动点「重新模拟」会换种子，让用户看到另一组随机路径
  const [seed, setSeed] = useState(BASE_SEED);

  const { value: mc, pending } = useComputed(
    () => runMonteCarlo(params, { trials: PAGE_TRIALS, seed, keepPaths: 10 }),
    [params.initialBankroll, params.buyIn, params.winRate, params.variance, params.sessions, params.targetBankroll, seed],
  );

  const rerun = useCallback(() => setSeed((s) => s + 1), []);

  const loadCase = useCallback(
    (p: Required<SimParams>) => {
      setParams(p);
      go("sim");
    },
    [go],
  );

  const target = params.targetBankroll;
  const ratio = target / params.initialBankroll;

  return (
    <div className="wrap">
      <header className="top">
        <h1>Poker Bankroll Simulator</h1>
        <p className="sub">
          德州扑克筹码管理模拟器 —— 回答一个问题：<b>这么打，多久会破产？</b>
        </p>
        <div className="meta">
          全部计算在浏览器本地完成，不连服务端 · 算法见{" "}
          <span className="mono">src/lib/simulator.js</span> · 校验产物在{" "}
          <span className="mono">results/</span>
        </div>
      </header>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "sim" && mc && (
        <>
          <div
            className="panel"
            style={{ padding: "11px 15px", marginBottom: 15, background: "#faf9f7" }}
          >
            <span className="small">
              当前参数：起始 <b>{params.initialBankroll.toLocaleString()}</b> · 每次买入{" "}
              <b>{params.buyIn.toLocaleString()}</b>（
              {(params.initialBankroll / params.buyIn).toFixed(1)} 个） · 胜率{" "}
              <b>{(params.winRate * 100).toFixed(0)}%</b> · 波动{" "}
              <b>{params.variance}</b> · <b>{params.sessions}</b> 场 · 目标{" "}
              <b>{target.toLocaleString()}</b>（{ratio.toFixed(1)}×）
            </span>
          </div>
          <SimulatorPanel
            params={params}
            setParams={setParams}
            mc={mc}
            pending={pending}
            onRerun={rerun}
            trials={PAGE_TRIALS}
          />
        </>
      )}
      {tab === "sim" && !mc && <div className="panel">正在跑首次模拟…</div>}

      {tab === "risk" && <RiskPanel params={params} trials={PAGE_TRIALS} />}

      {tab === "cases" && <CasePanel onLoad={loadCase} expectations={EXPECTATIONS} />}

      {tab === "about" && <AboutPanel trials={PAGE_TRIALS} seed={seed} />}

      <footer>
        <p>
          <b>它解决什么问题</b>：网上说「带 20 个买入」，但没人告诉你 20 个到底够不够、
          破产概率多少、这个概率对胜率和波动有多敏感。这个工具把这些问题变成一个可以拖参数的模拟器。
        </p>
        <p>
          本质是「用户生命周期 + 风险管理」的建模：把留存曲线换成资金曲线，把流失率换成破产概率，
          和 <a href="https://github.com/AndyZhang666666/pricing-model-sim">pricing-model-sim</a>{" "}
          是同一套思路。模拟是简化的，看趋势可以，别当财务预测。
        </p>
        <p className="tiny">
          MIT License · 全部数据为合成模拟结果，生成规则见{" "}
          <span className="mono">README.md</span>
        </p>
      </footer>
    </div>
  );
}
