"""Build and verify the unpacked Chrome extension ZIP using only the standard library."""
import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import zipfile


class PopupResources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'img') and 'src' in attrs:
            self.paths.append(attrs['src'])
        if tag == 'link' and 'href' in attrs:
            self.paths.append(attrs['href'])


def verify_archive(path):
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        if 'manifest.json' not in names:
            raise ValueError('Missing manifest.json at the ZIP root')
        manifest = json.loads(archive.read('manifest.json'))
        if manifest.get('manifest_version') != 3 or not manifest.get('version'):
            raise ValueError('Invalid extension manifest')
        references = list(manifest.get('icons', {}).values())
        for script in manifest.get('content_scripts', []):
            references.extend(script.get('js', []))
            references.extend(script.get('css', []))
        popup = manifest.get('action', {}).get('default_popup')
        if popup:
            references.append(popup)
            if popup not in names:
                raise ValueError(f'Missing extension resource: {popup}')
            parser = PopupResources()
            parser.feed(archive.read(popup).decode('utf-8'))
            references.extend(parser.paths)
        for resource in references:
            if resource not in names:
                raise ValueError(f'Missing extension resource: {resource}')
        if archive.testzip() is not None:
            raise ValueError('Corrupt ZIP entry')
        return manifest


def package_release(root, output_dir):
    root, output_dir = Path(root), Path(output_dir)
    manifest = json.loads((root / 'manifest.json').read_text())
    files = [root / 'manifest.json', root / 'LICENSE', root / 'README.md', root / 'sample.md']
    files += list(root.glob('*.js')) + list(root.glob('*.html')) + list(root.glob('*.css'))
    for directory in ('icons', 'vendor'):
        files += [path for path in (root / directory).rglob('*') if path.is_file()]
    output_dir.mkdir(parents=True, exist_ok=True)
    name = f"markdown-to-medium-v{manifest['version']}.zip"
    destination = output_dir / name
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(set(files)):
            archive.write(path, path.relative_to(root).as_posix())
    verify_archive(destination)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    (output_dir / f"SHA256SUMS-v{manifest['version']}.txt").write_text(f'{digest}  {name}\n')
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    result = package_release(Path(__file__).resolve().parents[1], args.output_dir)
    print(f'Verified release: {result}')
