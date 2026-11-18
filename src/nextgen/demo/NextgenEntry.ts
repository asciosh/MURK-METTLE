import { SimpleDemo } from './SimpleDemo';
import { validateRoomCode } from '../core/RoomIntent';

export async function mountPlayable() {
  const demo = new SimpleDemo(true);
  try {
    await demo.mount();
    Object.assign(window,{__m01Demo:demo,__m01DemoLoaded:true});
    window.addEventListener('beforeunload',()=>demo.dispose(),{once:true});
  } catch(err){demo.dispose();throw err;}
}

/** A dedicated NEXTGEN entry, without legacy boot or legacy progress writes. */
export function mountLobby(roomCode = '') {
  const ui = document.createElement('main'); ui.id='nextgen-lobby';
  ui.style.cssText='position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:rgba(12,22,17,.36);color:#e9eddd;font:16px system-ui;padding:24px;box-sizing:border-box;overflow:auto';
  const panel=document.createElement('section'); panel.style.cssText='width:min(100%,470px);padding:30px;background:#111c18e8;border:1px solid #6f8564;border-radius:12px;box-sizing:border-box;display:grid;gap:14px';
  const title=document.createElement('h1'); title.textContent='MURK & METTLE 2.0'; title.style.cssText='font-size:30px;margin:0;letter-spacing:1px';
  const subtitle=document.createElement('p');subtitle.textContent='NEXTGEN · Survival expedition';subtitle.style.cssText='color:#bfcfae;margin:0';
  const solo=document.createElement('a');solo.href='/?nextgen=playable';solo.textContent='Enter solo prototype';solo.style.cssText='padding:14px;background:#364e37;color:white;text-decoration:none;border-radius:6px;font-weight:bold';
  const form=document.createElement('form'); form.style.cssText='display:grid;gap:10px';
  const room=document.createElement('input');room.name='room';room.placeholder='Room code (3–12 characters)';room.value=validateRoomCode(roomCode)??'BLOOM';room.required=true;room.maxLength=12;room.autocomplete='off';
  const username=document.createElement('input');username.name='username';username.placeholder='Account username';username.autocomplete='username';username.maxLength=20;
  const pin=document.createElement('input');pin.name='pin';pin.placeholder='Account PIN (6–8 digits)';pin.type='password';pin.inputMode='numeric';pin.autocomplete='current-password';pin.maxLength=8;
  for(const input of [room,username,pin])input.style.cssText='padding:12px;background:#1d2b22;border:1px solid #667b5e;border-radius:5px;color:#e9eddd;font:inherit;width:100%;box-sizing:border-box';
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Checking cloud account…';status.style.cssText='margin:0;color:#c5d6be;min-height:24px';
  const button=(label:string)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:12px;background:#91ad75;color:#142116;border:0;border-radius:5px;font:inherit;font-weight:bold;cursor:pointer';return b;};
  const join=button('Sign in & enter room'), register=button('Register & enter room');register.style.background='#687c5d';
  let authenticated=false,busy=false;
  const validRoom=()=>validateRoomCode(room.value);
  const enter=()=>{const code=validRoom();if(!code){status.textContent='Use 3–12 letters or numbers for the room.';return;}location.assign('/?nextgenRoom='+encodeURIComponent(code));};
  const setAccount=(name:string)=>{authenticated=true;username.hidden=pin.hidden=register.hidden=true;join.textContent='Enter co-op room';status.textContent=`Signed in as @${name}`;};
  const auth=async(kind:'login'|'register')=>{
    if(busy)return;if(authenticated){enter();return;}
    if(!validRoom()){status.textContent='Invalid room code.';return;}
    const name=username.value.trim().toLowerCase();if(!/^[a-z0-9_]{3,20}$/.test(name)||!/^\d{6,8}$/.test(pin.value)){status.textContent='Use a valid username and a 6–8 digit PIN.';return;}
    busy=true;join.disabled=register.disabled=true;
    try{const response=await fetch(`/api/account/${kind}?username=${encodeURIComponent(name)}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin.value})});const data=await response.json();if(!response.ok)throw Error(data.error??'Account sign-in failed.');pin.value='';setAccount(data.username??name);enter();}
    catch(e){status.textContent=e instanceof Error?e.message:'Account service unavailable.';}
    finally{busy=false;join.disabled=register.disabled=false;}
  };
  join.onclick=()=>void auth('login');register.onclick=()=>void auth('register');form.onsubmit=e=>{e.preventDefault();void auth('login');};
  form.append(room,username,pin,join,register,status);panel.append(title,subtitle,solo,form);ui.append(panel);document.body.replaceChildren(ui);
  const backdrop=new SimpleDemo(false);
  void backdrop.mount().catch(error=>{backdrop.dispose();console.warn('NEXTGEN lobby background unavailable',error);});
  window.addEventListener('beforeunload',()=>backdrop.dispose(),{once:true});
  void fetch('/api/account/me',{credentials:'same-origin',cache:'no-store'}).then(async response=>{if(response.ok){const data=await response.json();if(data.username){setAccount(data.username);return;}}status.textContent='Sign in to join a room with friends.';}).catch(()=>{status.textContent='Co-op requires the local Cloudflare Worker (port 8787).';});
}
