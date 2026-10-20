// Opt-in integration check. Use a dedicated Supabase test project with the migration applied.
// No emails are sent: administrative test users are created already confirmed, then sign in normally.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { readConfig,missingSetup } from '../apps/api/src/config.js';
import { createApp } from '../apps/api/src/app.js';
import { workerClient,BUCKET } from '../apps/api/src/supabase.js';
import { createAI } from '../apps/api/src/ai.js';
import { processNextJob } from '../apps/api/src/jobs.js';
const config=readConfig();
if(missingSetup(config).length || !config.secretKey) {
  console.error('LIVE CHECK NOT RUN: configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY in apps/api/.env. See docs/testing.md.');process.exit(1);
}
if(process.env.LIVE_TEST_PROJECT!=='yes') {
  console.error('LIVE CHECK NOT RUN: point configuration at a dedicated migrated test project and set LIVE_TEST_PROJECT=yes. This check creates and removes two test accounts.');process.exit(1);
}
if(process.env.LIVE_AI==='yes' && (!process.env.LIVE_GARMENT_PHOTO || !config.openaiKey || !config.model)) {
  console.error('LIVE CHECK NOT RUN: LIVE_AI=yes also needs OPENAI_API_KEY, OPENAI_MODEL, and LIVE_GARMENT_PHOTO pointing to an authorized garment image.');process.exit(1);
}
const admin=workerClient(config);const userIds:string[]=[];const paths:string[]=[];
const server=createApp({config}).listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address || typeof address==='string')throw new Error('No address');
const base=`http://127.0.0.1:${address.port}/api`;
const call=async(path:string,token:string,body?:unknown,method=body?'POST':'GET')=>{
  const form=body instanceof FormData;return fetch(`${base}${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body&&!form?{'Content-Type':'application/json'}:{})},body:body?(form?body:JSON.stringify(body)):undefined});
};
let failed=false;
try {
  const tokens:string[]=[];
  for(let i=0;i<2;i++) {
    const email=`wardrobe-test-${randomUUID()}@example.test`;const password=`${randomUUID()}Aa!9`;
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw new Error('Test account creation failed');userIds.push(created.data.user.id);
    const client=createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const signed=await client.auth.signInWithPassword({email,password});if(signed.error||!signed.data.session)throw new Error('Real password sign-in failed');tokens.push(signed.data.session.access_token);
  }
  const image=process.env.LIVE_GARMENT_PHOTO?await readFile(process.env.LIVE_GARMENT_PHOTO):await sharp({create:{width:50,height:50,channels:3,background:'#ebe4d5'}}).png().toBuffer();
  const ids:string[]=[];
  for(const category of ['tops','bottoms','shoes']) {
    const form=new FormData();form.append('photo',new Blob([new Uint8Array(image)],{type:'image/png'}),'integration-fixture.png');
    // Normalize supplied references to a real PNG so MIME and decoded format agree.
    if(process.env.LIVE_GARMENT_PHOTO){form.set('photo',new Blob([new Uint8Array(await sharp(image).png().toBuffer())],{type:'image/png'}),'garment.png');}
    const upload=await call('/items',tokens[0],form);assert.equal(upload.status,201);const item=await upload.json() as {id:string;photo_path:string;photoUrl:string};ids.push(item.id);paths.push(item.photo_path);
    assert.equal((await call(`/items/${item.id}`,tokens[1])).status,404);
    const signedPhoto=await fetch(item.photoUrl);assert.equal(signedPhoto.status,200);
    const privateUrl=`${config.supabaseUrl}/storage/v1/object/public/${BUCKET}/${item.photo_path}`;assert.notEqual((await fetch(privateUrl)).status,200);
    if(process.env.LIVE_AI==='yes' && category==='tops') {
      assert.equal((await call(`/items/${item.id}/analyze`,tokens[0],{})).status,202);
      // Dedicated test project only: processing a job can incur an OpenAI charge.
      assert.equal(await processNextJob(admin,createAI(config)),true);
      const details=await (await call(`/items/${item.id}`,tokens[0])).json() as {job:{status:string};suggestion:unknown};assert.equal(details.job.status,'succeeded');assert.ok(details.suggestion);
    }
    const confirmed=await call(`/items/${item.id}/confirm`,tokens[0],{name:`Integration fixture ${category}`,category,color:'ivory',pattern:'solid',attributes:[]},'PATCH');assert.equal(confirmed.status,200);
  }
  const owned={title:'Integration test look',explanation:'Synthetic test combination for API verification.',garmentIds:ids,occasion:'Everyday',style:'Simple',season:'all-season'};
  assert.equal((await call('/outfits',tokens[1],owned)).status,400);
  const save=await call('/outfits',tokens[0],owned);assert.equal(save.status,201);const outfit=await save.json() as {id:string};
  assert.equal((await call('/wear-logs',tokens[0],{outfitId:outfit.id,wornOn:new Date().toISOString().slice(0,10)})).status,201);
  assert.equal((await call(`/outfits/${outfit.id}/feedback`,tokens[0],{rating:4,comment:'Integration fixture'})).status,200);
  if(process.env.LIVE_AI==='yes') {const ideas=await call('/outfits/suggest',tokens[0],{occasion:'Everyday',style:'Simple',season:'all-season'});assert.equal(ideas.status,200);}
  console.info(`LIVE CHECK PASSED: real password sign-in, private upload and signed access, cross-account isolation, manual tag confirmation, atomic outfit save, wear log, feedback.${process.env.LIVE_AI==='yes'?' OpenAI recognition and suggestions also passed.':' OpenAI calls were NOT run.'}`);
} catch {
  failed=true;console.error('LIVE CHECK FAILED. Check the migration, Auth settings, Storage policies, and provider configuration. Provider payloads and credentials are intentionally omitted.');
} finally {
  if(paths.length) {const result=await admin.storage.from(BUCKET).remove(paths);if(result.error){failed=true;console.error('Test photo cleanup failed. Remove integration-fixture photos in the dedicated test project.');}}
  for(const id of userIds){const result=await admin.auth.admin.deleteUser(id);if(result.error){failed=true;console.error('Test account cleanup failed. Remove wardrobe-test accounts in the dedicated test project.');}}
  await new Promise<void>(resolve=>server.close(()=>resolve()));
}
if(failed)process.exitCode=1;
