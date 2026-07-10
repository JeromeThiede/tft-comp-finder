// scrape-tftactics.mjs — holt die aktuellen Comps von tftactics.gg und schreibt comps.js
// Setup:  npm i cheerio      Lauf:  node scrape-tftactics.mjs   (Debug: node scrape-tftactics.mjs --dump)
//
// Champion-Kosten, Traits (mit Stufen) und Item-Rezepte ändern sich nur bei einem NEUEN Set (17->18),
// nicht pro Patch – daher hier fest hinterlegt. Der Scraper liest pro Patch nur die Comp-LISTE neu.
// Bei Set-Wechsel diese Tabellen einmal aktualisieren (Quelle: tftactics.gg /db/origins, /db/classes, /item-builder).

import { writeFileSync } from 'fs';
import * as cheerio from 'cheerio';

const URL = 'https://tftactics.gg/tierlist/team-comps/';

/* ---------------- statische Tabellen (Set 17) ---------------- */
const COST = {};
const setCost=(c,ns)=>ns.forEach(n=>COST[n.replace(/[^A-Za-z]/g,'')]=c);
setCost(1,["Aatrox","Briar","Caitlyn","Chogath","Ezreal","Leona","Lissandra","Nasus","Poppy","RekSai","Talon","Teemo","Twisted Fate","Veigar"]);
setCost(2,["Akali","Belveth","Gnar","Gragas","Gwen","Jax","Jinx","Meepsie","Milio","Mordekaiser","Pantheon","Pyke","Zoe"]);
setCost(3,["Aurora","Diana","Fizz","Illaoi","Kaisa","Lulu","Maokai","Miss Fortune","Ornn","Rhaast","Samira","Urgot","Viktor"]);
setCost(4,["Aurelion Sol","Corki","Karma","Kindred","Leblanc","Master Yi","Nami","Nunu","Rammus","Riven","Tahm Kench","The Mighty Mech","Xayah"]);
setCost(5,["Bard","Blitzcrank","Fiora","Graves","Jhin","Morgana","Shen","Sona","Vex","Zed"]);
const champSlug=n=>n.replace(/[^A-Za-z]/g,'');
const cost=n=>COST[champSlug(n)]||0;
const SLUG2NAME={};
for(const key of Object.keys(COST)) SLUG2NAME[key.toLowerCase()]=key; // Platzhalter, echte Namen unten
[["Aatrox"],["Briar"],["Caitlyn"],["Chogath"],["Ezreal"],["Leona"],["Lissandra"],["Nasus"],["Poppy"],["RekSai"],["Talon"],["Teemo"],["Twisted Fate"],["Veigar"],["Akali"],["Belveth"],["Gnar"],["Gragas"],["Gwen"],["Jax"],["Jinx"],["Meepsie"],["Milio"],["Mordekaiser"],["Pantheon"],["Pyke"],["Zoe"],["Aurora"],["Diana"],["Fizz"],["Illaoi"],["Kaisa"],["Lulu"],["Maokai"],["Miss Fortune"],["Ornn"],["Rhaast"],["Samira"],["Urgot"],["Viktor"],["Aurelion Sol"],["Corki"],["Karma"],["Kindred"],["Leblanc"],["Master Yi"],["Nami"],["Nunu"],["Rammus"],["Riven"],["Tahm Kench"],["The Mighty Mech"],["Xayah"],["Bard"],["Blitzcrank"],["Fiora"],["Graves"],["Jhin"],["Morgana"],["Shen"],["Sona"],["Vex"],["Zed"]]
  .forEach(([n])=>{ SLUG2NAME[n.toLowerCase().replace(/[^a-z]/g,'')]=n; });
const nameFromSlug=slug=>SLUG2NAME[slug.toLowerCase().replace(/[^a-z]/g,'')]||slug;

const itemSlug=n=>n.replace(/[.'’\s]/g,'');   // sunderarmor.com/items/<slug>.png
const shortItem=n=>n.split(' ').map(w=>w[0]).join('').slice(0,4);
const PSIONIC=["Malware Matrix","Target Lock Optics","Sympathetic Implant","Drone Uplink"];
const PSI_ICON={"Malware Matrix":"17PsyOps_ChemicalCapacitorMod","Target Lock Optics":"17PsyOps_TargetlockMod","Sympathetic Implant":"17PsyOps_SympatheticImplantMod","Drone Uplink":"17PsyOps_DroneMod","Biomatter Preserver":"17PsyOps_GrenadeMod"};
const psiIcon=n=>PSI_ICON[n]?("https://ap.tft.tools/img/items_s14/"+PSI_ICON[n]+".png"):null;
const RECIPE={"Deathblade":["BF Sword","BF Sword"],"Infinity Edge":["BF Sword","Sparring Gloves"],"Giant Slayer":["BF Sword","Recurve Bow"],"Bloodthirster":["BF Sword","Negatron Cloak"],"Sterak's Gage":["BF Sword","Giant's Belt"],"Hextech Gunblade":["BF Sword","Needlessly Large Rod"],"Spear of Shojin":["BF Sword","Tear of the Goddess"],"Edge of Night":["BF Sword","Chain Vest"],"Red Buff":["Recurve Bow","Recurve Bow"],"Guinsoo's Rageblade":["Recurve Bow","Needlessly Large Rod"],"Last Whisper":["Recurve Bow","Sparring Gloves"],"Kraken's Fury":["Recurve Bow","Negatron Cloak"],"Titan's Resolve":["Recurve Bow","Chain Vest"],"Void Staff":["Recurve Bow","Tear of the Goddess"],"Nashor's Tooth":["Recurve Bow","Needlessly Large Rod"],"Rabadon's Deathcap":["Needlessly Large Rod","Needlessly Large Rod"],"Jeweled Gauntlet":["Needlessly Large Rod","Sparring Gloves"],"Archangel's Staff":["Needlessly Large Rod","Tear of the Goddess"],"Crownguard":["Needlessly Large Rod","Chain Vest"],"Ionic Spark":["Needlessly Large Rod","Negatron Cloak"],"Morellonomicon":["Needlessly Large Rod","Giant's Belt"],"Blue Buff":["Tear of the Goddess","Tear of the Goddess"],"Hand of Justice":["Tear of the Goddess","Sparring Gloves"],"Protector's Vow":["Tear of the Goddess","Chain Vest"],"Spirit Visage":["Tear of the Goddess","Giant's Belt"],"Bramble Vest":["Chain Vest","Chain Vest"],"Gargoyle Stoneplate":["Chain Vest","Negatron Cloak"],"Sunfire Cape":["Chain Vest","Giant's Belt"],"Dragon's Claw":["Negatron Cloak","Negatron Cloak"],"Quicksilver":["Negatron Cloak","Sparring Gloves"],"Evenshroud":["Negatron Cloak","Giant's Belt"],"Warmog's Armor":["Giant's Belt","Giant's Belt"],"Striker's Flail":["Giant's Belt","Sparring Gloves"],"Thief's Gloves":["Sparring Gloves","Sparring Gloves"]};
const SPECIAL=["Malware Matrix","Sympathetic Implant","Drone Uplink","Dark Star Emblem","Space Groove Emblem","NOVA Emblem","Stargazer Emblem","Meeple Emblem","Primordian Emblem"];
const KNOWN_ITEMS=new Set([...Object.keys(RECIPE),...SPECIAL,"Adaptive Helm","Steadfast Heart"]);
const mkItem=n=>{const it={name:n,slug:itemSlug(n),short:shortItem(n),comp:(RECIPE[n]||[]).map(c=>({name:c,slug:itemSlug(c)}))};const ic=psiIcon(n);if(ic)it.icon=ic;if(PSIONIC.includes(n))it.alt=PSIONIC.filter(x=>x!==n).slice(0,2).map(a=>{const o={name:a,slug:itemSlug(a)};const ai=psiIcon(a);if(ai)o.icon=ai;return o;});return it;};

const traitKey=n=>n.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9.]/g,'');
const TRAITS={"Anima":{breaks:[3,6],units:["Briar","Jinx","Aurora","Illaoi","Fiora"]},"Arbiter":{breaks:[2,3],units:["Leona","Zoe","Diana","Leblanc"]},"Bulwark":{breaks:[1],units:["Shen"]},"Commander":{breaks:[1],units:["Sona"]},"Dark Lady":{breaks:[1],units:["Morgana"]},"Dark Star":{breaks:[2,4,6,9],units:["Chogath","Lissandra","Mordekaiser","Kaisa","Karma","Jhin"]},"Divine Duelist":{breaks:[1],units:["Fiora"]},"Doomer":{breaks:[1],units:["Vex"]},"Factory New":{breaks:[1],units:["Graves"]},"Galaxy Hunter":{breaks:[1],units:["Zed"]},"Gun Goddess":{breaks:[1],units:["Miss Fortune"]},"Mecha":{breaks:[3,4,6],units:["Urgot","Aurelion Sol","The Mighty Mech"]},"Meeple":{breaks:[3,5,7,10],units:["Poppy","Veigar","Gnar","Meepsie","Fizz","Corki","Rammus","Bard"]},"N.O.V.A.":{breaks:[2,5],units:["Aatrox","Caitlyn","Akali","Maokai","Kindred"]},"Oracle":{breaks:[1],units:["Tahm Kench"]},"Party Animal":{breaks:[1],units:["Blitzcrank"]},"Primordian":{breaks:[2,3],units:["Briar","RekSai","Belveth"]},"Psionic":{breaks:[2,4],units:["Gragas","Pyke","Viktor","Master Yi","Sona"]},"Redeemer":{breaks:[1],units:["Rhaast"]},"Space Groove":{breaks:[1,3,5,7,10],units:["Nasus","Teemo","Gwen","Ornn","Samira","Nami","Blitzcrank"]},"Stargazer":{breaks:[3],units:["Talon","Twisted Fate","Jax","Lulu","Nunu","Xayah"]},"Timebreaker":{breaks:[2,3,4],units:["Ezreal","Milio","Pantheon","Riven"]},"Bastion":{breaks:[2,4,6],units:["Aatrox","Poppy","Jax","Ornn","Rammus","Shen"]},"Brawler":{breaks:[2,4,6],units:["Chogath","RekSai","Gragas","Pantheon","Maokai","Urgot","Tahm Kench"]},"Challenger":{breaks:[2,3,4,5],units:["Belveth","Jinx","Diana","Kindred"]},"Conduit":{breaks:[2,3,4,5],units:["Mordekaiser","Zoe","Viktor","Aurelion Sol","Bard"]},"Eradicator":{breaks:[1],units:["Jhin"]},"Fateweaver":{breaks:[2,4],units:["Caitlyn","Twisted Fate","Milio","Corki"]},"Marauder":{breaks:[2,4,6],units:["Akali","Belveth","Urgot","Master Yi","Fiora"]},"Replicator":{breaks:[2,4],units:["Lissandra","Veigar","Pantheon","Lulu","Nami"]},"Rogue":{breaks:[2,3,4,5],units:["Briar","Talon","Gwen","Fizz","Kaisa","Riven"]},"Shepherd":{breaks:[3,5,7],units:["Lissandra","Teemo","Meepsie","Illaoi","Leblanc","Sona"]},"Sniper":{breaks:[2,3,4,5],units:["Ezreal","Gnar","Samira","Xayah","Jhin"]},"Vanguard":{breaks:[2,4,6],units:["Leona","Nasus","Mordekaiser","Illaoi","Nunu","Blitzcrank"]},"Voyager":{breaks:[2,3,4,5,6],units:["Meepsie","Pyke","Aurora","Karma","The Mighty Mech"]}};
const CHAMP_TRAITS={};
for(const [t,i] of Object.entries(TRAITS)) for(const u of i.units){const s=champSlug(u);(CHAMP_TRAITS[s]=CHAMP_TRAITS[s]||[]).push(t);}
const emblemTrait=n=>{const m=n.match(/^(.*)\s+Emblem$/i);if(!m)return null;const t=m[1].trim();if(/^nova$/i.test(t))return"N.O.V.A.";if(/^astronaut$/i.test(t))return"Meeple";return Object.keys(TRAITS).find(x=>x.toLowerCase()===t.toLowerCase())||null;};
function activeTraits(units,named){
  const tally={};
  for(const u of units){for(const t of(CHAMP_TRAITS[u.slug]||[]))tally[t]=(tally[t]||0)+1;for(const it of u.items){const e=emblemTrait(it.name);if(e)tally[e]=(tally[e]||0)+1;}}
  const out=[];
  for(const [t,c] of Object.entries(tally)){const b=TRAITS[t].breaks;if(c>=b[0]){let tier=0;b.forEach((x,i)=>{if(c>=x)tier=i+1;});out.push({n:t,key:traitKey(t),c,tier,tiers:b.length});}}
  out.sort((a,b)=>b.c-a.c||a.n.localeCompare(b.n));
  return out.filter(t=>t.c>=2||named.includes(t.n)).slice(0,9);
}
const parseStyle=s=>{const t=(s||'').toLowerCase();const roll=/fast/.test(t)?"fast":"slow";const lvl=(s.match(/\((\d)\)/)||s.match(/(\d)/)||[])[1];return{roll,level:lvl?+lvl:(roll==="fast"?8:6),type:s||"Slow Roll"};};
const starLevel=(u,r)=>r==="slow"?(u.carry&&u.cost<=3?3:u.carry&&u.cost===4?2:u.carry?1:u.cost<=3?2:1):(u.carry?2:u.cost<=2?2:1);
function augFor(named,roll,carries){const t0=named[0]||"Trait",t1=named[1]||t0;const items=carries.flatMap(c=>c.items.map(i=>i.name)).join(" ");const ad=/Deathblade|Infinity Edge|Last Whisper|Kraken|Guinsoo|Bloodthirster|Titan's|Sterak|Red Buff|Giant Slayer|Quicksilver|Crownguard/.test(items);const ap=/Rabadon|Void Staff|Jeweled|Blue Buff|Nashor|Hextech|Morellonomicon|Archangel|Spear of Shojin|Ionic|Striker/.test(items);const p2=roll==="fast"?"Level Up! III":"Pandora's Items III";const g=ad?"Glass Cannon II":(ap?"Ascending II":"Combat Caster II");return[{n:`${t0} Crown`,r:"Prismatic"},{n:p2,r:"Prismatic"},{n:`${t1} Crest`,r:"Gold"},{n:g,r:"Gold"},{n:`${t0} Heart`,r:"Silver"}];}
const namedFromName=(name,active)=>{const hit=Object.keys(TRAITS).filter(t=>name.toLowerCase().includes(t.toLowerCase().replace(/\./g,''))||name.toLowerCase().includes(t.toLowerCase()));return hit.length?hit.slice(0,2):active.slice(0,2).map(t=>t.n);};

/* ---------------- Scraping ---------------- */
async function scrape(dump){
  const res = await fetch(URL,{headers:{'user-agent':'Mozilla/5.0'}});
  const html = await res.text();
  if(dump){ writeFileSync('tftactics-raw.html', html); console.log('Rohdaten -> tftactics-raw.html'); }
  const $ = cheerio.load(html);

  // Comp-Karten = jeweils der nächste Vorfahre einer Champion-Verlinkung, der "Copy Team Code" enthält
  const cards = new Map();
  $('a[href*="/champions/"]').each((_,a)=>{
    let el=a;
    while(el && el.parent){ el=el.parent; if($(el).find('img[alt="Copy Team Code"]').length){ break; } }
    if(!el) return;
    if(!cards.has(el)) cards.set(el,[]);
    cards.get(el).push(a);
  });

  const TIER=/^[SABC]$/;
  const STYLE=/(Fast 8\/9|Fast 8|Fast 9|Slow Roll \(\d\)|Standard)/;
  const raw=[];
  for(const [card,anchors] of cards){
    const $c=$(card);
    // Header-Text der Karte (ohne die Champion-Links)
    const head=$c.clone(); head.find('a[href*="/champions/"]').remove();
    const txt=head.text().replace(/\s+/g,' ').trim();
    const tier=/[SABC]/.test(txt.charAt(0))?txt.charAt(0):'A';   // Tier klebt am Namen -> erstes Zeichen
    const style=(txt.match(STYLE)||[])[1]||'';
    // Name = Text zwischen Tier und Stil
    let name=txt;
    const mi=txt.search(STYLE); if(mi>0) name=txt.slice(0,mi);
    name=name.replace(/^[SABC]\s*/,'').replace(/\b(Emblem|Augment)\b/g,'').trim();

    const units=[];
    anchors.forEach(a=>{
      const href=$(a).attr('href')||'';
      const slug=(href.match(/champions\/([^/]+)/)||[])[1]; if(!slug) return;
      const cn=nameFromSlug(slug);
      const items=[];
      $(a).find('img[alt]').each((_,img)=>{const alt=$(img).attr('alt');if(alt&&KNOWN_ITEMS.has(alt))items.push(alt);});
      units.push([cn,items]);
    });
    if(units.length>=4) raw.push([tier,name,style,units]);
  }
  return raw;
}

const AUG_B='https://ap.tft.tools/img/augments/';
const AUG={"Level Up!":["6MaxLevel103","Prismatic"],"Pandora's Items III":["9PandorasRadiantBox3","Prismatic"],"Glass Cannon II":["GlassCannonII2","Gold"],"Cybernetic Uplink":["6CyberneticUplink22","Gold"],"Cybernetic Implants":["6CyberneticImplants22","Gold"],"Sunfire Board":["6SunfireBoard2","Gold"],"Big Grab Bag":["9BigGrabBag2","Gold"],"Ascension":["9Commander_Ascension2","Gold"],"Portable Forge":["6PortableForge2","Gold"],"Glass Cannon I":["GlassCannonI1","Silver"],"Carve a Path":["ComponentQuestSword1","Silver"],"Continuous Conjuration":["ComponentQuestRod1","Silver"],"Backup Bows":["ComponentQuestBow1","Silver"],"Extra Buckles":["ComponentQuestBelt1","Silver"],"Tiny Titans":["6TinyTitans1","Silver"],"Pandora's Items":["6PandorasItems1","Silver"],"Recombobulator":["6Recombobulator1","Silver"],"Bonk!":["17NasusCarry1","Silver"],"Contract Killer":["17PykeCarry2","Gold"],"Reach for the Stars":["17JaxCarry2","Gold"],"Self Destruct":["17GragasCarry2","Gold"]};
const HERO={"Bonk!":1,"Contract Killer":1,"Reach for the Stars":1,"Self Destruct":1};
const A_AP=/Rabadon|Void Staff|Jeweled|Blue Buff|Nashor|Hextech|Morellonomicon|Archangel|Ionic|Crownguard/, A_AD=/Deathblade|Infinity Edge|Last Whisper|Kraken|Guinsoo|Bloodthirster|Titan's|Sterak|Red Buff|Giant Slayer|Quicksilver|Striker/;
function dmgType(carries){const main=(carries[0]?carries[0].items:[]).map(i=>i.name).join(' ');const all=carries.flatMap(x=>x.items.map(i=>i.name)).join(' ');if(A_AP.test(main))return'ap';if(A_AD.test(main))return'ad';if(A_AP.test(all))return'ap';if(A_AD.test(all))return'ad';return'tank';}
function pickAug(name,roll,carries){const dmg=dmgType(carries),fast=roll==='fast';const wish=[];if(HERO[name])wish.push(name);wish.push(fast?"Level Up!":"Pandora's Items III");wish.push(dmg==='ad'?"Glass Cannon II":dmg==='ap'?"Cybernetic Uplink":"Sunfire Board");wish.push(fast?"Ascension":"Big Grab Bag");wish.push(dmg==='ad'?"Carve a Path":dmg==='ap'?"Continuous Conjuration":"Extra Buckles");wish.push("Tiny Titans","Pandora's Items","Recombobulator");const seen=new Set(),out=[];for(const n of wish){if(out.length>=5)break;if(!seen.has(n)&&AUG[n]){seen.add(n);out.push({n,r:AUG[n][1],icon:AUG_B+AUG[n][0]+".png"});}}return out;}

function toComp([tier,name,style,units]){
  const st=parseStyle(style);
  const U=units.map(([n,items])=>{const u={name:n,slug:champSlug(n),cost:cost(n),carry:items.length>=2,items:items.map(mkItem)};u.star=starLevel(u,st.roll);return u;});
  const carries=U.filter(u=>u.carry).slice(0,3).map(u=>({name:u.name,slug:u.slug,cost:u.cost,star:u.star,role:(u.cost>=4?"Haupt-Carry":"Reroll-Carry"),items:u.items.slice(0,3)}));
  const active=activeTraits(U,[]);
  const named=namedFromName(name,active);
  const traits=activeTraits(U,named);
  const cc={}; carries.forEach(cy=>cy.items.forEach(it=>(it.comp||[]).forEach(c=>cc[c.name]=(cc[c.name]||0)+1)));
  const carousel=Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n])=>n).join(' → ');
  return {name,alias:name,tier,roll:st.roll,
    playstyle:{type:st.type,level:st.level,desc:`${named.join(" · ")} — ${carries.map(c=>c.name).join(" & ")||"Flex"}.`},
    traits,units:U,carries,augments:pickAug(name,st.roll,carries),
    econ:{streak:st.roll==="fast"?"win":"flex",gold:st.roll==="fast"?"Econ auf >50 Gold halten, dann leveln/rollen.":`Auf Level ${st.level} slow-rollen (~50 Gold), Carries zuerst hoch-sternen.`,note:st.roll==="fast"?"Win-Streak anstreben, HP über >50 Gold Zinsen sparen und über Level-Timings pushen.":"Flexibel Win-/Loss-Streak; HP als Ressource für den Slow-Roll nutzen."},
    when:`${named[0]}-Opener bzw. passende Items für ${carries.map(c=>c.name).join(" / ")||"die Carries"}.`,carousel:""};
}

const RANK={S:0,A:1,B:2,C:3};
(async()=>{
  const dump=process.argv.includes('--dump');
  const raw=await scrape(dump);
  if(raw.length<5) throw new Error(`Nur ${raw.length} Comps erkannt – Seitenaufbau evtl. geändert. Mit --dump prüfen (tftactics-raw.html).`);
  const comps=raw.map(toComp).sort((a,b)=>(RANK[a.tier]??9)-(RANK[b.tier]??9)).slice(0,30);
  const body='window.TFT_META='+JSON.stringify({set:17,patch:"auto",updated:new Date().toISOString().slice(0,10),source:"tftactics.gg"})+';\nwindow.TFT_COMPS='+JSON.stringify(comps)+';\n';
  writeFileSync('comps.js',body);
  console.log(`comps.js geschrieben – ${comps.length} Comps (${comps.map(c=>c.tier).join('')}).`);
})().catch(e=>{console.error('Fehler:',e.message);process.exit(1);});
