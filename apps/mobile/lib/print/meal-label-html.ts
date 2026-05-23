import { DEFAULT_SHOP_NAME, type MealLabelData, type PaperWidthMm } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function labelBlock(label: MealLabelData): string {
  const tags =
    label.tags.length > 0
      ? `<div class="tags">${label.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>`
      : '';
  const dietary = label.dietaryNotes
    ? `<div class="note">忌口：${escapeHtml(label.dietaryNotes)}</div>`
    : '';
  const notes = label.orderNotes
    ? `<div class="note">备注：${escapeHtml(label.orderNotes)}</div>`
    : '';

  return `
    <section class="label">
      <div class="shop">${escapeHtml(label.shopName)}</div>
      <div class="rule"></div>
      <div class="meal">${escapeHtml(label.mealTypeLabel)}</div>
      <div class="main">${escapeHtml(label.customerName)} · ${label.quantity} 份</div>
      ${tags}
      ${dietary}
      ${notes}
      <div class="footer">#${label.orderId} · ${escapeHtml(label.orderDate)}</div>
    </section>
  `;
}

export function buildMealLabelsHtml(labels: MealLabelData[], paperWidthMm: PaperWidthMm): string {
  const width = paperWidthMm === 80 ? '80mm' : '58mm';
  const body = labels.map(labelBlock).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${paperWidthMm === 80 ? 80 : 58}, initial-scale=1" />
  <title>餐盒标签</title>
  <style>
    @page {
      size: ${width} auto;
      margin: 1.5mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
      color: #111;
    }
    .label {
      width: ${width};
      max-width: ${width};
      padding: 2mm 1.5mm 3mm;
      page-break-after: always;
      break-after: page;
    }
    .label:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .shop {
      text-align: center;
      font-size: 11pt;
      font-weight: 700;
      line-height: 1.3;
    }
    .rule {
      height: 1px;
      background: #333;
      margin: 2mm 0;
    }
    .meal {
      text-align: center;
      font-size: 16pt;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 1mm;
    }
    .main {
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      line-height: 1.35;
      margin-bottom: 1mm;
    }
    .tags {
      text-align: center;
      font-size: 10pt;
      font-weight: 600;
      color: #007aff;
      margin-bottom: 1mm;
    }
    .tags span + span::before {
      content: " · ";
      color: #666;
    }
    .note {
      font-size: 10pt;
      line-height: 1.4;
      color: #8a5a00;
      word-break: break-word;
    }
    .footer {
      text-align: center;
      font-size: 9pt;
      color: #666;
      margin-top: 2mm;
    }
    @media screen {
      body { padding: 8px; }
      .label {
        border: 1px dashed #ccc;
        margin-bottom: 8px;
      }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function buildTestLabelData(shopName = DEFAULT_SHOP_NAME): MealLabelData {
  return {
    shopName: shopName.trim() || DEFAULT_SHOP_NAME,
    customerName: '测试客户',
    mealTypeLabel: '午餐',
    quantity: 1,
    tags: ['院内', '测试'],
    dietaryNotes: '少盐少油（测试）',
    orderNotes: null,
    orderId: 0,
    orderDate: new Date().toISOString().slice(0, 10),
  };
}
