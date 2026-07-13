import { resolvePublicStorageUrl } from './supabaseAuth.js';

const RICH_CONTENT_VIDEO_MAX_SECONDS = 30;
export const RICH_CONTENT_IMAGE_MAX_COUNT = 6;
const allowedTags = new Set(['P', 'H2', 'STRONG', 'EM', 'UL', 'OL', 'LI', 'TABLE', 'TBODY', 'TR', 'TD', 'IMG', 'VIDEO', 'SOURCE', 'BR']);
const allowedAttributes = {
  IMG: new Set(['src', 'alt', 'loading']),
  VIDEO: new Set(['src', 'controls', 'preload', 'title']),
  SOURCE: new Set(['src', 'type'])
};

function createBlockId(prefix = 'block') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanStorageFileName(name = 'content') {
  return String(name || 'content')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'content';
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderMarkedText(block) {
  let text = escapeHtml(block.text || '');
  if (!text) return '';
  if (block.bold) text = `<strong>${text}</strong>`;
  if (block.italic) text = `<em>${text}</em>`;
  return text;
}

function renderTextBlock(block) {
  const text = renderMarkedText(block);
  if (!text) return '';
  return block.type === 'heading' ? `<h2>${text}</h2>` : `<p>${text}</p>`;
}

function renderListBlock(block) {
  const items = (block.items ?? []).map((item) => escapeHtml(item)).filter(Boolean);
  if (!items.length) return '';
  const tag = block.ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map((item) => `<li>${item}</li>`).join('')}</${tag}>`;
}

function renderTableBlock(block) {
  const rows = (block.rows ?? [])
    .map((row) => (row ?? []).map((cell) => `<td>${escapeHtml(cell)}</td>`).join(''))
    .filter(Boolean);
  if (!rows.length) return '';
  return `<table><tbody>${rows.map((row) => `<tr>${row}</tr>`).join('')}</tbody></table>`;
}

function renderImageBlock(block) {
  if (!block.url) return '';
  return `<img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt || '')}" loading="lazy" />`;
}

function renderVideoBlock(block) {
  if (!block.url) return '';
  return `<video controls preload="metadata" src="${escapeHtml(block.url)}" title="${escapeHtml(block.title || '')}"></video>`;
}

export function createEmptyRichContentBlock(type = 'paragraph') {
  if (type === 'heading') return { id: createBlockId('heading'), type: 'heading', text: '', bold: false, italic: false };
  if (type === 'list') return { id: createBlockId('list'), type: 'list', ordered: false, items: [''] };
  if (type === 'table') return { id: createBlockId('table'), type: 'table', rows: [['', '', ''], ['', '', ''], ['', '', '']] };
  return { id: createBlockId('paragraph'), type: 'paragraph', text: '', bold: false, italic: false };
}

export function createInitialRichContentBlocks(html = '') {
  if (html && typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(`<div>${sanitizeTourContentHtml(html)}</div>`, 'text/html');
    const blocks = [...document.body.firstElementChild.childNodes].map((node) => {
      if (node.nodeType !== 1) return null;
      const tagName = node.tagName;
      if (tagName === 'H2' || tagName === 'P') {
        return {
          id: createBlockId(tagName === 'H2' ? 'heading' : 'paragraph'),
          type: tagName === 'H2' ? 'heading' : 'paragraph',
          text: node.textContent || '',
          bold: Boolean(node.querySelector('strong')),
          italic: Boolean(node.querySelector('em'))
        };
      }
      if (tagName === 'UL' || tagName === 'OL') {
        return {
          id: createBlockId('list'),
          type: 'list',
          ordered: tagName === 'OL',
          items: [...node.querySelectorAll('li')].map((item) => item.textContent || '').filter(Boolean)
        };
      }
      if (tagName === 'TABLE') {
        return {
          id: createBlockId('table'),
          type: 'table',
          rows: [...node.querySelectorAll('tr')].map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent || ''))
        };
      }
      if (tagName === 'IMG') {
        return { id: createBlockId('image'), type: 'image', url: node.getAttribute('src') || '', alt: node.getAttribute('alt') || '' };
      }
      if (tagName === 'VIDEO') {
        return { id: createBlockId('video'), type: 'video', url: node.getAttribute('src') || node.querySelector('source')?.getAttribute('src') || '', title: node.getAttribute('title') || '' };
      }
      return null;
    }).filter(Boolean);
    if (blocks.length) return blocks;
  }
  const text = stripHtml(html);
  if (!text) return [createEmptyRichContentBlock()];
  return [{ id: createBlockId('paragraph'), type: 'paragraph', text, bold: false, italic: false }];
}

export function serializeRichContentBlocks(blocks = []) {
  return blocks.map((block) => {
    if (block.type === 'heading' || block.type === 'paragraph') return renderTextBlock(block);
    if (block.type === 'list') return renderListBlock(block);
    if (block.type === 'table') return renderTableBlock(block);
    if (block.type === 'image') return renderImageBlock(block);
    if (block.type === 'video') return renderVideoBlock(block);
    return '';
  }).filter(Boolean).join('');
}

export function selectAllowedRichContentImageFiles(files = [], blocks = [], maxImageCount = RICH_CONTENT_IMAGE_MAX_COUNT) {
  const fileList = [...(files ?? [])];
  const currentImageCount = blocks.filter((block) => block.type === 'image').length;
  const remainingSlots = Math.max(0, Number(maxImageCount) - currentImageCount);
  const allowedFiles = fileList.slice(0, remainingSlots);
  return {
    allowedFiles,
    rejectedCount: Math.max(0, fileList.length - allowedFiles.length)
  };
}

function sanitizeAttribute(tagName, attribute) {
  const allowed = allowedAttributes[tagName];
  if (!allowed?.has(attribute.name)) return '';
  const value = String(attribute.value || '').trim();
  if ((attribute.name === 'src' || attribute.name === 'href') && /^javascript:/i.test(value)) return '';
  if (attribute.name === 'controls') return ' controls=""';
  if (attribute.name === 'loading' && tagName === 'IMG') return ' loading="lazy"';
  if (attribute.name === 'preload' && tagName === 'VIDEO') return ' preload="metadata"';
  return ` ${attribute.name}="${escapeHtml(value)}"`;
}

function sanitizeDomNode(node) {
  if (node.nodeType === 3) return escapeHtml(node.textContent || '');
  if (node.nodeType !== 1) return '';
  const tagName = node.tagName;
  const children = [...node.childNodes].map(sanitizeDomNode).join('');
  if (!allowedTags.has(tagName)) return children;
  const attrs = [...node.attributes].map((attribute) => sanitizeAttribute(tagName, attribute)).join('');
  const tag = tagName.toLowerCase();
  if (tagName === 'IMG') {
    const safeAttrs = attrs.includes(' loading=') ? attrs : `${attrs} loading="lazy"`;
    return `<img${safeAttrs}>`;
  }
  if (tagName === 'VIDEO') {
    const safeAttrs = `${attrs.includes(' controls') ? attrs : `${attrs} controls=""`}${attrs.includes(' preload=') ? '' : ' preload="metadata"'}`;
    return `<video${safeAttrs}>${children}</video>`;
  }
  return `<${tag}${attrs}>${children}</${tag}>`;
}

function sanitizeWithoutDom(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\sautoplay(="[^"]*")?/gi, '')
    .replace(/<a\b[^>]*>/gi, '')
    .replace(/<\/a>/gi, '')
    .replace(/<img([^>]*?)\s*\/?>/gi, (match, attrs) => {
      const safeAttrs = attrs.includes('loading=') ? attrs : `${attrs} loading="lazy"`;
      return `<img${safeAttrs}>`;
    })
    .replace(/<video([^>]*?)>/gi, (match, attrs) => {
      let safeAttrs = attrs.includes('controls') ? attrs : `${attrs} controls=""`;
      safeAttrs = safeAttrs.includes('preload=') ? safeAttrs : `${safeAttrs} preload="metadata"`;
      return `<video${safeAttrs}>`;
    });
}

export function sanitizeTourContentHtml(html = '') {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return sanitizeWithoutDom(html);
  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  return [...document.body.firstElementChild.childNodes].map(sanitizeDomNode).join('');
}

export function createTourContentStoragePath({ userId, prefix, fileName, now = Date.now() }) {
  return `${userId}/rich-content/${prefix}-${now}-${cleanStorageFileName(fileName)}`;
}

async function uploadTourContentFile(client, { userId, file, bucket, prefix }) {
  if (!userId) throw new Error('A user id is required to upload tour content media.');
  if (!file?.size) throw new Error('A file is required to upload tour content media.');
  const path = createTourContentStoragePath({ userId, prefix, fileName: file.name });
  const { error } = await client.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const publicUrl = client.storage.from(bucket).getPublicUrl(path)?.data?.publicUrl || resolvePublicStorageUrl(bucket, path);
  return { path, url: publicUrl };
}

export function uploadTourContentImage(client, userId, file) {
  return uploadTourContentFile(client, { userId, file, bucket: 'tour-images', prefix: 'image' });
}

export function uploadTourContentVideo(client, userId, file) {
  return uploadTourContentFile(client, { userId, file, bucket: 'tour-videos', prefix: 'video' });
}

export function validateVideoDuration(duration) {
  if (Number(duration) > RICH_CONTENT_VIDEO_MAX_SECONDS) {
    throw new Error('30초 이내 영상만 업로드할 수 있어요');
  }
}

export function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('동영상 정보를 읽을 수 없습니다.'));
    };
    video.src = url;
  });
}
