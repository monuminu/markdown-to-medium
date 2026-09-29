const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function load() {
    const context = vm.createContext({ URL, console });
    const file = path.join(__dirname, '../medium-toc.js');
    if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
    return context;
}
const heading = (text, attrs) => ({ textContent: text, getAttribute: key => attrs[key] || null });
const link = href => ({ getAttribute: key => key === 'href' ? href : null });

test('maps Markdown fragments to Medium heading names, not editor DOM ids', () => {
    const { planMediumToc } = load();
    assert.equal(typeof planMediumToc, 'function');
    const links = [link('#introduction'), link('#using-agents')];
    const plan = planMediumToc([
        heading('Introduction', { name: '14d8', id: 'editor-paragraph-14d8' }),
        heading('Using agents', { id: '64cd' })
    ], links);
    assert.deepEqual(Array.from(plan.updates, u => u.href), ['#14d8', '#64cd']);
    assert.equal(plan.unresolved.length, 0);
});

test('handles duplicate headings, punctuation, formatting text, and Unicode fragments', () => {
    const { planMediumToc } = load();
    assert.equal(typeof planMediumToc, 'function');
    const plan = planMediumToc([
        heading('Overview', { name: 'a001' }), heading('Overview', { name: 'a002' }),
        heading('Overview-1', { name: 'a003' }), heading('What’s next?', { name: 'a004' }),
        heading('Café 中文', { name: 'a005' })
    ], ['#overview', '#overview-1', '#overview-1-1', '#whats-next', '#caf%C3%A9-%E4%B8%AD%E6%96%87'].map(link));
    assert.deepEqual(Array.from(plan.updates, u => u.href), ['#a001', '#a002', '#a003', '#a004', '#a005']);
});

test('preserves external links and correct anchors and reports unresolved links', () => {
    const { planMediumToc } = load();
    assert.equal(typeof planMediumToc, 'function');
    const plan = planMediumToc([heading('Intro', { name: 'ab12' }), heading('No ID', {})],
        ['https://example.com/#intro', '#ab12', '#missing', '#no-id', '#%bad', '#'].map(link));
    assert.equal(plan.updates.length, 0);
    assert.deepEqual(Array.from(plan.unresolved), ['#missing', '#no-id', '#%bad']);
});

test('fails closed when a fragment is both a real Medium id and a different heading slug', () => {
    const { planMediumToc } = load();
    assert.equal(typeof planMediumToc, 'function');
    const plan = planMediumToc([heading('Intro', { name: 'abcd' }), heading('abcd', { name: 'ef12' })], [link('#abcd')]);
    assert.equal(plan.updates.length, 0);
});
