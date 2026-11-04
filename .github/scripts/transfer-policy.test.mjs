import test from 'node:test';import assert from 'node:assert/strict';import {checkedInputs,validateProducer} from './transfer-policy.mjs';
const input=checkedInputs({runId:'123',artifactId:'456',sha256:'a'.repeat(64),attempt:'1'});
function fixtures(){return [{id:123,run_attempt:1,repository:{full_name:'chaeyeon96/study-wiki'},head_repository:{full_name:'chaeyeon96/study-wiki'},head_branch:'main',event:'push',path:'.github/workflows/private-site.yml',head_sha:'abc'}, {id:456,expired:false,name:'encrypted-site-123-1',workflow_run:{id:123,head_sha:'abc'},size_in_bytes:91000000},[{name:'Build verified encrypted bundle',conclusion:'success',status:'completed',run_attempt:1}]];}
test('correct producer accepted',()=>validateProducer(input,...fixtures()));
for(const [name,mutate] of [['foreign repository',x=>x[0].repository.full_name='attacker/repo'],['fork',x=>x[0].head_repository.full_name='attacker/repo'],['wrong branch',x=>x[0].head_branch='other'],['pull request',x=>x[0].event='pull_request'],['wrong workflow',x=>x[0].path='other.yml'],['expired artifact',x=>x[1].expired=true],['other artifact',x=>x[1].id=999],['wrong commit',x=>x[1].workflow_run.head_sha='def'],['failed build',x=>x[2][0].conclusion='failure'],['old attempt',x=>x[2][0].run_attempt=2]])test(name+' rejected',()=>{const x=fixtures();mutate(x);assert.throws(()=>validateProducer(input,...x));});
test('injection identifiers rejected',()=>assert.throws(()=>checkedInputs({...input,runId:'1; echo secret'})));

test("current verified 264MB bundle accepted",()=>{const x=fixtures();x[1].size_in_bytes=264091918;validateProducer(input,...x);});
test("350MB boundary accepted",()=>{const x=fixtures();x[1].size_in_bytes=350000000;validateProducer(input,...x);});
test("over 350MB rejected",()=>{const x=fixtures();x[1].size_in_bytes=350000001;assert.throws(()=>validateProducer(input,...x));});
