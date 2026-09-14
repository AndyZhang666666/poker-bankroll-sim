// 构建后在 out/ 写一个空的 .nojekyll。
// GitHub Pages 默认走 Jekyll，Jekyll 忽略所有下划线开头的目录 —— Next.js 的产物全在
// out/_next/ 下。没有这个文件，页面能打开但样式脚本全 404，看起来像白板。
// 放在构建脚本里而不是只在 CI 里 touch，是为了让本地 `npm run preview` 和线上走同一条路径。
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "out");
if (!existsSync(out)) mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, ".nojekyll"), "");
console.log("postbuild: 已写入 out/.nojekyll");
