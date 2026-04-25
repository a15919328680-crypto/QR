import { $, clamp, debounce, canvasToPngBytes, downloadBlob } from './utils.js';
import {
  payloadEmail,
  payloadEvent,
  payloadGeo,
  payloadSms,
  payloadTel,
  payloadText,
  payloadVCard,
  payloadWifi,
} from './payloads.js';
import { encodeQrMatrix } from './qr/encoder.js';
import { renderToCanvas } from './qr/renderer-canvas.js';
import { renderToSvg } from './qr/renderer-svg.js';
import { applyPreset, loadPresets, makePreset, makeShareHash, savePresets, tryLoadFromShareHash } from './storage.js';
import { zipStore } from './zip.js';

const DEFAULTS = {
  mode: 'single',
  payloadType: 'text',
  payload: 'https://example.com',
  wifi: { ssid: '', auth: 'WPA', password: '', hidden: false },
  vcard: { name: '', phone: '', email: '', org: '', title: '', url: '' },
  tel: { phone: '' },
  sms: { phone: '', body: '' },
  email: { to: '', subject: '', body: '' },
  geo: { lat: '', lon: '', query: '' },
  event: { title: '', location: '', start: '', end: '', notes: '' },

  ecc: 'M',
  sizePx: 512,
  marginModules: 4,
  fg: '#0b1220',
  bg: '#ffffff',
  gradient: { enabled: false, color2: '#4f46e5', angleDeg: 45 },
  moduleShape: 'rounded',
  eyeStyle: 'rounded',
  moduleEffect: { insetEnabled: false, inset: 0.12 },
  logo: { enabled: false, dataUrl: null, scale: 0.2 },
  caption: { enabled: false, title: '扫码访问', subtitle: 'example.com' },
  card: { enabled: true, radius: 20, paddingPx: 22 },
};

const BUILTIN_PRESETS = [
  {
    id: 'builtin:minimal',
    name: '极简黑白',
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      gradient: { enabled: false },
      moduleShape: 'square',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: false },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:studio',
    name: '工作室质感',
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      gradient: { enabled: false },
      moduleShape: 'soft',
      eyeStyle: 'double',
      moduleEffect: { insetEnabled: true, inset: 0.11 },
      card: { enabled: true, radius: 22, paddingPx: 22 },
      caption: { enabled: true, title: '扫码访问', subtitle: 'example.com' },
    },
  },
  {
    id: 'builtin:neon',
    name: '霓虹渐变',
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#06b6d4', angleDeg: 35 },
      moduleShape: 'blob',
      eyeStyle: 'ring',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 24, paddingPx: 22 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:tech',
    name: '切角科技',
    settings: {
      fg: '#111827',
      bg: '#ffffff',
      gradient: { enabled: false },
      moduleShape: 'soft',
      eyeStyle: 'notched',
      moduleEffect: { insetEnabled: true, inset: 0.10 },
      card: { enabled: true, radius: 18, paddingPx: 20 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:poster',
    name: '海报卡片',
    settings: {
      fg: '#111827',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#4f46e5', angleDeg: 60 },
      moduleShape: 'rounded',
      eyeStyle: 'orbit',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 28, paddingPx: 26 },
      caption: { enabled: true, title: '扫码领取资料', subtitle: '活动入口' },
    },
  },
];

let settings = structuredClone(DEFAULTS);
let presets = [];

const els = {
  canvas: $('#canvas'),
  previewMeta: $('#previewMeta'),
  warnings: $('#warnings'),
  toast: $('#toast'),

  btnShareLink: $('#btnShareLink'),
  btnReset: $('#btnReset'),

  segButtons: Array.from(document.querySelectorAll('.segBtn')),

  singleMode: $('#singleMode'),
  batchMode: $('#batchMode'),
  batchResults: $('#batchResults'),
  batchGrid: $('#batchGrid'),

  payloadType: $('#payloadType'),
  payloadForm: $('#payloadForm'),

  ecc: $('#ecc'),
  sizePx: $('#sizePx'),
  marginModules: $('#marginModules'),
  marginModulesValue: $('#marginModulesValue'),

  fg: $('#fg'),
  bg: $
        <div class="grid2">
          <label class="field">
            <span class="label">SSID</span>
            <input id="wifiSsid" type="text" placeholder="WiFi 名称" />
          </label>
          <label class="field">
            <span class="label">加密</span>
            <select id="wifiAuth">
              <option value="WPA">WPA/WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">无密码</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span class="label">密码</span>
          <input id="wifiPass" type="text" placeholder="WiFi 密码" />
        </label>
        <label class="check">
          <input id="wifiHidden" type="checkbox" />
          <span>隐藏网络</span>
        </label>
      `;
    }
    if (t === 'vcard') {
      return `
        <div class="grid2">
          <label class="field"><span class="label">姓名</span><input id="vName" type="text" /></label>
          <label class="field"><span class="label">电话</span><input id="vPhone" type="text" /></label>
        </div>
        <div class="grid2">
          <label class="field"><span class="label">邮箱</span><input id="vEmail" type="text" /></label>
          <label class="field"><span class="label">公司</span><input id="vOrg" type="text" /></label>
        </div>
        <div class="grid2">
          <label class="field"><span class="label">职位</span><input id="vTitle" type="text" /></label>
          <label class="field"><span class="label">网址</span><input id="vUrl" type="text" placeholder="https://" /></label>
        </div>
      `;
    }
    if (t === 'tel') {
      return `
        <label class="field">
          <span class="label">电话号码</span>
          <input id="telPhone" type="text" placeholder="+86..." />
        </label>
      `;
    }
    if (t === 'sms') {
      return `
        <label class="field"><span class="label">手机号</span><input id="smsPhone" type="text" placeholder="+86..." /></label>
        <label class="field"><span class="label">短信内容</span><textarea id="smsBody" rows="3" placeholder="要发送的内容"></textarea></label>
      `;
    }
    if (t === 'email') {
      return `
        <label class="field"><span class="label">收件人</span><input id="emTo" type="text" placeholder="name@example.com" /></label>
        <label class="field"><span class="label">主题</span><input id="emSub" type="text" /></label>
        <label class="field"><span class="label">正文</span><textarea id="emBody" rows="3"></textarea></label>
      `;
    }
    if (t === 'geo') {
      return `
        <div class="grid2">
          <label class="field"><span class="label">纬度</span><input id="geoLat" type="text" placeholder="31.2304" /></label>
          <label class="field"><span class="label">经度</span><input id="geoLon" type="text" placeholder="121.4737" /></label>
        </div>
        <label class="field"><span class="label">备注（可选）</span><input id="geoQuery" type="text" placeholder="地点名" /></label>
      `;
    }
    // event
    return `
      <label class="field"><span class="label">标题</span><input id="evTitle" type="text" placeholder="会议/活动" /></label>
      <label class="field"><span class="label">地点</span><input id="evLoc" type="text" placeholder="会议室/线上" /></label>
      <div class="grid2">
        <label class="field"><span class="label">开始时间</span><input id="evStart" type="text" placeholder="2026-04-25 10:00" /></label>
        <label class="field"><span class="label">结束时间</span><input id="evEnd" type="text" placeholder="2026-04-25 11:00" /></label>
      </div>
      <label class="field"><span class="label">备注</span><textarea id="evNotes" rows="3"></textarea></label>
    `;
  })();

  els.payloadForm.innerHTML = html;

  // Bind values and listeners
  const on = (id, fn) => {
    const el = $(`#${id}`, els.payloadForm);
    if (!el) return;
    el.addEventListener('input', fn);
    el.addEventListener('change', fn);
  };

  if (t === 'text') {
    const el = $('#payloadText', els.payloadForm);
    el.value = settings.payload;
    on('payloadText', () => {
      settings.payload = el.value;
      scheduleUpdate();
    });
  } else if (t === 'wifi') {
    $('#wifiSsid', els.payloadForm).value = settings.wifi.ssid;
    $('#wifiAuth', els.payloadForm).value = settings.wifi.auth;
    $('#wifiPass', els.payloadForm).value = settings.wifi.password;
    $('#wifiHidden', els.payloadForm).checked = !!settings.wifi.hidden;
    on('wifiSsid', (e) => {
      settings.wifi.ssid = e.target.value;
      scheduleUpdate();
    });
    on('wifiAuth', (e) => {
      settings.wifi.auth = e.target.value;
      scheduleUpdate();
    });
    on('wifiPass', (e) => {
      settings.wifi.password = e.target.value;
      scheduleUpdate();
    });
    on('wifiHidden', (e) => {
      settings.wifi.hidden = e.target.checked;
      scheduleUpdate();
    });
  } else if (t === 'vcard') {
    $('#vName', els.payloadForm).value = settings.vcard.name;
    $('#vPhone', els.payloadForm).value = settings.vcard.phone;
    $('#vEmail', els.payloadForm).value = settings.vcard.email;
    $('#vOrg', els.payloadForm).value = settings.vcard.org;
    $('#vTitle', els.payloadForm).value = settings.vcard.title;
    $('#vUrl', els.payloadForm).value = settings.vcard.url;
    on('vName', (e) => { settings.vcard.name = e.target.value; scheduleUpdate(); });
    on('vPhone', (e) => { settings.vcard.phone = e.target.value; scheduleUpdate(); });
    on('vEmail', (e) => { settings.vcard.email = e.target.value; scheduleUpdate(); });
    on('vOrg', (e) => { settings.vcard.org = e.target.value; scheduleUpdate(); });
    on('vTitle', (e) => { settings.vcard.title = e.target.value; scheduleUpdate(); });
    on('vUrl', (e) => { settings.vcard.url = e.target.value; scheduleUpdate(); });
  } else if (t === 'tel') {
    $('#telPhone', els.payloadForm).value = settings.tel.phone;
    on('telPhone', (e) => { settings.tel.phone = e.target.value; scheduleUpdate(); });
  } else if (t === 'sms') {
    $('#smsPhone', els.payloadForm).value = settings.sms.phone;
    $('#smsBody', els.payloadForm).value = settings.sms.body;
    on('smsPhone', (e) => { settings.sms.phone = e.target.value; scheduleUpdate(); });
    on('smsBody', (e) => { settings.sms.body = e.target.value; scheduleUpdate(); });
  } else if (t === 'email') {
    $('#emTo', els.payloadForm).value = settings.email.to;
    $('#emSub', els.payloadForm).value = settings.email.subject;
    $('#emBody', els.payloadForm).value = settings.email.body;
    on('emTo', (e) => { settings.email.to = e.target.value; scheduleUpdate(); });
    on('emSub', (e) => { settings.email.subject = e.target.value; scheduleUpdate(); });
    on('emBody', (e) => { settings.email.body = e.target.value; scheduleUpdate(); });
  } else if (t === 'geo') {
    $('#geoLat', els.payloadForm).value = settings.geo.lat;
    $('#geoLon', els.payloadForm).value = settings.geo.lon;
    $('#geoQuery', els.payloadForm).value = settings.geo.query;
    on('geoLat', (e) => { settings.geo.lat = e.target.value; scheduleUpdate(); });
    on('geoLon', (e) => { settings.geo.lon = e.target.value; scheduleUpdate(); });
    on('geoQuery', (e) => { settings.geo.query = e.target.value; scheduleUpdate(); });
  } else {
    $('#evTitle', els.payloadForm).value = settings.event.title;
    $('#evLoc', els.payloadForm).value = settings.event.location;
    $('#evStart', els.payloadForm).value = settings.event.start;
    $('#evEnd', els.payloadForm).value = settings.event.end;
    $('#evNotes', els.payloadForm).value = settings.event.notes;
    on('evTitle', (e) => { settings.event.title = e.target.value; scheduleUpdate(); });
    on('evLoc', (e) => { settings.event.location = e.target.value; scheduleUpdate(); });
    on('evStart', (e) => { settings.event.start = e.target.value; scheduleUpdate(); });
    on('evEnd', (e) => { settings.event.end = e.target.value; scheduleUpdate(); });
    on('evNotes', (e) => { settings.event.notes = e.target.value; scheduleUpdate(); });
  }
}

function buildPayload() {
  const t = settings.payloadType;
  if (t === 'text') return payloadText(settings.payload);
  if (t === 'wifi') return payloadWifi(settings.wifi);
  if (t === 'vcard') return payloadVCard(settings.vcard);
  if (t === 'tel') return payloadTel(settings.tel.phone);
  if (t === 'sms') return payloadSms(settings.sms);
  if (t === 'email') return payloadEmail(settings.email);
  if (t === 'geo') return payloadGeo(settings.geo);
  return payloadEvent(settings.event);
}

function setWarnings(list) {
  els.warnings.innerHTML = '';
  for (const w of list) {
    const div = document.createElement('div');
    div.className = 'warn';
    div.textContent = w;
    els.warnings.appendChild(div);
  }
}

function updateControlVisibility() {
  els.gradientControls.classList.toggle('hidden', !els.gradientEnabled.checked);
  els.captionControls.classList.toggle('hidden', !els.captionEnabled.checked);
  els.cardControls.classList.toggle('hidden', !els.cardEnabled.checked);
  els.moduleInsetControls.classList.toggle('hidden', !els.moduleInsetEnabled.checked);
}

let lastMatrixKey = '';
let lastMatrix = null;

async function update() {
  updateControlVisibility();

  els.marginModulesValue.textContent = String(settings.marginModules);
  els.logoScaleValue.textContent = Number(settings.logo.scale || 0.2).toFixed(2);

  if (settings.mode === 'batch') {
    els.previewMeta.textContent = '批量模式：预览列表与 ZIP 导出';
    setWarnings([]);
    await renderToCanvas(els.canvas, null, settings);
    return;
  }

  const payload = buildPayload();
  if (!payload) {
    els.previewMeta.textContent = '请输入内容';
    setWarnings([]);
    await renderToCanvas(els.canvas, null, settings);
    return;
  }

  const key = `${settings.ecc}::${payload}`;
  try {
    if (key !== lastMatrixKey) {
      const enc = encodeQrMatrix(payload, settings.ecc);
      lastMatrixKey = key;
      lastMatrix = enc.matrix;
    }

    const { qrPx, modulePx, warnings } = await renderToCanvas(els.canvas, lastMatrix, settings);
    setWarnings(warnings);
    els.previewMeta.textContent = `模块 ${lastMatrix.length}x${lastMatrix.length} | 像素 ${qrPx}px | module ${modulePx}px`;
    els.btnPng.disabled = false;
    els.btnSvg.disabled = false;
    els.btnCopy.disabled = false;
  } catch (e) {
    els.previewMeta.textContent = '编码失败';
    setWarnings([String(e.message || e)]);
  }
}

const scheduleUpdate = debounce(() => {
  window.requestAnimationFrame(() => update());
}, 160);

function syncSettingsFromControls() {
  settings.payloadType = els.payloadType.value;
  settings.ecc = els.ecc.value;
  settings.sizePx = clamp(Number(els.sizePx.value || 512), 160, 2048);
  settings.marginModules = clamp(Number(els.marginModules.value || 4), 1, 16);
  settings.fg = els.fg.value;
  settings.bg = els.bg.value;
  settings.gradient.enabled = els.gradientEnabled.checked;
  settings.gradient.color2 = els.gradientColor2.value;
  settings.gradient.angleDeg = clamp(Number(els.gradientAngle.value || 45), 0, 359);
  settings.moduleShape = els.moduleShape.value;
  settings.eyeStyle = els.eyeStyle.value;
  settings.logo.enabled = els.logoEnabled.checked;
  settings.logo.scale = clamp(Number(els.logoScale.value || 0.2), 0.1, 0.34);
  settings.caption.enabled = els.captionEnabled.checked;
  settings.caption.title = els.captionTitle.value;
  settings.caption.subtitle = els.captionSubtitle.value;
  settings.card.enabled = els.cardEnabled.checked;
  settings.card.radius = clamp(Number(els.cardRadius.value || 20), 0, 48);
  settings.card.paddingPx = clamp(Number(els.cardPadding.value || 22), 0, 64);
}

function syncControlsFromSettings() {
  els.payloadType.value = settings.payloadType;
  els.ecc.value = settings.ecc;
  els.sizePx.value = String(settings.sizePx);
  els.marginModules.value = String(settings.marginModules);
  els.fg.value = settings.fg;
  els.bg.value = settings.bg;
  els.gradientEnabled.checked = !!settings.gradient.enabled;
  els.gradientColor2.value = settings.gradient.color2;
  els.gradientAngle.value = String(settings.gradient.angleDeg);
  els.moduleShape.value = settings.moduleShape;
  els.eyeStyle.value = settings.eyeStyle;
  els.logoEnabled.checked = !!settings.logo.enabled;
  els.logoScale.value = String(settings.logo.scale);
  els.captionEnabled.checked = !!settings.caption.enabled;
  els.captionTitle.value = settings.caption.title;
  els.captionSubtitle.value = settings.caption.subtitle;
  els.cardEnabled.checked = !!settings.card.enabled;
  els.cardRadius.value = String(settings.card.radius);
  els.cardPadding.value = String(settings.card.paddingPx);
  els.presetIncludeContent.checked = true;
  updateControlVisibility();
}

function refreshPresetsUI() {
  els.presetSelect.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = '（无）';
  els.presetSelect.appendChild(opt0);
  for (const p of presets) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    els.presetSelect.appendChild(opt);
  }
}

async function copyShareLink() {
  syncSettingsFromControls();
  const hasWifiPass = settings.payloadType === 'wifi' && String(settings.wifi.password || '').trim();
  const excludeSensitive = hasWifiPass ? !confirm('分享链接包含 WiFi 密码，是否仍然包含该密码？\n\n点“确定”=包含密码\n点“取消”=排除密码') : false;
  const hash = makeShareHash(settings, { excludeSensitive });
  const url = `${location.origin}${location.pathname}${hash}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('已复制分享链接');
  } catch {
    // Fallback
    prompt('复制分享链接：', url);
  }
}

async function exportPng() {
  const bytes = await canvasToPngBytes(els.canvas);
  downloadBlob(new Blob([bytes], { type: 'image/png' }), 'qr.png');
}

async function exportSvg() {
  syncSettingsFromControls();
  const payload = buildPayload();
  if (!payload) return;
  const enc = encodeQrMatrix(payload, settings.ecc);
  const svg = renderToSvg(enc.matrix, settings);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), 'qr.svg');
}

async function copyPng() {
  try {
    const blob = await new Promise((resolve) => els.canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('无法生成 PNG');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('已复制 PNG');
  } catch (e) {
    toast('当前浏览器不支持直接复制图片，请使用“下载 PNG”');
  }
}

async function onLogoFile(file) {
  if (!file) return;
  const reader = new FileReader();
  const dataUrl = await new Promise((resolve) => {
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
  if (!dataUrl) {
    toast('Logo 读取失败');
    return;
  }
  settings.logo.dataUrl = dataUrl;
  els.logoHint.textContent = 'Logo 已加载。建议 ECC 选择 Q/H。';
  scheduleUpdate();
}

function parseBatchLines() {
  const raw = String(els.batchInput.value || '');
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines;
}

async function batchPreview() {
  const lines = parseBatchLines();
  if (lines.length === 0) {
    toast('请先输入批量内容');
    return;
  }
  if (lines.length > 50) {
    toast('最多 50 条');
    return;
  }

  els.batchGrid.innerHTML = '';
  const previewSettings = {
    ...settings,
    mode: 'single',
    sizePx: 256,
    caption: { ...settings.caption, enabled: false },
  };

  for (let i = 0; i < lines.length; i++) {
    const payload = lines[i];
    try {
      const enc = encodeQrMatrix(payload, previewSettings.ecc);
      const off = document.createElement('canvas');
      await renderToCanvas(off, enc.matrix, previewSettings);
      const url = off.toDataURL('image/png');

      const item = document.createElement('div');
      item.className = 'batchItem';
      item.innerHTML = `
        <img alt="qr" src="${url}" />
        <div class="mini">${payload.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      `;
      els.batchGrid.appendChild(item);
    } catch {
      const item = document.createElement('div');
      item.className = 'batchItem';
      item.textContent = `第 ${i + 1} 条编码失败`;
      els.batchGrid.appendChild(item);
    }
  }
  toast(`已生成 ${lines.length} 个预览`);
}

async function batchZip() {
  const lines = parseBatchLines();
  if (lines.length === 0) {
    toast('请先输入批量内容');
    return;
  }
  if (lines.length > 50) {
    toast('最多 50 条');
    return;
  }

  const prefix = (String(els.batchPrefix.value || 'qr').trim() || 'qr').replace(/[^a-zA-Z0-9_-]/g, '_');
  const files = [];

  const fullSettings = { ...settings, mode: 'single' };
  els.previewMeta.textContent = `正在生成 ZIP（${lines.length} 条）...`;

  for (let i = 0; i < lines.length; i++) {
    const payload = lines[i];
    const enc = encodeQrMatrix(payload, fullSettings.ecc);
    const off = document.createElement('canvas');
    await renderToCanvas(off, enc.matrix, fullSettings);
    const data = await canvasToPngBytes(off);
    const name = `${prefix}-${String(i + 1).padStart(4, '0')}.png`;
    files.push({ name, data });
  }

  const zip = zipStore(files);
  downloadBlob(zip, `${prefix}.zip`);
  toast('ZIP 已下载');
  els.previewMeta.textContent = '批量模式：预览列表与 ZIP 导出';
}

function attachListeners() {
  for (const b of els.segButtons) {
    b.addEventListener('click', () => setMode(b.dataset.mode));
  }

  els.payloadType.addEventListener('change', () => {
    settings.payloadType = els.payloadType.value;
    renderPayloadForm();
    scheduleUpdate();
  });

  const onChange = (el) => {
    el.addEventListener('input', () => {
      syncSettingsFromControls();
      scheduleUpdate();
    });
    el.addEventListener('change', () => {
      syncSettingsFromControls();
      scheduleUpdate();
    });
  };

  onChange(els.ecc);
  onChange(els.sizePx);
  onChange(els.marginModules);
  onChange(els.fg);
  onChange(els.bg);
  onChange(els.gradientEnabled);
  onChange(els.gradientColor2);
  onChange(els.gradientAngle);
  onChange(els.moduleShape);
  onChange(els.eyeStyle);
  onChange(els.moduleInsetEnabled);
  onChange(els.moduleInset);

  onChange(els.logoEnabled);
  onChange(els.logoScale);
  els.logoFile.addEventListener('change', (e) => onLogoFile(e.target.files?.[0]));

  onChange(els.captionEnabled);
  onChange(els.captionTitle);
  onChange(els.captionSubtitle);
  onChange(els.cardEnabled);
  onChange(els.cardRadius);
  onChange(els.cardPadding);

  els.btnShareLink.addEventListener('click', (e) => {
    e.preventDefault();
    copyShareLink();
  });
  els.btnReset.addEventListener('click', (e) => {
    e.preventDefault();
    settings = structuredClone(DEFAULTS);
    lastMatrixKey = '';
    lastMatrix = null;
    syncControlsFromSettings();
    renderPayloadForm();
    setMode('single');
    toast('已重置');
  });

  els.btnPng.addEventListener('click', exportPng);
  els.btnSvg.addEventListener('click', exportSvg);
  els.btnCopy.addEventListener('click', copyPng);

  els.btnBatchPreview.addEventListener('click', batchPreview);
  els.btnBatchZip.addEventListener('click', batchZip);

  els.btnSavePreset.addEventListener('click', () => {
    syncSettingsFromControls();
    const name = prompt('预设名称：', '我的样式');
    if (!name) return;
    const p = makePreset(settings, name.trim(), !!els.presetIncludeContent.checked);
    presets = [p, ...presets].slice(0, 30);
    try {
      savePresets(presets);
      refreshPresetsUI();
      els.presetSelect.value = p.id;
      toast('预设已保存');
    } catch {
      toast('无法保存预设（localStorage 不可用）');
    }
  });

  els.presetSelect.addEventListener('change', () => {
    const id = els.presetSelect.value;
    if (!id) return;
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    settings = applyPreset(settings, p.settings);
    lastMatrixKey = '';
    lastMatrix = null;
    syncControlsFromSettings();
    renderPayloadForm();
    scheduleUpdate();
    toast(`已应用预设：${p.name}`);
  });
}

function init() {
  // Load presets
  presets = loadPresets();
  refreshPresetsUI();

  // Load from share link
  const fromHash = tryLoadFromShareHash();
  if (fromHash && typeof fromHash === 'object') {
    settings = applyPreset(settings, fromHash);
    toast('已从分享链接恢复配置');
  }

  syncControlsFromSettings();
  renderPayloadForm();
  attachListeners();
  setMode('single');
}

init();
