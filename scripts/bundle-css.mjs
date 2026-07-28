/* Flatten the stylesheet's @imports into single files for CDN and inline use.
 *
 *   dist/md2.bundle.css      — md2.css + the three tier files + themes
 *   dist/md2.standalone.css  — the above plus md2-host.css tokens, so it works
 *                              in a page with no design system at all
 *
 * Consumers that bundle their own CSS should import css/md2.css directly and
 * let their bundler resolve the imports; these files exist for <link> tags,
 * inlined <style> blocks, and sandboxes that block extra requests. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function inline(css, baseDir, seen = new Set()) {
	return css.replace(/@import\s+['"]([^'"]+)['"]\s*;/g, (_match, rel) => {
		const file = resolve(baseDir, rel);
		if (seen.has(file)) return '';
		seen.add(file);
		return inline(readFileSync(file, 'utf8'), dirname(file), seen);
	});
}

mkdirSync(dist, { recursive: true });

const cssDir = join(root, 'css');
const bundle = inline(readFileSync(join(cssDir, 'md2.css'), 'utf8'), cssDir);
const standalone = `${readFileSync(join(cssDir, 'md2-host.css'), 'utf8')}\n${bundle}`;

writeFileSync(join(dist, 'md2.bundle.css'), bundle, 'utf8');
writeFileSync(join(dist, 'md2.standalone.css'), standalone, 'utf8');

const kb = (s) => `${(s.length / 1024).toFixed(1)}KB`;
console.log(`dist/md2.bundle.css      ${kb(bundle)}`);
console.log(`dist/md2.standalone.css  ${kb(standalone)}`);
