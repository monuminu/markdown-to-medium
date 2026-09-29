(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else Object.assign(root, api);
})(globalThis, function () {
    function planMediumToc(headings, links) {
        const targets = new Map();
        const ids = new Set();
        const used = new Set();
        for (const heading of headings) {
            // Medium's editor uses name; its published article uses the same value as id.
            const id = heading.getAttribute('name') || heading.getAttribute('id');
            if (id) ids.add(id);
            const base = heading.textContent.trim().toLowerCase()
                .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
            let slug = base;
            let suffix = 0;
            while (used.has(slug)) slug = `${base}-${++suffix}`;
            used.add(slug);
            if (id) targets.set(slug, id);
        }
        const updates = [];
        const unresolved = [];
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            // Never reinterpret an external URL, even if its fragment matches a heading.
            if (!href.startsWith('#') || href === '#') continue;
            let fragment;
            try { fragment = decodeURIComponent(href.slice(1)); }
            catch { unresolved.push(href); continue; }
            if (ids.has(fragment)) continue;
            const id = targets.get(fragment);
            if (id) updates.push({ link, href: `#${encodeURIComponent(id)}` });
            else unresolved.push(href);
        }
        return { updates, unresolved };
    }

    async function repairMediumToc(editor, { headingsBefore = new Set(), linksBefore = new Set() } = {}) {
        const headings = Array.from(editor.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .filter(node => !node.matches('.graf--title, [data-placeholder="Title"]') && !headingsBefore.has(node));
        const links = Array.from(editor.querySelectorAll('a[href]')).filter(node => !linksBefore.has(node));
        const plan = planMediumToc(headings, links);
        const selection = window.getSelection();
        const saved = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
        let repaired = 0;
        try {
            for (const update of plan.updates) {
                if (!editor.contains(update.link)) {
                    plan.unresolved.push(update.link.getAttribute('href'));
                    continue;
                }
                const range = document.createRange();
                range.selectNodeContents(update.link);
                editor.focus();
                selection.removeAllRanges();
                selection.addRange(range);
                // Use native editing so Medium receives input and saves the link markup.
                // setAttribute alone would change the DOM without updating its document model.
                const accepted = document.execCommand('createLink', false, update.href);
                const selectedLink = selection.anchorNode?.parentElement?.closest('a') || update.link;
                if (accepted && selectedLink.getAttribute('href') === update.href) repaired++;
                else plan.unresolved.push(update.href);
            }
        } finally {
            if (saved && editor.contains(saved.startContainer)) {
                selection.removeAllRanges();
                selection.addRange(saved);
            }
        }
        return { repaired, unresolved: [...new Set(plan.unresolved)] };
    }

    return { planMediumToc, repairMediumToc };
});
