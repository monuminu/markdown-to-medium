const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function draft({ acceptLinks = true, delayIds = false } = {}) {
    const dom = new JSDOM('<article><div contenteditable="true"><h3 class="graf--title" name="title">Title</h3><p id="cursor"></p></div></article>', { runScripts: 'outside-only' });
    const w = dom.window;
    const d = w.document;
    const editor = d.querySelector('[contenteditable]');
    let listener;
    w.chrome = { runtime: { onMessage: { addListener(fn) { listener = fn; } } } };
    let pendingHeadings = [];
    let ticks = 0;
    w.setTimeout = fn => setImmediate(() => {
        if (++ticks === 3) pendingHeadings.forEach((h, i) => h.setAttribute('name', `m${1000 + i}`));
        fn();
    });
    w.DataTransfer = class { data = {}; setData(k, v) { this.data[k] = v; } getData(k) { return this.data[k]; } };
    w.ClipboardEvent = class extends w.Event { constructor(type, options) { super(type, options); this.clipboardData = options.clipboardData; } };
    // jsdom provides real DOM/ranges; only browser editing and Medium's paste importer are simulated.
    d.execCommand = (command, _, value) => {
        const sel = w.getSelection();
        if (command === 'createLink') {
            if (!acceptLinks) return false;
            const node = sel.getRangeAt(0).commonAncestorContainer;
            (node.nodeType === 1 ? node : node.parentElement).closest('a').setAttribute('href', value);
            return true;
        }
        throw Error(`Unexpected native edit ${command}`);
    };
    editor.addEventListener('paste', event => {
        event.preventDefault();
        const range = w.getSelection().getRangeAt(0);
        const fragment = range.createContextualFragment(event.clipboardData.getData('text/html'));
        let id = 1000;
        if (delayIds) pendingHeadings = Array.from(fragment.querySelectorAll('h1,h2,h3,h4,h5,h6'));
        else fragment.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => h.setAttribute('name', `m${id++}`));
        range.insertNode(fragment);
    });
    for (const file of ['vendor/markdown-it.min.js', 'ascii-table.js', 'medium-markdown.js', 'medium-toc.js', 'content.js']) {
        const full = path.join(__dirname, '..', file);
        if (fs.existsSync(full)) w.eval(fs.readFileSync(full, 'utf8'));
    }
    const range = d.createRange();
    range.selectNodeContents(d.querySelector('#cursor'));
    range.collapse(true);
    w.getSelection().addRange(range);
    return { w, editor, send: request => new Promise(resolve => listener(request, {}, resolve)) };
}

test('import resolves TOC links after Medium assigns heading identifiers', async () => {
    const { w, editor } = draft();
    await w.pasteMarkdownIntoMedium('- [Intro](#intro)\n\n## Intro\n\nContent', { useFirstLineAsTitle: false });
    assert.equal(editor.querySelector('a').getAttribute('href'), '#m1000');
    assert.equal(editor.querySelectorAll('h2').length, 1);
    w.close();
});

test('repair action fixes an existing draft without inserting or changing formatted text', async () => {
    const { w, editor, send } = draft();
    editor.innerHTML += '<p><a href="#overview"><strong>Overview</strong></a></p><h3 name="f123">Overview</h3><p>Existing body</p>';
    const before = editor.textContent;
    const response = await send({ action: 'repairToc' });
    assert.equal(response.success, true);
    assert.equal(editor.querySelector('a').getAttribute('href'), '#f123');
    assert.equal(editor.textContent, before);
    assert.equal(editor.querySelector('a strong').textContent, 'Overview');
    w.close();
});

test('native link edit failure is reported rather than falsely claiming repair', async () => {
    const { w, editor, send } = draft({ acceptLinks: false });
    editor.innerHTML += '<a href="#intro">Intro</a><h3 name="f123">Intro</h3>';
    const response = await send({ action: 'repairToc' });
    assert.equal(response.warning, true);
    assert.equal(editor.querySelector('a').getAttribute('href'), '#intro');
    w.close();
});

test('new import does not retarget pre-existing TOC links or choose an old duplicate heading', async () => {
    const { w, editor } = draft();
    const old = w.document.createElement('div');
    old.innerHTML = '<a href="#intro">Old link</a><h3 name="old1">Intro</h3>';
    editor.prepend(old);
    await w.pasteMarkdownIntoMedium('- [New intro](#intro)\n\n## Intro\n\nBody', { useFirstLineAsTitle: false });
    const links = editor.querySelectorAll('a');
    assert.equal(links[0].getAttribute('href'), '#intro');
    assert.equal(links[1].getAttribute('href'), '#m1000');
    w.close();
});


test('waits for asynchronously assigned heading names before repairing', async () => {
    const { w, editor } = draft({ delayIds: true });
    await w.pasteMarkdownIntoMedium('- [Intro](#intro)\n\n## Intro', { useFirstLineAsTitle: false });
    assert.equal(editor.querySelector('a').getAttribute('href'), '#m1000');
    w.close();
});

test('unresolved TOC targets report partial completion without reinserting the article', async () => {
    const { w, editor, send } = draft();
    const response = await send({ action: 'insertContent', useFirstLineAsTitle: false,
        content: '- [Missing](#missing)\n\n## Intro\n\nOnly once' });
    assert.equal(response.success, true);
    assert.equal(response.warning, true);
    assert.ok(response.message.includes('#missing'));
    assert.equal(editor.querySelectorAll('h2').length, 1);
    w.close();
});

test('repair button works without a Markdown upload and displays unresolved-link warnings', async () => {
    const html = fs.readFileSync(path.join(__dirname, '../popup.html'), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const w = dom.window;
    let action;
    w.chrome = { runtime: {}, tabs: {
        query(_, cb) { cb([{ id: 7, url: 'https://medium.com/p/abc/edit' }]); },
        sendMessage(id, request, cb) {
            action = request.action;
            cb({ success: true, warning: true, message: 'Unresolved link: #missing' });
        }
    } };
    w.eval(fs.readFileSync(path.join(__dirname, '../popup.js'), 'utf8'));
    await new Promise(resolve => w.document.addEventListener('DOMContentLoaded', resolve));
    w.document.querySelector('#repairTocBtn').click();
    assert.equal(action, 'repairToc');
    assert.equal(w.document.querySelector('#status').className, 'status warning');
    assert.equal(w.document.querySelector('#repairTocBtn').disabled, false);
    w.close();
});
