(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./vendor/markdown-it.min.js'), require('./ascii-table.js').formatAsciiTable);
    } else {
        Object.assign(root, factory(root.markdownit, root.formatAsciiTable));
    }
})(globalThis, function (markdownIt, formatTable) {
    const md = markdownIt({ html: false, linkify: true, breaks: false, typographer: false });

    // Copied rich text can wrap an image destination in another Markdown link.
    // An inline rule leaves fenced and inline code examples untouched.
    md.inline.ruler.before('image', 'copied_image', (state, silent) => {
        const source = state.src.slice(state.pos);
        const match = source.match(/^!\[([^\]\n]*)\]\\?\(\[[^\]\n]*\]\((https?:\/\/[^\s]+?)\)\)/) ||
            source.match(/^!\[([^\]\n]*)\]\\\((https?:\/\/[^\s]+?)\)/);
        if (!match) return false;
        const url = md.normalizeLink(md.utils.unescapeAll(match[2]));
        if (!md.validateLink(url)) return false;
        if (!silent) {
            const token = state.push('image', 'img', 0);
            token.attrs = [['src', url], ['alt', '']];
            token.content = match[1];
            token.children = [];
            md.inline.parse(match[1], md, state.env, token.children);
        }
        state.pos += match[0].length;
        return true;
    });

    function normalizeCopiedBorders(source) {
        let fence = null;
        return source.split('\n').map(line => {
            const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
            if (marker) {
                if (!fence) fence = marker[1];
                else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
                return line;
            }
            return fence ? line : line.replace(/^(\s{0,3})\\\|(?=.*\|)/, '$1|');
        }).join('\n');
    }

    function plainCell(token) {
        let text = (token.children || []).map(child => {
            if (child.type === 'softbreak' || child.type === 'hardbreak') return '\n';
            if (child.type === 'image') return child.content;
            return child.nesting === 0 ? child.content : '';
        }).join('');
        // Preserve the previous release's handling of doubled, escaped bold labels.
        let previous;
        do {
            previous = text;
            text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
        } while (text !== previous);
        return text;
    }

    function renderMediumMarkdown(source) {
        const tokens = md.parse(normalizeCopiedBorders(String(source)), {});
        const output = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type !== 'table_open') {
                output.push(token);
                continue;
            }
            const rows = [];
            let row;
            while (++i < tokens.length && tokens[i].type !== 'table_close') {
                if (tokens[i].type === 'tr_open') row = [];
                if (tokens[i].type === 'inline') row.push(plainCell(tokens[i]));
                if (tokens[i].type === 'tr_close') rows.push(row);
            }
            const code = new token.constructor('fence', 'code', 0);
            code.content = formatTable({ headers: rows[0], rows: rows.slice(1) });
            code.info = 'text';
            code.block = true;
            output.push(code);
        }
        // Empty entity-only paragraphs are often introduced by rich-text exports.
        const html = md.renderer.render(output, md.options, {}).replace(/<p>[\s\u00a0]*<\/p>\n?/g, '');
        return { html, text: String(source) };
    }

    function prepareMediumArticle(source) {
        const lines = String(source).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
        while (lines.length && !lines[0].trim()) lines.shift();
        if (!lines.length) throw new Error('The Markdown file is empty; add a title on the first line.');
        const firstLine = lines.shift().trim().replace(/^#{1,6}\s+/, '').replace(/\s+#+\s*$/, '');
        const title = plainCell(md.parseInline(firstLine, {})[0]).trim();
        if (!title) throw new Error('The first line must contain a title.');
        // A Setext underline belongs to the title, not the story body.
        if (lines.length && /^\s{0,3}(?:=+|-+)\s*$/.test(lines[0])) lines.shift();
        return { title, body: renderMediumMarkdown(lines.join('\n')) };
    }

    return { renderMediumMarkdown, prepareMediumArticle };
});
