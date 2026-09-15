(() => {
  'use strict';

  const NAV = [
    ['dashboard','Overview','Dashboard'],
    ['partners','1','Partner Selection'],
    ['deals','2','Deal Making'],
    ['market','3','Market Intelligence'],
    ['games','4','Game Selection'],
    ['sourcing','5','Sourcing'],
    ['operations','6','Publishing Operation']
  ];
  const STAGES = ['Lead','Qualified','Evaluation','Test','Deal','Launch','Scale'];
  const EVIDENCE_STATUS = ['','Đã xác minh','Partner cung cấp','Đã trao đổi','Thiếu','N/A'];
  const GATE_STATUS = ['Đạt','Chờ xác minh','Không đạt'];
  const GAME_GATE_STATUS = ['PASS','PASS / Monitor','PENDING','FAIL'];
  const LOCAL_KEY = 'savaPublishingOS.db.v1';
  const TOKEN_KEY = 'savaPublishingOS.githubToken';
  const SEED = clone(window.SAVA_SEED_DB || {});

  let db = clone(SEED);
  let syncChain = Promise.resolve();
  let isSyncing = false;
  let currentView = location.hash.replace('#','') || 'dashboard';
  let searchTerm = '';
  let githubSha = null;

  const $ = s => document.querySelector(s);
  const content = $('#content');
  const modalRoot = $('#modalRoot');

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function val(v, fallback='—'){ return v === null || v === undefined || v === '' ? fallback : v; }
  function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function pct(v, digits=0){ const n=num(v); return n===null?'—':`${(n*100).toFixed(digits)}%`; }
  function esc(s){ return String(s??'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function fmt(n,d=1){ const x=num(n); return x===null?'—':x.toLocaleString('en-US',{maximumFractionDigits:d}); }
  function money(n){ const x=num(n); return x===null?'—':x.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function byId(list,id){ return (list||[]).find(x=>x.id===id); }
  function profile(p,key){ return p?.profile?.[key]; }
  function intake(g,key){ return g?.intake?.[key]; }
  function includesSearch(...parts){ if(!searchTerm) return true; return parts.join(' ').toLowerCase().includes(searchTerm.toLowerCase()); }

  function loadLocal(){
    try { const raw=localStorage.getItem(LOCAL_KEY); return raw?JSON.parse(raw):null; } catch { return null; }
  }
  function persist(action='Updated data'){
    db.meta = db.meta || {};
    db.meta.lastModifiedAt = new Date().toISOString();
    db.audit = db.audit || [];
    db.audit.unshift({at:new Date().toISOString(),user:db.settings?.currentUser||'User',action});
    db.audit = db.audit.slice(0,100);
    localStorage.setItem(LOCAL_KEY,JSON.stringify(db));
    render();

    if(!window.SAVA_SUPABASE?.configured){
      $('#saveState').textContent='Saved locally';
      return;
    }
    if(!window.SAVA_SUPABASE.canEdit()){
      $('#saveState').textContent='Viewer · read only';
      toast('Read only: ask an Admin for Editor access');
      const snap=window.SAVA_SUPABASE.getSnapshot?.();
      if(snap){db=snap;localStorage.setItem(LOCAL_KEY,JSON.stringify(db));render();}
      return;
    }

    $('#saveState').textContent='Saving to Supabase…';
    const payload=clone(db);
    syncChain=syncChain.then(async()=>{
      isSyncing=true;
      try{
        await window.SAVA_SUPABASE.syncDb(payload);
        $('#saveState').textContent=`Synced · ${db.settings?.role||window.SAVA_SUPABASE.getRole()}`;
      }catch(e){
        console.error(e);
        $('#saveState').textContent='Sync error';
        toast(`Save failed: ${e.message}`);
        try{db=await window.SAVA_SUPABASE.loadDb();localStorage.setItem(LOCAL_KEY,JSON.stringify(db));render();}catch(_){ }
      }finally{isSyncing=false;}
    });
  }
  function toast(msg){
    const el=document.createElement('div'); el.className='toast'; el.textContent=msg; $('#toastRoot').append(el);
    setTimeout(()=>el.remove(),2800);
  }
  function badge(text){
    const t=String(text??'').toLowerCase(); let cls='';
    if(/pass|đạt|scale|ưu tiên|đã duyệt|đang hợp tác|good|greenlight/.test(t) && !/không đạt|chưa/.test(t)) cls='good';
    else if(/fail|reject|stop|không đạt|nghiêm trọng|cao/.test(t)) cls='bad';
    else if(/pending|chờ|hold|thiếu|điều kiện|test thêm|consider|đang deal|tạm/.test(t)) cls='warn';
    else if(/product|launch|evaluation|qualified|deal/.test(t)) cls='blue';
    return `<span class="badge ${cls}">${esc(text||'—')}</span>`;
  }

  function hardGateResult(p){
    const vals=['legalContract','ipSourceRights','publisherConflict','dataTransparency','teamContinuity','compliance'].map(k=>p.hardGate?.[k]||'Chờ xác minh');
    if(vals.some(x=>x==='Không đạt')) return 'KHÔNG ĐẠT';
    if(vals.every(x=>x==='Đạt')) return 'ĐẠT';
    return 'CHỜ XÁC MINH';
  }
  function evidenceValid(status){ return !!status && status!=='Thiếu' && status!=='N/A'; }
  function evidenceDerived(p){
    const e=p.evidence||{};
    const prodKeys=['capacity','cadence','milestone','liveOps'];
    const productionReady=prodKeys.filter(k=>evidenceValid(e[k]?.status)).length>=3;
    const groups=[evidenceValid(e.trackRecord?.status),evidenceValid(e.team?.status),productionReady,evidenceValid(e.dataTech?.status),evidenceValid(e.collaboration?.status),evidenceValid(e.deal?.status),evidenceValid(e.strategicFit?.status),evidenceValid(e.longTerm?.status)];
    const coverage=groups.filter(Boolean).length/8;
    const allKeys=['trackRecord','team','capacity','cadence','milestone','liveOps','dataTech','collaboration','publisherHistory','deal','legalIp','strategicFit','longTerm'];
    const statuses=allKeys.map(k=>e[k]?.status).filter(x=>evidenceValid(x));
    const verified=statuses.filter(x=>x==='Đã xác minh').length;
    const provided=statuses.filter(x=>x==='Partner cung cấp').length;
    let confidence='Thấp';
    if(coverage>=.75 && verified/Math.max(1,statuses.length)>=.5) confidence='Cao';
    else if((verified+provided)/Math.max(1,statuses.length)>=.5) confidence='Trung bình';
    const minRequired=['team','capacity','cadence','milestone','liveOps','dataTech','collaboration','deal'].every(k=>evidenceValid(e[k]?.status));
    const minimumGate = hardGateResult(p)==='ĐẠT' && minRequired ? 'ĐẠT':'THIẾU';
    const missing=['team','capacity','cadence','milestone','liveOps','dataTech','collaboration','deal'].filter(k=>!evidenceValid(e[k]?.status));
    return {coverage,confidence,minimumGate,missing};
  }
  function partnerDerived(p){
    const s=p.scores||{}, ev=evidenceDerived(p);
    const prodScores=['capacity','cadence','milestone','liveOps'].map(k=>num(s[k]));
    const production=prodScores.every(x=>x!==null)?prodScores.reduce((a,b)=>a+b,0)/4:num(s.productionComposite);
    const parts=[['trackRecord',10],['team',15],['production',15],['dataTech',10],['collaboration',15],['strategicFit',15],['longTerm',10]];
    const source={...s,production};
    const complete=parts.every(([k])=>num(source[k])!==null);
    const fit=complete?Math.round(parts.reduce((sum,[k,w])=>sum+num(source[k])*w,0)/5/90*1000)/10:null;
    const classification=fit===null?'NE':fit>=85?'Ưu tiên':fit>=75?'Đạt':fit>=65?'Có điều kiện':'Cần xem xét';
    const hard=hardGateResult(p);
    const final=hard==='KHÔNG ĐẠT'?'Bị chặn':hard==='CHỜ XÁC MINH'?'Chờ xác minh':ev.minimumGate!=='ĐẠT'?'Thiếu Evidence':classification;
    return {production,fit,classification,hard,...ev,final};
  }
  function gameHardGate(g){
    const keys=['Gate_Legal_IP','Gate_Build_Playable','Gate_Tracking_Access','Gate_Store_Compliance','Gate_Commercial_Terms','Gate_Rights_Confirmed'];
    const vals=keys.map(k=>String(intake(g,k)||'PENDING'));
    if(vals.some(x=>x==='FAIL')) return 'FAIL';
    if(vals.every(x=>x==='PASS'||x==='PASS / Monitor')) return 'PASS';
    return 'PENDING';
  }
  function weighted(scores,weights){
    const items=Object.entries(weights); if(!items.every(([k])=>num(scores[k])!==null)) return null;
    const total=items.reduce((s,[k,w])=>s+num(scores[k])*w,0); const wsum=items.reduce((s,[,w])=>s+w,0);
    return Math.round((total/5/wsum*100)*10)/10;
  }
  function gameDerived(g){
    const s=g.scorecard||{};
    const market=weighted({size:s.marketSize,growth:s.growth,entry:s.entryAccess,mon:s.marketMonetization,ua:s.marketUaScalability},{size:20,growth:20,entry:25,mon:20,ua:15});
    const product=weighted({ua:s.uaTest,ret:s.retention,eng:s.engagement,mon:s.monetizationTest,gf:s.gamefeelTest},{ua:25,ret:30,eng:15,mon:20,gf:10});
    const readiness=num(s.readiness), deal=num(s.dealEconomics), fit=num(s.savaFit);
    const prescan=[market,readiness,deal,fit].every(x=>x!==null)?Math.round((market*.45+readiness*20*.2+deal*20*.2+fit*20*.15)*10)/10:null;
    const final=[market,product,readiness,deal,fit].every(x=>x!==null)?Math.round((market*.25+product*.35+readiness*20*.15+deal*20*.15+fit*20*.10)*10)/10:null;
    const stage=product!==null?'POST-TEST':'PRE-SCAN';
    const hard=gameHardGate(g), completeness=num(s.dataCompleteness);
    let recommendation='HOLD - NEED DATA';
    if(hard==='FAIL') recommendation='REJECT - GATE FAIL';
    else if(hard==='PENDING') recommendation=prescan!==null&&prescan>=60&&prescan<=75?'NEGOTIATE / CONDITIONAL SIGNING':'HOLD - FIX GATE';
    else if(completeness!==null && completeness<.8) recommendation='HOLD - NEED DATA';
    else if(stage==='POST-TEST') recommendation=final>=80?'GREENLIGHT / SCALE':final>=68?'TEST MORE / RENEGOTIATE':'STOP / PASS';
    else recommendation=prescan>75?'DIRECT TO PRODUCT TEST':prescan>=60?'REVIEW PASSED / PROCEED TO PRODUCT TEST':'PASS / DO NOT SCAN';
    return {market,product,prescan,final,stage,hard,recommendation};
  }
  function riskLevel(score){ const s=num(score); return s===null?'—':s>=9?'Nghiêm trọng':s>=6?'Cao':s>=3?'Trung bình':'Thấp'; }

  function nav(){
    $('#mainNav').innerHTML=NAV.map(([id,n,label])=>`<button data-nav="${id}" class="${currentView===id?'active':''}"><span class="num">${n}</span>${label}</button>`).join('');
    $('#mainNav').querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{currentView=b.dataset.nav;location.hash=currentView;render();});
  }
  function setHeader(title,eyebrow='Publishing Operating System'){$('#pageTitle').textContent=title;$('#pageEyebrow').textContent=eyebrow;}
  function kpi(label,value,sub=''){return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;}
  function panel(title,body,subtitle='',actions=''){return `<div class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${actions}</div><div class="panel-body">${body}</div></div>`;}
  function table(headers,rows){return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="empty">No data</td></tr>`}</tbody></table></div>`;}

  function render(){
    nav();
    if(!NAV.some(x=>x[0]===currentView)) currentView='dashboard';
    ({dashboard:renderDashboard,partners:renderPartners,deals:renderDeals,market:renderMarket,games:renderGames,sourcing:renderSourcing,operations:renderOperations}[currentView]||renderDashboard)();
    applyRoleUi();
  }

  function applyRoleUi(){
    if(!window.SAVA_SUPABASE?.configured)return;
    const canEdit=window.SAVA_SUPABASE.canEdit();
    const canDelete=window.SAVA_SUPABASE.canDelete();
    document.querySelectorAll('[data-action="quick-add"],[data-action^="add-"]').forEach(el=>el.disabled=!canEdit);
    document.querySelectorAll('[data-sourcing-stage]').forEach(el=>el.disabled=!canEdit);
    document.querySelectorAll('[data-delete-partner]').forEach(el=>el.disabled=!canDelete);
    const imp=$('#importJson');if(imp)imp.disabled=!canDelete;
    const role=db.settings?.role||window.SAVA_SUPABASE.getRole();
    const user=db.settings?.currentUser||'';
    const st=$('#saveState');if(st&&!isSyncing)st.textContent=`${user} · ${role}`;
  }

  function renderDashboard(){
    setHeader('Dashboard','Portfolio & decision overview');
    const partnerStats=db.partners.map(p=>partnerDerived(p));
    const gameStats=db.games.map(g=>gameDerived(g));
    const openHigh=(db.partnerRisks||[]).filter(r=>['Cao','Nghiêm trọng'].includes(r.level||riskLevel(r.score)) && r.status!=='Đã đóng').length;
    const opsActive=(db.projects||[]).filter(p=>!['Đã đóng','Stopped'].includes(p.deploymentStatus)).length;
    const partnerRows=db.partners.filter(p=>includesSearch(p.id,profile(p,'Tên Partner / Studio'),profile(p,'Genre chính'))).map(p=>{const d=partnerDerived(p);return `<tr><td><button class="linkish" data-open-partner="${p.id}">${p.id}</button></td><td><b>${esc(profile(p,'Tên Partner / Studio'))}</b><div class="small muted">${esc(profile(p,'Genre chính')||'')}</div></td><td>${badge(d.hard)}</td><td><div class="score-row"><strong>${d.fit??'—'}</strong><span class="scorebar"><i style="width:${Math.min(100,d.fit||0)}%"></i></span></div></td><td>${badge(d.final)}</td><td>${esc(p.decision?.nextAction||p.scorecard?.nextAction||'—')}</td></tr>`;});
    const stageCounts=Object.fromEntries(STAGES.map(s=>[s,(db.sourcing||[]).filter(x=>x.stage===s).length]));
    const funnel=STAGES.map((s,i)=>`<tr><td>${s}</td><td class="num"><b>${stageCounts[s]}</b></td><td class="num">${i===0?'—':stageCounts[STAGES[i-1]]?((stageCounts[s]/stageCounts[STAGES[i-1]])*100).toFixed(0)+'%':'—'}</td></tr>`);
    const alerts=[];
    db.partners.forEach(p=>{const d=partnerDerived(p);if(d.hard!=='ĐẠT')alerts.push(`${p.id} · ${profile(p,'Tên Partner / Studio')}: Hard Gate ${d.hard}`);});
    db.games.forEach(g=>{const d=gameDerived(g);if(d.hard!=='PASS')alerts.push(`${g.id} · ${intake(g,'Game_Title')}: ${d.recommendation}`);});
    content.innerHTML=`<div class="grid kpis">${kpi('Partners',db.partners.length,`${partnerStats.filter(x=>x.final==='Ưu tiên'||x.final==='Đạt').length} qualified by current logic`)}${kpi('Games',db.games.length,`${gameStats.filter(x=>/PRODUCT TEST|GREENLIGHT/.test(x.recommendation)).length} proceed signals`)}${kpi('Open high risks',openHigh,'Partner risk log')}${kpi('Active projects',opsActive,'Publishing operation portfolio')}</div>
      <div class="split">
        ${panel('Partner decision board',table(['ID','Partner','Hard Gate','Partner Fit','Conclusion','Next action'],partnerRows),'Score does not override Hard Gate.')}
        ${panel('Sourcing funnel',table(['Stage','Count','Step conversion'],funnel),'Lead → Qualified → Evaluation → Test → Deal → Launch → Scale')}
      </div>
      ${panel('Attention needed',alerts.length?`<div class="grid">${alerts.slice(0,12).map(x=>`<div class="notice warn">${esc(x)}</div>`).join('')}</div>`:'<div class="notice good">No blocking items in the current local dataset.</div>','Hard Gate, pending gates and portfolio blockers')}
      ${panel('Recent activity',(db.audit||[]).slice(0,12).map(a=>`<div class="small" style="padding:7px 0;border-bottom:1px solid var(--line)"><b>${esc(a.user)}</b> · ${esc(a.action)} <span class="muted">${esc(a.at)}</span></div>`).join('')||'<div class="empty">No local activity yet.</div>')}`;
    bindOpeners();
  }

  function renderPartners(){
    setHeader('Partner Selection','1 · Playbook lựa chọn đối tác');
    const rows=db.partners.filter(p=>includesSearch(p.id,profile(p,'Tên Partner / Studio'),profile(p,'Genre chính'),profile(p,'Trạng thái'))).map(p=>{const d=partnerDerived(p);return `<tr><td><button class="linkish" data-open-partner="${p.id}">${p.id}</button></td><td><b>${esc(profile(p,'Tên Partner / Studio'))}</b><div class="small muted">${esc(profile(p,'Quốc gia')||'')} · ${esc(profile(p,'Quy mô team')||'')}</div></td><td>${esc(profile(p,'Genre chính')||'—')}</td><td>${badge(profile(p,'Trạng thái')||'—')}</td><td>${badge(d.hard)}</td><td class="num">${pct(d.coverage,0)}</td><td>${badge(d.confidence)}</td><td><div class="score-row"><strong>${d.fit??'—'}</strong><span class="scorebar"><i style="width:${Math.min(100,d.fit||0)}%"></i></span></div></td><td>${badge(d.final)}</td><td><div class="actions-inline"><button data-open-partner="${p.id}">Edit</button><button data-delete-partner="${p.id}">Delete</button></div></td></tr>`;});
    const highRisks=(db.partnerRisks||[]).filter(r=>includesSearch(r.partnerId,r.risk,r.level,r.owner)).map(r=>`<tr><td>${esc(r.partnerId)}</td><td>${esc(r.risk)}</td><td class="num">${r.probability}×${r.impact}</td><td>${badge(r.level||riskLevel(r.score))}</td><td>${esc(r.mitigation||'—')}</td><td>${badge(r.status||'—')}</td></tr>`);
    content.innerHTML=`<div class="grid kpis">${kpi('Total partners',db.partners.length)}${kpi('Hard Gate PASS',db.partners.filter(p=>partnerDerived(p).hard==='ĐẠT').length)}${kpi('Evidence ready',db.partners.filter(p=>partnerDerived(p).minimumGate==='ĐẠT').length)}${kpi('Priority / Pass',db.partners.filter(p=>['Ưu tiên','Đạt'].includes(partnerDerived(p).final)).length)}</div>
      ${panel('Partner master & decision',table(['ID','Partner','Genre','Status','Hard Gate','Coverage','Confidence','Fit /100','Conclusion',''],rows),'Profile → Hard Gate → Evidence → Scorecard → Decision',`<button class="primary" data-action="add-partner">+ Partner</button>`)}
      ${panel('Risk register',table(['Partner','Risk','P×I','Level','Mitigation','Status'],highRisks),'Probability × impact = risk priority',`<button class="ghost" data-action="add-risk">+ Risk</button>`)}`;
    bindOpeners();
  }

  function renderDeals(){
    setHeader('Deal Making','2 · Deal & Negotiation Playbook');
    const rows=(db.deals||[]).filter(d=>{const p=byId(db.partners,d.partnerId);return includesSearch(d.id,d.partnerId,profile(p,'Tên Partner / Studio'),d.dealModel,d.status)}).map(d=>{const p=byId(db.partners,d.partnerId);return `<tr><td><button class="linkish" data-open-deal="${d.id}">${esc(d.id)}</button></td><td>${esc(profile(p,'Tên Partner / Studio')||d.partnerId)}</td><td>${esc(d.dealModel||'—')}</td><td>${d.savaShare!==null&&d.savaShare!==undefined?pct(d.savaShare,0):'—'}</td><td>${d.partnerShare!==null&&d.partnerShare!==undefined?pct(d.partnerShare,0):'—'}</td><td>${esc(d.partnerInvestment||'—')}</td><td>${esc(d.uaCommitment||'—')}</td><td>${badge(d.status||'Draft')}</td><td><button class="ghost" data-open-deal="${d.id}">Edit</button></td></tr>`;});
    const completeness=(db.deals||[]).map(d=>['dealModel','savaShare','partnerShare','rights','responsibilities','kpis','stopCondition'].filter(k=>d[k]!==null&&d[k]!==''&&d[k]!==undefined).length/7);
    content.innerHTML=`<div class="grid kpis">${kpi('Deal records',(db.deals||[]).length)}${kpi('With rights defined',(db.deals||[]).filter(d=>d.rights).length)}${kpi('With stop condition',(db.deals||[]).filter(d=>d.stopCondition).length)}${kpi('Avg structure completeness',completeness.length?Math.round(completeness.reduce((a,b)=>a+b,0)/completeness.length*100)+'%':'—','Current Excel did not contain all negotiation fields')}</div>
      ${panel('Deal register',table(['Deal','Partner','Model','SAVA share','Partner share','Partner investment','UA commitment','Status',''],rows),'Rev Share / MG / recoup / responsibility / KPI / control / exit',`<button class="primary" data-action="add-deal">+ Deal</button>`)}
      ${panel('Negotiation checklist',`<div class="three"><div class="rule-card"><h3>Commercial</h3><p><b>Define:</b> Rev Share / MG / milestone payment, recoup waterfall, marketing spend commitment, payment & settlement.</p></div><div class="rule-card"><h3>Control & rights</h3><p><b>Define:</b> publishing rights, territory, account/data control, IP warranty, approval rights and term flexibility.</p></div><div class="rule-card"><h3>Risk limits</h3><p><b>Define:</b> milestone/KPI, kill right, stop condition, exit trigger and negotiable zones.</p></div></div>`,'Fields absent from the current spreadsheets are intentionally blank in seeded deals.')}`;
    bindOpeners();
  }

  function renderMarket(){
    setHeader('Market Intelligence','3 · Market direction + Publisher Landscape');
    const mechanics=(db.market||[]).filter(m=>includesSearch(m.Mechanic_ID,m.Mechanic,m.Geography,m.Platform));
    const rows=mechanics.map(m=>`<tr><td>${esc(m.Mechanic_ID)}</td><td><button class="linkish" data-open-market="${esc(m.Mechanic_ID)}">${esc(m.Mechanic)}</button></td><td>${esc(m.Geography||'—')}</td><td>${fmt(m.Downloads_30d,0)}</td><td>${money(m.Revenue_30d_USD)}</td><td>${m.DL_Growth_3m!==null&&m.DL_Growth_3m!==undefined?pct(m.DL_Growth_3m,1):'—'}</td><td>${m.Rev_Growth_3m!==null&&m.Rev_Growth_3m!==undefined?pct(m.Rev_Growth_3m,1):'—'}</td><td>${m.Revenue_per_Download_SAME_COHORT!==null&&m.Revenue_per_Download_SAME_COHORT!==undefined?'$'+fmt(m.Revenue_per_Download_SAME_COHORT,2):'—'}</td><td>${m.UA_Benchmark?.CPI_Median!==null&&m.UA_Benchmark?.CPI_Median!==undefined?'$'+fmt(m.UA_Benchmark.CPI_Median,2):'—'}</td></tr>`);
    const pubs=(db.publisherLandscape||[]).filter(x=>includesSearch(x.name,x.genres,x.testApproach,x.dealApproach)).map(x=>`<tr><td><button class="linkish" data-open-publisher="${x.id}">${esc(x.name)}</button></td><td>${esc(x.genres||'—')}</td><td>${esc(x.lookingFor||'—')}</td><td>${esc(x.testApproach||'—')}</td><td>${esc(x.investmentApproach||'—')}</td><td>${esc(x.dealApproach||'—')}</td><td>${esc(x.operationModel||'—')}</td></tr>`);
    content.innerHTML=`${panel('Mechanic / market economics',table(['ID','Mechanic','Geo','DL 30d','Revenue 30d','DL growth 3m','Rev growth 3m','RPD','CPI median'],rows),'Seeded from the Market Economics + UA Benchmark sheets. Historical totals may be coverage-limited exactly as noted in the source workbook.')}
      ${panel('Publisher Landscape',pubs.length?table(['Publisher','Focus genres','Looking for','How they test','Investment','Deal','Operation'],pubs):'<div class="empty"><b>No dedicated publisher landscape data existed in the 3 supplied files.</b><br/>The module is ready for the team to build benchmark records without mixing assumptions into source-derived data.</div>','Benchmark who is looking for what, how they test, invest, deal and operate.',`<button class="primary" data-action="add-publisher">+ Publisher benchmark</button>`)}`;
    bindOpeners();
  }

  function renderGames(){
    setHeader('Game Selection','4 · Market Fit + Product Fit + Marketing Fit + Business Potential');
    const rows=db.games.filter(g=>includesSearch(g.id,intake(g,'Game_Title'),intake(g,'Studio'),intake(g,'Mechanic'),g.scorecard?.recommendation)).map(g=>{const d=gameDerived(g);return `<tr><td><button class="linkish" data-open-game="${g.id}">${g.id}</button></td><td><b>${esc(intake(g,'Game_Title'))}</b><div class="small muted">${esc(intake(g,'Studio')||'')}</div></td><td>${esc(intake(g,'Mechanic')||'—')}</td><td>${badge(intake(g,'Monetization_Model')||'—')}</td><td class="num">${d.market??g.scorecard?.marketScore??'—'}</td><td class="num">${d.prescan??g.scorecard?.preScanScore??'—'}</td><td class="num">${d.final??g.scorecard?.finalScore??'—'}</td><td>${badge(d.hard)}</td><td>${badge(d.recommendation)}</td><td><button class="ghost" data-open-game="${g.id}">Edit</button></td></tr>`;});
    content.innerHTML=`<div class="grid kpis">${kpi('Candidates',db.games.length)}${kpi('Direct / proceed',db.games.filter(g=>/DIRECT|PROCEED|GREENLIGHT/.test(gameDerived(g).recommendation)).length)}${kpi('Pending gate',db.games.filter(g=>gameDerived(g).hard==='PENDING').length)}${kpi('Post-test',db.games.filter(g=>gameDerived(g).stage==='POST-TEST').length)}</div>
      ${panel('Game decision pipeline',table(['ID','Game','Mechanic','Monetization','Market /100','Pre-Scan','Final','Gate','Recommendation',''],rows),'Preserves current workbook weighting and pre-scan/post-test separation.',`<button class="primary" data-action="add-game">+ Game</button>`)}
      ${panel('Current scoring logic',`<div class="three"><div class="rule-card"><h3>Pre-Scan</h3><p>Market <b>45%</b> · Publishing Readiness <b>20%</b> · Deal Economics <b>20%</b> · SAVA Fit <b>15%</b>.</p></div><div class="rule-card"><h3>Post-Test</h3><p>Market <b>25%</b> · Product Evidence <b>35%</b> · Readiness <b>15%</b> · Deal <b>15%</b> · SAVA Fit <b>10%</b>.</p></div><div class="rule-card"><h3>Decision thresholds</h3><p>Direct test <b>&gt;75</b> · conditional floor <b>60</b> · Greenlight <b>80</b> · Test-more floor <b>68</b> · completeness <b>80%</b>.</p></div></div>`,'Hard Gate FAIL always overrides score.')}`;
    bindOpeners();
  }

  function renderSourcing(){
    setHeader('Sourcing Funnel','5 · Lead → Qualified → Evaluation → Test → Deal → Launch → Scale');
    const counts=Object.fromEntries(STAGES.map(s=>[s,(db.sourcing||[]).filter(x=>x.stage===s).length]));
    const cards=STAGES.map(stage=>`<div class="kanban-col"><div class="kanban-head"><span>${stage}</span><span class="badge">${counts[stage]}</span></div>${(db.sourcing||[]).filter(x=>x.stage===stage&&includesSearch(x.leadName,x.partnerId,x.source,x.owner)).map(x=>`<div class="kanban-card"><h4>${esc(x.leadName||x.partnerId)}</h4><p>${esc(x.source||'No source')} · ${esc(x.owner||'No owner')}</p><p>${esc(x.nextAction||'No next action')}</p><select data-sourcing-stage="${x.id}">${STAGES.map(s=>`<option ${s===x.stage?'selected':''}>${s}</option>`).join('')}</select><div style="margin-top:7px"><button class="linkish" data-open-sourcing="${x.id}">Edit</button></div></div>`).join('')}</div>`).join('');
    const conv=STAGES.map((s,i)=>`<tr><td>${s}</td><td class="num">${counts[s]}</td><td class="num">${i===0?'—':counts[STAGES[i-1]]?((counts[s]/counts[STAGES[i-1]])*100).toFixed(1)+'%':'—'}</td></tr>`);
    content.innerHTML=`<div class="grid kpis">${kpi('Leads',(db.sourcing||[]).length)}${kpi('Qualified+',STAGES.slice(1).reduce((n,s)=>n+counts[s],0))}${kpi('Deals+',counts.Deal+counts.Launch+counts.Scale)}${kpi('Scale',counts.Scale)}</div>
      ${panel('Sourcing board',`<div class="kanban">${cards}</div>`,'Use conversion at each step to diagnose bottlenecks, not just lead volume.',`<button class="primary" data-action="add-sourcing">+ Lead</button>`)}
      ${panel('Conversion snapshot',table(['Stage','Count','From previous stage'],conv),'Seeded stages were derived conservatively from current partner status; update with real sourcing history going forward.')}`;
    document.querySelectorAll('[data-sourcing-stage]').forEach(sel=>sel.onchange=()=>{const x=byId(db.sourcing,sel.dataset.sourcingStage);x.stage=sel.value;x.updatedAt=new Date().toISOString();persist(`Moved sourcing item ${x.id} to ${sel.value}`);});
    bindOpeners();
  }

  function renderOperations(){
    setHeader('Publishing Operation','6 · SOP after Deal');
    const rows=(db.projects||[]).filter(p=>includesSearch(p.id,p.name,p.genre,p.sopStage,p.gatePhase,p.owner)).map(p=>`<tr><td><button class="linkish" data-open-project="${p.id}">${esc(p.id)}</button></td><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.genre||'')}</div></td><td>${badge(p.deploymentStatus||'—')}</td><td>${esc(p.sopStage||'—')}</td><td>${badge(p.monetizationModel||'—')}</td><td>${esc(p.gatePhase||'—')}</td><td>${esc(p.owner||'—')}</td><td>${badge(p.gateReview?.result||p.latestDecision||'—')}</td><td>${esc(p.nextAction||'—')}</td><td><button class="ghost" data-open-project="${p.id}">Review</button></td></tr>`);
    const rule=db.playbook?.operation||{};
    content.innerHTML=`<div class="grid kpis">${kpi('Projects',(db.projects||[]).length)}${kpi('Product Test',(db.projects||[]).filter(p=>/Product Test/.test(p.sopStage||'')).length)}${kpi('Hybrid IAP',(db.projects||[]).filter(p=>p.monetizationModel==='Hybrid IAP').length)}${kpi('Hybrid IAA',(db.projects||[]).filter(p=>p.monetizationModel==='Hybrid IAA').length)}</div>
      ${panel('Publishing portfolio',table(['ID','Project','Status','SOP stage','Model','Current gate','Owner','Decision','Next action',''],rows),'Deal → test → soft launch → optimize → scale/stop with owner, KPI and decision gate.',`<button class="primary" data-action="add-project">+ Project</button>`)}
      ${panel('Gate reference',`<div class="split"><div><h3 style="margin-top:0">Hybrid IAP</h3>${gateCards(rule.iap)}</div><div><h3 style="margin-top:0">Hybrid IAA</h3>${gateCards(rule.iaa)}</div></div>`,'Source of truth summarized from the Launching workbook Decision Criteria.')}`;
    bindOpeners();
  }
  function gateCards(branch={}){ return Object.entries(branch).map(([k,v])=>`<div class="rule-card" style="margin-bottom:9px"><h3>${esc(k)}</h3>${Object.entries(v||{}).map(([a,b])=>`<p><b>${esc(a)}:</b> ${esc(b)}</p>`).join('')}</div>`).join(''); }

  function bindOpeners(){
    document.querySelectorAll('[data-open-partner]').forEach(b=>b.onclick=()=>openPartner(b.dataset.openPartner));
    document.querySelectorAll('[data-delete-partner]').forEach(b=>b.onclick=()=>{if(window.SAVA_SUPABASE?.configured&&!window.SAVA_SUPABASE.canDelete()){toast('Only Admin can delete records');return;}const id=b.dataset.deletePartner;if(confirm('Delete this partner from the shared database?')){db.partners=db.partners.filter(x=>x.id!==id);db.partnerRisks=(db.partnerRisks||[]).filter(x=>x.partnerId!==id);(db.deals||[]).forEach(x=>{if(x.partnerId===id)x.partnerId=null;});(db.sourcing||[]).forEach(x=>{if(x.partnerId===id)x.partnerId=null;});(db.projects||[]).forEach(x=>{if(x.partnerId===id)x.partnerId=null;});persist(`Deleted partner ${id}`);}});
    document.querySelectorAll('[data-open-deal]').forEach(b=>b.onclick=()=>openDeal(b.dataset.openDeal));
    document.querySelectorAll('[data-open-market]').forEach(b=>b.onclick=()=>openMarket(b.dataset.openMarket));
    document.querySelectorAll('[data-open-publisher]').forEach(b=>b.onclick=()=>openPublisher(b.dataset.openPublisher));
    document.querySelectorAll('[data-open-game]').forEach(b=>b.onclick=()=>openGame(b.dataset.openGame));
    document.querySelectorAll('[data-open-sourcing]').forEach(b=>b.onclick=()=>openSourcing(b.dataset.openSourcing));
    document.querySelectorAll('[data-open-project]').forEach(b=>b.onclick=()=>openProject(b.dataset.openProject));
  }

  function modal(title,body,onSave,{wide=false,saveText='Save'}={}){
    const readOnly=window.SAVA_SUPABASE?.configured && !window.SAVA_SUPABASE.canEdit();
    modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal ${wide?'wide':''}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close>×</button></div><div class="modal-body">${readOnly?'<div class="notice">Viewer mode · read only</div>':''}${body}</div><div class="modal-foot"><button class="ghost" data-close>${readOnly?'Close':'Cancel'}</button>${readOnly?'':`<button class="primary" data-save>${esc(saveText)}</button>`}</div></div></div>`;
    modalRoot.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>modalRoot.innerHTML='');
    if(readOnly){modalRoot.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=true);return;}
    modalRoot.querySelector('[data-save]').onclick=()=>onSave(modalRoot.querySelector('.modal'));
  }
  function fText(name,label,value='',cls='',type='text'){return `<div class="field ${cls}"><label>${esc(label)}</label><input name="${name}" type="${type}" value="${esc(value??'')}"></div>`;}
  function fArea(name,label,value='',cls='full'){return `<div class="field ${cls}"><label>${esc(label)}</label><textarea name="${name}">${esc(value??'')}</textarea></div>`;}
  function fSelect(name,label,value,options,cls=''){return `<div class="field ${cls}"><label>${esc(label)}</label><select name="${name}">${options.map(o=>`<option value="${esc(o)}" ${String(o)===String(value)?'selected':''}>${esc(o||'—')}</option>`).join('')}</select></div>`;}
  function formVal(root,name){return root.querySelector(`[name="${CSS.escape(name)}"]`)?.value??'';}
  function formNum(root,name){const v=formVal(root,name); return v===''?null:Number(v);}

  function openPartner(id){
    let p=byId(db.partners,id); const isNew=!p;
    if(!p) p={id:`P${String(db.partners.length+1).padStart(3,'0')}`,profile:{},hardGate:{},evidence:{},scores:{},scorecard:{},decision:{}};
    const d=partnerDerived(p);
    const scoreFields=[['trackRecord','Track Record'],['team','Team'],['capacity','Production Capacity'],['cadence','Development Cadence'],['milestone','Milestone Reliability'],['liveOps','LiveOps Scalability'],['dataTech','Data & Tech'],['collaboration','Collaboration'],['dealFit','Deal Fit (separate)'],['strategicFit','Strategic Fit'],['longTerm','Long-term']];
    const evidenceFields=[['trackRecord','Track Record'],['team','Team Structure'],['capacity','Production Capacity'],['cadence','Development Cadence'],['milestone','Milestone Reliability'],['liveOps','LiveOps Scalability'],['dataTech','Data & Tech'],['collaboration','Collaboration'],['publisherHistory','Publisher History'],['deal','Deal Evidence'],['legalIp','Legal / IP'],['strategicFit','Strategic Fit'],['longTerm','Long-term Pipeline']];
    const body=`<div class="notice">Live derived result: Hard Gate <b>${d.hard}</b> · Coverage <b>${pct(d.coverage,0)}</b> · Partner Fit <b>${d.fit??'NE'}</b> · Final <b>${d.final}</b>.</div>
      <div class="section-title">Partner master</div><div class="form-grid three-cols">
      ${fText('id','Partner ID',p.id)}${fText('name','Partner / Studio',profile(p,'Tên Partner / Studio'))}${fText('country','Country',profile(p,'Quốc gia'))}${fText('contact','Founder / Main contact',profile(p,'Founder / Đầu mối chính'))}${fText('teamSize','Team size',profile(p,'Quy mô team'))}${fText('genres','Main genres',profile(p,'Genre chính'))}${fText('platform','Platform',profile(p,'Platform chính'))}${fText('projects','Projects in scope',profile(p,'Dự án đang đánh giá'))}${fText('source','Source',profile(p,'Nguồn'))}${fText('owner','Publishing owner',profile(p,'Owner Publishing'))}${fText('status','Status',profile(p,'Trạng thái'))}${fText('dealModel','Financial model',profile(p,'Mô hình hợp tác tài chính'))}${fText('partnerCommit','Investment to partner',profile(p,'Mức cam kết đầu tư cho Partner'))}${fText('uaCommit','UA commitment',profile(p,'Cam kết UA / Marketing Spend'))}${fText('uaCond','UA condition',profile(p,'Điều kiện cam kết UA'))}${fText('savaShare','SAVA share (0-1)',profile(p,'Rev Share SAVA (%)'),'','number')}${fText('partnerShare','Partner share (0-1)',profile(p,'Rev Share Partner (%)'),'','number')}${fArea('profileNotes','Notes',profile(p,'Ghi chú'))}</div>
      <div class="section-title">Hard Gate</div><div class="form-grid three-cols">${[['legalContract','Pháp lý / Hợp đồng'],['ipSourceRights','IP / source code rights'],['publisherConflict','Publisher conflict'],['dataTransparency','Data transparency'],['teamContinuity','Team continuity'],['compliance','Compliance']].map(([k,l])=>fSelect(`gate_${k}`,l,p.hardGate?.[k]||'Chờ xác minh',GATE_STATUS)).join('')}${fArea('gateEvidence','Gate evidence / notes',p.hardGate?.evidence||'')}${fText('gateOwner','Gate owner',p.hardGate?.owner||'')}${fText('gateDue','Gate due date',p.hardGate?.dueDate||'','','date')}</div>
      <div class="section-title">Evidence & status</div><div class="form-grid">${evidenceFields.map(([k,l])=>`${fArea(`ev_${k}_text`,l,p.evidence?.[k]?.text||'')}${fSelect(`ev_${k}_status`,`${l} · status`,p.evidence?.[k]?.status||'',EVIDENCE_STATUS)}`).join('')}${fText('evSource','Source / updated',p.evidence?.sourceUpdated||'','full')}${fArea('evFollow','Follow-up / owner',p.evidence?.followUp||'')}</div>
      <div class="section-title">Score input 1–5</div><div class="form-grid three-cols">${scoreFields.map(([k,l])=>fText(`score_${k}`,l,p.scores?.[k]??'','','number')).join('')}</div>
      <div class="section-title">Decision</div><div class="form-grid">${fText('decisionReco','Final recommendation',p.decision?.recommendation||'')}${fText('decisionStatus','Decision status',p.decision?.status||'')}${fArea('strengths','Strengths',p.decision?.strengths||'')}${fArea('risks','Risks',p.decision?.risks||'')}${fArea('conditions','Conditions before next stage',p.decision?.conditions||'')}${fArea('nextAction','Next action',p.decision?.nextAction||'')}${fText('decisionOwner','Decision owner',p.decision?.owner||'')}${fText('decisionDate','Decision date',p.decision?.decisionDate?.slice?.(0,10)||p.decision?.decisionDate||'','','date')}${fArea('decisionNotes','Decision notes',p.decision?.notes||'')}</div>`;
    modal(isNew?'Add partner':`${p.id} · ${profile(p,'Tên Partner / Studio')||'Partner'}`,body,(root)=>{
      const oldId=p.id; p.id=formVal(root,'id')||oldId;
      const map={'Tên Partner / Studio':'name','Quốc gia':'country','Founder / Đầu mối chính':'contact','Quy mô team':'teamSize','Genre chính':'genres','Platform chính':'platform','Dự án đang đánh giá':'projects','Nguồn':'source','Owner Publishing':'owner','Trạng thái':'status','Mô hình hợp tác tài chính':'dealModel','Mức cam kết đầu tư cho Partner':'partnerCommit','Cam kết UA / Marketing Spend':'uaCommit','Điều kiện cam kết UA':'uaCond','Ghi chú':'profileNotes'};
      p.profile=p.profile||{}; Object.entries(map).forEach(([k,n])=>p.profile[k]=formVal(root,n)||null); p.profile['Partner ID']=p.id; p.profile['Rev Share SAVA (%)']=formNum(root,'savaShare');p.profile['Rev Share Partner (%)']=formNum(root,'partnerShare');
      p.hardGate=p.hardGate||{}; ['legalContract','ipSourceRights','publisherConflict','dataTransparency','teamContinuity','compliance'].forEach(k=>p.hardGate[k]=formVal(root,`gate_${k}`));p.hardGate.evidence=formVal(root,'gateEvidence');p.hardGate.owner=formVal(root,'gateOwner');p.hardGate.dueDate=formVal(root,'gateDue');
      p.evidence=p.evidence||{}; evidenceFields.forEach(([k])=>p.evidence[k]={text:formVal(root,`ev_${k}_text`),status:formVal(root,`ev_${k}_status`)});p.evidence.sourceUpdated=formVal(root,'evSource');p.evidence.followUp=formVal(root,'evFollow');
      p.scores=p.scores||{}; scoreFields.forEach(([k])=>p.scores[k]=formNum(root,`score_${k}`));
      p.decision={...(p.decision||{}),recommendation:formVal(root,'decisionReco'),status:formVal(root,'decisionStatus'),strengths:formVal(root,'strengths'),risks:formVal(root,'risks'),conditions:formVal(root,'conditions'),nextAction:formVal(root,'nextAction'),owner:formVal(root,'decisionOwner'),decisionDate:formVal(root,'decisionDate'),notes:formVal(root,'decisionNotes'),updatedAt:new Date().toISOString()};
      const der=partnerDerived(p); p.hardGate.result=der.hard;p.evidence.coverage=der.coverage;p.evidence.confidence=der.confidence;p.evidence.minimumGate=der.minimumGate;p.scores.productionComposite=der.production;p.scorecard={...(p.scorecard||{}),partnerFit:der.fit,classification:der.classification,finalConclusion:der.final};
      if(isNew) db.partners.push(p); else if(oldId!==p.id){db.partnerRisks.forEach(r=>{if(r.partnerId===oldId)r.partnerId=p.id;});db.deals.forEach(d=>{if(d.partnerId===oldId)d.partnerId=p.id;});db.sourcing.forEach(s=>{if(s.partnerId===oldId)s.partnerId=p.id;});}
      modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} partner ${p.id}`);
    },{wide:true});
  }

  function openRisk(id){ const r=byId(db.partnerRisks,id); }
  function addRisk(){
    const r={id:`RISK-${String((db.partnerRisks||[]).length+1).padStart(3,'0')}`,partnerId:db.partners[0]?.id||'',risk:'',probability:2,impact:2,mitigation:'',owner:'',status:'Đang mở',dueDate:'',notes:''};
    const body=`<div class="form-grid">${fText('id','Risk ID',r.id)}${fSelect('partnerId','Partner',r.partnerId,db.partners.map(p=>p.id))}${fArea('risk','Risk',r.risk)}${fText('prob','Probability 1-3',r.probability,'','number')}${fText('impact','Impact 1-3',r.impact,'','number')}${fArea('mitigation','Mitigation',r.mitigation)}${fText('owner','Owner',r.owner)}${fSelect('status','Status',r.status,['Đang mở','Đang xử lý','Chấp nhận','Đã đóng'])}${fText('due','Due date',r.dueDate,'','date')}${fArea('notes','Notes',r.notes)}</div>`;
    modal('Add partner risk',body,(root)=>{r.id=formVal(root,'id');r.partnerId=formVal(root,'partnerId');r.risk=formVal(root,'risk');r.probability=formNum(root,'prob');r.impact=formNum(root,'impact');r.score=(r.probability||0)*(r.impact||0);r.level=riskLevel(r.score);r.mitigation=formVal(root,'mitigation');r.owner=formVal(root,'owner');r.status=formVal(root,'status');r.dueDate=formVal(root,'due');r.notes=formVal(root,'notes');db.partnerRisks.push(r);modalRoot.innerHTML='';persist(`Added risk ${r.id}`);});
  }

  function openDeal(id){
    let d=byId(db.deals,id);const isNew=!d;if(!d)d={id:`DEAL-${String(db.deals.length+1).padStart(3,'0')}`,partnerId:db.partners[0]?.id||'',gameId:'',status:'Draft'};
    const body=`<div class="form-grid">${fText('id','Deal ID',d.id)}${fSelect('partnerId','Partner',d.partnerId,db.partners.map(p=>p.id))}${fSelect('gameId','Game',d.gameId||'',['',...db.games.map(g=>g.id)])}${fText('status','Status',d.status||'Draft')}${fText('model','Deal model',d.dealModel||'')}${fText('investment','Investment to partner',d.partnerInvestment||'')}${fText('savaShare','SAVA share (0-1)',d.savaShare??'','','number')}${fText('partnerShare','Partner share (0-1)',d.partnerShare??'','','number')}${fText('mg','MG / upfront',d.mg||'')}${fText('recoup','Recoup waterfall',d.recoup||'')}${fText('uaCommit','UA commitment',d.uaCommitment||'')}${fArea('uaCond','UA condition',d.uaCondition||'')}${fArea('rights','Publishing / IP rights',d.rights||'')}${fText('territory','Territory',d.territory||'')}${fArea('responsibilities','Responsibilities / RACI',d.responsibilities||'')}${fArea('milestones','Milestones / payment gates',d.milestones||'')}${fArea('kpis','KPIs / decision gates',d.kpis||'')}${fArea('control','Control rights / accounts / approvals',d.controlRights||'')}${fArea('stop','Stop / kill condition',d.stopCondition||'')}${fArea('exit','Exit condition',d.exitCondition||'')}${fArea('negotiable','Negotiable areas',d.negotiableAreas||'')}${fText('owner','Owner',d.owner||'')}${fArea('notes','Notes',d.notes||'')}</div>`;
    modal(isNew?'Add deal':d.id,body,(root)=>{const old=d.id;['id','partnerId','gameId','status'].forEach(k=>d[k]=formVal(root,k));d.dealModel=formVal(root,'model');d.partnerInvestment=formVal(root,'investment');d.savaShare=formNum(root,'savaShare');d.partnerShare=formNum(root,'partnerShare');d.mg=formVal(root,'mg');d.recoup=formVal(root,'recoup');d.uaCommitment=formVal(root,'uaCommit');d.uaCondition=formVal(root,'uaCond');d.rights=formVal(root,'rights');d.territory=formVal(root,'territory');d.responsibilities=formVal(root,'responsibilities');d.milestones=formVal(root,'milestones');d.kpis=formVal(root,'kpis');d.controlRights=formVal(root,'control');d.stopCondition=formVal(root,'stop');d.exitCondition=formVal(root,'exit');d.negotiableAreas=formVal(root,'negotiable');d.owner=formVal(root,'owner');d.notes=formVal(root,'notes');if(isNew)db.deals.push(d);modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} deal ${d.id}`);},{wide:true});
  }

  function openMarket(id){
    const m=(db.market||[]).find(x=>x.Mechanic_ID===id);if(!m)return;
    const body=`<div class="form-grid three-cols">${fText('name','Mechanic',m.Mechanic)}${fText('geo','Geography',m.Geography)}${fText('platform','Platform',m.Platform)}${fText('dl30','Downloads 30d',m.Downloads_30d??'','','number')}${fText('dl90','Downloads 90d',m.Downloads_90d??'','','number')}${fText('dl12','Downloads 12m',m.Downloads_12m??'','','number')}${fText('rev30','Revenue 30d USD',m.Revenue_30d_USD??'','','number')}${fText('rev90','Revenue 90d USD',m.Revenue_90d_USD??'','','number')}${fText('rev12','Revenue 12m USD',m.Revenue_12m_USD??'','','number')}${fText('dlg3','DL growth 3m (decimal)',m.DL_Growth_3m??'','','number')}${fText('revg3','Revenue growth 3m (decimal)',m.Rev_Growth_3m??'','','number')}${fText('rpd','Revenue/download',m.Revenue_per_Download_SAME_COHORT??'','','number')}${fText('cpi','CPI median',m.UA_Benchmark?.CPI_Median??'','','number')}</div>`;
    modal(`${id} · ${m.Mechanic}`,body,(root)=>{m.Mechanic=formVal(root,'name');m.Geography=formVal(root,'geo');m.Platform=formVal(root,'platform');m.Downloads_30d=formNum(root,'dl30');m.Downloads_90d=formNum(root,'dl90');m.Downloads_12m=formNum(root,'dl12');m.Revenue_30d_USD=formNum(root,'rev30');m.Revenue_90d_USD=formNum(root,'rev90');m.Revenue_12m_USD=formNum(root,'rev12');m.DL_Growth_3m=formNum(root,'dlg3');m.Rev_Growth_3m=formNum(root,'revg3');m.Revenue_per_Download_SAME_COHORT=formNum(root,'rpd');m.UA_Benchmark=m.UA_Benchmark||{};m.UA_Benchmark.CPI_Median=formNum(root,'cpi');modalRoot.innerHTML='';persist(`Updated market mechanic ${id}`);});
  }

  function openPublisher(id){
    let p=byId(db.publisherLandscape,id);const isNew=!p;if(!p)p={id:`PUBLR-${String(db.publisherLandscape.length+1).padStart(3,'0')}`,name:''};
    const body=`<div class="form-grid">${fText('id','ID',p.id)}${fText('name','Publisher',p.name)}${fText('genres','Focus genres',p.genres||'')}${fArea('looking','What they are looking for',p.lookingFor||'')}${fArea('test','How they test',p.testApproach||'')}${fArea('investment','How they invest',p.investmentApproach||'')}${fArea('deal','Deal approach',p.dealApproach||'')}${fArea('operation','Operation model',p.operationModel||'')}${fText('source','Source / evidence link',p.source||'','full')}${fArea('notes','Notes',p.notes||'')}</div>`;
    modal(isNew?'Add publisher benchmark':p.name,body,(root)=>{p.id=formVal(root,'id');p.name=formVal(root,'name');p.genres=formVal(root,'genres');p.lookingFor=formVal(root,'looking');p.testApproach=formVal(root,'test');p.investmentApproach=formVal(root,'investment');p.dealApproach=formVal(root,'deal');p.operationModel=formVal(root,'operation');p.source=formVal(root,'source');p.notes=formVal(root,'notes');if(isNew)db.publisherLandscape.push(p);modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} publisher benchmark ${p.name}`);});
  }

  function openGame(id){
    let g=byId(db.games,id);const isNew=!g;if(!g)g={id:`PUB-${String(db.games.length+1).padStart(3,'0')}`,intake:{},scorecard:{},tests:[]}; const d=gameDerived(g);
    const body=`<div class="notice">Live derived result: Market <b>${d.market??'NE'}</b> · Pre-Scan <b>${d.prescan??'NE'}</b> · Final <b>${d.final??'NE'}</b> · Gate <b>${d.hard}</b> · ${d.recommendation}.</div>
      <div class="section-title">Candidate</div><div class="form-grid three-cols">${fText('id','Candidate ID',g.id)}${fText('title','Game title',intake(g,'Game_Title'))}${fText('studio','Studio',intake(g,'Studio'))}${fText('mechanic','Mechanic',intake(g,'Mechanic'))}${fText('archetype','Gamefeel archetype',intake(g,'Gamefeel_Archetype'))}${fText('theme','Theme / hook',intake(g,'Theme_Hook'))}${fText('geo','Target GEO',intake(g,'Target_GEO'))}${fSelect('monModel','Monetization',intake(g,'Monetization_Model')||'', ['', 'Hybrid IAP','Hybrid IAA'])}${fText('stage','Build stage',intake(g,'Build_Stage'))}${fText('buildUrl','Build URL',intake(g,'Build_URL'))}${fText('storeUrl','Store URL',intake(g,'Store_URL'))}${fText('owner','Owner',intake(g,'Owner'))}</div>
      <div class="section-title">Hard Gate</div><div class="form-grid three-cols">${[['legal','Gate_Legal_IP','Legal / IP'],['build','Gate_Build_Playable','Playable build'],['tracking','Gate_Tracking_Access','Tracking access'],['store','Gate_Store_Compliance','Store compliance'],['commercial','Gate_Commercial_Terms','Commercial terms'],['rights','Gate_Rights_Confirmed','Rights confirmed']].map(([n,k,l])=>fSelect(`gate_${n}`,l,intake(g,k)||'PENDING',GAME_GATE_STATUS)).join('')}</div>
      <div class="section-title">Market score 1–5</div><div class="form-grid three-cols">${fText('marketSize','Market Size',g.scorecard?.marketSize??'','','number')}${fText('growth','Growth / Momentum',g.scorecard?.growth??'','','number')}${fText('entry','Entry Accessibility',g.scorecard?.entryAccess??'','','number')}${fText('marketMon','Market Monetization',g.scorecard?.marketMonetization??'','','number')}${fText('marketUa','UA / Creative Scalability',g.scorecard?.marketUaScalability??'','','number')}</div>
      <div class="section-title">Publishing / deal / fit 1–5</div><div class="form-grid three-cols">${fText('readiness','Publishing Readiness',g.scorecard?.readiness??'','','number')}${fText('deal','Deal Economics',g.scorecard?.dealEconomics??'','','number')}${fText('savaFit','SAVA Publishing Fit',g.scorecard?.savaFit??'','','number')}${fText('completeness','Data completeness 0-1',g.scorecard?.dataCompleteness??'','','number')}${fText('evidenceQ','Evidence Quality 1-5',g.scorecard?.evidenceQuality??'','','number')}</div>
      <div class="section-title">Post-test product evidence 1–5</div><div class="form-grid three-cols">${fText('uaTest','UA Test',g.scorecard?.uaTest??'','','number')}${fText('retention','Retention',g.scorecard?.retention??'','','number')}${fText('engagement','Engagement',g.scorecard?.engagement??'','','number')}${fText('monTest','Monetization Test',g.scorecard?.monetizationTest??'','','number')}${fText('gamefeel','Gamefeel Test',g.scorecard?.gamefeelTest??'','','number')}${fArea('notes','Decision notes',g.scorecard?.decisionNotes||'')}</div>`;
    modal(isNew?'Add game':`${g.id} · ${intake(g,'Game_Title')}`,body,(root)=>{const old=g.id;g.id=formVal(root,'id')||old;g.intake=g.intake||{};Object.assign(g.intake,{Candidate_ID:g.id,Game_Title:formVal(root,'title'),Studio:formVal(root,'studio'),Mechanic:formVal(root,'mechanic'),Gamefeel_Archetype:formVal(root,'archetype'),Theme_Hook:formVal(root,'theme'),Target_GEO:formVal(root,'geo'),Monetization_Model:formVal(root,'monModel'),Build_Stage:formVal(root,'stage'),Build_URL:formVal(root,'buildUrl'),Store_URL:formVal(root,'storeUrl'),Owner:formVal(root,'owner'),Gate_Legal_IP:formVal(root,'gate_legal'),Gate_Build_Playable:formVal(root,'gate_build'),Gate_Tracking_Access:formVal(root,'gate_tracking'),Gate_Store_Compliance:formVal(root,'gate_store'),Gate_Commercial_Terms:formVal(root,'gate_commercial'),Gate_Rights_Confirmed:formVal(root,'gate_rights')});
      g.scorecard=g.scorecard||{};Object.assign(g.scorecard,{marketSize:formNum(root,'marketSize'),growth:formNum(root,'growth'),entryAccess:formNum(root,'entry'),marketMonetization:formNum(root,'marketMon'),marketUaScalability:formNum(root,'marketUa'),readiness:formNum(root,'readiness'),dealEconomics:formNum(root,'deal'),savaFit:formNum(root,'savaFit'),dataCompleteness:formNum(root,'completeness'),evidenceQuality:formNum(root,'evidenceQ'),uaTest:formNum(root,'uaTest'),retention:formNum(root,'retention'),engagement:formNum(root,'engagement'),monetizationTest:formNum(root,'monTest'),gamefeelTest:formNum(root,'gamefeel'),decisionNotes:formVal(root,'notes')});const der=gameDerived(g);Object.assign(g.scorecard,{marketScore:der.market,productScore:der.product,preScanScore:der.prescan,finalScore:der.final,hardGate:der.hard,decisionStage:der.stage,recommendation:der.recommendation});if(isNew)db.games.push(g); else if(old!==g.id){db.sourcing.forEach(s=>{if(s.gameId===old)s.gameId=g.id;});db.deals.forEach(d=>{if(d.gameId===old)d.gameId=g.id;});}modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} game ${g.id}`);},{wide:true});
  }

  function openSourcing(id){
    let x=byId(db.sourcing,id);const isNew=!x;if(!x)x={id:`SRC-${String(db.sourcing.length+1).padStart(3,'0')}`,partnerId:'',gameId:'',leadName:'',stage:'Lead'};
    const body=`<div class="form-grid">${fText('id','ID',x.id)}${fText('lead','Lead / Studio / Game',x.leadName||'')}${fSelect('partner','Partner link',x.partnerId||'', ['',...db.partners.map(p=>p.id)])}${fSelect('game','Game link',x.gameId||'', ['',...db.games.map(g=>g.id)])}${fText('source','Source',x.source||'')}${fSelect('stage','Stage',x.stage||'Lead',STAGES)}${fText('owner','Owner',x.owner||'')}${fText('created','Created date',x.createdAt?.slice?.(0,10)||x.createdAt||'','','date')}${fArea('next','Next action',x.nextAction||'')}${fArea('lost','Reason lost / disqualified',x.reasonLost||'')}${fArea('notes','Notes',x.notes||'')}</div>`;
    modal(isNew?'Add sourcing lead':x.leadName||x.id,body,(root)=>{x.id=formVal(root,'id');x.leadName=formVal(root,'lead');x.partnerId=formVal(root,'partner');x.gameId=formVal(root,'game');x.source=formVal(root,'source');x.stage=formVal(root,'stage');x.owner=formVal(root,'owner');x.createdAt=formVal(root,'created');x.updatedAt=new Date().toISOString();x.nextAction=formVal(root,'next');x.reasonLost=formVal(root,'lost');x.notes=formVal(root,'notes');if(isNew)db.sourcing.push(x);modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} sourcing ${x.id}`);});
  }

  function evaluateProject(p,m){
    const phase=(p.sopStage||p.gatePhase||'').toLowerCase();const model=p.monetizationModel;const mature=m.dataMature!==false;const p0=m.p0Pass!==false;const content=m.contentRunway!==false;const attempt=num(m.attempt)||1;
    if(!mature||!p0||!content) return {result:'HOLD',reason:'P0 / tracking / maturity / content runway is not valid.'};
    if(/product/.test(phase)){
      const cpi=num(m.cpi),bench=num(m.cpiBenchmark),d1=num(m.d1),crash=num(m.crash),anr=num(m.anr),play=num(m.playtime);
      if(cpi!==null&&bench!==null&&cpi>bench*1.2 || d1!==null&&d1<.28 || attempt>=2 && !((cpi!==null&&bench!==null&&cpi<=bench*1.2)&&(crash!==null&&crash<.01)&&(anr!==null&&anr<.005)&&(play!==null&&play>=10)&&(d1!==null&&d1>=.35))) return {result:'FAIL / STOP',reason:'Hard FAIL floor or max attempt reached.'};
      if([cpi,bench,crash,anr,play,d1].every(x=>x!==null)&&cpi<=bench*1.2&&crash<.01&&anr<.005&&play>=10&&d1>=.35) return {result:'PASS',reason:'Product Test gate passed.'};
      return {result:'TEST THÊM',reason:'Valid cohort but Product Test PASS is not fully met.'};
    }
    if(/monet/.test(phase)){
      const r14=num(m.roasD14),rv=num(m.rvEngagement);
      if(model==='Hybrid IAA'){
        if(r14!==null&&r14<.64 || rv!==null&&rv<.32 || attempt>=2 && !(r14!==null&&r14>=.8&&rv!==null&&rv>=.4)) return {result:'FAIL / STOP',reason:'Hybrid IAA hard fail floor or max attempt.'};
        if(r14!==null&&rv!==null&&r14>=.8&&rv>=.4) return {result:'PASS',reason:'ROAS D14 ≥80% and RV engagement ≥40%.'};
        return {result:'TEST THÊM',reason:'Above hard fail floor but below IAA PASS.'};
      }
      if(r14!==null&&r14<.96 || attempt>=2 && !(r14!==null&&r14>=1.2)) return {result:'FAIL / STOP',reason:'Hybrid IAP hard fail floor or max attempt.'};
      if(r14!==null&&r14>=1.2) return {result:'PASS',reason:'ROAS D14 ≥120%.'};
      return {result:'TEST THÊM',reason:'ROAS D14 is between test-more floor and PASS.'};
    }
    if(/big|expansion/.test(phase)){
      const r14=num(m.roasD14),floor=model==='Hybrid IAA'?.8:1.0;if(r14===null)return {result:'HOLD',reason:'D14 is not mature / missing.'};return r14>=floor?{result:'PASS',reason:`D14 operating floor ≥${floor*100}%.`}:{result:'FAIL / ROLLBACK',reason:'D14 fell below expansion operating floor.'};
    }
    if(/scale/.test(phase)){
      const r14=num(m.roasD14),d21=num(m.roasD21),d30=num(m.roasD30);if(model==='Hybrid IAA'){if([r14,d21,d30].some(x=>x===null))return {result:'HOLD',reason:'D21/D30 not mature.'};return r14>=.8&&d21>=1.1&&d30>=1.3?{result:'PASS',reason:'IAA scale gate passed.'}:{result:'TEST THÊM / ROLLBACK',reason:'IAA scale targets not fully met.'};}return r14!==null&&r14>=1?{result:'PASS / CHECK APPROVED REF',reason:'D14 floor passed; compare D21/D30 with frozen Approved Scale Reference.'}:{result:'FAIL / ROLLBACK',reason:'IAP D14 operating floor <100%.'};
    }
    return {result:'REVIEW',reason:'No automatic rule mapped to this stage.'};
  }

  function openProject(id){
    let p=byId(db.projects,id);const isNew=!p;if(!p)p={id:`PRJ-${String(db.projects.length+1).padStart(3,'0')}`,name:'',deploymentStatus:'Sắp triển khai',sopStage:'P0 / Chờ Product Test',monetizationModel:'Hybrid IAP',publishingFlow:'Luồng 1',gatePhase:'P0 – Publishing Preflight',gateReview:{metrics:{}}};p.gateReview=p.gateReview||{metrics:{}};const m=p.gateReview.metrics||{};
    const body=`<div class="form-grid three-cols">${fText('id','Project ID',p.id)}${fText('name','Project',p.name)}${fText('status','Deployment status',p.deploymentStatus||'')}${fText('genre','Genre',p.genre||'')}${fSelect('model','Monetization',p.monetizationModel||'Hybrid IAP',['Hybrid IAP','Hybrid IAA'])}${fSelect('flow','Publishing flow',p.publishingFlow||'Luồng 1',['Luồng 1','Luồng 2'])}${fText('stage','SOP stage',p.sopStage||'')}${fText('gate','Current gate / phase',p.gatePhase||'')}${fText('owner','Owner',p.owner||'')}${fArea('action','Next action',p.nextAction||'')}${fText('evidence','Evidence / link',p.evidenceLink||'','full')}</div>
      <div class="section-title">Gate review metrics</div><div class="form-grid three-cols">${fText('attempt','Attempt',m.attempt??1,'','number')}${fSelect('p0','P0 / tracking valid',String(m.p0Pass??true),['true','false'])}${fSelect('mature','Data mature',String(m.dataMature??true),['true','false'])}${fSelect('content','Content runway valid',String(m.contentRunway??true),['true','false'])}${fText('cpi','CPI',m.cpi??'','','number')}${fText('cpiBench','CPI benchmark',m.cpiBenchmark??'','','number')}${fText('crash','Crash rate (0-1)',m.crash??'','','number')}${fText('anr','ANR rate (0-1)',m.anr??'','','number')}${fText('playtime','Playtime min/day',m.playtime??'','','number')}${fText('d1','D1 retention (0-1)',m.d1??'','','number')}${fText('r14','ROAS D14 (0-1)',m.roasD14??'','','number')}${fText('rv','RV engagement (0-1)',m.rvEngagement??'','','number')}${fText('r21','ROAS D21 (0-1)',m.roasD21??'','','number')}${fText('r30','ROAS D30 (0-1)',m.roasD30??'','','number')}</div>`;
    modal(isNew?'Add project':p.name,body,(root)=>{p.id=formVal(root,'id');p.name=formVal(root,'name');p.deploymentStatus=formVal(root,'status');p.genre=formVal(root,'genre');p.monetizationModel=formVal(root,'model');p.publishingFlow=formVal(root,'flow');p.sopStage=formVal(root,'stage');p.gatePhase=formVal(root,'gate');p.owner=formVal(root,'owner');p.nextAction=formVal(root,'action');p.evidenceLink=formVal(root,'evidence');const met={attempt:formNum(root,'attempt'),p0Pass:formVal(root,'p0')==='true',dataMature:formVal(root,'mature')==='true',contentRunway:formVal(root,'content')==='true',cpi:formNum(root,'cpi'),cpiBenchmark:formNum(root,'cpiBench'),crash:formNum(root,'crash'),anr:formNum(root,'anr'),playtime:formNum(root,'playtime'),d1:formNum(root,'d1'),roasD14:formNum(root,'r14'),rvEngagement:formNum(root,'rv'),roasD21:formNum(root,'r21'),roasD30:formNum(root,'r30')};const evalr=evaluateProject(p,met);p.gateReview={metrics:met,result:evalr.result,reason:evalr.reason,reviewedAt:new Date().toISOString(),reviewedBy:db.settings?.currentUser||''};p.latestDecision=evalr.result;if(isNew)db.projects.push(p);modalRoot.innerHTML='';persist(`${isNew?'Added':'Reviewed'} project ${p.name}: ${evalr.result}`);toast(`${p.name}: ${evalr.result}`);},{wide:true,saveText:'Save & evaluate'});
  }

  function openSync(){
    const g=db.settings?.github||{};const token=sessionStorage.getItem(TOKEN_KEY)||'';
    const body=`<div class="notice warn">GitHub Pages is static. Team sync is implemented by committing <b>data/db.json</b> through the GitHub Contents API. Use a fine-grained token with Contents: Read & Write for this repo. The token is stored only in <b>sessionStorage</b>, never in the repo.</div><div class="form-grid">${fText('owner','Repository owner',g.owner||'')}${fText('repo','Repository name',g.repo||'')}${fText('branch','Branch',g.branch||'main')}${fText('path','Data path',g.path||'data/db.json')}${fText('user','Your name',db.settings?.currentUser||'')}${fText('token','GitHub token (this browser session)',token,'full','password')}</div><div class="section-title">Actions</div><div class="toolbar"><button class="ghost" data-pull>Pull latest from GitHub</button><button class="primary" data-push>Commit current data to GitHub</button><button class="danger" data-reset>Reset local to packaged seed</button></div><div id="syncMsg" class="notice" style="margin-top:12px">Conflict protection uses the file SHA from the latest Pull.</div>`;
    modal('GitHub Sync',body,(root)=>{saveSyncSettings(root);modalRoot.innerHTML='';persist('Updated GitHub sync settings');},{saveText:'Save settings'});
    modalRoot.querySelector('[data-pull]').onclick=()=>githubPull(modalRoot.querySelector('.modal'));
    modalRoot.querySelector('[data-push]').onclick=()=>githubPush(modalRoot.querySelector('.modal'));
    modalRoot.querySelector('[data-reset]').onclick=()=>{if(confirm('Reset local database to packaged seed?')){db=clone(SEED);localStorage.setItem(LOCAL_KEY,JSON.stringify(db));modalRoot.innerHTML='';render();toast('Local data reset to packaged seed');}};
  }
  function saveSyncSettings(root){db.settings=db.settings||{};db.settings.github={owner:formVal(root,'owner'),repo:formVal(root,'repo'),branch:formVal(root,'branch')||'main',path:formVal(root,'path')||'data/db.json'};db.settings.currentUser=formVal(root,'user');const t=formVal(root,'token');if(t)sessionStorage.setItem(TOKEN_KEY,t);}
  function b64decode(str){const bin=atob(str.replace(/\n/g,''));const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
  function b64encode(str){const bytes=new TextEncoder().encode(str);let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin);}
  async function githubPull(root){
    saveSyncSettings(root);const localSettings=clone(db.settings||{}),g=localSettings.github,t=sessionStorage.getItem(TOKEN_KEY);const msg=root.querySelector('#syncMsg');if(!g.owner||!g.repo||!t){msg.textContent='Owner, repo and token are required.';return;}msg.textContent='Loading latest data…';
    try{const u=`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${g.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(g.branch)}`;const r=await fetch(u,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${t}`,'X-GitHub-Api-Version':'2022-11-28'}});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);const j=await r.json();githubSha=j.sha;const remote=JSON.parse(b64decode(j.content));remote.settings={...(remote.settings||{}),github:localSettings.github,currentUser:localSettings.currentUser||''};db=remote;localStorage.setItem(LOCAL_KEY,JSON.stringify(db));msg.textContent=`Pulled ${g.path} · SHA ${githubSha.slice(0,8)}. Local view updated.`;render();toast('Pulled latest GitHub data');}catch(e){msg.textContent=`Pull failed: ${e.message}`;}
  }
  async function githubPush(root){
    saveSyncSettings(root);const g=db.settings.github,t=sessionStorage.getItem(TOKEN_KEY);const msg=root.querySelector('#syncMsg');if(!g.owner||!g.repo||!t){msg.textContent='Owner, repo and token are required.';return;}if(!githubSha){msg.textContent='Pull latest from GitHub first. This prevents overwriting a teammate\'s newer commit.';return;}msg.textContent='Committing data…';
    try{const u=`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${g.path.split('/').map(encodeURIComponent).join('/')}`;const body={message:`Update Publishing OS data${db.settings.currentUser?' by '+db.settings.currentUser:''}`,content:b64encode(JSON.stringify(db,null,2)),branch:g.branch,sha:githubSha};const r=await fetch(u,{method:'PUT',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${t}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);const j=await r.json();githubSha=j.content?.sha||null;msg.textContent=`Committed successfully${githubSha?' · SHA '+githubSha.slice(0,8):''}.`;toast('Committed data to GitHub');}catch(e){msg.textContent=`Push failed: ${e.message}. Another teammate may have changed the file; Pull latest, review, then push again.`;}
  }

  function exportJson(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`sava-publishing-os-${today()}.json`;a.click();URL.revokeObjectURL(a.href);}
  function importJson(file){if(window.SAVA_SUPABASE?.configured&&!window.SAVA_SUPABASE.canDelete()){alert('Only Admin can import a full database.');return;}const fr=new FileReader();fr.onload=()=>{try{const x=JSON.parse(fr.result);if(!x.partners||!x.games)throw new Error('Not a Publishing OS database');db=x;persist('Imported JSON database');toast('Imported database and queued cloud sync');}catch(e){alert(`Import failed: ${e.message}`);}};fr.readAsText(file);}

  document.addEventListener('click',e=>{
    const a=e.target.closest('[data-action]');if(!a)return;
    const act=a.dataset.action;
    if(act==='account')window.SAVA_SUPABASE?.accountAction?.(); else if(act==='refresh-cloud')refreshCloud(); else if(act==='open-sync')openSync(); else if(act==='export-json')exportJson(); else if(act==='quick-add'){({partners:()=>openPartner(),deals:()=>openDeal(),market:()=>openPublisher(),games:()=>openGame(),sourcing:()=>openSourcing(),operations:()=>openProject()}[currentView]||(()=>openSourcing()))();}
    else if(act==='add-partner')openPartner();else if(act==='add-risk')addRisk();else if(act==='add-deal')openDeal();else if(act==='add-publisher')openPublisher();else if(act==='add-game')openGame();else if(act==='add-sourcing')openSourcing();else if(act==='add-project')openProject();
  });
  $('#globalSearch').addEventListener('input',e=>{searchTerm=e.target.value;render();});
  $('#importJson').addEventListener('change',e=>{if(e.target.files[0])importJson(e.target.files[0]);e.target.value='';});
  window.addEventListener('hashchange',()=>{currentView=location.hash.replace('#','')||'dashboard';render();});

  async function refreshCloud(silent=false){
    if(!window.SAVA_SUPABASE?.configured)return;
    if(isSyncing){if(!silent)toast('A save is still syncing');return;}
    try{
      if(!silent)$('#saveState').textContent='Refreshing…';
      db=await window.SAVA_SUPABASE.loadDb();
      localStorage.setItem(LOCAL_KEY,JSON.stringify(db));
      render();
      if(!silent)toast('Latest team data loaded');
    }catch(e){
      console.error(e);
      $('#saveState').textContent='Refresh error';
      if(!silent)toast(`Refresh failed: ${e.message}`);
    }
  }

  async function boot(){
    try{
      if(window.SAVA_SUPABASE?.configured){
        $('#saveState').textContent='Connecting…';
        db=await window.SAVA_SUPABASE.init();
        localStorage.setItem(LOCAL_KEY,JSON.stringify(db));
        render();
        setInterval(()=>{if(document.visibilityState==='visible'&&!modalRoot.innerHTML&&!isSyncing)refreshCloud(true);},60000);
        return;
      }
    }catch(e){
      console.error(e);
      alert(`Supabase connection failed: ${e.message}`);
    }
    db=loadLocal()||clone(SEED);
    render();
  }

  boot();
})();
