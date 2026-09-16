# Bundled Markdown parser

`markdown-it.min.js` is the unmodified browser UMD build from `markdown-it` 15.0.1 (`dist/browser/markdown-it.umd.min.js` in the npm package). It is bundled locally so the Chrome extension does not load executable code from a CDN.

The package version is pinned in package.json and package-lock.json. After `npm ci --ignore-scripts`, refresh it with:

```sh
cp node_modules/markdown-it/dist/browser/markdown-it.umd.min.js vendor/markdown-it.min.js
```

Original license: markdown-it.LICENSE. Licenses for bundled runtime dependencies are retained in THIRD_PARTY_NOTICES.txt.
