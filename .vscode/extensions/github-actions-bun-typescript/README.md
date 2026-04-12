# GitHub Actions Bun TypeScript

This workspace-local VS Code extension makes the inlined TypeScript blobs inside GitHub Actions workflows easier to read.

It currently does two things:

1. injects shell syntax into YAML `run: |` block scalars
2. injects TypeScript syntax into Bun stdin heredocs inside those shell blocks

The Bun detection is intentionally lightweight and heuristic. It is tuned for this repository’s workflow style and recognizes both legacy `bun <<'EOF'` blocks and the current `bun run - <<'EOF'` form.

The implementation does not try to be a full GitHub Actions or shell parser.
