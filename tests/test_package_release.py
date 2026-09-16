import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('package_release', ROOT / 'scripts/package_release.py')
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)


class ReleaseTests(unittest.TestCase):
    def test_rejects_zip_without_root_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'broken.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('content.js', '// source')
            with self.assertRaisesRegex(ValueError, 'Missing manifest.json'):
                packaging.verify_archive(path)

    def test_rejects_missing_manifest_resource(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'broken.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('manifest.json', json.dumps({
                    'manifest_version': 3, 'version': '1.0.0',
                    'content_scripts': [{'js': ['missing.js']}]
                }))
            with self.assertRaisesRegex(ValueError, 'missing.js'):
                packaging.verify_archive(path)

    def test_release_has_root_manifest_and_all_resources(self):
        with tempfile.TemporaryDirectory() as directory:
            path = packaging.package_release(ROOT, directory)
            manifest = packaging.verify_archive(path)
            self.assertEqual(manifest['name'], 'Markdown to Medium')
            with zipfile.ZipFile(path) as archive:
                self.assertEqual(archive.read('manifest.json'), (ROOT / 'manifest.json').read_bytes())
                self.assertIn('vendor/markdown-it.min.js', archive.namelist())


if __name__ == '__main__':
    unittest.main()
