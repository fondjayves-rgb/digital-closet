import { it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { validateRecommendations,lookCapacity,tagsSchema,type Garment } from '../packages/shared/src/index';
const owner=randomUUID();const other=randomUUID();
const garment=(category:Garment['category'],user_id=owner,status:Garment['status']='confirmed'):Garment=>({id:randomUUID(),user_id,status,category,color:'navy',pattern:'solid',attributes:[],name:'Garment',photo_path:'private',created_at:'',updated_at:''});
const top=garment('tops'),bottom=garment('bottoms'),shoe=garment('shoes');
const outfit=(ids:string[])=>({title:'A look',explanation:'A simple combination.',garmentIds:ids});
const response=(ids:string[])=>({suggestions:[outfit(ids)],inventoryNote:''});
it('rejects unknown, foreign and unconfirmed recommendation IDs',()=>{
  const foreign=garment('tops',other);const draft=garment('tops',owner,'pending');const inventory=[top,bottom,shoe,foreign,draft];
  for(const id of [randomUUID(),foreign.id,draft.id]) expect(()=>validateRecommendations(response([id,bottom.id,shoe.id]),inventory,owner)).toThrow();
});
it('rejects duplicates, incomplete looks and duplicate combinations',()=>{
  for(const ids of [[top.id,bottom.id],[top.id,bottom.id,shoe.id,shoe.id]]) expect(()=>validateRecommendations(response(ids),[top,bottom,shoe],owner)).toThrow();
  const look=outfit([top.id,bottom.id,shoe.id]);expect(()=>validateRecommendations({suggestions:[look,look],inventoryNote:''},[top,bottom,shoe],owner)).toThrow();
});
it('accepts complete owned looks and counts optional layers as distinct combinations',()=>{
  const inventory=[top,bottom,shoe,garment('outerwear'),garment('accessories')];expect(lookCapacity(inventory)).toBe(4);
  expect(validateRecommendations(response([top.id,bottom.id,shoe.id]),inventory,owner).suggestions).toHaveLength(1);
});
it('never accepts invented size, material, fit, ownership or unsupported attributes',()=>{
  for(const key of ['size','material','fit','ownership'])expect(tagsSchema.safeParse({category:'tops',color:'blue',pattern:'solid',attributes:[],[key]:'inferred'}).success).toBe(false);
  expect(tagsSchema.safeParse({category:'tops',color:'blue',pattern:'solid',attributes:['silk']}).success).toBe(false);
});
