import io,os,pathlib,subprocess,tarfile,tempfile,hashlib,unittest
SCRIPT=str(pathlib.Path(__file__).with_name('unpack.py'))
class TransferTests(unittest.TestCase):
 def run_case(self,mut=None,bad_hash=False):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);(root/'transfer').mkdir();p=root/'transfer/site.tar'
   with tarfile.open(p,'w') as t:
    for name,data in [('index.html',b'<script id="payload">test</script>'),('lock.json',b'{}'),('search-index.bin',b'test')]:
     m=tarfile.TarInfo(name);m.size=len(data);t.addfile(m,io.BytesIO(data))
    if mut:mut(t)
   env={**os.environ,'BUNDLE_SHA256':'0'*64 if bad_hash else hashlib.sha256(p.read_bytes()).hexdigest()}
   return subprocess.run(['python',SCRIPT],cwd=d,env=env,capture_output=True).returncode
 def test_oversized_archive(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);(root/'transfer').mkdir();p=root/'transfer/site.tar'
   with p.open('wb') as f:f.truncate(350_000_000)
   result=subprocess.run(['python',SCRIPT],cwd=d,env={**os.environ,'BUNDLE_SHA256':'0'*64},capture_output=True)
   self.assertNotEqual(result.returncode,0)
 def test_safe_bundle(self):self.assertEqual(self.run_case(),0)
 def test_digest_mismatch(self):self.assertNotEqual(self.run_case(bad_hash=True),0)
 def test_traversal(self):self.assertNotEqual(self.run_case(lambda t:t.addfile(tarfile.TarInfo('../outside'))),0)
 def test_plaintext_source(self):self.assertNotEqual(self.run_case(lambda t:t.addfile(tarfile.TarInfo('note.md'))),0)
 def test_symlink(self):
  def add(t):
   m=tarfile.TarInfo('link');m.type=tarfile.SYMTYPE;m.linkname='/etc/passwd';t.addfile(m)
  self.assertNotEqual(self.run_case(add),0)
if __name__=='__main__':unittest.main()
