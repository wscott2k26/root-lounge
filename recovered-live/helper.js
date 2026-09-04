'use strict';
(() => {
  const PUBLIC_BRAND='Uptime Lounge';
  const BRAND_PATTERN=/Root Lounge|ROOT LOUNGE/g;
  const MERCH_STORE='https://uptime-lounge-shop.fourthwall.com';

  function ready(){return typeof window.state!=='undefined'||typeof state!=='undefined';}
  function replaceBrandText(value=''){return String(value).replace(BRAND_PATTERN,match=>match===match.toUpperCase()?'UPTIME LOUNGE':PUBLIC_BRAND);}

  function loadPremiumStyles(){
    if(document.querySelector('link[data-uptime-premium],link[href="/recovered-live/premium.css"]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/recovered-live/premium.css';
    link.dataset.uptimePremium='true';
    document.head.append(link);
  }

  function patchBrand(root=document){
    document.title=PUBLIC_BRAND;
    const meta=document.querySelector('meta[name="description"]');
    if(meta)meta.content='Uptime Lounge — a decompression workspace for SysAdmins, SREs, developers, and IT teams.';
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(node.parentElement?.closest('script,style'))return;
      const next=replaceBrandText(node.nodeValue||'');
      if(next!==node.nodeValue)node.nodeValue=next;
    });
    root.querySelectorAll?.('[aria-label],[title]').forEach(el=>{
      for(const attr of ['aria-label','title']){
        const current=el.getAttribute(attr);
        if(current&&/Root Lounge|ROOT LOUNGE/.test(current))el.setAttribute(attr,replaceBrandText(current));
      }
    });
  }

  function patchFunding(){
    const config=ready()?state.config||{}:{};
    const merchStore=String(config.merchStoreUrl||MERCH_STORE);
    const intro=document.querySelector('#gui-view-funding .gui-intro p');
    if(intro)intro.textContent='Support Uptime Lounge, unlock Corporate, or shop the live operator merch collection.';
    const consoleIntro=document.querySelector('#view-funding .section-heading p');
    if(consoleIntro)consoleIntro.textContent='Live support, Corporate checkout, and Fourthwall-powered merch fulfillment.';

    const makeSupportCard=()=>{
      const card=document.createElement('article');card.className='product';
      const h=document.createElement('h3');h.textContent='Caffeine Server Boost';
      const p=document.createElement('p');p.textContent='A small contribution toward hosting and maintenance.';
      const price=document.createElement('div');price.className='product-price';price.textContent='$3';
      const button=document.createElement('button');button.type='button';button.textContent='Contribute';
      button.addEventListener('click',()=>{try{if(typeof checkout==='function')checkout('caffeine');}catch{}});
      card.append(h,p,price,button);return card;
    };
    const makeMerchCard=()=>{
      const card=document.createElement('article');card.className='uptime-merch-state uptime-merch-live';
      const copy=document.createElement('div');
      const h=document.createElement('h3');h.textContent='Uptime Lounge First Drop';
      const p=document.createElement('p');p.textContent='Six Fourthwall-fulfilled products are live — premium operator tees, hoodie, bucket hat, mug, and sticker.';
      const a=document.createElement('a');a.href=merchStore;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Shop the First Drop';
      copy.append(h,p);card.append(copy,a);return card;
    };

    for(const id of ['productGrid','guiProductGrid']){
      const grid=document.getElementById(id);if(!grid)continue;
      grid.replaceChildren(makeSupportCard(),makeMerchCard());
    }
  }

  function addCorporateCard(){
    if(document.getElementById('guiCorporateSetupCard'))return;
    const grid=document.querySelector('#gui-view-settings .gui-settings-grid');
    if(!grid)return;
    const card=document.createElement('article');card.id='guiCorporateSetupCard';card.className='gui-settings-card';
    const title=document.createElement('h4');title.textContent='Corporate workspace';
    const copy=document.createElement('p');copy.id='guiCorporateAccessCopy';
    const button=document.createElement('button');button.id='guiCorporateAccessButton';button.type='button';button.className='gui-secondary';
    card.append(title,copy,button);grid.append(card);
    function refresh(){
      const active=ready()&&state.session?.backend==='supabase'&&/^[0-9a-f-]{36}$/i.test(String(state.config?.corporateOrgId||''));
      if(active){copy.textContent='Your active Uptime Lounge Corporate subscription has provisioned a private organization workspace.';button.textContent='Corporate Workspace Ready';button.disabled=true;}
      else{copy.textContent='Corporate workspaces are provisioned automatically after an active $49/month Uptime Lounge Corporate subscription.';button.textContent='View Corporate Plan';button.disabled=false;}
    }
    button.addEventListener('click',()=>{if(button.disabled)return;try{if(typeof setInterfaceMode==='function')setInterfaceMode('gui');}catch{}try{if(typeof setGuiView==='function')setGuiView('funding');}catch{}});
    refresh();setTimeout(refresh,900);setTimeout(refresh,2200);
  }

  function loadOnboarding(){
    if(document.querySelector('script[data-root-lounge-onboarding]'))return;
    const script=document.createElement('script');script.src='/recovered-live/onboarding.js';script.dataset.rootLoungeOnboarding='true';document.body.append(script);
  }

  function installBrandObserver(){
    const observer=new MutationObserver(records=>{
      for(const record of records){
        record.addedNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE){const next=replaceBrandText(node.nodeValue||'');if(next!==node.nodeValue)node.nodeValue=next;}else if(node.nodeType===Node.ELEMENT_NODE)patchBrand(node);});
        if(record.type==='characterData'&&record.target?.nodeValue){const next=replaceBrandText(record.target.nodeValue);if(next!==record.target.nodeValue)record.target.nodeValue=next;}
      }
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  }

  window.addEventListener('DOMContentLoaded',()=>{
    loadPremiumStyles();
    patchBrand();
    patchFunding();
    addCorporateCard();
    loadOnboarding();
    installBrandObserver();
    setTimeout(()=>{patchBrand();patchFunding();addCorporateCard();},900);
    setTimeout(()=>{patchBrand();patchFunding();addCorporateCard();},2200);
  });
})();
