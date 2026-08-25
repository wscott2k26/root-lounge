'use strict';
(() => {
  const key='root-lounge-live-v2.1:corporate-org-id';
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function ready(){return typeof window.state!=='undefined'||typeof state!=='undefined';}
  function addCard(){
    if(document.getElementById('guiCorporateSetupCard'))return;
    const grid=document.querySelector('#gui-view-settings .gui-settings-grid');if(!grid)return;
    const card=document.createElement('article');card.id='guiCorporateSetupCard';card.className='gui-settings-card';
    card.innerHTML='<h4>Corporate workspace</h4><p>Create a private organization-scoped workspace for this browser session.</p><form id="guiCorporateOrgForm" class="gui-inline-form"><input id="guiCorporateOrgName" maxlength="80" value="Root Lounge Corporate" placeholder="Organization name"><button id="guiCreateOrg">Create Workspace</button></form><p id="guiOrgMessage" class="form-message"></p>';
    grid.append(card);
    const saved=localStorage.getItem(key)||'';
    if(uuid.test(saved)&&ready()){state.config.corporateOrgId=saved;const b=document.getElementById('guiCreateOrg');b.disabled=true;b.textContent='Workspace Ready';if(typeof renderGuiBackend==='function')renderGuiBackend();}
    document.getElementById('guiCorporateOrgForm').addEventListener('submit',async e=>{
      e.preventDefault();const msg=document.getElementById('guiOrgMessage');const button=document.getElementById('guiCreateOrg');
      try{
        if(!ready()||state.session?.backend!=='supabase'||!state.client)throw new Error('Supabase session is still starting. Try again in a moment.');
        if(state.config.corporateOrgId){msg.textContent='Corporate workspace is already configured.';return;}
        const name=String(document.getElementById('guiCorporateOrgName').value||'Root Lounge Corporate').replace(/\s+/g,' ').trim().slice(0,80);
        button.disabled=true;msg.textContent='Creating private workspace…';
        const {data,error}=await state.client.rpc('create_organization',{org_name:name||'Root Lounge Corporate'});if(error)throw error;
        const id=String(data||'');if(!uuid.test(id))throw new Error('Supabase did not return a valid workspace ID.');
        localStorage.setItem(key,id);state.config.corporateOrgId=id;button.textContent='Workspace Ready';msg.textContent='Corporate workspace created and connected to this browser.';
        if(typeof renderGuiBackend==='function')renderGuiBackend();if(typeof setMode==='function')setMode('corporate');
      }catch(error){button.disabled=false;msg.textContent=error?.message||'Unable to create the workspace.';}
    });
  }
  window.addEventListener('DOMContentLoaded',()=>{addCard();setTimeout(addCard,1200);});
})();
