// Uses global `qrcode` from assets/vendor/qrcode-generator.js

export function encodeQrMatrix(payload, ecc) {
  if (!payload || !String(payload).trim()) {
    return { matrix: null, moduleCount: 0, version: 0 };
  }

  try {
    // typeNumber=0 selects minimal version.
    const qr = qrcode(0, ecc || 'M');
    qr.addData(String(payload));
    qr.make();
    const count = qr.getModuleCount();
    const matrix = new Array(count);
    for (let r = 0; r < count; r++) {
      const row = new Array(count);
      for (let c = 0; c < count; c++) row[c] = !!qr.isDark(r, c);
      matrix[r] = row;
    }
    const version = Math.round((count - 17) / 4);
    return { matrix, moduleCount: count, version };
  } catch (e) {
    const msg = typeof e === 'string' ? e : (e && e.message) ? e.message : '编码失败';
    throw new Error(msg);
  }
}
