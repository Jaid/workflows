# GitHub Actions Bun TypeScript

This workspace-local VS Code extension makes the inlined TypeScript blobs inside GitHub Actions workflows easier to read.

It currently does two things:

1. injects shell syntax into YAML `run: |` block scalars
2. injects TypeScript syntax into Bun heredocs inside those shell blocks

The implementation is intentionally lightweight and heuristic. It is tuned for this repository’s workflow style and does not try to be a full GitHub Actions or shell parser.
