/**
 * MD2 `flow` directive transform.
 *
 * Mutates a `containerDirective` node into a raw-HTML node containing an
 * inline SVG flowchart.
 *
 * Syntax:
 *   :::flow{direction=LR title="Deploy pipeline"}
 *   start[git push]
 *   ci[CI checks]
 *   build[Image build]{kind=process}
 *   canary[Canary deploy]
 *   rollback[Auto-rollback]{kind=fail}
 *   done[Promote 100%]{kind=success}
 *
 *   start -> ci
 *   ci -> build
 *   build -> canary
 *   canary -ok-> done
 *   canary -fail-> rollback
 *   :::
 *
 * Grammar:
 *   - Node declaration:  id[Label]{kind=...}?
 *       kind ∈ start | end | success | fail | decision | process (default)
 *   - Plain edge:        id -> id
 *   - Labelled edge:     id -<text>-> id   (e.g. `canary -ok-> done`)
 */

import type { DirectiveAttrs, MutableNode, InlineTextLike } from './md2-types.js';
import { emitDiagnosticAt } from './diagnostics.js';

type FlowKind = 'start' | 'end' | 'success' | 'fail' | 'decision' | 'process';
type FlowDirection = 'LR' | 'TB';

interface FlowNode {
	id: string;
	label: string;
	kind: FlowKind;
}

interface PositionedNode extends FlowNode {
	x: number;
	y: number;
	w: number;
	h: number;
	index: number;
}

interface FlowEdge {
	from: string;
	to: string;
	label: string;
}

const ALLOWED_DIRECTIONS = new Set<FlowDirection>(['LR', 'TB']);
const ALLOWED_KINDS = new Set<FlowKind>(['start', 'end', 'success', 'fail', 'decision', 'process']);

// Layout constants. Picked generously so we don't need to measure text.
const NODE_W = 150;
const NODE_H = 56;
const GAP = 60;
const PAD = 24;
const CHAR_W = 8; // approx px per char at the chosen font-size
const DECISION_OVERHANG = 14; // diamonds widen to accommodate the same label

/** Apply the `:::flow` container directive. */
export function applyFlowDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const directionRaw = (attrs.direction ? String(attrs.direction).toUpperCase() : 'LR') as
		| FlowDirection
		| string;
	const direction: FlowDirection = ALLOWED_DIRECTIONS.has(directionRaw as FlowDirection)
		? (directionRaw as FlowDirection)
		: 'LR';
	const title = attrs.title ? String(attrs.title) : '';

	const source = extractBodyText(node);
	const { nodes, edges } = parseFlowDsl(source);

	if (nodes.length === 0) {
		emitDiagnosticAt(node.position, {
			severity: 'warning',
			message: "':::flow' has no node declarations",
			directive: 'flow',
			code: 'MD2_FLOW_NO_NODES'
		});
		const titleHtml = title
			? `<figcaption class="md2-flow-title">${escapeHtml(title)}</figcaption>`
			: '';
		const html =
			`<figure class="md2-flow md2-flow-empty" data-direction="${escapeAttr(direction)}">` +
			titleHtml +
			`<!-- md2: flow: no node declarations found -->` +
			`</figure>`;
		node.type = 'html';
		node.value = html;
		node.children = [];
		delete node.data;
		return;
	}

	// Position nodes by declaration order.
	const positioned = positionNodes(nodes, direction);
	const idIndex = new Map<string, number>(positioned.map((n, i) => [n.id, i]));

	// Filter edges to known nodes only; drop dangling references silently.
	const validEdges = edges.filter((e) => idIndex.has(e.from) && idIndex.has(e.to));

	const { width, height } = svgSize(positioned, direction);

	const nodeSvg = positioned.map((n) => renderNode(n)).join('');
	const edgeSvg = validEdges.map((e) => renderEdge(e, positioned, idIndex, direction)).join('');
	const defsSvg = renderDefs();

	const titleHtml = title
		? `<figcaption class="md2-flow-title">${escapeHtml(title)}</figcaption>`
		: '';

	const titleSvgEl = title ? `<title>${escapeHtml(title)}</title>` : `<title>Flowchart</title>`;

	// Build a concise <desc> so AT users get more than just the title: count of
	// nodes and edges, and the layout direction. The svg also has role="img"
	// already so AT will announce it as a single image with this name + desc.
	const dirWord = direction === 'LR' ? 'left to right' : 'top to bottom';
	const descText =
		`Flowchart with ${positioned.length} node${positioned.length === 1 ? '' : 's'} and ` +
		`${validEdges.length} edge${validEdges.length === 1 ? '' : 's'}, ${dirWord}.`;
	const descSvgEl = `<desc>${escapeHtml(descText)}</desc>`;

	const svg =
		`<svg class="md2-flow-svg" xmlns="http://www.w3.org/2000/svg" ` +
		`viewBox="0 0 ${width} ${height}" role="img" ` +
		`preserveAspectRatio="xMidYMid meet">` +
		titleSvgEl +
		descSvgEl +
		defsSvg +
		// Edges drawn before nodes so node fills cover any underdrawn lines.
		`<g class="md2-flow-edges">${edgeSvg}</g>` +
		`<g class="md2-flow-nodes">${nodeSvg}</g>` +
		`</svg>`;

	const html =
		`<figure class="md2-flow" data-direction="${escapeAttr(direction)}">` +
		titleHtml +
		svg +
		`</figure>`;

	node.type = 'html';
	node.value = html;
	node.children = [];
	delete node.data;
}

/* ------------------------------------------------------------------ */
/* DSL parsing                                                         */
/* ------------------------------------------------------------------ */

function parseFlowDsl(source: string): { nodes: FlowNode[]; edges: FlowEdge[] } {
	const nodes: FlowNode[] = [];
	const seen = new Map<string, number>();
	const edges: FlowEdge[] = [];

	const nodeRe = /^([A-Za-z_][\w-]*)\[([^\]]*)\](?:\{([^}]*)\})?\s*$/;
	// Edge with optional label between dashes: `a -ok-> b` or `a -> b`.
	const edgeRe = /^([A-Za-z_][\w-]*)\s*-(?:([^->\s][^>]*?)-)?>\s*([A-Za-z_][\w-]*)\s*$/;

	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;
		if (line.startsWith('#') || line.startsWith('//')) continue;

		const em = edgeRe.exec(line);
		if (em) {
			const label = em[2] ? em[2].trim() : '';
			edges.push({ from: em[1], to: em[3], label });
			continue;
		}

		const nm = nodeRe.exec(line);
		if (nm) {
			const id = nm[1];
			const labelText = nm[2];
			const rawAttrs = nm[3] || '';
			const kindRaw = parseInlineAttrs(rawAttrs).kind;
			const kind: FlowKind =
				kindRaw && ALLOWED_KINDS.has(kindRaw.toLowerCase() as FlowKind)
					? (kindRaw.toLowerCase() as FlowKind)
					: 'process';
			if (!seen.has(id)) {
				seen.set(id, nodes.length);
				nodes.push({ id, label: labelText, kind });
			}
			continue;
		}

		// Unknown line shape — silently dropped per error-handling philosophy.
	}

	return { nodes, edges };
}

function parseInlineAttrs(s: string): Record<string, string> {
	const out: Record<string, string> = {};
	if (!s) return out;
	const re = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]+))/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(s)) !== null) {
		const key = m[1];
		const val = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
		out[key] = val;
	}
	return out;
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

function positionNodes(nodes: FlowNode[], direction: FlowDirection): PositionedNode[] {
	const out: PositionedNode[] = [];
	for (let i = 0; i < nodes.length; i++) {
		const n = nodes[i];
		const w = nodeWidthFor(n);
		const h = NODE_H;
		let x: number;
		let y: number;
		if (direction === 'LR') {
			x = PAD + i * (NODE_W + GAP) + (NODE_W - w) / 2;
			y = PAD;
		} else {
			x = PAD;
			y = PAD + i * (NODE_H + GAP);
		}
		out.push({ ...n, x, y, w, h, index: i });
	}
	return out;
}

function nodeWidthFor(n: FlowNode): number {
	const labelW = Math.max(8, n.label.length) * CHAR_W;
	const base = Math.max(NODE_W, labelW + 28);
	if (n.kind === 'decision') return base + DECISION_OVERHANG * 2;
	return base;
}

function svgSize(
	positioned: PositionedNode[],
	direction: FlowDirection
): { width: number; height: number } {
	if (direction === 'LR') {
		const last = positioned[positioned.length - 1];
		const width = last.x + last.w + PAD;
		// Reserve vertical room for backward-edge arc swings.
		const height = NODE_H + PAD * 2 + 60;
		return { width, height };
	}
	const last = positioned[positioned.length - 1];
	const widestW = positioned.reduce((m, n) => Math.max(m, n.w), 0);
	const width = PAD * 2 + widestW + 120; // room for sideways arcs
	const height = last.y + last.h + PAD;
	return { width, height };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderDefs(): string {
	return (
		`<defs>` +
		`<marker id="md2-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" ` +
		`markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
		`<path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />` +
		`</marker>` +
		`</defs>`
	);
}

function renderNode(n: PositionedNode): string {
	const cls = `md2-flow-node md2-flow-node-${n.kind}`;
	const dataAttrs = `data-kind="${escapeAttr(n.kind)}" data-id="${escapeAttr(n.id)}"`;
	const shape = renderNodeShape(n);
	const textY = n.y + n.h / 2 + 4; // approx baseline tweak
	const textX = n.x + n.w / 2;
	const text =
		`<text class="md2-flow-node-label" x="${textX}" y="${textY}" ` +
		`text-anchor="middle">${escapeHtml(n.label)}</text>`;
	return `<g class="${cls}" ${dataAttrs}>${shape}${text}</g>`;
}

function renderNodeShape(n: PositionedNode): string {
	if (n.kind === 'decision') {
		const cx = n.x + n.w / 2;
		const cy = n.y + n.h / 2;
		const points = [
			`${cx},${n.y}`,
			`${n.x + n.w},${cy}`,
			`${cx},${n.y + n.h}`,
			`${n.x},${cy}`
		].join(' ');
		return `<polygon class="md2-flow-node-shape" points="${points}" />`;
	}
	if (n.kind === 'start' || n.kind === 'end') {
		const rx = n.h / 2;
		return (
			`<rect class="md2-flow-node-shape" x="${n.x}" y="${n.y}" ` +
			`width="${n.w}" height="${n.h}" rx="${rx}" ry="${rx}" />`
		);
	}
	return (
		`<rect class="md2-flow-node-shape" x="${n.x}" y="${n.y}" ` +
		`width="${n.w}" height="${n.h}" rx="6" ry="6" />`
	);
}

function renderEdge(
	e: FlowEdge,
	positioned: PositionedNode[],
	idIndex: Map<string, number>,
	direction: FlowDirection
): string {
	const fromIdx = idIndex.get(e.from)!;
	const toIdx = idIndex.get(e.to)!;
	const from = positioned[fromIdx];
	const to = positioned[toIdx];

	const backward = toIdx < fromIdx;
	const skip = Math.abs(toIdx - fromIdx) > 1;

	const cls = [
		'md2-flow-edge',
		backward ? 'md2-flow-edge-back' : '',
		skip && !backward ? 'md2-flow-edge-skip' : ''
	]
		.filter(Boolean)
		.join(' ');

	let pathD: string;
	let midX: number;
	let midY: number;
	let labelOffsetY: number;

	if (direction === 'LR') {
		const fromY = from.y + from.h / 2;
		const toY = to.y + to.h / 2;
		if (!backward && !skip) {
			const x1 = from.x + from.w;
			const x2 = to.x;
			pathD = `M ${x1} ${fromY} L ${x2} ${toY}`;
			midX = (x1 + x2) / 2;
			midY = fromY;
			labelOffsetY = -8;
		} else {
			// Curved arc — go under for forward skips, over for backward.
			const x1 = backward ? from.x : from.x + from.w;
			const x2 = backward ? to.x + to.w : to.x;
			const dipBase = backward ? -1 : 1;
			const dip = dipBase * (from.h / 2 + 28);
			const cx1 = x1 + (x2 - x1) * 0.25;
			const cx2 = x1 + (x2 - x1) * 0.75;
			const ctrlY = fromY + dip;
			pathD = `M ${x1} ${fromY} C ${cx1} ${ctrlY}, ${cx2} ${ctrlY}, ${x2} ${toY}`;
			midX = (x1 + x2) / 2;
			midY = ctrlY;
			labelOffsetY = backward ? -6 : 4;
		}
	} else {
		// TB
		const fromX = from.x + from.w / 2;
		const toX = to.x + to.w / 2;
		if (!backward && !skip) {
			const y1 = from.y + from.h;
			const y2 = to.y;
			pathD = `M ${fromX} ${y1} L ${toX} ${y2}`;
			midX = fromX;
			midY = (y1 + y2) / 2;
			labelOffsetY = 0;
		} else {
			const y1 = backward ? from.y : from.y + from.h;
			const y2 = backward ? to.y + to.h : to.y;
			const sideBase = backward ? -1 : 1;
			const side = sideBase * (from.w / 2 + 40);
			const cy1 = y1 + (y2 - y1) * 0.25;
			const cy2 = y1 + (y2 - y1) * 0.75;
			const ctrlX = fromX + side;
			pathD = `M ${fromX} ${y1} C ${ctrlX} ${cy1}, ${ctrlX} ${cy2}, ${toX} ${y2}`;
			midX = ctrlX;
			midY = (y1 + y2) / 2;
			labelOffsetY = 0;
		}
	}

	const pathSvg =
		`<path class="md2-flow-edge-path" d="${pathD}" fill="none" ` +
		`marker-end="url(#md2-flow-arrow)" />`;

	const labelSvg = e.label ? renderEdgeLabel(e.label, midX, midY + labelOffsetY) : '';

	return `<g class="${cls}" data-from="${escapeAttr(e.from)}" data-to="${escapeAttr(e.to)}">${pathSvg}${labelSvg}</g>`;
}

function renderEdgeLabel(label: string, cx: number, cy: number): string {
	const text = String(label);
	const w = Math.max(20, text.length * (CHAR_W - 1) + 10);
	const h = 16;
	const x = cx - w / 2;
	const y = cy - h / 2;
	return (
		`<g class="md2-flow-edge-label">` +
		`<rect class="md2-flow-edge-label-bg" x="${x}" y="${y}" ` +
		`width="${w}" height="${h}" rx="3" ry="3" />` +
		`<text class="md2-flow-edge-label-text" x="${cx}" y="${cy + 4}" ` +
		`text-anchor="middle">${escapeHtml(text)}</text>` +
		`</g>`
	);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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
