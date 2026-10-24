"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import SimulatorPanel from "@/components/SimulatorPanel";
import { DEFAULT_PARAMS, runMonteCarlo } from "@/lib/simulator";
import { BASE_SEED, DRAFT_KEY, decodeDraft, snapshot } from "@/lib/session";
import { useComputed, useTabs } from "@/lib/hooks";
import type { SimParams } from "@/lib/types";
const RiskPanel = dynamic(() => import("@/components/RiskPanel"), {
  loading: () => <p role="status">正在载入参数扫描…</p>,
});
const CasePanel = dynamic(() => import("@/components/CasePanel"), {
  loading: () => <p role="status">正在载入固定案例…</p>,
});
const AboutPanel = dynamic(() => import("@/components/AboutPanel"));
const TABS = [
  { id: "sim", label: "模拟器" },
  { id: "risk", label: "风险分析" },
  { id: "cases", label: "案例库" },
  { id: "about", label: "方法与边界" },
];
const PAGE_TRIALS = 1000;
export default function Home() {
  const { tab, go } = useTabs("sim");
  const [params, setParams] = useState<Required<SimParams>>(DEFAULT_PARAMS);
  const [seed, setSeed] = useState(BASE_SEED);
  const [restored, setRestored] = useState(false),
    [notice, setNotice] = useState("参数仅保存于当前浏览器，不上传。");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY),
        d = decodeDraft(raw);
      if (d) {
        setParams(d.params);
        setSeed(d.seed);
        setNotice("已恢复当前浏览器的参数与种子。");
      } else if (raw) {
        localStorage.removeItem(DRAFT_KEY);
        setNotice("旧草稿无法恢复，已使用默认参数。");
      }
    } catch {
      setNotice("本地存储不可用，仍可正常模拟和导出。");
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ version: 1, params, seed }),
      );
    } catch {
      setNotice("草稿保存失败，当前模拟仍可使用。");
    }
  }, [params, seed, restored]);
  const {
    value: mc,
    pending,
    error,
  } = useComputed(
    () => runMonteCarlo(params, { trials: PAGE_TRIALS, seed, keepPaths: 10 }),
    [
      params.initialBankroll,
      params.buyIn,
      params.winRate,
      params.variance,
      params.sessions,
      params.targetBankroll,
      seed,
    ],
  );
  const stale =
    !mc ||
    mc.config.seed !== seed ||
    Object.keys(params).some(
      (k) => params[k as keyof SimParams] !== mc.params[k as keyof SimParams],
    );
  const busy = pending || stale;
  const rerun = useCallback(() => setSeed((s) => (s + 1) >>> 0), []);
  const loadCase = useCallback(
    (p: Required<SimParams>) => {
      setParams(p);
      setSeed(BASE_SEED);
      go("sim");
    },
    [go],
  );
  function reset() {
    setParams({ ...DEFAULT_PARAMS });
    setSeed(BASE_SEED);
    setNotice("已恢复默认参数与种子。");
  }
  function save() {
    if (!mc || busy || error) return;
    const link = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(snapshot(mc), null, 2)], {
          type: "application/json",
        }),
      );
    link.href = url;
    link.download = "bankroll-comparison.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("已导出本组输入、种子、统计量和模型边界。");
  }
  return (
    <main className="wrap">
      <header className="top">
        <a className="back" href="https://andyzhang666666.github.io/#projects">
          ← Andy 的作品
        </a>
        <h1>Bankroll · 波动实验室</h1>
        <p className="sub">
          同样的获胜假设，为什么有人先停止，有人先达到目标？
        </p>
        <p className="meta">
          独立单场的合成模型 · 本地计算 · 固定种子可复现 ·
          不作真实资金或下注建议
        </p>
      </header>
      <nav className="tabbar" aria-label="模拟工作区">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            aria-pressed={tab === t.id}
            onClick={() => go(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="utilitybar">
        <p role="status">{notice}</p>
        <button className="btn" onClick={reset}>
          恢复默认
        </button>
        <button
          className="btn primary"
          disabled={busy || !!error}
          onClick={save}
        >
          导出本组比较
        </button>
      </div>
      {error && (
        <div className="badge-err" role="alert">
          {error} 请恢复默认重试。
        </div>
      )}
      {tab === "sim" &&
        (mc ? (
          <SimulatorPanel
            params={params}
            setParams={setParams}
            mc={mc}
            pending={busy}
            onRerun={rerun}
            trials={PAGE_TRIALS}
          />
        ) : (
          <p role="status">正在运行首组模拟…</p>
        ))}
      {tab === "risk" && <RiskPanel params={params} trials={PAGE_TRIALS} />}
      {tab === "cases" && <CasePanel onLoad={loadCase} />}
      {tab === "about" && <AboutPanel trials={PAGE_TRIALS} seed={seed} />}
      <footer>
        所有数字来自合成随机过程，不是用户实测、收益承诺或安全额度建议。
        <a href="https://github.com/AndyZhang666666/poker-bankroll-sim">
          查看模型与验证记录
        </a>{" "}
        · MIT
      </footer>
    </main>
  );
}
