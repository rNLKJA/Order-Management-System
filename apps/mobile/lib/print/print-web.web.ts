import { buildMealLabelsHtml } from './meal-label-html';
import { PrintError, type MealLabelData, type PaperWidthMm } from './types';

function waitForDocumentReady(doc: Document): Promise<void> {
  return new Promise((resolve) => {
    if (doc.readyState === 'complete') {
      resolve();
      return;
    }
    const done = () => resolve();
    doc.addEventListener('load', done, { once: true });
    window.setTimeout(done, 400);
  });
}

export async function printMealLabelsWeb(
  labels: MealLabelData[],
  paperWidthMm: PaperWidthMm,
): Promise<void> {
  if (typeof window === 'undefined' || typeof window.print !== 'function') {
    throw new PrintError('当前浏览器不支持打印，请使用 Safari 或 Chrome。', 'WEB_UNSUPPORTED');
  }
  if (labels.length === 0) return;

  const html = buildMealLabelsHtml(labels, paperWidthMm);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!win || !doc) {
    document.body.removeChild(iframe);
    throw new PrintError('无法创建打印页面。', 'PRINT_FAILED');
  }

  doc.open();
  doc.write(html);
  doc.close();
  await waitForDocumentReady(doc);

  try {
    win.focus();
    win.print();
  } finally {
    window.setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 1500);
  }
}
