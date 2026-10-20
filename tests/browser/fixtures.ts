// Test-only network fixtures. These verify UI behavior, not hosted Auth/Storage/OpenAI.
import { expect,type Page } from '@playwright/test';
import provided from '../../packages/shared/src/provided-inventory.json' with {type:'json'};
import { inspiration } from '../../apps/api/src/inspiration';
const userId='11111111-1111-4111-8111-111111111111';
const ids=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc'];
export async function fixture(page:Page, options: { empty?: boolean; failInitial?: boolean } = {}) {
  if (page.url() !== 'about:blank') await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const shapes=[`<path d="m65 55 30-18q15 17 30 0l30 18 35 60-29 17-20-32v140H79V100l-20 32-29-17z" fill="#e4ddca"/><path d="M95 37q15 40 30 0M110 60v180" fill="none"/>`,`<path d="M68 35h85l13 205h-47l-9-130-9 130H54z" fill="#626b7c"/><path d="M68 55h85M110 37v73" fill="none"/>`,`<path d="M40 135v-40h42l24 35 65 12q20 4 20 24H34v-24z" fill="#b1a28b"/><path d="M34 166h158v12H34zM88 116l20-10m-12 22 20-10m-9 23 20-10" fill="none"/>`];
  const items:any[]=(options.empty ? [] : ids).map((id,index)=>({id,user_id:userId,name:['Test shirt','Test trousers','Test shoes'][index],category:['tops','bottoms','shoes'][index],color:'ivory',pattern:'solid',attributes:[],status:'confirmed',photo_path:`${userId}/${id}.webp`,photoUrl:`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 275" stroke="#8c8b7c" stroke-width="2" stroke-linejoin="round">${shapes[index]}</svg>`)}`,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}));
  let outfit:any=null;const logs:any[]=[];const templates:any[]=[];const ledger=new Set<string>();let profile:any={display_name:'Test User',style_preferences:'Simple',gender:null,gender_description:'',default_occasion:''};let failInitial=options.failInitial ?? false;
  const user={id:userId,aud:'authenticated',role:'authenticated',email:'browser-test@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
  const expires=Math.floor(Date.now()/1000)+3600;
  const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:userId,role:'authenticated',aud:'authenticated',exp:expires,iat:expires-3600})).toString('base64url'),'browser-test-signature'].join('.');
  await page.route('https://wardrobe-browser-test.invalid/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/logout')){await route.fulfill({status:204});return;}
    const response=path.endsWith('/user')?user:{access_token:token,refresh_token:'test-refresh',expires_in:3600,expires_at:expires,token_type:'bearer',user};
    await route.fulfill({json:response});
  });
  await page.route('**/api/**',async route=>{
    const req=route.request();const path=new URL(req.url()).pathname;const method=req.method();let result:any={};let status=200;
    if(path==='/api/items' && method==='GET' && failInitial){await route.fulfill({status:503,json:{error:'Temporary connection problem. Please retry.'}});return;}
    const body=method==='GET'||method==='DELETE'?{}:req.headers()['content-type']?.includes('json')?req.postDataJSON():{};
    if(path==='/api/capabilities')result={inventoryUpdate:true};
    else if(path==='/api/inspiration')result=inspiration;
    else if(path==='/api/profile'){if(method==='PATCH')profile={...profile,...body};result=profile;}
    else if(path==='/api/items'&&method==='GET'){
      const q=new URL(req.url()).searchParams;let filtered=items.filter(i=>(!q.get('q')||[i.name,i.color,i.brand,i.source_description].join(' ').toLowerCase().includes(q.get('q')!.toLowerCase()))&&(!q.get('category')||i.category===q.get('category'))&&(!q.get('status')||i.status===q.get('status'))&&(q.get('favorite')!=='true'||i.is_favorite)&&['brand','color','fit','subtype'].every(k=>!q.get(k)||i[k]===q.get(k))&&(!q.get('collection')||i.collections?.includes(q.get('collection'))));
      if(q.get('sort')==='name')filtered=filtered.sort((a:any,b:any)=>a.name.localeCompare(b.name));const offset=Number(q.get('offset')||0),limit=Number(q.get('limit')||100);result={items:filtered.slice(offset,offset+limit),total:filtered.length,nextOffset:offset+limit<filtered.length?offset+limit:null};
    }
    else if(path==='/api/items'&&method==='POST'){const draft={...items[0],id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',user_id:userId,name:'Untitled garment',status:'pending',category:null,color:null,attributes:[],pattern:'unknown',photo_path:userId+'/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp'};items.push(draft);result=draft;status=201;}
    else if(path==='/api/items/manual'){const record={...body,id:crypto.randomUUID(),user_id:userId,status:'confirmed',photo_path:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};items.push(record);result=record;status=201;}
    else if(path.startsWith('/api/items/')){
      const id=path.split('/')[3];const record=items.find(i=>i.id===id);
      if(path.endsWith('/photo')){record.photo_path=userId+'/'+id+'.webp';record.photoUrl=items[0]?.photoUrl;result=record;}
      else if(method==='DELETE'){items.splice(items.findIndex(i=>i.id===id),1);if(outfit?.outfit_items.some((i:any)=>i.item_id===id)){outfit.invalidated=true;outfit.outfit_items=outfit.outfit_items.filter((i:any)=>i.item_id!==id);}result={};}
      else if(method==='PATCH'){Object.assign(record,body,path.endsWith('/confirm')?{status:'confirmed'}:{});result=record;}
      else result={item:record,job:null,suggestion:null};
    }
    else if(path==='/api/import/preview')result={importId:'provided-wardrobe-v1',entries:provided.map(e=>({...e,imported:ledger.has(e.key),candidates:items.filter(i=>i.category===e.item?.category).map(i=>({id:i.id,name:i.name}))}))};
    else if(path==='/api/import/commit'){result={results:body.entries.map((row:any)=>{if(ledger.has(row.key)||row.action==='skip')return {key:row.key,status:'skipped'};const source=provided.find(e=>e.key===row.key)!;const id=crypto.randomUUID();if(source.kind==='template')templates.push({...row.data,id,template_components:row.data.components.map((c:any)=>({...c,id:crypto.randomUUID()}))});else if(row.action==='create')items.push({...row.data,id,user_id:userId,status:'confirmed',photo_path:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});else{const item=items.find(i=>i.id===row.existingId);item.collections=[...new Set([...(item.collections||[]),...row.data.collections])];}ledger.add(row.key);return {key:row.key,status:row.action==='link'?'linked':'created',id};})};}
    else if(path==='/api/templates')result={templates};
    else if(path.startsWith('/api/templates/')){const t=templates.find(t=>t.id===path.split('/')[3]);if(method==='DELETE')templates.splice(templates.indexOf(t),1);else Object.assign(t,body,{template_components:body.components.map((c:any)=>({...c,id:crypto.randomUUID()}))});result={id:t.id};}
    else if(path==='/api/outfits/suggest')result={suggestions:[{title:'A test look',explanation:'A combination of the three test garments.',garmentIds:ids}],inventoryNote:'The test inventory supports one combination.'};
    else if((path==='/api/outfits'||path==='/api/outfits/manual')&&method==='POST'){outfit={...body,id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',creation_method:path.endsWith('/manual')?'manual':'ai',invalidated:false,outfit_items:body.garmentIds.map((item_id:string)=>({item_id})),outfit_feedback:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()};result={id:outfit.id};status=201;}
    else if(path==='/api/outfits')result={outfits:outfit?[outfit]:[]};
    else if(path.startsWith('/api/outfits/')&&method==='PATCH'){Object.assign(outfit,body,{outfit_items:body.garmentIds.map((item_id:string)=>({item_id}))});result={id:outfit.id};}
    else if(path.startsWith('/api/outfits/')&&method==='DELETE'){outfit=null;logs.splice(0,logs.length);result={};}
    else if(path==='/api/wear-logs'&&method==='POST'){if(logs.some(l=>l.outfit_id===body.outfitId&&l.worn_on===body.wornOn)){result={error:'This record already exists. Refresh and try again.'};status=409;}else{logs.push({id:'ffffffff-ffff-4fff-8fff-ffffffffffff',outfit_id:body.outfitId,worn_on:body.wornOn,outfits:{title:outfit.title}});result=logs[0];status=201;}}
    else if(path==='/api/wear-logs')result={logs};
    else if(path.startsWith('/api/wear-logs/')&&method==='DELETE'){logs.splice(0,1);result={};}
    else if(path.endsWith('/feedback')){result=body;outfit.outfit_feedback=[result];}
    await route.fulfill({status,json:result});
  });
  await page.goto('/');await page.getByLabel('Email address').fill('browser-test@example.test');await page.getByLabel('Password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Step inside'}).click();
  if (!options.failInitial) await expect(page.getByRole('heading',{name:'Hello, Test.'})).toBeVisible();
  return { recover: () => { failInitial = false; }, items };
}
