const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
const url=(process.env.GAME_URL||'http://localhost:5174')+'/tests/browser/nextgen.html?mode=playable';
(async()=>{
 const browser=await launchBrowser();const errors=[];
 try{
  const pairs=[['ranger','withered'],['medic','ashen'],['scavenger','ravager'],['sentinel','feral']];
  for(const [skin,infected] of pairs){
   const page=await browser.newPage({viewport:{width:1280,height:720}});
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(url+'&training=1&skin='+skin+'&infected='+infected);
   await page.waitForFunction(({skin,infected})=>{
    const d=window.__m01Demo,p=d?.getPlayerModelInfo(),e=d?.getInfectedInfo()?.[0];
    return p?.status==='ready'&&p.variant===skin&&p.clips.includes('Pickup')&&p.skinned&&p.weaponAttached&&e?.status==='ready'&&e.variant===infected&&e.skinned;
   },{skin,infected},{timeout:90000});
   await page.evaluate(()=>window.__m01Demo.dispose());await page.close();console.log(skin+' / '+infected+': PASS');
  }
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url+'&skin=ranger&infected=mixed&benchmark=1');
  await page.waitForFunction(()=>{const e=window.__m01Demo?.getInfectedInfo()??[];return e.length>=3&&e.every(x=>x.status==='ready')&&new Set(e.map(x=>x.variant)).size>=3;},undefined,{timeout:90000});
  await page.evaluate(()=>window.__m01Demo.dispose());await page.close();assert.deepEqual(errors,[]);console.log('Mixed horde: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
