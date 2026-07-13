import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const consumerSrcDir = resolve(__dirname, '..');

function readSource(relativePath) {
  return readFileSync(resolve(consumerSrcDir, relativePath), 'utf8');
}

test('mobile popular tour carousel uses swipe scrolling instead of transform animation', () => {
  const css = readSource('styles.css');
  const mobileBlock = css.match(/@media \(max-width: 767px\) \{[\s\S]*?\.tour-detail-page \{/);

  assert.ok(mobileBlock, 'expected mobile breakpoint to include carousel overrides');
  assert.match(mobileBlock[0], /\.popular-carousel\s*\{[\s\S]*overflow-x:\s*auto;/);
  assert.match(mobileBlock[0], /\.popular-carousel\s*\{[\s\S]*scroll-snap-type:\s*x mandatory;/);
  assert.match(mobileBlock[0], /\.popular-carousel-track\s*\{[\s\S]*animation:\s*none !important;/);
  assert.match(mobileBlock[0], /\.popular-carousel-track\s*\{[\s\S]*transform:\s*none !important;/);
  assert.match(mobileBlock[0], /\.popular-tour-slide\s*\{[\s\S]*flex:\s*0 0 min\(82vw, 320px\);/);
  assert.match(mobileBlock[0], /\.popular-tour-slide\s*\{[\s\S]*scroll-snap-align:\s*start;/);
  assert.match(mobileBlock[0], /\.popular-carousel::before,\s*[\s\S]*\.popular-carousel::after\s*\{[\s\S]*display:\s*none;/);
});

test('TourCard fills the carousel slide without imposing its own minimum width', () => {
  const uiSource = readSource('components/UI.jsx');

  assert.match(
    uiSource,
    /<article className="[^"]*\bw-full\b[^"]*\bmin-w-0\b[^"]*"/,
    'TourCard root should use w-full min-w-0 so slide CSS owns mobile width'
  );
});
