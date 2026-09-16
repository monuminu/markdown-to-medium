const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function parser() {
    const context = vm.createContext({
        chrome: { runtime: { onMessage: { addListener() {} } } },
        console: { log() {}, error() {} }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8'), context);
    return async (markdown) => JSON.parse(JSON.stringify(await context.parseMarkdownContent(markdown)));
}

test('keeps the Foundry comparison as one table with all four columns', async () => {
    const parse = parser();
    const result = await parse(`Introductory paragraph.
| Type | Identity | Behavior | Best fit |
|---|---|---|---|
| **Assistive** | Agent identity + signed-in user context | Acts on behalf of a user | Personal productivity |
| **Background service** | Agent identity only | Acts as itself | Backend automation |
| **Autopilot** | Agent identity + agent user account | Acts in Microsoft 365 | Digital coworkers |

Following paragraph.`);
    assert.deepEqual(result.map(section => section.type), ['text', 'table', 'text']);
    assert.deepEqual(result[1].headers, ['Type', 'Identity', 'Behavior', 'Best fit']);
    assert.deepEqual(result[1].rows, [
        ['Assistive', 'Agent identity + signed-in user context', 'Acts on behalf of a user', 'Personal productivity'],
        ['Background service', 'Agent identity only', 'Acts as itself', 'Backend automation'],
        ['Autopilot', 'Agent identity + agent user account', 'Acts in Microsoft 365', 'Digital coworkers']
    ]);
});

test('accepts copied tables with escaped leading pipes and nested bold markers', async () => {
    const result = await parser()(String.raw`\| Type | Identity |
\|---|---|
\| **\*\*Assistive\*\*** | User context |`);
    assert.equal(result[0].type, 'table');
    assert.deepEqual(result[0].rows, [['Assistive', 'User context']]);
});

test('accepts optional outside pipes, alignment markers, and short rows', async () => {
    const result = await parser()('Name | Description\n:--- | ---:\nOne | Two\nThree |');
    assert.equal(result[0].type, 'table');
    assert.deepEqual(result[0].headers, ['Name', 'Description']);
    assert.deepEqual(result[0].rows, [['One', 'Two'], ['Three', '']]);
});

test('preserves escaped pipes inside cells without creating extra columns', async () => {
    const result = await parser()(String.raw`| Command | Meaning |
| --- | --- |
| a \| b | A or B |`);
    assert.deepEqual(result[0].rows, [['a | b', 'A or B']]);
});

test('does not interpret code fences or standalone pipe text as tables', async () => {
    const result = await parser()('```\n| A | B |\n|---|---|\n```\n\n| Just ordinary text |');
    assert.deepEqual(result.map(section => section.type), ['code_block', 'text']);
    assert.deepEqual(result[1].content, ['| Just ordinary text |']);
});

test('retains headings, lists, and paragraphs outside tables', async () => {
    const result = await parser()('# Heading\n\nA paragraph.\n\n- First\n- Second');
    assert.deepEqual(result.map(section => section.type), ['header', 'text', 'bullet_list']);
});

test('inserts tables through the code-block path and then resumes normal text', async () => {
    const calls = [];
    const context = vm.createContext({
        chrome: { runtime: { onMessage: { addListener() {} } } },
        console: { log() {}, error() {} },
        document: { activeElement: { focus() {} } }
    });
    for (const file of ['ascii-table.js', 'content.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    }
    // Stub only editor interaction; exercise parsing, formatting, and routing.
    context.keyEvent = async key => calls.push({ key });
    context.insertText = async text => calls.push({ text });
    context.setCursorToEnd = async () => {};
    await context.insertMarkdownContent('| A | B |\n|---|---|\n| One | Two |\n\nAfter.');
    assert.equal(calls[0].key, 'code_block');
    assert.ok(calls[1].text.includes('| One | Two |'));
    assert.ok(calls[1].text.startsWith('+'));
    assert.equal(calls.at(-1).text, 'After.');
    assert.ok(!calls.some(call => call.key === 'subheader'));
});
