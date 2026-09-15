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
  function score100(v){ const n=num(v); if(n===null) return null; return Math.max(0,Math.min(100,n<=5?n*20:n)); }
  function avgScore100(...vals){ const xs=vals.map(score100).filter(x=>x!==null); return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null; }
  function displayScore100(v){ const n=score100(v); return n===null?'—':`${fmt(n,1)}/100`; }
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

  // Thresholds follow 04_Scorecard in the source Partner Selection workbook:
  // >=85 Ưu tiên · >=75 Đạt · >=65 Có điều kiện · <65 Cần xem xét.
  function scoreBand(value){
    const n=num(value);
    if(n===null) return {key:'na',label:'Chưa chấm'};
    if(n>=85) return {key:'priority',label:'Ưu tiên'};
    if(n>=75) return {key:'pass',label:'Đạt'};
    if(n>=65) return {key:'conditional',label:'Có điều kiện'};
    return {key:'review',label:'Cần xem xét'};
  }
  function scoreBar(value,{showLabel=false}={}){
    const n=num(value), band=scoreBand(value);
    const width=n===null?0:Math.max(0,Math.min(100,n));
    return `<div class="score-stack score-${band.key}" title="${n===null?'Chưa có điểm':`${fmt(n,1)}/100 · ${band.label}`}"><div class="score-row"><strong>${n===null?'—':fmt(n,1)}</strong><span class="scorebar ${band.key}"><i style="width:${width}%"></i></span></div>${showLabel?`<div class="score-band-label">${esc(band.label)}</div>`:''}</div>`;
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
  function productionPotentialDerived(p){
    const s=p.scores||{}, pp=p.productionPotential||{};
    const dims={
      teamCapacity: score100(pp.teamCapacity) ?? avgScore100(s.team,s.capacity),
      productQuality: score100(pp.productQuality) ?? avgScore100(s.trackRecord,s.milestone),
      productionSpeed: score100(pp.productionSpeed) ?? avgScore100(s.cadence,s.milestone),
      technical: score100(pp.technical) ?? score100(s.dataTech),
      liveOps: score100(pp.liveOps) ?? score100(s.liveOps),
      scalability: score100(pp.scalability) ?? avgScore100(s.capacity,s.longTerm)
    };
    const vals=Object.values(dims).filter(x=>x!==null);
    const overall=vals.length>=3?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:null;
    const maturity=pp.maturity || (overall===null?'Chưa đánh giá':overall>=85?'Scale-ready':overall>=70?'LiveOps':overall>=55?'Full Game':'Prototype');
    return {overall,maturity,dims,notes:pp.notes||''};
  }
  function partnerDerived(p){
    const s=p.scores||{}, ev=evidenceDerived(p);
    const prodScores=['capacity','cadence','milestone','liveOps'].map(k=>score100(s[k])).filter(x=>x!==null);
    const production=prodScores.length===4?prodScores.reduce((a,b)=>a+b,0)/4:score100(s.productionComposite);
    const parts=[['trackRecord',10],['team',15],['production',15],['dataTech',10],['collaboration',15],['strategicFit',15],['longTerm',10]];
    const source={
      trackRecord:score100(s.trackRecord),team:score100(s.team),production,
      dataTech:score100(s.dataTech),collaboration:score100(s.collaboration),
      strategicFit:score100(s.strategicFit),longTerm:score100(s.longTerm)
    };
    const complete=parts.every(([k])=>num(source[k])!==null);
    const totalWeight=parts.reduce((a,[,w])=>a+w,0);
    const fit=complete?Math.round(parts.reduce((sum,[k,w])=>sum+source[k]*w,0)/totalWeight*10)/10:null;
    const classification=fit===null?'NE':fit>=85?'Ưu tiên':fit>=75?'Đạt':fit>=65?'Có điều kiện':'Cần xem xét';
    const hard=hardGateResult(p);
    const final=hard==='KHÔNG ĐẠT'?'Bị chặn':hard==='CHỜ XÁC MINH'?'Chờ xác minh':ev.minimumGate!=='ĐẠT'?'Thiếu Evidence':classification;
    return {production,fit,classification,hard,productionPotential:productionPotentialDerived(p),...ev,final};
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
  function nextRiskId(){
    const max=(db.partnerRisks||[]).reduce((m,r)=>{const hit=String(r.id||'').match(/(\d+)$/);return Math.max(m,hit?Number(hit[1]):0);},0);
    return `RISK-${String(max+1).padStart(3,'0')}`;
  }
  function partnerRiskStats(partnerId){
    const all=(db.partnerRisks||[]).filter(r=>r.partnerId===partnerId);
    const open=all.filter(r=>r.status!=='Đã đóng');
    const high=open.filter(r=>['Cao','Nghiêm trọng'].includes(r.level||riskLevel(r.score)));
    return {all,open,high};
  }

  function nav(){
    $('#mainNav').innerHTML=NAV.map(([id,n,label])=>`<button data-nav="${id}" class="${currentView===id?'active':''}"><span class="num">${n}</span>${label}</button>`).join('');
    $('#mainNav').querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{currentView=b.dataset.nav;location.hash=currentView;render();});
  }
  function setHeader(title,eyebrow='Publishing Operating System'){$('#pageTitle').textContent=title;$('#pageEyebrow').textContent=eyebrow;}
  function kpi(label,value,sub=''){return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;}
  function panel(title,body,subtitle='',actions=''){return `<div class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${actions}</div><div class="panel-body">${body}</div></div>`;}
  function table(headers,rows,extraClass=''){return `<div class="table-wrap"><table class="table ${extraClass}"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="empty">Không có dữ liệu</td></tr>`}</tbody></table></div>`;}

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
    const partnerRows=db.partners.filter(p=>includesSearch(p.id,profile(p,'Tên Partner / Studio'),profile(p,'Genre chính'))).map(p=>{const d=partnerDerived(p);return `<tr><td><button class="linkish" data-open-partner="${p.id}">${p.id}</button></td><td><b>${esc(profile(p,'Tên Partner / Studio'))}</b><div class="small muted">${esc(profile(p,'Genre chính')||'')}</div></td><td>${badge(d.hard)}</td><td>${scoreBar(d.fit)}</td><td>${badge(d.final)}</td><td>${esc(p.decision?.nextAction||p.scorecard?.nextAction||'—')}</td></tr>`;});
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
    const rows=db.partners.filter(p=>includesSearch(p.id,profile(p,'Tên Partner / Studio'),profile(p,'Genre chính'),profile(p,'Trạng thái'))).map(p=>{
      const d=partnerDerived(p),rs=partnerRiskStats(p.id),prod=d.productionPotential;
      const riskText=rs.open.length?`${rs.open.length} đang mở${rs.high.length?` · ${rs.high.length} cao`:''}`:'Không có risk mở';
      const sava=profile(p,'Rev Share SAVA (%)'),partner=profile(p,'Rev Share Partner (%)');
      const shareText=(num(sava)!==null||num(partner)!==null)?`${num(sava)!==null?pct(sava,0):'—'} / ${num(partner)!==null?pct(partner,0):'—'}`:'—';
      const nextFull=p.decision?.nextAction||p.scorecard?.nextAction||'—';
      const next=clipText(nextFull,72);
      const uaCommit=profile(p,'Cam kết UA / Marketing Spend')||'—';
      const uaCondFull=profile(p,'Điều kiện cam kết UA')||'—';
      const uaCond=clipText(uaCondFull,62);
      const model=profile(p,'Mô hình hợp tác tài chính')||'—';
      const fee=profile(p,'Mức cam kết đầu tư cho Partner')||'—';
      const partnerName=profile(p,'Tên Partner / Studio')||p.id;
      return `<tr>
        <td class="partner-cell"><button class="linkish partner-name" data-open-partner="${p.id}">${esc(partnerName)}</button><div class="small muted">${esc(p.id)} · ${esc(profile(p,'Quốc gia')||'—')} · ${esc(profile(p,'Quy mô team')||'—')}</div><button class="row-delete" data-delete-partner="${p.id}" title="Xóa đối tác">Xóa</button></td>
        <td class="compact-text">${esc(profile(p,'Genre chính')||'—')}</td>
        <td>${badge(profile(p,'Trạng thái')||'—')}</td>
        <td>${scoreBar(prod.overall,{showLabel:true})}<div class="small muted maturity">${esc(prod.maturity)}</div></td>
        <td>${scoreBar(d.fit,{showLabel:true})}</td>
        <td class="commercial-cell" title="${esc(`${model} · ${fee}`)}"><b>${esc(model)}</b><div class="small muted ellipsis-2">${esc(fee)}</div></td>
        <td class="nowrap share-cell"><b>${esc(shareText)}</b></td>
        <td class="ua-cell" title="${esc(`${uaCommit} · ${uaCondFull}`)}"><b>${esc(uaCommit)}</b><div class="small muted ellipsis-2">${esc(uaCond)}</div></td>
        <td>${badge(riskText)}</td>
        <td>${badge(d.final)}</td>
        <td class="next-cell" title="${esc(nextFull)}">${esc(next)}</td>
      </tr>`;
    });
    const portfolioRisks=(db.partnerRisks||[]).filter(r=>includesSearch(r.partnerId,r.risk,r.level,r.owner)).map(r=>{
      const p=byId(db.partners,r.partnerId);
      return `<tr><td><button class="linkish" data-open-partner="${esc(r.partnerId)}">${esc(profile(p,'Tên Partner / Studio')||r.partnerId)}</button><div class="small muted">${esc(r.partnerId)}</div></td><td>${esc(r.risk)}</td><td class="num">${r.probability}×${r.impact}</td><td>${badge(r.level||riskLevel(r.score))}</td><td>${esc(r.mitigation||'—')}</td><td>${badge(r.status||'—')}</td></tr>`;
    });
    const stats=db.partners.map(p=>({p,d:partnerDerived(p),r:partnerRiskStats(p.id)}));
    const active=stats.filter(x=>!['Tạm dừng','Dừng','Đã dừng','Stopped'].includes(profile(x.p,'Trạng thái'))).length;
    const priority=stats.filter(x=>['Ưu tiên','Đạt'].includes(x.d.classification)).length;
    const ready=stats.filter(x=>x.d.hard==='ĐẠT'&&x.d.minimumGate==='ĐẠT'&&['Ưu tiên','Đạt'].includes(x.d.classification)).length;
    const blocked=stats.filter(x=>x.d.hard!=='ĐẠT'||x.r.high.length>0).length;
    const legend=`<div class="score-legend"><span class="legend-title">Màu điểm theo rule file gốc</span><span><i class="legend-dot priority"></i>≥85 Ưu tiên</span><span><i class="legend-dot pass"></i>≥75 Đạt</span><span><i class="legend-dot conditional"></i>≥65 Có điều kiện</span><span><i class="legend-dot review"></i>&lt;65 Cần xem xét</span></div>`;
    const partnerTable=table(['Đối tác','Thể loại','Giai đoạn','Tiềm lực SX /100','Phù hợp /100','Hợp tác','SAVA / Đối tác','UA','Rủi ro','Kết luận','Hành động tiếp theo'],rows,'partner-master-table');
    content.innerHTML=`<div class="grid kpis">${kpi('Đối tác đang hoạt động',active)}${kpi('Đối tác ưu tiên',priority,'Mức độ phù hợp ≥ 75/100')}${kpi('Sẵn sàng đi tiếp',ready,'Hard Gate + Evidence + điểm phù hợp đạt')}${kpi('Bị chặn / Risk cao',blocked,'Cần xử lý trước khi tăng cam kết')}</div>
      ${panel('Danh sách đối tác',legend+partnerTable,'Bảng rút gọn: mô hình + phí đối tác được gom ở Hợp tác; cam kết + điều kiện được gom ở UA. Click tên Partner để xem chi tiết.',`<button class="primary" data-action="add-partner">+ Partner</button>`)}
      ${panel('Tổng quan risk · Toàn bộ đối tác',table(['Đối tác','Risk','P×I','Mức độ','Cách xử lý','Trạng thái'],portfolioRisks),'Để thêm / sửa / xóa risk, mở đúng Partner ở bảng phía trên.')}`;
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

  const PARTNER_GATE_LABELS={
    legalContract:'Pháp lý / hợp đồng',ipSourceRights:'Quyền IP / source code',publisherConflict:'Xung đột Publisher',dataTransparency:'Minh bạch dữ liệu',teamContinuity:'Tính ổn định của team',compliance:'Tuân thủ'
  };
  const PARTNER_EVIDENCE_LABELS={
    trackRecord:'Thành tích sản phẩm',team:'Cấu trúc team',capacity:'Năng lực sản xuất',cadence:'Tốc độ phát triển',milestone:'Độ tin cậy milestone',liveOps:'Khả năng LiveOps',dataTech:'Dữ liệu & kỹ thuật',collaboration:'Khả năng phối hợp',publisherHistory:'Lịch sử làm việc với Publisher',deal:'Thông tin Deal',legalIp:'Pháp lý / IP',strategicFit:'Mức độ phù hợp chiến lược',longTerm:'Tiềm năng hợp tác dài hạn'
  };
  const PARTNER_SCORE_LABELS={trackRecord:'Thành tích sản phẩm',team:'Năng lực team',production:'Năng lực sản xuất',dataTech:'Dữ liệu & kỹ thuật',collaboration:'Khả năng phối hợp',strategicFit:'Phù hợp chiến lược',longTerm:'Tiềm năng dài hạn'};

  function clipText(v,max=180){
    const t=String(v||'').replace(/\s+/g,' ').trim();
    return t.length>max?`${t.slice(0,max-1).trim()}…`:t;
  }
  function unique(items){return [...new Set((items||[]).filter(Boolean))];}
  function bullets(items,fallback='—'){const x=unique(items);return x.length?x.map(v=>`• ${v}`).join('\n'):fallback;}

  function partnerDraftFromForm(root,p,scoreFields,evidenceFields){
    const draft=clone(p||{});draft.id=formVal(root,'id')||p?.id||'';
    draft.profile={...(draft.profile||{})};
    const map={'Tên Partner / Studio':'name','Quốc gia':'country','Founder / Đầu mối chính':'contact','Quy mô team':'teamSize','Genre chính':'genres','Platform chính':'platform','Dự án đang đánh giá':'projects','Nguồn':'source','Owner Publishing':'owner','Trạng thái':'status','Mô hình hợp tác tài chính':'dealModel','Mức cam kết đầu tư cho Partner':'partnerCommit','Cam kết UA / Marketing Spend':'uaCommit','Điều kiện cam kết UA':'uaCond','Ghi chú':'profileNotes'};
    Object.entries(map).forEach(([k,n])=>draft.profile[k]=formVal(root,n)||null);
    draft.profile['Partner ID']=draft.id;draft.profile['Rev Share SAVA (%)']=formNum(root,'savaShare');draft.profile['Rev Share Partner (%)']=formNum(root,'partnerShare');
    draft.hardGate={...(draft.hardGate||{})};
    Object.keys(PARTNER_GATE_LABELS).forEach(k=>draft.hardGate[k]=formVal(root,`gate_${k}`));
    draft.hardGate.evidence=formVal(root,'gateEvidence');draft.hardGate.owner=formVal(root,'gateOwner');draft.hardGate.dueDate=formVal(root,'gateDue');
    draft.evidence={...(draft.evidence||{})};
    evidenceFields.forEach(([k])=>draft.evidence[k]={text:formVal(root,`ev_${k}_text`),status:formVal(root,`ev_${k}_status`)});
    draft.evidence.sourceUpdated=formVal(root,'evSource');draft.evidence.followUp=formVal(root,'evFollow');
    draft.scores={...(draft.scores||{})};scoreFields.forEach(([k])=>draft.scores[k]=formNum(root,`score_${k}`));
    draft.productionPotential={...(draft.productionPotential||{}),teamCapacity:formNum(root,'prod_teamCapacity'),productQuality:formNum(root,'prod_productQuality'),productionSpeed:formNum(root,'prod_productionSpeed'),technical:formNum(root,'prod_technical'),liveOps:formNum(root,'prod_liveOps'),scalability:formNum(root,'prod_scalability'),maturity:formVal(root,'prod_maturity'),notes:formVal(root,'prod_notes')};
    return draft;
  }

  function generatePartnerDecision(p,originalId=''){
    const d=partnerDerived(p),s=p.scores||{},e=p.evidence||{};
    const hardPending=[],hardFailed=[];
    Object.entries(PARTNER_GATE_LABELS).forEach(([k,label])=>{
      const status=p.hardGate?.[k]||'Chờ xác minh';
      if(status==='Không đạt')hardFailed.push(label);
      else if(status!=='Đạt')hardPending.push(label);
    });
    const scoreItems=[
      ['trackRecord',score100(s.trackRecord)],['team',score100(s.team)],['production',score100(d.production)],['dataTech',score100(s.dataTech)],['collaboration',score100(s.collaboration)],['strategicFit',score100(s.strategicFit)],['longTerm',score100(s.longTerm)]
    ];
    const strengths=[];
    scoreItems.filter(([,v])=>v!==null&&v>=80).sort((a,b)=>b[1]-a[1]).slice(0,4).forEach(([k,v])=>strengths.push(`${PARTNER_SCORE_LABELS[k]} nổi bật (${fmt(v,1)}/100).`));
    ['trackRecord','team','capacity','dataTech','collaboration','deal','strategicFit','longTerm'].forEach(k=>{
      const item=e[k];if(item?.text&&evidenceValid(item.status)&&strengths.length<6)strengths.push(`${PARTNER_EVIDENCE_LABELS[k]}: ${clipText(item.text)}${item.status?` (${item.status})`:''}.`);
    });
    if(!strengths.length&&d.fit!==null&&d.fit>=65)strengths.push(`Partner Fit hiện tại ${fmt(d.fit,1)}/100 (${d.classification}).`);
    if(d.productionPotential?.overall!==null&&d.productionPotential.overall>=75)strengths.push(`Tiềm lực sản xuất ${fmt(d.productionPotential.overall,1)}/100 · ${d.productionPotential.maturity}.`);

    const risks=[];
    hardFailed.forEach(x=>risks.push(`Hard Gate KHÔNG ĐẠT: ${x}.`));
    hardPending.forEach(x=>risks.push(`Hard Gate chưa xác minh: ${x}.`));
    (d.missing||[]).forEach(k=>risks.push(`Thiếu Minimum Evidence: ${PARTNER_EVIDENCE_LABELS[k]||k}.`));
    scoreItems.filter(([,v])=>v!==null&&v<=50).sort((a,b)=>a[1]-b[1]).slice(0,3).forEach(([k,v])=>risks.push(`Điểm thấp: ${PARTNER_SCORE_LABELS[k]} ${fmt(v,1)}/100.`));
    const linkedRisks=(db.partnerRisks||[]).filter(r=>(r.partnerId===p.id||r.partnerId===originalId)&&r.status!=='Đã đóng').sort((a,b)=>(num(b.score)||0)-(num(a.score)||0));
    linkedRisks.filter(r=>['Cao','Nghiêm trọng'].includes(r.level||riskLevel(r.score))).slice(0,3).forEach(r=>risks.push(`Risk ${r.level||riskLevel(r.score)}: ${clipText(r.risk,140)}.`));
    if(d.confidence!=='Cao'&&d.coverage<.75)risks.push(`Evidence coverage ${pct(d.coverage,0)}, confidence ${d.confidence}.`);
    if(d.productionPotential?.overall!==null&&d.productionPotential.overall<55)risks.push(`Tiềm lực sản xuất hiện ở mức ${fmt(d.productionPotential.overall,1)}/100; cần kiểm chứng thêm khả năng delivery và scale team.`);

    const conditions=[];
    if(hardFailed.length)conditions.push(`Không chuyển stage cho tới khi xử lý các Hard Gate không đạt hoặc có quyết định dừng chính thức: ${hardFailed.join(', ')}.`);
    if(hardPending.length)conditions.push(`Xác minh các Hard Gate còn pending: ${hardPending.join(', ')}.`);
    if((d.missing||[]).length)conditions.push(`Hoàn tất Minimum Evidence Gate cho: ${(d.missing||[]).map(k=>PARTNER_EVIDENCE_LABELS[k]||k).join(', ')}.`);
    const highOpen=linkedRisks.filter(r=>['Cao','Nghiêm trọng'].includes(r.level||riskLevel(r.score)));
    if(highOpen.length)conditions.push(`Có mitigation/owner rõ ràng cho ${highOpen.length} risk Cao/Nghiêm trọng đang mở.`);
    if(d.fit===null)conditions.push('Hoàn tất đầy đủ điểm đánh giá /100 để tính mức độ phù hợp của Partner.');
    if(!conditions.length)conditions.push('Hard Gate và Minimum Evidence Gate đã đạt; không có blocking condition từ logic hiện tại.');
    conditions.push('Hard Gate là điều kiện chặn và không được bù bởi Partner Fit score.');

    let recommendation='Chờ hoàn thiện đánh giá',status='Chờ review';
    if(d.hard==='KHÔNG ĐẠT'){recommendation='Không tiếp tục';status='Bị chặn';}
    else if(d.hard==='CHỜ XÁC MINH'){recommendation='Chờ xác minh Hard Gate';status='Chờ review';}
    else if(d.minimumGate!=='ĐẠT'){recommendation='Tiếp tục có điều kiện';status='Chờ bổ sung evidence';}
    else if(d.fit===null){recommendation='Chờ hoàn thiện đánh giá';status='Chờ chấm điểm';}
    else if(d.fit>=85){recommendation='Ưu tiên tiếp tục';status='Sẵn sàng phê duyệt';}
    else if(d.fit>=75){recommendation='Tiếp tục';status='Sẵn sàng phê duyệt';}
    else if(d.fit>=65){recommendation='Tiếp tục có điều kiện';status='Review có điều kiện';}
    else {recommendation='Cần xem xét thêm';status='Chờ review';}

    const projectScope=profile(p,'Dự án đang đánh giá');
    let nextAction='Review lại hồ sơ Partner và cập nhật các dữ liệu còn thiếu.';
    if(hardFailed.length)nextAction=`Review Hard Gate không đạt (${hardFailed.join(', ')}) và chốt hướng dừng hoặc phương án xử lý trước khi tiếp tục.`;
    else if(hardPending.length)nextAction=`Hoàn tất DD/xác minh ${hardPending.join(', ')}; sau đó generate lại Decision.`;
    else if((d.missing||[]).length)nextAction=`Bổ sung và xác minh evidence cho ${(d.missing||[]).map(k=>PARTNER_EVIDENCE_LABELS[k]||k).join(', ')}; sau đó review lại Minimum Evidence Gate.`;
    else if(d.fit===null)nextAction='Hoàn tất điểm đánh giá /100 và review mức độ phù hợp trước khi ra quyết định.';
    else if(d.fit<65)nextAction='Review các hạng mục score thấp và strategic fit; chỉ mở bước tiếp theo khi có đủ lý do business để tiếp tục.';
    else if(d.fit<75)nextAction=`Chốt các condition/risk còn mở rồi chuyển sang Game Selection${projectScope?` cho ${projectScope}`:''}.`;
    else nextAction=`Chuyển sang Game Selection${projectScope?` cho ${projectScope}`:' cho các game trong scope'}; tiếp tục monitor risk mở trong quá trình evaluation.`;

    return {
      recommendation,status,
      strengths:bullets(strengths,'Chưa có strength đủ rõ từ evidence/score hiện tại.'),
      risks:bullets(risks,'Không có risk nổi bật được phát hiện từ Hard Gate, Evidence, Score và Risk Register hiện tại.'),
      conditions:bullets(conditions),nextAction,
      meta:{hard:d.hard,minimumGate:d.minimumGate,fit:d.fit,classification:d.classification,coverage:d.coverage,confidence:d.confidence}
    };
  }

  function partnerRiskSectionHtml(partnerId,isNew=false){
    const rs=partnerRiskStats(partnerId);
    const summary=isNew?'Save Partner trước khi thêm Risk.':`${rs.open.length} risk đang mở · ${rs.high.length} Cao/Nghiêm trọng · ${rs.all.length} tổng cộng.`;
    return `<div class="section-title-row"><div class="section-title">Risk Register · ${esc(partnerId)}</div><button type="button" class="ghost" data-partner-risk-add ${isNew?'disabled':''}>+ Risk</button></div>
      <div class="notice partner-risk-helper">${esc(summary)} Risk tại đây chỉ thuộc <b>${esc(partnerId)}</b>. Decision Generator cũng chỉ đọc risk của Partner này.</div>
      <div data-partner-risk-list></div>
      <div class="partner-risk-editor" data-partner-risk-editor hidden>
        <div class="risk-editor-head"><b data-risk-editor-title>Add risk</b><span class="small muted">Partner locked: ${esc(partnerId)}</span></div>
        <div class="form-grid three-cols">
          ${fText('risk_id','Risk ID','')}${fText('risk_prob','Probability 1–3','','','number')}${fText('risk_impact','Impact 1–3','','','number')}
          ${fArea('risk_text','Risk','')}${fArea('risk_mitigation','Mitigation','')}${fText('risk_owner','Owner','')}
          ${fSelect('risk_status','Status','Đang mở',['Đang mở','Đang xử lý','Chấp nhận','Đã đóng'])}${fText('risk_due','Due date','','','date')}${fArea('risk_notes','Notes','')}
        </div>
        <div class="risk-editor-actions"><button type="button" class="ghost" data-risk-editor-cancel>Cancel</button><button type="button" class="primary" data-risk-editor-save>Save Risk</button></div>
      </div>`;
  }

  function bindPartnerRiskSection(root,partnerId,isNew=false){
    const list=root?.querySelector('[data-partner-risk-list]');
    const editor=root?.querySelector('[data-partner-risk-editor]');
    const addBtn=root?.querySelector('[data-partner-risk-add]');
    if(!list||!editor||!addBtn)return;
    const canEdit=!(window.SAVA_SUPABASE?.configured) || window.SAVA_SUPABASE.canEdit();
    const canDelete=!(window.SAVA_SUPABASE?.configured) || window.SAVA_SUPABASE.canDelete();
    if(isNew||!canEdit)addBtn.disabled=true;
    const field=n=>editor.querySelector(`[name="${n}"]`);
    if(field('risk_id'))field('risk_id').readOnly=true;

    const refresh=()=>{
      const risks=partnerRiskStats(partnerId).all.slice().sort((a,b)=>{
        const ac=a.status==='Đã đóng'?1:0,bc=b.status==='Đã đóng'?1:0;
        return ac-bc || (num(b.score)||0)-(num(a.score)||0) || String(a.id).localeCompare(String(b.id));
      });
      const rows=risks.map(r=>`<tr><td><b>${esc(r.id)}</b></td><td>${esc(r.risk||'—')}</td><td class="num">${r.probability??'—'}×${r.impact??'—'}</td><td>${badge(r.level||riskLevel(r.score))}</td><td>${esc(r.mitigation||'—')}</td><td>${badge(r.status||'—')}</td><td>${esc(r.owner||'—')}</td><td>${esc(r.dueDate||'—')}</td><td><div class="actions-inline"><button type="button" data-risk-inline-edit="${esc(r.id)}" ${canEdit?'':'disabled'}>Edit</button><button type="button" data-risk-inline-delete="${esc(r.id)}" ${canDelete?'':'disabled'}>Delete</button></div></td></tr>`);
      list.innerHTML=table(['ID','Risk','P×I','Level','Mitigation','Status','Owner','Due',''],rows);
      list.querySelectorAll('[data-risk-inline-edit]').forEach(btn=>btn.onclick=()=>showEditor(byId(db.partnerRisks,btn.dataset.riskInlineEdit)));
      list.querySelectorAll('[data-risk-inline-delete]').forEach(btn=>btn.onclick=()=>{
        if(!canDelete){toast('Only Admin can delete risks');return;}
        const risk=byId(db.partnerRisks,btn.dataset.riskInlineDelete);if(!risk)return;
        if(confirm(`Delete ${risk.id} from ${partnerId}?`)){
          db.partnerRisks=(db.partnerRisks||[]).filter(x=>x.id!==risk.id);
          persist(`Deleted risk ${risk.id} from ${partnerId}`);refresh();
        }
      });
      const rs=partnerRiskStats(partnerId);
      const helper=root.querySelector('.partner-risk-helper');
      if(helper&&!isNew)helper.innerHTML=`<b>${rs.open.length}</b> risk đang mở · <b>${rs.high.length}</b> Cao/Nghiêm trọng · <b>${rs.all.length}</b> tổng cộng. Risk tại đây chỉ thuộc <b>${esc(partnerId)}</b>. Decision Generator cũng chỉ đọc risk của Partner này.`;
    };

    const showEditor=(risk=null)=>{
      if(isNew||!canEdit)return;
      const r=risk||{id:nextRiskId(),risk:'',probability:2,impact:2,mitigation:'',owner:'',status:'Đang mở',dueDate:'',notes:''};
      editor.hidden=false;editor.dataset.editingId=risk?.id||'';
      const title=editor.querySelector('[data-risk-editor-title]');if(title)title.textContent=risk?`Edit ${r.id}`:`Add risk · ${partnerId}`;
      field('risk_id').value=r.id||'';field('risk_text').value=r.risk||'';field('risk_prob').value=r.probability??2;field('risk_impact').value=r.impact??2;field('risk_mitigation').value=r.mitigation||'';field('risk_owner').value=r.owner||'';field('risk_status').value=r.status||'Đang mở';field('risk_due').value=r.dueDate||'';field('risk_notes').value=r.notes||'';
      editor.scrollIntoView({behavior:'smooth',block:'nearest'});
    };
    addBtn.onclick=()=>showEditor();
    editor.querySelector('[data-risk-editor-cancel]').onclick=()=>{editor.hidden=true;editor.dataset.editingId='';};
    editor.querySelector('[data-risk-editor-save]').onclick=()=>{
      if(!canEdit)return;
      const probability=Number(field('risk_prob').value),impact=Number(field('risk_impact').value),riskText=field('risk_text').value.trim();
      if(!riskText){toast('Risk description is required');return;}
      if(![1,2,3].includes(probability)||![1,2,3].includes(impact)){toast('Probability and Impact must be 1, 2 or 3');return;}
      const editingId=editor.dataset.editingId;
      let r=editingId?byId(db.partnerRisks,editingId):null;
      if(!r){r={id:field('risk_id').value||nextRiskId(),partnerId};(db.partnerRisks=db.partnerRisks||[]).push(r);}
      r.partnerId=partnerId;r.risk=riskText;r.probability=probability;r.impact=impact;r.score=probability*impact;r.level=riskLevel(r.score);r.mitigation=field('risk_mitigation').value.trim();r.owner=field('risk_owner').value.trim();r.status=field('risk_status').value;r.dueDate=field('risk_due').value;r.notes=field('risk_notes').value.trim();
      editor.hidden=true;editor.dataset.editingId='';persist(`${editingId?'Updated':'Added'} risk ${r.id} · ${partnerId}`);refresh();
    };
    refresh();
  }

  function openPartner(id){
    let p=byId(db.partners,id); const isNew=!p;
    if(!p) p={id:`P${String(db.partners.length+1).padStart(3,'0')}`,profile:{},hardGate:{},evidence:{},scores:{},scorecard:{},decision:{},productionPotential:{}};
    const d=partnerDerived(p),prod=d.productionPotential;
    const scoreFields=[['trackRecord','Thành tích sản phẩm'],['team','Năng lực team'],['capacity','Năng lực sản xuất'],['cadence','Tốc độ phát triển'],['milestone','Độ tin cậy milestone'],['liveOps','Khả năng LiveOps'],['dataTech','Dữ liệu & kỹ thuật'],['collaboration','Khả năng phối hợp'],['dealFit','Mức độ phù hợp Deal'],['strategicFit','Phù hợp chiến lược'],['longTerm','Tiềm năng dài hạn']];
    const evidenceFields=[['trackRecord','Thành tích sản phẩm'],['team','Cấu trúc team'],['capacity','Năng lực sản xuất'],['cadence','Tốc độ phát triển'],['milestone','Độ tin cậy milestone'],['liveOps','Khả năng LiveOps'],['dataTech','Dữ liệu & kỹ thuật'],['collaboration','Khả năng phối hợp'],['publisherHistory','Lịch sử làm việc với Publisher'],['deal','Thông tin Deal'],['legalIp','Pháp lý / IP'],['strategicFit','Phù hợp chiến lược'],['longTerm','Tiềm năng hợp tác dài hạn']];
    const scoreVal=k=>{const v=p.scores?.[k];const n=score100(v);return n===null?'':n;};
    const shareS=profile(p,'Rev Share SAVA (%)'),shareP=profile(p,'Rev Share Partner (%)');
    const commercialSummary=`${esc(profile(p,'Mô hình hợp tác tài chính')||'Chưa có')} · SAVA ${num(shareS)!==null?pct(shareS,0):'—'} / Đối tác ${num(shareP)!==null?pct(shareP,0):'—'}`;
    const body=`
      <div class="partner-exec-grid">
        <div class="exec-card"><span>Mức độ phù hợp</span><strong>${d.fit===null?'—':fmt(d.fit,1)}/100</strong><small>${esc(d.classification)}</small></div>
        <div class="exec-card"><span>Tiềm lực sản xuất</span><strong>${prod.overall===null?'—':fmt(prod.overall,1)}/100</strong><small>${esc(prod.maturity)}</small></div>
        <div class="exec-card"><span>Kết luận hiện tại</span><strong class="exec-status">${esc(d.final)}</strong><small>Hard Gate: ${esc(d.hard)}</small></div>
        <div class="exec-card commercial-card"><span>Hợp tác hiện tại</span><strong class="exec-status">${commercialSummary}</strong><small>UA: ${esc(profile(p,'Cam kết UA / Marketing Spend')||'Chưa có cam kết')}</small></div>
      </div>
      <div class="section-title">Thông tin đối tác</div><div class="form-grid three-cols">
      ${fText('id','Partner ID',p.id)}${fText('name','Partner / Studio',profile(p,'Tên Partner / Studio'))}${fText('country','Quốc gia',profile(p,'Quốc gia'))}${fText('contact','Founder / Đầu mối chính',profile(p,'Founder / Đầu mối chính'))}${fText('teamSize','Quy mô team',profile(p,'Quy mô team'))}${fText('genres','Thể loại chính',profile(p,'Genre chính'))}${fText('platform','Nền tảng',profile(p,'Platform chính'))}${fText('projects','Dự án đang đánh giá',profile(p,'Dự án đang đánh giá'))}${fText('source','Nguồn tiếp cận',profile(p,'Nguồn'))}${fText('owner','Phụ trách Publishing',profile(p,'Owner Publishing'))}${fText('status','Giai đoạn / trạng thái',profile(p,'Trạng thái'))}${fArea('profileNotes','Ghi chú',profile(p,'Ghi chú'))}</div>
      <div class="section-title">Thông tin hợp tác & UA</div><div class="form-grid three-cols commercial-fields">
      ${fText('dealModel','Mô hình hợp tác',profile(p,'Mô hình hợp tác tài chính'))}${fText('partnerCommit','Phí đối tác',profile(p,'Mức cam kết đầu tư cho Partner'))}${fText('uaCommit','Cam kết UA',profile(p,'Cam kết UA / Marketing Spend'))}${fText('savaShare','Tỷ lệ SAVA (0-1)',profile(p,'Rev Share SAVA (%)'),'','number')}${fText('partnerShare','Tỷ lệ đối tác (0-1)',profile(p,'Rev Share Partner (%)'),'','number')}${fArea('uaCond','Điều kiện UA',profile(p,'Điều kiện cam kết UA'))}</div>
      <div class="section-title">Tiềm lực đội sản xuất</div><div class="notice production-helper">Điểm tổng là trung bình 6 nhóm năng lực. Dùng thang <b>0–100</b>; hệ thống vẫn tự chuyển đổi dữ liệu cũ 1–5 sang /100.</div><div class="form-grid three-cols">
      ${fText('prod_teamCapacity','Năng lực team /100',prod.dims.teamCapacity??'','','number')}${fText('prod_productQuality','Chất lượng sản phẩm /100',prod.dims.productQuality??'','','number')}${fText('prod_productionSpeed','Tốc độ sản xuất /100',prod.dims.productionSpeed??'','','number')}${fText('prod_technical','Năng lực kỹ thuật /100',prod.dims.technical??'','','number')}${fText('prod_liveOps','Khả năng LiveOps /100',prod.dims.liveOps??'','','number')}${fText('prod_scalability','Khả năng mở rộng /100',prod.dims.scalability??'','','number')}${fSelect('prod_maturity','Mức trưởng thành sản xuất',prod.maturity,['Chưa đánh giá','Prototype','Full Game','LiveOps','Scale-ready'])}${fArea('prod_notes','Nhận định tiềm lực sản xuất',prod.notes||'')}</div>
      <div class="section-title">Hard Gate</div><div class="form-grid three-cols">${[['legalContract','Pháp lý / hợp đồng'],['ipSourceRights','Quyền IP / source code'],['publisherConflict','Xung đột Publisher'],['dataTransparency','Minh bạch dữ liệu'],['teamContinuity','Tính ổn định của team'],['compliance','Tuân thủ']].map(([k,l])=>fSelect(`gate_${k}`,l,p.hardGate?.[k]||'Chờ xác minh',GATE_STATUS)).join('')}${fArea('gateEvidence','Bằng chứng / ghi chú Hard Gate',p.hardGate?.evidence||'')}${fText('gateOwner','Người phụ trách kiểm tra',p.hardGate?.owner||'')}${fText('gateDue','Hạn hoàn tất',p.hardGate?.dueDate||'','','date')}</div>
      <div class="section-title">Bằng chứng & trạng thái xác minh</div><div class="form-grid">${evidenceFields.map(([k,l])=>`${fArea(`ev_${k}_text`,l,p.evidence?.[k]?.text||'')}${fSelect(`ev_${k}_status`,`${l} · trạng thái`,p.evidence?.[k]?.status||'',EVIDENCE_STATUS)}`).join('')}${fText('evSource','Nguồn / cập nhật gần nhất',p.evidence?.sourceUpdated||'','full')}${fArea('evFollow','Việc cần bổ sung',p.evidence?.followUp||'')}</div>
      <div class="section-title">Điểm đánh giá /100</div><div class="form-grid three-cols">${scoreFields.map(([k,l])=>fText(`score_${k}`,`${l} /100`,scoreVal(k),'','number')).join('')}</div>
      ${partnerRiskSectionHtml(p.id,isNew)}
      <div class="section-title-row"><div class="section-title">Quyết định</div><button type="button" class="ghost decision-generate" data-generate-partner-decision>✨ Tạo quyết định tự động</button></div><div class="notice decision-helper">Tạo từ <b>Hard Gate + Evidence tối thiểu + mức độ phù hợp + Risk Register + tiềm lực sản xuất</b>. Có thể sửa tay trước khi lưu.</div><div class="form-grid decision-grid">${fText('decisionReco','Khuyến nghị cuối',p.decision?.recommendation||'')}${fText('decisionStatus','Trạng thái quyết định',p.decision?.status||'')}${fArea('strengths','Điểm mạnh',p.decision?.strengths||'')}${fArea('risks','Rủi ro chính',p.decision?.risks||'')}${fArea('conditions','Điều kiện trước bước tiếp theo',p.decision?.conditions||'')}${fArea('nextAction','Hành động tiếp theo',p.decision?.nextAction||'')}${fText('decisionOwner','Người ra quyết định',p.decision?.owner||'')}${fText('decisionDate','Ngày quyết định',p.decision?.decisionDate?.slice?.(0,10)||p.decision?.decisionDate||'','','date')}${fArea('decisionNotes','Ghi chú quyết định',p.decision?.notes||'')}</div>`;
    modal(isNew?'Thêm Partner':`${p.id} · ${profile(p,'Tên Partner / Studio')||'Partner'}`,body,(root)=>{
      const oldId=p.id; p.id=formVal(root,'id')||oldId;
      const map={'Tên Partner / Studio':'name','Quốc gia':'country','Founder / Đầu mối chính':'contact','Quy mô team':'teamSize','Genre chính':'genres','Platform chính':'platform','Dự án đang đánh giá':'projects','Nguồn':'source','Owner Publishing':'owner','Trạng thái':'status','Mô hình hợp tác tài chính':'dealModel','Mức cam kết đầu tư cho Partner':'partnerCommit','Cam kết UA / Marketing Spend':'uaCommit','Điều kiện cam kết UA':'uaCond','Ghi chú':'profileNotes'};
      p.profile=p.profile||{}; Object.entries(map).forEach(([k,n])=>p.profile[k]=formVal(root,n)||null); p.profile['Partner ID']=p.id; p.profile['Rev Share SAVA (%)']=formNum(root,'savaShare');p.profile['Rev Share Partner (%)']=formNum(root,'partnerShare');
      p.productionPotential={...(p.productionPotential||{}),teamCapacity:formNum(root,'prod_teamCapacity'),productQuality:formNum(root,'prod_productQuality'),productionSpeed:formNum(root,'prod_productionSpeed'),technical:formNum(root,'prod_technical'),liveOps:formNum(root,'prod_liveOps'),scalability:formNum(root,'prod_scalability'),maturity:formVal(root,'prod_maturity'),notes:formVal(root,'prod_notes')};
      p.hardGate=p.hardGate||{}; ['legalContract','ipSourceRights','publisherConflict','dataTransparency','teamContinuity','compliance'].forEach(k=>p.hardGate[k]=formVal(root,`gate_${k}`));p.hardGate.evidence=formVal(root,'gateEvidence');p.hardGate.owner=formVal(root,'gateOwner');p.hardGate.dueDate=formVal(root,'gateDue');
      p.evidence=p.evidence||{}; evidenceFields.forEach(([k])=>p.evidence[k]={text:formVal(root,`ev_${k}_text`),status:formVal(root,`ev_${k}_status`)});p.evidence.sourceUpdated=formVal(root,'evSource');p.evidence.followUp=formVal(root,'evFollow');
      p.scores=p.scores||{}; scoreFields.forEach(([k])=>p.scores[k]=formNum(root,`score_${k}`));
      p.decision={...(p.decision||{}),recommendation:formVal(root,'decisionReco'),status:formVal(root,'decisionStatus'),strengths:formVal(root,'strengths'),risks:formVal(root,'risks'),conditions:formVal(root,'conditions'),nextAction:formVal(root,'nextAction'),owner:formVal(root,'decisionOwner'),decisionDate:formVal(root,'decisionDate'),notes:formVal(root,'decisionNotes'),updatedAt:new Date().toISOString()};
      if(root.dataset.decisionGenerated==='1'){p.decision.autoGenerated=true;p.decision.generatedAt=new Date().toISOString();p.decision.generationRule='Hard Gate + Evidence + Partner Fit + Risk Register + Production Potential';}
      const der=partnerDerived(p); p.hardGate.result=der.hard;p.evidence.coverage=der.coverage;p.evidence.confidence=der.confidence;p.evidence.minimumGate=der.minimumGate;p.scores.productionComposite=der.production;p.scorecard={...(p.scorecard||{}),partnerFit:der.fit,classification:der.classification,finalConclusion:der.final,productionPotential:der.productionPotential.overall};
      if(isNew) db.partners.push(p); else if(oldId!==p.id){db.partnerRisks.forEach(r=>{if(r.partnerId===oldId)r.partnerId=p.id;});db.deals.forEach(d=>{if(d.partnerId===oldId)d.partnerId=p.id;});db.sourcing.forEach(s=>{if(s.partnerId===oldId)s.partnerId=p.id;});}
      modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} partner ${p.id}`);
    },{wide:true});
    const partnerModal=modalRoot.querySelector('.modal');
    bindPartnerRiskSection(partnerModal,p.id,isNew);
    const genBtn=partnerModal?.querySelector('[data-generate-partner-decision]');
    if(genBtn&&window.SAVA_SUPABASE?.configured&&!window.SAVA_SUPABASE.canEdit())genBtn.disabled=true;
    if(genBtn&&!genBtn.disabled)genBtn.onclick=()=>{
      const draft=partnerDraftFromForm(partnerModal,p,scoreFields,evidenceFields);
      const generated=generatePartnerDecision(draft,p.id);
      const set=(name,value)=>{const el=partnerModal.querySelector(`[name="${name}"]`);if(el)el.value=value??'';};
      set('decisionReco',generated.recommendation);set('decisionStatus',generated.status);set('strengths',generated.strengths);set('risks',generated.risks);set('conditions',generated.conditions);set('nextAction',generated.nextAction);
      partnerModal.dataset.decisionGenerated='1';
      const helper=partnerModal.querySelector('.decision-helper');
      if(helper)helper.textContent=`Đã tạo từ dữ liệu hiện tại · Hard Gate ${generated.meta.hard} · Evidence ${generated.meta.minimumGate} · Phù hợp ${generated.meta.fit??'NE'}/100 · Coverage ${pct(generated.meta.coverage,0)} · Confidence ${generated.meta.confidence}. Có thể sửa tay trước khi lưu.`;
      toast('Đã tạo quyết định từ dữ liệu Partner hiện tại');
    };
  }

  function openRisk(id){ const r=byId(db.partnerRisks,id); }
  function addRisk(){
    const r={id:nextRiskId(),partnerId:db.partners[0]?.id||'',risk:'',probability:2,impact:2,mitigation:'',owner:'',status:'Đang mở',dueDate:'',notes:''};
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
