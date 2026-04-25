import {
  $,
  clamp,
  debounce,
  canvasToPngBytes,
  downloadBlob,
  encodeJsonToBase64Url,
  hexToRgb,
  relativeLuminance,
} from './utils.js';
import {
  payloadUrlWithUtm,
  payloadEmail,
  payloadEvent,
  payloadGeo,
  payloadSms,
  payloadTel,
  payloadText,
  payloadMeCard,
  payloadVCard,
  payloadWifi,
} from './payloads.js';
import { encodeQrMatrix } from './qr/encoder.js';
import { renderToCanvas } from './qr/renderer-canvas.js';
import { renderToSvg } from './qr/renderer-svg.js';
import { applyPreset, makeShareHash, tryLoadFromShareHash } from './storage.js';
import { zipStore } from './zip.js';

const DEFAULTS = {
  mode: 'single',
  payloadType: 'text',
  payload: 'https://example.com',
  url: { url: 'https://example.com', source: '', medium: '', campaign: '', term: '', content: '' },
  wifi: { ssid: '', auth: 'WPA', password: '', hidden: false },
  vcard: { name: '', phone: '', email: '', org: '', title: '', url: '' },
  mecard: { name: '', phone: '', email: '', org: '', title: '', url: '', note: '' },
  tel: { phone: '' },
  sms: { phone: '', body: '' },
  email: { to: '', subject: '', body: '' },
  geo: { lat: '', lon: '', query: '' },
  event: { title: '', location: '', start: '', end: '', notes: '' },

  image: { url: '' },
  file: { url: '' },
  audio: { url: '' },
  video: { url: '' },
  form: { url: '' },
  h5: { url: '' },
  social: { title: '', web: '', wechat: '', qq: '', douyin: '', xhs: '', mp: '' },
  multi: { title: '', desc: '', web: '', aLabel: '', aUrl: '', bLabel: '', bUrl: '', cLabel: '', cUrl: '' },

  ecc: 'M',
  sizePx: 512,
  marginModules: 4,
  fg: '#0b1220',
  bg: '#ffffff',
  bgTransparent: false,
  gradient: { enabled: false, color2: '#4f46e5', angleDeg: 45 },
  moduleShape: 'rounded',
  eyeStyle: 'rounded',
  moduleEffect: { insetEnabled: false, inset: 0.12 },
  logo: { enabled: false, dataUrl: null, scale: 0.2 },
  caption: { enabled: false, title: '扫码访问', subtitle: 'example.com' },
  card: { enabled: true, radius: 20, paddingPx: 22, bg: '#ffffff' },
};

function normalizeHttpUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  try {
    return new URL(s).toString();
  } catch {
    try {
      return new URL(`https://${s}`).toString();
    } catch {
      return s;
    }
  }
}

function buildGoUrl(config) {
  // Redirect landing page that lives next to index.html.
  const u = new URL('./go.html', location.href);
  u.hash = `p=${encodeJsonToBase64Url(config)}`;
  return u.toString();
}

const BUILTIN_PRESETS = [
  {
    id: 'builtin:standard',
    name: '标准通用商用款',
    tags: ['featured', 'standard'],
    settings: {
      fg: '#111827',
      bg: '#ffffff',
      bgTransparent: false,
      gradient: { enabled: false },
      moduleShape: 'square',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: false },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:tech-min',
    name: '科技极简风',
    tags: ['featured', 'tech'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      bgTransparent: false,
      gradient: { enabled: true, color2: '#38bdf8', angleDeg: 45 },
      moduleShape: 'square',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: true, inset: 0.09 },
      card: { enabled: true, radius: 18, paddingPx: 18 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:vi-business',
    name: '企业商务VI风',
    tags: ['featured', 'business'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      bgTransparent: false,
      gradient: { enabled: false },
      moduleShape: 'soft',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: true, inset: 0.10 },
      card: { enabled: true, radius: 20, paddingPx: 20 },
      caption: { enabled: true, title: '扫码访问', subtitle: '官方入口' },
    },
  },
  {
    id: 'builtin:ins-lux',
    name: '轻奢高级ins风',
    tags: ['featured', 'lux'],
    settings: {
      fg: '#1f2937',
      bg: '#ffffff',
      bgTransparent: false,
      gradient: { enabled: true, color2: '#a78bfa', angleDeg: 60 },
      moduleShape: 'rounded',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 26, paddingPx: 24 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:bw-classic',
    name: '极简黑白经典风',
    tags: ['featured', 'bw'],
    settings: {
      fg: '#000000',
      bg: '#ffffff',
      bgTransparent: false,
      gradient: { enabled: false },
      moduleShape: 'square',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: false },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:transparent',
    name: '透明背景专用',
    tags: ['featured', 'transparent'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      bgTransparent: true,
      gradient: { enabled: false },
      moduleShape: 'square',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: false },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:black-gold',
    name: '高端黑金品牌风',
    tags: ['featured', 'premium'],
    settings: {
      fg: '#f59e0b',
      bg: '#070a12',
      bgTransparent: false,
      gradient: { enabled: true, color2: '#fde68a', angleDeg: 25 },
      moduleShape: 'soft',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 22, paddingPx: 22 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:cute-soft',
    name: '圆角柔和可爱风',
    tags: ['featured', 'cute'],
    settings: {
      fg: '#0f172a',
      bg: '#ffffff',
      bgTransparent: false,
      gradient: { enabled: true, color2: '#fda4af', angleDeg: 40 },
      moduleShape: 'soft',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 28, paddingPx: 26 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:studio',
    name: '工作室质感',
    tags: ['business'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      bgTransparent: false,
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
    tags: ['neon'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      bgTransparent: false,
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
    tags: ['tech'],
    settings: {
      fg: '#111827',
      bg: '#ffffff',
      bgTransparent: false,
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
    tags: ['poster'],
    settings: {
      fg: '#111827',
      bg: '#ffffff',
      bgTransparent: false,
      gradient: { enabled: true, color2: '#4f46e5', angleDeg: 60 },
      moduleShape: 'rounded',
      eyeStyle: 'orbit',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 28, paddingPx: 26 },
      caption: { enabled: true, title: '扫码领取资料', subtitle: '活动入口' },
    },
  },
  {
    id: 'builtin:minimal',
    name: '极简黑白',
    tags: ['minimal', 'business'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      bgTransparent: false,
      gradient: { enabled: false },
      moduleShape: 'square',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: false },
      caption: { enabled: false },
    },
  },

  // More styles, shown in the "all" view.
  {
    id: 'builtin:mono-paper',
    name: '纸感黑白',
    tags: ['print'],
    settings: {
      fg: '#111827',
      bg: '#f8fafc',
      gradient: { enabled: false },
      moduleShape: 'square',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: true, inset: 0.09 },
      card: { enabled: false },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:dot-clean',
    name: '清爽圆点',
    tags: ['clean'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      gradient: { enabled: false },
      moduleShape: 'dot',
      eyeStyle: 'ring',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 22, paddingPx: 22 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:mint-soft',
    name: '薄荷清新',
    tags: ['pastel'],
    settings: {
      fg: '#0f172a',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#34d399', angleDeg: 35 },
      moduleShape: 'soft',
      eyeStyle: 'orbit',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 24, paddingPx: 22 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:lavender',
    name: '薰衣草渐变',
    tags: ['pastel'],
    settings: {
      fg: '#312e81',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#a78bfa', angleDeg: 55 },
      moduleShape: 'rounded',
      eyeStyle: 'double',
      moduleEffect: { insetEnabled: true, inset: 0.10 },
      card: { enabled: true, radius: 26, paddingPx: 24 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:rose-gold',
    name: '玫瑰金',
    tags: ['warm'],
    settings: {
      fg: '#fb7185',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#fbbf24', angleDeg: 25 },
      moduleShape: 'soft',
      eyeStyle: 'ring',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 24, paddingPx: 22 },
      caption: { enabled: true, title: '扫码领取', subtitle: '限时福利' },
    },
  },
  {
    id: 'builtin:skyline',
    name: '天际蓝',
    tags: ['cool'],
    settings: {
      fg: '#0f172a',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#38bdf8', angleDeg: 65 },
      moduleShape: 'blob',
      eyeStyle: 'orbit',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 28, paddingPx: 26 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:lime-pop',
    name: '酸柠冲击',
    tags: ['pop'],
    settings: {
      fg: '#111827',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#a3e635', angleDeg: 15 },
      moduleShape: 'rounded',
      eyeStyle: 'notched',
      moduleEffect: { insetEnabled: true, inset: 0.08 },
      card: { enabled: true, radius: 20, paddingPx: 20 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:business-card',
    name: '商务名片',
    tags: ['business'],
    settings: {
      fg: '#111827',
      bg: '#ffffff',
      gradient: { enabled: false },
      moduleShape: 'soft',
      eyeStyle: 'double',
      moduleEffect: { insetEnabled: true, inset: 0.10 },
      card: { enabled: true, radius: 18, paddingPx: 18 },
      caption: { enabled: true, title: '扫码添加联系人', subtitle: '名片二维码' },
    },
  },
  {
    id: 'builtin:ticket',
    name: '活动票券',
    tags: ['event'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#f97316', angleDeg: 60 },
      moduleShape: 'dot',
      eyeStyle: 'ring',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 30, paddingPx: 26 },
      caption: { enabled: true, title: '扫码签到', subtitle: '活动入口' },
    },
  },
  {
    id: 'builtin:coffee',
    name: '咖啡馆菜单',
    tags: ['brand'],
    settings: {
      fg: '#2b1d12',
      bg: '#fff7ed',
      gradient: { enabled: false },
      moduleShape: 'rounded',
      eyeStyle: 'rounded',
      moduleEffect: { insetEnabled: true, inset: 0.09 },
      card: { enabled: true, radius: 22, paddingPx: 22 },
      caption: { enabled: true, title: '扫码查看菜单', subtitle: '今日推荐' },
    },
  },
  {
    id: 'builtin:forest',
    name: '森林绿',
    tags: ['nature'],
    settings: {
      fg: '#052e16',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#22c55e', angleDeg: 45 },
      moduleShape: 'soft',
      eyeStyle: 'orbit',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 26, paddingPx: 24 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:crisp-gray',
    name: '冷灰质感',
    tags: ['neutral'],
    settings: {
      fg: '#0b1220',
      bg: '#f3f4f6',
      gradient: { enabled: false },
      moduleShape: 'square',
      eyeStyle: 'notched',
      moduleEffect: { insetEnabled: true, inset: 0.08 },
      card: { enabled: true, radius: 16, paddingPx: 18 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:purple-night',
    name: '暗紫氛围',
    tags: ['dark'],
    settings: {
      fg: '#e9d5ff',
      bg: '#0b1020',
      gradient: { enabled: true, color2: '#38bdf8', angleDeg: 35 },
      moduleShape: 'rounded',
      eyeStyle: 'ring',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 24, paddingPx: 22 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:cyber-invert',
    name: '赛博反转',
    tags: ['dark'],
    settings: {
      fg: '#ffffff',
      bg: '#070a12',
      gradient: { enabled: true, color2: '#22c55e', angleDeg: 10 },
      moduleShape: 'dot',
      eyeStyle: 'double',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 26, paddingPx: 24 },
      caption: { enabled: true, title: '扫码进入', subtitle: 'Night Mode' },
    },
  },
  {
    id: 'builtin:retro-sun',
    name: '复古日落',
    tags: ['retro'],
    settings: {
      fg: '#7c2d12',
      bg: '#fff7ed',
      gradient: { enabled: true, color2: '#fb7185', angleDeg: 70 },
      moduleShape: 'blob',
      eyeStyle: 'orbit',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 30, paddingPx: 26 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:ocean-depth',
    name: '深海蓝',
    tags: ['cool'],
    settings: {
      fg: '#0f172a',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#0ea5e9', angleDeg: 30 },
      moduleShape: 'rounded',
      eyeStyle: 'notched',
      moduleEffect: { insetEnabled: true, inset: 0.10 },
      card: { enabled: true, radius: 22, paddingPx: 22 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:brand-purple',
    name: '品牌紫',
    tags: ['brand'],
    settings: {
      fg: '#312e81',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#4f46e5', angleDeg: 45 },
      moduleShape: 'soft',
      eyeStyle: 'double',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 22, paddingPx: 22 },
      caption: { enabled: true, title: '扫码了解更多', subtitle: '品牌主页' },
    },
  },
  {
    id: 'builtin:qr-sticker',
    name: '贴纸风',
    tags: ['fun'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      gradient: { enabled: false },
      moduleShape: 'dot',
      eyeStyle: 'orbit',
      moduleEffect: { insetEnabled: true, inset: 0.09 },
      card: { enabled: true, radius: 36, paddingPx: 30 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:clean-caption',
    name: '标题说明',
    tags: ['caption'],
    settings: {
      fg: '#0b1220',
      bg: '#ffffff',
      gradient: { enabled: false },
      moduleShape: 'rounded',
      eyeStyle: 'rounded',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 22, paddingPx: 22 },
      caption: { enabled: true, title: '扫码访问', subtitle: '链接已校验' },
    },
  },
  {
    id: 'builtin:quiet-gray',
    name: '安静灰',
    tags: ['neutral'],
    settings: {
      fg: '#111827',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#94a3b8', angleDeg: 50 },
      moduleShape: 'square',
      eyeStyle: 'square',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: false },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:gold-premium',
    name: '金色高级',
    tags: ['premium'],
    settings: {
      fg: '#92400e',
      bg: '#fffdf7',
      gradient: { enabled: true, color2: '#f59e0b', angleDeg: 35 },
      moduleShape: 'soft',
      eyeStyle: 'double',
      moduleEffect: { insetEnabled: true, inset: 0.09 },
      card: { enabled: true, radius: 22, paddingPx: 22 },
      caption: { enabled: false },
    },
  },
  {
    id: 'builtin:teal-data',
    name: '青绿数据感',
    tags: ['tech'],
    settings: {
      fg: '#0f172a',
      bg: '#ffffff',
      gradient: { enabled: true, color2: '#14b8a6', angleDeg: 20 },
      moduleShape: 'blob',
      eyeStyle: 'notched',
      moduleEffect: { insetEnabled: false, inset: 0.12 },
      card: { enabled: true, radius: 20, paddingPx: 20 },
      caption: { enabled: false },
    },
  },
];

let settings = structuredClone(DEFAULTS);
let presetTag = 'featured';
let activePresetId = null;

const SCENES = [
  // 1) 私域引流
  { id: 'scene:private:moment', cat: 'private', name: '朋友圈', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:ins-lux', caption: { title: '扫码了解详情', subtitle: '朋友圈入口' } },
  { id: 'scene:private:shortvideo', cat: 'private', name: '短视频', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:tech-min', caption: { title: '扫码获取链接', subtitle: '视频简介' } },
  { id: 'scene:private:poster', cat: 'private', name: '海报', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:ins-lux', caption: { title: '扫码参与', subtitle: '活动海报' } },
  { id: 'scene:private:storefront', cat: 'private', name: '门头', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码进店', subtitle: '欢迎光临' } },
  { id: 'scene:private:card', cat: 'private', name: '名片', payloadType: 'vcard', exportTemplate: 'card1200x800', presetId: 'builtin:vi-business', caption: { title: '扫码添加', subtitle: '名片二维码' } },
  { id: 'scene:private:offline', cat: 'private', name: '线下地推', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码领取', subtitle: '现场福利' } },

  // 2) 商业收款
  { id: 'scene:payment:wechat', cat: 'payment', name: '微信收款', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '微信扫码支付', subtitle: '' } },
  { id: 'scene:payment:alipay', cat: 'payment', name: '支付宝收款', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '支付宝扫码支付', subtitle: '' } },
  { id: 'scene:payment:aggregate', cat: 'payment', name: '聚合支付', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码支付', subtitle: '支持多种方式' } },
  { id: 'scene:payment:pos', cat: 'payment', name: '门店收银', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:vi-business', caption: { title: '扫码付款', subtitle: '收银台' } },

  // 3) 门店经营
  { id: 'scene:store:order', cat: 'store', name: '扫码点餐', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:cute-soft', caption: { title: '扫码点餐', subtitle: '下单更快' } },
  { id: 'scene:store:queue', cat: 'store', name: '排队取号', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码取号', subtitle: '排队叫号' } },
  { id: 'scene:store:coupon', cat: 'store', name: '优惠券核销', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:vi-business', caption: { title: '扫码核销', subtitle: '优惠券' } },
  { id: 'scene:store:member', cat: 'store', name: '会员注册', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:ins-lux', caption: { title: '扫码加入会员', subtitle: '权益升级' } },

  // 4) 办公活动
  { id: 'scene:office:checkin', cat: 'office', name: '会议签到', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:vi-business', caption: { title: '扫码签到', subtitle: '会议入口' } },
  { id: 'scene:office:signup', cat: 'office', name: '活动报名', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:ins-lux', caption: { title: '扫码报名', subtitle: '活动信息' } },
  { id: 'scene:office:visitor', cat: 'office', name: '访客登记', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码登记', subtitle: '访客信息' } },
  { id: 'scene:office:attendance', cat: 'office', name: '员工考勤', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码打卡', subtitle: '考勤入口' } },

  // 5) 资料传播
  { id: 'scene:docs:download', cat: 'docs', name: '文件下载', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:tech-min', caption: { title: '扫码下载文件', subtitle: '资料入口' } },
  { id: 'scene:docs:form', cat: 'docs', name: '表单收集', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:standard', caption: { title: '扫码填写表单', subtitle: '信息收集' } },
  { id: 'scene:docs:resume', cat: 'docs', name: '简历', payloadType: 'mecard', exportTemplate: 'card1200x800', presetId: 'builtin:vi-business', caption: { title: '扫码查看简历', subtitle: '个人信息' } },
  { id: 'scene:docs:redirect', cat: 'docs', name: '链接跳转', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码打开链接', subtitle: '' } },

  // 6) 生活便民
  { id: 'scene:life:navi', cat: 'life', name: '导航地址', payloadType: 'geo', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码导航', subtitle: '一键到达' } },
  { id: 'scene:life:contact', cat: 'life', name: '联系方式', payloadType: 'mecard', exportTemplate: 'card1200x800', presetId: 'builtin:vi-business', caption: { title: '扫码保存联系', subtitle: '' } },
  { id: 'scene:life:device', cat: 'life', name: '共享设备', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码使用设备', subtitle: '' } },
  { id: 'scene:life:parking', cat: 'life', name: '停车缴费', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码缴费', subtitle: '停车场' } },

  // 7) 品牌推广
  { id: 'scene:brand:website', cat: 'brand', name: '官网', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:brand-purple', caption: { title: '扫码访问官网', subtitle: '品牌主页' } },
  { id: 'scene:brand:miniprogram', cat: 'brand', name: '小程序', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:vi-business', caption: { title: '扫码进入小程序', subtitle: '' } },
  { id: 'scene:brand:mp', cat: 'brand', name: '公众号', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:ins-lux', caption: { title: '扫码关注公众号', subtitle: '' } },
  { id: 'scene:brand:product', cat: 'brand', name: '产品介绍', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:poster', caption: { title: '扫码了解产品', subtitle: '产品介绍' } },
  { id: 'scene:brand:promo', cat: 'brand', name: '品牌宣传', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:ins-lux', caption: { title: '扫码了解品牌', subtitle: '品牌故事' } },

  // 8) 溯源管理
  { id: 'scene:trace:anti', cat: 'trace', name: '商品防伪', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码验真伪', subtitle: '' } },
  { id: 'scene:trace:logistics', cat: 'trace', name: '物流追溯', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码查物流', subtitle: '' } },
  { id: 'scene:trace:device', cat: 'trace', name: '设备标识', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:mono-paper', caption: { title: '设备信息', subtitle: '扫码查看' } },
  { id: 'scene:trace:warehouse', cat: 'trace', name: '仓储管理', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:mono-paper', caption: { title: '扫码入库/出库', subtitle: '' } },

  // 9) 政务校园
  { id: 'scene:gov:health', cat: 'gov', name: '健康登记', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:standard', caption: { title: '扫码登记', subtitle: '健康信息' } },
  { id: 'scene:gov:cert', cat: 'gov', name: '证书核验', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码核验', subtitle: '证书信息' } },
  { id: 'scene:gov:gate', cat: 'gov', name: '校园门禁', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:standard', caption: { title: '扫码通行', subtitle: '' } },
  { id: 'scene:gov:notice', cat: 'gov', name: '社区通知', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:standard', caption: { title: '扫码查看通知', subtitle: '' } },

  // 10) 个人使用
  { id: 'scene:personal:ecard', cat: 'personal', name: '电子名片', payloadType: 'mecard', exportTemplate: 'card1200x800', presetId: 'builtin:vi-business', caption: { title: '扫码保存联系', subtitle: '电子名片' } },
  { id: 'scene:personal:addfriend', cat: 'personal', name: '加好友', payloadType: 'text', exportTemplate: 'sticker800', presetId: 'builtin:cute-soft', caption: { title: '扫码加好友', subtitle: '' } },
  { id: 'scene:personal:video', cat: 'personal', name: '视频分享', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:tech-min', caption: { title: '扫码看视频', subtitle: '' } },
  { id: 'scene:personal:homepage', cat: 'personal', name: '个人主页', payloadType: 'text', exportTemplate: 'poster1080x1920', presetId: 'builtin:ins-lux', caption: { title: '扫码访问主页', subtitle: '' } },
];

let sceneCat = 'private';

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
  bg: $('#bg'),
  bgTransparent: $('#bgTransparent'),
  gradientEnabled: $('#gradientEnabled'),
  gradientControls: $('#gradientControls'),
  gradientColor2: $('#gradientColor2'),
  gradientAngle: $('#gradientAngle'),
  moduleShape: $('#moduleShape'),
  eyeStyle: $('#eyeStyle'),
  moduleInsetEnabled: $('#moduleInsetEnabled'),
  moduleInsetControls: $('#moduleInsetControls'),
  moduleInset: $('#moduleInset'),
  moduleInsetValue: $('#moduleInsetValue'),

  logoEnabled: $('#logoEnabled'),
  logoFile: $('#logoFile'),
  logoScale: $('#logoScale'),
  logoScaleValue: $('#logoScaleValue'),
  logoHint: $('#logoHint'),

  captionEnabled: $('#captionEnabled'),
  captionControls: $('#captionControls'),
  captionTitle: $('#captionTitle'),
  captionSubtitle: $('#captionSubtitle'),

  cardEnabled: $('#cardEnabled'),
  cardControls: $('#cardControls'),
  cardRadius: $('#cardRadius'),
  cardPadding: $('#cardPadding'),
  cardBg: $('#cardBg'),
  cardBgSuggestions: $('#cardBgSuggestions'),

  presetButtonsWrap: $('#presetButtonsWrap'),
  presetButtons: $('#presetButtons'),
  presetFilters: $('#presetFilters'),

  sceneFilters: $('#sceneFilters'),
  sceneButtons: $('#sceneButtons'),
  exportTemplate: $('#exportTemplate'),

  btnPng: $('#btnPng'),
  btnSvg: $('#btnSvg'),
  btnCopy: $('#btnCopy'),

  batchInput: $('#batchInput'),
  batchPrefix: $('#batchPrefix'),
  btnBatchPreview: $('#btnBatchPreview'),
  btnBatchZip: $('#btnBatchZip'),
};

function contrastRatio(aHex, bHex) {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  if (!a || !b) return null;
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

function computeQuickFixes({ modulePx }) {
  const fixes = [];
  const ecc = String(settings.ecc || 'M');

  if (Number(settings.marginModules || 4) < 4) {
    fixes.push({
      label: '留白设为 4',
      apply: () => {
        settings.marginModules = 4;
        syncControlsFromSettings();
        scheduleUpdate();
        toast('已设置留白=4');
      },
    });
  }

  if (settings.logo?.enabled && Number(settings.logo.scale || 0.2) > 0.25) {
    fixes.push({
      label: 'Logo <= 1/4',
      apply: () => {
        settings.logo.scale = 0.25;
        syncControlsFromSettings();
        scheduleUpdate();
        toast('已缩小 Logo');
      },
    });
  }

  if (String(settings.eyeStyle || 'square') !== 'square') {
    fixes.push({
      label: 'Eyes 设为方形',
      apply: () => {
        settings.eyeStyle = 'square';
        syncControlsFromSettings();
        scheduleUpdate();
        toast('已设置 Eyes=方形');
      },
    });
  }

  // Logo -> ECC suggestion
  if (settings.logo?.enabled && (ecc === 'L' || ecc === 'M')) {
    fixes.push({
      label: '建议 ECC=Q',
      apply: () => {
        settings.ecc = 'Q';
        syncControlsFromSettings();
        scheduleUpdate();
        toast('已切换 ECC=Q');
      },
    });
  }

  // Inset safety
  if (settings.moduleEffect?.insetEnabled && modulePx && modulePx < 8) {
    fixes.push({
      label: '关闭描边',
      apply: () => {
        settings.moduleEffect.insetEnabled = false;
        syncControlsFromSettings();
        scheduleUpdate();
        toast('已关闭模块描边');
      },
    });
    fixes.push({
      label: '增大尺寸',
      apply: () => {
        settings.sizePx = Math.max(640, Number(settings.sizePx || 512));
        syncControlsFromSettings();
        scheduleUpdate();
        toast('已增大尺寸');
      },
    });
  }

  // Contrast quick fix (use worst-case for gradient)
  const ratios = [];
  const bgForContrast = settings.bgTransparent ? '#ffffff' : settings.bg;
  const r1 = contrastRatio(settings.fg, bgForContrast);
  if (r1) ratios.push(r1);
  if (settings.gradient?.enabled) {
    const r2 = contrastRatio(settings.gradient.color2, bgForContrast);
    if (r2) ratios.push(r2);
  }
  const worst = ratios.length ? Math.min(...ratios) : null;
  if (worst != null && worst < 3.2) {
    fixes.push({
      label: '一键提高对比度',
      apply: () => {
        // Safe defaults: white background + dark foreground, disable gradient.
        settings.bg = '#ffffff';
        settings.fg = '#111827';
        settings.gradient.enabled = false;
        syncControlsFromSettings();
        scheduleUpdate();
        toast('已提高对比度');
      },
    });
  }

  return fixes;
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => els.toast.classList.remove('show'), 1600);
}

function setMode(mode) {
  settings.mode = mode;
  for (const b of els.segButtons) {
    const selected = b.dataset.mode === mode;
    b.setAttribute('aria-selected', selected ? 'true' : 'false');
  }
  els.singleMode.classList.toggle('hidden', mode !== 'single');
  els.batchMode.classList.toggle('hidden', mode !== 'batch');
  els.batchResults.classList.toggle('hidden', mode !== 'batch');
  update();
}

function renderPayloadForm() {
  const t = settings.payloadType;
  const html = (() => {
    if (t === 'text') {
      return `
        <label class="field">
          <span class="label">内容</span>
          <textarea id="payloadText" rows="4" placeholder="https://example.com\n或任意文本" spellcheck="false"></textarea>
        </label>
      `;
    }
    if (t === 'url') {
      return `
        <label class="field">
          <span class="label">URL</span>
          <input id="uUrl" type="text" placeholder="https://example.com" />
        </label>
        <div class="grid2">
          <label class="field"><span class="label">utm_source</span><input id="uSource" type="text" placeholder="wechat" /></label>
          <label class="field"><span class="label">utm_medium</span><input id="uMedium" type="text" placeholder="qrcode" /></label>
        </div>
        <div class="grid2">
          <label class="field"><span class="label">utm_campaign</span><input id="uCampaign" type="text" placeholder="spring" /></label>
          <label class="field"><span class="label">utm_term</span><input id="uTerm" type="text" /></label>
        </div>
        <label class="field"><span class="label">utm_content</span><input id="uContent" type="text" /></label>
        <div class="hint">提示：会自动合成带 UTM 参数的最终链接。</div>
      `;
    }
    if (t === 'wifi') {
      return `
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
    if (t === 'mecard') {
      return `
        <div class="grid2">
          <label class="field"><span class="label">姓名</span><input id="mName" type="text" /></label>
          <label class="field"><span class="label">电话</span><input id="mPhone" type="text" /></label>
        </div>
        <div class="grid2">
          <label class="field"><span class="label">邮箱</span><input id="mEmail" type="text" /></label>
          <label class="field"><span class="label">公司</span><input id="mOrg" type="text" /></label>
        </div>
        <div class="grid2">
          <label class="field"><span class="label">职位</span><input id="mTitle" type="text" /></label>
          <label class="field"><span class="label">网址</span><input id="mUrl" type="text" placeholder="https://" /></label>
        </div>
        <label class="field"><span class="label">备注</span><input id="mNote" type="text" /></label>
        <div class="hint">MeCard 在部分扫码器兼容性更好，适合线下名片场景。</div>
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

    if (t === 'image' || t === 'file' || t === 'audio' || t === 'video' || t === 'form' || t === 'h5') {
      const nameMap = {
        image: '图片链接',
        file: '文件链接',
        audio: '音频链接',
        video: '视频链接',
        form: '表单链接',
        h5: 'H5 链接',
      };
      const label = nameMap[t] || '链接';
      return `
        <label class="field">
          <span class="label">${label}</span>
          <input id="linkUrl" type="text" placeholder="https://example.com" />
        </label>
        <div class="hint">提示：二维码本质编码文本。图片/文件/音视频/表单/H5 通常建议填写可访问的 HTTPS 链接。</div>
      `;
    }

    if (t === 'social') {
      return `
        <label class="field">
          <span class="label">标题（可选）</span>
          <input id="socTitle" type="text" placeholder="例如：选择打开方式" />
        </label>

        <label class="field">
          <span class="label">网页兜底链接（建议必填）</span>
          <input id="socWeb" type="text" placeholder="https://example.com" />
        </label>

        <div class="grid2">
          <label class="field">
            <span class="label">微信链接（可选）</span>
            <input id="socWechat" type="text" placeholder="weixin://... 或 https://..." />
          </label>
          <label class="field">
            <span class="label">QQ 链接（可选）</span>
            <input id="socQq" type="text" placeholder="mqq://... 或 https://..." />
          </label>
        </div>

        <div class="grid2">
          <label class="field">
            <span class="label">抖音链接（可选）</span>
            <input id="socDouyin" type="text" placeholder="snssdk1128://... 或 https://..." />
          </label>
          <label class="field">
            <span class="label">小红书链接（可选）</span>
            <input id="socXhs" type="text" placeholder="xhsdiscover://... 或 https://..." />
          </label>
        </div>

        <label class="field">
          <span class="label">公众号链接（可选）</span>
          <input id="socMp" type="text" placeholder="https://mp.weixin.qq.com/..." />
        </label>

        <div class="hint">说明：该类型会生成一个“聚合跳转页”链接，并在页内展示多个入口。部分 App 跳转受系统/浏览器限制，建议提供网页兜底链接。</div>
      `;
    }

    if (t === 'multi') {
      return `
      <label class="field">
        <span class="label">标题（可选）</span>
        <input id="mulTitle" type="text" placeholder="例如：选择打开方式" />
      </label>
      <label class="field">
        <span class="label">说明（可选）</span>
        <input id="mulDesc" type="text" placeholder="例如：请选择要打开的平台" />
      </label>

      <label class="field">
        <span class="label">网页兜底链接（建议必填）</span>
        <input id="mulWeb" type="text" placeholder="https://example.com" />
      </label>

      <div class="grid2">
        <label class="field">
          <span class="label">入口 A 名称</span>
          <input id="mulALabel" type="text" placeholder="例如：微信" />
        </label>
        <label class="field">
          <span class="label">入口 A 链接</span>
          <input id="mulAUrl" type="text" placeholder="weixin://... 或 https://..." />
        </label>
      </div>

      <div class="grid2">
        <label class="field">
          <span class="label">入口 B 名称</span>
          <input id="mulBLabel" type="text" placeholder="例如：抖音" />
        </label>
        <label class="field">
          <span class="label">入口 B 链接</span>
          <input id="mulBUrl" type="text" placeholder="snssdk1128://... 或 https://..." />
        </label>
      </div>

      <div class="grid2">
        <label class="field">
          <span class="label">入口 C 名称</span>
          <input id="mulCLabel" type="text" placeholder="例如：小红书" />
        </label>
        <label class="field">
          <span class="label">入口 C 链接</span>
          <input id="mulCUrl" type="text" placeholder="xhsdiscover://... 或 https://..." />
        </label>
      </div>

      <div class="hint">说明：该类型会生成“聚合跳转页”链接。建议至少填写网页兜底链接，提升可用性。</div>
    `;
    }
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
  } else if (t === 'url') {
    $('#uUrl', els.payloadForm).value = settings.url.url;
    $('#uSource', els.payloadForm).value = settings.url.source;
    $('#uMedium', els.payloadForm).value = settings.url.medium;
    $('#uCampaign', els.payloadForm).value = settings.url.campaign;
    $('#uTerm', els.payloadForm).value = settings.url.term;
    $('#uContent', els.payloadForm).value = settings.url.content;
    on('uUrl', (e) => { settings.url.url = e.target.value; scheduleUpdate(); });
    on('uSource', (e) => { settings.url.source = e.target.value; scheduleUpdate(); });
    on('uMedium', (e) => { settings.url.medium = e.target.value; scheduleUpdate(); });
    on('uCampaign', (e) => { settings.url.campaign = e.target.value; scheduleUpdate(); });
    on('uTerm', (e) => { settings.url.term = e.target.value; scheduleUpdate(); });
    on('uContent', (e) => { settings.url.content = e.target.value; scheduleUpdate(); });
  } else if (t === 'wifi') {
    $('#wifiSsid', els.payloadForm).value = settings.wifi.ssid;
    $('#wifiAuth', els.payloadForm).value = settings.wifi.auth;
    $('#wifiPass', els.payloadForm).value = settings.wifi.password;
    $('#wifiHidden', els.payloadForm).checked = !!settings.wifi.hidden;
    on('wifiSsid', (e) => { settings.wifi.ssid = e.target.value; scheduleUpdate(); });
    on('wifiAuth', (e) => { settings.wifi.auth = e.target.value; scheduleUpdate(); });
    on('wifiPass', (e) => { settings.wifi.password = e.target.value; scheduleUpdate(); });
    on('wifiHidden', (e) => { settings.wifi.hidden = e.target.checked; scheduleUpdate(); });
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
  } else if (t === 'mecard') {
    $('#mName', els.payloadForm).value = settings.mecard.name;
    $('#mPhone', els.payloadForm).value = settings.mecard.phone;
    $('#mEmail', els.payloadForm).value = settings.mecard.email;
    $('#mOrg', els.payloadForm).value = settings.mecard.org;
    $('#mTitle', els.payloadForm).value = settings.mecard.title;
    $('#mUrl', els.payloadForm).value = settings.mecard.url;
    $('#mNote', els.payloadForm).value = settings.mecard.note;
    on('mName', (e) => { settings.mecard.name = e.target.value; scheduleUpdate(); });
    on('mPhone', (e) => { settings.mecard.phone = e.target.value; scheduleUpdate(); });
    on('mEmail', (e) => { settings.mecard.email = e.target.value; scheduleUpdate(); });
    on('mOrg', (e) => { settings.mecard.org = e.target.value; scheduleUpdate(); });
    on('mTitle', (e) => { settings.mecard.title = e.target.value; scheduleUpdate(); });
    on('mUrl', (e) => { settings.mecard.url = e.target.value; scheduleUpdate(); });
    on('mNote', (e) => { settings.mecard.note = e.target.value; scheduleUpdate(); });
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
  } else if (t === 'image' || t === 'file' || t === 'audio' || t === 'video' || t === 'form' || t === 'h5') {
    const map = {
      image: settings.image,
      file: settings.file,
      audio: settings.audio,
      video: settings.video,
      form: settings.form,
      h5: settings.h5,
    };
    const ref = map[t];
    $('#linkUrl', els.payloadForm).value = ref.url;
    on('linkUrl', (e) => { ref.url = e.target.value; scheduleUpdate(); });
  } else if (t === 'social') {
    $('#socTitle', els.payloadForm).value = settings.social.title;
    $('#socWeb', els.payloadForm).value = settings.social.web;
    $('#socWechat', els.payloadForm).value = settings.social.wechat;
    $('#socQq', els.payloadForm).value = settings.social.qq;
    $('#socDouyin', els.payloadForm).value = settings.social.douyin;
    $('#socXhs', els.payloadForm).value = settings.social.xhs;
    $('#socMp', els.payloadForm).value = settings.social.mp;
    on('socTitle', (e) => { settings.social.title = e.target.value; scheduleUpdate(); });
    on('socWeb', (e) => { settings.social.web = e.target.value; scheduleUpdate(); });
    on('socWechat', (e) => { settings.social.wechat = e.target.value; scheduleUpdate(); });
    on('socQq', (e) => { settings.social.qq = e.target.value; scheduleUpdate(); });
    on('socDouyin', (e) => { settings.social.douyin = e.target.value; scheduleUpdate(); });
    on('socXhs', (e) => { settings.social.xhs = e.target.value; scheduleUpdate(); });
    on('socMp', (e) => { settings.social.mp = e.target.value; scheduleUpdate(); });
  } else if (t === 'multi') {
    $('#mulTitle', els.payloadForm).value = settings.multi.title;
    $('#mulDesc', els.payloadForm).value = settings.multi.desc;
    $('#mulWeb', els.payloadForm).value = settings.multi.web;
    $('#mulALabel', els.payloadForm).value = settings.multi.aLabel;
    $('#mulAUrl', els.payloadForm).value = settings.multi.aUrl;
    $('#mulBLabel', els.payloadForm).value = settings.multi.bLabel;
    $('#mulBUrl', els.payloadForm).value = settings.multi.bUrl;
    $('#mulCLabel', els.payloadForm).value = settings.multi.cLabel;
    $('#mulCUrl', els.payloadForm).value = settings.multi.cUrl;
    on('mulTitle', (e) => { settings.multi.title = e.target.value; scheduleUpdate(); });
    on('mulDesc', (e) => { settings.multi.desc = e.target.value; scheduleUpdate(); });
    on('mulWeb', (e) => { settings.multi.web = e.target.value; scheduleUpdate(); });
    on('mulALabel', (e) => { settings.multi.aLabel = e.target.value; scheduleUpdate(); });
    on('mulAUrl', (e) => { settings.multi.aUrl = e.target.value; scheduleUpdate(); });
    on('mulBLabel', (e) => { settings.multi.bLabel = e.target.value; scheduleUpdate(); });
    on('mulBUrl', (e) => { settings.multi.bUrl = e.target.value; scheduleUpdate(); });
    on('mulCLabel', (e) => { settings.multi.cLabel = e.target.value; scheduleUpdate(); });
    on('mulCUrl', (e) => { settings.multi.cUrl = e.target.value; scheduleUpdate(); });
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
  if (t === 'url') return payloadUrlWithUtm(settings.url);
  if (t === 'wifi') return payloadWifi(settings.wifi);
  if (t === 'vcard') return payloadVCard(settings.vcard);
  if (t === 'mecard') return payloadMeCard(settings.mecard);
  if (t === 'tel') return payloadTel(settings.tel.phone);
  if (t === 'sms') return payloadSms(settings.sms);
  if (t === 'email') return payloadEmail(settings.email);
  if (t === 'geo') return payloadGeo(settings.geo);
  if (t === 'image') return payloadText(normalizeHttpUrl(settings.image.url));
  if (t === 'file') return payloadText(normalizeHttpUrl(settings.file.url));
  if (t === 'audio') return payloadText(normalizeHttpUrl(settings.audio.url));
  if (t === 'video') return payloadText(normalizeHttpUrl(settings.video.url));
  if (t === 'form') return payloadText(normalizeHttpUrl(settings.form.url));
  if (t === 'h5') return payloadText(normalizeHttpUrl(settings.h5.url));
  if (t === 'social') {
    const web = normalizeHttpUrl(settings.social.web);
    const entries = [
      { label: '微信', url: String(settings.social.wechat || '').trim() },
      { label: 'QQ', url: String(settings.social.qq || '').trim() },
      { label: '抖音', url: String(settings.social.douyin || '').trim() },
      { label: '小红书', url: String(settings.social.xhs || '').trim() },
      { label: '公众号', url: String(settings.social.mp || '').trim() },
      { label: '网页打开', url: web },
    ].filter((x) => x.url);
    return payloadText(buildGoUrl({ title: settings.social.title, auto: true, entries }));
  }
  if (t === 'multi') {
    const web = normalizeHttpUrl(settings.multi.web);
    const entries = [];
    const add = (label, url, fallback) => {
      const u = String(url || '').trim();
      if (!u) return;
      const l = String(label || '').trim() || fallback;
      entries.push({ label: l, url: u });
    };
    add(settings.multi.aLabel, settings.multi.aUrl, '入口 A');
    add(settings.multi.bLabel, settings.multi.bUrl, '入口 B');
    add(settings.multi.cLabel, settings.multi.cUrl, '入口 C');
    if (web) entries.push({ label: '网页打开', url: web });
    return payloadText(buildGoUrl({ title: settings.multi.title, desc: settings.multi.desc, auto: true, entries }));
  }
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

function renderQuickFixes(fixes) {
  if (!fixes.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'warn';
  wrap.textContent = '一键修复建议：';
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.flexWrap = 'wrap';
  row.style.marginTop = '8px';
  for (const f of fixes) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = f.label;
    b.addEventListener('click', f.apply);
    row.appendChild(b);
  }
  wrap.appendChild(row);
  els.warnings.appendChild(wrap);
}

function updateControlVisibility() {
  els.gradientControls.classList.toggle('hidden', !els.gradientEnabled.checked);
  els.captionControls.classList.toggle('hidden', !els.captionEnabled.checked);
  els.cardControls.classList.toggle('hidden', !els.cardEnabled.checked);
  els.moduleInsetControls.classList.toggle('hidden', !els.moduleInsetEnabled.checked);
}

function computeComplianceWarnings() {
  const out = [];
  if (Number(settings.marginModules || 4) < 4) out.push('留白建议 >= 4（Quiet Zone 太小会降低扫码成功率）');
  if (settings.bgTransparent) out.push('透明背景：无法评估对比度，请确保落在浅色底图上且深浅对比明显');
  if (settings.logo?.enabled && Number(settings.logo.scale || 0.2) > 0.25) out.push('Logo 建议不超过整体 1/4（过大可能遮挡数据区）');
  if (String(settings.eyeStyle || 'square') !== 'square') out.push('Eyes 风格已变化：商用/印刷建议使用“方形”以适配更多扫码器');
  return out;
}

let lastMatrixKey = '';
let lastMatrix = null;

async function update() {
  updateControlVisibility();

  els.marginModulesValue.textContent = String(settings.marginModules);
  els.logoScaleValue.textContent = Number(settings.logo.scale || 0.2).toFixed(2);
  els.moduleInsetValue.textContent = Number(settings.moduleEffect?.inset ?? 0.12).toFixed(2);

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
    const extra = computeComplianceWarnings();
    setWarnings([...extra, ...(warnings || [])]);
    renderQuickFixes(computeQuickFixes({ modulePx }));
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
  settings.bgTransparent = !!els.bgTransparent?.checked;
  settings.gradient.enabled = els.gradientEnabled.checked;
  settings.gradient.color2 = els.gradientColor2.value;
  settings.gradient.angleDeg = clamp(Number(els.gradientAngle.value || 45), 0, 359);
  settings.moduleShape = els.moduleShape.value;
  settings.eyeStyle = els.eyeStyle.value;
  settings.moduleEffect.insetEnabled = els.moduleInsetEnabled.checked;
  settings.moduleEffect.inset = clamp(Number(els.moduleInset.value || 0.12), 0.04, 0.22);
  settings.logo.enabled = els.logoEnabled.checked;
  settings.logo.scale = clamp(Number(els.logoScale.value || 0.2), 0.1, 0.34);
  settings.caption.enabled = els.captionEnabled.checked;
  settings.caption.title = els.captionTitle.value;
  settings.caption.subtitle = els.captionSubtitle.value;
  settings.card.enabled = els.cardEnabled.checked;
  settings.card.radius = clamp(Number(els.cardRadius.value || 20), 0, 48);
  settings.card.paddingPx = clamp(Number(els.cardPadding.value || 22), 0, 64);
  if (els.cardBg && settings.card) settings.card.bg = els.cardBg.value;
}

function syncControlsFromSettings() {
  els.payloadType.value = settings.payloadType;
  els.ecc.value = settings.ecc;
  els.sizePx.value = String(settings.sizePx);
  els.marginModules.value = String(settings.marginModules);
  els.fg.value = settings.fg;
  els.bg.value = settings.bg;
  if (els.bgTransparent) els.bgTransparent.checked = !!settings.bgTransparent;
  els.gradientEnabled.checked = !!settings.gradient.enabled;
  els.gradientColor2.value = settings.gradient.color2;
  els.gradientAngle.value = String(settings.gradient.angleDeg);
  els.moduleShape.value = settings.moduleShape;
  els.eyeStyle.value = settings.eyeStyle;
  els.moduleInsetEnabled.checked = !!settings.moduleEffect?.insetEnabled;
  els.moduleInset.value = String(settings.moduleEffect?.inset ?? 0.12);
  els.logoEnabled.checked = !!settings.logo.enabled;
  els.logoScale.value = String(settings.logo.scale);
  els.captionEnabled.checked = !!settings.caption.enabled;
  els.captionTitle.value = settings.caption.title;
  els.captionSubtitle.value = settings.caption.subtitle;
  els.cardEnabled.checked = !!settings.card.enabled;
  els.cardRadius.value = String(settings.card.radius);
  els.cardPadding.value = String(settings.card.paddingPx);
  if (els.cardBg) els.cardBg.value = String(settings.card?.bg || '#ffffff');
  updateControlVisibility();
}

function setPresetTag(tag) {
  presetTag = tag;
  const chips = Array.from(els.presetFilters.querySelectorAll('.chip'));
  for (const c of chips) {
    c.classList.toggle('active', c.dataset.tag === presetTag);
  }
  renderPresetButtons();
}

function getPresetList() {
  const list = [...BUILTIN_PRESETS.map((p) => ({ ...p, kind: 'builtin' }))];
  if (presetTag === 'all') return list;
  if (presetTag === 'featured') {
    return list.filter((p) => (p.tags || []).includes('featured'));
  }
  return list.filter((p) => (p.tags || []).includes(presetTag));
}

function presetDisplayList() {
  const list = getPresetList();
  return list;
}

function renderPresetButtons() {
  const list = presetDisplayList();
  if (!els.presetButtons) return;

  els.presetButtons.innerHTML = '';
  for (const p of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'presetBtn';
    if (activePresetId && p.id === activePresetId) b.classList.add('active');
    b.textContent = p.name;
    b.title = '点击套用';
    b.addEventListener('click', () => {
      activePresetId = p.id;
      const nextBgTransparent = Object.prototype.hasOwnProperty.call(p.settings || {}, 'bgTransparent')
        ? !!p.settings.bgTransparent
        : false;
      settings = applyPreset(settings, { ...p.settings, bgTransparent: nextBgTransparent });
      lastMatrixKey = '';
      lastMatrix = null;
      syncControlsFromSettings();
      renderPayloadForm();
      scheduleUpdate();
      // Visual feedback without extra UI.
      toast(`已套用：${p.name}`);

      // Update active state
      const btns = Array.from(els.presetButtons.querySelectorAll('.presetBtn'));
      for (const x of btns) x.classList.toggle('active', x === b);
    });
    els.presetButtons.appendChild(b);
  }
}

function setSceneCat(cat) {
  sceneCat = cat;
  if (els.sceneFilters) {
    const chips = Array.from(els.sceneFilters.querySelectorAll('.chip'));
    for (const c of chips) c.classList.toggle('active', c.dataset.cat === sceneCat);
  }
  renderSceneButtons();
}

function sceneDisplayList() {
  if (sceneCat === 'all') return SCENES;
  return SCENES.filter((s) => s.cat === sceneCat);
}

function renderSceneButtons() {
  if (!els.sceneButtons) return;
  els.sceneButtons.innerHTML = '';
  const list = sceneDisplayList();
  for (const s of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'presetBtn';
    b.textContent = s.name;
    b.title = '点击套用场景';
    b.addEventListener('click', () => {
      const preset = BUILTIN_PRESETS.find((p) => p.id === s.presetId);
      if (preset) {
        activePresetId = preset.id;
        const nextBgTransparent = Object.prototype.hasOwnProperty.call(preset.settings || {}, 'bgTransparent')
          ? !!preset.settings.bgTransparent
          : false;
        settings = applyPreset(settings, { ...preset.settings, bgTransparent: nextBgTransparent });
      }

      // Apply scene caption/format defaults.
      if (s.caption) {
        settings.caption.enabled = true;
        settings.caption.title = s.caption.title || '';
        settings.caption.subtitle = s.caption.subtitle || '';
      }

      // Scene templates often print; keep safe quiet zone.
      settings.marginModules = Math.max(4, Number(settings.marginModules || 4));

      if (els.exportTemplate && s.exportTemplate) els.exportTemplate.value = s.exportTemplate;

      lastMatrixKey = '';
      lastMatrix = null;
      syncControlsFromSettings();
      renderPayloadForm();
      renderPresetButtons();
      scheduleUpdate();
      toast(`已套用场景：${s.name}`);
    });
    els.sceneButtons.appendChild(b);
  }
}

async function copyShareLink() {
  syncSettingsFromControls();
  const hasWifiPass = settings.payloadType === 'wifi' && String(settings.wifi.password || '').trim();
  const excludeSensitive = hasWifiPass
    ? !confirm('分享链接包含 WiFi 密码，是否仍然包含该密码？\n\n点“确定”=包含密码\n点“取消”=排除密码')
    : false;
  const hash = makeShareHash(settings, { excludeSensitive });
  const url = `${location.origin}${location.pathname}${hash}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('已复制分享链接');
  } catch {
    prompt('复制分享链接：', url);
  }
}

async function exportPng() {
  const tpl = els.exportTemplate?.value || 'current';
  if (tpl === 'current') {
    const bytes = await canvasToPngBytes(els.canvas);
    downloadBlob(new Blob([bytes], { type: 'image/png' }), 'qr.png');
    return;
  }
  await exportPngTemplate(tpl);
}

function templateSpec(id) {
  switch (id) {
    case 'sticker800':
      return { id, w: 800, h: 800, outerPad: 56, bg: 'light' };
    case 'card1200x800':
      return { id, w: 1200, h: 800, outerPad: 60, bg: 'light' };
    case 'poster1080x1920':
      return { id, w: 1080, h: 1920, outerPad: 72, bg: 'dark' };
    case 'a4':
      return { id, w: 2480, h: 3508, outerPad: 180, bg: 'light' };
    default:
      return null;
  }
}

function paintTemplateBackground(ctx, w, h, mode) {
  ctx.save();
  if (mode === 'dark') {
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, w, h);
    const g1 = ctx.createRadialGradient(w * 0.18, h * 0.12, 10, w * 0.18, h * 0.12, Math.max(w, h) * 0.8);
    g1.addColorStop(0, 'rgba(79,70,229,0.26)');
    g1.addColorStop(1, 'rgba(79,70,229,0.00)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(w * 0.85, h * 0.18, 10, w * 0.85, h * 0.18, Math.max(w, h) * 0.7);
    g2.addColorStop(0, 'rgba(6,182,212,0.20)');
    g2.addColorStop(1, 'rgba(6,182,212,0.00)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(79,70,229,0.06)');
    g.addColorStop(1, 'rgba(6,182,212,0.04)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

async function exportPngTemplate(templateId) {
  syncSettingsFromControls();
  const payload = buildPayload();
  if (!payload) {
    toast('请先输入内容');
    return;
  }

  const spec = templateSpec(templateId);
  if (!spec) return;

  const enc = encodeQrMatrix(payload, settings.ecc);
  const out = document.createElement('canvas');
  out.width = spec.w;
  out.height = spec.h;
  const ctx = out.getContext('2d');
  if (!ctx) return;

  paintTemplateBackground(ctx, spec.w, spec.h, spec.bg);

  const availW = spec.w - spec.outerPad * 2;
  const availH = spec.h - spec.outerPad * 2;

  // Render a QR card to fit without scaling (one retry if needed).
  let target = Math.floor(Math.min(availW, availH) * (spec.id === 'poster1080x1920' ? 0.58 : 0.70));
  target = clamp(target, 280, 2400);

  const baseCardSettings = {
    ...settings,
    sizePx: target,
    // Keep card aesthetic, but render caption on the template itself.
    card: { ...settings.card, enabled: true },
    caption: { ...settings.caption, enabled: false },
  };

  const card = document.createElement('canvas');
  await renderToCanvas(card, enc.matrix, baseCardSettings);

  if (card.width > availW || card.height > availH) {
    const ratio = Math.min(availW / card.width, availH / card.height);
    const next = Math.floor(target * ratio);
    const retrySettings = { ...baseCardSettings, sizePx: clamp(next, 240, 2400) };
    await renderToCanvas(card, enc.matrix, retrySettings);
  }

  const x = Math.floor((spec.w - card.width) / 2);
  const yTop = spec.id === 'poster1080x1920' ? Math.floor(spec.h * 0.22) : Math.floor((spec.h - card.height) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(card, x, yTop);

  // Poster / A4 caption block
  if (settings.caption?.enabled) {
    const title = String(settings.caption.title || '').trim();
    const sub = String(settings.caption.subtitle || '').trim();
    if (title || sub) {
      ctx.save();
      const isDark = spec.bg === 'dark';
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(17,24,39,0.92)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      const baseY = yTop + card.height + (spec.id === 'poster1080x1920' ? 120 : 90);
      if (title) {
        ctx.font = `800 ${spec.id === 'a4' ? 92 : 54}px ui-sans-serif, system-ui`;
        ctx.fillText(title, spec.w / 2, baseY);
      }
      if (sub) {
        ctx.globalAlpha = 0.86;
        ctx.font = `${spec.id === 'a4' ? 44 : 22}px ui-sans-serif, system-ui`;
        ctx.fillText(sub, spec.w / 2, baseY + (spec.id === 'a4' ? 64 : 34));
      }
      ctx.restore();
    }
  }

  const bytes = await canvasToPngBytes(out);
  downloadBlob(new Blob([bytes], { type: 'image/png' }), `qr-${spec.id}.png`);
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
  } catch {
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
  onChange(els.bgTransparent);
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
  onChange(els.cardBg);

  if (els.cardBgSuggestions && els.cardBg) {
    const btns = Array.from(els.cardBgSuggestions.querySelectorAll('button[data-color]'));
    for (const b of btns) {
      b.addEventListener('click', () => {
        const c = String(b.dataset.color || '').trim();
        if (!c) return;
        els.cardBg.value = c;
        syncSettingsFromControls();
        scheduleUpdate();
        toast(`卡片背景已设置为 ${c}`);
      });
    }
  }

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

  // Preset filter chips
  if (els.presetFilters) {
    const chips = Array.from(els.presetFilters.querySelectorAll('.chip'));
    for (const c of chips) {
      c.addEventListener('click', () => setPresetTag(c.dataset.tag));
    }
    // Default tag is set in init()
  }

  // Scene filter chips
  if (els.sceneFilters) {
    const chips = Array.from(els.sceneFilters.querySelectorAll('.chip'));
    for (const c of chips) {
      c.addEventListener('click', () => setSceneCat(c.dataset.cat));
    }
  }

}

function init() {
  renderSceneButtons();

  // Default: do not show "all" presets; use curated tag by default.
  if (els.presetFilters) {
    setPresetTag('featured');
  }

  if (els.sceneFilters) {
    setSceneCat('private');
  }

  const fromHash = tryLoadFromShareHash();
  if (fromHash && typeof fromHash === 'object') {
    settings = applyPreset(settings, fromHash);
    activePresetId = null;
    toast('已从分享链接恢复配置');
  } else {
    // Default to the first built-in preset for a more "finished" initial look.
    const first = BUILTIN_PRESETS[0];
    if (first) {
      activePresetId = first.id;
      settings = applyPreset(settings, first.settings);
    }
  }

  // Ensure UI reflects active preset after settings are applied.
  renderPresetButtons();

  syncControlsFromSettings();
  renderPayloadForm();
  attachListeners();
  setMode('single');
}

init();
