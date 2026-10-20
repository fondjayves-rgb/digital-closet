// Deterministic conversion of the preserved user brief. No provider calls or database writes.
import { readFileSync, writeFileSync } from 'node:fs';
const text = readFileSync(new URL('../references/Wardrobe_App_Update_Brief.md', import.meta.url), 'utf8');
const input = text.split('## Provided wardrobe inventory')[1].split('## Persistence and implementation requirements')[0];
const entries = [];
let section = '', subsection = '', index = 0;
const categoryFor = { Sandals:'shoes', Socks:'socks', Underwear:'underwear', 'Sleeveless shirts':'tops', Shorts:'bottoms', Tops:'tops', Bottoms:'bottoms', Jerseys:'tops', 'Hoodies and jogger':'sets', 'Suits and Afritude':'suits', 'Hats and caps':'headwear', Shoes:'shoes', Pajamas:'sleepwear', 'After shower cloth':'after-shower', 'Durags and bandanas':'headwear', 'Fragrance accessories':'fragrance' };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
function item(source, overrides = {}, suffix = '') {
  const workCategory = source.startsWith('Underwear') ? 'underwear' : source.startsWith('Socks') ? 'socks' : source.startsWith('Shoes') ? 'shoes' : source.startsWith('Belt') ? 'accessories' : /^(Jeans|Bottom)/.test(source) ? 'bottoms' : 'tops';
  const category = section === 'Work collection' ? workCategory : source.startsWith('Afritude') ? 'afritude' : /^(Ensemble jean|All white)/.test(source) ? 'sets' : categoryFor[section];
  const brands = ['Nike','Jordan','Calvin Klein','Zara','H&M','Versace','Givenchy','Alexander Mc Queen','LV','Dolce Gabbana'].filter(b=>source.toLowerCase().includes(b.toLowerCase()));
  const explicitPack = source.match(/pack of (\d+)/i);
  const unit = /\bpairs?\b/i.test(source) ? 'pairs' : explicitPack ? 'pieces' : 'unspecified';
  const q = explicitPack ? Number(explicitPack[1]) : /x1\b/.test(source) ? 1 : /: (\d+) pair/.test(source) ? Number(source.match(/: (\d+) pair/)[1]) : null;
  const item = { name: `${section === 'Work collection' ? 'Work · ' : ''}${source.replace(/\.$/,'')}`.slice(0,100), category, color:null, pattern:'unknown', attributes:[], brand:brands.length === 1 ? brands[0] : null, fit:/slim fit/i.test(source) && !/baggy/i.test(source) ? 'slim fit' : /baggy fit/i.test(source) && !/slim/i.test(source) ? 'baggy fit' : null, subtype:section === 'Sandals' ? 'sandals' : section === 'Jerseys' ? 'jersey' : section === 'Sleeveless shirts' ? 'sleeveless shirt' : section === 'Shorts' ? 'shorts' : null, quantity:q, quantity_unit:unit, pack_count:explicitPack || /1 pack/i.test(source) ? 1 : null, pack_description:/pack|ensemble|chemise \+|polo \+|T-shirt \+/i.test(source) ? source : '', source_description:source, review_notes:'', set_coverage:'unspecified', collections: section === 'Work collection' ? ['Work'] : section === 'Shoes' ? [subsection || 'Shoes'] : section === 'Fragrance accessories' ? [] : ['Daily'], ...overrides };
  const knownColors = ['black','white','gray','brown','kaki','beige','burgundy','gold','blue','red','green'].filter(c => new RegExp(`\\b${c}\\b`,'i').test(source));
  if (!('color' in overrides) && knownColors.length === 1) item.color=knownColors[0];
  if (section === 'Shorts' && source === 'Others: 3 others.') item.quantity=3;
  if (section === 'Work collection' && source.startsWith('Shoes:')) item.quantity=3;
  if (section === 'Work collection' && source.startsWith('Belt:')) item.quantity=2;
  if (section === 'Fragrance accessories') item.collections=source.startsWith('Work') ? ['Work'] : source.startsWith('Sport') ? ['Sport'] : source.startsWith('Home') ? ['Home'] : [];
  const warnings = [];
  if (item.quantity === null) warnings.push('Quantity is unspecified; review without inventing a count.');
  if (item.quantity_unit === 'unspecified') warnings.push('Quantity unit is unspecified.');
  if (section === 'Work collection' && ['socks','underwear','bottoms'].includes(category) || section === 'Shoes' && /Zara|Nike|Jordan/.test(source)) warnings.push('Potential overlap with other collections. Choose separate, link, or skip.');
  if (/Zara\/H&M|approximately Zara/.test(source)) { item.brand=null; warnings.push('Brand allocation or brand is unconfirmed.'); }
  if (['sets','suits','sleepwear'].includes(category)) warnings.push('Keep the set together; do not count components separately.');
  entries.push({ key:`${slug(section)}-${index}${suffix}`,kind:'item',section,source,warnings,item });
}
for (const line of input.split(/\r?\n/)) {
  if (line.startsWith('### ')) { section=line.slice(4).trim(); subsection=''; index=0; continue; }
  if (/^(Street wear|Business casual|Date night):/.test(line)) { subsection=line.slice(0,-1); continue; }
  if (!section || !line.startsWith('- ')) continue;
  index++; const source=line.slice(2).trim();
  if (source.startsWith('Quantities unspecified for these entries')) continue;
  if (section === 'Sports combination templates' || section === 'Planned occasions' || source === 'Smoking: TBD.') {
    const title = source.split(':')[0];
    const body = source.split(': ').slice(1).join(': ');
    const components = body === 'TBD.' ? [] : body.split('. ')[0].replace(/\.$/,'').split(', ').map(label=>({label,item_id:null}));
    entries.push({key:`${slug(section)}-${index}`,kind:'template',section,source,warnings:['Planning template only. Components do not establish additional ownership.',...(source.includes('Thigh') ? ['“Thigh” needs your clarification.'] : [])],template:{title,occasion:title.includes('Day') ? 'Sport' : title,notes:source,components}});
    continue;
  }
  if (section === 'Socks' && /^(Nike|Jordan):/.test(source)) {
    for (const [color, suffix] of [['white','white'],['black','black'],[null,'color']]) item(source,{name:`${source.split(':')[0]} socks · ${suffix}`,quantity:3,color},`-${suffix}`);
  } else if (section === 'Socks' && source.startsWith('Zara/H&M')) {
    for (const color of ['black','brown','kaki','beige','gray']) item(source,{name:`Socks · ${color}`,quantity:1,color,brand:null},`-${color}`);
  } else if (section === 'Underwear' && source.startsWith('Calvin Klein')) {
    for (const [color,q] of [['black',2],['white',3],['gray',2],[null,2]]) item(source,{name:`Calvin Klein underwear · ${color || 'colors unspecified'}`,quantity:q,color},`-${color || 'colors'}`);
  } else if (section === 'Bottoms' && /^Jeans/.test(source)) {
    for (const color of source.includes('sky blue') ? ['black','sky blue'] : ['black','blue']) item(source,{name:`${source.split(':')[0]} · ${source.includes('ripped') ? 'ripped ' : ''}${color}`,quantity:1,color,subtype:'jeans',fit:source.includes('baggy') ? 'baggy' : 'slim fit'},`-${slug(color)}`);
  } else if (section === 'Shoes' && /^Nike: 5|^Jordan: 5/.test(source)) item(source,{quantity:5,quantity_unit:'pairs'});
  else if (section === 'Shoes' && source === 'Zara black 2, Zara brown 2.') {
    for (const color of ['black','brown']) item(source,{name:`Zara shoes · ${color}`,brand:'Zara',quantity:2,color},`-${color}`);
  } else if (section === 'Work collection' && source.startsWith('Underwear:')) {
    for (const color of ['black','gray','brown']) item(source,{name:`Work underwear · ${color}`,brand:'Calvin Klein',quantity:2,color},`-${color}`);
  } else if (section === 'Work collection' && source.startsWith('Socks:')) {
    for (const color of ['black','gray','brown','beige']) item(source,{name:`Work socks · ${color}`,quantity:color === 'black' ? 2 : 1,color},`-${color}`);
  } else if (section === 'Work collection' && /^(Polos|Chemises):/.test(source)) item(source,{quantity:5,quantity_unit:'pieces',subtype:source.startsWith('Polos') ? 'polo' : 'chemise'});
  else if (section === 'Suits and Afritude' && source.startsWith('Normal suits:')) {
    for (const color of ['black','gray','brown','blue']) item(source,{name:`Normal suit · ${color}`,quantity:1,quantity_unit:'sets',color},`-${color}`);
    item(source,{name:'Specials · suits',quantity:null},'-specials');
  } else if (section === 'Suits and Afritude' && source.startsWith('Afritude:')) {
    for (const color of ['white','gold','black']) item(source,{name:`Afritude · ${color}`,quantity:1,color},`-${color}`);
  } else item(source);
}
writeFileSync(new URL('../packages/shared/src/provided-inventory.json',import.meta.url), JSON.stringify(entries,null,2)+'\n');
console.log(JSON.stringify({ sourceBullets:input.split(/\r?\n/).filter(l=>l.startsWith('- ')).length, inventoryRecords:entries.filter(e=>e.kind==='item').length, templates:entries.filter(e=>e.kind==='template').length }));
