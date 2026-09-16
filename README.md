# Markdown to Medium

A Chrome extension that inserts Markdown into a Medium draft, preserving images, clickable hyperlinks, headings, emphasis, lists, quotes, and code. Markdown tables become editable ASCII grids in code blocks.

This fork is maintained under [monuminu/markdown-to-medium](https://github.com/monuminu/markdown-to-medium), based on the original project by [Jayesh Padhiar](https://github.com/JayeshPadhiar/markdown-to-medium). The original MIT license and copyright notice are retained.

## Install

1. Download `markdown-to-medium-v1.1.0.zip` from the [latest release](https://github.com/monuminu/markdown-to-medium/releases/latest).
2. Extract the ZIP into a folder you will keep on your computer.
3. Open `chrome://extensions/` and enable **Developer mode**.
4. Click **Load unpacked** and choose the extracted folder containing `manifest.json`.

## Update an existing installation

1. Download and extract the latest release ZIP.
2. Replace the files in the extension folder you originally loaded, keeping that folder path unchanged. Copy the whole package, including `vendor/`.
3. Click **Reload** on the extension card in `chrome://extensions/`.
4. Refresh the Medium draft so the updated scripts load.

## Use

1. Open a Medium draft and enter its title.
2. Click an empty body paragraph where the converted content should start. Clear any selected text first.
3. Open the extension and upload a `.md`, `.markdown`, or `.txt` file (up to 5 MB).
4. Click **Convert to Medium.com** once.
5. Wait for the result message, then review the draft and allow images to finish loading before publishing.

The extension inserts at your cursor. It does not publish the story. Existing converted paragraphs are not repaired automatically: remove the broken section yourself, then convert a file containing only the replacement section to avoid duplicating the article.

## Images and hyperlinks

Use ordinary Markdown:

```markdown
![Diagram description](https://example.com/diagram.png)

- [Reference title](https://example.com/reference)
```

Image URLs and alt descriptions are preserved. Inline links and links in bullet or numbered lists remain clickable. The converter also handles copied image syntax in which an escaped opening parenthesis contains a nested Markdown URL link, escaped underscores in URLs, and HTML whitespace entities such as `&#x20;`.

Image URLs must be reachable by Medium. Expired links, private endpoints, and hosts that block external loading can still fail. Review the image and its alt text in the draft. Local file paths are not uploaded by this extension.

## Tables

Tables are formatted with `+`, `-`, `=`, and `|` borders in a monospace code block. Long cells wrap, targeting 100 characters per line. Very wide tables may scroll horizontally. Table cell formatting becomes plain text.

```text
+---------+------+
| Type    | User |
+=========+======+
| Agent   | Yes  |
+---------+------+
| Service | No   |
+---------+------+
```

## How insertion works

A bundled Markdown parser generates HTML. The extension sends one HTML paste event to Medium, which imports the content into its own editor model. This preserves links and images and replaces the old sequence of direct text replacement and simulated formatting shortcuts. Raw HTML in Markdown is escaped, and unsafe URL schemes are rejected by the parser.

The extension checks whether the editor changes before reporting success. It does not retry automatically, because a delayed paste could duplicate content. Image loading and Medium autosave may continue after insertion.

## Troubleshooting

- **Cannot connect:** reload the extension and refresh the Medium draft.
- **No insertion point:** click an empty body paragraph before opening the extension.
- **Selected text warning:** clear the selection so conversion does not replace existing content.
- **Paste not accepted:** refresh the draft and try again from an empty body paragraph. Check for a partial insertion before retrying.
- **Missing image:** open its URL to check availability; upload it with Medium's Image button if that host does not work with Medium's importer.

## Development and tests

The release package runs without a build step or external script downloads. With Node.js 20 or newer, run `npm test`; tests use the bundled parser and do not require dependency installation. `npm ci --ignore-scripts` restores the pinned development dependencies when needed.

Tests cover images, hyperlinks, Markdown escaping, ASCII tables, the HTML paste payload, insertion failures, and protection against replacing selected text. Browser integration remains dependent on Medium's editor behavior.

## License

[MIT](LICENSE). The bundled parser's license and its dependency notices are in `vendor/`.
