import { clamp, hexToRgb, pickTextColor } from '../utils.js';

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = clamp(r, 0, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function notchedRectPath(ctx, x, y, w, h, notch) {
  const n = clamp(notch, 0, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + n, y);
  ctx.lineTo(x + w - n, y);
  ctx.lineTo(x + w, y + n);
  ctx.lineTo(x + w, y + h - n);
  ctx.lineTo(x + w - n, y + h);
  ctx.lineTo(x + n, y + h);
  ctx.lineTo(x, y + h - n);
  ctx.lineTo(x, y + n);
  ctx.closePath();
}

function makeLinearGradient(ctx, x, y, w, h, c1, c2, angleDeg) {
  const a = (Number(angleDeg || 0) % 360) * (Math.PI / 180);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const len = Math.max(w, h) * 0.75;
  const x0 = cx - dx * len;
  const y0 = cy - dy * len;
  const x1 = cx + dx * len;
  const y1 = cy + dy * len;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

function isInFinder(r, c, count) {
  const inTL = r >= 0 && r < 7 && c >= 0 && c < 7;
  const inTR = r >= 0 && r < 7 && c >= count - 7 && c < count;
  const inBL = r >= count - 7 && r < count && c >= 0 && c < 7;
  return inTL || inTR || inBL;
}

function drawFinder(ctx, x, y, m, eyeStyle, fillStyle, bgStyle) {
  const outer = 7 * m;
  const inner1 = 5 * m;
  const inner2 = 3 * m;
  const isDot = eyeStyle === 'dot';
  const isRing = eyeStyle === 'ring';
  const isOrbit = eyeStyle === 'orbit';
  const isNotched = eyeStyle === 'notched';
  const isDouble = eyeStyle === 'double';
  const rOuter = eyeStyle === 'rounded' ? Math.max(2, Math.floor(m * 1.4)) : 0;
  const rInner = eyeStyle === 'rounded' ? Math.max(2, Math.floor(m * 1.0)) : 0;

  ctx.save();
  if (isDot) {
    const cx = x + outer / 2;
    const cy = y + outer / 2;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.arc(cx, cy, outer / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bgStyle;
    ctx.beginPath();
    ctx.arc(cx, cy, inner1 / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.arc(cx, cy, inner2 / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (isRing) {
    const cx = x + outer / 2;
    const cy = y + outer / 2;

    ctx.fillStyle = fillStyle;
    roundRectPath(ctx, x, y, outer, outer, Math.max(2, Math.floor(m * 1.8)));
    ctx.fill();

    ctx.fillStyle = bgStyle;
    ctx.beginPath();
    ctx.arc(cx, cy, inner1 / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.arc(cx, cy, inner2 / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (isOrbit) {
    const cx = x + outer / 2;
    const cy = y + outer / 2;

    ctx.fillStyle = fillStyle;
    roundRectPath(ctx, x, y, outer, outer, 0);
    ctx.fill();

    ctx.fillStyle = bgStyle;
    roundRectPath(ctx, x + m, y + m, inner1, inner1, 0);
    ctx.fill();

    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.arc(cx, cy, inner2 / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (isNotched) {
    const notch = Math.max(2, Math.floor(m * 1.25));
    ctx.fillStyle = fillStyle;
    notchedRectPath(ctx, x, y, outer, outer, notch);
    ctx.fill();

    ctx.fillStyle = bgStyle;
    roundRectPath(ctx, x + m, y + m, inner1, inner1, Math.max(1, Math.floor(m * 0.9)));
    ctx.fill();

    ctx.fillStyle = fillStyle;
    roundRectPath(ctx, x + 2 * m, y + 2 * m, inner2, inner2, Math.max(1, Math.floor(m * 0.7)));
    ctx.fill();
  } else if (isDouble) {
    // Two frames + center: outer frame (7->5), inner frame (5->3), center dot/square (3).
    ctx.fillStyle = fillStyle;
    roundRectPath(ctx, x, y, outer, outer, Math.max(2, Math.floor(m * 1.3)));
    ctx.fill();

    ctx.fillStyle = bgStyle;
    roundRectPath(ctx, x + m, y + m, inner1, inner1, Math.max(2, Math.floor(m * 1.0)));
    ctx.fill();

    ctx.fillStyle = fillStyle;
    roundRectPath(ctx, x + m, y + m, inner1, inner1, Math.max(2, Math.floor(m * 1.0)));
    ctx.fill();

    ctx.fillStyle = bgStyle;
    roundRectPath(ctx, x + 2 * m, y + 2 * m, inner2, inner2, Math.max(2, Math.floor(m * 0.9)));
    ctx.fill();

    ctx.fillStyle = fillStyle;
    // Slightly smaller center to keep the double-frame readable.
    const c = Math.floor(m * 0.2);
    roundRectPath(ctx, x + 2 * m + c, y + 2 * m + c, inner2 - 2 * c, inner2 - 2 * c, Math.max(2, Math.floor(m * 0.9)));
    ctx.fill();
  } else {
    ctx.fillStyle = fillStyle;
    roundRectPath(ctx, x, y, outer, outer, rOuter);
    ctx.fill();

    ctx.fillStyle = bgStyle;
    roundRectPath(ctx, x + m, y + m, inner1, inner1, rInner);
    ctx.fill();

    ctx.fillStyle = fillStyle;
    roundRectPath(ctx, x + 2 * m, y + 2 * m, inner2, inner2, rInner);
    ctx.fill();
  }
  ctx.restore();
}

function drawModule(ctx, x, y, m, shape) {
  if (shape === 'dot') {
    const r = m * 0.46;
    ctx.beginPath();
    ctx.arc(x + m / 2, y + m / 2, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // 'blob' is handled in a separate pass to avoid overdraw and to connect neighbors.
  if (shape === 'rounded') {
    const r = Math.max(1, Math.floor(m * 0.38));
    roundRectPath(ctx, x, y, m, m, r);
    ctx.fill();
    return;
  }
  ctx.fillRect(x, y, m, m);
}

function softRectPath(ctx, x, y, w, h, rtl, rtr, rbr, rbl) {
  const maxR = Math.min(w, h) / 2;
  const tl = clamp(rtl, 0, maxR);
  const tr = clamp(rtr, 0, maxR);
  const br = clamp(rbr, 0, maxR);
  const bl = clamp(rbl, 0, maxR);

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  else ctx.lineTo(x + w, y);

  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  else ctx.lineTo(x + w, y + h);

  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  else ctx.lineTo(x, y + h);

  ctx.lineTo(x, y + tl);
  if (tl) ctx.quadraticCurveTo(x, y, x + tl, y);
  else ctx.lineTo(x, y);

  ctx.closePath();
}

function drawSoftSquare(ctx, x, y, m, radii) {
  softRectPath(ctx, x, y, m, m, radii.tl, radii.tr, radii.br, radii.bl);
  ctx.fill();
}

function drawBlobModule(ctx, x, y, m) {
  const r = m * 0.46;
  ctx.beginPath();
  ctx.arc(x + m / 2, y + m / 2, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawBlobConnectorH(ctx, x, y, m) {
  // x,y is top-left of left cell
  const r = m * 0.46;
  ctx.fillRect(x + m / 2, y + (m / 2 - r), m, 2 * r);
}

function drawBlobConnectorV(ctx, x, y, m) {
  const r = m * 0.46;
  ctx.fillRect(x + (m / 2 - r), y + m / 2, 2 * r, m);
}

function shouldApplyInset(modulePx, insetFrac) {
  const insetPx = Math.floor(modulePx * insetFrac);
  // If modules are too small, the inset becomes noise.
  if (modulePx < 8) return { ok: false, insetPx: 0 };
  if (insetPx < 1) return { ok: false, insetPx: 0 };
  if (insetPx * 2 >= modulePx - 1) return { ok: false, insetPx: 0 };
  return { ok: true, insetPx };
}

function applyModuleInset(ctx, matrix, count, ox, oy, m, settings) {
  const insetEnabled = !!settings.moduleEffect?.insetEnabled;
  if (!insetEnabled) return false;
  const insetFrac = clamp(Number(settings.moduleEffect?.inset ?? 0.12), 0.04, 0.22);
  const { ok, insetPx } = shouldApplyInset(m, insetFrac);
  if (!ok) return false;

  const shape = settings.moduleShape || 'square';
  ctx.save();
  ctx.fillStyle = settings.bgTransparent ? 'transparent' : settings.bg;

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!matrix[r][c]) continue;
      if (isInFinder(r, c, count)) continue;
      const x = ox + c * m;
      const y = oy + r * m;

      if (shape === 'dot' || shape === 'blob') {
        const rr = Math.max(1, Math.floor(m * 0.46) - insetPx);
        if (rr <= 0) continue;
        ctx.beginPath();
        ctx.arc(x + m / 2, y + m / 2, rr, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const w = m - insetPx * 2;
      const h = m - insetPx * 2;
      if (w <= 0 || h <= 0) continue;

      if (shape === 'rounded') {
        roundRectPath(ctx, x + insetPx, y + insetPx, w, h, Math.max(1, Math.floor(m * 0.38) - insetPx));
        ctx.fill();
        continue;
      }

      if (shape === 'soft') {
        // Keep inset shape rounded to match the soft aesthetic.
        roundRectPath(ctx, x + insetPx, y + insetPx, w, h, Math.max(1, Math.floor(m * 0.44) - insetPx));
        ctx.fill();
        continue;
      }

      // square
      ctx.fillRect(x + insetPx, y + insetPx, w, h);
    }
  }

  ctx.restore();
  return true;
}

async function maybeDrawLogo(ctx, qrRect, settings) {
  if (!settings.logo?.enabled || !settings.logo?.dataUrl) return;
  const img = new Image();
  img.decoding = 'async';

  const ok = await new Promise((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = settings.logo.dataUrl;
  });
  if (!ok) return;

  const s = clamp(Number(settings.logo.scale || 0.2), 0.1, 0.34);
  const size = Math.floor(Math.min(qrRect.w, qrRect.h) * s);
  const x = Math.floor(qrRect.x + (qrRect.w - size) / 2);
  const y = Math.floor(qrRect.y + (qrRect.h - size) / 2);

  // Cut-out background to improve readability.
  ctx.save();
  ctx.fillStyle = settings.bg;
  roundRectPath(ctx, x - Math.floor(size * 0.10), y - Math.floor(size * 0.10), Math.floor(size * 1.20), Math.floor(size * 1.20), Math.floor(size * 0.18));
  ctx.fill();

  // Clip to rounded rect to look cleaner.
  roundRectPath(ctx, x, y, size, size, Math.floor(size * 0.16));
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

export async function renderToCanvas(canvas, matrix, settings) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const payloadOk = !!matrix;
  const count = payloadOk ? matrix.length : 0;
  const marginModules = clamp(Number(settings.marginModules || 4), 1, 16);

  const innerModules = payloadOk ? (count + marginModules * 2) : 0;
  const modulePx = payloadOk ? Math.max(1, Math.floor(Number(settings.sizePx || 512) / innerModules)) : 0;
  const qrPx = payloadOk ? innerModules * modulePx : 0;

  const pad = settings.card?.enabled ? clamp(Number(settings.card.paddingPx || 22), 0, 64) : 0;
  const captionOn = !!settings.caption?.enabled;
  const captionH = captionOn ? 66 : 0;
  const w = payloadOk ? (qrPx + pad * 2) : 640;
  const h = payloadOk ? (qrPx + pad * 2 + captionH) : 360;

  canvas.width = w;
  canvas.height = h;

  // Card background
  ctx.clearRect(0, 0, w, h);
  if (settings.card?.enabled) {
    ctx.save();
    const cardBg = settings.card?.bg || settings.bg;
    ctx.fillStyle = cardBg;
    roundRectPath(ctx, 0, 0, w, h, clamp(Number(settings.card.radius || 20), 0, 48));
    ctx.fill();
    ctx.restore();
  }

  if (!payloadOk) {
    // Empty state
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 18px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('请输入内容以生成二维码', w / 2, h / 2 - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '14px ui-sans-serif, system-ui';
    ctx.fillText('支持 URL / WiFi / vCard / 电话 / 短信 / 邮件 / 位置 / 日程', w / 2, h / 2 + 20);
    ctx.restore();
    return { qrPx: 0, modulePx: 0, warnings: [] };
  }

  const qrX = pad;
  const qrY = pad;
  const qrRect = { x: qrX, y: qrY, w: qrPx, h: qrPx };

  // When exporting with transparent background, only the dark modules are drawn.
  // Card background (if enabled) is still rendered using settings.bg.
  const bgPaint = settings.bgTransparent ? 'transparent' : settings.bg;

  // QR background
  if (!settings.bgTransparent) {
    ctx.save();
    ctx.fillStyle = settings.bg;
    ctx.fillRect(qrRect.x, qrRect.y, qrRect.w, qrRect.h);
    ctx.restore();
  }

  // Foreground paint (color or gradient)
  const fg = settings.fg;
  const paint = settings.gradient?.enabled
    ? makeLinearGradient(ctx, qrRect.x, qrRect.y, qrRect.w, qrRect.h, fg, settings.gradient.color2 || '#4f46e5', settings.gradient.angleDeg || 45)
    : fg;

  ctx.save();
  ctx.fillStyle = paint;

  const ox = qrRect.x + marginModules * modulePx;
  const oy = qrRect.y + marginModules * modulePx;
  const shape = settings.moduleShape || 'square';

  if (shape === 'blob') {
    // Connected rounded modules: draw circles + connectors to right/bottom.
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c]) continue;
        if (isInFinder(r, c, count)) continue;
        const x = ox + c * modulePx;
        const y = oy + r * modulePx;
        drawBlobModule(ctx, x, y, modulePx);

        if (c + 1 < count && matrix[r][c + 1] && !isInFinder(r, c + 1, count)) {
          drawBlobConnectorH(ctx, x, y, modulePx);
        }
        if (r + 1 < count && matrix[r + 1][c] && !isInFinder(r + 1, c, count)) {
          drawBlobConnectorV(ctx, x, y, modulePx);
        }
      }
    }
  } else if (shape === 'soft') {
    const rBase = Math.max(1, Math.floor(modulePx * 0.44));
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c]) continue;
        if (isInFinder(r, c, count)) continue;

        const up = r > 0 && matrix[r - 1][c] && !isInFinder(r - 1, c, count);
        const down = r + 1 < count && matrix[r + 1][c] && !isInFinder(r + 1, c, count);
        const left = c > 0 && matrix[r][c - 1] && !isInFinder(r, c - 1, count);
        const right = c + 1 < count && matrix[r][c + 1] && !isInFinder(r, c + 1, count);

        // Corner rounding only when corner is on the outer boundary.
        const radii = {
          tl: (!up && !left) ? rBase : 0,
          tr: (!up && !right) ? rBase : 0,
          br: (!down && !right) ? rBase : 0,
          bl: (!down && !left) ? rBase : 0,
        };

        const x = ox + c * modulePx;
        const y = oy + r * modulePx;
        drawSoftSquare(ctx, x, y, modulePx, radii);
      }
    }
  } else {
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c]) continue;
        if (isInFinder(r, c, count)) continue;
        const x = ox + c * modulePx;
        const y = oy + r * modulePx;
        drawModule(ctx, x, y, modulePx, shape);
      }
    }
  }

  // Finder patterns
  drawFinder(ctx, ox + 0 * modulePx, oy + 0 * modulePx, modulePx, settings.eyeStyle, paint, bgPaint);
  drawFinder(ctx, ox + (count - 7) * modulePx, oy + 0 * modulePx, modulePx, settings.eyeStyle, paint, bgPaint);
  drawFinder(ctx, ox + 0 * modulePx, oy + (count - 7) * modulePx, modulePx, settings.eyeStyle, paint, bgPaint);

  ctx.restore();

  // Optional module inset detail (data area only). Finders stay solid.
  const insetApplied = applyModuleInset(ctx, matrix, count, ox, oy, modulePx, settings);

  await maybeDrawLogo(ctx, qrRect, settings);

  // Caption
  if (captionOn) {
    const title = String(settings.caption.title || '').trim();
    const sub = String(settings.caption.subtitle || '').trim();
    const captionBg = settings.card?.enabled
      ? (settings.card?.bg || settings.bg)
      : (settings.bgTransparent ? '#ffffff' : settings.bg);
    const textColor = pickTextColor(captionBg);
    ctx.save();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const baseY = qrRect.y + qrRect.h + 34;
    if (title) {
      ctx.font = '800 18px ui-sans-serif, system-ui';
      ctx.fillText(title, w / 2, baseY);
    }
    if (sub) {
      ctx.font = '13px ui-sans-serif, system-ui';
      ctx.globalAlpha = 0.86;
      ctx.fillText(sub, w / 2, baseY + 22);
    }
    ctx.restore();
  }

  // Warnings
  const warnings = [];
  if (settings.logo?.enabled) {
    const ecc = String(settings.ecc || 'M');
    if (ecc === 'L' || ecc === 'M') {
      warnings.push('启用 Logo 时建议 ECC 选择 Q 或 H，以提高容错与扫码稳定性。');
    }
    const scale = Number(settings.logo.scale || 0.2);
    if (scale > 0.28) warnings.push('Logo 比例偏大，可能影响扫码。建议不超过 0.28。');
  }

  if (settings.moduleEffect?.insetEnabled) {
    if (!insetApplied) warnings.push('模块描边在当前尺寸下可能影响识别，建议增大尺寸（或关闭描边）。');
  }

  // Contrast check (very rough)
  const bgRgb = settings.bgTransparent ? null : hexToRgb(settings.bg);
  const fgRgb = hexToRgb(settings.fg);
  if (bgRgb && fgRgb) {
    const lum = (rgb) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
    };
    const L1 = lum(bgRgb);
    const L2 = lum(fgRgb);
    const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (contrast < 3.2) warnings.push('前景色与背景色对比度较低，可能影响识别。建议使用更深的前景或更浅的背景。');
  }

  return { qrPx, modulePx, warnings };
}
