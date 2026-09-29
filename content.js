let insertionInProgress = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== 'insertContent') {
        sendResponse({ success: false, message: 'Unknown action.' });
        return false;
    }
    if (insertionInProgress) {
        sendResponse({ success: false, message: 'A conversion is already in progress.' });
        return false;
    }
    insertionInProgress = true;
    pasteMarkdownIntoMedium(request.content, { useFirstLineAsTitle: request.useFirstLineAsTitle !== false })
        .then(result => {
            const unresolved = result?.unresolved || [];
            const prefix = 'Content inserted.';
            sendResponse({ success: true, warning: unresolved.length > 0,
                message: unresolved.length ? `${prefix} Could not resolve ${unresolved.length} link(s): ${unresolved.slice(0, 5).join(', ')}. Check that each TOC fragment matches a heading in the Markdown file. Review the inserted draft before importing again.` :
                    `${prefix} Review the draft, allow autosave to finish, and test TOC links in preview.` });
        })
        .catch(error => sendResponse({ success: false, message: error.message }))
        .finally(() => { insertionInProgress = false; });
    return true;
});

async function pasteMarkdownIntoMedium(markdown, { useFirstLineAsTitle = true } = {}) {
    const editor = document.querySelector('article [contenteditable="true"]');
    if (!editor) throw new Error('Open a Medium draft and click an empty body paragraph before converting.');
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) {
        throw new Error('Click inside your Medium draft where the content should be inserted, then reopen the extension.');
    }
    if (!selection.isCollapsed) {
        throw new Error('Clear the selected text and click an insertion point to avoid replacing part of your draft.');
    }
    let rendered;
    if (useFirstLineAsTitle) {
        const article = prepareMediumArticle(markdown);
        const title = editor.querySelector('.graf--title, [data-placeholder="Title"]');
        if (!title) throw new Error('Could not find the Medium story title. Open a new draft and try again.');
        let bodyRange;
        if (article.body.html.trim()) {
            if (!title.contains(selection.anchorNode)) {
                bodyRange = selection.getRangeAt(0).cloneRange();
            } else {
                const paragraph = Array.from(editor.querySelectorAll('p.graf--p, p[data-placeholder]'))
                    .find(node => !node.textContent.trim() && !node.querySelector('img') && !title.contains(node));
                if (!paragraph) throw new Error('Click an empty body paragraph before converting.');
                bodyRange = document.createRange();
                bodyRange.selectNodeContents(paragraph);
                bodyRange.collapse(true);
            }
        }
        const titleRange = document.createRange();
        titleRange.selectNodeContents(title);
        editor.focus();
        selection.removeAllRanges();
        selection.addRange(titleRange);
        // Native editing emits input events so Medium saves the title in its model.
        // Assigning textContent would only change the visible DOM.
        document.execCommand('insertText', false, article.title);
        if (title.textContent.trim() !== article.title) {
            throw new Error('Medium did not accept the title. Check the draft before trying again.');
        }
        rendered = article.body;
        if (!rendered.html.trim()) return;
        selection.removeAllRanges();
        selection.addRange(bodyRange);
    } else {
        rendered = renderMediumMarkdown(markdown);
        if (!rendered.html.trim()) throw new Error('The Markdown file contains no content to insert.');
    }
    const before = editor.innerHTML;
    const hasToc = rendered.html.includes('href="#');
    const scope = hasToc ? {
        headingsBefore: new Set(editor.querySelectorAll('h1, h2, h3, h4, h5, h6')),
        linksBefore: new Set(editor.querySelectorAll('a[href]'))
    } : null;
    const clipboard = new DataTransfer();
    clipboard.setData('text/html', rendered.html);
    clipboard.setData('text/plain', rendered.text);
    // Medium imports this HTML into its own document model, including anchors and images.
    // Direct DOM replacement loses those semantics and can corrupt the saved draft.
    editor.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: clipboard, bubbles: true, cancelable: true
    }));
    // Never retry automatically: a delayed first paste could otherwise duplicate the article.
    for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (editor.innerHTML !== before) {
            if (!hasToc) return;
            // Medium assigns paragraph names after importing. Wait for the headings
            // and their IDs before resolving fragments; never paste the body again.
            const expected = (rendered.html.match(/<h[1-6](?:\s|>)/g) || []).length;
            let previous = '';
            for (let ready = 0; ready < 30; ready++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                const headings = Array.from(editor.querySelectorAll('h1, h2, h3, h4, h5, h6'))
                    .filter(node => !scope.headingsBefore.has(node));
                const signature = headings.map(h => `${h.textContent}:${h.getAttribute('name') || h.id}`).join('|');
                if (headings.length >= expected && headings.every(h => h.getAttribute('name') || h.id) && signature === previous) break;
                previous = signature;
            }
            return resolveMediumToc(editor, scope);
        }
    }
    throw new Error('Medium did not accept the paste. Refresh the draft, click an empty body paragraph, and try again.');
}
