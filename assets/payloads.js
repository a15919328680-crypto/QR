function esc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, ' ');
}

export function payloadText(value) {
  return String(value || '').trim();
}

export function payloadUrlWithUtm({ url, source, medium, campaign, term, content }) {
  const u = String(url || '').trim();
  if (!u) return '';
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    // allow user to input without scheme
    try {
      parsed = new URL(`https://${u}`);
    } catch {
      return '';
    }
  }

  const params = parsed.searchParams;
  const setIf = (k, v) => {
    const s = String(v || '').trim();
    if (s) params.set(k, s);
  };
  setIf('utm_source', source);
  setIf('utm_medium', medium);
  setIf('utm_campaign', campaign);
  setIf('utm_term', term);
  setIf('utm_content', content);
  return parsed.toString();
}

export function payloadWifi({ ssid, auth, password, hidden }) {
  const T = auth && auth !== 'nopass' ? auth : 'nopass';
  const S = esc(ssid);
  const P = esc(password);
  const H = hidden ? 'true' : 'false';
  // WiFi QR format: WIFI:T:WPA;S:MySSID;P:mypass;H:false;;
  return `WIFI:T:${T};S:${S};P:${P};H:${H};;`;
}

export function payloadVCard({ name, phone, email, org, title, url }) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
  ];
  if (name) lines.push(`FN:${esc(name)}`);
  if (org) lines.push(`ORG:${esc(org)}`);
  if (title) lines.push(`TITLE:${esc(title)}`);
  if (phone) lines.push(`TEL:${esc(phone)}`);
  if (email) lines.push(`EMAIL:${esc(email)}`);
  if (url) lines.push(`URL:${esc(url)}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

export function payloadMeCard({ name, phone, email, org, title, url, note }) {
  // MECARD:N:NAME;TEL:123;EMAIL:a@b.com;ORG:...;URL:...;NOTE:...;;
  const parts = ['MECARD:'];
  const add = (k, v) => {
    const s = String(v || '').trim();
    if (!s) return;
    parts.push(`${k}:${esc(s)};`);
  };
  add('N', name);
  add('TEL', phone);
  add('EMAIL', email);
  add('ORG', org);
  add('TITLE', title);
  add('URL', url);
  add('NOTE', note);
  parts.push(';');
  return parts.join('');
}

export function payloadTel(phone) {
  const p = String(phone || '').trim();
  return p ? `tel:${p}` : '';
}

export function payloadSms({ phone, body }) {
  const p = String(phone || '').trim();
  const b = String(body || '').trim();
  if (!p && !b) return '';
  const q = b ? `?body=${encodeURIComponent(b)}` : '';
  return `sms:${p}${q}`;
}

export function payloadEmail({ to, subject, body }) {
  const t = String(to || '').trim();
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const q = params.toString();
  return `mailto:${t}${q ? `?${q}` : ''}`;
}

export function payloadGeo({ lat, lon, query }) {
  const la = String(lat || '').trim();
  const lo = String(lon || '').trim();
  const q = String(query || '').trim();
  if (!la || !lo) return '';
  return q ? `geo:${la},${lo}?q=${encodeURIComponent(q)}` : `geo:${la},${lo}`;
}

export function payloadEvent({ title, location, start, end, notes }) {
  // Minimal iCalendar VEVENT
  // Accept ISO-like input; normalize to UTC-ish format if possible.
  const dt = (v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };

  const DTSTART = dt(start);
  const DTEND = dt(end);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
  ];
  if (title) lines.push(`SUMMARY:${esc(title)}`);
  if (location) lines.push(`LOCATION:${esc(location)}`);
  if (DTSTART) lines.push(`DTSTART:${DTSTART}`);
  if (DTEND) lines.push(`DTEND:${DTEND}`);
  if (notes) lines.push(`DESCRIPTION:${esc(notes)}`);
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');
  return lines.join('\n');
}
