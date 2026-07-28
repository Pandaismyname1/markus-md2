/* @markus/md2 — public entry point.
 *
 * Compile MD2 (Markdown + directives) to HTML, with optional diagnostics, and
 * promote plain Markdown to MD2 with the auto-upgrade pass.
 *
 *   import { compileMd2, upgradeMarkdown } from '@markus/md2';
 *   import '@markus/md2/md2.css';
 *   import '@markus/md2/md2-host.css'; // only when you have no daisyUI
 */
export { compileMd2, compileMd2Sync, compileMd2WithDiagnostics } from './compile.js';
export { upgradeMarkdown } from './upgrade/index.js';
export type { UpgradeRule } from './upgrade/index.js';
export type { Diagnostic, Severity, DirectiveAttrs } from './md2-types.js';
