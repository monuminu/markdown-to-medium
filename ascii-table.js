const tableGraphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function graphemeWidth(text) {
    if (/^[\p{Mark}\u200d\ufe0f]+$/u.test(text)) return 0;
    // CJK and emoji generally occupy two monospace character positions.
    return /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6\u{20000}-\u{3fffd}]|\p{Extended_Pictographic}/u.test(text) ? 2 : 1;
}

function textWidth(text) {
    let width = 0;
    for (const { segment } of tableGraphemes.segment(String(text))) width += graphemeWidth(segment);
    return width;
}

function wrapAsciiCell(value, width) {
    const lines = [];
    for (const paragraph of String(value).split('\n')) {
        let line = '';
        for (const word of paragraph.trim().split(/\s+/)) {
            const candidate = line ? `${line} ${word}` : word;
            if (textWidth(candidate) <= width) {
                line = candidate;
                continue;
            }
            if (line) lines.push(line);
            line = '';
            for (const { segment } of tableGraphemes.segment(word)) {
                if (line && textWidth(line + segment) > width) {
                    lines.push(line);
                    line = '';
                }
                line += segment;
            }
        }
        lines.push(line);
    }
    return lines;
}

function formatAsciiTable(table, maxWidth = 100) {
    const data = [table.headers, ...table.rows];
    const columns = table.headers.length;
    if (!columns) return '';
    const natural = table.headers.map((_, column) => data.reduce((max, row) =>
        String(row[column] ?? '').split('\n').reduce((size, line) => Math.max(size, textWidth(line)), max), 2));
    const widths = Array(columns).fill(2);
    // Borders and one space on either side of every cell consume 3n + 1.
    let remaining = Math.max(columns * 2, Math.floor(maxWidth) - columns * 3 - 1) - columns * 2;
    while (remaining > 0) {
        let changed = false;
        for (let column = 0; column < columns && remaining > 0; column++) {
            if (widths[column] < natural[column]) {
                widths[column]++;
                remaining--;
                changed = true;
            }
        }
        if (!changed) break;
    }
    const border = character => '+' + widths.map(width => character.repeat(width + 2)).join('+') + '+';
    const output = [border('-')];
    data.forEach((row, rowIndex) => {
        const cells = widths.map((width, column) => wrapAsciiCell(row[column] ?? '', width));
        const height = Math.max(...cells.map(cell => cell.length));
        for (let line = 0; line < height; line++) {
            output.push('| ' + cells.map((cell, column) => {
                const text = cell[line] || '';
                return text + ' '.repeat(Math.max(0, widths[column] - textWidth(text)));
            }).join(' | ') + ' |');
        }
        output.push(border(rowIndex === 0 ? '=' : '-'));
    });
    return output.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatAsciiTable, textWidth };
}
