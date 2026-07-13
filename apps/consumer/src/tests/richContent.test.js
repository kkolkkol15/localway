import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialRichContentBlocks,
  createTourContentStoragePath,
  sanitizeTourContentHtml,
  selectAllowedRichContentImageFiles,
  serializeRichContentBlocks,
  uploadTourContentImage,
  uploadTourContentVideo,
  validateVideoDuration
} from '../lib/richContent.js';

test('serializeRichContentBlocks supports text marks, lists, tables, images, and videos', () => {
  const html = serializeRichContentBlocks([
    { id: 'heading-1', type: 'heading', text: 'Local food night', bold: true },
    { id: 'paragraph-1', type: 'paragraph', text: 'Walk through hidden alleys.', italic: true },
    { id: 'list-1', type: 'list', ordered: false, items: ['Meet at station', 'Taste local snacks'] },
    { id: 'table-1', type: 'table', rows: [['Time', 'Place'], ['19:00', 'Market']] },
    { id: 'image-1', type: 'image', url: 'https://cdn.example.com/market.jpg', alt: 'Market' },
    { id: 'video-1', type: 'video', url: 'https://cdn.example.com/intro.mp4', title: 'Intro clip' }
  ]);

  assert.match(html, /<h2><strong>Local food night<\/strong><\/h2>/);
  assert.match(html, /<p><em>Walk through hidden alleys\.<\/em><\/p>/);
  assert.match(html, /<ul><li>Meet at station<\/li><li>Taste local snacks<\/li><\/ul>/);
  assert.match(html, /<table><tbody><tr><td>Time<\/td><td>Place<\/td><\/tr><tr><td>19:00<\/td><td>Market<\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /<img src="https:\/\/cdn\.example\.com\/market\.jpg" alt="Market" loading="lazy" \/>/);
  assert.match(html, /<video controls preload="metadata" src="https:\/\/cdn\.example\.com\/intro\.mp4" title="Intro clip"><\/video>/);
});

test('sanitizeTourContentHtml removes unsafe tags and attributes while keeping rich content tags', () => {
  const sanitized = sanitizeTourContentHtml('<h2 onclick="bad()">Title</h2><script>alert(1)</script><img src="https://cdn.example.com/a.jpg" onerror="bad()" /><video src="https://cdn.example.com/a.mp4" autoplay></video><a href="https://bad.example.com">bad</a>');

  assert.equal(sanitized.includes('script'), false);
  assert.equal(sanitized.includes('onclick'), false);
  assert.equal(sanitized.includes('onerror'), false);
  assert.equal(sanitized.includes('<a'), false);
  assert.match(sanitized, /<h2>Title<\/h2>/);
  assert.match(sanitized, /<img src="https:\/\/cdn\.example\.com\/a\.jpg" loading="lazy">/);
  assert.match(sanitized, /<video src="https:\/\/cdn\.example\.com\/a\.mp4" controls="" preload="metadata"><\/video>/);
});

test('createInitialRichContentBlocks falls back to plain content without losing text', () => {
  const blocks = createInitialRichContentBlocks('<p>Hello <strong>traveler</strong></p>');

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].text, 'Hello traveler');
});

test('tour content uploads use stable public storage paths', async () => {
  const calls = [];
  const fakeClient = {
    storage: {
      from: (bucket) => ({
        upload: async (path, file, options) => {
          calls.push({ bucket, path, fileName: file.name, options });
          return { error: null };
        },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.example.com/${bucket}/${path}` } })
      })
    }
  };

  const image = await uploadTourContentImage(fakeClient, 'user-1', { name: 'market photo.jpg', size: 10 });
  const video = await uploadTourContentVideo(fakeClient, 'user-1', { name: 'intro clip.mp4', size: 10 });

  assert.equal(calls[0].bucket, 'tour-images');
  assert.match(calls[0].path, /^user-1\/rich-content\/image-\d+-market-photo\.jpg$/);
  assert.equal(calls[1].bucket, 'tour-videos');
  assert.match(calls[1].path, /^user-1\/rich-content\/video-\d+-intro-clip\.mp4$/);
  assert.equal(image.url, `https://storage.example.com/tour-images/${calls[0].path}`);
  assert.equal(video.url, `https://storage.example.com/tour-videos/${calls[1].path}`);
});

test('validateVideoDuration rejects videos longer than 30 seconds', () => {
  assert.doesNotThrow(() => validateVideoDuration(30));
  assert.throws(() => validateVideoDuration(30.1), /30초 이내 영상만 업로드할 수 있어요/);
});

test('createTourContentStoragePath sanitizes file names', () => {
  assert.match(
    createTourContentStoragePath({ userId: 'user-1', prefix: 'image', fileName: '서울 night #1.png', now: 123 }),
    /^user-1\/rich-content\/image-123-night-1\.png$/
  );
});

test('selectAllowedRichContentImageFiles rejects new images when the content already has 6 images', () => {
  const blocks = Array.from({ length: 6 }, (_, index) => ({ id: `image-${index}`, type: 'image' }));
  const result = selectAllowedRichContentImageFiles([{ name: 'extra.jpg', type: 'image/jpeg' }], blocks);

  assert.deepEqual(result.allowedFiles, []);
  assert.equal(result.rejectedCount, 1);
});

test('selectAllowedRichContentImageFiles only allows remaining image slots', () => {
  const blocks = Array.from({ length: 4 }, (_, index) => ({ id: `image-${index}`, type: 'image' }));
  const files = Array.from({ length: 5 }, (_, index) => ({ name: `photo-${index}.jpg`, type: 'image/jpeg' }));
  const result = selectAllowedRichContentImageFiles(files, blocks);

  assert.deepEqual(result.allowedFiles, files.slice(0, 2));
  assert.equal(result.rejectedCount, 3);
});

test('selectAllowedRichContentImageFiles does not count videos toward the image limit', () => {
  const blocks = [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `image-${index}`, type: 'image' })),
    { id: 'video-1', type: 'video' }
  ];
  const files = [{ name: 'last-photo.jpg', type: 'image/jpeg' }, { name: 'too-many.jpg', type: 'image/jpeg' }];
  const result = selectAllowedRichContentImageFiles(files, blocks);

  assert.deepEqual(result.allowedFiles, files.slice(0, 1));
  assert.equal(result.rejectedCount, 1);
});
