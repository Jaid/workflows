# workflows

Reusable GitHub workflows for my repositories.

The reusable entry points live in .github/workflows/*.yml.

Example:

```yml
jobs:
  pushDocker:
    uses: Jaid/workflows/.github/workflows/pushDocker.yml@main
```
