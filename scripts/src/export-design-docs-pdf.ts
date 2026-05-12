/**
 * 合并设计类 Markdown → 单份 PDF；` ```mermaid ` 块在 Headless Chrome 内由 Mermaid 渲染为 SVG 后再打印。
 *
 * 用法（仓库根目录）：
 *   pnpm docs:pdf
 *
 * 产物：doc/pdf/meal-design-documentation.pdf（默认不提交，见根目录 .gitignore）
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');

const DOC_FILES = [
  'doc/DESIGN.md',
  'doc/PROCESS.md',
  'doc/ARCHITECTURE_DIAGRAMS.md',
  'doc/LINEAR.md',
  'doc/V5_XLSM_IMPORT_RUNBOOK.md',
];

const OUT_DIR = join(REPO_ROOT, 'doc/pdf');
const OUT_PDF = join(OUT_DIR, 'meal-design-documentation.pdf');

function mermaidBlocksToDivs(md: string): string {
  return md.replace(/```mermaid\n([\s\S]*?)```/g, (_full, code: string) => {
    const body = String(code).trim();
    return `\n\n<div class="mermaid">\n${body}\n</div>\n\n`;
  });
}

function buildCombinedMarkdown(): string {
  const parts: string[] = [];
  for (const rel of DOC_FILES) {
    const abs = join(REPO_ROOT, rel);
    const text = readFileSync(abs, 'utf8');
    parts.push(`\n\n<div style="page-break-before:always"></div>\n\n`);
    parts.push(`# ${rel}\n\n`);
    parts.push(text);
  }
  return parts.join('\n');
}

function wrapHtml(bodyMarkdownHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>订餐会员管理系统 — 设计文档</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css" crossorigin="anonymous" />
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    body { box-sizing: border-box; margin: 0 auto; padding: 12px 8px 24px; max-width: 960px; }
    .markdown-body { font-size: 11pt; line-height: 1.45; }
    .markdown-body pre:not(.mermaid) { white-space: pre-wrap; word-break: break-word; }
    .mermaid { margin: 12px 0; text-align: center; page-break-inside: avoid; }
    .mermaid svg { max-width: 100% !important; height: auto !important; }
    table { page-break-inside: avoid; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js" crossorigin="anonymous"></script>
</head>
<body class="markdown-body">
${bodyMarkdownHtml}
<script>
  (async function () {
    try {
      if (typeof mermaid === 'undefined') {
        document.documentElement.setAttribute('data-mermaid', 'skip');
        return;
      }
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      });
      var nodes = document.querySelectorAll('.mermaid');
      if (nodes.length === 0) {
        document.documentElement.setAttribute('data-mermaid', 'none');
        return;
      }
      await mermaid.run({ querySelector: '.mermaid' });
      document.documentElement.setAttribute('data-mermaid', 'ok');
    } catch (e) {
      document.documentElement.setAttribute('data-mermaid', 'error');
      console.error(e);
    }
  })();
</script>
</body>
</html>`;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const mdRaw = buildCombinedMarkdown();
  const md = mermaidBlocksToDivs(mdRaw);
  marked.setOptions({ gfm: true });
  const bodyHtml = await marked.parse(md);
  const html = wrapHtml(bodyHtml);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 180_000 });

    await page
      .waitForFunction(
        `() => {
          const st = document.documentElement.getAttribute('data-mermaid');
          return st === 'ok' || st === 'none' || st === 'skip' || st === 'error';
        }`,
        { timeout: 120_000 },
      )
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 600));

    await page.pdf({
      path: OUT_PDF,
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
    });

    // eslint-disable-next-line no-console
    console.log('[docs:pdf] wrote', OUT_PDF);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
