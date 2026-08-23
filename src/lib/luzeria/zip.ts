/** Minimal in-browser ZIP writer (STORE method — no compression, since the
 * media we bundle here is already compressed video/image data). Just enough
 * of the format for every mainstream unzip tool (Finder, Explorer, 7-Zip) to
 * read it correctly: local file headers + central directory + EOCD record. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d = new Date()) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private len = 0;
  u16(v: number) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, v, true);
    this.chunks.push(b);
    this.len += 2;
  }
  u32(v: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, true);
    this.chunks.push(b);
    this.len += 4;
  }
  bytes(b: Uint8Array) {
    this.chunks.push(b);
    this.len += b.length;
  }
  get length() {
    return this.len;
  }
  toBlob(type = "application/zip") {
    return new Blob(this.chunks as BlobPart[], { type });
  }
}

/** Names must be unique within the archive — dedupe by appending " (2)",
 * " (3)"... before the extension. */
export function dedupeZipName(name: string, used: Set<string>): string {
  const safe = name.replace(/[\\/]/g, "-").trim() || "arquivo";
  if (!used.has(safe)) return safe;
  const dot = safe.lastIndexOf(".");
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) candidate = `${base} (${++i})${ext}`;
  return candidate;
}

export function buildZip(files: { name: string; data: Uint8Array }[]): Blob {
  const w = new ByteWriter();
  const { time, date } = dosDateTime();
  const central: { nameBytes: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const f of files) {
    const nameBytes = new TextEncoder().encode(f.name);
    const crc = crc32(f.data);
    const offset = w.length;
    w.u32(0x04034b50);
    w.u16(20); // version needed to extract
    w.u16(0x0800); // general flags: language encoding (UTF-8 filename)
    w.u16(0); // compression method: store
    w.u16(time);
    w.u16(date);
    w.u32(crc);
    w.u32(f.data.length); // compressed size
    w.u32(f.data.length); // uncompressed size
    w.u16(nameBytes.length);
    w.u16(0); // extra field length
    w.bytes(nameBytes);
    w.bytes(f.data);
    central.push({ nameBytes, crc, size: f.data.length, offset });
  }

  const centralStart = w.length;
  for (const c of central) {
    w.u32(0x02014b50);
    w.u16(20); // version made by
    w.u16(20); // version needed
    w.u16(0x0800);
    w.u16(0);
    w.u16(time);
    w.u16(date);
    w.u32(c.crc);
    w.u32(c.size);
    w.u32(c.size);
    w.u16(c.nameBytes.length);
    w.u16(0); // extra length
    w.u16(0); // comment length
    w.u16(0); // disk number start
    w.u16(0); // internal attrs
    w.u32(0); // external attrs
    w.u32(c.offset);
    w.bytes(c.nameBytes);
  }
  const centralSize = w.length - centralStart;

  w.u32(0x06054b50);
  w.u16(0);
  w.u16(0);
  w.u16(central.length);
  w.u16(central.length);
  w.u32(centralSize);
  w.u32(centralStart);
  w.u16(0); // comment length

  return w.toBlob();
}
