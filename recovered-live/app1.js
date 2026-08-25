'use strict';
const RL$=(id)=>document.getElementById(id);
const APP_KEY='root-lounge-live-v2.1';
const DEFAULT_METRICS={sanity:42,caffeine:78,sleep:55,hydration:90};
const DEFAULT_INCIDENTS=[
  {id:'INC-702',title:'A hotfix landed directly on the production branch without an engineering heads-up.',severity:'Critical',createdAt:new Date(Date.now()-4*60000).toISOString(),supportCount:2,mode:'community'},
  {id:'INC-409',title:'Datacenter climate alerts triggered an automatic shutdown sequence.',severity:'Warning',createdAt:new Date(Date.now()-45*60000).toISOString(),supportCount:4,mode:'community'},
  {id:'INC-112',title:'Executive chat requests bypassed the support queue all afternoon.',severity:'Venting',createdAt:new Date(Date.now()-2*3600000).toISOString(),supportCount:9,mode:'community'}
];
const DEFAULT_MESSAGES=[
  {id:crypto.randomUUID(),sender:'nginx_ghost',text:'Staging telemetry is dropping handshakes. Anybody else seeing gaps?',createdAt:new Date(Date.now()-8*60000).toISOString(),mode:'community'},
  {id:crypto.randomUUID(),sender:'yaml_guru',text:'One indentation error took six hours from me. YAML remains undefeated.',createdAt:new Date(Date.now()-5*60000).toISOString(),mode:'community'},
  {id:crypto.randomUUID(),sender:'cron_stalker',text:'Dark roast loaded. Waiting for the cleanup job to finish looping.',createdAt:new Date(Date.now()-4*60000).toISOString(),mode:'community'}
];
const FORTUNES=[
  'A clean log is usually a sign somebody rotated it before the incident review.',
  'Never deploy on Friday unless your weekend has already been sacrificed to the old gods.',
  'A request described as “quick” has already opened three tickets somewhere.',
  'Peace is deleting a legacy service and hearing no alarms afterward.',
  'Somewhere, an unmonitored node is quietly filling a disk.'
];
const PRODUCTS=[
  {sku:'caffeine',name:'Caffeine Server Boost',price:'$3',description:'A small contribution toward hosting and maintenance.'},
  {sku:'oom_tee',name:'“OOM: Out of Sanity” Tee',price:'$24',description:'Stealth-black operator humor. Fulfillment must be connected separately.'},
  {sku:'hoodie',name:'Friday Deploy Monkey Hoodie',price:'$48',description:'For the brave souls watching dashboards after 5 PM.'},
  {sku:'cap',name:'sudo rm -rf /mgmt Cap',price:'$18',description:'A joke, not an HR-approved shell command.'}
];
const CONNECTIONS=[
  {name:'prod-db-01',host:'prod-db-cluster-01.net',status:'ok'},
  {name:'stg-k8s-mesh',host:'staging-k8s-ingress.internal',status:'warn'},
  {name:'legacy-main',host:'legacy-auth-mainframe.corp',status:'down'}
];
const state={config:{},client:null,session:null,mode:'community',view:'telemetry',theme:'emerald',metrics:{...DEFAULT_METRICS},incidents:[],messages:[],sshHost:null,lastFocus:null,realtime:null};

function safeHandle(value){const clean=String(value||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,18);return clean||`operator_${Math.floor(1000+Math.random()*9000)}`;}
function localSession(){
  const key=`${APP_KEY}:session`;try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.userId)return saved;}catch{}
  const session={userId:crypto.randomUUID(),handle:`operator_${Math.floor(1000+Math.random()*9000)}`,backend:'local',isAnonymous:true};localStorage.setItem(key,JSON.stringify(session));return session;
}
function storageKey(resource){return `${APP_KEY}:${state.session.userId}:${state.mode}:${resource}`;}
function readLocal(resource,fallback){try{const raw=localStorage.getItem(storageKey(resource));return raw?JSON.parse(raw):structuredClone(fallback);}catch{return structuredClone(fallback);}}
function writeLocal(resource,value){localStorage.setItem(storageKey(resource),JSON.stringify(value));}
function normalize(text){return String(text||'').replace(/\s+/g,' ').trim();}
function moderate(raw,max=500){
  const text=normalize(raw);if(!text)return{allowed:false,text,reason:'Enter a message first.'};if(text.length>max)return{allowed:false,text,reason:`Keep it under ${max} characters.`};
  const secret=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,/\bAKIA[0-9A-Z]{16}\b/,/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,/\bgh[pousr]_[A-Za-z0-9]{20,}\b/,/\bpassword\s*[:=]\s*\S+/i,/\bapi[_ -]?key\s*[:=]\s*\S+/i];
  if(secret.some(r=>r.test(text)))return{allowed:false,text,reason:'That looks like a password, API key, or private credential. Remove it before posting.',secret:true};
  const crisis=[/\bkill myself\b/i,/\bend my life\b/i,/\bwant to die\b/i,/\bdon'?t want to live\b/i,/\bsuicid(?:e|al)\b/i,/\bhurt myself\b/i,/\bself[- ]harm\b/i];
  if(crisis.some(r=>r.test(text)))return{allowed:false,text,reason:'This needs immediate human support rather than a public feed.',crisis:true};
  const threat=[/\bi(?:'m| am) going to kill (?:him|her|them|you)\b/i,/\bi will kill (?:him|her|them|you)\b/i,/\bshoot (?:up|him|her|them|you)\b/i,/\bbomb (?:the|this|their)\b/i];
  if(threat.some(r=>r.test(text)))return{allowed:false,text,reason:'Direct threats cannot be posted. Contact emergency services if anyone is in immediate danger.',threat:true};
  return{allowed:true,text};
}
function formatTime(iso){const date=new Date(iso);const diff=Date.now()-date.getTime();if(diff<60000)return'just now';if(diff<3600000)return`${Math.floor(diff/60000)}m ago`;if(diff<86400000)return`${Math.floor(diff/3600000)}h ago`;return date.toLocaleDateString();}
function clamp(n){return Math.max(0,Math.min(100,Math.round(n)));}
function appendLog(text,type='system'){
  const row=document.createElement('div');row.className=`terminal-line log-${type}`;row.textContent=text;RL$('terminalOutput').append(row);while(RL$('terminalOutput').children.length>160)RL$('terminalOutput').firstElementChild.remove();RL$('terminalOutput').scrollTop=RL$('terminalOutput').scrollHeight;
}
function setNotice(text){RL$('modeNotice').textContent=text;RL$('modeNotice').classList.toggle('visible',Boolean(text));}
function updateBackendUI(){
  const shared=state.session.backend==='supabase';RL$('backendLabel').textContent=shared?'Anonymous Supabase session active; technical provider logs may still exist.':'Private local demo; data stays in this browser and is not shared.';
  RL$('sessionId').textContent=(state.session.userId||'local').slice(0,8).toUpperCase();
  const corporateShared=shared&&Boolean(state.config.corporateOrgId);
  if(state.mode==='corporate')setNotice(corporateShared?'Corporate workspace is organization-scoped through Supabase RLS.':'Corporate mode is private to this browser until a Supabase organization ID is configured.');else setNotice(shared?'Community posts are shared with authenticated anonymous users and protected by database policies.':'Community demo is local only; nothing is broadcast to other users.');
  RL$('incidentScope').textContent=state.mode==='community'?(shared?'Shared anonymous community feed':'Local browser community demo'):(corporateShared?'Private organization feed':'Local corporate draft space');
}
function metricStatus(value){return value<35?['Critical','low']:value<65?['Degraded','mid']:['Nominal',''];}
function renderMetrics(){
  const labels={sanity:['SANITY_INDEX','Self-reported capacity'],caffeine:['CAFFEINE_LEVEL','Stimulant reserve'],sleep:['REM_SLEEP_MATRIX','Rest quality'],hydration:['HYDRATION_CORE','Fluid intake']};const grid=RL$('metricsGrid');grid.replaceChildren();
  Object.entries(state.metrics).forEach(([key,value])=>{const [status,klass]=metricStatus(value);const card=document.createElement('article');card.className='metric';const head=document.createElement('div');head.className='metric-head';const label=document.createElement('span');label.textContent=labels[key][0];const number=document.createElement('strong');number.textContent=`${value}%`;head.append(label,number);const meter=document.createElement('div');meter.className='meter';const fill=document.createElement('span');fill.className=klass;fill.style.width=`${value}%`;meter.append(fill);const foot=document.createElement('div');foot.className='metric-foot';const desc=document.createElement('span');desc.textContent=labels[key][1];const stat=document.createElement('span');stat.textContent=status;foot.append(desc,stat);card.append(head,meter,foot);grid.append(card);});
}
function renderIncidents(){
  const list=RL$('incidentList');list.replaceChildren();if(!state.incidents.length){const empty=document.createElement('p');empty.className='form-message';empty.textContent='No incidents in this workspace yet. A quiet queue—beautiful sight.';list.append(empty);return;}
  state.incidents.forEach(item=>{const card=document.createElement('article');card.className='incident';const badge=document.createElement('span');badge.className=`severity ${String(item.severity).toLowerCase()}`;badge.textContent=item.severity;const body=document.createElement('div');const title=document.createElement('p');title.textContent=item.title;const meta=document.createElement('div');meta.className='incident-meta';const id=document.createElement('strong');id.textContent=item.id;const time=document.createElement('span');time.textContent=formatTime(item.createdAt);const support=document.createElement('button');support.type='button';support.className='support-btn';support.textContent=`Inject support patch (${item.supportCount||0})`;support.addEventListener('click',()=>supportIncident(item));meta.append(id,time,support);body.append(title,meta);card.append(badge,body);list.append(card);});
}
function renderMessages(){
  const list=RL$('chatList');list.replaceChildren();state.messages.forEach(msg=>{const card=document.createElement('article');card.className='chat';const head=document.createElement('div');head.className='chat-head';const sender=document.createElement('strong');sender.textContent=`<${safeHandle(msg.sender)}>`;const time=document.createElement('time');time.dateTime=msg.createdAt;time.textContent=new Date(msg.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});head.append(sender,time);const text=document.createElement('p');text.textContent=msg.text;card.append(head,text);list.append(card);});list.scrollTop=list.scrollHeight;
}
function renderConnections(){const list=RL$('connectionList');list.replaceChildren();CONNECTIONS.forEach(node=>{const button=document.createElement('button');button.type='button';button.className='connection';const strong=document.createElement('strong');const name=document.createElement('span');name.textContent=node.name;const dot=document.createElement('span');dot.className=`node-dot ${node.status==='warn'?'warn':node.status==='down'?'down':''}`;strong.append(name,dot);const host=document.createElement('small');host.textContent=node.host;button.append(strong,host);button.addEventListener('click',()=>simulateSSH(node.host));list.append(button);});}
function renderProducts(){const grid=RL$('productGrid');grid.replaceChildren();PRODUCTS.forEach(product=>{const card=document.createElement('article');card.className='product';const h=document.createElement('h3');h.textContent=product.name;const p=document.createElement('p');p.textContent=product.description;const price=document.createElement('div');price.className='product-price';price.textContent=product.price;const button=document.createElement('button');button.type='button';button.dataset.sku=product.sku;button.textContent=product.sku==='caffeine'?'Contribute':'Open Checkout';button.addEventListener('click',()=>checkout(product.sku));card.append(h,p,price,button);grid.append(card);});}
