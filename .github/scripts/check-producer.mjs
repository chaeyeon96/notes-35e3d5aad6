import {checkedInputs,validateProducer,SOURCE} from './transfer-policy.mjs';
const input=checkedInputs({runId:process.env.SOURCE_RUN_ID,artifactId:process.env.SOURCE_ARTIFACT_ID,sha256:process.env.BUNDLE_SHA256,attempt:process.env.SOURCE_RUN_ATTEMPT});
const token=process.env.SOURCE_ACTIONS_READ_TOKEN;
if(!token)throw Error('Source Actions read secret is missing');
async function get(suffix){const r=await fetch(`https://api.github.com/repos/${SOURCE}/actions/${suffix}`,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'}});if(!r.ok)throw Error('Source metadata request failed');return r.json();}
try {const [run,artifact,jobs]=await Promise.all([get(`runs/${input.runId}`),get(`artifacts/${input.artifactId}`),get(`runs/${input.runId}/attempts/${input.attempt}/jobs`)]);validateProducer(input,run,artifact,jobs.jobs);console.log('Source build and encrypted artifact identity verified.');}catch{console.error('Transfer verification failed. No deployment is allowed.');process.exit(1);}
