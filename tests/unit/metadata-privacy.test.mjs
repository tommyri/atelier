import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImageMetadata, stripImageMetadata } from '../../src/lib/metadataPrivacy.js';
import { sha256File } from '../../src/lib/blossomUpload.js';

function jpegWithExif() {
  const exif = Buffer.from('Exif\0\0GPSLatitude=10;GPSLongitude=20');
  const comment = Buffer.from('made by camera');
  return new File([
    Buffer.from([0xff, 0xd8]),
    Buffer.from([0xff, 0xe1, 0x00, exif.length + 2]),
    exif,
    Buffer.from([0xff, 0xfe, 0x00, comment.length + 2]),
    comment,
    Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]),
  ], 'gps.jpg', { type: 'image/jpeg' });
}

function pngWithText() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const text = Buffer.from('Description\0hello');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(text.length);
  const type = Buffer.from('tEXt');
  const crc = Buffer.alloc(4);
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0]);
  return new File([signature, length, type, text, crc, iend], 'note.png', { type: 'image/png' });
}

test('inspectImageMetadata detects JPEG EXIF, comments, and GPS sensitivity', async () => {
  const metadata = await inspectImageMetadata(jpegWithExif());
  assert.equal(metadata.present, true);
  assert.equal(metadata.sensitive, true);
  assert.deepEqual(metadata.sections, ['EXIF', 'Comment']);
  assert.ok(metadata.bytes > 0);
});

test('stripImageMetadata removes JPEG APP/comment segments and changes hash', async () => {
  const file = jpegWithExif();
  const beforeHash = await sha256File(file);
  const stripped = await stripImageMetadata(file);
  const afterHash = await sha256File(stripped.file);
  const metadata = await inspectImageMetadata(stripped.file);

  assert.equal(stripped.changed, true);
  assert.ok(stripped.strippedBytes > 0);
  assert.notEqual(beforeHash, afterHash);
  assert.equal(metadata.present, false);
});

test('inspectImageMetadata detects PNG textual metadata', async () => {
  const metadata = await inspectImageMetadata(pngWithText());
  assert.equal(metadata.present, true);
  assert.equal(metadata.sensitive, false);
  assert.deepEqual(metadata.sections, ['tEXt']);
});
