const test = require('node:test');
const assert = require('node:assert/strict');
const { renderMediumMarkdown } = require('../medium-markdown');
const image = 'https://image-backends.politesky-374bbcb3.eastus.azurecontainerapps.io/image/results/generated_image_20260914_040453_599_qauto_s1536x1024_bopaque.png';
const link = 'https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/autopilot-overview';

test('renders a real image with its URL and alt description', () => {
    const { html } = renderMediumMarkdown(`![Identity diagram](${image})`);
    assert.ok(html.includes(`<img src="${image}" alt="Identity diagram"`));
});

test('repairs the escaped image syntax containing a nested URL link', () => {
    const { html } = renderMediumMarkdown(`![Identity diagram]\\([${image.replaceAll('_', '\\_')}](${image}))`);
    assert.ok(html.includes(`<img src="${image}" alt="Identity diagram"`));
    assert.equal((html.match(/<img /g) || []).length, 1);
});

test('preserves clickable links inside bullet lists', () => {
    const { html } = renderMediumMarkdown(`- [What is an autopilot in Microsoft Foundry?](${link})`);
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes(`<a href="${link}">What is an autopilot in Microsoft Foundry?</a>`));
});

test('retains inline links, emphasis, and numbered-list links', () => {
    const { html } = renderMediumMarkdown(`Read **[the guide](${link})** now.\n\n1. [Reference](${link})`);
    assert.ok(html.includes(`<strong><a href="${link}">the guide</a></strong>`));
    assert.ok(html.includes('<ol>'));
    assert.ok(html.includes(`<a href="${link}">Reference</a>`));
});

test('decodes entity whitespace and escaped underscores without changing the URL', () => {
    const { html } = renderMediumMarkdown(`&#x20;\n\n![Diagram](${image.replaceAll('_', '\\_')})`);
    assert.ok(!html.includes('&amp;#x20;'));
    assert.ok(!html.includes('<p> </p>'));
    assert.ok(html.includes(`src="${image}"`));
});

test('keeps image URLs with parentheses and optional titles intact', () => {
    const { html } = renderMediumMarkdown('![Chart](https://example.com/chart_(v2).png "Chart title")');
    assert.ok(html.includes('src="https://example.com/chart_(v2).png"'));
    assert.ok(html.includes('title="Chart title"'));
});

test('does not turn raw HTML or script URLs into executable content', () => {
    const { html } = renderMediumMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![x](javascript:alert(1))');
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('href="javascript:'));
    assert.ok(!html.includes('src="javascript:'));
});

test('keeps Markdown examples inside code literal, including escaped pipes', () => {
    const { html } = renderMediumMarkdown('```md\n![Alt](https://example.com/a.png)\n\\| A | B |\n```');
    assert.ok(!html.includes('<img '));
    assert.ok(html.includes('![Alt](https://example.com/a.png)'));
    assert.ok(html.includes('\\| A | B |'));
});

test('keeps the Foundry table as a single ASCII code block followed by a paragraph', () => {
    const { html } = renderMediumMarkdown('| Type | Identity | Behavior | Best fit |\n|---|---|---|---|\n| **Assistive** | User context | On behalf | Productivity |\n| **Background service** | Agent only | Autonomous | Backend |\n| **Autopilot** | Agent + account | In M365 | Coworker |\n\nAfter.');
    assert.equal((html.match(/<pre>/g) || []).length, 1);
    assert.ok(!html.includes('<table'));
    assert.ok(html.includes('Background service'));
    assert.ok(html.includes('+===='));
    assert.ok(html.includes('</pre>\n<p>After.</p>'));
});

test('handles copied table borders and escaped bold labels', () => {
    const { html } = renderMediumMarkdown(String.raw`\| Type | Identity |
\|---|---|
\| **\*\*Assistive\*\*** | User context |`);
    assert.ok(html.includes('<pre>'));
    assert.ok(html.includes('Assistive'));
    assert.ok(!html.includes('**'));
});

test('keeps optional table borders, escaped cell pipes, and short rows', () => {
    const { html } = renderMediumMarkdown(String.raw`Name | Description
:--- | ---:
One | A \| B
Three |`);
    assert.ok(html.includes('<pre>'));
    assert.ok(html.includes('A | B'));
    assert.ok(html.includes('Three'));
});

test('retains plain pipe text and headings outside tables', () => {
    const { html } = renderMediumMarkdown('# Heading\n\n| Just ordinary text |\n\n- First\n- Second');
    assert.ok(html.includes('<h1>Heading</h1>'));
    assert.ok(html.includes('<p>| Just ordinary text |</p>'));
    assert.ok(html.includes('<li>Second</li>'));
});
