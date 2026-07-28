/**
 * MD2 `timeline` / `event` container directives.
 *
 * Syntax:
 *   :::timeline{title="Incident timeline"}
 *
 *   :::event[2026-05-14 12:01]{severity=blocking}
 *   Pager fired: API 5xx rate at 14%.
 *   :::
 *
 *   :::event[2026-05-14 12:08]{severity=warning}
 *   Rolled back to last known good.
 *   :::
 *
 *   :::event[2026-05-14 12:20]{severity=success}
 *   5xx rate back to 0%.
 *   :::
 *
 *   :::
 *
 * Renders as a vertical timeline with severity-coloured dots on the left,
 * a vertical connecting line between dots, and timestamp + body to the right.
 */

import { extractLabel } from './md2-utils.js';
import type { DirectiveAttrs, MutableNode } from './md2-types.js';

const VALID_SEVERITIES = new Set(['info', 'warning', 'blocking', 'success', 'nit']);

/** Wire a `timeline` container directive node so it renders as `<ol class="md2-timeline">`. */
export function applyTimelineDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const data = node.data || (node.data = {});
	data.hName = 'ol';
	data.hProperties = { className: ['md2-timeline'] };

	if (attrs && attrs.title) {
		const children = node.children || (node.children = []);
		children.unshift({
			type: 'paragraph',
			data: {
				hName: 'header',
				hProperties: { className: ['md2-timeline-title'] }
			},
			children: [{ type: 'text', value: String(attrs.title) }]
		});
	}
}

/** Wire an `event` container directive node so it renders as `<li class="md2-timeline-event...">`. */
export function applyEventDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const data = node.data || (node.data = {});
	const severityRaw = attrs && attrs.severity ? String(attrs.severity).toLowerCase() : '';
	const severity = VALID_SEVERITIES.has(severityRaw) ? severityRaw : '';

	const className = ['md2-timeline-event'];
	if (severity) className.push(`md2-timeline-event-${severity}`);

	data.hName = 'li';
	const props: Record<string, unknown> = { className };
	if (severity) props['data-severity'] = severity;
	data.hProperties = props;

	const label = extractLabel(node);
	// Always emit a marker dot via a span so CSS can place it and draw the connector.
	const markerChildren: MutableNode[] = [
		{
			type: 'paragraph',
			data: {
				hName: 'span',
				hProperties: {
					className: ['md2-timeline-dot', ...(severity ? [`md2-timeline-dot-${severity}`] : [])],
					'aria-hidden': 'true'
				}
			},
			children: [{ type: 'text', value: '' }]
		}
	];

	if (label) {
		markerChildren.push({
			type: 'paragraph',
			data: {
				hName: 'time',
				hProperties: {
					className: ['md2-timeline-when'],
					dateTime: label
				}
			},
			children: [{ type: 'text', value: label }]
		});
	}

	const children = node.children || (node.children = []);
	children.unshift(...markerChildren);
}
