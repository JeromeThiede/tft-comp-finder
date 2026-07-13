// scrape-tftactics-v2.mjs — SELBST-ANPASSENDE Version (Test!)
// Zieht Champs/Kosten/Traits/Rezepte/Icons dynamisch aus Community Dragon (springt bei neuem Set automatisch mit),
// und die Comp-Liste weiter von tftactics.gg. Augments = kuratierter MetaTFT-S/A-Pool (bleibt manuell).
//
// Modi:
//   node scrape-tftactics-v2.mjs --probe   -> nur Datenstruktur von Community Dragon zeigen (SCHEMA-CHECK, erster Lauf!)
//   node scrape-tftactics-v2.mjs --dump    -> comps.js schreiben + Debug-Dateien (cd-tables.json)
//   node scrape-tftactics-v2.mjs           -> comps.js schreiben
//
// Setup:  npm i cheerio
// -----------------------------------------------------------------------------
import { writeFileSync } from 'fs';
import * as cheerio from 'cheerio';

const CD_URL   = 'https://raw.communitydragon.org/latest/cdragon/tft/en_us.json';
const CD_GAME  = 'https://raw.communitydragon.org/latest/game/';
const COMPS_URL= 'https://tftactics.gg/tierlist/team-comps/';
const args = process.argv.slice(2);
const has = f => args.includes(f);

const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const cdIcon = p => p ? CD_GAME + String(p).toLowerCase().replace(/\.(tex|dds)$/, '.png') : '';

async function getJSON(url){ const r = await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}}); if(!r.ok) throw new Error('Fetch '+url+' -> '+r.status); return r.json(); }
async function getHTML(url){ const r = await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}}); if(!r.ok) throw new Error('Fetch '+url+' -> '+r.status); return r.text(); }

// --- aktuelles Set aus Community Dragon wählen (höchste Nummer mit vielen Champs) ---
function pickSet(data){
  // Neueres Format: data.setData (Array mit number/champions/traits). Fallback: data.sets (Objekt).
  let candidates = [];
  if(Array.isArray(data.setData)) candidates = data.setData.map(s => ({ number:+s.number||+s.mutator?.replace(/\D/g,'')||0, champions:s.champions||[], traits:s.traits||[] }));
  else if(data.sets) candidates = Object.keys(data.sets).map(k => ({ number:+k, champions:data.sets[k].champions||[], traits:data.sets[k].traits||[] }));
  candidates = candidates.filter(s => (s.champions||[]).length >= 20);
  candidates.sort((a,b)=> b.number - a.number);
  if(!candidates.length) throw new Error('Kein Set mit Champions in Community Dragon gefunden – Schema geändert? Mit --probe prüfen.');
  return candidates[0];
}

function buildTables(data){
  const set = pickSet(data);
  const items = data.items || [];
  const itemByApi = {}; items.forEach(it => { if(it.apiName) itemByApi[it.apiName] = it; });

  const COST = {}, CHAMP_TRAITS = {}, CHAMP_ICON = {}, CHAMP_NAME = {};
  for(const c of set.champions){
    if(c.cost == null || !c.name) continue;
    const key = norm(c.name);
    COST[key] = c.cost;
    CHAMP_TRAITS[key] = (c.traits||[]).slice();
    CHAMP_ICON[key] = cdIcon(c.squareIcon || c.tileIcon || c.icon);
    CHAMP_NAME[key] = c.name;
  }
  const TRAITS = {};
  for(const t of set.traits){
    if(!t.name) continue;
    const breaks = (t.effects||[]).map(e => e.minUnits).filter(n => typeof n === 'number');
    TRAITS[t.name] = { breaks: [...new Set(breaks)].sort((a,b)=>a-b), icon: cdIcon(t.icon), members: [] };
  }
  // Mitglieder aus Champion-Traits füllen
  for(const [key, traits] of Object.entries(CHAMP_TRAITS))
    for(const tn of traits) if(TRAITS[tn]) TRAITS[tn].members.push(CHAMP_NAME[key]);

  const RECIPE = {}, ITEM_ICON = {};
  for(const it of items){
    if(!it.name) continue;
    ITEM_ICON[norm(it.name)] = cdIcon(it.icon);
    const comp = (it.composition||[]).map(api => itemByApi[api]?.name).filter(Boolean);
    if(comp.length === 2) RECIPE[norm(it.name)] = comp;
  }
  return { setNumber:set.number, COST, CHAMP_TRAITS, CHAMP_ICON, CHAMP_NAME, TRAITS, RECIPE, ITEM_ICON };
}

/* ---------- Augments: kuratierter MetaTFT-S/A-Pool (bleibt manuell) ---------- */
const AUG_B='https://ap.tft.tools/img/augments/';
const AUG={"Just Hit":["JustHit3","Prismatic"],"Tactician's Kitchen":["TacticiansKitchen3","Prismatic"],"Baron's Lair":["TheBaronsLair3","Prismatic"],"Forged in Strength":["ForgedInStrength3","Prismatic"],"Living Forge":["7LivingForge3","Prismatic"],"Calculated Loss":["6CalculatedLoss2","Gold"],"Epic Rolldown":["EpicRolldown2","Gold"],"Forward Thinking":["ForwardThinking2","Gold"],"Treasure Hunt":["TreasureHunt2","Gold"],"Spreading Roots":["SpreadingRoots2","Gold"],"Late Game Scaling":["LateGameScaling2","Gold"],"Heroic Grab Bag":["10HeroicGrabBag2","Gold"],"Big Grab Bag":["9BigGrabBag2","Gold"],"Rolling For Days I":["9Commander_RollingForDays1","Silver"],"Second Wind":["6SecondWind11","Silver"],"Carve a Path":["ComponentQuestSword1","Silver"],"Continuous Conjuration":["ComponentQuestRod1","Silver"],"Pandora's Items":["6PandorasItems1","Silver"],"Latent Forge":["9LongTimeCrafting1","Silver"],"Branching Out":["BranchingOut1","Silver"]};
const HERO={"Nasus":["Bonk!","17NasusCarry1","Silver"],"Leona":["Shieldmaiden","17LeonaCarry1","Silver"],"Aatrox":["Stellar Combo","17AatroxCarry1","Silver"],"Poppy":["Termeepnal Velocity","17PoppyCarry1","Silver"],"Pyke":["Contract Killer","17PykeCarry2","Gold"],"Mordekaiser":["Heat Death","17MordekaiserCarry2","Gold"],"Jax":["Reach for the Stars","17JaxCarry2","Gold"],"Gragas":["Self Destruct","17GragasCarry2","Gold"],"Meepsie":["The Big Bang","17IvernMinionCarry2","Gold"]};
const mkG=n=>AUG[n]?{n,r:AUG[n][1],icon:AUG_B+AUG[n][0]+".png"}:null;
const mkH=c=>({n:HERO[c][0],r:HERO[c][2],icon:AUG_B+HERO[c][1]+".png"});
const A_AP=/Rabadon|Void Staff|Jeweled|Blue Buff|Nashor|Hextech|Morellonomicon|Archangel|Ionic|Crownguard/,A_ADM=/Titan's|Sterak|Bloodthirster/,A_ADR=/Infinity Edge|Deathblade|Last Whisper|Giant Slayer|Kraken|Guinsoo|Red Buff/;
function pickAug(carries,roll,lvl){const items=carries.flatMap(x=>x.items.map(i=>i.name)).join(' ');const main=(carries[0]?carries[0].items:[]).map(i=>i.name).join(' ');const dmg=A_AP.test(main)?'ap':A_ADM.test(main)?'adm':A_ADR.test(main)?'adr':A_AP.test(items)?'ap':A_ADM.test(items)?'adm':A_ADR.test(items)?'adr':'tank';const fast=roll==='fast',reroll=roll==='slow'&&lvl<=6;const w=[];const hc=carries.map(x=>x.name).find(n=>HERO[n]);if(hc)w.push(mkH(hc));w.push(mkG(dmg==='ap'?"Tactician's Kitchen":dmg==='tank'?"Baron's Lair":"Just Hit"));w.push(mkG(reroll?"Calculated Loss":fast?"Forward Thinking":"Treasure Hunt"));w.push(mkG(reroll?"Epic Rolldown":lvl>=8?"Late Game Scaling":"Spreading Roots"));w.push(mkG(reroll?"Rolling For Days I":dmg==='ap'?"Continuous Conjuration":"Carve a Path"));w.push(mkG(reroll?"Second Wind":"Pandora's Items"));w.push(mkG("Latent Forge"),mkG("Branching Out"),mkG("Heroic Grab Bag"),mkG("Big Grab Bag"));const seen=new Set(),out=[];for(const a of w){if(out.length>=5)break;if(a&&!seen.has(a.n)){seen.add(a.n);out.push(a);}}return out;}

/* ---------- Trait-Zähler / Stern / Style (nutzt dynamische Tabellen) ---------- */
const traitKey = n => n.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9.]/g,'');
function activeTraits(units, named, T){
  const tally = {};
  for(const u of units){ for(const tn of (u.traits||[])) tally[tn]=(tally[tn]||0)+1;
    for(const it of u.items){ const m=it.name.match(/^(.*)\s+Emblem$/i); if(m){ const tn=Object.keys(T).find(x=>norm(x)===norm(m[1])); if(tn) tally[tn]=(tally[tn]||0)+1; } } }
  const out=[];
  for(const [tn,c] of Object.entries(tally)){ const info=T[tn]; if(!info) continue; const b=info.breaks; if(b.length && c>=b[0]){ let tier=0; b.forEach((x,i)=>{if(c>=x)tier=i+1;}); out.push({n:tn,key:traitKey(tn),c,tier,tiers:b.length,icon:info.icon}); } }
  out.sort((a,b)=>b.c-a.c||a.n.localeCompare(b.n));
  return out.filter(t=>t.c>=2||named.includes(t.n)).slice(0,9);
}
const parseStyle=s=>{const t=(s||'').toLowerCase();const roll=/fast/.test(t)?"fast":"slow";const lvl=(s.match(/\((\d)\)/)||s.match(/(\d)/)||[])[1];return{roll,level:lvl?+lvl:(roll==="fast"?8:6),type:s||"Slow Roll"};};
const starLevel=(u,r)=>r==="slow"?(u.carry&&u.cost<=3?3:u.carry&&u.cost===4?2:u.carry?1:u.cost<=3?2:1):(u.carry?2:u.cost<=2?2:1);
const shortItem=n=>n.split(' ').map(w=>w[0]).join('').slice(0,4);
const namedFromName=(name,active,T)=>{const hit=Object.keys(T).filter(t=>name.toLowerCase().includes(t.toLowerCase().replace(/\./g,''))||name.toLowerCase().includes(t.toLowerCase()));return hit.length?hit.slice(0,2):active.slice(0,2).map(t=>t.n);};

/* ---------- tftactics-Comps scrapen (wie v1) ---------- */
async function scrapeComps(TB){
  const html = await getHTML(COMPS_URL);
  const $ = cheerio.load(html);
  const KNOWN_ITEMS = new Set(Object.keys(TB.ITEM_ICON)); // normalisierte Item-Namen
  const cards = new Map();
  $('a[href*="/champions/"]').each((_,a)=>{ let el=a; while(el&&el.parent){ el=el.parent; if($(el).find('img[alt="Copy Team Code"]').length) break; } if(el){ if(!cards.has(el)) cards.set(el,[]); cards.get(el).push(a); } });
  const STYLE=/(Fast 8\/9|Fast 8|Fast 9|Slow Roll \(\d\)|Standard)/;
  const raw=[];
  for(const [card,anchors] of cards){
    const $c=$(card), head=$c.clone(); head.find('a[href*="/champions/"]').remove();
    const txt=head.text().replace(/\s+/g,' ').trim();
    const tier=/[SABC]/.test(txt.charAt(0))?txt.charAt(0):'A';
    const style=(txt.match(STYLE)||[])[1]||'';
    let name=txt; const mi=txt.search(STYLE); if(mi>0) name=txt.slice(0,mi); name=name.replace(/^[SABC]\s*/,'').replace(/\b(Emblem|Augment)\b/g,'').trim();
    const units=[];
    anchors.forEach(a=>{ const href=$(a).attr('href')||''; const slug=(href.match(/champions\/([^/]+)/)||[])[1]; if(!slug) return;
      const items=[]; $(a).find('img[alt]').each((_,img)=>{const alt=$(img).attr('alt'); if(alt&&KNOWN_ITEMS.has(norm(alt))) items.push(alt);});
      units.push([slug,items]); });
    if(units.length>=4) raw.push([tier,name,style,units]);
  }
  return raw;
}

function toComp([tier,name,style,units], TB){
  const st=parseStyle(style);
  const U=units.map(([slug,items])=>{
    const key=norm(slug);
    const nm=TB.CHAMP_NAME[key]||slug;
    const its=items.map(it=>({name:it,slug:it.replace(/[.'’\s]/g,''),short:shortItem(it),icon:TB.ITEM_ICON[norm(it)]||'',
      comp:(TB.RECIPE[norm(it)]||[]).map(c=>({name:c,slug:c.replace(/[.'’\s]/g,''),icon:TB.ITEM_ICON[norm(c)]||''}))}));
    const u={name:nm,slug:key,cost:TB.COST[key]||0,traits:TB.CHAMP_TRAITS[key]||[],icon:TB.CHAMP_ICON[key]||'',carry:its.length>=2,items:its};
    u.star=starLevel(u,st.roll); return u;
  });
  const carries=U.filter(u=>u.carry).slice(0,3).map(u=>({name:u.name,slug:u.slug,cost:u.cost,star:u.star,icon:u.icon,role:(u.cost>=4?"Haupt-Carry":"Reroll-Carry"),items:u.items.slice(0,3)}));
  const active=activeTraits(U,[],TB.TRAITS);
  const named=namedFromName(name,active,TB.TRAITS);
  const traits=activeTraits(U,named,TB.TRAITS);
  const cc={}; carries.forEach(cy=>cy.items.forEach(it=>(it.comp||[]).forEach(c=>cc[c.name]=(cc[c.name]||0)+1)));
  const carousel=Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n])=>n).join(' → ');
  return {name,alias:name,tier,roll:st.roll,
    playstyle:{type:st.type,level:st.level,desc:`${named.join(" · ")} — ${carries.map(c=>c.name).join(" & ")||"Flex"}.`},
    traits,units:U,carries,augments:pickAug(carries,st.roll,st.level),
    econ:{streak:st.roll==="fast"?"win":"flex",gold:st.roll==="fast"?"Econ auf >50 Gold halten, dann leveln/rollen.":`Auf Level ${st.level} slow-rollen (~50 Gold), Carries zuerst hoch-sternen.`,note:st.roll==="fast"?"Win-Streak anstreben, HP über >50 Gold Zinsen sparen und über Level-Timings pushen.":"Flexibel Win-/Loss-Streak; HP als Ressource für den Slow-Roll nutzen."},
    when:"",carousel};
}

const RANK={S:0,A:1,B:2,C:3};
(async()=>{
  const data = await getJSON(CD_URL);
  if(has('--probe')){
    console.log('== Community Dragon Top-Level Keys ==', Object.keys(data));
    const set = pickSet(data);
    console.log('Gewähltes Set:', set.number, '| Champions:', set.champions.length, '| Traits:', set.traits.length);
    console.log('\nBeispiel-Champion:', JSON.stringify(set.champions[0], null, 1).slice(0,800));
    console.log('\nBeispiel-Trait:', JSON.stringify(set.traits[0], null, 1).slice(0,600));
    console.log('\nBeispiel-Item:', JSON.stringify((data.items||[])[0], null, 1).slice(0,600));
    return;
  }
  const TB = buildTables(data);
  console.log('Set erkannt:', TB.setNumber, '| Champs:', Object.keys(TB.COST).length, '| Traits:', Object.keys(TB.TRAITS).length, '| Rezepte:', Object.keys(TB.RECIPE).length);
  if(has('--dump')) writeFileSync('cd-tables.json', JSON.stringify(TB,null,1));
  const raw = await scrapeComps(TB);
  if(raw.length<5) throw new Error(`Nur ${raw.length} Comps erkannt – tftactics-Struktur geändert? Mit --dump prüfen.`);
  const comps = raw.map(r=>toComp(r,TB)).sort((a,b)=>(RANK[a.tier]??9)-(RANK[b.tier]??9)).slice(0,30);
  const body='window.TFT_META='+JSON.stringify({set:TB.setNumber,patch:"auto",updated:new Date().toISOString().slice(0,10),source:"tftactics.gg + CommunityDragon"})+';\nwindow.TFT_COMPS='+JSON.stringify(comps)+';\n';
  writeFileSync('comps.js', body);
  console.log(`comps.js geschrieben – ${comps.length} Comps (${comps.map(c=>c.tier).join('')}).`);
})().catch(e=>{console.error('Fehler:',e.message);process.exit(1);});
