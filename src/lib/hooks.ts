"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// 拖滑条时不能每动一像素就跑一次 1000 条路径的蒙特卡洛 —— 主线程会卡死。
// 做法：参数立刻更新（滑条要跟手），模拟延迟 180ms 再跑；期间显示上一帧结果，
// 所以视觉上是连续的，用户不会看到空白。
export function useDebounced<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** 把昂贵的计算放在 debounce 之后，并给出"正在重算"的状态。 */
export function useComputed<T>(compute: () => T, deps: unknown[], delay = 180) {
  const [state, setState] = useState<{
    value: T | null;
    pending: boolean;
    error: string | null;
  }>({
    value: null,
    pending: true,
    error: null,
  });
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      // 首屏同步跑一次，别让用户看到 loading
      first.current = false;
      try {
        setState({ value: compute(), pending: false, error: null });
      } catch (e) {
        setState({
          value: null,
          pending: false,
          error: e instanceof Error ? e.message : "计算失败，请恢复默认重试。",
        });
      }
      return;
    }
    setState((s) => ({ ...s, pending: true }));
    const id = setTimeout(() => {
      try {
        setState({ value: compute(), pending: false, error: null });
      } catch (e) {
        setState((s) => ({
          ...s,
          pending: false,
          error: e instanceof Error ? e.message : "计算失败，请恢复默认重试。",
        }));
      }
    }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export function useTabs(initial: string) {
  const [tab, setTab] = useState(initial);
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      setTab(["sim", "risk", "cases", "about"].includes(h) ? h : initial);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = useCallback((id: string) => {
    if (!["sim", "risk", "cases", "about"].includes(id)) return;
    setTab(id);
    if (typeof window !== "undefined")
      window.history.replaceState(null, "", `#${id}`);
  }, []);
  return { tab, go };
}

export const fmtMoney = (v: number) => Math.round(v).toLocaleString("zh-CN");
export const fmtPct = (v: number, digits = 1) =>
  `${(v * 100).toFixed(digits)}%`;
