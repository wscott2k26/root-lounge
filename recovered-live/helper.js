'use strict';
(() => {
  function ready(){return typeof window.state!=='undefined'||typeof state!=='undefined';}

  function patchShellCopy(){
    document.title='Root Lounge';
    const meta=document.querySelector('meta[name="description"]');
    if(meta)meta.content='Root Lounge — a decompression workspace for SysAdmins, SREs, developers, and IT teams.';
    const guiFunding=document.querySelector('#gui-view-funding .gui-intro p');
    if(guiFunding)guiFunding.textContent='The $3 support contribution and $49/month Corporate subscription use live Stripe-hosted checkout. Physical merch stays paused until fulfillment is connected.';
    const consoleFunding=document.querySelector('#view-funding .section-heading p');
    if(consoleFunding)consoleFunding.textContent='Live Stripe-hosted support and Corporate checkout. Physical merch stays paused until fulfillment is connected.';
  }

  function addCard(){
    if(document.getElementById('guiCorporateSetupCard'))return;
    const grid=document.querySelector('#gui-view-settings .gui-settings-grid');
    if(!grid)return;

    const card=document.createElement('article');
    card.id='guiCorporateSetupCard';
    card.className='gui-settings-card';

    const title=document.createElement('h4');
    title.textContent='Corporate workspace';
    const copy=document.createElement('p');
    copy.id='guiCorporateAccessCopy';
    const button=document.createElement('button');
    button.id='guiCorporateAccessButton';
    button.type='button';
    button.className='gui-secondary';

    card.append(title,copy,button);
    grid.append(card);

    function refresh(){
      const active=ready()&&state.session?.backend==='supabase'&&/^[0-9a-f-]{36}$/i.test(String(state.config?.corporateOrgId||''));
      if(active){
        copy.textContent='Your active Root Lounge Corporate subscription has provisioned a private organization workspace.';
        button.textContent='Corporate Workspace Ready';
        button.disabled=true;
      }else{
        copy.textContent='Corporate workspaces are provisioned automatically after an active $49/month Root Lounge Corporate subscription.';
        button.textContent='View Corporate Plan';
        button.disabled=false;
      }
    }

    button.addEventListener('click',()=>{
      if(button.disabled)return;
      try{if(typeof setInterfaceMode==='function')setInterfaceMode('gui');}catch{}
      try{if(typeof setGuiView==='function')setGuiView('funding');}catch{}
    });

    refresh();
    setTimeout(refresh,900);
    setTimeout(refresh,2200);
  }

  function loadOnboarding(){
    if(document.querySelector('script[data-root-lounge-onboarding]'))return;
    const script=document.createElement('script');
    script.src='/recovered-live/onboarding.js';
    script.dataset.rootLoungeOnboarding='true';
    document.body.append(script);
  }

  function loadSocial(){
    if(!document.querySelector('link[data-root-lounge-social]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/recovered-live/social.css';
      link.dataset.rootLoungeSocial='true';
      document.head.append(link);
    }
    if(document.querySelector('script[data-root-lounge-social]'))return;
    const script=document.createElement('script');
    script.src='/recovered-live/social.js';
    script.dataset.rootLoungeSocial='true';
    document.body.append(script);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    patchShellCopy();
    addCard();
    loadOnboarding();
    loadSocial();
    setTimeout(addCard,1200);
  });
})();
