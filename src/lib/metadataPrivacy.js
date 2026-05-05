const JPEG_SOI = 0xffd8;
const JPEG_SOS = 0xffda;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function readAscii(bytes, start, length) {
  return Array.from(bytes.slice(start, start + length)).map((byte) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.').join('');
}

function readUint16(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function inspectJpeg(bytes) {
  const sections = [];
  let sensitive = false;
  let metadataBytes = 0;
  let offset = 2;
  while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === JPEG_SOS) break;
    const length = readUint16(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    const payloadStart = offset + 4;
    const payloadLength = length - 2;
    const payload = readAscii(bytes, payloadStart, Math.min(payloadLength, 80));
    const appMarker = marker >= 0xe0 && marker <= 0xef;
    const comMarker = marker === 0xfe;
    if (appMarker || comMarker) {
      metadataBytes += length + 2;
      if (marker === 0xe1 && payload.includes('Exif')) sections.push('EXIF');
      else if (marker === 0xe1 && payload.includes('http://ns.adobe.com/xap')) sections.push('XMP');
      else if (marker === 0xed) sections.push('IPTC');
      else if (marker === 0xfe) sections.push('Comment');
      else sections.push(`APP${marker - 0xe0}`);
      if (/GPS|GPSLatitude|GPSLongitude/i.test(payload)) sensitive = true;
    }
    offset += 2 + length;
  }
  return {
    present: sections.length > 0,
    sensitive,
    bytes: metadataBytes,
    sections: Array.from(new Set(sections)),
    type: 'jpeg',
  };
}

function inspectPng(bytes) {
  const sections = [];
  let metadataBytes = 0;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = readAscii(bytes, offset + 4, 4);
    if (offset + 12 + length > bytes.length) break;
    if (['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(type)) {
      sections.push(type === 'eXIf' ? 'EXIF' : type);
      metadataBytes += length + 12;
    }
    offset += length + 12;
    if (type === 'IEND') break;
  }
  return {
    present: sections.length > 0,
    sensitive: sections.includes('EXIF'),
    bytes: metadataBytes,
    sections: Array.from(new Set(sections)),
    type: 'png',
  };
}

export async function inspectImageMetadata(file) {
  if (!file.type.startsWith('image/')) {
    return { present: false, sensitive: false, bytes: 0, sections: [], type: 'unsupported' };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length >= 4 && readUint16(bytes, 0) === JPEG_SOI) return inspectJpeg(bytes);
  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return inspectPng(bytes);
  return { present: false, sensitive: false, bytes: 0, sections: [], type: 'unsupported' };
}

export async function stripImageMetadata(file) {
  if (!file.type.startsWith('image/jpeg')) return { file, strippedBytes: 0, changed: false };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (readUint16(bytes, 0) !== JPEG_SOI) return { file, strippedBytes: 0, changed: false };
  const chunks = [bytes.slice(0, 2)];
  let strippedBytes = 0;
  let offset = 2;
  while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === JPEG_SOS) break;
    const length = readUint16(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    const segment = bytes.slice(offset, offset + 2 + length);
    const metadataMarker = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (metadataMarker) strippedBytes += segment.length;
    else chunks.push(segment);
    offset += segment.length;
  }
  chunks.push(bytes.slice(offset));
  if (strippedBytes === 0) return { file, strippedBytes: 0, changed: false };
  const stripped = new Blob(chunks, { type: file.type });
  return {
    file: new File([stripped], file.name, { type: file.type, lastModified: file.lastModified }),
    strippedBytes,
    changed: true,
  };
}
