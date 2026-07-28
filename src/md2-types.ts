/**
 * Shared types for the MD2 pipeline.
 *
 * The `remark-directive` plugin produces three node types: `containerDirective`,
 * `leafDirective`, `textDirective`. They aren't part of the upstream mdast spec,
 * so we model them here. We deliberately keep these types narrow — every field
 * we read in this package is captured, but `children` stays `unknown[]` to avoid
 * fighting the structural variance of mdast nodes.
 */

import type { Root, RootContent, Parent, Paragraph } from 'mdast';

/** Severity keywords accepted by callout, badge, option, event, step, etc. */
export type Severity = 'info' | 'warning' | 'blocking' | 'success' | 'nit';

/** Hast properties bag attached to mdast nodes for the rehype handoff. */
export interface HastProperties {
	className?: string[];
	style?: string;
	href?: string;
	dateTime?: string;
	[key: string]: unknown;
}

/** Data slot mdast carries through to remark-rehype. */
export interface MdastDirectiveData {
	hName?: string;
	hProperties?: HastProperties;
	directiveLabel?: boolean;
	/** Internal marker used by the tabs collector to find rendered tab bodies. */
	__md2Tab?: { label: string; key: string; body: string };
	/** Internal marker used by the steps collector to find rendered step bodies. */
	__md2Step?: string;
}

/** Common shape for any node we mutate in this module. */
export interface MutableNode {
	type: string;
	value?: string;
	name?: string;
	attributes?: Record<string, string>;
	children?: MutableNode[];
	data?: MdastDirectiveData;
	position?: UnistPosition;
}

/** Container/leaf/text directive node from remark-directive. */
export interface DirectiveNode extends MutableNode {
	type: 'containerDirective' | 'leafDirective' | 'textDirective';
	name: string;
	attributes: Record<string, string>;
	children: MutableNode[];
}

/** Attribute bag passed to every `applyXxxDirective` function. */
export type DirectiveAttrs = Record<string, string | undefined>;

/** A typed helper for the children-of-a-paragraph subset we read. */
export interface InlineTextLike {
	type: 'text' | 'inlineCode' | 'break' | string;
	value?: string;
	children?: InlineTextLike[];
}

/** mdast root + plugin-emitted node types live in our walks. */
export type AnyMdNode = Root | RootContent | Parent | Paragraph | MutableNode;

/** A diagnostic produced while compiling MD2 source. */
export interface Diagnostic {
	severity: 'error' | 'warning' | 'info';
	message: string;
	/** 1-based line into the original source. */
	line?: number;
	/** 1-based column into the original source. */
	column?: number;
	/** Directive name that originated the diagnostic, e.g. 'callout', 'figure'. */
	directive?: string;
	/** Stable diagnostic code, e.g. 'MD2_UNKNOWN_DIRECTIVE'. */
	code?: string;
}

/** Position info as carried by unist/mdast nodes. */
export interface UnistPoint {
	line?: number;
	column?: number;
}
export interface UnistPosition {
	start?: UnistPoint;
	end?: UnistPoint;
}
