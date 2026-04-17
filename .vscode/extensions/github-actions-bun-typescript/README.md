# GitHub Actions Run TypeScript

This workspace-local VS Code extension makes the inlined TypeScript passed to `jaidlab/action-run-typescript` easier to read.

It injects TypeScript syntax into YAML `with.code: |` block scalars when the same step references `jaidlab/action-run-typescript@…`, for example:

```yml
- uses: JaidLab/action-run-typescript@main
  with:
    code: |-
      console.log('hi')
```

The action detection is intentionally lightweight and heuristic. It is case-insensitive for the action reference, ref-agnostic and tuned for this repository’s workflow style. It currently expects the matching `uses:` line to appear before the `with:` block.

The implementation does not try to be a full GitHub Actions or YAML parser.
