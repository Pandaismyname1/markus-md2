# Security

## Reporting

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/Pandaismyname1/markus-md2/security/advisories/new) rather than a public issue. Expect an acknowledgement within a few days.

## What's in scope

MD2 compiles untrusted-ish text into HTML, so the interesting questions are about what that HTML can do.

**The compiler does not sanitise its output, by design.** Two documented behaviours follow from that, both verified against the current build:

```js
compileMd2('<script>alert(1)</script>');
// → <script>alert(1)</script>          rehype-raw passes raw HTML through

compileMd2('[click](javascript:alert(1))');
// → <a href="javascript:alert(1)">     ordinary Markdown link syntax, no raw HTML needed
```

This is deliberate. MD2 documents are authored by the operator of the pipeline — a person or their AI assistant — not submitted by anonymous third parties, and the same freedom is what lets a document embed an inline SVG or an anchor target. A sanitiser that ran unconditionally would break those legitimate cases.

The consequence is worth stating plainly: **if you compile MD2 from a source you don't control and inject the result into a page, you are injecting untrusted HTML.** Sanitise the output — `rehype-sanitize`, DOMPurify, or your framework's equivalent — before it reaches a browser. The compiler will not do it for you.

In scope for a report:

- A crafted document that makes the compiler hang, blow the stack, or consume unbounded memory. Charts, flows, and trees parse loops of user-supplied lines; a pathological input that never terminates is a bug worth fixing.
- Anything in the published package that reaches the network, the filesystem, or the environment. The compiler does none of these and should stay that way.
- Output that escapes its container in a way the two documented behaviours above don't explain.

Out of scope: the two behaviours shown above, and XSS in a host application that skipped sanitising untrusted input.

## Supported versions

Pre-1.0, only the latest minor version gets fixes. Once 1.0 lands this section will describe a real support window.
