import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve('encrypted-site'),base='https://chaeyeon96.github.io/notes-35e3d5aad6/';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const expected=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.isFile()){const rel=path.relative(root,f).split(path.sep).join('/');if(rel!=='.nojekyll')expected.push({rel,sha:hash(fs.readFileSync(f))});}else throw Error('Invalid deployed file');}}walk(root);
let pending=expected,checked=0,bytes=0;const deadline=Date.now()+180000;
while(pending.length&&Date.now()<deadline){const failed=[];let next=0;await Promise.all(Array.from({length:6},async()=>{while(next<pending.length){const item=pending[next++];try{const r=await fetch(base+item.rel+'?deployment='+encodeURIComponent(process.env.GITHUB_RUN_ID||'verification'),{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP');const b=Buffer.from(await r.arrayBuffer());if(hash(b)!==item.sha)throw Error('Digest');checked++;bytes+=b.length;}catch{failed.push(item);}}}));pending=failed;if(pending.length)await new Promise(r=>setTimeout(r,10000));}
if(pending.length){console.error('Live ciphertext verification incomplete: '+pending.length+' files do not yet match the verified artifact.');process.exit(1);}
console.log('Live site matches verified artifact: '+JSON.stringify({files:checked,bytes}));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Live ciphertext/static file SHA256 comparison passed: '+checked+' files. No decryption or password used on the public runner.\n');
