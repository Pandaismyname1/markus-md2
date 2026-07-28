/**
 * MD2 `chart` directive transform.
 *
 * Mutates a `containerDirective` node into a raw-HTML node containing an
 * inline SVG chart and a hidden accessible data table.
 *
 * Syntax:
 *   :::chart{type=bar title="Tokens per format" max=5000}
 *   MD2: 811
 *   HTML: 4548
 *   Plain text: 200
 *   :::
 *
 *   :::chart{type=line title="API p95 latency (ms)" baseline=200}
 *   2026-05-01: 180
 *   2026-05-02: 210
 *   …
 *   :::
 *
 *   :::chart{type=sparkline}
 *   12 18 22 19 24 31 29 34
 *   :::
 */

import type { DirectiveAttrs, MutableNode, InlineTextLike } from './md2-types.js';
import { emitDiagnosticAt } from './diagnostics.js';

type ChartType = 'bar' | 'line' | 'sparkline';

interface DataPoint {
	label: string;
	value: number;
}

const ALLOWED_TYPES = new Set<ChartType>(['bar', 'line', 'sparkline']);

// Layout constants for full-size charts.
const W = 520;
const H = 240;
const PAD_L = 56;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 36;

// Sparkline geometry.
const SPARK_W = 80;
const SPARK_H = 20;
const SPARK_PAD = 2;

/** Apply the `:::chart` container directive. */
export function applyChartDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const typeRaw = (attrs.type ? String(attrs.type).toLowerCase() : '') as ChartType | string;
	const type: ChartType = ALLOWED_TYPES.has(typeRaw as ChartType) ? (typeRaw as ChartType) : 'bar';
	const title = attrs.title ? String(attrs.title) : '';
	const maxAttr = attrs.max != null && attrs.max !== '' ? Number(attrs.max) : null;
	const baselineAttr =
		attrs.baseline != null && attrs.baseline !== '' ? Number(attrs.baseline) : null;

	const source = extractBodyText(node);
	const data: DataPoint[] =
		type === 'sparkline' ? parseSparklineData(source) : parseLabelledData(source);

	// Diagnose unknown chart type before falling back to 'bar'.
	if (typeRaw && !ALLOWED_TYPES.has(typeRaw as ChartType)) {
		emitDiagnosticAt(node.position, {
			severity: 'warning',
			message:
				`unknown chart type '${attrs.type}' on :::chart` +
				` (allowed: bar, line, sparkline); falling back to 'bar'`,
			directive: 'chart',
			code: 'MD2_CHART_BAD_TYPE'
		});
	}

	if (data.length === 0) {
		emitDiagnosticAt(node.position, {
			severity: 'warning',
			message: "':::chart' has no data lines",
			directive: 'chart',
			code: 'MD2_CHART_NO_DATA'
		});
		const titleHtml = title
			? `<figcaption class="md2-chart-title">${escapeHtml(title)}</figcaption>`
			: '';
		const html =
			`<figure class="md2-chart md2-chart-${escapeAttr(type)} md2-chart-empty">` +
			titleHtml +
			`<!-- md2: chart: no data points found -->` +
			`</figure>`;
		node.type = 'html';
		node.value = html;
		node.children = [];
		delete node.data;
		return;
	}

	const values = data.map((d) => d.value);
	const rawMax = Math.max(...values);
	const rawMin = Math.min(...values, 0);
	const yMax =
		Number.isFinite(maxAttr) && (maxAttr as number) > 0
			? (maxAttr as number)
			: Math.max(1, rawMax * 1.1);
	const yMin = rawMin < 0 ? rawMin * 1.1 : 0;

	let svg: string;
	if (type === 'sparkline') {
		svg = renderSparkline(values, yMax, yMin, title, data);
	} else if (type === 'line') {
		svg = renderLine(data, yMax, yMin, Number.isFinite(baselineAttr) ? baselineAttr : null, title);
	} else {
		svg = renderBar(data, yMax, yMin, title);
	}

	const includeCaption = !!title && (type !== 'sparkline' || !!title);
	const captionHtml =
		includeCaption && title
			? `<figcaption class="md2-chart-title">${escapeHtml(title)}</figcaption>`
			: '';

	const tableHtml = renderDataTable(data, type);

	const html =
		`<figure class="md2-chart md2-chart-${escapeAttr(type)}">` +
		captionHtml +
		svg +
		tableHtml +
		`</figure>`;

	node.type = 'html';
	node.value = html;
	node.children = [];
	delete node.data;
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function parseLabelledData(source: string): DataPoint[] {
	const out: DataPoint[] = [];
	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;
		if (line.startsWith('#') || line.startsWith('//')) continue;
		const idx = line.lastIndexOf(':');
		if (idx === -1) continue;
		const label = line.slice(0, idx).trim();
		const valStr = line.slice(idx + 1).trim();
		const value = Number(valStr);
		if (!label || !Number.isFinite(value)) continue;
		out.push({ label, value });
	}
	return out;
}

function parseSparklineData(source: string): DataPoint[] {
	const tokens = source.split(/\s+/).filter(Boolean);
	const out: DataPoint[] = [];
	for (const t of tokens) {
		const v = Number(t);
		if (Number.isFinite(v)) {
			out.push({ label: String(out.length + 1), value: v });
		}
	}
	return out;
}

/* ------------------------------------------------------------------ */
/* Rendering — bar                                                     */
/* ------------------------------------------------------------------ */

function renderBar(data: DataPoint[], yMax: number, yMin: number, chartTitle: string): string {
	const innerW = W - PAD_L - PAD_R;
	const innerH = H - PAD_T - PAD_B;
	const n = data.length;
	const slot = innerW / n;
	const barW = Math.max(4, slot * 0.7);

	const yScale = (v: number) => PAD_T + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

	const ticks = buildYTicks(yMin, yMax, 4);
	const gridSvg = ticks
		.map((t) => {
			const y = yScale(t);
			return (
				`<line class="md2-chart-grid" x1="${PAD_L}" y1="${y}" ` +
				`x2="${W - PAD_R}" y2="${y}" />` +
				`<text class="md2-chart-tick" x="${PAD_L - 6}" y="${y + 4}" ` +
				`text-anchor="end">${escapeHtml(formatTick(t))}</text>`
			);
		})
		.join('');

	const baseY = yScale(Math.max(0, yMin));
	const bars = data
		.map((d, i) => {
			const cx = PAD_L + slot * i + slot / 2;
			const bx = cx - barW / 2;
			const by = yScale(Math.max(d.value, 0));
			const top = d.value >= 0 ? by : baseY;
			const h = Math.abs(yScale(d.value) - baseY);
			return (
				`<rect class="md2-chart-bar" x="${bx}" y="${top}" ` +
				`width="${barW}" height="${h}"><title>${escapeHtml(d.label)}: ${escapeHtml(String(d.value))}</title></rect>`
			);
		})
		.join('');

	const labels = data
		.map((d, i) => {
			const cx = PAD_L + slot * i + slot / 2;
			return (
				`<text class="md2-chart-xlabel" x="${cx}" y="${H - PAD_B + 16}" ` +
				`text-anchor="middle">${escapeHtml(truncate(d.label, 12))}</text>`
			);
		})
		.join('');

	const axis =
		`<line class="md2-chart-axis" x1="${PAD_L}" y1="${baseY}" ` +
		`x2="${W - PAD_R}" y2="${baseY}" />`;

	const a11y = svgA11y(chartTitle || 'Bar chart', summarizeData(data, 'bar'));
	return wrapSvg(W, H, a11y + gridSvg + bars + axis + labels);
}

/* ------------------------------------------------------------------ */
/* Rendering — line                                                    */
/* ------------------------------------------------------------------ */

function renderLine(
	data: DataPoint[],
	yMax: number,
	yMin: number,
	baseline: number | null,
	chartTitle: string
): string {
	const innerW = W - PAD_L - PAD_R;
	const innerH = H - PAD_T - PAD_B;
	const n = data.length;
	const step = n > 1 ? innerW / (n - 1) : 0;

	const yScale = (v: number) => PAD_T + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
	const xAt = (i: number) => (n === 1 ? PAD_L + innerW / 2 : PAD_L + step * i);

	const ticks = buildYTicks(yMin, yMax, 4);
	const gridSvg = ticks
		.map((t) => {
			const y = yScale(t);
			return (
				`<line class="md2-chart-grid" x1="${PAD_L}" y1="${y}" ` +
				`x2="${W - PAD_R}" y2="${y}" />` +
				`<text class="md2-chart-tick" x="${PAD_L - 6}" y="${y + 4}" ` +
				`text-anchor="end">${escapeHtml(formatTick(t))}</text>`
			);
		})
		.join('');

	const pathParts = data.map((d, i) => {
		const x = xAt(i);
		const y = yScale(d.value);
		return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
	});
	const path = `<path class="md2-chart-line-path" d="${pathParts.join(' ')}" ` + `fill="none" />`;

	// Area under the line for visual weight.
	const baseY = yScale(Math.max(0, yMin));
	const areaParts = [
		`M ${xAt(0)} ${baseY}`,
		...data.map((d, i) => `L ${xAt(i)} ${yScale(d.value)}`),
		`L ${xAt(n - 1)} ${baseY}`,
		`Z`
	];
	const area = `<path class="md2-chart-line-area" d="${areaParts.join(' ')}" />`;

	const dots = data
		.map((d, i) => {
			const x = xAt(i);
			const y = yScale(d.value);
			return (
				`<circle class="md2-chart-dot" cx="${x}" cy="${y}" r="3">` +
				`<title>${escapeHtml(d.label)}: ${escapeHtml(String(d.value))}</title>` +
				`</circle>`
			);
		})
		.join('');

	// X-axis labels: show endpoints and at most ~6 evenly spaced labels.
	const labelSvg = pickXLabels(data)
		.map((p) => {
			const x = xAt(p.i);
			return (
				`<text class="md2-chart-xlabel" x="${x}" y="${H - PAD_B + 16}" ` +
				`text-anchor="middle">${escapeHtml(truncate(p.label, 12))}</text>`
			);
		})
		.join('');

	const axis =
		`<line class="md2-chart-axis" x1="${PAD_L}" y1="${baseY}" ` +
		`x2="${W - PAD_R}" y2="${baseY}" />`;

	const baselineSvg =
		baseline != null && Number.isFinite(baseline)
			? (() => {
					const by = yScale(baseline);
					return (
						`<line class="md2-chart-baseline" x1="${PAD_L}" y1="${by}" ` +
						`x2="${W - PAD_R}" y2="${by}" />` +
						`<text class="md2-chart-baseline-label" x="${W - PAD_R - 4}" ` +
						`y="${by - 4}" text-anchor="end">baseline ${escapeHtml(String(baseline))}</text>`
					);
				})()
			: '';

	const a11y = svgA11y(chartTitle || 'Line chart', summarizeData(data, 'line'));
	return wrapSvg(W, H, a11y + gridSvg + area + path + baselineSvg + dots + axis + labelSvg);
}

function pickXLabels(data: DataPoint[]): Array<{ i: number; label: string }> {
	const n = data.length;
	if (n <= 6) return data.map((d, i) => ({ i, label: d.label }));
	const out: Array<{ i: number; label: string }> = [];
	const stride = Math.ceil(n / 6);
	for (let i = 0; i < n; i += stride) out.push({ i, label: data[i].label });
	if (out[out.length - 1].i !== n - 1) out.push({ i: n - 1, label: data[n - 1].label });
	return out;
}

/* ------------------------------------------------------------------ */
/* Rendering — sparkline                                               */
/* ------------------------------------------------------------------ */

function renderSparkline(
	values: number[],
	yMax: number,
	yMin: number,
	chartTitle: string,
	data: DataPoint[]
): string {
	const innerW = SPARK_W - SPARK_PAD * 2;
	const innerH = SPARK_H - SPARK_PAD * 2;
	const n = values.length;
	const step = n > 1 ? innerW / (n - 1) : 0;
	const yScale = (v: number) => SPARK_PAD + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

	const pathParts = values.map((v, i) => {
		const x = n === 1 ? SPARK_PAD + innerW / 2 : SPARK_PAD + step * i;
		const y = yScale(v);
		return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
	});

	const lastIdx = n - 1;
	const lastX = n === 1 ? SPARK_PAD + innerW / 2 : SPARK_PAD + step * lastIdx;
	const lastY = yScale(values[lastIdx]);

	const path = `<path class="md2-chart-spark-path" d="${pathParts.join(' ')}" fill="none" />`;
	const dot =
		`<circle class="md2-chart-spark-last" cx="${lastX.toFixed(2)}" ` +
		`cy="${lastY.toFixed(2)}" r="1.6" />`;

	// Sparkline keeps aria-hidden="true" on the SVG — it's a decorative inline
	// glyph; the readable representation lives in the sibling data table.
	return (
		`<svg class="md2-chart-svg md2-chart-spark-svg" ` +
		`xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPARK_W} ${SPARK_H}" ` +
		`role="img" preserveAspectRatio="none" aria-hidden="true">` +
		`<title>${escapeHtml(chartTitle || 'Sparkline')}</title>` +
		`<desc>${escapeHtml(summarizeData(data, 'sparkline'))}</desc>` +
		path +
		dot +
		`</svg>`
	);
}

/* ------------------------------------------------------------------ */
/* Hidden accessible data table                                        */
/* ------------------------------------------------------------------ */

function renderDataTable(data: DataPoint[], type: ChartType): string {
	const rowsHtml = data
		.map(
			(d) =>
				`<tr><th scope="row">${escapeHtml(d.label)}</th>` +
				`<td>${escapeHtml(String(d.value))}</td></tr>`
		)
		.join('');
	const labelHeader = type === 'sparkline' ? '#' : 'Label';
	// The table is visually hidden via the `md2-visually-hidden` utility class
	// (clip-path off-screen) rather than the `hidden` attribute — `hidden`
	// removes it from the AT tree too, which defeats the entire purpose. The
	// utility class keeps the table readable by screen readers.
	return (
		`<table class="md2-chart-data md2-visually-hidden">` +
		`<thead><tr><th scope="col">${labelHeader}</th>` +
		`<th scope="col">Value</th></tr></thead>` +
		`<tbody>${rowsHtml}</tbody>` +
		`</table>`
	);
}

/**
 * Compose an SVG `<title>` + `<desc>` pair so the surrounding `role="img"`
 * SVG has an accessible name (title) and longer description (desc). Both are
 * recognised by AT and inherently visually hidden by the SVG renderer.
 */
function svgA11y(title: string, desc: string): string {
	return `<title>${escapeHtml(title)}</title><desc>${escapeHtml(desc)}</desc>`;
}

/**
 * Short, human-readable summary of the data series — used as the SVG `<desc>`
 * so AT users get an at-a-glance signal beyond the chart title.
 */
function summarizeData(data: DataPoint[], kind: ChartType): string {
	const n = data.length;
	if (n === 0) return `${kind} chart with no data`;
	const values = data.map((d) => d.value);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const first = data[0];
	const last = data[n - 1];
	if (kind === 'sparkline') {
		return `Sparkline of ${n} values, ranging from ${formatTick(min)} to ${formatTick(max)}.`;
	}
	if (kind === 'line') {
		return `Line chart with ${n} points from ${first.label} to ${last.label}, ranging from ${formatTick(min)} to ${formatTick(max)}.`;
	}
	return `Bar chart with ${n} bars, values ranging from ${formatTick(min)} to ${formatTick(max)}.`;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function wrapSvg(width: number, height: number, body: string): string {
	return (
		`<svg class="md2-chart-svg" xmlns="http://www.w3.org/2000/svg" ` +
		`viewBox="0 0 ${width} ${height}" role="img" ` +
		`preserveAspectRatio="xMidYMid meet">` +
		body +
		`</svg>`
	);
}

function buildYTicks(min: number, max: number, count: number): number[] {
	const step = (max - min) / count;
	const out: number[] = [];
	for (let i = 0; i <= count; i++) {
		out.push(min + step * i);
	}
	return out;
}

function formatTick(v: number): string {
	if (!Number.isFinite(v)) return '';
	const absV = Math.abs(v);
	if (absV >= 1000) {
		// 1234 → "1.2k", 12345 → "12k"
		const k = v / 1000;
		return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}k`;
	}
	if (Number.isInteger(v)) return String(v);
	return String(Math.round(v * 10) / 10);
}

function truncate(s: string, max: number): string {
	const str = String(s);
	if (str.length <= max) return str;
	return str.slice(0, Math.max(1, max - 1)) + '…';
}

function extractBodyText(node: MutableNode): string {
	const out: string[] = [];
	collectText(node, out);
	return out.join('\n');
}

function collectText(n: MutableNode | InlineTextLike | null | undefined, out: string[]): void {
	if (!n) return;
	if (n.type === 'text' || n.type === 'inlineCode') {
		out.push(n.value || '');
		return;
	}
	if (n.type === 'code') {
		out.push(n.value || '');
		return;
	}
	if (n.type === 'paragraph') {
		const parts: string[] = [];
		for (const c of n.children || []) collectInline(c as InlineTextLike, parts);
		out.push(parts.join(''));
		return;
	}
	if (Array.isArray(n.children)) {
		for (const c of n.children) collectText(c as MutableNode, out);
	}
}

function collectInline(n: InlineTextLike | null | undefined, out: string[]): void {
	if (!n) return;
	if (n.type === 'text' || n.type === 'inlineCode') {
		out.push(n.value || '');
		return;
	}
	if (n.type === 'break') {
		out.push('\n');
		return;
	}
	if (Array.isArray(n.children)) {
		for (const c of n.children) collectInline(c, out);
	}
}

function escapeHtml(s: string): string {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
	return String(s).replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}
