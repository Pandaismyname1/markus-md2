/**
 * Shared helpers used by directive transforms.
 *
 * Two concerns live here:
 *
 *  1. `coerceSeverity` — keep severity values inside the allow-list. Callers
 *     pass the raw `attrs.severity`; out-of-list values coerce to `info`
 *     (default) or `''` (drop) depending on `mode`. Per md2-spec §callout.
 *
 *  2. `extractLabel` — the bracketed directive label `[…]` lands in mdast as
 *     a paragraph child marked `data.directiveLabel = true`. Inside that
 *     paragraph, `remark-directive` parses any `:name` runs as inline
 *     `textDirective` nodes (so `:::event[12:01]` ends up with siblings
 *     `text "12"` + `textDirective name "01"`). The naive
 *     `first.children[0].value` reads only the leading text and drops the
 *     rest. This helper reconstructs the label by stringifying every child,
 *     turning a `textDirective` back into its source form (`:` + name).
 */

import type { MutableNode, Severity } from './md2-types.js';

const VALID_SEVERITIES = new Set<Severity>(['info', 'warning', 'blocking', 'success', 'nit']);

export type CoerceMode = 'default-info' | 'drop';

/**
 * Validate a severity attribute. Returns:
 *   - the lowercased value if it's a known severity
 *   - `'info'` if missing/invalid AND mode === 'default-info'
 *   - `''` if missing/invalid AND mode === 'drop'
 */
export function coerceSeverity(
	raw: string | undefined | null,
	mode: CoerceMode = 'default-info'
): Severity | '' {
	if (raw == null || raw === '') {
		return mode === 'default-info' ? 'info' : '';
	}
	const s = String(raw).toLowerCase() as Severity;
	if (VALID_SEVERITIES.has(s)) return s;
	return mode === 'default-info' ? 'info' : '';
}

/**
 * Read and consume the directive's `[label]` paragraph.
 *
 * Mutates the node: when a directive-label paragraph is present it is shifted
 * off `node.children`, and the reconstructed label text is returned. Returns
 * `null` when the directive has no label.
 *
 * The reconstruction walks the paragraph's children so that `textDirective`
 * runs inside the label (`:01`, `:30`, …) survive — see file header.
 */
export function extractLabel(node: MutableNode): string | null {
	const first = node.children?.[0];
	if (!first || first.type !== 'paragraph' || !first.data?.directiveLabel) {
		return null;
	}
	const text = stringifyLabelChildren(first.children || []);
	node.children!.shift();
	return text;
}

function stringifyLabelChildren(children: MutableNode[]): string {
	const parts: string[] = [];
	for (const c of children) {
		if (!c) continue;
		if (c.type === 'text' || c.type === 'inlineCode') {
			parts.push(c.value ?? '');
			continue;
		}
		if (c.type === 'textDirective' || c.type === 'leafDirective') {
			// Reverse the directive parse: `:name` (+ optional `[…]` + `{…}`).
			// In practice for label content we only see bare `:name` (timestamps,
			// version tags). If a directive has body/attrs inside a label, the
			// reconstruction is best-effort.
			parts.push(':' + (c.name ?? ''));
			if (Array.isArray(c.children) && c.children.length > 0) {
				const inner = stringifyLabelChildren(c.children);
				if (inner) parts.push('[' + inner + ']');
			}
			continue;
		}
		if (Array.isArray(c.children)) {
			parts.push(stringifyLabelChildren(c.children));
		}
	}
	return parts.join('');
}
