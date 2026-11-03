import hashlib,os,pathlib,re,tarfile
src=pathlib.Path('transfer/site.tar'); expected=os.environ['BUNDLE_SHA256']
assert re.fullmatch('[a-f0-9]{64}',expected)
assert src.is_file() and src.stat().st_size<150_000_000
assert hashlib.sha256(src.read_bytes()).hexdigest()==expected
out=pathlib.Path('encrypted-site');out.mkdir()
with tarfile.open(src) as tf:
    entries=tf.getmembers();assert len(entries)<10000
    assert sum(m.size for m in entries)<150_000_000
    for m in entries:
        p=pathlib.PurePosixPath(m.name)
        assert not p.is_absolute() and '..' not in p.parts
        assert m.isfile() or m.isdir()
        assert not any(x in {'.git','.github','node_modules'} for x in p.parts)
        assert not str(p).endswith(('.md','.pdf','.env'))
    tf.extractall(out,filter='data')
assert (out/'lock.json').is_file() and (out/'search-index.bin').is_file() and (out/'index.html').is_file()
assert not (out/'search-index.json').exists()
for p in out.rglob('*.html'):
    s=p.read_text();assert 'id="payload"' in s and 'class="note-body"' not in s
print('Encrypted transfer digest and archive paths verified.')
