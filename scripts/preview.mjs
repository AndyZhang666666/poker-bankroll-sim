// 本地预览 out/ 静态产物。
//
// 为什么不用 `npx serve out`：因为 basePath 是 /poker-bankroll-sim，页面里引用的资源路径是
// /poker-bankroll-sim/_next/...，而 `serve out` 把 out/ 本身当成了站点根目录，所有 _next 资源
// 都会 404 —— 症状和忘了写 .nojekyll 一模一样，很容易误判成部署问题。
//
// 这个脚本把 /poker-bankroll-sim/* 映射到 out/*，和 GitHub Pages 上的实际路径逐字一致，
// 所以本地看到的行为就是线上行为。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const PREFIX = "/poker-bankroll-sim";
const PORT = Number(process.env.PORT || 4321);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

async function tryFiles(p) {
  // 目录请求依次尝试 index.html，模拟 Pages 的 trailingSlash 行为。
  const candidates = extname(p) ? [p] : [p, join(p, "index.html")];
  for (const c of candidates) {
    try {
      const s = await stat(c);
      if (s.isFile()) return c;
    } catch {
      /* 继续试下一个 */
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  if (urlPath === "/" || urlPath === "") {
    res.writeHead(302, { Location: `${PREFIX}/` });
    return res.end();
  }

  if (!urlPath.startsWith(PREFIX)) {
    res.writeHead(404, { "Content-Type": MIME[".txt"] });
    return res.end(`404 —— 资源都在 ${PREFIX}/ 下，请访问 http://localhost:${PORT}${PREFIX}/\n`);
  }

  // 去掉前缀后拼到 out/，normalize 后校验没有越出 OUT。
  const rel = normalize(urlPath.slice(PREFIX.length)).replace(/^(\.\.[/\\])+/, "");
  const target = join(OUT, rel);

  if (!target.startsWith(OUT)) {
    res.writeHead(403);
    return res.end("403");
  }

  const file = await tryFiles(target);
  if (!file) {
    res.writeHead(404, { "Content-Type": MIME[".txt"] });
    return res.end("404 Not Found");
  }

  const body = await readFile(file);
  res.writeHead(200, {
    "Content-Type": MIME[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(body);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`预览：http://127.0.0.1:${PORT}${PREFIX}/`);
  console.log(`（路径与 GitHub Pages 一致。根路径会 302 跳过去。）`);
});
