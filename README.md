# Gramps Web for Obsidian

Link your Obsidian notes to people, families, events, sources and notes in a [Gramps Web](https://www.grampsweb.org/) family tree.

## Features

- **Gramps links**: the **Insert Gramps link** command searches your tree and inserts a link such as `[Johann Straub (I0044)](gramps://Person/handle/…)`. Clicking it opens the object in Gramps Web. These are the same `gramps://` links that Gramps uses in its own notes. Prefix the search with a type and colon to filter, e.g. `person:` or `p:` (also family/f, event/e, place/pl, source/s, citation/c, repository/r, media/m, note/n); the active filter is shown in the picker.
- **Hover preview**: hover over a link to see the name, Gramps ID, life dates and photo.
- **Embedded cards and notes**:

  ````markdown
  ```gramps
  person: I0044
  ```
  ````

  Use `note: N0012` instead to show a Gramps note.
- **Optional inline search**: type a trigger (off by default, `@@` when enabled) to search while you type.

## Setup

1. In **Settings → Gramps Web**, enter your server URL and username.
2. Enter your password and select **Sign in**, then select **Test connection** to check that it works.

The plugin assumes the Gramps Web app and its API are served from the same URL, which is the default setup.

## Privacy

The plugin only talks to the Gramps Web server you configure. It sends search terms and the IDs of the objects it looks up. It never sends note contents or file names, and it has no analytics. Your password is not stored. The login tokens are kept in Obsidian's secret storage on this device and are not synced.

Requires Obsidian 1.11.4 or later. Works on desktop and mobile.

## Support

If you find this plugin useful, consider [sponsoring me on GitHub](https://github.com/sponsors/DavidMStraub).

## Development

```bash
npm install
npm run dev    # watch mode
npm run build
npm run lint
```

## License

MIT
