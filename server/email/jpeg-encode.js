/**
 * A baseline JPEG encoder in plain Node, so a function can answer with a photograph without an npm package.
 * 4:4:4 (no chroma subsampling: gold edges on black stay crisp), the standard Huffman tables of ITU T.81 Annex K,
 * and the IJG quality scaling of its example quantisation tables.
 *
 *   encodeJpeg(rgb, width, height, quality) -> Buffer      (rgb: Uint8Array/Buffer, 3 bytes a pixel, rows top down)
 */

const ZIGZAG = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63];

const LUMA_Q = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
const CHROMA_Q = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99];

const DC_LUMA = { bits: [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], vals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
const DC_CHROMA = { bits: [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], vals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
const AC_LUMA = {
  bits: [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d],
  vals: [0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa]
};
const AC_CHROMA = {
  bits: [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77],
  vals: [0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa]
};

function buildCodes(spec) {
  const codes = new Array(256);
  let code = 0, k = 0;
  for (let len = 1; len <= 16; len++) {
    for (let i = 0; i < spec.bits[len - 1]; i++) codes[spec.vals[k++]] = [code++, len];
    code <<= 1;
  }
  return codes;
}
const CODES = { dcLuma: buildCodes(DC_LUMA), acLuma: buildCodes(AC_LUMA), dcChroma: buildCodes(DC_CHROMA), acChroma: buildCodes(AC_CHROMA) };

function scaledTable(base, quality) {
  const q = Math.max(1, Math.min(100, quality));
  const s = q < 50 ? 5000 / q : 200 - 2 * q;
  return base.map((v) => Math.max(1, Math.min(255, Math.floor((v * s + 50) / 100))));
}

// cos((2x + 1) u pi / 16) * C(u) / 2, for the separable forward DCT
const COS = new Float64Array(64);
for (let u = 0; u < 8; u++) for (let x = 0; x < 8; x++) COS[u * 8 + x] = Math.cos(((2 * x + 1) * u * Math.PI) / 16) * (u === 0 ? Math.SQRT1_2 : 1) / 2;

function fdct(block, out) {
  const tmp = new Float64Array(64);
  for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) {
    let s = 0;
    for (let x = 0; x < 8; x++) s += block[y * 8 + x] * COS[u * 8 + x];
    tmp[y * 8 + u] = s;
  }
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) {
    let s = 0;
    for (let y = 0; y < 8; y++) s += tmp[y * 8 + u] * COS[v * 8 + y];
    out[v * 8 + u] = s;
  }
}

class BitWriter {
  constructor(size) { this.buf = Buffer.alloc(size); this.pos = 0; this.acc = 0; this.n = 0; }
  ensure(extra) {
    if (this.pos + extra < this.buf.length) return;
    const next = Buffer.alloc(this.buf.length * 2 + extra);
    this.buf.copy(next, 0, 0, this.pos);
    this.buf = next;
  }
  bytes(arr) { this.ensure(arr.length); for (const b of arr) this.buf[this.pos++] = b; }
  bits(value, length) {
    this.ensure(8);
    this.acc = (this.acc << length) | (value & ((1 << length) - 1));
    this.n += length;
    while (this.n >= 8) {
      const byte = (this.acc >>> (this.n - 8)) & 255;
      this.buf[this.pos++] = byte;
      if (byte === 255) this.buf[this.pos++] = 0;
      this.n -= 8;
    }
    this.acc &= (1 << this.n) - 1;
  }
  flush() { if (this.n > 0) this.bits((1 << (8 - this.n)) - 1, 8 - this.n); }
  result() { return this.buf.subarray(0, this.pos); }
}

function category(v) {
  let a = Math.abs(v), n = 0;
  while (a) { n++; a >>= 1; }
  return n;
}

function encodeBlock(w, coeffs, quant, prevDc, dcCodes, acCodes) {
  const q = new Int32Array(64);
  for (let i = 0; i < 64; i++) {
    const n = ZIGZAG[i];
    q[i] = Math.round(coeffs[n] / quant[i]);
  }
  const diff = q[0] - prevDc;
  const dcCat = category(diff);
  w.bits(dcCodes[dcCat][0], dcCodes[dcCat][1]);
  if (dcCat) w.bits(diff < 0 ? diff + (1 << dcCat) - 1 : diff, dcCat);
  let run = 0;
  for (let i = 1; i < 64; i++) {
    const v = q[i];
    if (v === 0) { run++; continue; }
    while (run > 15) { w.bits(acCodes[0xf0][0], acCodes[0xf0][1]); run -= 16; }
    const cat = category(v);
    const sym = (run << 4) | cat;
    w.bits(acCodes[sym][0], acCodes[sym][1]);
    w.bits(v < 0 ? v + (1 << cat) - 1 : v, cat);
    run = 0;
  }
  if (run > 0) w.bits(acCodes[0][0], acCodes[0][1]);
  return q[0];
}

function segment(marker, payload) {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 255, ...payload];
}

function huffmanSegment(cls, id, spec) {
  return [(cls << 4) | id, ...spec.bits, ...spec.vals];
}

function encodeJpeg(rgb, width, height, quality = 85) {
  const lq = scaledTable(LUMA_Q, quality), cq = scaledTable(CHROMA_Q, quality);
  // the tables are written and applied in zigzag order
  const lqz = ZIGZAG.map((n) => lq[n]), cqz = ZIGZAG.map((n) => cq[n]);
  // the DCT above is orthonormal-scaled by 1/4 overall, as T.81 defines it; quantisation divides by the table as is
  const w = new BitWriter(Math.max(65536, (width * height) >> 1));
  w.bytes([0xff, 0xd8]);
  w.bytes(segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
  w.bytes(segment(0xdb, [0, ...lqz, 1, ...cqz]));
  w.bytes(segment(0xc0, [8, height >> 8, height & 255, width >> 8, width & 255, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]));
  w.bytes(segment(0xc4, [...huffmanSegment(0, 0, DC_LUMA), ...huffmanSegment(1, 0, AC_LUMA), ...huffmanSegment(0, 1, DC_CHROMA), ...huffmanSegment(1, 1, AC_CHROMA)]));
  w.bytes(segment(0xda, [3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0]));
  const Y = new Float64Array(64), Cb = new Float64Array(64), Cr = new Float64Array(64), out = new Float64Array(64);
  let dcY = 0, dcCb = 0, dcCr = 0;
  for (let by = 0; by < height; by += 8) {
    for (let bx = 0; bx < width; bx += 8) {
      for (let y = 0; y < 8; y++) {
        const sy = Math.min(height - 1, by + y);
        for (let x = 0; x < 8; x++) {
          const sx = Math.min(width - 1, bx + x);
          const i = (sy * width + sx) * 3;
          const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
          const k = y * 8 + x;
          Y[k] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
          Cb[k] = -0.168736 * r - 0.331264 * g + 0.5 * b;
          Cr[k] = 0.5 * r - 0.418688 * g - 0.081312 * b;
        }
      }
      fdct(Y, out); dcY = encodeBlock(w, out, lqz, dcY, CODES.dcLuma, CODES.acLuma);
      fdct(Cb, out); dcCb = encodeBlock(w, out, cqz, dcCb, CODES.dcChroma, CODES.acChroma);
      fdct(Cr, out); dcCr = encodeBlock(w, out, cqz, dcCr, CODES.dcChroma, CODES.acChroma);
    }
  }
  w.flush();
  w.bytes([0xff, 0xd9]);
  return Buffer.from(w.result());
}

module.exports = { encodeJpeg };
