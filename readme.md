# workflows

Reusable GitHub Actions for Bun packages, SPA screenshots, Docker images and releases. Keep the event triggers and repository-specific choices in the caller; the jobs live here.

## Bun CI

Replace the usual `lint.yml` and `test.yml` with `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  check:
    uses: Jaid/workflows/.github/workflows/bunCi.yml@main
```

This installs dependencies once with `bun install --frozen-lockfile`, runs the package’s `lint` script (or the installed ESLint with `bun x --no-install --bun eslint .`) and runs `bun run test`. Bun follows `packageManager` or `engines.bun` in the caller’s root `package.json`, falling back to the latest stable release.

| Input | Default | Use |
| --- | --- | --- |
| `scripts` | `test` | Package script names, one per line, in execution order. For example, use `typecheck`, `test` and `build`. An empty string runs no scripts. |
| `lint` | `true` | Set to `false` for test-only jobs or to put a custom `lint` script in the ordered list. |
| `bunVersion` | auto | Override the version for this job. |
| `runner` | `ubuntu-latest` | A runner label; a caller matrix can pass `${{ matrix.os }}`. |

If branch protection requires separate lint and test checks, keep the two caller jobs: pass `scripts: ''` to the lint job and `lint: false` to the test job.

## Publish a package

`.github/workflows/publishPackage.yml` in the package repository:

```yaml
name: Publish package
on:
  push:
    tags: ['v*']
jobs:
  publish:
    permissions:
      contents: read
      id-token: write
    uses: Jaid/workflows/.github/workflows/publishPackage.yml@main
```

Configure an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for the **caller’s** owner, repository and workflow filename, with direct `npm publish` enabled. For existing token-based projects, add `secrets: {npmToken: "${{ secrets.npmToken }}"}` to the calling job instead of configuring a trusted publisher. Keep the permissions shown in either case.

The read-only job installs, runs `scripts` (default `test`), runs `prepublishOnly` if present and packs with Bun, including its pack hooks and workspace version resolution. Both the source and packed manifest must be publishable and match `v<version>`. A separate job downloads that exact tarball by artifact ID and runs `npm publish` with lifecycle scripts disabled. The npm credential is only used in that job.

For a generated distribution, add the following to the calling job:

```yaml
with:
  scripts: |
    typecheck
    test
    build
  packageDirectory: dist
```

`scripts` run from the repository root; `packageDirectory` selects the package to pack. `bunVersion` and `lint` are also supported (`lint` defaults to `false` for publishing). For tags made by `bump.yml`, trigger the caller on `repository_dispatch: {types: [bumped]}`: GitHub does not start another tag-push workflow for a tag created with `GITHUB_TOKEN`. The publishing workflow checks out `client_payload.newTag` in that case.

## Capture a built SPA

[`captureSpa.yml`](.github/workflows/captureSpa.yml) screenshots the static files from a previous job in the same run. It serves the artifact over loopback HTTP, including `index.html` fallback for client-side routes, and uses [capture-page](https://github.com/Jaid/capture-page) with the hosted runner’s Chrome. The capture job needs only `contents: read` and no secrets.

If the build job already uploads `dist/` as an artifact named `build`, the entire caller addition is:

```yaml
  screenshot:
    needs: build
    uses: Jaid/workflows/.github/workflows/captureSpa.yml@main
    permissions:
      contents: read
```

| Input | Default | Use |
| --- | --- | --- |
| `buildArtifact` / `artifactId` | `build` | The build artifact’s name or immutable ID. The ID takes precedence; pass `needs.build.outputs.artifactId` if your build exposes the upload step’s `artifact-id`. |
| `siteDirectory` | `.` | Directory **inside** the artifact containing `index.html`. Uploading only `dist/` puts its contents at the artifact root; use `dist` if the artifact contains `dist/index.html` alongside other files. |
| `basePath` / `route` | `/` / `/` | Where the app was built to be mounted and which app route to open. For example, `/docs/` + `/guide?lang=en#install` opens `/docs/guide?lang=en#install`. |
| `captureOptions` | `{}` | JSON options: `width`, `height`, `deviceScaleFactor`, `fullPage`, `omitBackground`, `format` (`png`, `webp` or `jpeg`), `quality`, `colorScheme`, `motion`, `mediaType`, `wait`, `delay`, `timeout` and `toolCalls`. Defaults include 1920×1080, PNG and `networkidle2`. Use `{"wait":{"selector":"#ready"}}` for hydrated content or `{"wait":"three"}` for visible canvas output. |
| `imageName` | `screenshot` | Filename stem. Give each capture a distinct name; reruns add the attempt number. |
| `storageBranch` | none | On a public repository’s push or manual run, append the image to this branch in the caller’s repository (creating it if needed) and embed it in the run summary. This requires `contents: write` on the calling job. |
| `webhook` | none | HTTP(S) URL that receives a `POST` with one `multipart/form-data` field named `file`, containing the screenshot’s original bytes, filename and image MIME type. The endpoint must return a 2xx status. |

The run summary links directly to the single-file image artifact. It opens for signed-in readers until the repository’s artifact retention expires. An opt-in public preview uses an immutable raw image URL and stays available independently of artifact retention. Outputs are `artifactId`, `artifactUrl`, `imageFile` and `previewUrl` (empty when unpublished).

Branch storage and webhook delivery run independently after the artifact upload. A webhook alone needs only `contents: read`. For a URL containing a token, pass `secrets: {webhook: "${{ secrets.SCREENSHOT_WEBHOOK }}"}` on the calling job; it takes precedence over `with.webhook`.

For a gallery of routes or viewports, use a caller matrix over the same build:

```yaml
  screenshots:
    needs: build
    strategy:
      matrix:
        include:
          - {name: home, route: '/', width: 1440, height: 900}
          - {name: mobile-settings, route: '/settings', width: 390, height: 844}
    uses: Jaid/workflows/.github/workflows/captureSpa.yml@main
    permissions:
      contents: write
    with:
      imageName: ${{ matrix.name }}
      route: ${{ matrix.route }}
      captureOptions: '{"width":${{ matrix.width }},"height":${{ matrix.height }},"format":"webp"}'
      storageBranch: previews/spa
      webhook: ${{ vars.SCREENSHOT_WEBHOOK }}
```

## Docker images

```yaml
name: Docker
on:
  push:
    branches: [main]
  pull_request:
  repository_dispatch:
    types: [bumped]
jobs:
  image:
    uses: Jaid/workflows/.github/workflows/pushDocker.yml@main
    permissions:
      contents: read
      packages: write
    with:
      buildContext: src
      matrixPlatform: linux/amd64 linux/arm64
      testAppArgs: --version
      testEval: status === 0 && stdout.length > 0
      versionTag: ${{ github.event.client_payload.newTag }}
      dockerHubUser: jaidchen
    secrets:
      dockerHubToken: ${{ secrets.dockerHubToken }}
```

Each entry builds once, runs the image from its archive and publishes that archive after its test passes. AMD64 and ARM64 build and test on native Ubuntu runners; other Linux platforms use QEMU. Pull requests and `publish: false` only build and test. A build-only caller needs `contents: read` and no secrets.

- **Registries:** GHCR uses the caller’s `GITHUB_TOKEN` and needs `packages: write` on the calling job. For `Jaid/docker-builder`, the default destination is `ghcr.io/jaid/docker-builder/builder`. Passing `dockerHubToken` also publishes to `docker.io/<dockerHubUser>/<imageName>`. `readmePath` optionally updates the Docker Hub description.
- **Build:** `buildContext` defaults to `src` relative to the caller. `buildArgs` accepts one `KEY=value` per line. `matrixBases` × `matrixPlatform` produces the variants; `arch` remains an alias for `matrixPlatform`. Both lists accept whitespace, commas or semicolons. The default is one `linux/amd64` image.
- **Tags:** the default is the branch name. `versionTag` adds an explicit tag. For a caller triggered by SemVer tag pushes, enable `addVersionTag: true`. `baseTags` and `additionalTags` take [docker/metadata-action rules](https://github.com/docker/metadata-action#tags-input); `addShaTags` and `addScheduleTags` are shortcuts. Matrix variants have separate tags (for example `main` and `main-arm8`), not a shared multi-architecture index. The flavor also applies to automatic `latest` tags.
- **Tests:** `testDockerRunArgs` goes before the image and `testAppArgs` after it. Quotes and escapes group literal argv; there is no shell expansion. `testEval` defaults to `status === 0` and can inspect `stdout`, `stderr`, `result`, `inputs` and `fs` from the caller’s checkout. For services, supply a smoke-test command that exits.
- **Custom matrices:** `matrixAdditionEvals` accepts one `key: expression` per line; later expressions can use earlier values. `matrixFlavorEval` can use `base`, `platform`, additions, `baseShortcuts`, `platformShortcuts` and `getFlavorPart`. The resulting flavor must be unique; an empty flavor is the `default` entry. Keep these expressions and `testEval` in trusted workflow code.
- **Outputs:** `artifactId` and `imageFile` identify the tested archive, including on build-only runs. `digest` is the published GHCR manifest digest, `imageId` the image config digest and `meta` the publication metadata JSON. `imageName`, `imageSlug` and `imageUser` are also available after publication. These are scalar outputs: for a matrix, GitHub returns the last successful entry that sets a value, not a digest for the whole matrix.

The [full Docker input schema](.github/workflows/pushDocker.yml) includes the remaining tag, flavor and registry options. Existing `pushDocker.yml@main` callers can keep their inputs. Older callers with a separate `testDocker.yml` job can move `test` to `testEval` and `dockerRunArgs` to `testDockerRunArgs` on `pushDocker` to avoid testing twice.

## Version bumps and releases

```yaml
name: Bump
on:
  workflow_dispatch:
    inputs:
      amount:
        type: choice
        options: [patch, minor, major]
        default: patch
jobs:
  bump:
    uses: Jaid/workflows/.github/workflows/bump.yml@main
    permissions:
      contents: write
    with:
      bumpAmount: ${{ inputs.amount }}
      updateFiles: true
```

On `releaseBranch` (default `main`), this bumps the highest stable `vX.Y.Z` or `X.Y.Z` tag, starting at `0.0.0` when none exists. `#major`, `#minor`, `#patch` and `#none` in commit messages since the last tag override `bumpAmount` in that priority order. With `updateFiles: true`, an existing root `package.json` version is committed before the tag; the branch and tag are pushed atomically. A moved branch fails the run rather than rebasing a release onto a different commit.

`releaseTitle` and `releaseBody` are Handlebars templates with `repo.owner`, `repo.name`, `repo.slug`, `repo.url`, `oldTag` and `newTag`. `makeLatest` accepts `'true'`, `'false'` or `'legacy'`. The workflow creates or updates the GitHub release and sends a `bumped` repository dispatch. Its payload has the same fields as the workflow outputs: `oldTag`, `newTag`, `newSemver`, `releaseId`, `releaseUrl`, `releaseTitle` and `releaseBody`.

## Other entry points

| Workflow | Purpose |
| --- | --- |
| [makeDockerTagMatrix.yml](.github/workflows/makeDockerTagMatrix.yml) | Returns the `output` JSON array for `strategy.matrix.include` and its `nativeArch` subset. |
| [buildDocker.yml](.github/workflows/buildDocker.yml) | Builds a single platform. Pass `artifactId`, `imageFile` and `imageIdentifier` to a downstream test. |
| [testDocker.yml](.github/workflows/testDocker.yml) | Tests a build artifact by ID or name. Without an artifact or identifier it builds `buildContext` first. Accepts the older `test` alias. |
| [uploadDocker.yml](.github/workflows/uploadDocker.yml) | Publishes `buildOutput: ${{ toJSON(needs.build.outputs) }}`. OCI labels are set at build time; use `buildDocker.releaseOptions` for a custom title or version. |
| [executePushDocker.yml](.github/workflows/executePushDocker.yml) | Runs the build → test → upload chain for one matrix entry. |
| [debug.yml](.github/workflows/debug.yml) | Reports the event, ref, runner, toolchain and disk space without dumping environment values. |

## Maintaining the workflows

Callers using `@main` pick up changes as they land. Pin the call to a full commit SHA to roll out on your own schedule. On GitHub.com, [self-repository action references (`$/`)](https://github.blog/changelog/2026-07-30-reference-same-repository-actions-with-self-repository-syntax/) load the helpers at the workflow’s own commit. A checkout in the job is the caller’s project.

Run `bun install --frozen-lockfile`, `bun run typecheck`, `bun run test` and `actionlint` from the repository root. [CI](.github/workflows/check.yml) also calls the reusable Docker pipeline on AMD64 and ARM64 and verifies that two tags in a temporary registry resolve to the tested image. External action commits are pinned in [actions.lock](.github/workflows/actions.lock). Run [`gh actions-lock`](https://github.com/github/gh-actions-lock) after changing an action reference; CI verifies the lockfile and Dependabot checks for updates monthly.
