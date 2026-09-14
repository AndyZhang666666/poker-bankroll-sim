"use client";

import { CSSProperties } from "react";
import styles from "@/styles/Simulator.module.css";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** 值的展示形式，默认原样输出 */
  format?: (v: number) => string;
  /** 滑条下方的补充说明 */
  hint?: string;
  /** 与值联动的一句判断，比如"约 20 个买入" */
  aside?: string;
  disabled?: boolean;
}

export default function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
  aside,
  disabled,
}: Props) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <label className={styles.field} style={{ "--pct": `${pct}%` } as CSSProperties}>
      <span className={styles.fieldHead}>
        <span>{label}</span>
        <b>{format ? format(value) : value}{aside ? <em>（{aside}）</em> : null}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}
