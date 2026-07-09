import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const indexPath = join(process.cwd(), 'dist', 'index.html');
let html = readFileSync(indexPath, 'utf8').replaceAll(' crossorigin', '');

html = html.replace(
  /<link rel="stylesheet" href="\.\/assets\/([^"]+\.css)">/,
  (_, fileName) => `<style>\n${readFileSync(join(process.cwd(), 'dist', 'assets', fileName), 'utf8')}\n</style>`
);

html = html.replace(
  /<script type="module" src="\.\/assets\/([^"]+\.js)"><\/script>/,
  (_, fileName) => {
    const js = readFileSync(join(process.cwd(), 'dist', 'assets', fileName), 'utf8').replaceAll('</script>', '<\\/script>');
    return `<script type="module">\n${js}\n</script>`;
  }
);

writeFileSync(indexPath, html, 'utf8');
