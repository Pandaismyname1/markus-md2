/* Build the browser bundle — a single self-contained ESM file with every
 * dependency inlined, so a page can compile MD2 with one import and no
 * package manager:
 *
 *   import { compileMd2 } from 'https://cdn.jsdelivr.net/gh/<owner>/markus-md2@<tag>/browser/md2.js';
 *
 * Output lands in browser/ rather than dist/ because it is committed: CDNs
 * that serve straight from git (jsdelivr's /gh/ path) can only serve files
 * that are actually in the repository. Regenerate with `npm run build`. */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'browser');
mkdirSync(outdir, { recursive: true });

const result = await build({
	entryPoints: [join(root, 'src/index.ts')],
	outfile: join(outdir, 'md2.js'),
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: ['es2022'],
	minify: true,
	sourcemap: false,
	legalComments: 'none',
	metafile: true,
	define: { 'process.env.NODE_ENV': '"production"' }
});

/* The flattened stylesheet ships next to it so a page needs exactly two
 * URLs — one script, one stylesheet — from the same tag. */
function inlineImports(css, baseDir, seen = new Set()) {
	return css.replace(/@import\s+['"]([^'"]+)['"]\s*;/g, (_m, rel) => {
		const file = resolve(baseDir, rel);
		if (seen.has(file)) return '';
		seen.add(file);
		return inlineImports(readFileSync(file, 'utf8'), dirname(file), seen);
	});
}

const cssDir = join(root, 'css');
const bundleCss = inlineImports(readFileSync(join(cssDir, 'md2.css'), 'utf8'), cssDir);
writeFileSync(join(outdir, 'md2.css'), bundleCss, 'utf8');
writeFileSync(
	join(outdir, 'md2.standalone.css'),
	`${readFileSync(join(cssDir, 'md2-host.css'), 'utf8')}\n${bundleCss}`,
	'utf8'
);

const js = readFileSync(join(outdir, 'md2.js'), 'utf8');
const kb = (s) => `${(s.length / 1024).toFixed(1)}KB`;
console.log(`browser/md2.js              ${kb(js)}`);
console.log(`browser/md2.css             ${kb(bundleCss)}`);
console.log(`browser/md2.standalone.css  ${kb(bundleCss) /* plus host tokens */}+`);
if (!result.metafile) process.exitCode = 1;
