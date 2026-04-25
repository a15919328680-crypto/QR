import { clamp, pickTextColor } from '../utils.js';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function softRectD(x, y, w, h, tl, tr, br, bl) {
  const maxR = Math.min(w, h) / 2;
  const c = (n) => Math.max(0, Math.min(maxR, Number(n || 0)));
  const rtl = c(tl);
  const rtr = c(tr);
  const rbr = c(br);
  const rbl = c(bl);

  // Use quadratic curves for corner rounding.
  return [
    `M ${x + rtl} ${y}`,
    `L ${x + w - rtr} ${y}`,
    rtr ? `Q ${x + w} ${y} ${x + w} ${y + rtr}` : `L ${x + w} ${y}`,
    `L ${x + w} ${y + h - rbr}`,
    rbr ? `Q ${x + w} ${y + h} ${x + w - rbr} ${y + h}` : `L ${x + w} ${y + h}`,
    `L ${x + rbl} ${y + h}`,
    rbl ? `Q ${x} ${y + h} ${x} ${y + h - rbl}` : `L ${x} ${y + h}`,
    `L ${x} ${y + rtl}`,
    rtl ? `Q ${x} ${y} ${x + rtl} ${y}` : `L ${x} ${y}`,
    'Z',
  ].join(' ');
}

function isInFinder(r, c, count) {
  const inTL = r >= 0 && r < 7 && c >= 0 && c < 7;
  const inTR = r >= 0 && r < 7 && c >= count - 7 && c < count;
  const inBL = r >= count - 7 && r < count && c >= 0 && c < 7;
  return inTL || inTR || inBL;
}

function gradientDef(id, fg, c2, angleDeg) {
  const a = (Number(angleDeg || 0) % 360) * (Math.PI / 180);
  const x = Math.cos(a);
  const y = Math.sin(a);
  // Map angle to SVG gradient vector in [0..1]
  const x1 = 0.5 - x * 0.5;
  const y1 = 0.5 - y * 0.5;
  const x2 = 0.5 + x * 0.5;
  const y2 = 0.5 + y * 0.5;
  return `
  <linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
    <stop offset="0%" stop-color="${esc(fg)}" />
    <stop offset="100%" stop-color="${esc(c2)}" />
  </linearGradient>`;
}

function finderSvg(x, y, m, eyeStyle, fill, bg) {
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
  if (isDot) {
    const cx = x + outer / 2;
    const cy = y + outer / 2;
    return [
      `<circle cx="${cx}" cy="${cy}" r="${outer / 2}" fill="${fill}" />`,
      `<circle cx="${cx}" cy="${cy}" r="${inner1 / 2}" fill="${bg}" />`,
      `<circle cx="${cx}" cy="${cy}" r="${inner2 / 2}" fill="${fill}" />`,
    ].join('');
  }
  if (isRing) {
    const cx = x + outer / 2;
    const cy = y + outer / 2;
    const ro = Math.max(2, Math.floor(m * 1.8));
    return [
      `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" rx="${ro}" fill="${fill}" />`,
      `<circle cx="${cx}" cy="${cy}" r="${inner1 / 2}" fill="${bg}" />`,
      `<circle cx="${cx}" cy="${cy}" r="${inner2 / 2}" fill="${fill}" />`,
    ].join('');
  }
  if (isOrbit) {
    const cx = x + outer / 2;
    const cy = y + outer / 2;
    return [
      `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" rx="0" fill="${fill}" />`,
      `<rect x="${x + m}" y="${y + m}" width="${inner1}" height="${inner1}" rx="0" fill="${bg}" />`,
      `<circle cx="${cx}" cy="${cy}" r="${inner2 / 2}" fill="${fill}" />`,
    ].join('');
  }
  if (isNotched) {
    const n = Math.max(2, Math.floor(m * 1.25));
    const d = [
      `M ${x + n} ${y}`,
      `L ${x + outer - n} ${y}`,
      `L ${x + outer} ${y + n}`,
      `L ${x + outer} ${y + outer - n}`,
      `L ${x + outer - n} ${y + outer}`,
      `L ${x + n} ${y + outer}`,
      `L ${x} ${y + outer - n}`,
      `L ${x} ${y + n}`,
      'Z',
    ].join(' ');
    const r = Math.max(1, Math.floor(m * 0.9));
    const r2 = Math.max(1, Math.floor(m * 0.7));
    return [
      `<path d="${d}" fill="${fill}" />`,
      `<rect x="${x + m}" y="${y + m}" width="${inner1}" height="${inner1}" rx="${r}" fill="${bg}" />`,
      `<rect x="${x + 2 * m}" y="${y + 2 * m}" width="${inner2}" height="${inner2}" rx="${r2}" fill="${fill}" />`,
    ].join('');
  }
  if (isDouble) {
    const ro = Math.max(2, Math.floor(m * 1.3));
    const rmid = Math.max(2, Math.floor(m * 1.0));
    const rin = Math.max(2, Math.floor(m * 0.9));
    const c = Math.floor(m * 0.2);
    return [
      `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" rx="${ro}" fill="${fill}" />`,
      `<rect x="${x + m}" y="${y + m}" width="${inner1}" height="${inner1}" rx="${rmid}" fill="${bg}" />`,
      `<rect x="${x + m}" y="${y + m}" width="${inner1}" height="${inner1}" rx="${rmid}" fill="${fill}" />`,
      `<rect x="${x + 2 * m}" y="${y + 2 * m}" width="${inner2}" height="${inner2}" rx="${rin}" fill="${bg}" />`,
      `<rect x="${x + 2 * m + c}" y="${y + 2 * m + c}" width="${inner2 - 2 * c}" height="${inner2 - 2 * c}" rx="${rin}" fill="${fill}" />`,
    ].join('');
  }
  return [
    `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" rx="${rOuter}" fill="${fill}" />`,
    `<rect x="${x + m}" y="${y + m}" width="${inner1}" height="${inner1}" rx="${rInner}" fill="${bg}" />`,
    `<rect x="${x + 2 * m}" y="${y + 2 * m}" width="${inner2}" height="${inner2}" rx="${rInner}" fill="${fill}" />`,
  ].join('');
}

function shouldApplyInset(modulePx, insetFrac) {
  const insetPx = Math.floor(modulePx * insetFrac);
  if (modulePx < 8) return { ok: false, insetPx: 0 };
  if (insetPx < 1) return { ok: false, insetPx: 0 };
  if (insetPx * 2 >= modulePx - 1) return { ok: false, insetPx: 0 };
  return { ok: true, insetPx };
}

export function renderToSvg(matrix, settings) {
  if (!matrix) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="320" y="180" font-family="ui-sans-serif,system-ui" font-size="16" text-anchor="middle" fill="#111827">请输入内容以生成二维码</text>
</svg>`;
  }

  const count = matrix.length;
  const marginModules = clamp(Number(settings.marginModules || 4), 1, 16);
  const innerModules = count + marginModules * 2;
  const modulePx = Math.max(1, Math.floor(Number(settings.sizePx || 512) / innerModules));
  const qrPx = innerModules * modulePx;

  const pad = settings.card?.enabled ? clamp(Number(settings.card.paddingPx || 22), 0, 64) : 0;
  const captionOn = !!settings.caption?.enabled;
  const captionH = captionOn ? 66 : 0;
  const w = qrPx + pad * 2;
  const h = qrPx + pad * 2 + captionH;
  const qrX = pad;
  const qrY = pad;

  const fg = settings.fg;
  const bg = settings.bg;
  const bgPaint = settings.bgTransparent ? 'transparent' : bg;

  const cardBg = settings.card?.bg || bg;
  const captionBg = settings.card?.enabled ? cardBg : (settings.bgTransparent ? '#ffffff' : bg);

  const hasGrad = !!settings.gradient?.enabled;
  const gradId = 'g1';
  const paint = hasGrad ? `url(#${gradId})` : fg;
  const defs = hasGrad ? gradientDef(gradId, fg, settings.gradient.color2 || '#4f46e5', settings.gradient.angleDeg || 45) : '';

  const ox = qrX + marginModules * modulePx;
  const oy = qrY + marginModules * modulePx;
  const shape = settings.moduleShape || 'square';
  const rx = shape === 'rounded' ? Math.max(1, Math.floor(modulePx * 0.38)) : 0;
  const rDot = modulePx * 0.46;
  const rBlob = modulePx * 0.46;
  const rSoft = Math.max(1, Math.floor(modulePx * 0.44));

  let modules = '';
  let inset = '';
  if (shape === 'blob') {
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c]) continue;
        if (isInFinder(r, c, count)) continue;
        const x = ox + c * modulePx;
        const y = oy + r * modulePx;
        const cx = x + modulePx / 2;
        const cy = y + modulePx / 2;
        modules += `<circle cx="${cx}" cy="${cy}" r="${rBlob}" fill="${paint}" />`;

        // Connectors to right/bottom only (avoid duplicates)
        if (c + 1 < count && matrix[r][c + 1] && !isInFinder(r, c + 1, count)) {
          const rx0 = x + modulePx / 2;
          const ry0 = y + (modulePx / 2 - rBlob);
          modules += `<rect x="${rx0}" y="${ry0}" width="${modulePx}" height="${2 * rBlob}" fill="${paint}" />`;
        }
        if (r + 1 < count && matrix[r + 1][c] && !isInFinder(r + 1, c, count)) {
          const rx0 = x + (modulePx / 2 - rBlob);
          const ry0 = y + modulePx / 2;
          modules += `<rect x="${rx0}" y="${ry0}" width="${2 * rBlob}" height="${modulePx}" fill="${paint}" />`;
        }
      }
    }
  } else if (shape === 'soft') {
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c]) continue;
        if (isInFinder(r, c, count)) continue;

        const up = r > 0 && matrix[r - 1][c] && !isInFinder(r - 1, c, count);
        const down = r + 1 < count && matrix[r + 1][c] && !isInFinder(r + 1, c, count);
        const left = c > 0 && matrix[r][c - 1] && !isInFinder(r, c - 1, count);
        const right = c + 1 < count && matrix[r][c + 1] && !isInFinder(r, c + 1, count);

        const tl = (!up && !left) ? rSoft : 0;
        const tr = (!up && !right) ? rSoft : 0;
        const br = (!down && !right) ? rSoft : 0;
        const bl = (!down && !left) ? rSoft : 0;

        const x = ox + c * modulePx;
        const y = oy + r * modulePx;
        const d = softRectD(x, y, modulePx, modulePx, tl, tr, br, bl);
        modules += `<path d="${d}" fill="${paint}" />`;
      }
    }
  } else {
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c]) continue;
        if (isInFinder(r, c, count)) continue;
        const x = ox + c * modulePx;
        const y = oy + r * modulePx;
        if (shape === 'dot') {
          modules += `<circle cx="${x + modulePx / 2}" cy="${y + modulePx / 2}" r="${rDot}" fill="${paint}" />`;
        } else {
          modules += `<rect x="${x}" y="${y}" width="${modulePx}" height="${modulePx}" rx="${rx}" fill="${paint}" />`;
        }
      }
    }
  }

  // Optional module inset detail (data area only). Finders stay solid.
  if (settings.moduleEffect?.insetEnabled) {
    const insetFrac = clamp(Number(settings.moduleEffect?.inset ?? 0.12), 0.04, 0.22);
    const { ok, insetPx } = shouldApplyInset(modulePx, insetFrac);
    if (ok) {
      const w0 = modulePx - insetPx * 2;
      const h0 = modulePx - insetPx * 2;
      const r0 = Math.max(1, Math.floor(modulePx * 0.46) - insetPx);
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (!matrix[r][c]) continue;
          if (isInFinder(r, c, count)) continue;
          const x = ox + c * modulePx;
          const y = oy + r * modulePx;

          if (shape === 'dot' || shape === 'blob') {
            if (r0 <= 0) continue;
            inset += `<circle cx="${x + modulePx / 2}" cy="${y + modulePx / 2}" r="${r0}" fill="${esc(bgPaint)}" />`;
          } else if (shape === 'rounded' || shape === 'soft') {
            const rr = Math.max(1, Math.floor(modulePx * (shape === 'rounded' ? 0.38 : 0.44)) - insetPx);
            inset += `<rect x="${x + insetPx}" y="${y + insetPx}" width="${w0}" height="${h0}" rx="${rr}" fill="${esc(bgPaint)}" />`;
          } else {
            inset += `<rect x="${x + insetPx}" y="${y + insetPx}" width="${w0}" height="${h0}" fill="${esc(bgPaint)}" />`;
          }
        }
      }
    }
  }

  const finders = [
    finderSvg(ox, oy, modulePx, settings.eyeStyle, paint, bgPaint),
    finderSvg(ox + (count - 7) * modulePx, oy, modulePx, settings.eyeStyle, paint, bgPaint),
    finderSvg(ox, oy + (count - 7) * modulePx, modulePx, settings.eyeStyle, paint, bgPaint),
  ].join('');

  let caption = '';
  if (captionOn) {
    const title = String(settings.caption.title || '').trim();
    const sub = String(settings.caption.subtitle || '').trim();
    const tc = pickTextColor(captionBg);
    const baseY = qrY + qrPx + 34;
    if (title) {
      caption += `<text x="${w / 2}" y="${baseY}" font-family="ui-sans-serif,system-ui" font-size="18" font-weight="800" text-anchor="middle" fill="${esc(tc)}">${esc(title)}</text>`;
    }
    if (sub) {
      caption += `<text x="${w / 2}" y="${baseY + 22}" font-family="ui-sans-serif,system-ui" font-size="13" text-anchor="middle" fill="${esc(tc)}" opacity="0.86">${esc(sub)}</text>`;
    }
  }

  // Note: SVG export intentionally omits logo embedding to keep output universally compatible.
  // Logo is included in PNG export.

  const cardRadius = settings.card?.enabled ? clamp(Number(settings.card.radius || 20), 0, 48) : 0;
  const bgRect = settings.card?.enabled
    ? `<rect x="0" y="0" width="${w}" height="${h}" rx="${cardRadius}" fill="${esc(cardBg)}" />`
    : '';

  const qrBgRect = settings.bgTransparent
    ? ''
    : `<rect x="${qrX}" y="${qrY}" width="${qrPx}" height="${qrPx}" fill="${esc(bg)}" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
 <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
   <defs>${defs}
   </defs>
   ${bgRect}
  ${qrBgRect}
   ${modules}${inset}${finders}
   ${caption}
 </svg>`;
}
