export const SOURCE='chaeyeon96/study-wiki';
export function checkedInputs({runId,artifactId,sha256,attempt}) {
 for(const v of [runId,artifactId,attempt])if(!/^[1-9][0-9]{0,18}$/.test(String(v)))throw Error('Invalid numeric transfer identifier');
 if(!/^[a-f0-9]{64}$/.test(sha256))throw Error('Invalid transfer digest');
 return {runId:String(runId),artifactId:String(artifactId),sha256,attempt:String(attempt)};
}
export function validateProducer(input,run,artifact,jobs){
 if(run.id.toString()!==input.runId||run.run_attempt.toString()!==input.attempt||run.repository?.full_name!==SOURCE||run.head_repository?.full_name!==SOURCE||run.head_branch!=='main'||!['push','workflow_dispatch'].includes(run.event)||run.path!=='.github/workflows/private-site.yml')throw Error('Untrusted source workflow');
 if(artifact.id.toString()!==input.artifactId||artifact.expired||artifact.name!==`encrypted-site-${input.runId}-${input.attempt}`||artifact.workflow_run?.id.toString()!==input.runId||artifact.workflow_run?.head_sha!==run.head_sha||artifact.size_in_bytes>350000000)throw Error('Untrusted artifact');
 if(!jobs.some(j=>j.name==='Build verified encrypted bundle'&&j.conclusion==='success'&&j.status==='completed'&&j.run_attempt===run.run_attempt))throw Error('Source build not verified');
}

