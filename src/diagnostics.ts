/**
 * Per-invocation diagnostics collector for the MD2 pipeline.
 *
 * The directive transforms (`dir-*.ts`) and the central `remark-md2.ts`
 * walker emit problems through `emitDiagnostic(...)`. Because those modules
 * are imported once and called recursively, we use a small stack so that
 * concurrent `compileMd2WithDiagnostics(...)` calls don't bleed messages
 * between each other.
 *
 * Usage:
 *   beginDiagnostics();
 *   try { ...processor.process(source)... }
 *   finally { const diags = endDiagnostics(); }
 */
import type { Diagnostic, UnistPosition } from './md2-types.js';

const stack: Diagnostic[][] = [];

/** Push a new collector. Call before `processor.process(...)`. */
export function beginDiagnostics(): void {
	stack.push([]);
}

/** Pop the active collector and return its diagnostics. */
export function endDiagnostics(): Diagnostic[] {
	return stack.pop() ?? [];
}

/** Whether a collector is currently active. */
export function isCollecting(): boolean {
	return stack.length > 0;
}

/** Append a diagnostic to the active collector, if any. */
export function emitDiagnostic(d: Diagnostic): void {
	const top = stack[stack.length - 1];
	if (top) top.push(d);
}

/** Convenience: emit a diagnostic deriving line/column from a unist `position`. */
export function emitDiagnosticAt(
	position: UnistPosition | undefined,
	d: Omit<Diagnostic, 'line' | 'column'>
): void {
	const top = stack[stack.length - 1];
	if (!top) return;
	const line = position?.start?.line;
	const column = position?.start?.column;
	top.push({ ...d, line, column });
}

/** Lightweight Levenshtein distance (capped) for "did you mean…" hints. */
export function levenshtein(a: string, b: string, max = 3): number {
	if (a === b) return 0;
	const al = a.length;
	const bl = b.length;
	if (Math.abs(al - bl) > max) return max + 1;
	if (al === 0) return bl;
	if (bl === 0) return al;

	const prev = new Array<number>(bl + 1);
	const curr = new Array<number>(bl + 1);
	for (let j = 0; j <= bl; j++) prev[j] = j;

	for (let i = 1; i <= al; i++) {
		curr[0] = i;
		let rowMin = curr[0];
		for (let j = 1; j <= bl; j++) {
			const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
			curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
			if (curr[j] < rowMin) rowMin = curr[j];
		}
		if (rowMin > max) return max + 1;
		for (let j = 0; j <= bl; j++) prev[j] = curr[j];
	}
	return prev[bl];
}

/** Return the closest match from `candidates` for `word`, or null. */
export function suggestClosest(word: string, candidates: readonly string[]): string | null {
	let best: string | null = null;
	let bestDist = Infinity;
	const max = Math.max(2, Math.min(3, Math.floor(word.length / 2)));
	for (const c of candidates) {
		const d = levenshtein(word, c, max);
		if (d <= max && d < bestDist) {
			best = c;
			bestDist = d;
		}
	}
	return best;
}
