'use strict';
(() => {
  const DEMO_PROFILES=[
    {handle:'demo_packetwitch',display:'Packet Witch',role:'Network Engineer',bio:'Routing gremlins, Wi-Fi mysteries, and the occasional victory over asymmetric traffic.',interests:['networking','wifi','dns','cisco']},
    {handle:'demo_patchtuesday',display:'Patch Tuesday',role:'Systems Administrator',bio:'Windows, virtualization, backups, and asking why the maintenance window is somehow already over.',interests:['windows','vmware','veeam','powershell']},
    {handle:'demo_yamlwrangler',display:'YAML Wrangler',role:'Platform Engineer',bio:'Turning indentation into infrastructure one questionable manifest at a time.',interests:['kubernetes','devops','linux','terraform']},
    {handle:'demo_midnightroot',display:'Midnight Root',role:'Linux Administrator',bio:'Shell history longer than the incident report. Usually awake when everybody else is not.',interests:['linux','bash','security','automation']},
    {handle:'demo_cloudywithachance',display:'Cloudy With A Chance',role:'Cloud Engineer',bio:'Mostly cloudy with scattered IAM problems and a strong chance of cost alerts.',interests:['azure','aws','iam','finops']},
    {handle:'demo_helpdeskhistorian',display:'Helpdesk Historian',role:'IT Support Lead',bio:'Has heard every version of “I already rebooted it.” Keeps receipts.',interests:['support','m365','intune','career']},
    {handle:'demo_backupbard',display:'Backup Bard',role:'Backup Engineer',bio:'Writes restore points, not love songs. Tests restores because hope is not a strategy.',interests:['backup','veeam','storage','dr']},
    {handle:'demo_sreafterdark',display:'SRE After Dark',role:'Site Reliability Engineer',bio:'Error budgets, quiet dashboards, and deeply suspicious green checkmarks.',interests:['sre','observability','oncall','python']}
  ];

  const DEMO_POSTS=[
    {author:0,type:'discussion',title:'DNS was innocent for once',body:'Spent forty minutes blaming DNS. Plot twist: stale proxy config. I owe DNS an apology and maybe flowers.',tags:['dns','networking'],reactions:38,comments:11,minutes:18},
    {author:1,type:'question',title:'What is your “do not touch it Friday” rule?',body:'Our team has an unofficial 3 PM Friday production freeze unless the building is actively on fire. Curious what other shops use.',tags:['sysadmin','change-management'],reactions:27,comments:19,minutes:42},
    {author:6,type:'win',title:'Restore test passed clean',body:'Random restore test finished ahead of schedule and the app owner actually validated the data. Tiny win, huge peace of mind.',tags:['backup','dr','veeam'],reactions:64,comments:8,minutes:67},
    {author:2,type:'incident',title:'The one-space outage',body:'A single indentation mistake made it through review. No blame, just a new lint gate and one very humbled keyboard.',tags:['yaml','devops','postmortem'],reactions:51,comments:14,minutes:95},
    {author:5,type:'discussion',title:'User said “the internet is down”',body:'Translation: one bookmarked vendor page changed its login URL. Never change, help desk. Never change.',tags:['helpdesk','support'],reactions:89,comments:23,minutes:132},
    {author:4,type:'resource',title:'Cloud cost cleanup ritual',body:'My monthly pass: unattached disks, old snapshots, idle public IPs, oversized test VMs, then reserved-capacity coverage. Boring work that keeps paying.',tags:['cloud','finops'],reactions:46,comments:10,minutes:176},
    {author:7,type:'discussion',title:'Green dashboards make me nervous now',body:'After enough incidents, “all green” stops feeling peaceful and starts feeling like the monitoring agent died.',tags:['sre','observability','oncall'],reactions:73,comments:16,minutes:231},
    {author:3,type:'question',title:'Favorite tiny Linux command that saves your day?',body:'Mine today was ss -tulpn. Looking for everybody’s little command-line comfort food.',tags:['linux','bash'],reactions:34,comments:31,minutes:294}
  ];

  const DEMO_COMMUNITIES=[
    {name:'SysAdmin Breakroom',slug:'sysadmin-breakroom',desc:'Windows, VMware, backups, storage, identity, and keeping the lights on.',members:842},
    {name:'After The Pager',slug:'after-the-pager',desc:'On-call stories, incident recovery, handoffs, and getting your brain back after the alert storm.',members:619},
    {name:'Linux Corner',slug:'linux-corner',desc:'Shells, services, automation, permissions, logs, and the ancient art of reading the error message.',members:503},
    {name:'Cloud Cost Therapy',slug:'cloud-cost-therapy',desc:'AWS, Azure, GCP, architecture, FinOps, and invoices that arrive with jump scares.',members:391},
    {name:'Help Desk Hall of Fame',slug:'helpdesk-hall-of-fame',desc:'Support wins, impossible tickets, career advice, and “yes, we rebooted it.”',members:728}
  ];

  const $=id=>document.getElementById(id);
  let queued=false,seeding=false;
  const badge=()=>{const b=document.createElement('span');b.className='rl-demo-badge';b.textContent='DEMO';return b;};
  const ago=mins=>new Date(Date.now()-mins*60000).toISOString();

  function ensureBanner(){
    const shell=document.querySelector('.rl-social-shell');if(!shell||shell.querySelector('.rl-demo-banner'))return;
    const banner=document.createElement('div');banner.className='rl-demo-banner';
    const strong=document.createElement('strong');strong.textContent='DEMO COMMUNITY';
    const copy=document.createElement('span');copy.textContent='Seeded example profiles and posts help show how the Lounge works. They are synthetic—not real members. Real activity can replace these as the community grows.';
    banner.append(strong,copy);const tabs=shell.querySelector('.rl-social-tabs');tabs?.insertAdjacentElement('afterend',banner);
  }

  function postCard(post){
    const profile=DEMO_PROFILES[post.author];const card=document.createElement('article');card.className='rl-post-card rl-demo-card';
    const head=document.createElement('header');head.className='rl-post-head';
    const avatar=document.createElement('div');avatar.className='rl-social-avatar';avatar.textContent=profile.display[0].toUpperCase();
    const who=document.createElement('div');const name=document.createElement('strong');name.textContent=profile.display;name.append(badge());const meta=document.createElement('small');meta.textContent=`${profile.role} · ${typeof formatTime==='function'?formatTime(ago(post.minutes)):`${post.minutes}m ago`} · @${profile.handle}`;who.append(name,meta);
    const type=document.createElement('span');type.className=`rl-post-type type-${post.type}`;type.textContent=post.type;head.append(avatar,who,type);
    const body=document.createElement('div');body.className='rl-post-body';const h=document.createElement('h3');h.textContent=post.title;const p=document.createElement('p');p.textContent=post.body;body.append(h,p);const tags=document.createElement('div');tags.className='rl-tags';post.tags.forEach(t=>{const s=document.createElement('span');s.className='rl-tag';s.textContent=`#${t}`;tags.append(s)});body.append(tags);
    const actions=document.createElement('div');actions.className='rl-post-actions';[['♥ '+post.reactions,'Demo reactions'],['💬 '+post.comments,'Demo replies'],['Follow','Demo profile'],['Message','Demo profile']].forEach(([text,title])=>{const b=document.createElement('button');b.type='button';b.disabled=true;b.textContent=text;b.title=title;actions.append(b)});
    card.append(head,body,actions);return card;
  }

  function personCard(profile){
    const card=document.createElement('article');card.className='rl-person-card rl-demo-card';const avatar=document.createElement('div');avatar.className='rl-social-avatar large';avatar.textContent=profile.display[0].toUpperCase();const h=document.createElement('h4');h.textContent=profile.display;h.append(badge());const role=document.createElement('span');role.textContent=`${profile.role} · @${profile.handle}`;const bio=document.createElement('p');bio.textContent=profile.bio;const tags=document.createElement('div');tags.className='rl-tags';profile.interests.forEach(t=>{const s=document.createElement('span');s.className='rl-tag';s.textContent=`#${t}`;tags.append(s)});const actions=document.createElement('div');actions.className='rl-person-actions';['Follow','Message'].forEach(text=>{const b=document.createElement('button');b.type='button';b.disabled=true;b.textContent=text;b.title='Demo profile';actions.append(b)});card.append(avatar,h,role,bio,tags,actions);return card;
  }

  function communityCard(c){
    const card=document.createElement('article');card.className='rl-community-card rl-demo-card';const icon=document.createElement('div');icon.className='rl-community-icon';icon.textContent=c.name[0].toUpperCase();const h=document.createElement('h4');h.textContent=c.name;h.append(badge());const slug=document.createElement('span');slug.textContent=`r/${c.slug} · demo public space`;const p=document.createElement('p');p.textContent=c.desc;const foot=document.createElement('div');foot.className='rl-community-foot';const count=document.createElement('small');count.textContent=`${c.members.toLocaleString()} demo members`;const join=document.createElement('button');join.type='button';join.disabled=true;join.textContent='Preview';foot.append(count,join);card.append(icon,h,slug,p,foot);return card;
  }

  function realCount(host,selector){return host?[...host.querySelectorAll(selector)].filter(n=>!n.classList.contains('rl-demo-card')).length:0;}
  function removeDemos(host){host?.querySelectorAll('.rl-demo-card').forEach(n=>n.remove());}
  function removeEmpty(host){host?.querySelectorAll(':scope > .rl-empty-card').forEach(n=>n.remove());}

  function seed(){
    if(seeding)return;seeding=true;
    try{
      ensureBanner();
      const feed=$('rlFeedList');if(feed){const real=realCount(feed,'.rl-post-card');removeDemos(feed);if(real<4){removeEmpty(feed);DEMO_POSTS.slice(0,Math.max(4-real,0)+4).forEach(p=>feed.append(postCard(p)));}}
      const people=$('rlPeopleCards');if(people){const real=realCount(people,'.rl-person-card');removeDemos(people);if(real<4){removeEmpty(people);DEMO_PROFILES.slice(0,Math.max(4-real,0)+4).forEach(p=>people.append(personCard(p)));}}
      const communities=$('rlCommunityCards');if(communities){const real=realCount(communities,'.rl-community-card');removeDemos(communities);if(real<3){removeEmpty(communities);DEMO_COMMUNITIES.slice(0,Math.max(3-real,0)+2).forEach(c=>communities.append(communityCard(c)));}}
    } finally {seeding=false;}
  }

  function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;seed();});}
  const observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  setTimeout(queue,700);setTimeout(queue,1800);setTimeout(queue,3500);
})();