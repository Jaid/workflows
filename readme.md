# workflows

Reusable GitHub workflows for my repositories.

The helper logic is inlined directly into the workflow files, so this repo no longer needs a dist branch, a TypeScript-to-JavaScript build step or runtime package installation.

Example:

```yml
jobs:
  pushDocker:
    uses: Jaid/workflows/.github/workflows/pushDocker.yml@main
```
