'use strict';
(() => {
  const TOUR_STORAGE_KEY='root-lounge-tour-v1';
  const TOUR_STEPS=[
    {
      title:'GUI vs Console',
      kicker:'STEP 1 · PICK YOUR WORKSPACE',
      body:'Use GUI for the everyday Root Lounge experience. Console is the same workspace with a terminal-style interface and a simulated shell for fun—no real SSH or remote commands are executed.',
      tip:'Start in GUI. Switch to Console later when you want the terminal vibe.',
      view:'overview'
    },
    {
      title:'Check-In',
      kicker:'STEP 2 · READ YOUR OWN TELEMETRY',
      body:'Set your sanity, caffeine, sleep, and hydration levels. Root Lounge uses that self-report to suggest a cleaner next move. It is operator wellness context, not medical monitoring.',
      tip:'Update this when your shift changes or after a rough incident.',
      view:'checkin'
    },
    {
      title:'Incidents',
      kicker:'STEP 3 · VENT WITHOUT LEAKING SECRETS',
      body:'Log a sanitized incident, search the board, and inject a support patch into someone else’s post. Shared community mode is for human decompression—not passwords, customer data, IPs, or confidential hostnames.',
      tip:'Describe the pain, not the private infrastructure.',
      view:'incidents'
    },
    {
      title:'Recovery + Runbooks',
      kicker:'STEP 4 · RESET AND HAND OFF CLEANLY',
      body:'Use the 60-second reset, five-minute focus timer, shift-handoff builder, peer recovery chat, and blameless runbooks when the pager brain starts taking over.',
      tip:'Recovery is a feature, not a failure state.',
      view:'recovery'
    },
    {
      title:'Local vs Shared',
      kicker:'STEP 5 · KNOW WHERE YOUR DATA GOES',
      body:'LOCAL means Root Lounge stays in this browser. SHARED means anonymous Supabase authentication + Row Level Security are active for community data. Corporate becomes organization-scoped when a workspace is configured.',
      tip:'Anonymous is not invisible. Keep secrets and confidential operational details out of shared spaces.',
      view:'settings'
    }
  ];

  let currentStep=0;
  let initialized=false;

  const el=(id)=>document.getElementById(id);

  function addStylesheet(){
    if(document.querySelector('link[data-root-lounge-onboarding]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/recovered-live/onboarding.css';
    link.dataset.rootLoungeOnboarding='true';
    document.head.append(link);
  }

  function addHelpButton(){
    if(el('helpBtn'))return;
    const controls=document.querySelector('.header-controls');
    if(!controls)return;
    const button=document.createElement('button');
    button.id='helpBtn';
    button.type='button';
    button.className='root-help-btn';
    button.textContent='? How to use';
    button.setAttribute('aria-label','How to use Root Lounge');
    const session=controls.querySelector('.session-chip');
    controls.insertBefore(button,session||null);
    button.addEventListener('click',openHelp);
  }

  function helpCard(icon,title,body){
    const card=document.createElement('article');
    card.className='root-help-card';
    const iconEl=document.createElement('div');iconEl.className='root-help-icon';iconEl.textContent=icon;
    const h=document.createElement('h4');h.textContent=title;
    const p=document.createElement('p');p.textContent=body;
    card.append(iconEl,h,p);
    return card;
  }

  function addHelpView(){
    if(el('gui-view-help'))return;
    if(typeof GUI_META==='object')GUI_META.help=['ROOT LOUNGE GUIDE','How to Use Root Lounge','Start here, learn the workspace, and come back anytime.'];

    const nav=el('guiNav');
    if(nav&&!nav.querySelector('[data-gui-view="help"]')){
      const button=document.createElement('button');
      button.type='button';button.dataset.guiView='help';button.innerHTML='<span>?</span>Help';
      nav.append(button);
    }

    const scroll=document.querySelector('.gui-scroll');
    if(!scroll)return;
    const section=document.createElement('section');
    section.id='gui-view-help';section.className='gui-view';

    const start=document.createElement('article');start.className='root-help-start';
    const copy=document.createElement('div');
    const eyebrow=document.createElement('span');eyebrow.className='gui-eyebrow';eyebrow.textContent='START HERE';
    const heading=document.createElement('h3');heading.textContent='Root Lounge in about 60 seconds';
    const intro=document.createElement('p');intro.textContent='Root Lounge is a decompression workspace for IT people: check in, vent safely, reset, help another operator, build a handoff, and get back to the work with less chaos.';
    copy.append(eyebrow,heading,intro);
    const actions=document.createElement('div');actions.className='root-help-actions';
    const tour=document.createElement('button');tour.id='helpStartTour';tour.type='button';tour.className='gui-primary';tour.textContent='Take guided tour';
    const checkin=document.createElement('button');checkin.type='button';checkin.className='gui-secondary';checkin.textContent='Go to Check-In';
    actions.append(tour,checkin);start.append(copy,actions);

    const grid=document.createElement('div');grid.className='root-help-grid';
    [
      ['🖥️','GUI vs Console','GUI is the easiest everyday view. Console gives you the same core features in a terminal-style interface. Its shell and SSH registry are simulations only.'],
      ['🧠','Check-In','Set sanity, caffeine, sleep, and hydration. Root Lounge uses those values to suggest a next move and help you notice when you are running hot.'],
      ['⚠️','Incidents','Post sanitized vents, search the incident board, and support other operators. Never post passwords, API keys, customer data, internal hostnames, or confidential incident details.'],
      ['↻','Recovery','Use breathing, single-task focus, recovery chat, and the shift-handoff builder when context switching or incident pressure gets ugly.'],
      ['▤','Runbooks','Fast blameless reminders for common operator situations. They are starting points—verify every command and procedure against your real environment.'],
      ['🌐','Local vs Shared','LOCAL stays in this browser. SHARED uses anonymous Supabase auth + RLS for community data. Corporate is organization-scoped only after a workspace is configured.'],
      ['👥','Community vs Corporate','Community is the shared operator lounge. Corporate is for a private organization workspace. If Corporate is not configured, it safely stays local.'],
      ['◈','Funding','Merch and Corporate checkout remain disabled until the correct Root Lounge Stripe account is connected. Root Lounge will fail honestly instead of sending you to the wrong billing account.']
    ].forEach(([icon,title,body])=>grid.append(helpCard(icon,title,body)));

    section.append(start,grid);scroll.append(section);
    tour.addEventListener('click',()=>startTour(true));
    checkin.addEventListener('click',()=>{if(typeof setGuiView==='function')setGuiView('checkin');});
  }

  function addFirstRunHint(){
    if(el('firstRunHint'))return;
    const overview=el('gui-view-overview');
    const metrics=el('guiMetricCards');
    if(!overview||!metrics)return;
    const hint=document.createElement('div');hint.id='firstRunHint';hint.className='root-first-hint';
    const copy=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent='New here? Root Lounge makes more sense in 60 seconds.';
    const sub=document.createElement('span');sub.textContent='Take the tour once, then this hint stays out of your way.';
    copy.append(strong,document.createElement('br'),sub);
    const button=document.createElement('button');button.id='firstRunTourBtn';button.type='button';button.textContent='Show me →';
    hint.append(copy,button);overview.insertBefore(hint,metrics);
    button.addEventListener('click',()=>startTour(true));
  }

  function addTourOverlay(){
    if(el('tourOverlay'))return;
    const overlay=document.createElement('div');overlay.id='tourOverlay';overlay.className='root-tour-overlay';overlay.hidden=true;
    overlay.innerHTML=`<section class="root-tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle">
      <div class="root-tour-head"><strong>ROOT LOUNGE QUICKSTART</strong><span id="tourStepCount">1 / 5</span></div>
      <div class="root-tour-body"><div id="tourKicker" class="root-tour-kicker"></div><h2 id="tourTitle"></h2><p id="tourBody"></p><div id="tourTip" class="root-tour-tip"></div></div>
      <div class="root-tour-actions"><div class="root-tour-actions-left"><button id="tourSkip" class="root-tour-ghost" type="button">Skip tour</button></div><div class="root-tour-actions-right"><button id="tourBack" class="root-tour-secondary" type="button">Back</button><button id="tourNext" class="root-tour-primary" type="button">Next</button><button id="tourDone" class="root-tour-primary" type="button" hidden>Done</button></div></div>
    </section>`;
    document.body.append(overlay);
    el('tourBack').addEventListener('click',()=>showStep(currentStep-1));
    el('tourNext').addEventListener('click',()=>showStep(currentStep+1));
    el('tourDone').addEventListener('click',finishTour);
    el('tourSkip').addEventListener('click',finishTour);
  }

  function navigateForStep(step){
    try{if(typeof setInterfaceMode==='function')setInterfaceMode('gui');}catch{}
    try{if(typeof setGuiView==='function')setGuiView(step.view);}catch{}
  }

  function showStep(index){
    currentStep=Math.max(0,Math.min(TOUR_STEPS.length-1,index));
    const step=TOUR_STEPS[currentStep];
    navigateForStep(step);
    el('tourStepCount').textContent=`${currentStep+1} / ${TOUR_STEPS.length}`;
    el('tourKicker').textContent=step.kicker;
    el('tourTitle').textContent=step.title;
    el('tourBody').textContent=step.body;
    el('tourTip').replaceChildren();
    const strong=document.createElement('strong');strong.textContent='Quick tip: ';
    el('tourTip').append(strong,document.createTextNode(step.tip));
    el('tourBack').disabled=currentStep===0;
    el('tourNext').hidden=currentStep===TOUR_STEPS.length-1;
    el('tourDone').hidden=currentStep!==TOUR_STEPS.length-1;
  }

  function startTour(force=false){
    if(!force&&localStorage.getItem(TOUR_STORAGE_KEY)==='done')return;
    addTourOverlay();
    currentStep=0;showStep(0);
    el('tourOverlay').hidden=false;
    requestAnimationFrame(()=>el('tourNext')?.focus());
  }

  function finishTour(){
    localStorage.setItem(TOUR_STORAGE_KEY,'done');
    if(el('tourOverlay'))el('tourOverlay').hidden=true;
  }

  function openHelp(){
    try{if(typeof setInterfaceMode==='function')setInterfaceMode('gui');}catch{}
    try{if(typeof setGuiView==='function')setGuiView('help');}catch{}
  }

  function init(){
    if(initialized)return;initialized=true;
    addStylesheet();addHelpButton();addHelpView();addFirstRunHint();addTourOverlay();
    setTimeout(()=>startTour(false),350);
  }

  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
