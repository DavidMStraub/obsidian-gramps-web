# Gramps Web for Obsidian

Obsidian community plugin that links notes to objects in a [Gramps Web](https://www.grampsweb.org/) server via its REST API ([gramps-web-api](https://github.com/gramps-project/gramps-web-api)).

## Commands

```bash
npm install
npm run dev     # watch build
npm run build   # type-check + production build
npm run lint
```

Test by symlinking the repo to `<vault>/.obsidian/plugins/gramps-web/`.

## Layout

- `src/main.ts`: lifecycle only
- `src/api/`: HTTP client, auth (tokens in `app.secretStorage`), cache, types
- `src/links/`: `gramps://` URIs, click and hover handling (reading view and live preview)
- `src/ui/`: search modal, optional inline suggest, cards
- `src/codeblock/`: `gramps` code block

## Design decisions

- Gramps Web is the source of truth. The plugin is currently read-only; any future write-back must be explicit and confirmed.
- Links are plain Markdown links with the same URIs Gramps uses in notes: `[label](gramps://Person/handle/<handle>)`. Store handles (stable), show Gramps IDs (can change). Hand-written code blocks may use Gramps IDs.
- Obsidian notes and Gramps notes are never synced both ways; each note has one owner.
- All HTTP goes through `requestUrl` (mobile support, no CORS issues). No Node/Electron APIs.
- Don't claim keystrokes by default: features are commands; the inline trigger is opt-in. Avoid `@` (Natural Language Dates, At People), `[[`, `*` and `+` (birth/death marks).
- Live preview renders link labels as `span.cm-underline` without the URI; resolve links from the editor source (`src/links/click.ts`).

## Conventions

- Follow the [Obsidian plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines): sentence case in UI text, `register*` helpers for cleanup, no telemetry.
- Never copy code from gramps-project repositories (AGPL); this plugin is MIT.
- Never change the plugin `id` or command IDs after release.
- Releases: bump with `npm version`, tag without a leading `v`.
