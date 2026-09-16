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
    pasteMarkdownIntoMedium(request.content)
        .then(() => sendResponse({ success: true, message: 'Content inserted. Review the draft and let images finish loading.' }))
        .catch(error => sendResponse({ success: false, message: error.message }))
        .finally(() => { insertionInProgress = false; });
    return true;
});

async function pasteMarkdownIntoMedium(markdown) {
    const editor = document.querySelector('article [contenteditable="true"]');
    if (!editor) throw new Error('Open a Medium draft and click an empty body paragraph before converting.');
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) {
        throw new Error('Click inside your Medium draft where the content should be inserted, then reopen the extension.');
    }
    if (!selection.isCollapsed) {
        throw new Error('Clear the selected text and click an insertion point to avoid replacing part of your draft.');
    }
    const rendered = renderMediumMarkdown(markdown);
    if (!rendered.html.trim()) throw new Error('The Markdown file contains no content to insert.');
    const before = editor.innerHTML;
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
        if (editor.innerHTML !== before) return;
    }
    throw new Error('Medium did not accept the paste. Refresh the draft, click an empty body paragraph, and try again.');
}
