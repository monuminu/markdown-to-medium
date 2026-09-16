const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { renderMediumMarkdown, prepareMediumArticle } = require('../medium-markdown');

function editorContext({ acceptsPaste = true, hasEditor = true, selectedText = false, acceptsTitle = true, hasTitle = true, startInTitle = false } = {}) {
    const events = [];
    const title = { textContent: 'Old title', contains: node => node === title };
    const body = { textContent: '', contains: () => true, querySelector: () => null };
    const bodyRange = { target: body, cloneRange() { return { ...this }; } };
    const selection = {
        rangeCount: 1, isCollapsed: !selectedText, anchorNode: startInTitle ? title : body, activeRange: bodyRange,
        getRangeAt() { return this.activeRange; },
        removeAllRanges() {},
        addRange(range) { this.activeRange = range; }
    };
    const editor = {
        innerHTML: '<p>Existing draft text</p><p></p>',
        contains: () => true,
        querySelector: () => hasTitle ? title : null,
        querySelectorAll: () => [body],
        dispatchEvent(event) {
            event.targetRange = selection.activeRange;
            events.push(event);
            if (acceptsPaste) this.innerHTML += event.clipboardData.getData('text/html');
            return !acceptsPaste;
        },
        focus() {}
    };
    const context = vm.createContext({
        renderMediumMarkdown, prepareMediumArticle,
        chrome: { runtime: { onMessage: { addListener() {} } } },
        window: { getSelection: () => selection },
        document: {
            querySelector: () => hasEditor ? editor : null,
            createRange: () => ({ selectNodeContents(node) { this.target = node; }, collapse() {} }),
            execCommand(command, ui, text) {
                assert.equal(command, 'insertText');
                assert.equal(selection.activeRange.target, title);
                if (acceptsTitle) title.textContent = text;
                return acceptsTitle;
            }
        },
        DataTransfer: class { data = {}; setData(type, value) { this.data[type] = value; } getData(type) { return this.data[type]; } },
        ClipboardEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
        setTimeout: fn => fn(),
        console
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8'), context);
    return { context, editor, events, title, body, selection };
}

test('sends one HTML paste with images and links without overwriting existing draft text', async () => {
    const { context, editor, events } = editorContext();
    assert.equal(typeof context.pasteMarkdownIntoMedium, 'function');
    await context.pasteMarkdownIntoMedium('![Alt](https://example.com/image.png)\n\n- [Docs](https://example.com/docs)', { useFirstLineAsTitle: false });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'paste');
    assert.ok(events[0].clipboardData.getData('text/html').includes('<img '));
    assert.ok(events[0].clipboardData.getData('text/html').includes('<a href="https://example.com/docs">'));
    assert.ok(editor.innerHTML.startsWith('<p>Existing draft text</p>'));
});

test('reports an ignored paste instead of claiming success or retrying and duplicating', async () => {
    const { context, events } = editorContext({ acceptsPaste: false });
    assert.equal(typeof context.pasteMarkdownIntoMedium, 'function');
    await assert.rejects(context.pasteMarkdownIntoMedium('Hello', { useFirstLineAsTitle: false }), /did not accept/i);
    assert.equal(events.length, 1);
});

test('requires an editor and rejects replacing a selected passage', async () => {
    for (const options of [{ hasEditor: false }, { selectedText: true }]) {
        const { context, events } = editorContext(options);
        assert.equal(typeof context.pasteMarkdownIntoMedium, 'function');
        await assert.rejects(context.pasteMarkdownIntoMedium('Hello', { useFirstLineAsTitle: false }), /draft|selected text/i);
        assert.equal(events.length, 0);
    }
});


test('sets the real story title and pastes only the body at the original insertion point', async () => {
    const { context, title, body, events } = editorContext();
    await context.pasteMarkdownIntoMedium('# **My title**\n\n[Docs](https://example.com)');
    assert.equal(title.textContent, 'My title');
    assert.equal(events.length, 1);
    assert.equal(events[0].targetRange.target, body);
    assert.equal(events[0].clipboardData.getData('text/html'), '<p><a href="https://example.com">Docs</a></p>\n');
});

test('title-only files do not paste an empty body', async () => {
    const { context, title, events } = editorContext();
    await context.pasteMarkdownIntoMedium('Title only');
    assert.equal(title.textContent, 'Title only');
    assert.equal(events.length, 0);
});

test('does not paste body if the title field is missing or title editing fails', async () => {
    for (const options of [{ hasTitle: false }, { acceptsTitle: false }]) {
        const { context, events } = editorContext(options);
        await assert.rejects(context.pasteMarkdownIntoMedium('# Title\n\nBody'), /title/i);
        assert.equal(events.length, 0);
    }
});

test('snippet mode leaves the story title unchanged', async () => {
    const { context, title, events } = editorContext();
    await context.pasteMarkdownIntoMedium('# Section\n\nBody', { useFirstLineAsTitle: false });
    assert.equal(title.textContent, 'Old title');
    assert.ok(events[0].clipboardData.getData('text/html').includes('<h1>Section</h1>'));
});


test('moves from the title field to an empty body paragraph before pasting', async () => {
    const { context, title, body, events } = editorContext({ startInTitle: true });
    await context.pasteMarkdownIntoMedium('New title\n\nBody content');
    assert.equal(title.textContent, 'New title');
    assert.equal(events[0].targetRange.target, body);
    assert.equal(events[0].clipboardData.getData('text/html'), '<p>Body content</p>\n');
});
