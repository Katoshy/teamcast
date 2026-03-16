# Contributing to TeamCast

Thanks for contributing.

## Before you start

- Check existing issues and the roadmap before starting a larger change.
- Open an issue first if you want to discuss a feature, behavior change, or design direction.

## Local setup

TeamCast currently targets Node.js 24 or newer.

```bash
npm install
npm test
npm run build
```

For local CLI testing during development:

```bash
npm run dev -- <command>
```

## Pull request expectations

1. Keep changes focused and avoid unrelated cleanup in the same PR.
2. Add or update tests when behavior changes.
3. Update docs when CLI behavior, flags, or generated output change.
4. Run `npm test` and `npm run build` before opening the PR.

## Project-specific notes

- `teamcast.yaml` is the source of truth for generated agent files.
- If you change templates, generated docs, or manifest behavior, keep the related output and documentation in sync.
- If a change affects user-facing CLI output, include a short example in the PR description.

## Need help?

Open an issue with context, reproduction steps, and the expected result.
