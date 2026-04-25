import { decodeJsonFromBase64Url, encodeJsonToBase64Url } from './utils.js';

const PRESETS_KEY = 'qr_presets_v1';

export function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function makePreset(settings, name, includeContent) {
  const id = `p_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  const createdAt = new Date().toISOString();

  const styleOnly = {
    ecc: settings.ecc,
    sizePx: settings.sizePx,
    marginModules: settings.marginModules,
    fg: settings.fg,
    bg: settings.bg,
    gradient: settings.gradient,
    moduleShape: settings.moduleShape,
    eyeStyle: settings.eyeStyle,
    moduleEffect: settings.moduleEffect,
    logo: { enabled: settings.logo.enabled, dataUrl: settings.logo.dataUrl || null, scale: settings.logo.scale },
    caption: settings.caption,
    card: settings.card,
  };

  const content = includeContent
    ? {
        payloadType: settings.payloadType,
        payload: settings.payload,
        url: settings.url,
        wifi: settings.wifi,
        vcard: settings.vcard,
        mecard: settings.mecard,
        tel: settings.tel,
        sms: settings.sms,
        email: settings.email,
        geo: settings.geo,
        event: settings.event,
      }
    : {};

  return { id, name, createdAt, settings: { ...styleOnly, ...content } };
}

export function applyPreset(settings, presetSettings) {
  return {
    ...settings,
    ...presetSettings,
    gradient: { ...settings.gradient, ...(presetSettings.gradient || {}) },
    moduleEffect: { ...settings.moduleEffect, ...(presetSettings.moduleEffect || {}) },
    logo: { ...settings.logo, ...(presetSettings.logo || {}) },
    caption: { ...settings.caption, ...(presetSettings.caption || {}) },
    card: { ...settings.card, ...(presetSettings.card || {}) },
    wifi: { ...settings.wifi, ...(presetSettings.wifi || {}) },
    vcard: { ...settings.vcard, ...(presetSettings.vcard || {}) },
    mecard: { ...settings.mecard, ...(presetSettings.mecard || {}) },
    url: { ...settings.url, ...(presetSettings.url || {}) },
    sms: { ...settings.sms, ...(presetSettings.sms || {}) },
    email: { ...settings.email, ...(presetSettings.email || {}) },
    geo: { ...settings.geo, ...(presetSettings.geo || {}) },
    event: { ...settings.event, ...(presetSettings.event || {}) },
    image: { ...(settings.image || {}), ...((presetSettings.image) || {}) },
    file: { ...(settings.file || {}), ...((presetSettings.file) || {}) },
    audio: { ...(settings.audio || {}), ...((presetSettings.audio) || {}) },
    video: { ...(settings.video || {}), ...((presetSettings.video) || {}) },
    form: { ...(settings.form || {}), ...((presetSettings.form) || {}) },
    h5: { ...(settings.h5 || {}), ...((presetSettings.h5) || {}) },
    social: { ...(settings.social || {}), ...((presetSettings.social) || {}) },
    multi: { ...(settings.multi || {}), ...((presetSettings.multi) || {}) },
  };
}

export function makeShareHash(settings, { excludeSensitive } = {}) {
  const safe = { ...settings };
  if (excludeSensitive) {
    // WiFi password is the primary sensitive field we handle explicitly.
    safe.wifi = { ...safe.wifi, password: '' };
  }

  const encoded = encodeJsonToBase64Url(safe);
  return `#s=${encoded}`;
}

export function tryLoadFromShareHash() {
  const m = /#s=([^&]+)/.exec(location.hash || '');
  if (!m) return null;
  try {
    return decodeJsonFromBase64Url(m[1]);
  } catch {
    return null;
  }
}
