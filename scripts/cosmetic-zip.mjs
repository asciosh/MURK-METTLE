// Deterministic author-side ZIP writer. Never used for untrusted extraction.
import { crc32 } from '../src/client/mods/format.mjs';
export function makeZip(entries) {
  const local = [],
    central = [];
  let at = 0;
  for (const [path, data] of entries) {
    const name = Buffer.from(path),
      crc = crc32(data),
      h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x21, 12); // Deterministic DOS date: 1980-01-01.
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(name.length, 26);
    local.push(h, name, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(0x314, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x21, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(0x81a40000, 38);
    c.writeUInt32LE(at, 42);
    central.push(c, name);
    at += h.length + name.length + data.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(at, 16);
  return Buffer.concat([...local, directory, end]);
}
