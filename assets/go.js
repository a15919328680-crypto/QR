import { $, decodeJsonFromBase64Url } from './utils.js';

function parsePayload() {
  const m = /#p=([^&]+)/.exec(location.hash || '');
  if (!m) return null;
  try {
    return decodeJsonFromBase64Url(m[1]);
  } catch {
    return null;
  }
}

function normalizeLinks(obj) {
  const raw = obj && typeof obj === 'object' ? obj : {};
  const entries = Array.isArray(raw.entries) ? raw.entries : null;

  const targets = (() => {
    if (entries) {
      return entries
        .map((e) => ({
          label: String(e && e.label ? e.label : '').trim(),
          url: String(e && e.url ? e.url : '').trim(),
        }))
        .filter((t) => t.label && t.url);
    }

    const links = raw.links && typeof raw.links === 'object' ? raw.links : raw;
    const pick = (k) => String(links[k] || '').trim();
    return [
      { label: '微信', url: pick('wechat') },
      { label: 'QQ', url: pick('qq') },
      { label: '抖音', url: pick('douyin') },
      { label: '小红书', url: pick('xhs') },
      { label: '公众号', url: pick('mp') },
      { label: '网页打开', url: pick('web') },
    ].filter((t) => t.url);
  })();

  return {
    title: String(raw.title || '').trim(),
    desc: String(raw.desc || '').trim(),
    auto: !!raw.auto,
    targets,
  };
}

function safeNavigate(url) {
  // Some deep links may throw; keep it best-effort.
  try {
    location.href = url;
  } catch {
    // ignore
  }
}

function isMobileUa(ua) {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function pickAutoTarget(cfg) {
  const ua = navigator.userAgent || '';
  if (!isMobileUa(ua)) return null;

  const targets = Array.isArray(cfg.targets) ? cfg.targets : [];
  if (!targets.length) return null;

  const findBy = (pred) => targets.find((t) => {
    try {
      return pred(t);
    } catch {
      return false;
    }
  });

  const findLabel = (kw) => findBy((t) => String(t.label || '').includes(kw));
  const findScheme = (re) => findBy((t) => re.test(String(t.url || '')));
  const web = findLabel('网页') || findScheme(/^https?:\/\//i) || null;

  // WeChat
  if (/MicroMessenger/i.test(ua)) {
    return (
      findLabel('微信') ||
      findScheme(/^weixin:\/\//i) ||
      findScheme(/^https?:\/\/mp\.weixin\.qq\.com\//i) ||
      web
    );
  }

  // QQ
  if (/\bQQ\//i.test(ua) || /\bMQQBrowser\//i.test(ua)) {
    return (
      findLabel('QQ') ||
      findScheme(/^mqq:\/\//i) ||
      web
    );
  }

  // Douyin/Aweme
  if (/aweme/i.test(ua) || /douyin/i.test(ua) || /com\.ss\.android\.ugc\.aweme/i.test(ua)) {
    return (
      findLabel('抖音') ||
      findScheme(/^snssdk\d+:\/\//i) ||
      web
    );
  }

  // Xiaohongshu
  if (/xiaohongshu/i.test(ua) || /xhs/i.test(ua)) {
    return (
      findLabel('小红书') ||
      findScheme(/^xhs\w*:\/\//i) ||
      web
    );
  }

  // Default: prefer web fallback, otherwise first.
  return web || targets[0];
}

function render(cfg) {
  const titleEl = $('#title');
  const descEl = $('#desc');
  const btnsEl = $('#btns');
  if (!btnsEl) return;

  const title = cfg.title || '选择打开方式';
  titleEl.textContent = title;
  descEl.textContent = cfg.desc || '如果无法自动跳转，请手动选择。';

  btnsEl.innerHTML = '';
  for (const t of cfg.targets) {
    const a = document.createElement('a');
    a.className = 'btn';
    a.href = t.url;
    a.rel = 'noreferrer';
    a.textContent = t.label;
    a.addEventListener('click', (e) => {
      // Prefer JS navigation for deep links.
      e.preventDefault();
      safeNavigate(t.url);
    });
    const s = document.createElement('span');
    s.className = 'muted';
    s.textContent = '打开';
    a.appendChild(s);
    btnsEl.appendChild(a);
  }

  if (cfg.auto) {
    const auto = pickAutoTarget(cfg);
    if (auto && auto.url) {
      window.setTimeout(() => safeNavigate(auto.url), 220);
    }
  }
}

const raw = parsePayload();
if (!raw) {
  render({ title: '参数缺失', desc: '该二维码未包含跳转配置。', auto: false, targets: [] });
} else {
  const cfg = normalizeLinks(raw);
  if (!cfg.targets.length) {
    render({ title: cfg.title || '无可用链接', desc: cfg.desc || '该二维码未提供可打开的链接。', auto: false, targets: [] });
  } else {
    render(cfg);
  }
}
