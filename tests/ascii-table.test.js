const test = require('node:test');
const assert = require('node:assert/strict');
const { formatAsciiTable, textWidth } = require('../ascii-table');

test('renders a bordered table with a distinct header separator', () => {
    assert.equal(formatAsciiTable({ headers: ['Type', 'User'], rows: [['Agent', 'Yes'], ['Service', 'No']] }),
`+---------+------+
| Type    | User |
+=========+======+
| Agent   | Yes  |
+---------+------+
| Service | No   |
+---------+------+`);
});

test('wraps cell contents within the requested width without losing words', () => {
    const output = formatAsciiTable({ headers: ['Name', 'Detail'], rows: [['One', 'Agent identity only']] }, 27);
    assert.equal(output,
`+------+------------------+
| Name | Detail           |
+======+==================+
| One  | Agent identity   |
|      | only             |
+------+------------------+`);
    assert.ok(output.split('\n').every(line => textWidth(line) <= 27));
});

test('preserves multiline cells, empty values and long unbroken identifiers', () => {
    const output = formatAsciiTable({ headers: ['A', 'B'], rows: [['', 'first\n\nlast'], ['abcdefghijklmnop', '']] }, 21);
    assert.ok(output.includes('first'));
    assert.ok(output.includes('last'));
    const firstColumn = output.split('\n').filter(line => line.startsWith('|')).slice(1)
        .map(line => line.split('|')[1].trim()).join('');
    assert.equal(firstColumn, 'abcdefghijklmnop');
    assert.ok(output.split('\n').every(line => textWidth(line) <= 21));
});

test('keeps borders aligned for wide and combining Unicode characters', () => {
    const output = formatAsciiTable({ headers: ['Name', 'Value'], rows: [['日本語', 'cafe\u0301'], ['Agent', '😀']] });
    assert.equal(new Set(output.split('\n').map(textWidth)).size, 1);
    assert.equal(textWidth('cafe\u0301'), 4);
    assert.equal(textWidth('日本語'), 6);
});
