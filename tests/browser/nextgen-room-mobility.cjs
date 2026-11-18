// NEXTGEN-only server-owned jump/dodge smoke. Never sends arbitrary client movement coordinates.
const assert=require('node:assert/strict');
const {launchBrowser}=require('./support.cjs');
(async()=>{
  const base=new URL(process.env.GAME_URL||'http://localhost:8787');
  if(!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Loopback only');
  const suffix=Date.now().toString(36).slice(-8),room=`M${suffix}`.toUpperCase();
  const browser=await launchBrowser();
  try{
    const ctx=await browser.newContext();
    const login=await ctx.request.post(new URL(`/api/account/register?username=mm_${suffix}`,base).href,{headers:{Origin:base.origin},data:{pin:'482716'}});
    assert.ok(login.ok(),`Local account registration: ${login.status()}`);
    const page=await ctx.newPage();
    await page.addInitScript(()=>{
      const Native=window.WebSocket;
      window.WebSocket=class extends Native {
        constructor(...args){
          super(...args);
          if(new URL(args[0],location.href).pathname==='/room') {
            window.__testRoomSocket=this;
            window.__mobilityPackets=[];
            this.addEventListener('message', event=>{
              try {const packet=JSON.parse(event.data); if(packet.type==='snapshot'&&packet.players?.length)window.__mobilityPackets.push(packet.players[0]?.nextgen||{});}catch{}
              if(window.__mobilityPackets.length>300)window.__mobilityPackets.shift();
            });
          }
        }
      };
    });
    await page.goto(new URL(`/?nextgenRoom=${room}&quality=low`,base).href);
    const wait={timeout:60000,polling:100};
    await page.waitForFunction(()=>window.__nextgenRoom?.getRoomInfo()?.self?.nextgen&&window.__testRoomSocket?.readyState===1,null,wait);
    // Test the authoritative room protocol. UI keys must also be checked manually.
    await page.evaluate(()=>window.__testRoomSocket.send(JSON.stringify({type:'nextgen-jump'})));
    await page.waitForFunction(()=>window.__mobilityPackets.some(packet=>packet.airborne&&packet.jumpHeight>0),null,wait);
    await page.waitForTimeout(900);
    const before=await page.evaluate(()=>window.__nextgenRoom.getRoomInfo().self);
    if(before.hp<=0){await page.evaluate(()=>window.__testRoomSocket.send(JSON.stringify({type:'restart'})));await page.waitForFunction(()=>window.__nextgenRoom.getRoomInfo().self.hp>0,null,wait);}
    const state=await page.evaluate(()=>window.__nextgenRoom.getRoomInfo().self);
    await page.evaluate(()=>window.__testRoomSocket.send(JSON.stringify({type:'nextgen-dodge',x:0,z:-1})));
    await page.waitForFunction(before=>{
      const actor=window.__nextgenRoom.getRoomInfo().self;
      return actor?.survival?.stamina<=before.stamina-25 && actor.z<before.z-0.1;
    },{stamina:state.survival.stamina,z:state.z},wait);
    assert.ok(await page.evaluate(()=>window.__mobilityPackets.some(packet=>packet.dodging)));
    console.log('NEXTGEN MOBILITY: server-owned jump, dodge movement and 25-stamina cost confirmed. Manual control feel remains pending.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
