function switchView(view){state.view=view;document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));document.querySelectorAll('#tabs button').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));appendLog(`Workspace view: ${view.toUpperCase()}`,'muted');}
function applyTheme(theme){if(!['emerald','amber','purple','blue'].includes(theme))return;state.theme=theme;document.body.dataset.theme=theme;RL$('themeSelector').value=theme;localStorage.setItem(`${APP_KEY}:theme`,theme);appendLog(`Theme switched: ${theme.toUpperCase()}`,'success');}
function setMode(mode){if(!['community','corporate'].includes(mode)||mode===state.mode)return;state.mode=mode;RL$('communityMode').classList.toggle('active',mode==='community');RL$('corporateMode').classList.toggle('active',mode==='corporate');loadWorkspace().catch(showDataError);appendLog(`Workspace mode: ${mode.toUpperCase()}`,'success');}
function mapIncident(row){return{id:String(row.display_id||row.id),databaseId:String(row.id),title:String(row.title||''),severity:String(row.severity||'Venting'),createdAt:String(row.created_at||new Date().toISOString()),supportCount:Number(row.support_count||0),mode:String(row.workspace_mode||'community'),organizationId:row.organization_id||null};}
function mapMessage(row){return{id:String(row.id),sender:String(row.sender||'anonymous_operator'),text:String(row.body||''),createdAt:String(row.created_at||new Date().toISOString()),mode:String(row.workspace_mode||'community'),organizationId:row.organization_id||null};}
async function loadWorkspace(){
  updateBackendUI();const localOnly=state.session.backend!=='supabase'||(state.mode==='corporate'&&!state.config.corporateOrgId);
  if(localOnly){state.metrics=readLocal('metrics',DEFAULT_METRICS);state.incidents=readLocal('incidents',state.mode==='community'?DEFAULT_INCIDENTS:[]);state.messages=readLocal('messages',state.mode==='community'?DEFAULT_MESSAGES:[]);renderAll();return;}
  const c=state.client;let iq=c.from('incidents').select('id,display_id,title,severity,support_count,created_at,workspace_mode,organization_id').eq('workspace_mode',state.mode).eq('status','published').order('created_at',{ascending:false}).limit(50);let mq=c.from('chat_messages').select('id,sender,body,created_at,workspace_mode,organization_id').eq('workspace_mode',state.mode).order('created_at',{ascending:true}).limit(50);if(state.mode==='corporate'){iq=iq.eq('organization_id',state.config.corporateOrgId);mq=mq.eq('organization_id',state.config.corporateOrgId);}
  const [metrics,incidents,messages]=await Promise.all([c.from('user_metrics').select('sanity,caffeine,sleep,hydration').eq('user_id',state.session.userId).maybeSingle(),iq,mq]);if(metrics.error)throw metrics.error;if(incidents.error)throw incidents.error;if(messages.error)throw messages.error;
  state.metrics=metrics.data||{...DEFAULT_METRICS};state.incidents=(incidents.data||[]).map(mapIncident);state.messages=(messages.data||[]).map(mapMessage);if(!metrics.data)await c.from('user_metrics').upsert({user_id:state.session.userId,...DEFAULT_METRICS});renderAll();subscribeRealtime();
}
function renderAll(){renderMetrics();renderIncidents();renderMessages();updateBackendUI();}
async function persistMetrics(){
  if(state.session.backend!=='supabase'||(state.mode==='corporate'&&!state.config.corporateOrgId)){writeLocal('metrics',state.metrics);return;}
  const {error}=await state.client.from('user_metrics').upsert({user_id:state.session.userId,...state.metrics});if(error)throw error;
}
async function submitIncident(text){
  const result=moderate(text);RL$('incidentError').textContent=result.reason||'';if(!result.allowed){if(result.crisis)openCrisis();return;}
  const incident={id:`INC-${Math.floor(1000+Math.random()*9000)}`,title:result.text,severity:'Venting',createdAt:new Date().toISOString(),supportCount:0,mode:state.mode,organizationId:state.mode==='corporate'?state.config.corporateOrgId||null:null};
  if(state.session.backend!=='supabase'||(state.mode==='corporate'&&!state.config.corporateOrgId)){state.incidents=[incident,...state.incidents].slice(0,100);writeLocal('incidents',state.incidents);}else{const {data,error}=await state.client.from('incidents').insert({user_id:state.session.userId,display_id:incident.id,title:incident.title,severity:'Venting',workspace_mode:state.mode,organization_id:incident.organizationId,status:'published'}).select('id,display_id,title,severity,support_count,created_at,workspace_mode,organization_id').single();if(error)throw error;state.incidents=[mapIncident(data),...state.incidents];}
  state.metrics.sanity=clamp(state.metrics.sanity+8);await persistMetrics();renderMetrics();renderIncidents();appendLog(`Vent logged as ${incident.id}. Pressure released.`,'success');RL$('incidentInput').value='';
}
async function supportIncident(item){
  try{if(state.session.backend!=='supabase'||(state.mode==='corporate'&&!state.config.corporateOrgId)){item.supportCount=(item.supportCount||0)+1;writeLocal('incidents',state.incidents);}else{const {data,error}=await state.client.rpc('support_incident',{target_incident_id:item.databaseId});if(error)throw error;item.supportCount=Number(data||item.supportCount+1);}state.metrics.sanity=clamp(state.metrics.sanity+2);await persistMetrics();renderIncidents();renderMetrics();appendLog(`Support patch injected: ${item.id}`,'success');}catch(error){showDataError(error);}
}
async function submitMessage(text){
  const result=moderate(text);RL$('chatError').textContent=result.reason||'';if(!result.allowed){if(result.crisis)openCrisis();return;}
  let msg={id:crypto.randomUUID(),sender:state.session.handle,text:result.text,createdAt:new Date().toISOString(),mode:state.mode,organizationId:state.mode==='corporate'?state.config.corporateOrgId||null:null};
  if(state.session.backend!=='supabase'||(state.mode==='corporate'&&!state.config.corporateOrgId)){state.messages=[...state.messages,msg].slice(-100);writeLocal('messages',state.messages);}else{const {data,error}=await state.client.from('chat_messages').insert({id:msg.id,user_id:state.session.userId,organization_id:msg.organizationId,workspace_mode:state.mode,sender:state.session.handle,body:msg.text}).select('id,sender,body,created_at,workspace_mode,organization_id').single();if(error)throw error;msg=mapMessage(data);state.messages=[...state.messages,msg].slice(-100);}
  renderMessages();RL$('chatInput').value='';appendLog('Recovery-room message sent.','success');
}
function subscribeRealtime(){
  if(state.realtime){state.client.removeChannel(state.realtime);state.realtime=null;}if(state.session.backend!=='supabase')return;
  state.realtime=state.client.channel(`root-lounge-${state.mode}-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'incidents',filter:`workspace_mode=eq.${state.mode}`},()=>loadWorkspace().catch(()=>{})).on('postgres_changes',{event:'*',schema:'public',table:'chat_messages',filter:`workspace_mode=eq.${state.mode}`},()=>loadWorkspace().catch(()=>{})).subscribe();
}
function showDataError(error){console.error(error);setNotice('Backend request failed. Uptime Lounge kept the current screen intact; check Supabase configuration and policies.');appendLog('Backend request failed; current data preserved.','error');}
function simulateSSH(host){appendLog(`SIMULATION ONLY: opening mock SSH session to ${host}…`,'warn');setTimeout(()=>{state.sshHost=host;RL$('terminalPrompt').textContent=`root@${host}:~#`;RL$('terminalTitle').textContent=`ssh simulation — root@${host}`;appendLog(`Mock session active for ${host}. No network connection was made. Type "exit" to return.`,'success');},400);}
function runCommand(raw){
  const normalized=normalize(raw);if(!normalized)return;const prompt=state.sshHost?`root@${state.sshHost}:~#`:'guest@root-lounge:~#';appendLog(`${prompt} ${normalized}`,'user');const lower=normalized.toLowerCase();const [command,...args]=lower.split(' ');
  if(state.sshHost&&command!=='exit'){appendLog(`[${state.sshHost}] simulation completed with exit code 0. No command was executed.`,'muted');return;}
  switch(command){
    case'help':['help — command list','status — operator telemetry','vent <message> — moderated incident post','theme emerald|amber|purple|blue','mode community|corporate','ls /view','cd /view/<name>','ssh <host> — local simulation only','hydrate — add hydration','fortune — operator wisdom','merch — open funding view','sudo rm -rf /mgmt — recovery joke','clear — clear terminal'].forEach((line,i)=>appendLog(line,i?'system':'accent'));break;
    case'clear':RL$('terminalOutput').replaceChildren();break;
    case'status':appendLog(`Sanity ${state.metrics.sanity}% · Caffeine ${state.metrics.caffeine}% · Sleep ${state.metrics.sleep}% · Hydration ${state.metrics.hydration}%`,'success');break;
    case'vent':{const text=normalized.slice(normalized.indexOf(' ')+1);if(!args.length)appendLog('Usage: vent <message>','error');else submitIncident(text).catch(showDataError);break;}
    case'theme':args[0]&&['emerald','amber','purple','blue'].includes(args[0])?applyTheme(args[0]):appendLog('Usage: theme emerald|amber|purple|blue','error');break;
    case'mode':args[0]&&['community','corporate'].includes(args[0])?setMode(args[0]):appendLog('Usage: mode community|corporate','error');break;
    case'ls':appendLog('/view/telemetry  /view/incidents  /view/recovery  /view/wiki  /view/funding','success');break;
    case'cd':{const target=(args[0]||'').split('/').filter(Boolean).pop();if(['telemetry','incidents','recovery','wiki','funding'].includes(target))switchView(target);else appendLog('Path not found. Try ls /view','error');break;}
    case'ssh':args[0]?simulateSSH(args[0]):appendLog('Usage: ssh <hostname>','error');break;
    case'exit':if(state.sshHost){appendLog(`Closed mock session for ${state.sshHost}.`,'warn');state.sshHost=null;RL$('terminalPrompt').textContent='guest@root-lounge:~#';RL$('terminalTitle').textContent='sh — guest@root-lounge';}else appendLog('Baseline shell remains open.','muted');break;
    case'hydrate':patchMetric('hydration',10,'Hydration patch applied.');break;
    case'fortune':appendLog(`🔮 ${FORTUNES[Math.floor(Math.random()*FORTUNES.length)]}`,'accent');break;
    case'merch':switchView('funding');break;
    case'sudo':if(lower==='sudo rm -rf /mgmt')recoveryMacro();else appendLog('Unauthorized sudo usage. This will be reported to absolutely nobody.','error');break;
    default:appendLog(`command not found: ${command}. Type "help".`,'error');
  }
}
