const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { renderMediumMarkdown } = require('../medium-markdown');

function editorContext({ acceptsPaste = true, hasEditor = true, selectedText = false } = {}) {
    const events = [];
    const editor = {
        innerHTML: '<p>Existing draft text</p><p></p>',
        contains: () => true,
        dispatchEvent(event) {
            events.push(event);
            if (acceptsPaste) this.innerHTML += event.clipboardData.getData('text/html');
            return !acceptsPaste;
        },
        focus() {}
    };
    const context = vm.createContext({
        renderMediumMarkdown,
        chrome: { runtime: { onMessage: { addListener() {} } } },
        window: { getSelection: () => ({ rangeCount: 1, isCollapsed: !selectedText, anchorNode: {} }) },
        document: { querySelector: () => hasEditor ? editor : null },
        DataTransfer: class { data = {}; setData(type, value) { this.data[type] = value; } getData(type) { return this.data[type]; } },
        ClipboardEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
        setTimeout: fn => fn(),
        console
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8'), context);
    return { context, editor, events };
}

test('sends one HTML paste with images and links without overwriting existing draft text', async () => {
    const { context, editor, events } = editorContext();
    assert.equal(typeof context.pasteMarkdownIntoMedium, 'function');
    await context.pasteMarkdownIntoMedium('![Alt](https://example.com/image.png)\n\n- [Docs](https://example.com/docs)');
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'paste');
    assert.ok(events[0].clipboardData.getData('text/html').includes('<img '));
    assert.ok(events[0].clipboardData.getData('text/html').includes('<a href="https://example.com/docs">'));
    assert.ok(editor.innerHTML.startsWith('<p>Existing draft text</p>'));
});

test('reports an ignored paste instead of claiming success or retrying and duplicating', async () => {
    const { context, events } = editorContext({ acceptsPaste: false });
    assert.equal(typeof context.pasteMarkdownIntoMedium, 'function');
    await assert.rejects(context.pasteMarkdownIntoMedium('Hello'), /did not accept/i);
    assert.equal(events.length, 1);
});

test('requires an editor and rejects replacing a selected passage', async () => {
    for (const options of [{ hasEditor: false }, { selectedText: true }]) {
        const { context, events } = editorContext(options);
        assert.equal(typeof context.pasteMarkdownIntoMedium, 'function');
        await assert.rejects(context.pasteMarkdownIntoMedium('Hello'), /draft|selected text/i);
        assert.equal(events.length, 0);
    }
});
