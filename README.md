# markdown-to-medium
A Chrome extension that converts markdown files to Medium.com articles with intelligent parsing and direct content injection.

This fork is maintained under [monuminu/markdown-to-medium](https://github.com/monuminu/markdown-to-medium), based on the original project by [Jayesh Padhiar](https://github.com/JayeshPadhiar/markdown-to-medium). The original MIT license and copyright notice are retained.

## Installation

### For Development:
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the project folder
5. The extension should now appear in your Chrome toolbar

### For Users:
1. Download `markdown-to-medium-v1.0.2.zip` from the [latest release](https://github.com/monuminu/markdown-to-medium/releases/latest)
2. Extract the files
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked" and select the extracted folder

## Updating an unpacked installation

1. Download and extract the latest release ZIP.
2. Replace the files in the extension folder you originally loaded, keeping the folder path unchanged.
3. Open `chrome://extensions/` and click the extension's **Reload** button.
4. Refresh your Medium draft before converting again, so Chrome loads the updated content scripts.
5. To repair a previously converted table, remove the old table paragraphs, place the cursor in an empty paragraph, and convert a Markdown file containing only that table. Re-running the full article would duplicate its content.

## Table formatting

Tables are inserted as plain, editable ASCII text in a Medium code block, keeping columns aligned. The extension adds `+`, `-`, `=`, and `|` borders and wraps long cell values. It handles alignment markers, optional outside pipes, escaped pipes within cells, and copied tables with escaped opening pipes. No image upload or external table service is needed.

```text
+---------+------+
| Type    | User |
+=========+======+
| Agent   | Yes  |
+---------+------+
| Service | No   |
+---------+------+
```

## Usage

### Step 1: Navigate to Medium
1. Go to any **Medium.com** page where you can write/edit content
2. The extension works on any Medium page with an editor

### Step 2: Use the Extension
1. Click the extension icon in your Chrome toolbar
2. The simple popup interface will appear with upload and convert options

### Step 3: Upload and Insert Content
1. Click "Upload Markdown File" to select your markdown file (.md, .markdown, .txt)
2. Preview your content in the popup (shows first 300 characters)
3. Click "Convert to Medium.com" to insert your content directly into the Medium editor
4. The extension will automatically close and insert your content

## Features

- ✅ **Custom Markdown Parser**: Built-in intelligent parser that handles complex markdown syntax
- ✅ **Direct DOM Manipulation**: Injects content directly into Medium's editor using native keyboard shortcuts
- ✅ **Smart Formatting**: Automatically applies proper Medium formatting for each element type
- ✅ **File Upload**: Support for .md, .markdown, and .txt files (up to 5MB)
- ✅ **Live Preview**: See your content in the popup before inserting
- ✅ **Comprehensive Markdown Support**: 
  - Headers (H1-H6) with proper Medium formatting
  - Blockquotes with `>` syntax
  - Code blocks with syntax highlighting support
  - Bullet lists (`*`, `-`, `+`) and numbered lists (`1.`, `2.`, etc.)
  - Tables (bordered ASCII tables with wrapped cells in a monospace code block)
  - Images (converted to links with alt text)
  - Links with proper text extraction
  - Horizontal rules
  - Inline formatting removal (bold, italic, strikethrough, code)

## How It Works

The extension uses:
- **Custom Markdown Parser**: Built-in parser that analyzes markdown line-by-line and categorizes content types
- **Chrome Extension APIs**: Content scripts and messaging for seamless browser integration
- **DOM Manipulation**: Direct interaction with Medium's editor elements using `.is-selected` selectors
- **Medium Keyboard Shortcuts**: Simulates native Medium keyboard shortcuts (Cmd+Opt+1 for headers, etc.)
- **Real-time Communication**: Chrome runtime messaging between popup and content script
- **Content Injection**: Sequential insertion of parsed sections with proper formatting and timing

## Supported Pages

- ✅ **All Medium.com pages** with editor functionality
- ✅ `https://medium.com/*` (Any Medium domain)
- ✅ Medium write/editor pages
- ✅ Medium story creation and editing interfaces
- ✅ Works across different Medium publications and personal accounts

## Development Status

**Currently Working:**
- ✅ Custom markdown parsing with comprehensive syntax support
- ✅ Advanced formatting support (headings, quotes, code blocks, lists, tables, images)
- ✅ File upload and preview functionality
- ✅ Automatic Medium formatting application via keyboard shortcuts
- ✅ Direct content insertion into Medium editor
- ✅ Cross-platform keyboard shortcut support (macOS/Windows)
- ✅ Error handling and file validation

**Technical Features:**
- Pure JavaScript implementation (no build process required)
- Chrome Extension Manifest V3 compliance
- Real-time DOM manipulation and content injection
- Comprehensive markdown syntax support without external dependencies

## Limitations & Known Issues

- **Formatting Timing**: Content insertion happens sequentially with small delays to ensure proper Medium formatting
- **Large Files**: Maximum file size is 5MB for optimal performance
- **Tables**: Markdown tables become editable ASCII grids inside a Medium code block. Long cells wrap to keep ordinary tables within 100 characters; very wide tables may require horizontal scrolling. Inline Markdown styling is removed inside cells.
- **Nested Lists**: Currently supports single-level lists; deeply nested lists may not render perfectly
- **Image Embedding**: Images are converted to links with alt text rather than embedded images
- **Medium-Specific**: Designed specifically for Medium.com and may not work on other platforms

## File Support

- ✅ `.md` files (Markdown)
- ✅ `.markdown` files (Markdown)
- ✅ `.txt` files (Plain text with markdown syntax)
- 📏 Maximum file size: 5MB

## Medium Keyboard Shortcuts Used

The extension automatically applies these Medium keyboard shortcuts during content insertion:

| Element | macOS | Windows | Description |
|---------|-------|---------|-------------|
| Header (H1) | `Cmd+Opt+1` | `Ctrl+Alt+1` | Large header |
| Subheader (H2-H6) | `Cmd+Opt+2` | `Ctrl+Alt+2` | Medium header |
| Quote | `Cmd+Opt+5` | `Ctrl+Alt+5` | Blockquote formatting |
| Code Block | `Cmd+Opt+6` | `Ctrl+Alt+6` | Code block with syntax highlighting |

## Example Usage

1. **Create a markdown file** (`example.md`):
```markdown
# My Blog Post

This is a **great** article about coding.

## Key Points

> "Programming is the art of telling another human what one wants the computer to do." - Donald Knuth

### Code Example

```javascript
function hello() {
    console.log("Hello, Medium!");
}
```

## Benefits

- Easy to write
- Clean formatting  
- Professional appearance
```

2. **Load the extension** on any Medium editor page
3. **Click "Upload Markdown File"** and select your file
4. **Preview** the content in the popup
5. **Click "Convert to Medium.com"** to insert formatted content

## Troubleshooting

### Extension Not Working?
- Ensure you're on a Medium.com page with an editor
- Refresh the Medium page and try again
- Check that the extension is enabled in Chrome settings

### Content Not Inserting Properly?
- Make sure the Medium editor is focused (click in the editor first)
- Try uploading a smaller file if you're having issues
- Ensure your markdown syntax is valid

### File Upload Issues?
- Check file size (must be under 5MB)
- Ensure file extension is .md, .markdown, or .txt
- Verify file isn't corrupted or contains unsupported characters

## Tests

With Node.js 18 or newer, run `npm test`. The regression suite covers Markdown table parsing, ASCII cell wrapping and alignment, and routing tables through the code-block insertion path. No dependency installation is needed to run it.

## Contributing

This extension is open source! Feel free to:
- Report bugs or issues
- Suggest new features  
- Submit pull requests
- Improve documentation

## License

MIT License - see LICENSE file for details.
