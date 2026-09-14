import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Bankroll Simulator — 德州扑克筹码管理模拟器",
  description:
    "输入起始资金、每次买入、胜率、波动程度，用蒙特卡洛模拟 N 场后的资金曲线、破产概率与达标概率。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
