// Minimal ZIP (store) writer for browser.
// Supports UTF-8 filenames, no compression.

function u16le(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}

function u32le(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function concat(chunks) {
  let len = 0;
  for (const c of chunks) len += c.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosTimeDate(d = new Date()) {
  // For simplicity, clamp to valid DOS ranges.
  const year = Math.max(1980, d.getFullYear());
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const min = d.getMinutes();
  const sec = Math.floor(d.getSeconds() / 2);

  const time = (hour << 11) | (min << 5) | sec;
  const date = ((year - 1980) << 9) | (month << 5) | day;
  return { time, date };
}

export function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  const now = dosTimeDate(new Date());

  for (const f of files) {
    const nameBytes = new TextEncoder().encode(f.name);
    const data = f.data;
    const crc = crc32(data);

    // Local file header
    const local = concat([
      u32le(0x04034b50),
      u16le(20),
      u16le(0),
      u16le(0),
      u16le(now.time),
      u16le(now.date),
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0),
      nameBytes,
      data,
    ]);
    locals.push(local);

    // Central directory
    const central = concat([
      u32le(0x02014b50),
      u16le(20),
      u16le(20),
      u16le(0),
      u16le(0),
      u16le(now.time),
      u16le(now.date),
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(0),
      u32le(offset),
      nameBytes,
    ]);
    centrals.push(central);
    offset += local.length;
  }

  const centralStart = offset;
  const centralData = concat(centrals);
  offset += centralData.length;

  const eocd = concat([
    u32le(0x06054b50),
    u16le(0),
    u16le(0),
    u16le(files.length),
    u16le(files.length),
    u32le(centralData.length),
    u32le(centralStart),
    u16le(0),
  ]);

  const out = concat([concat(locals), centralData, eocd]);
  return new Blob([out], { type: 'application/zip' });
}
