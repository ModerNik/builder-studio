"""Assemble the app runtime from a pinned standalone engine; never compile engine packages."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verified_manifest(archive, pin):
    actual = digest(archive)
    spec = next((s for s in pin['inputs'] if s['sha256'] == actual), None)
    if not spec:
        raise ValueError('Engine archive checksum is not pinned')
    with zipfile.ZipFile(archive) as zipped:
        raw = zipped.read('engine-manifest.json')
        if hashlib.sha256(raw).hexdigest() != spec['manifestSha256']:
            raise ValueError('Engine manifest checksum mismatch')
        manifest = json.loads(raw)
        for key in ['identity', 'engineVersion', 'schematicaVersion', 'pythonVersion', 'platform']:
            if manifest[key] != pin[key]:
                raise ValueError(f'Engine identity mismatch: {key}')
        for key in ['commit', 'tree', 'repository']:
            if manifest['source'][key] != pin['source'][key]:
                raise ValueError(f'Engine source mismatch: {key}')
        if manifest.get('distribution') != 'binary' or manifest.get('protection', {}).get('mode') != 'native':
            raise ValueError('A public native engine distribution is required; the legacy source runtime cannot ship')
        names = zipped.namelist()
        expected = set(manifest['files']) | {'engine-manifest.json'}
        if len(names) != len(set(names)) or set(names) != expected:
            raise ValueError('Unaccounted engine archive entries')
        for destination, module in manifest['protection'].get('modules', {}).items():
            prefix = 'runtime/Lib/site-packages/'
            if prefix + module['extension'] not in expected:
                raise ValueError(f'Missing native engine module: {destination}')
            if module['loader']:
                if zipped.read(prefix + destination) != module['loader'].encode():
                    raise ValueError(f'Unexpected engine CLI loader: {destination}')
            elif prefix + destination in expected:
                raise ValueError(f'Plaintext proprietary implementation: {destination}')
        for name, record in manifest['files'].items():
            if not (name.startswith(('runtime/', 'resources/')) or name == 'requirements.lock'):
                raise ValueError(f'Private build material in engine archive: {name}')
            path = Path(name)
            if path.is_absolute() or '..' in path.parts or ':' in name or '\\' in name:
                raise ValueError(f'Unsafe engine archive path: {name}')
            with zipped.open(name) as stream:
                checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
            if zipped.getinfo(name).file_size != record['bytes'] or checksum != record['sha256']:
                raise ValueError(f'Engine file checksum mismatch: {name}')
    return manifest, spec


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--engine-archive', type=Path, default=os.environ.get('BS_ENGINE_ARCHIVE'))
    parser.add_argument('--out', type=Path, default=ROOT / 'out/runtime')
    parser.add_argument('--require-published', action='store_true')
    args = parser.parse_args()
    pin = json.loads((ROOT / 'runtime/engine.json').read_text(encoding='utf-8'))
    if args.require_published and not pin['publication']:
        parser.error('Engine publication and release asset pinning are pending; publish engine before app')
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    archive = args.engine_archive
    if not archive:
        spec = pin['publication'] or next((s for s in pin['inputs'] if 'runId' in s), None)
        if spec is None:
            parser.error('Engine is pinned for local validation only; supply --engine-archive')
        downloads = out / 'engine-input'
        downloads.mkdir(exist_ok=True)
        archive = downloads / (pin['identity'] + '.zip')
        if not archive.exists():
            command = (['gh', 'release', 'download', spec['tag'], '--pattern', archive.name]
                       if pin['publication'] else
                       ['gh', 'run', 'download', str(spec['runId']), '--name', spec['artifact']])
            repository = spec.get('repository', pin['source']['repository'])
            subprocess.run([*command, '--repo', repository, '--dir', str(downloads)], check=True)
    manifest, spec = verified_manifest(archive.resolve(), pin)
    if args.require_published and any(spec[key] != pin['publication'][key]
                                      for key in ['sha256', 'manifestSha256']):
        parser.error('The supplied archive is not the pinned published engine artifact')
    engine = out / 'engine'
    if engine.exists():
        raise ValueError('Engine output already exists; use a new output directory')
    # All archive members and their trusted manifest have been checked before extraction/execution.
    with zipfile.ZipFile(archive) as zipped:
        zipped.extractall(engine)
    app_version = json.loads((ROOT / 'package.json').read_text())['version']
    runtime_version = f'{app_version}-{pin["identity"]}'
    provenance = {**pin, 'input': spec}
    with tempfile.TemporaryDirectory(prefix='builder-runtime-', dir=out) as temporary:
        target = Path(temporary)
        shutil.copytree(engine / 'runtime', target, dirs_exist_ok=True)
        shutil.copyfile(engine / 'requirements.lock', target / 'requirements.lock')
        (target / 'runtime.json').write_text(json.dumps({
            'version': runtime_version, 'appVersion': app_version, 'python': pin['pythonVersion'],
            'mcb': pin['engineVersion'], 'schematica': pin['schematicaVersion'], 'engine': provenance
        }, indent=2), encoding='utf-8')
        artifact = out / f'builder-runtime-{runtime_version}-win-x64.zip'
        with zipfile.ZipFile(artifact, 'w', zipfile.ZIP_DEFLATED) as zipped:
            for path in sorted(target.rglob('*')):
                if path.is_file() and '__pycache__' not in path.parts:
                    zipped.write(path, path.relative_to(target).as_posix())
    git = json.loads((ROOT / 'runtime/sources.json').read_text())['git']
    git_zip = out / 'builder-git-win-x64.zip'
    if not git_zip.exists():
        with urllib.request.urlopen(git['url']) as response, git_zip.open('wb') as stream:
            shutil.copyfileobj(response, stream)
    if digest(git_zip) != git['sha256']:
        raise ValueError('Portable Git checksum mismatch')
    def record(path, version):
        return {'version': version, 'asset': path.name, 'bytes': path.stat().st_size, 'sha256': digest(path)}
    result = {'schema': 1, 'appVersion': app_version, 'platform': 'win32-x64',
              'engine': record(artifact, runtime_version), 'git': record(git_zip, git['version']),
              'provenance': provenance}
    (out / 'runtime-manifest.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    (out / 'SHA256SUMS').write_text(f'{digest(artifact)}  {artifact.name}\n', encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
