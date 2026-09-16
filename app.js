(() => {
  'use strict';

  const NAV = [
    ['dashboard','⌂','Tổng quan'],
    ['partners','1','Partner Selection'],
    ['deals','2','Deal Making'],
    ['market','3','Market Intelligence'],
    ['games','4','Game Selection'],
    ['sourcing','5','Sourcing'],
    ['operations','6','Publishing Operation'],
    ['sources','7','Tài liệu nguồn'],
    ['audit','8','Lịch sử thay đổi']
  ];
  const STAGES = ['Lead','Qualified','Evaluation','Deal','Test','Launch','Scale'];
  const SOURCING_SLA = {Lead:14, Qualified:10, Evaluation:14, Deal:30, Test:21, Launch:30, Scale:999};
  const SOURCING_SCREENING = ['', 'Loại','Cân nhắc, cần đánh giá thêm','Tiếp tục','Tiếp tục nhưng cần chỉnh sửa'];
  const SOURCING_STATUS = ['Đang xử lý','Tạm giữ','Thành công','Loại'];
  const SOURCING_TEST_RESULT = ['', 'Đạt','Không đạt','Không áp dụng'];
  const SOURCING_SOURCES = ['Inbound','Outbound','Referral','Đối tác hiện hữu','Hội nghị/Sự kiện','LinkedIn','Tìm kiếm trên Store','Nghiên cứu thị trường','Mạng lưới/Cộng đồng','Giới thiệu nội bộ','Agency/Môi giới','Đánh giá game lịch sử','Khác'];
  const SOURCING_LOSS_REASONS = ['', 'CPI cao','Retention thấp','Monetization yếu','Marketability yếu','Product chưa hoàn thiện','Genre/Market không phù hợp','Team/Nguồn lực yếu','Không đủ cam kết','Deal/Rev Share không phù hợp','Điều khoản/quyền kiểm soát','Không phản hồi','Độ phù hợp chiến lược thấp','Đối tác dừng','Khác'];
  const EVIDENCE_STATUS = ['','Đã xác minh','Partner cung cấp','Đã trao đổi','Thiếu','N/A'];
  const GATE_STATUS = ['Đạt','Chờ xác minh','Không đạt'];
  const GAME_GATE_STATUS = ['PASS','PASS / Monitor','PENDING','FAIL'];
  const SAVA_FIT_COMPONENTS = [
    ['UA_Creative_Ops_Fit_1_5','UA & Creative Ops'],
    ['Monetization_LiveOps_Fit_1_5','Monetization & LiveOps'],
    ['GEO_Channel_Fit_1_5','GEO & Channel'],
    ['Genre_Knowledge_1_5','Hiểu biết thể loại'],
    ['Creative_Production_Fit_1_5','Năng lực sản xuất Creative'],
    ['Portfolio_Strategic_Fit_1_5','Phù hợp Portfolio / chiến lược'],
    ['Internal_Operator_Availability_1_5','Nguồn lực vận hành nội bộ']
  ];
  const SOURCE_WORKBOOKS = [
    {id:'game-market',module:'Market Intelligence + Game Selection',name:'SAVA_Mobile_Game_Decision_Pub(3)_UPDATED_SCORES_SAFE (3).xlsm',storagePath:'01_game_market_selection.xlsm',type:'XLSM',sheets:53,formulas:8024,owner:'Market Intelligence / Game Selection',note:'Nguồn Market economics, UA benchmark, Publishing Intake, SAVA Publishing Fit, Pre-Scan/Post-Test và Dashboard.'},
    {id:'partner',module:'Partner Selection',name:'Publishing_Partner_Selection_Playbook (1).xlsx',storagePath:'02_partner_selection.xlsx',type:'XLSX',sheets:5,formulas:2441,owner:'Partner Selection',note:'Nguồn Partner profile, Hard Gate, Evidence, Partner Fit, Risk và Decision.'},
    {id:'deal',module:'Deal Making',name:'SAVA_Deal_Making_Playbook_Thuan_Viet_v14_Huong_Dan_03_04(1).xlsx',storagePath:'03_deal_making.xlsx',type:'XLSX',sheets:8,formulas:7440,owner:'Deal Making',note:'Nguồn Revenue Share, MG/đầu tư, UA commitment, negotiation, milestone, exit và approval.'},
    {id:'sourcing',module:'Sourcing',name:'SAVA_Sourcing_Funnel_KPI_Thuan_Viet(1).xlsx',storagePath:'04_sourcing_funnel.xlsx',type:'XLSX',sheets:9,formulas:15478,owner:'Sourcing',note:'Nguồn Lead → Qualified → Evaluation → Deal → Test → Launch → Scale, KPI Funnel và mapping tham chiếu các module.'},
    {id:'operation',module:'Publishing Operation',name:'Publishing_Launching_1 (1).xlsx',storagePath:'05_publishing_operation.xlsx',type:'XLSX',sheets:8,formulas:0,owner:'Publishing Operation',note:'Nguồn SOP sau Deal, Hybrid IAP/IAA, KPI reference và Publishing Projects.'}
  ];
  let sourceStorageState = {loading:false,loaded:false,files:{},error:''};
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
  function num(v){ if(v===null||v===undefined||(typeof v==='string'&&v.trim()==='')) return null; const n=Number(v); return Number.isFinite(n)?n:null; }
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
        if(window.SAVA_SUPABASE.loadAudit){
          try{db.audit=await window.SAVA_SUPABASE.loadAudit(200);localStorage.setItem(LOCAL_KEY,JSON.stringify(db));if(['dashboard','audit'].includes(currentView))render();}catch(_){ }
        }
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
  function weighted(scores,weights,{minCount=null}={}){
    const items=Object.entries(weights).filter(([k])=>num(scores[k])!==null);
    const required=minCount===null?Object.keys(weights).length:minCount;
    if(items.length<required) return null;
    const total=items.reduce((s,[k,w])=>s+num(scores[k])*w,0);
    const wsum=items.reduce((s,[,w])=>s+w,0);
    return wsum?Math.round((total/5/wsum*100)*10)/10:null;
  }
  function gameSavaFitDerived(g){
    const components=SAVA_FIT_COMPONENTS.map(([key,label])=>({key,label,value:num(intake(g,key))}));
    const present=components.filter(x=>x.value!==null);
    let avg5=present.length?present.reduce((s,x)=>s+x.value,0)/present.length:null;
    // Backward compatibility: old records may only have the aggregate scorecard value.
    if(avg5===null)avg5=num(g?.scorecard?.savaFit);
    const score=avg5===null?null:Math.round(avg5*20*10)/10;
    return {avg5:avg5===null?null:Math.round(avg5*100)/100,score,coverage:present.length,components};
  }
  const GAME_SCORE_KEYS=['marketSize','growth','entryAccess','marketMonetization','marketUaScalability','uaTest','retention','engagement','monetizationTest','gamefeelTest','readiness','dealEconomics'];
  function gameEnsureScoreLayers(g){
    g.scorecard=g.scorecard||{};
    const s=g.scorecard;
    if(!s.scoreLayersVersion){
      s.autoScores=s.autoScores||{};
      GAME_SCORE_KEYS.forEach(k=>{ if(s.autoScores[k]===undefined && num(s[k])!==null) s.autoScores[k]=num(s[k]); });
      s.overrides=s.overrides||{};
      s.scoreLayersVersion=1;
    }else{
      s.autoScores=s.autoScores||{};
      s.overrides=s.overrides||{};
    }
    return s;
  }
  function gameAutoScore(g,key){const s=gameEnsureScoreLayers(g);return num(s.autoScores?.[key]);}
  function gameOverrideScore(g,key){const s=gameEnsureScoreLayers(g);return num(s.overrides?.[key]);}
  function gameEffectiveScore(g,key){const o=gameOverrideScore(g,key);return o!==null?o:gameAutoScore(g,key);}
  function gameSavaFitEffective(g){const o=gameOverrideScore(g,'savaFit');return o!==null?o:gameSavaFitDerived(g).avg5;}
  function gameScoreSource(g,key){return gameOverrideScore(g,key)!==null?'OVERRIDE':gameAutoScore(g,key)!==null?'AUTO':'EMPTY';}
  function scoreOverrideField(name,label,g,key,help=''){
    const auto=key==='savaFit'?gameSavaFitDerived(g).avg5:gameAutoScore(g,key),ovr=gameOverrideScore(g,key),eff=ovr!==null?ovr:auto;
    const status=ovr!==null?'Dùng override':auto!==null?'Dùng AUTO':'Chưa có dữ liệu';
    return `<div class="score-override-card"><div class="score-override-head"><div><label>${esc(label)}</label><span>${help?esc(help):''}</span></div><b>${eff===null?'—':fmt(eff,2)}/5</b></div><div class="score-override-grid"><div><span>AUTO SCORE</span><strong>${auto===null?'—':fmt(auto,2)}</strong></div><div class="field"><label>Override thủ công</label><input name="${name}" type="number" min="1" max="5" step="0.1" value="${esc(ovr??'')}"></div></div><div class="score-override-status ${ovr!==null?'manual':'auto'}">${status}${ovr!==null?' · cần evidence tốt hơn':''}</div></div>`;
  }
  function normalizeMechanicName(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ');}
  const STRATEGIC_PUZZLE_IDS=new Set(['MECH-001','MECH-002','MECH-003','MECH-004','MECH-005','MECH-006','MECH-007','MECH-008','MECH-009','MECH-010','MECH-011','MECH-012']);
  const STRATEGIC_SIMULATION_IDS=new Set(['MECH-013','MECH-014','MECH-015','MECH-016','MECH-017','MECH-018','MECH-019','MECH-020','MECH-021','MECH-022']);
  const STRATEGIC_RPG_TD_IDS=new Set(['MECH-025','MECH-028','MECH-029','MECH-030']);
  const STRATEGIC_ADJACENT_IDS=new Set(['MECH-026','MECH-027']);
  function mechanicStrategicFit(m){
    const id=String(m?.Mechanic_ID||'').trim(),name=String(m?.Mechanic||'').trim();
    if(id==='MECH-023'||/cross-category|qa queue/i.test(name))return {score:null,group:'Không áp dụng',level:'N/A',source:'Sourcing 07_Market_Intel_Ref',note:'Đây là nhóm phân loại/QA, không phải một mechanic chiến lược để chấm Fit.'};
    if(STRATEGIC_PUZZLE_IDS.has(id))return {score:100,group:'Puzzle',level:'Cao — Đúng trọng tâm',source:'Sourcing 07_Market_Intel_Ref',note:'Puzzle là trọng tâm chiến lược; taxonomy MECH-001–012 được dùng để mapping Sourcing.'};
    if(STRATEGIC_SIMULATION_IDS.has(id))return {score:100,group:'Simulation',level:'Cao — Đúng trọng tâm',source:'Sourcing 07_Market_Intel_Ref',note:'Mechanic được mapping vào nhóm Simulation — trọng tâm chiến lược hiện tại.'};
    if(STRATEGIC_RPG_TD_IDS.has(id))return {score:100,group:'RPG / TD',level:'Cao — Đúng trọng tâm',source:'Sourcing 07_Market_Intel_Ref',note:'RPG / TD là trọng tâm chiến lược hiện tại.'};
    if(STRATEGIC_ADJACENT_IDS.has(id))return {score:60,group:'Hyper / Strategy liền kề',level:'Trung bình — Liền kề',source:'Sourcing 07_Market_Intel_Ref',note:'Strategy độc lập nằm ngoài trọng tâm ban đầu; chỉ xem như hướng liền kề và cần bằng chứng mạnh hơn ở cấp game.'};
    return {score:20,group:'Khác / Ngoài trọng tâm',level:'Thấp — Ngoài trọng tâm',source:'Sourcing 07_Market_Intel_Ref',note:'Không map được vào nhóm trọng tâm hiện tại; chỉ xem xét ngoại lệ khi bằng chứng đủ mạnh.'};
  }
  function mechanicStrategicFitHtml(info){
    if(!info||info.score===null)return `<div class="shared-fit-card empty-fit"><div><span>Phù hợp chiến lược SAVA /100</span><strong>Không áp dụng</strong></div><p>${esc(info?.note||'Không có mapping chiến lược.')}</p></div>`;
    return `<div class="shared-fit-card"><div class="shared-fit-head"><div><span>Phù hợp chiến lược SAVA /100 · Tự động</span><strong>${fmt(info.score,0)}/100</strong></div><span class="badge good">${esc(info.group)}</span></div><p><b>${esc(info.level)}</b>. ${esc(info.note)} Nguồn: ${esc(info.source)}. Đây là dữ liệu dùng chung từ Sourcing, không nhập lại tại Market Intelligence.</p></div>`;
  }
  function mechanicExecutionFit(mechanic){
    const key=normalizeMechanicName(mechanic);
    const games=(db.games||[]).filter(g=>normalizeMechanicName(intake(g,'Mechanic'))===key);
    const scored=games.map(g=>({g,fit:gameSavaFitDerived(g)})).filter(x=>x.fit.score!==null);
    if(!scored.length)return {score:null,count:0,games:[],method:'Chưa có Game/Candidate cùng mechanic có SAVA Publishing Fit đủ dữ liệu'};
    const score=Math.round(scored.reduce((sum,x)=>sum+x.fit.score,0)/scored.length*10)/10;
    return {score,count:scored.length,games:scored,method:'Trung bình SAVA Publishing Fit của Game/Candidate cùng mechanic trong Game Selection'};
  }
  function mechanicExecutionFitHtml(fit){
    if(!fit||fit.score===null)return `<div class="shared-fit-card empty-fit"><div><span>Năng lực thực thi đã chứng minh /100</span><strong>Chưa đủ dữ liệu</strong></div><p>Chưa có Game/Candidate cùng mechanic có đủ SAVA Publishing Fit trong Game Selection. Đây không được quy thành 0.</p></div>`;
    const rows=fit.games.map(({g,fit:f})=>`<tr><td><b>${esc(intake(g,'Game_Title')||g.id)}</b><div class="small muted">${esc(g.id)} · ${esc(intake(g,'Studio')||'—')}</div></td><td>${marketScoreBar(f.score)}</td><td>${f.coverage}/7 tiêu chí</td></tr>`).join('');
    return `<div class="shared-fit-card"><div class="shared-fit-head"><div><span>Năng lực thực thi đã chứng minh /100 · Tự động</span><strong>${fmt(fit.score,1)}/100</strong></div><span class="badge good">${fit.count} Game/Candidate</span></div><p>${esc(fit.method)}. Đây là evidence thực thi dùng chung từ Game Selection, không phải điểm chiến lược và không nhập lại ở Market Intelligence.</p>${table(['Game / Candidate','SAVA Publishing Fit','Dữ liệu'],rows,'shared-fit-table')}</div>`;
  }

  function executionCandidatePipelineStage(g){
    const lead=(db.sourcing||[]).find(x=>x.gameId===g.id);
    if(lead)return sourcingCurrentStage(lead);
    const d=gameDerived(g);
    return d.stage==='POST-TEST'?'Có Product Evidence':'Pre-Scan';
  }
  function executionCandidateCardHtml(g,selectedId){
    const fit=gameSavaFitDerived(g),d=gameDerived(g),title=intake(g,'Game_Title')||g.id;
    const stage=executionCandidatePipelineStage(g);
    return `<button type="button" class="execution-candidate-row ${g.id===selectedId?'active':''}" data-exec-candidate="${esc(g.id)}">
      <span class="execution-game-avatar">${esc(String(title).trim().slice(0,2).toUpperCase()||'GM')}</span>
      <span class="execution-candidate-main"><b>${esc(title)}</b><small>${esc(intake(g,'Studio')||g.id)}</small></span>
      <strong>${fit.score===null?'—':fmt(fit.score,1)}</strong>
      <span class="execution-candidate-stage">${esc(stage)}</span>
      <span class="execution-candidate-decision">${badge(d.selectionDecision)}</span>
      <span class="execution-chevron">›</span>
    </button>`;
  }
  function executionCandidateDetailHtml(g,mechanicFit){
    const fit=gameSavaFitDerived(g),d=gameDerived(g),title=intake(g,'Game_Title')||g.id,band=scoreBand(fit.score);
    const criteria=SAVA_FIT_COMPONENTS.map(([key,label])=>{
      const v=num(intake(g,key)),pctVal=v===null?0:Math.max(0,Math.min(100,v/5*100));
      return `<div class="execution-fit-dim"><div><b>${v===null?'—':fmt(v,1)}/5</b><span>${esc(label)}</span></div><div class="execution-fit-dim-bar"><i style="width:${pctVal}%"></i></div></div>`;
    }).join('');
    const fields=[
      ['Tên game',title],['Studio',intake(g,'Studio')||'—'],['Mechanic',intake(g,'Mechanic')||'—'],['GEO mục tiêu',intake(g,'Target_GEO')||'—'],
      ['Monetization',intake(g,'Monetization_Model')||'—'],['Build stage',intake(g,'Build_Stage')||'—'],['Owner',intake(g,'Owner')||'—'],['Hard Gate',d.hard||'—']
    ].map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    const evidence=[
      intake(g,'Theme_Hook')?`Theme / Hook: ${intake(g,'Theme_Hook')}`:'',
      intake(g,'Gamefeel_Archetype')?`Gamefeel: ${intake(g,'Gamefeel_Archetype')}`:'',
      `Product Evidence: ${d.productEvidenceCount||0}/5 nhóm`,
      `Data completeness: ${pct(d.completeness,0)}`
    ].filter(Boolean);
    return `<div class="execution-selected-head">
      <div class="execution-score-hero"><strong>${fit.score===null?'—':fmt(fit.score,1)}</strong><span>/100</span><small>SAVA Publishing Fit</small><em class="execution-fit-band ${band.key}">${esc(band.label)}</em></div>
      <div class="execution-selected-title"><div class="execution-title-row"><span class="execution-game-avatar large">${esc(String(title).trim().slice(0,2).toUpperCase()||'GM')}</span><div><h3>${esc(title)}</h3><p>${esc(intake(g,'Studio')||g.id)} · ${esc(intake(g,'Mechanic')||'—')} · ${esc(intake(g,'Target_GEO')||'—')}</p></div></div><div class="execution-selected-badges">${badge(executionCandidatePipelineStage(g))}${badge(d.selectionDecision)}${badge(d.hard)}</div></div>
    </div>
    <div class="execution-fit-grid">${criteria}</div>
    <div class="execution-tabs"><button class="active" type="button">Tổng quan</button><button type="button" data-exec-scroll="criteria">Điểm chi tiết</button><button type="button" data-exec-scroll="source">Nguồn dữ liệu</button></div>
    <div class="execution-detail-grid">
      <section class="execution-info-card"><div class="execution-card-head"><h4>Thông tin Candidate</h4><button class="text-link" type="button" data-open-selected-game="${esc(g.id)}">Mở chi tiết Game →</button></div><div class="execution-info-fields">${fields}</div></section>
      <section class="execution-info-card"><div class="execution-card-head"><h4>Evidence đang dùng</h4></div><ul class="execution-evidence-list">${evidence.map(v=>`<li>${esc(v)}</li>`).join('')}</ul><div class="execution-analysis-note"><span>Kết luận lựa chọn</span><b>${esc(d.selectionDecision||'—')}</b><p>${esc(d.evidenceDecision||d.recommendation||'Điểm Fit được lấy trực tiếp từ Game Selection.')}</p></div></section>
    </div>
    <div class="execution-source-strip" data-exec-source><b>Nguồn dữ liệu:</b> 7 tiêu chí SAVA Publishing Fit trong <b>Game Selection</b>. Điểm Năng lực thực thi của mechanic là <b>trung bình ${mechanicFit.count} Candidate</b> có Fit hợp lệ; không nhập lại ở Market Intelligence.</div>`;
  }
  function openExecutionFit(mechanicId){
    const m=(db.market||[]).find(x=>x.Mechanic_ID===mechanicId);if(!m)return;
    const fit=mechanicExecutionFit(m.Mechanic);
    if(!fit.games.length){toast('Chưa có Game/Candidate đủ SAVA Publishing Fit cho mechanic này');return;}
    const candidates=fit.games.map(x=>x.g).sort((a,b)=>(gameSavaFitDerived(b).score||0)-(gameSavaFitDerived(a).score||0));
    let selectedId=candidates[0].id;
    modalRoot.innerHTML=`<div class="modal-backdrop execution-fit-backdrop"><div class="modal wide execution-fit-modal">
      <div class="modal-head execution-fit-modal-head"><div><span class="eyebrow-mini">MARKET INTELLIGENCE → GAME SELECTION</span><h2>${esc(m.Mechanic)}</h2><p>Năng lực thực thi <b>${fmt(fit.score,1)}/100</b> · ${fit.count} Game/Candidate đang tạo nên điểm này</p></div><button class="icon-btn" data-close>×</button></div>
      <div class="modal-body execution-fit-body"><div class="execution-fit-layout"><main data-exec-detail></main><aside class="execution-candidate-panel"><div class="execution-candidate-panel-head"><div><h3>Candidate cùng mechanic</h3><p>Click một candidate để xem chi tiết</p></div><span>${fit.count} candidate${fit.count===1?'':'s'}</span></div><div data-exec-list></div><button type="button" class="text-link execution-all-link" data-open-game-selection="${esc(m.Mechanic)}">Xem tất cả trong Game Selection →</button><div class="execution-quick-actions"><h4>Hành động nhanh</h4><button type="button" class="primary" data-open-game-selection="${esc(m.Mechanic)}">Mở Game Selection →</button><button type="button" class="ghost" data-open-market-detail="${esc(mechanicId)}">Xem phân tích market</button></div></aside></div></div>
    </div></div>`;
    const root=modalRoot.querySelector('.execution-fit-modal');
    const refresh=()=>{
      const g=candidates.find(x=>x.id===selectedId)||candidates[0];
      root.querySelector('[data-exec-detail]').innerHTML=executionCandidateDetailHtml(g,fit);
      root.querySelector('[data-exec-list]').innerHTML=candidates.map(x=>executionCandidateCardHtml(x,selectedId)).join('');
      root.querySelectorAll('[data-exec-candidate]').forEach(btn=>btn.onclick=()=>{selectedId=btn.dataset.execCandidate;refresh();});
      root.querySelectorAll('[data-open-selected-game]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.openSelectedGame;modalRoot.innerHTML='';openGame(id);});
      root.querySelectorAll('[data-exec-scroll]').forEach(btn=>btn.onclick=()=>{const target=btn.dataset.execScroll==='source'?root.querySelector('[data-exec-source]'):root.querySelector('.execution-fit-grid');target?.scrollIntoView({behavior:'smooth',block:'center'});});
    };
    root.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>modalRoot.innerHTML='');
    root.querySelectorAll('[data-open-game-selection]').forEach(btn=>btn.onclick=()=>{searchTerm=btn.dataset.openGameSelection||'';const search=$('#globalSearch');if(search)search.value=searchTerm;modalRoot.innerHTML='';location.hash='games';currentView='games';render();});
    root.querySelector('[data-open-market-detail]').onclick=()=>{modalRoot.innerHTML='';openMarket(mechanicId);};
    refresh();
  }
  // Backward-compatible alias for older internal calls. At mechanic level, this means Execution Fit, not Strategic Fit.
  function mechanicSavaFit(mechanic){return mechanicExecutionFit(mechanic);}
  function mechanicSavaFitHtml(fit){return mechanicExecutionFitHtml(fit);}
  function gameDerived(g){
    const s=gameEnsureScoreLayers(g);
    const marketInputs={size:gameEffectiveScore(g,'marketSize'),growth:gameEffectiveScore(g,'growth'),entry:gameEffectiveScore(g,'entryAccess'),mon:gameEffectiveScore(g,'marketMonetization'),ua:gameEffectiveScore(g,'marketUaScalability')};
    const productInputs={ua:gameEffectiveScore(g,'uaTest'),ret:gameEffectiveScore(g,'retention'),eng:gameEffectiveScore(g,'engagement'),mon:gameEffectiveScore(g,'monetizationTest'),gf:gameEffectiveScore(g,'gamefeelTest')};
    const marketWeights={size:20,growth:20,entry:25,mon:20,ua:15};
    const productWeights={ua:25,ret:30,eng:15,mon:20,gf:10};
    // Workbook 10_SCORECARD: Market needs >=3/5 evidence groups; Product Evidence needs >=2/5.
    // Missing sub-scores are reweighted across the available evidence, exactly as the workbook formulas do.
    const market=weighted(marketInputs,marketWeights,{minCount:3});
    const product=weighted(productInputs,productWeights,{minCount:2});
    const marketEvidenceCount=Object.values(marketInputs).filter(v=>num(v)!==null).length;
    const productEvidenceCount=Object.values(productInputs).filter(v=>num(v)!==null).length;
    const readiness=gameEffectiveScore(g,'readiness'), deal=gameEffectiveScore(g,'dealEconomics'), fit=gameSavaFitEffective(g);
    const coreCount=[readiness,deal,fit].filter(v=>v!==null).length;
    const prescan=[market,readiness,deal,fit].every(x=>x!==null)?Math.round((market*.45+readiness*20*.20+deal*20*.20+fit*20*.15)*10)/10:null;
    const final=[market,product,readiness,deal,fit].every(x=>x!==null)?Math.round((market*.25+product*.35+readiness*20*.15+deal*20*.15+fit*20*.10)*10)/10:null;
    const stage=productEvidenceCount>=2?'POST-TEST':'PRE-SCAN';
    const preScanCompleteness=(marketEvidenceCount+coreCount)/8;
    const postTestCompleteness=(marketEvidenceCount+productEvidenceCount+coreCount)/13;
    const completeness=stage==='POST-TEST'?postTestCompleteness:preScanCompleteness;
    const hard=gameHardGate(g);

    // Exact workbook recommendation (10_SCORECARD!AB): retained for traceability.
    let recommendation='HOLD - NEED DATA';
    if(hard==='FAIL') recommendation='REJECT - GATE FAIL';
    else if(hard==='PENDING') recommendation=prescan!==null&&prescan>=60&&prescan<=75?'NEGOTIATE / CONDITIONAL SIGNING':'HOLD - FIX GATE';
    else if(completeness<.8) recommendation='HOLD - NEED DATA';
    else if(stage==='POST-TEST') recommendation=final>=80?'GREENLIGHT / SCALE':final>=68?'TEST MORE / RENEGOTIATE':'STOP / PASS';
    else recommendation=prescan>75?'DIRECT TO PRODUCT TEST':prescan>=60?'REVIEW PASSED / PROCEED TO PRODUCT TEST':'PASS / DO NOT SCAN';

    // Publishing OS primary decision: Game Selection is a pre-test selection gate.
    // Product Evidence, when already available for the candidate, is shown as an additional evidence layer rather than replacing the Pre-Scan decision.
    let selectionDecision='Cần bổ sung dữ liệu';
    if(hard==='FAIL') selectionDecision='Dừng — Hard Gate không đạt';
    else if(hard==='PENDING') selectionDecision=prescan!==null&&prescan>=60&&prescan<=75?'Tiếp tục có điều kiện — hoàn thiện Hard Gate':'Chờ hoàn thiện Hard Gate';
    else if(preScanCompleteness<.8) selectionDecision='Cần bổ sung dữ liệu Pre-Scan';
    else if(prescan!==null&&prescan>75) selectionDecision='Tiếp tục';
    else if(prescan!==null&&prescan>=60) selectionDecision='Tiếp tục có điều kiện';
    else if(prescan!==null) selectionDecision='Chưa tiếp tục';

    let evidenceDecision='Chưa có Product Evidence';
    if(stage==='POST-TEST'){
      if(postTestCompleteness<.8) evidenceDecision='Có evidence nhưng chưa đủ độ hoàn thiện';
      else if(final>=80) evidenceDecision='Evidence rất tốt';
      else if(final>=68) evidenceDecision='Evidence cần đánh giá thêm';
      else evidenceDecision='Evidence cảnh báo';
    }
    return {market,product,prescan,final,stage,hard,recommendation,selectionDecision,evidenceDecision,marketEvidenceCount,productEvidenceCount,preScanCompleteness,postTestCompleteness,completeness};
  }
  function gameEvidenceSourceLabel(g){
    return g?.scorecard?.productEvidenceSource||'Chưa xác định nguồn';
  }
  function gameEvidenceStatusHtml(g,d){
    if(d.productEvidenceCount<2)return `<span class="badge">Pre-Scan</span><div class="small muted">${d.productEvidenceCount}/5 nhóm evidence</div>`;
    return `<span class="badge blue">Có Product Evidence</span><div class="small muted">${d.productEvidenceCount}/5 · ${esc(gameEvidenceSourceLabel(g))}</div>`;
  }
  function gameSelectionDecisionHtml(d){
    return `${badge(d.selectionDecision)}${d.stage==='POST-TEST'?`<div class="small muted" style="margin-top:5px">${esc(d.evidenceDecision)}${d.final===null?'':` · ${fmt(d.final,1)}/100`}</div>`:''}`;
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


  const DEAL_STATUS=['Đang xác định phạm vi','Đang đàm phán','Đánh giá nội bộ','Đánh giá pháp lý','Đã ký','Tạm dừng','Đã đóng'];
  const DEAL_STAGES=['','Concept','Prototype','MVP','Game hoàn chỉnh','Soft Launch','Đang live / Scale'];
  const DEAL_SUPPORT=['','Không hỗ trợ','Hỗ trợ giới hạn','Hỗ trợ đáng kể'];
  const DEAL_TERMS=['Loại Deal','Rev Share SAVA','MG / Hỗ trợ phát triển','Cam kết UA','Recoup','Độc quyền / Khu vực','Quyền sở hữu IP','Quyền kiểm soát sản phẩm / Data','Điều kiện dừng / Chấm dứt','Lịch hỗ trợ vốn / Thanh toán'];
  const DEAL_MILESTONE_TYPES=['Mốc vốn / KPI','Exit / Stop'];
  const DEAL_MILESTONE_STATUS=['Chưa bắt đầu','Đang xử lý','Đạt','Không đạt','Đã đóng'];
  const DEAL_APPROVAL_DECISIONS=['','Tiếp tục','Tiếp tục có điều kiện','Cấu trúc lại Deal','Tạm giữ','Dừng Deal'];
  const DEAL_CORE_CHECK=['','ĐẠT','CÓ ĐIỀU KIỆN','KHÔNG ĐẠT'];
  const DEAL_SOURCE_STATUS={P001:'Đang xác định phạm vi',P002:'Đang xác định phạm vi',P003:'Đang xác định phạm vi',P004:'Đang đàm phán',P005:'Đang xác định phạm vi',P006:'Đang đàm phán',P007:'Đang đàm phán',P008:'Đang đàm phán'};
  const DEAL_SOURCE_ID={P001:'D001',P002:'D002',P003:'D003',P004:'D004',P005:'D005',P006:'D006',P007:'D007',P008:'D008'};
  const DEAL_MARKET_REFERENCES=[
    {id:'PUB-SUPERSONIC-TERMS',publisher:'Supersonic',timing:'Điều khoản công khai hiện tại',stage:'',type:'',mg:null,development:null,ua:'',recoup:'',exclusive:'Độc quyền toàn cầu',ip:'Developer giữ IP',control:'Quyền cao · Có quyền truy cập analytics / Data vận hành theo quan hệ phát hành',kpi:'',stop:'Vi phạm nghĩa vụ sửa lỗi nghiêm trọng có thể kích hoạt chấm dứt / biện pháp xử lý',source:'https://supersonic.com/publishing-terms-and-conditions/',note:'Điều khoản khung công khai; Pricing/Revenue Share nằm trong IO riêng và không công khai.'},
    {id:'PUB-HOMA-DATA',publisher:'Homa',timing:'Quy trình/sản phẩm công khai hiện tại',stage:'',type:'',mg:null,development:null,ua:'Theo KPI',recoup:'',exclusive:'',ip:'',control:'Minh bạch KPI / thử nghiệm chung',kpi:'Retention D1/D7/D28, playtime, CPI/eCPM, A/B testing',stop:'',source:'https://www.homagames.com/homa-lab/data-analytics',note:'Bằng chứng quy trình công khai, không phải điều khoản thương mại.'},
    {id:'PUB-SAYGAMES-PUBLISHING',publisher:'SayGames',timing:'Trang phát hành công khai hiện tại',stage:'Prototype',type:'Khác',mg:null,development:null,ua:'',recoup:'',exclusive:'',ip:'',control:'',kpi:'',stop:'',source:'https://say.games/publishing/',note:'Công khai hỗ trợ từ Prototype đến global launch; điều khoản kinh tế/quyền cụ thể không công khai.'},
    {id:'PUB-APPQ-FUNDING',publisher:'AppQuantum',timing:'Hướng dẫn hỗ trợ vốn công khai năm 2023',stage:'',type:'Hỗ trợ phát triển + Revenue Share',mg:null,development:null,ua:'Theo KPI',recoup:'Chỉ recoup phần hỗ trợ vốn',exclusive:'',ip:'',control:'',kpi:'KPI / Milestone chặt',stop:'',source:'https://appquantum.com/news/may-2023/give-me-the-money%21-funding-application-guide-from-appquantum.html',note:'Hỗ trợ sản phẩm theo KPI/Milestone; khoản hỗ trợ được hoàn từ phần chia của Developer.'},
    {id:'PUB-APPQ-CORE2023',publisher:'AppQuantum',timing:'Chương trình lịch sử năm 2023',stage:'',type:'',mg:250000,development:500000,ua:'Theo KPI',recoup:'',exclusive:'',ip:'',control:'',kpi:'Tối đa $250K thanh toán theo KPI đã thống nhất',stop:'',source:'https://appquantum.com/news/october-2023/appquantum-introduces-core-is-the-king%21-program-for-hyper-and-hybrid-casual-mobile-game-developers.html',note:'Case lịch sử cụ thể; không khái quát thành mọi Deal hiện tại.'},
    {id:'PUB-TILTING-UA',publisher:'Tilting Point',timing:'Quỹ UA công khai hiện tại',stage:'Đang live / Scale',type:'',mg:null,development:null,ua:'',recoup:'',exclusive:'',ip:'',control:'',kpi:'',stop:'',source:'https://www.tiltingpoint.com/',note:'Quỹ UA công khai là hỗ trợ vốn linh hoạt; các điều khoản thương mại cụ thể không công khai.'},
    {id:'PUB-VOODOO-PLATFORM',publisher:'Voodoo',timing:'Điều khoản nền tảng/academy hiện tại',stage:'',type:'',mg:null,development:null,ua:'',recoup:'',exclusive:'',ip:'Developer giữ IP',control:'',kpi:'',stop:'',source:'',note:'Developer giữ IP; Academy có quyền ưu tiên đàm phán trước trong 6 tháng đối với quyền phát hành.'}
  ];
  const DEAL_DEFAULT_RULES={
    rsBaseFloor:.50,rsNoSupportSoftLaunchFloor:.60,rsSupportFloor:.70,rsMaterialTarget:.80,
    riskHighScore:4,protectionMinWhenHigh:4,
    uaTestMax:10000,uaGrowthMax:30000,uaScaleMax:100000,uaT1RsTarget:.70,uaT2RsTarget:.75,uaT3RsTarget:.80,
    stageCommit:{Concept:.10,Prototype:.15,MVP:.25,'Game hoàn chỉnh':.30,'Soft Launch':.40,'Đang live / Scale':.60},
    riskWeights:{partner:.15,game:.25,riskTolerance:.20,competition:.10,bargaining:.10,protection:.20},
    readinessWeights:{partner:.20,game:.30,strategic:.15,bargaining:.10,protection:.15,riskInverse:.10}
  };
  function dealRules(){return {...DEAL_DEFAULT_RULES,...(db.playbook?.dealMaking?.params||{}),stageCommit:{...DEAL_DEFAULT_RULES.stageCommit,...(db.playbook?.dealMaking?.params?.stageCommit||{})}};}
  function dealNum(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
  function ratio(v){const n=dealNum(v);return n===null?null:(Math.abs(n)>1?n/100:n);}
  function parseMoneyLoose(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='number')return Number.isFinite(v)?v:null;const m=String(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;}
  function dealPartner(d){return byId(db.partners,d.partnerId);}
  function dealGameName(d){const g=byId(db.games,d.gameId);const p=dealPartner(d);return d.gameName||intake(g,'Game_Title')||profile(p,'Dự án đang đánh giá')||'—';}
  function dealPartnerStrength(d){const p=dealPartner(d),fit=p?partnerDerived(p).fit:null;return fit===null?null:Math.round(fit/20*10)/10;}
  function dealStrategicBase(d){const p=dealPartner(d);return num(p?.scores?.strategicFit);}
  function dealHardGate(d){const p=dealPartner(d);return p?hardGateResult(p):'CHỜ XÁC MINH';}
  function dealInitialDefaults(d){
    const out=clone(d||{});const source=DEAL_SOURCE_ID[out.partnerId];if(source&&!out.sourceDealId)out.sourceDealId=source;
    if(!out.status||out.status==='Current / Existing'||out.status==='Draft')out.status=DEAL_SOURCE_STATUS[out.partnerId]||'Đang xác định phạm vi';
    if(!out.stage&&out.partnerId==='P001')out.stage='Game hoàn chỉnh';
    if(out.modelSavaRs===undefined||out.modelSavaRs===null)out.modelSavaRs=ratio(out.savaShare);
    if(out.uaBudgetMonthly===undefined||out.uaBudgetMonthly===null)out.uaBudgetMonthly=parseMoneyLoose(out.uaCommitment);
    out.negotiations=Array.isArray(out.negotiations)?out.negotiations:[];
    out.milestoneRows=Array.isArray(out.milestoneRows)?out.milestoneRows:[];
    out.approval=out.approval||{};
    return out;
  }
  function dealDefaultMilestones(){return [
    {type:'Mốc vốn / KPI',milestone:'Ký kết / Thiết lập',condition:'Hard Gate đạt; IP/Data/phạm vi hợp đồng được xác nhận',capitalUnlocked:null,partnerDuty:'',ifFail:'Tạm giữ đến khi xử lý blocker',savaRight:'',owner:'',status:'Chưa bắt đầu',notes:''},
    {type:'Mốc vốn / KPI',milestone:'Test / Prototype',condition:'Build được chấp nhận + tracking/Data đã tích hợp',capitalUnlocked:null,partnerDuty:'',ifFail:'Tối ưu lại / giữ đợt vốn tiếp theo',savaRight:'',owner:'',status:'Chưa bắt đầu',notes:''},
    {type:'Mốc vốn / KPI',milestone:'Soft Launch / Xác thực',condition:'Retention + monetization + ROAS đạt ngưỡng đã thống nhất',capitalUnlocked:null,partnerDuty:'',ifFail:'Tối ưu/test lại; dừng sau số vòng đã thống nhất',savaRight:'',owner:'',status:'Chưa bắt đầu',notes:''},
    {type:'Mốc vốn / KPI',milestone:'Scale / Commercial',condition:'ROAS/payback/scalability đạt economics đã thống nhất',capitalUnlocked:null,partnerDuty:'',ifFail:'Giới hạn spend / stop scale',savaRight:'',owner:'',status:'Chưa bắt đầu',notes:''}
  ];}
  function dealUaTier(ua,r){if(ua===null||ua==='')return '';if(ua<=0)return 'T0 — Không UA';if(ua<=r.uaTestMax)return 'T1 — Test';if(ua<=r.uaGrowthMax)return 'T2 — Tăng trưởng';if(ua<=r.uaScaleMax)return 'T3 — Scale';return 'T4 — Scale lớn';}
  function dealUaRsTarget(ua,r){if(ua===null||ua<=0)return null;if(ua<=r.uaTestMax)return r.uaT1RsTarget;if(ua<=r.uaGrowthMax)return r.uaT2RsTarget;return r.uaT3RsTarget;}
  function dealRiskBand(v){const n=dealNum(v);if(n===null)return {key:'na',label:'Chưa đủ dữ liệu'};if(n<30)return {key:'low',label:'Thấp'};if(n<50)return {key:'medium',label:'Trung bình'};if(n<70)return {key:'high',label:'Cao'};return {key:'very-high',label:'Rất cao'};}
  function dealReadinessBand(v){const n=dealNum(v);if(n===null)return {key:'na',label:'Chưa đủ dữ liệu'};if(n>=75)return {key:'ready',label:'Sẵn sàng'};if(n>=60)return {key:'conditional',label:'Có điều kiện'};return {key:'hold',label:'Pilot / Tạm giữ'};}
  function dealDerived(input){
    const d=dealInitialDefaults(input),r=dealRules();const p=dealPartner(d);
    const partnerStrength=dealPartnerStrength(d),gameEvidence=dealNum(d.gameEvidence),competition=dealNum(d.competitionPressure),riskTolerance=dealNum(d.riskTolerance),bargaining=dealNum(d.bargainingPower),protection=dealNum(d.protection),strategicBase=dealStrategicBase(d),strategic=dealNum(d.strategicOverride)??strategicBase;
    const hard=p?hardGateResult(p):'CHỜ XÁC MINH';
    const riskInputs=[partnerStrength,gameEvidence,riskTolerance,competition,bargaining,protection];
    let riskScore=null;if(riskInputs.every(x=>x!==null))riskScore=Math.round(((5-partnerStrength)/4*100*r.riskWeights.partner)+((5-gameEvidence)/4*100*r.riskWeights.game)+((riskTolerance-1)/4*100*r.riskWeights.riskTolerance)+((competition-1)/4*100*r.riskWeights.competition)+((5-bargaining)/4*100*r.riskWeights.bargaining)+((5-protection)/4*100*r.riskWeights.protection));
    const riskBand=dealRiskBand(riskScore);
    let direction='';
    if(d.partnerId){if(hard!=='ĐẠT')direction='TẠM GIỮ';else if([gameEvidence,competition,riskTolerance,bargaining,protection].some(x=>x===null))direction='THIẾU DỮ LIỆU';else if(gameEvidence<3)direction='PILOT / TẠM GIỮ';else if(gameEvidence>=4&&partnerStrength>=4)direction=competition>=4?'HỖ TRỢ / CẠNH TRANH':'HỖ TRỢ / SCALE';else if(gameEvidence>=4&&partnerStrength>=3)direction='HỖ TRỢ CÓ BẢO VỆ';else if(gameEvidence>=3&&partnerStrength>=4)direction='TEST THEO MILESTONE';else if(gameEvidence>=3&&partnerStrength>=3)direction='PILOT / MILESTONE';else direction='PILOT / CÓ BẢO VỆ';}
    let readiness=null;if([partnerStrength,gameEvidence,strategic,bargaining,protection,riskTolerance].every(x=>x!==null)){const w=r.readinessWeights;readiness=Math.round((partnerStrength/5*100*w.partner)+(gameEvidence/5*100*w.game)+(strategic/5*100*w.strategic)+(bargaining/5*100*w.bargaining)+(protection/5*100*w.protection)+((6-riskTolerance)/5*100*w.riskInverse));}
    const ua=dealNum(d.uaBudgetMonthly),uaTier=dealUaTier(ua,r),uaRsTarget=dealUaRsTarget(ua,r),support=d.supportLevel||'';
    let rsFloor=null;if(!(support===''&&(ua===null||ua<=0))){if((support&&support!=='Không hỗ trợ')||(ua!==null&&ua>0))rsFloor=r.rsSupportFloor;else if(['Soft Launch','Đang live / Scale'].includes(d.stage))rsFloor=r.rsNoSupportSoftLaunchFloor;else rsFloor=r.rsBaseFloor;}
    let rsTarget=rsFloor;if(rsFloor!==null)rsTarget=Math.max(rsFloor,support==='Hỗ trợ đáng kể'?r.rsMaterialTarget:support==='Hỗ trợ giới hạn'?r.rsSupportFloor:rsFloor,uaRsTarget||0);
    const modelRs=ratio(d.modelSavaRs??d.savaShare);let rsControl='THIẾU MỨC HỖ TRỢ / NGÂN SÁCH UA';if(rsFloor!==null){if(modelRs===null)rsControl='KIỂM TRA RS';else if(modelRs<rsFloor)rsControl='KHÔNG ĐẠT — RS < NGƯỠNG';else if(modelRs<rsTarget)rsControl='CẦN LƯU Ý — RS DƯỚI MỤC TIÊU';else rsControl='ĐẠT';}
    const forecast=dealNum(d.forecastNetRevenue12m),opsCost=dealNum(d.directPublishingCost),cap=dealNum(d.internalBudgetCap),partnerAsk=dealNum(d.partnerCapitalAsk);
    let maxInvestment=null;if([riskScore,forecast,modelRs,opsCost,strategic].every(x=>x!==null)){const strategicFactor=[.9,.95,1,1.1,1.2][Math.max(1,Math.min(5,Math.round(strategic)))-1];const profitFactor=riskScore<30?1.5:riskScore<50?2:riskScore<70?3:5;const calc=Math.max(0,forecast*modelRs-opsCost)*(1-riskScore/100)*strategicFactor/profitFactor;maxInvestment=cap===null?calc:Math.min(cap,calc);}
    const stageFactor=r.stageCommit[d.stage]??.25;const initialCommit=maxInvestment===null?null:maxInvestment*stageFactor;const capitalCheck=partnerAsk===null||maxInvestment===null?'':partnerAsk<=maxInvestment?'Trong giới hạn đầu tư':'Yêu cầu vượt giới hạn đầu tư';
    const neg=(d.negotiations||[]);const finalRs=neg.filter(x=>x.term==='Rev Share SAVA').map(x=>ratio(x.final)).filter(x=>x!==null).reduce((a,b)=>a+b,0)||null;
    let finalRsControl='CHƯA CÓ RS CUỐI';if(finalRs!==null&&rsFloor!==null)finalRsControl=finalRs<rsFloor?'KHÔNG ĐẠT — DƯỚI NGƯỠNG':finalRs<rsTarget?'ĐẠT — DƯỚI MỤC TIÊU':'ĐẠT';
    let recommendation='';if(!support&&(ua===null||ua<=0))recommendation='Chọn Mức hỗ trợ SAVA hoặc nhập Ngân sách UA';else if(modelRs!==null&&rsFloor!==null&&modelRs<rsFloor)recommendation='CẤU TRÚC LẠI DEAL — RS thấp hơn ngưỡng tối thiểu';else if(modelRs!==null&&rsTarget!==null&&modelRs<rsTarget)recommendation='RS đạt ngưỡng nhưng thấp hơn mục tiêu; tăng RS hoặc ghi rõ điều khoản đổi lại';else if(direction==='TẠM GIỮ')recommendation='Xử lý Hard Gate của Partner trước khi cam kết';else if(direction==='THIẾU DỮ LIỆU')recommendation='Hoàn thiện điểm đánh giá riêng của Deal';else if(direction==='HỖ TRỢ / CẠNH TRANH')recommendation='Game + Partner mạnh; có thể hỗ trợ tích cực trong giới hạn; dùng nấc UA và giữ bảo vệ cốt lõi';else if(direction==='HỖ TRỢ / SCALE')recommendation='Game + Partner mạnh; Scale theo KPI với nấc UA và mục tiêu RS linh hoạt';else if(direction==='HỖ TRỢ CÓ BẢO VỆ')recommendation='Hỗ trợ vốn theo giai đoạn + Recoup/quyền kiểm soát/quyền dừng mạnh hơn';else if(direction==='TEST THEO MILESTONE')recommendation='Partner tốt, bằng chứng Game trung bình; xác thực Game trước khi mở vốn lớn hơn';else if(direction==='PILOT / MILESTONE')recommendation='Pilot nhỏ + chỉ theo Milestone; không trả trước lớn';else if(direction)recommendation='Chỉ Pilot / bảo vệ mạnh; không trả trước lớn';
    let decision='CHƯA ĐỦ DỮ LIỆU';if(hard!=='ĐẠT')decision='TẠM GIỮ — Hard Gate';else if(/KHÔNG ĐẠT/.test(rsControl))decision='CẤU TRÚC LẠI DEAL — NGƯỠNG RS';else if([gameEvidence,competition,riskTolerance,bargaining,protection].some(x=>x===null))decision='CHƯA ĐỦ DỮ LIỆU';else if(riskTolerance>=r.riskHighScore&&protection<r.protectionMinWhenHigh)decision='CẤU TRÚC LẠI DEAL — THIẾU BẢO VỆ';else if(riskScore>=70)decision='TẠM GIỮ / CẤU TRÚC LẠI — RỦI RO';else if(capitalCheck==='Yêu cầu vượt giới hạn đầu tư')decision='CẤU TRÚC LẠI DEAL — VỐN';else if(/CẦN LƯU Ý/.test(rsControl))decision='TIẾP TỤC CÓ ĐIỀU KIỆN';else if(readiness!==null&&readiness>=75)decision='TIẾP TỤC ĐÀM PHÁN';else if(readiness!==null&&readiness>=60)decision='TIẾP TỤC CÓ ĐIỀU KIỆN';else decision='PILOT / TẠM GIỮ';
    let nextAction='Hoàn thiện dữ liệu Deal';if(/CHƯA ĐỦ DỮ LIỆU/.test(decision))nextAction='Hoàn thiện 5 điểm đánh giá riêng của Deal';else if(/NGƯỠNG RS/.test(decision))nextAction='Tăng SAVA RS lên ngưỡng tối thiểu của case';else if(/CẦN LƯU Ý/.test(rsControl))nextAction=`Tăng RS về gần mục tiêu ${pct(rsTarget,0)} hoặc ghi rõ giá trị đổi lại`;else if(/BẢO VỆ/.test(decision))nextAction='Tăng Recoup / mốc kiểm soát / quyền kiểm soát / quyền dừng';else if(/VỐN/.test(decision))nextAction='Giảm / chia theo giai đoạn yêu cầu vốn';else if(/TẠM GIỮ/.test(decision))nextAction='Xử lý blocker trước khi đàm phán';else nextAction='Đặt Mục tiêu / Mức chấp nhận / Ngưỡng dừng tại phần Đàm phán';
    const approval=d.approval||{};const core=[approval.dataCheck,approval.ipCheck,approval.exitCheck].filter(Boolean);const coreStatus=core.length<3?'CHƯA ĐỦ':core.every(x=>x==='ĐẠT')?'ĐẠT':core.some(x=>x==='KHÔNG ĐẠT')?'KHÔNG ĐẠT':'CÓ ĐIỀU KIỆN';
    return {partnerStrength,strategicBase,strategic,riskScore,riskBand,direction,readiness,readinessBand:dealReadinessBand(readiness),uaTier,uaRsTarget,rsFloor,rsTarget,modelRs,rsControl,maxInvestment,initialCommit,capitalCheck,recommendation,decision,nextAction,finalRs,finalRsControl,coreStatus,hard};
  }
  function riskScoreBar(value){const n=dealNum(value),b=dealRiskBand(value),w=n===null?0:Math.max(0,Math.min(100,n));return `<div class="deal-score deal-risk-${b.key}" title="${n===null?'Chưa đủ dữ liệu':`${n}/100 · ${b.label}`}"><div><strong>${n===null?'—':fmt(n,0)}</strong><span>${esc(b.label)}</span></div><div class="deal-meter"><i style="width:${w}%"></i></div></div>`;}
  function readinessScoreBar(value){const n=dealNum(value),b=dealReadinessBand(value),w=n===null?0:Math.max(0,Math.min(100,n));return `<div class="deal-score deal-ready-${b.key}" title="${n===null?'Chưa đủ dữ liệu':`${n}/100 · ${b.label}`}"><div><strong>${n===null?'—':fmt(n,0)}</strong><span>${esc(b.label)}</span></div><div class="deal-meter"><i style="width:${w}%"></i></div></div>`;}
  function dealTermAutoCheck(term,final,derived){if(term!=='Rev Share SAVA')return '—';const f=ratio(final);if(f===null)return 'CHƯA CÓ KẾT QUẢ CUỐI';if(derived.rsFloor!==null&&f<derived.rsFloor)return 'KHÔNG ĐẠT — DƯỚI NGƯỠNG';if(derived.rsTarget!==null&&f<derived.rsTarget)return 'ĐẠT — DƯỚI MỤC TIÊU';return 'ĐẠT';}
  function dealTermDefaultLogic(term,derived){
    const direction=derived?.direction||'';
    if(term==='Loại Deal'){if(direction==='PILOT / CÓ BẢO VỆ')return 'Revenue Share / Pilot';if(direction==='HỖ TRỢ CÓ BẢO VỆ')return 'Hỗ trợ vốn theo giai đoạn + Revenue Share';if(direction==='HỖ TRỢ / CẠNH TRANH')return 'Cấu trúc linh hoạt để thắng Deal';if(['TEST THEO MILESTONE','PILOT / MILESTONE'].includes(direction))return 'Hỗ trợ vốn theo Milestone + Revenue Share';return 'Phát hành tiêu chuẩn';}
    if(term==='Rev Share SAVA')return `Ngưỡng ${derived?.rsFloor===null||derived?.rsFloor===undefined?'—':pct(derived.rsFloor,0)} | Mục tiêu ${derived?.rsTarget===null||derived?.rsTarget===undefined?'—':pct(derived.rsTarget,0)}`;
    if(term==='MG / Hỗ trợ phát triển')return ['PILOT / CÓ BẢO VỆ','TEST THEO MILESTONE','PILOT / MILESTONE'].includes(direction)?'Thấp / chia theo Milestone':'Chia theo giai đoạn; giới hạn theo rủi ro và khả năng đầu tư';
    if(term==='Cam kết UA')return 'Theo KPI + có cap; tăng dần theo nấc ngân sách UA';
    if(term==='Recoup')return 'Recoup phần vốn có rủi ro đáng kể, trừ khi economics tổng thể bù đủ';
    if(term==='Độc quyền / Khu vực')return 'Độc quyền tương xứng với mức cam kết của SAVA';
    if(term==='Quyền sở hữu IP')return 'Mặc định Developer giữ IP; SAVA có đủ publishing / marketing / data rights';
    if(term==='Quyền kiểm soát sản phẩm / Data')return 'Data access là bắt buộc; control tăng theo risk + responsibility';
    if(term==='Điều kiện dừng / Chấm dứt')return 'Phải có performance + delivery + compliance exit trước khi commit vốn đáng kể';
    if(term==='Lịch hỗ trợ vốn / Thanh toán')return 'Chia theo Milestone; evidence đạt mới mở đợt tiếp theo';
    return '';
  }
  function dealDefaultNegotiations(){return DEAL_TERMS.map(term=>({term,marketRef:'',target:'',acceptable:'',stop:'',partnerAsk:'',final:'',tradeoff:'',notes:''}));}
  function dealGuideCards(rows){return `<div class="bd-guide-grid">${rows.map(([field,fill,rule,example])=>`<div class="bd-guide-card"><b>${esc(field)}</b><span>${esc(fill)}</span><small>${esc(rule)}</small>${example?`<em>Ví dụ: ${esc(example)}</em>`:''}</div>`).join('')}</div>`;}
  function dealGuideLegend(){return `<div class="bd-guide-legend"><span class="guide-input">BD nhập / chọn</span><span class="guide-linked">Tự lấy từ Partner / Deal</span><span class="guide-derived">Tự tính / kiểm tra</span><span class="guide-review">Cần review</span></div>`;}
  function dealRsPolicyHtml(){
    const rows=[
      ['Trước Soft Launch · Không hỗ trợ','≥50%','≤50%','Ngưỡng tạm'],
      ['Soft Launch+ · Không hỗ trợ','≥60%','≤40%','Ngưỡng cứng'],
      ['Có SAVA hỗ trợ','≥70%','≤30%','Ngưỡng cứng'],
      ['Hỗ trợ đáng kể','~80%','~20%','Mục tiêu']
    ];
    const ua=[['T0','$0','Theo giai đoạn / mức hỗ trợ','Không UA'],['T1','>$0–$10K','70% / 30%','Test'],['T2','>$10K–$30K','75% / 25%','Tăng trưởng'],['T3','>$30K–$100K','80% / 20%','Scale'],['T4','>$100K','80% / 20%','Scale lớn · cần management review']];
    return `<div class="deal-rs-policy"><div class="deal-rs-policy-head"><div><span class="eyebrow-mini">NGUYÊN TẮC ĂN CHIA</span><h3>Revenue Share theo mức hỗ trợ & giai đoạn</h3></div><div class="deal-rs-anchor">Deal có hỗ trợ: <b>SAVA ≥70%</b><br>Scale / hỗ trợ lớn: <b>mục tiêu 80%</b></div></div><div class="deal-rs-policy-grid"><div><table class="deal-rs-matrix"><thead><tr><th>Trường hợp</th><th>SAVA</th><th>Đối tác</th><th>Rule</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td><b>${r[1]}</b></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table></div><div><table class="deal-rs-matrix"><thead><tr><th>Nấc UA</th><th>Ngân sách / tháng</th><th>SAVA / Đối tác</th><th>Cách dùng</th></tr></thead><tbody>${ua.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table></div></div><div class="deal-give-get"><b>Không nhượng bộ miễn phí.</b> Nếu SAVA giảm Revenue Share, tăng MG/UA hoặc nhượng quyền khác, phải ghi rõ giá trị đổi lại: recoup, quyền kiểm soát, thời hạn, rights/exclusivity, economics hoặc giá trị chiến lược tương xứng.</div></div>`;
  }
  function dealDataGuideHtml(){
    const fields=[
      ['Mã Deal','Mã duy nhất cho từng Game × Partner × Deal.','Không trùng mã; nên dùng D001, D002…','D009'],
      ['Giai đoạn Game','Mức trưởng thành hiện tại của Game.','Chọn đúng stage vì ảnh hưởng % vốn commit ban đầu.','Soft Launch'],
      ['Bằng chứng Game /5','Game đã chứng minh product/market/economics đến đâu.','1 = chưa test; 3 = có signal ban đầu; 5 = ROAS/payback/scale đã proven.','4'],
      ['Áp lực cạnh tranh /5','Mức SAVA phải cạnh tranh với Publisher khác để win Deal.','1 = gần như không cạnh tranh; 3 = có alternative credible; 5 = nhiều offer/bidding.','4'],
      ['Mức chịu rủi ro SAVA /5','Downside SAVA chịu nếu Deal thất bại.','Xét MG, Funding, UA guarantee, khả năng recoup và quyền exit.','3'],
      ['Điều chỉnh giá trị chiến lược','Chỉ override khi Game cụ thể khác đáng kể so với Partner chung.','1–5; để trống = dùng điểm chiến lược cơ sở.','5'],
      ['Lợi thế đàm phán SAVA /5','Bargaining power của SAVA trong Deal hiện tại.','1 = Partner mạnh hơn; 3 = cân bằng; 5 = SAVA mạnh hơn.','3'],
      ['Mức bảo vệ /5','Mức SAVA được bảo vệ bởi term của Deal.','Xét Recoup + Milestone + Data/Control + Exit + IP/Legal.','4'],
      ['Doanh thu thuần dự báo 12T','Forecast Net Revenue 12 tháng theo cùng revenue base dùng để chia RS.','Không nhập Gross Revenue nếu RS tính trên Net Revenue.','$500,000'],
      ['SAVA RS dùng cho mô hình','% Revenue Share dự kiến SAVA nhận.','Phải đạt Dynamic RS Floor của Deal.','70%'],
      ['Vốn Partner đề xuất','Tổng vốn/MG/Dev Funding Partner yêu cầu SAVA commit.','Không cộng UA tháng nếu đã nhập riêng để tránh double-count.','$50,000'],
      ['Mức hỗ trợ SAVA','Mức SAVA trực tiếp hỗ trợ ngoài publishing cơ bản.','Không hỗ trợ / Hỗ trợ giới hạn / Hỗ trợ đáng kể.','Hỗ trợ đáng kể'],
      ['Ngân sách UA cam kết / tháng','Paid UA SAVA cam kết chạy mỗi tháng khi đúng stage.','Nhập commitment/cap thực tế, không phải spend kỳ vọng không ràng buộc.','$30,000']
    ];
    return `<details class="bd-guide" open><summary>Hướng dẫn BD · Dữ liệu Deal</summary><div class="bd-guide-body"><div class="notice"><b>Nguyên tắc nhập:</b> chỉ nhập những gì bạn biết. Nếu chưa có dữ liệu/evidence thì để trống, <b>không tự mặc định điểm 3</b>. Partner/Hard Gate lấy từ Partner Selection; các kết quả màu tím là hệ thống tự tính.</div>${dealGuideLegend()}${dealGuideCards(fields)}<div class="bd-score-guide"><b>Khung điểm nhanh 1–5</b><div><span><strong>Bằng chứng Game</strong> 1: chưa test · 3: có CPI/Retention/monetization signal · 5: proven ROAS/payback/scale</span><span><strong>Áp lực cạnh tranh</strong> 1: gần như duy nhất · 3: có alternative credible · 5: nhiều offer/bidding</span><span><strong>Rủi ro SAVA</strong> 1: dễ dừng · 3: staged/capped · 5: MG/Funding/UA lớn + exit yếu</span><span><strong>Lợi thế SAVA</strong> 1: Partner nắm leverage · 3: cân bằng · 5: SAVA mạnh</span><span><strong>Mức bảo vệ</strong> 1: rất yếu · 3: chuẩn · 5: full recoup + gate + data + exit + legal</span></div></div></div></details>`;
  }
  function dealNegotiationGuideHtml(){
    const fields=[
      ['Điều khoản','Chọn term đang thương lượng.','1 dòng cho mỗi term quan trọng: RS, MG/Funding, UA, Recoup, Exclusivity, IP, Data/Control, Exit, Payment.','Rev Share SAVA'],
      ['Tham chiếu thị trường','Benchmark/comparable case có evidence.','Chỉ dùng thông tin có nguồn; chưa biết thì để trống.','Publisher A: 60/40, không funding'],
      ['Mục tiêu','Mức SAVA muốn đạt khi mở đàm phán.','Bám Logic Deal SAVA + benchmark + mức hỗ trợ/risk.','70% RS SAVA'],
      ['Mức chấp nhận','Mức không tối ưu nhưng SAVA vẫn có thể ký.','Không được vượt qua Hard Floor/Hard Rule của SAVA.','65% nếu không funding'],
      ['Ngưỡng dừng','Điểm SAVA không nên tiếp tục nếu Partner không thay đổi.','Viết threshold định lượng hoặc điều kiện không thể chấp nhận.','<60% RS = dừng'],
      ['Yêu cầu Partner','Term/đề xuất Partner đang yêu cầu ở vòng hiện tại.','Cập nhật theo term sheet hoặc trao đổi mới nhất.','$30K MG + 50/50'],
      ['Kết quả cuối','Term đã chốt sau đàm phán.','Chỉ điền khi hai bên đã thống nhất; riêng RS nhập dạng %.','70%'],
      ['Giá trị đổi lại','SAVA nhận lại gì nếu nhượng một term.','Không concession miễn phí: đổi bằng economics, recoup, rights, term, exclusivity hoặc pipeline.','Giảm RS 5% nếu UA được full recoup'],
      ['Ghi chú','Context, open point hoặc lý do exception.','Nếu vi phạm policy phải nêu người/level phê duyệt exception.','CEO approve exception 65%']
    ];
    return `<details class="bd-guide"><summary>Hướng dẫn BD · Đàm phán</summary><div class="bd-guide-body"><div class="notice"><b>1 dòng = 1 Deal × 1 điều khoản.</b> Mục tiêu = anchor SAVA muốn đạt; Mức chấp nhận = mức vẫn có thể ký; Ngưỡng dừng = qua ngưỡng phải dừng/cấu trúc lại; Give/Get = giá trị SAVA lấy lại khi nhượng bộ.</div>${dealGuideLegend()}${dealGuideCards(fields)}<div class="bd-term-tips"><b>Gợi ý nhanh theo điều khoản</b><ul><li><b>Rev Share:</b> Target ≥ mục tiêu RS tự tính; Acceptable không thấp hơn RS Floor.</li><li><b>MG / Funding:</b> ưu tiên thấp hoặc chia Milestone khi evidence chưa mạnh.</li><li><b>UA:</b> KPI-based + có cap; ngân sách tăng thì target RS tăng theo nấc.</li><li><b>Recoup:</b> ưu tiên recoup phần capital at risk đáng kể; nếu không recoup phải bù ở RS/rights/term.</li><li><b>IP + Data/Control:</b> Developer giữ IP mặc định; Data access là must-have.</li><li><b>Exit:</b> phải có performance + delivery + compliance exit; capital exposure càng cao thì exit càng rõ.</li></ul></div></div></details>`;
  }
  function dealMilestoneGuideHtml(){
    const fields=[
      ['Loại','Mốc vốn/KPI hoặc Exit/Stop.','Không trộn KPI unlock vốn và exit trigger trong cùng một dòng.','Mốc vốn / KPI'],
      ['Mốc / Điều kiện','Tên mốc hoặc trigger cụ thể.','Viết ngắn, dễ filter/sort.','Soft Launch / Xác thực'],
      ['KPI / Điều kiện đạt','Threshold phải đạt để qua mốc.','Ưu tiên số đo rõ: CPI, Retention, ROAS, payback, deadline, Data access.','D7 ROAS ≥50%'],
      ['Vốn được mở','Số vốn/UA được phép unlock khi Pass.','Không vượt Max Investment Capacity nếu chưa có phê duyệt lại.','$20,000'],
      ['Nghĩa vụ Partner','Partner phải bàn giao/làm gì ở mốc này.','Nêu deliverable + SLA nếu có.','Fix blocker <48h; 2 build/tuần'],
      ['Nếu không đạt','Hành động khi Fail.','Nêu rõ số vòng optimize/retest trước khi stop.','Optimize 1 vòng rồi retest'],
      ['Quyền SAVA / Xử lý','Quyền SAVA khi trigger xảy ra.','Pause funding, giảm UA, hold tranche, terminate…','Dừng tranche tiếp theo'],
      ['Trạng thái','Tiến độ hiện tại.','Dùng dropdown và cập nhật theo thời gian.','Đang xử lý'],
      ['Ghi chú','Context hoặc vấn đề cần theo dõi.','Không lặp lại KPI; chỉ ghi exception/open point.','Partner xin lùi 5 ngày']
    ];
    return `<details class="bd-guide"><summary>Hướng dẫn BD · Mốc / KPI / Exit</summary><div class="bd-guide-body"><div class="notice">Không unlock vốn chỉ dựa trên thời gian. Ưu tiên <b>evidence/KPI rõ</b>; nếu mốc không đạt thì giữ tranche tiếp theo, giảm UA hoặc kích hoạt quyền dừng theo điều kiện đã chốt.</div>${dealGuideLegend()}${dealGuideCards(fields)}</div></details>`;
  }
  function dealApprovalGuideHtml(){
    const fields=[
      ['Data / IP / Exit','Đánh giá 3 nhóm must-have trước khi ký.','Chỉ PASS khi Data access, IP/legal và Exit protection đều đủ.','ĐẠT'],
      ['Quyết định','Quyết định cuối của Deal.','Tiếp tục / Có điều kiện / Cấu trúc lại / Tạm giữ / Dừng.','Tiếp tục có điều kiện'],
      ['Điều kiện trước khi ký','Các điều kiện bắt buộc phải đóng trước signature.','Viết action cụ thể; owner/deadline nếu cần.','Bổ sung full Data access vào hợp đồng'],
      ['Rủi ro / Điểm chưa chốt','Open point còn lại sau negotiation.','Chỉ giữ điểm có thể ảnh hưởng economics, control hoặc delivery.','Chưa chốt recoup UA'],
      ['Người phê duyệt','Người/level phê duyệt cuối.','Deal exception nên ghi đúng cấp duyệt.','CEO / BOD'],
      ['Ngày quyết định','Ngày management đưa ra quyết định.','Nhập ngày thực tế để audit lịch sử Deal.','16/09/2026'],
      ['Ghi chú','Kết luận ngắn hoặc exception rationale.','Nếu Final term dưới SAVA target nhưng vẫn approve, ghi rõ lý do.','Strategic case; approved exception']
    ];
    return `<details class="bd-guide"><summary>Hướng dẫn BD · Phê duyệt cuối</summary><div class="bd-guide-body">${dealGuideLegend()}${dealGuideCards(fields)}<div class="bd-approval-rules"><b>Quy tắc phê duyệt nhanh</b><ul><li>RS cuối &lt; Hard Floor → mặc định <b>Cấu trúc lại</b> hoặc cần exception approval.</li><li>Data / IP / Exit có bất kỳ must-have nào KHÔNG ĐẠT → <b>Hold / Cấu trúc lại</b> trước khi ký.</li><li>Vốn Partner yêu cầu &gt; Max Investment Capacity → giảm commitment, chia tranche hoặc xin phê duyệt lại.</li><li>Risk cao → vốn phải staged, KPI-gated và protection tương ứng.</li><li>Open point phải chuyển thành “Điều kiện trước khi ký” hoặc được approve exception.</li></ul></div></div></details>`;
  }

  function nav(){
    $('#mainNav').innerHTML=NAV.map(([id,n,label])=>`<button data-nav="${id}" class="${currentView===id?'active':''}"><span class="num">${n}</span><span class="nav-label">${label}</span></button>`).join('');
    $('#mainNav').querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{currentView=b.dataset.nav;location.hash=currentView;render();});
  }
  function setHeader(title,eyebrow='Publishing Operating System'){$('#pageTitle').textContent=title;$('#pageEyebrow').textContent=eyebrow;}
  function kpi(label,value,sub=''){return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;}
  function panel(title,body,subtitle='',actions=''){return `<div class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${actions}</div><div class="panel-body">${body}</div></div>`;}
  function table(headers,rows,extraClass=''){return `<div class="table-wrap"><table class="table ${extraClass}"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="empty">Không có dữ liệu</td></tr>`}</tbody></table></div>`;}

  function render(){
    nav();
    if(!NAV.some(x=>x[0]===currentView)) currentView='dashboard';
    ({dashboard:renderDashboard,partners:renderPartners,deals:renderDeals,market:renderMarket,games:renderGames,sourcing:renderSourcing,operations:renderOperations,sources:renderSources,audit:renderAudit}[currentView]||renderDashboard)();
    applyRoleUi();
  }

  function applyRoleUi(){
    if(!window.SAVA_SUPABASE?.configured)return;
    const canEdit=window.SAVA_SUPABASE.canEdit();
    const canDelete=window.SAVA_SUPABASE.canDelete();
    document.querySelectorAll('[data-action="quick-add"],[data-action^="add-"]').forEach(el=>el.disabled=!canEdit);
    document.querySelectorAll('[data-sourcing-stage]').forEach(el=>el.disabled=!canEdit);
    document.querySelectorAll('[data-delete-partner]').forEach(el=>el.disabled=!canDelete);
    const quick=document.querySelector('[data-action="quick-add"]');if(quick)quick.style.display=(canEdit&&!['sources','audit'].includes(currentView))?'':'none';
    const imp=$('#importJson');if(imp){imp.disabled=!canDelete;const holder=imp.closest('.file-button');if(holder)holder.style.display=canDelete?'':'none';}
    const role=db.settings?.role||window.SAVA_SUPABASE.getRole();
    const user=db.settings?.currentUser||'';
    const st=$('#saveState');if(st&&!isSyncing)st.textContent=`${user} · ${role}`;
  }

  function renderDashboard(){
    setHeader('Tổng quan Publishing','SAVA Publishing · Tổng quan điều hành');

    const partners=(db.partners||[]).map(p=>({p,d:partnerDerived(p)}));
    const games=(db.games||[]).map(g=>({g,d:gameDerived(g)}));
    const deals=(db.deals||[]).map(dealInitialDefaults).map(d=>({d,x:dealDerived(d)}));
    const sourcing=db.sourcing||[];
    const projects=db.projects||[];
    const market=marketAnalytics(db.market||[]);

    const marketP1=market.filter(x=>x.direction?.key==='priority');
    const marketP2=market.filter(x=>x.direction?.key==='test');
    const topMarket=[...marketP1,...marketP2].sort((a,b)=>(b.score??-1)-(a.score??-1))[0]||[...market].filter(x=>x.score!==null).sort((a,b)=>b.score-a.score)[0];

    const activeSourcing=sourcing.filter(x=>sourcingStatus(x)==='Đang xử lý');
    const stuck=activeSourcing.filter(x=>sourcingPipelineAlert(x)==='STUCK');
    const overdue=activeSourcing.filter(sourcingOverdue);
    const qualified=sourcing.filter(x=>sourcingQualified(x)==='Có').length;
    const reached=Object.fromEntries(STAGES.map(st=>[st,sourcing.filter(x=>sourcingReached(x,st)).length]));

    const readyPartners=partners.filter(({d})=>d.hard==='ĐẠT'&&d.fit!==null&&d.fit>=75);
    const highPartnerRisks=(db.partnerRisks||[]).filter(r=>r.status!=='Đã đóng'&&['Cao','Nghiêm trọng'].includes(r.level||riskLevel(r.score)));
    const partnerPending=partners.filter(({d})=>d.hard!=='ĐẠT'||d.minimumGate!=='ĐẠT');

    const gameProceed=games.filter(({d})=>/^Tiếp tục$/.test(d.selectionDecision));
    const gameConditional=games.filter(({d})=>/Tiếp tục có điều kiện/.test(d.selectionDecision));
    const gameGateOpen=games.filter(({d})=>d.hard!=='PASS');

    const activeDeals=deals.filter(({d})=>!['Tạm dừng','Đã đóng'].includes(d.status));
    const highRiskDeals=deals.filter(({x})=>x.riskScore!==null&&x.riskScore>=50);
    const dealReady=deals.filter(({d,x})=>/TIẾP TỤC/.test(String(dealDisplayDecision(d,x)||'').toUpperCase()));

    const opStageCounts=OPERATION_ROADMAP.map((_,i)=>projects.filter(p=>operationStageIndex(p)===i).length);
    const scaleProjects=opStageCounts[4]||0;
    const opAttention=projects.filter(p=>/FAIL|STOP|HOLD|TEST THÊM/i.test(String(p.gateReview?.result||p.latestDecision||'')));

    const attentionCount=highPartnerRisks.length+stuck.length+overdue.length+gameGateOpen.length+highRiskDeals.length+opAttention.length;

    const metric=(label,value,sub,tone='blue')=>`<div class="exec-metric ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub||'')}</small></div>`;
    const navLink=(label,view)=>`<button class="exec-link" data-dash-nav="${view}">${esc(label)} →</button>`;

    const focus=[];
    highPartnerRisks.slice(0,3).forEach(r=>focus.push({tone:'bad',title:`Rủi ro Partner · ${r.partnerId}`,detail:r.risk||r.name||`${r.level||riskLevel(r.score)} risk`,view:'partners'}));
    if(stuck.length)focus.push({tone:'bad',title:`${stuck.length} Lead vượt SLA`,detail:'Đã vượt thời gian xử lý chuẩn ở giai đoạn hiện tại; cần xử lý điểm nghẽn.',view:'sourcing'});
    if(overdue.length)focus.push({tone:'warn',title:`${overdue.length} Lead quá hạn hành động`,detail:'Hành động tiếp theo đã quá hạn.',view:'sourcing'});
    if(gameGateOpen.length)focus.push({tone:'warn',title:`${gameGateOpen.length} Game còn Hard Gate mở`,detail:'Cần đóng Hard Gate trước khi ra quyết định đi tiếp.',view:'games'});
    if(highRiskDeals.length)focus.push({tone:'warn',title:`${highRiskDeals.length} Deal rủi ro cao`,detail:'Điểm rủi ro ≥50/100; cần rà lại bảo vệ, vốn và Revenue Share.',view:'deals'});
    if(opAttention.length)focus.push({tone:'warn',title:`${opAttention.length} Project cần review Gate`,detail:'Có trạng thái Hold / Test thêm / Fail / Stop trong vận hành sau Deal.',view:'operations'});
    if(!focus.length)focus.push({tone:'good',title:'Không có cảnh báo ưu tiên cao',detail:'Dữ liệu hiện tại chưa ghi nhận blocker hoặc rủi ro cần can thiệp ngay.',view:'dashboard'});

    const marketCards=[...marketP1,...marketP2].sort((a,b)=>(b.score??-1)-(a.score??-1)).slice(0,5).map(x=>`<button class="exec-list-row" data-open-market="${esc(x.m.Mechanic_ID)}"><div><b>${esc(x.m.Mechanic)}</b><small>${esc(x.direction.label)} · ${esc(x.trend.label)}</small></div><strong>${x.score===null?'—':fmt(x.score,1)}/100</strong></button>`).join('')||'<div class="exec-empty">Chưa có market P1/P2 đủ dữ liệu.</div>';

    const topPartners=[...partners].filter(({d})=>d.fit!==null).sort((a,b)=>(b.d.fit??-1)-(a.d.fit??-1)).slice(0,5).map(({p,d})=>`<button class="exec-list-row" data-open-partner="${p.id}"><div><b>${esc(profile(p,'Tên Partner / Studio')||p.id)}</b><small>${esc(d.final)} · ${esc(profile(p,'Genre chính')||'—')}</small></div><strong>${fmt(d.fit,1)}/100</strong></button>`).join('')||'<div class="exec-empty">Chưa có Partner đủ dữ liệu chấm điểm.</div>';

    const topGames=[...games].filter(({d})=>d.prescan!==null).sort((a,b)=>(b.d.prescan??-1)-(a.d.prescan??-1)).slice(0,5).map(({g,d})=>`<button class="exec-list-row" data-open-game="${g.id}"><div><b>${esc(intake(g,'Game_Title')||g.id)}</b><small>${esc(d.selectionDecision)} · ${esc(intake(g,'Mechanic')||'—')}</small></div><strong>${fmt(d.prescan,1)}/100</strong></button>`).join('')||'<div class="exec-empty">Chưa có Game đủ dữ liệu Pre-Scan.</div>';

    const flow=STAGES.map((st,i)=>`<div class="exec-flow-step"><span>${i+1}</span><b>${st}</b><strong>${reached[st]||0}</strong>${i<STAGES.length-1?'<i>→</i>':''}</div>`).join('');
    const opRoad=OPERATION_ROADMAP.map((s,i)=>`<div class="exec-op-step op-${i}"><span>${esc(s.code)}</span><b>${esc(s.title)}</b><strong>${opStageCounts[i]||0}</strong></div>`).join('');

    const summaryParts=[];
    if(marketP1.length+marketP2.length)summaryParts.push(`${marketP1.length+marketP2.length} cơ hội thị trường P1/P2`);
    if(gameProceed.length+gameConditional.length)summaryParts.push(`${gameProceed.length+gameConditional.length} game có thể đi tiếp`);
    if(activeDeals.length)summaryParts.push(`${activeDeals.length} Deal đang theo dõi`);
    if(projects.length)summaryParts.push(`${projects.length} dự án sau Deal`);
    let executiveSummary=summaryParts.length?`Hiện có ${summaryParts.join(', ')}.`:'Chưa đủ dữ liệu để tạo tóm tắt điều hành.';
    if(attentionCount)executiveSummary+=` Có ${attentionCount} vấn đề cần xem xét.`;

    content.innerHTML=`<div class="exec-dashboard">
      <section class="exec-hero"><div class="exec-hero-copy"><div class="exec-hero-kicker">SAVA PUBLISHING OS</div><h2>Tổng quan SAVA Publishing</h2><p>${esc(executiveSummary)}</p><div class="exec-hero-meta"><span><b>${attentionCount}</b> vấn đề cần xem xét</span><span><b>${marketP1.length}</b> P1 · <b>${marketP2.length}</b> P2</span><span><b>${scaleProjects}</b> dự án ở Scale</span></div></div><img src="assets/sava-logo.png" alt="SAVA" class="exec-hero-logo"></section>

      <div class="exec-metric-grid">
        ${metric('Cơ hội thị trường',`${marketP1.length} P1 · ${marketP2.length} P2`,topMarket?`Ưu tiên: ${topMarket.m.Mechanic} · ${fmt(topMarket.score,1)}/100`:'Chưa đủ dữ liệu','cyan')}
        ${metric('Lead đang xử lý',activeSourcing.length,`${qualified} Qualified · ${stuck.length} vượt SLA`,'blue')}
        ${metric('Đối tác sẵn sàng',readyPartners.length,`${highPartnerRisks.length} rủi ro cao đang mở`,'purple')}
        ${metric('Game đủ điều kiện',gameProceed.length+gameConditional.length,`${gameGateOpen.length} Hard Gate chưa đóng`,'cyan')}
        ${metric('Deal đang theo dõi',activeDeals.length,`${dealReady.length} có thể tiếp tục · ${highRiskDeals.length} rủi ro cao`,'blue')}
        ${metric('Dự án sau Deal',projects.length,`${scaleProjects} ở Scale · ${opAttention.length} cần review`,'purple')}
      </div>

      <div class="exec-layout-main">
        <section class="panel exec-attention"><div class="panel-head"><div><h2>Điểm cần xem xét</h2><p>Các blocker, rủi ro và quyết định cần ưu tiên theo dữ liệu hiện tại.</p></div><span class="exec-count">${attentionCount}</span></div><div class="panel-body exec-focus-list">${focus.slice(0,8).map(x=>`<button class="exec-focus ${x.tone}" data-dash-nav="${x.view}"><span></span><div><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div><i>→</i></button>`).join('')}</div></section>
        <section class="panel"><div class="panel-head"><div><h2>Cơ hội thị trường ưu tiên</h2><p>Các mechanic P1/P2 theo Market Intelligence hiện tại.</p></div>${navLink('Xem Market','market')}</div><div class="panel-body exec-list">${marketCards}</div></section>
      </div>

      ${panel('Tiến độ Funnel Publishing',`<div class="exec-flow">${flow}</div><div class="exec-flow-note"><b>Lead → Scale:</b> ${sourcing.length?pct((reached.Scale||0)/sourcing.length,2):'—'} · <b>Deal → Test:</b> ${reached.Deal?pct((reached.Test||0)/reached.Deal,1):'—'} · <b>Cần xử lý:</b> ${stuck.length+overdue.length}</div>`,'Tiến độ từ Lead đến Scale theo dữ liệu Sourcing dùng chung.',navLink('Xem Sourcing','sourcing'))}

      <div class="exec-three-col">
        ${panel('Đối tác ưu tiên',`<div class="exec-list">${topPartners}</div>`,'Xếp theo Partner Fit; Hard Gate vẫn override score.',navLink('Xem Partner','partners'))}
        ${panel('Game ưu tiên',`<div class="exec-list">${topGames}</div>`,'Xếp theo Pre-Scan trước Test.',navLink('Xem Game','games'))}
        ${panel('Deal & rủi ro',`<div class="exec-deal-summary"><div><span>Active Deal</span><b>${activeDeals.length}</b></div><div><span>Risk ≥50</span><b class="${highRiskDeals.length?'bad-text':''}">${highRiskDeals.length}</b></div><div><span>Có thể tiếp tục</span><b>${dealReady.length}</b></div></div><div class="exec-mini-note">Deal logic ưu tiên Hard Gate → RS → Risk/Protection → Capital → Readiness.</div>`,'Tóm tắt portfolio Deal.',navLink('Xem Deal','deals'))}
      </div>

      ${panel('Lộ trình sau Deal',`<div class="exec-op-roadmap">${opRoad}</div><div class="exec-mini-note"><b>${projects.length}</b> project sau Deal · <b>${opAttention.length}</b> project đang có HOLD / TEST THÊM / FAIL / STOP.</div>`,'P0 → Product Test → Monetization → Expansion → Scale.',navLink('Xem Operation','operations'))}

      ${panel('Cập nhật gần đây',(db.audit||[]).slice(0,8).map(a=>`<div class="exec-activity"><b>${esc(a.user)}</b><span>${esc(a.summary||a.action)}</span><small>${esc(a.at)}</small></div>`).join('')||'<div class="empty">Chưa có hoạt động gần đây.</div>','Lịch sử cập nhật dữ liệu quan trọng trên hệ thống.',navLink('Xem lịch sử','audit'))}
    </div>`;

    bindOpeners();
    document.querySelectorAll('[data-dash-nav]').forEach(b=>b.onclick=()=>{const v=b.dataset.dashNav;if(v&&v!=='dashboard'){currentView=v;location.hash=v;render();}});
  }

  function partnerPrimaryDeal(partnerId){
    const priority={'Đã ký':5,'Đang đàm phán':4,'Đánh giá pháp lý':3,'Đánh giá nội bộ':2,'Đang xác định phạm vi':1};
    return (db.deals||[]).filter(x=>x.partnerId===partnerId).map(dealInitialDefaults).sort((a,b)=>(priority[b.status]||0)-(priority[a.status]||0))[0]||null;
  }
  function dealCommercialSnapshot(input){
    if(!input)return null;
    const d=dealInitialDefaults(input),x=dealDerived(d);
    const finalSava=x.finalRs;
    const currentSava=ratio(d.savaShare),currentPartner=ratio(d.partnerShare),modelSava=x.modelRs;
    let sava=null,partner=null,rsSource='';
    if(finalSava!==null){sava=finalSava;partner=1-finalSava;rsSource='Kết quả cuối';}
    else if(currentSava!==null||currentPartner!==null){
      sava=currentSava!==null?currentSava:(currentPartner!==null?1-currentPartner:null);
      partner=currentPartner!==null?currentPartner:(currentSava!==null?1-currentSava:null);
      rsSource='Điều khoản hiện tại';
    }else if(modelSava!==null){sava=modelSava;partner=1-modelSava;rsSource='RS mô hình';}
    const uaBudget=dealNum(d.uaBudgetMonthly);
    return {deal:d,derived:x,sava,partner,rsSource,dealModel:d.dealModel||'',partnerInvestment:d.partnerInvestment||'',uaCommitment:uaBudget!==null?`${money(uaBudget)}/tháng`:(d.uaCommitment||''),uaCondition:d.uaCondition||''};
  }

  function renderPartners(){
    setHeader('Partner Selection','1 · Playbook lựa chọn đối tác');
    const rows=db.partners.filter(p=>includesSearch(p.id,profile(p,'Tên Partner / Studio'),profile(p,'Genre chính'),profile(p,'Trạng thái'))).map(p=>{
      const d=partnerDerived(p),rs=partnerRiskStats(p.id),prod=d.productionPotential;
      const riskText=rs.open.length?`${rs.open.length} đang mở${rs.high.length?` · ${rs.high.length} cao`:''}`:'Không có risk mở';
      const linkedDeal=partnerPrimaryDeal(p.id);
      const commercial=dealCommercialSnapshot(linkedDeal);
      const sava=commercial?.sava??profile(p,'Rev Share SAVA (%)'),partner=commercial?.partner??profile(p,'Rev Share Partner (%)');
      const shareText=(num(sava)!==null||num(partner)!==null)?`${num(sava)!==null?pct(sava,0):'—'} / ${num(partner)!==null?pct(partner,0):'—'}`:'—';
      const decisionDisplay=p.decision?.status||p.decision?.recommendation||d.final;
      const nextFull=p.decision?.nextAction||p.scorecard?.nextAction||'—';
      const next=clipText(nextFull,72);
      const uaCommit=commercial?.uaCommitment||profile(p,'Cam kết UA / Marketing Spend')||'—';
      const uaCondFull=commercial?.uaCondition||profile(p,'Điều kiện cam kết UA')||'—';
      const uaCond=clipText(uaCondFull,62);
      const model=commercial?.dealModel||profile(p,'Mô hình hợp tác tài chính')||'—';
      const fee=commercial?.partnerInvestment||profile(p,'Mức cam kết đầu tư cho Partner')||'—';
      const partnerName=profile(p,'Tên Partner / Studio')||p.id;
      return `<tr>
        <td class="partner-cell"><button class="linkish partner-name" data-open-partner="${p.id}">${esc(partnerName)}</button><div class="small muted">${esc(p.id)} · ${esc(profile(p,'Quốc gia')||'—')} · ${esc(profile(p,'Quy mô team')||'—')}</div><button class="row-delete" data-delete-partner="${p.id}" title="Xóa đối tác">Xóa</button></td>
        <td class="compact-text">${esc(profile(p,'Genre chính')||'—')}</td>
        <td>${badge(profile(p,'Trạng thái')||'—')}</td>
        <td>${scoreBar(prod.overall,{showLabel:true})}<div class="small muted maturity">${esc(prod.maturity)}</div></td>
        <td>${d.fit===null?scoreBar(d.fit,{showLabel:true}):`<button type="button" class="drilldown-trigger compact" data-open-partner-fit="${esc(p.id)}" title="Xem chi tiết cách tính Mức độ phù hợp">${scoreBar(d.fit,{showLabel:true})}<span class="drilldown-hint">Xem breakdown ↗</span></button>`}</td>
        <td class="commercial-cell" title="${esc(`${model} · ${fee}`)}"><b>${esc(model)}</b><div class="small muted ellipsis-2">${esc(fee)}</div></td>
        <td class="nowrap share-cell"><b>${esc(shareText)}</b>${linkedDeal?`<div class="small linked-source">Từ Deal Making${commercial?.rsSource?` · ${esc(commercial.rsSource)}`:''}</div>`:''}</td>
        <td class="ua-cell" title="${esc(`${uaCommit} · ${uaCondFull}`)}"><b>${esc(uaCommit)}</b>${linkedDeal?'<div class="small linked-source">Từ Deal Making</div>':''}<div class="small muted ellipsis-2">${esc(uaCond)}</div></td>
        <td>${badge(riskText)}</td>
        <td>${badge(decisionDisplay)}</td>
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

  function dealRsControlFor(value,x,{final=false}={}){
    const rs=ratio(value);
    if(rs===null)return final?'CHƯA CÓ RS CUỐI':(x?.rsControl||'KIỂM TRA RS');
    if(x?.rsFloor===null||x?.rsFloor===undefined)return 'CHƯA ĐỦ RULE RS';
    if(rs<x.rsFloor)return final?'KHÔNG ĐẠT — DƯỚI NGƯỠNG':'KHÔNG ĐẠT — RS < NGƯỠNG';
    if(x?.rsTarget!==null&&x?.rsTarget!==undefined&&rs<x.rsTarget)return final?'ĐẠT — DƯỚI MỤC TIÊU':'CẦN LƯU Ý — RS DƯỚI MỤC TIÊU';
    return 'ĐẠT';
  }
  function dealDisplayRs(d,x){
    const finalRs=x?.finalRs;
    if(finalRs!==null&&finalRs!==undefined)return {value:finalRs,label:'cuối',control:dealRsControlFor(finalRs,x,{final:true})};
    const sava=ratio(d?.savaShare),partner=ratio(d?.partnerShare);
    const current=sava!==null?sava:(partner!==null?1-partner:null);
    if(current!==null)return {value:current,label:'hiện tại',control:dealRsControlFor(current,x)};
    return {value:x?.modelRs??null,label:'mô hình',control:x?.rsControl||''};
  }
  function dealDisplayDecision(d,x){
    const approval=d?.approval||{};
    return approval.decision||x?.decision||'CHƯA ĐỦ DỮ LIỆU';
  }
  function dealDisplayNextAction(d,x){
    const approval=d?.approval||{};
    if(approval.decision&&approval.conditions)return approval.conditions;
    if(approval.decision&&approval.openRisks)return approval.openRisks;
    return x?.nextAction||'—';
  }

  function renderDeals(){
    setHeader('Deal Making','2 · Deal & Negotiation Playbook');
    const deals=(db.deals||[]).map(dealInitialDefaults).filter(d=>{const p=dealPartner(d);const der=dealDerived(d);return includesSearch(d.id,d.sourceDealId,d.partnerId,profile(p,'Tên Partner / Studio'),dealGameName(d),d.status,der.decision,der.direction)});
    const rows=deals.map(d=>{
      const p=dealPartner(d),x=dealDerived(d),rsDisplay=dealDisplayRs(d,x);
      const decisionDisplay=dealDisplayDecision(d,x),nextDisplay=dealDisplayNextAction(d,x);
      const rs=`<div class="deal-rs"><b>${x.rsFloor===null?'—':pct(x.rsFloor,0)}</b><span>ngưỡng</span><b>${rsDisplay.value===null?'—':pct(rsDisplay.value,0)}</b><span>${esc(rsDisplay.label)}</span><b>${x.rsTarget===null?'—':pct(x.rsTarget,0)}</b><span>mục tiêu</span></div>`;
      const capital=`<div class="compact-text"><b>${x.maxInvestment===null?'—':money(x.maxInvestment)}</b><div class="small muted">Cam kết đầu: ${x.initialCommit===null?'—':money(x.initialCommit)}</div></div>`;
      return `<tr><td><button class="linkish" data-open-deal="${esc(d.id)}">${esc(d.sourceDealId||d.id)}</button><div class="small muted">${esc(d.id)}</div></td><td><b>${esc(profile(p,'Tên Partner / Studio')||d.partnerId||'—')}</b><div class="small muted ellipsis-2" title="${esc(dealGameName(d))}">${esc(dealGameName(d))}</div></td><td>${badge(d.status||'—')}<div class="small muted" style="margin-top:4px">${esc(d.stage||'Chưa chọn giai đoạn')}</div></td><td>${readinessScoreBar(x.readiness)}</td><td>${x.riskScore===null?riskScoreBar(x.riskScore):`<button type="button" class="drilldown-trigger compact" data-open-deal-risk="${esc(d.id)}" title="Xem 6 nhóm tạo nên Deal Risk">${riskScoreBar(x.riskScore)}<span class="drilldown-hint">Xem risk ↗</span></button>`}</td><td><b>${esc(d.supportLevel||'—')}</b><div class="small muted">${esc(x.direction||'—')}</div></td><td>${rs}<div style="margin-top:5px">${badge(rsDisplay.control)}</div></td><td><b>${x.uaTier?esc(x.uaTier):'—'}</b><div class="small muted">${dealNum(d.uaBudgetMonthly)!==null?money(d.uaBudgetMonthly)+'/tháng':'—'}</div></td><td>${capital}</td><td>${badge(decisionDisplay)}</td><td><div class="deal-next ellipsis-2" title="${esc(nextDisplay)}">${esc(nextDisplay)}</div></td></tr>`;
    });
    const derived=deals.map(dealDerived);const active=deals.filter(d=>!['Tạm dừng','Đã đóng'].includes(d.status)).length;const negotiating=deals.filter(d=>d.status==='Đang đàm phán').length;const highRisk=derived.filter(x=>x.riskScore!==null&&x.riskScore>=50).length;const ready=deals.filter((d,i)=>/TIẾP TỤC/.test(String(dealDisplayDecision(d,derived[i])||'').toUpperCase())).length;
    const principles=`${dealRsPolicyHtml()}<div class="deal-principles"><div><b>1 · Hard Gate Partner</b><span>Hard Gate phải ĐẠT trước khi ký hoặc cam kết vốn.</span></div><div><b>2 · Game giai đoạn sớm</b><span>Bằng chứng Game ≤2: chỉ Pilot/Test; không MG lớn, không cam kết UA bảo đảm.</span></div><div><b>3 · Hỗ trợ / vốn đáng kể</b><span>RS phải phản ánh mức hỗ trợ; vốn chia theo giai đoạn và gắn KPI.</span></div><div><b>4 · Rủi ro cao</b><span>Mức chịu rủi ro ≥4 phải có Mức bảo vệ ≥4.</span></div><div><b>5 · Bảo vệ cốt lõi</b><span>Data/kế toán + IP/pháp lý rõ + quyền dừng là bắt buộc.</span></div><div><b>6 · Khả năng đầu tư</b><span>Yêu cầu vốn Partner không vượt Mức đầu tư tối đa, trừ khi được phê duyệt lại.</span></div><div><b>7 · Không nhượng bộ miễn phí</b><span>Nhượng RS/MG/UA phải đổi lại giá trị tương xứng.</span></div></div>`;
    const refRows=DEAL_MARKET_REFERENCES.map(r=>`<tr><td><b>${esc(r.publisher)}</b><div class="small muted">${esc(r.timing)}</div></td><td>${esc(r.stage||'—')}</td><td>${esc(r.type||'—')}</td><td>${r.mg?money(r.mg):'—'}</td><td>${esc(r.ua||'—')}</td><td>${esc(r.recoup||'—')}</td><td>${esc(r.ip||'—')}</td><td class="deal-ref-note">${esc(r.kpi||r.control||r.note||'—')}</td><td>${r.source?`<a class="linkish" href="${esc(r.source)}" target="_blank" rel="noopener">Nguồn</a>`:'—'}</td></tr>`);
    content.innerHTML=`<div class="grid kpis">${kpi('Deal đang theo dõi',active,`${deals.length} Deal trong cơ sở dữ liệu`)}${kpi('Đang đàm phán',negotiating)}${kpi('Rủi ro cao / rất cao',highRisk,'Rủi ro Deal ≥ 50/100')}${kpi('Có thể tiếp tục',ready,'Theo logic Deal hiện tại')}</div>
      ${panel('Danh sách Deal',table(['Deal','Partner / Game','Trạng thái / Giai đoạn','Sẵn sàng /100','Rủi ro /100','Hỗ trợ / Hướng Deal','RS: ngưỡng · hiện tại/cuối · mục tiêu','UA','Vốn tối đa / Cam kết đầu','Quyết định','Bước tiếp theo'],rows,'deal-master-table'),'Thứ tự quyết định: Hard Gate → Ngưỡng RS → Rủi ro/Bảo vệ → Khả năng đầu tư → Mức sẵn sàng.',`<div class="actions-inline"><button class="ghost" data-action="deal-rules">Logic & tham số</button><button class="primary" data-action="add-deal">+ Deal</button></div>`)}
      ${panel('Logic Deal SAVA',principles,'Revenue Share được hiển thị trực tiếp theo từng case; các nguyên tắc còn lại giữ đúng logic trong file nguồn.')}
      ${panel('Tham chiếu Deal Publisher',`<details class="deal-reference-details"><summary>Xem ${DEAL_MARKET_REFERENCES.length} case tham chiếu có bằng chứng</summary>${table(['Publisher','Giai đoạn','Loại Deal','MG','UA','Recoup','IP','KPI / Control','Nguồn'],refRows,'deal-reference-table')}</details>`,'Dữ liệu giữ nguyên tinh thần file nguồn: chỉ dùng evidence công khai; không suy diễn các điều khoản không được công bố.')}`;
    bindOpeners();
  }

  function marketClamp100(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;}
  function marketPositive(v){const n=num(v);return n!==null&&n>0?n:null;}
  function marketPctRank(value,values,{inverse=false}={}){
    const n=num(value),xs=(values||[]).map(num).filter(x=>x!==null).sort((a,b)=>a-b);if(n===null||!xs.length)return null;
    const below=xs.filter(x=>x<n).length,equal=xs.filter(x=>x===n).length;
    let rank=xs.length===1?50:((below+Math.max(0,equal-1)/2)/(xs.length-1))*100;
    rank=Math.max(0,Math.min(100,rank));return inverse?100-rank:rank;
  }
  function marketAvg(...vals){const xs=vals.flat().map(num).filter(x=>x!==null);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
  function marketMoneyCompact(v){const n=marketPositive(v);if(n===null)return '—';if(n>=1e9)return `$${fmt(n/1e9,1)}B`;if(n>=1e6)return `$${fmt(n/1e6,1)}M`;if(n>=1e3)return `$${fmt(n/1e3,0)}K`;return money(n);}
  function marketNumCompact(v){const n=marketPositive(v);if(n===null)return '—';if(n>=1e9)return `${fmt(n/1e9,1)}B`;if(n>=1e6)return `${fmt(n/1e6,1)}M`;if(n>=1e3)return `${fmt(n/1e3,0)}K`;return fmt(n,0);}
  function marketTrendLabel(dlGrowth,revGrowth,scaleScore=null){
    const dl=num(dlGrowth),rev=num(revGrowth);
    if(dl===null||rev===null)return {key:'na',label:'Chưa đủ dữ liệu',raw:null,detail:'Cần cả DL Growth 3M và Revenue Growth 3M'};
    const lowBase=num(scaleScore)!==null&&num(scaleScore)<25;
    const avg=(dl+rev)/2;
    if(dl>=.5&&rev>=.5){
      if(lowBase)return {key:'low-base',label:'Tăng mạnh từ nền thấp',raw:avg,detail:'DL và Revenue cùng tăng ≥50%, nhưng quy mô hiện tại thuộc nhóm thấp'};
      return {key:'breakout',label:'Bứt phá',raw:avg,detail:'DL và Revenue cùng tăng ≥50%'};
    }
    if(dl>=.1&&rev>=.1)return {key:'growth-good',label:'Tăng trưởng tốt',raw:avg,detail:'DL và Revenue cùng tăng ≥10%'};
    if(dl>=-.1&&dl<.1&&rev>=-.1&&rev<.1)return {key:'stable',label:'Ổn định',raw:avg,detail:'DL và Revenue đều dao động trong khoảng -10% đến +10%'};
    if(dl>.1&&rev>=-.1&&rev<=.1)return {key:'user-expand',label:'Mở rộng user',raw:avg,detail:'DL tăng >10%, Revenue gần như đi ngang'};
    if(dl>=-.1&&dl<=.1&&rev>.1)return {key:'rev-growth',label:'Tăng trưởng doanh thu',raw:avg,detail:'Revenue tăng >10%, DL gần như đi ngang'};
    if(dl>.1&&rev<-.1)return {key:'user-up-rev-down',label:'User ↑ / Revenue ↓',raw:avg,detail:'DL tăng nhưng Revenue giảm: cần kiểm tra chất lượng user và monetization'};
    if(dl<-.1&&rev>.1)return {key:'rev-up-user-down',label:'Revenue ↑ / User ↓',raw:avg,detail:'Revenue tăng dù DL giảm: monetization cải thiện nhưng quy mô user thu hẹp'};
    if(dl<-.1&&rev>=-.1&&rev<=.1)return {key:'user-decline',label:'User suy giảm',raw:avg,detail:'DL giảm >10% trong khi Revenue tương đối ổn định'};
    if(dl>=-.1&&dl<=.1&&rev<-.1)return {key:'rev-decline',label:'Doanh thu suy giảm',raw:avg,detail:'Revenue giảm >10% trong khi DL tương đối ổn định'};
    if(dl<=-.3&&rev<=-.3)return {key:'sharp-decline',label:'Suy giảm mạnh',raw:avg,detail:'DL và Revenue cùng giảm ≥30%'};
    if(dl<=-.1&&rev<=-.1)return {key:'decline',label:'Suy giảm',raw:avg,detail:'DL và Revenue cùng giảm ≥10%'};
    return {key:'mixed',label:'Tín hiệu trái chiều',raw:avg,detail:'DL và Revenue đang cho tín hiệu khác nhau'};
  }
  function marketBandLabel(score,kind='generic'){
    const n=num(score);if(n===null)return 'Chưa đủ dữ liệu';
    if(kind==='scale')return n>=80?'Rất lớn':n>=60?'Lớn':n>=40?'Trung bình':'Nhỏ';
    if(kind==='mon')return n>=80?'Rất tốt':n>=60?'Tốt':n>=40?'Trung bình':'Thấp';
    if(kind==='ua')return n>=80?'Rất thuận lợi':n>=60?'Thuận lợi':n>=40?'Trung bình':'Khó';
    return n>=80?'Rất tốt':n>=65?'Tốt':n>=50?'Trung bình':'Thấp';
  }
  function marketDirection(x){
    const score=(x.score===null||x.score===undefined||x.score==='')?null:Number(x.score);
    const strategic=(x.strategicFit===null||x.strategicFit===undefined||x.strategicFit==='')?null:Number(x.strategicFit);
    const execution=(x.executionFit===null||x.executionFit===undefined||x.executionFit==='')?null:Number(x.executionFit);
    const trend=x.trend?.key||'na';
    const mon=(x.monetization===null||x.monetization===undefined||x.monetization==='')?null:Number(x.monetization);
    const ua=(x.ua===null||x.ua===undefined||x.ua==='')?null:Number(x.ua);
    const dl=(x.dlg===null||x.dlg===undefined||x.dlg==='')?null:Number(x.dlg);
    const rev=(x.revg===null||x.revg===undefined||x.revg==='')?null:Number(x.revg);
    if(x.completeness<.34)return {key:'data',label:'Bổ sung dữ liệu',desc:'Chưa đủ dữ liệu thị trường để đưa ra định hướng đáng tin cậy.'};

    const declining=['decline','sharp-decline','rev-decline','user-decline'].includes(trend);
    const strongTrend=['breakout','growth-good'].includes(trend);
    const testTrend=['low-base','user-expand','rev-growth'].includes(trend);
    const splitTrend=['user-up-rev-down','rev-up-user-down'].includes(trend);
    const positiveTrend=strongTrend||testTrend;
    const oneGrowthMissing=(dl===null)!==(rev===null);
    const availableGrowth=dl===null?rev:rev===null?dl:null;
    const partialPositive=oneGrowthMissing&&availableGrowth!==null&&availableGrowth>=.10;
    const partialStrong=oneGrowthMissing&&availableGrowth!==null&&availableGrowth>=.50;
    const economicsGood=mon!==null&&mon>=60&&ua!==null&&ua>=60;

    // P3: market co lại nhưng vẫn monetize tốt. Không loại thẳng một market trưởng thành/niche.
    if(declining){
      if(mon!==null&&mon>=60)return {key:'selective',label:'P3 · Theo dõi chọn lọc',desc:'Xu hướng 3M đang suy giảm nhưng khả năng kiếm tiền vẫn ở mức Tốt/Rất tốt. Chỉ xem xét game/đối tác có chất lượng cao hoặc lợi thế rõ; không tìm kiếm đại trà.'};
      if(score!==null&&score>=60&&strategic!==null&&strategic>=85&&execution!==null&&execution>=80)return {key:'watch',label:'P4 · Theo dõi thêm',desc:'Market đang suy giảm nhưng nằm đúng trọng tâm và SAVA đã có năng lực thực thi; tiếp tục theo dõi trước khi phân bổ thêm nguồn lực.'};
      return {key:'low',label:'P5 · Chưa ưu tiên',desc:'Xu hướng đang suy giảm và khả năng kiếm tiền chưa đủ mạnh; chưa nên dành nhiều nguồn lực.'};
    }

    // P1: mức ưu tiên cao nhất. Market tốt + trend khỏe + đúng trọng tâm chiến lược.
    // Execution Fit là bằng chứng bổ sung, không bắt buộc để SAVA chủ động tìm opportunity mới.
    if(score!==null&&score>=75&&strategic!==null&&strategic>=70&&strongTrend){
      return {key:'priority',label:'P1 · Ưu tiên chủ động',desc:'Market hấp dẫn, xu hướng tăng khỏe và nằm trong hướng chiến lược SAVA. Chủ động tìm game/đối tác và fast-track opportunity phù hợp vào đánh giá/kiểm thử.'};
    }

    // P2-A: market đủ tốt để kiểm chứng, miễn không nằm rõ ngoài trọng tâm.
    if(score!==null&&score>=70&&(positiveTrend||(trend==='stable'&&mon!==null&&mon>=75)||(splitTrend&&mon!==null&&mon>=65))&&(strategic===null||strategic>=60)){
      return {key:'test',label:'P2 · Ưu tiên kiểm chứng',desc:'Market đủ hấp dẫn để ưu tiên kiểm chứng bằng game/test thực tế, nhưng chưa đủ điều kiện P1.'};
    }
    // P2-B: lợi thế chiến lược mạnh giúp tránh cliff effect 69.x/70 khi trend tích cực.
    if(score!==null&&score>=65&&strategic!==null&&strategic>=85&&positiveTrend){
      return {key:'test',label:'P2 · Ưu tiên kiểm chứng',desc:'Market chưa vượt ngưỡng 70 nhưng nằm đúng trọng tâm chiến lược và có trend tích cực; ưu tiên kiểm chứng thay vì hạ xuống P4.'};
    }
    // P2-C: SAVA đã chứng minh năng lực rất mạnh ở mechanic này thì có thể nâng một bậc để kiểm chứng tiếp.
    if(score!==null&&score>=60&&strategic!==null&&strategic>=85&&execution!==null&&execution>=85&&(positiveTrend||strongTrend||partialPositive)){
      return {key:'test',label:'P2 · Ưu tiên kiểm chứng',desc:'Market chưa đủ mạnh cho P1 nhưng SAVA vừa đúng trọng tâm vừa có năng lực thực thi đã chứng minh; nên ưu tiên kiểm chứng opportunity tốt.'};
    }
    // P2-D: case như Tycoon — một growth metric còn thiếu nhưng tín hiệu hiện có mạnh, economics tốt và đúng trọng tâm.
    if(score!==null&&score>=60&&strategic!==null&&strategic>=85&&partialStrong&&economicsGood){
      return {key:'test',label:'P2 · Ưu tiên kiểm chứng',desc:'Một chỉ số Growth 3M còn thiếu, nhưng tín hiệu tăng trưởng hiện có mạnh, economics tốt và market đúng trọng tâm. Ưu tiên test để hoàn thiện bằng chứng trước khi nâng P1.'};
    }

    if(score!==null&&score>=45&&(positiveTrend||partialPositive||splitTrend)){
      return {key:'watch',label:'P4 · Theo dõi thêm',desc:'Có tín hiệu tích cực nhưng sức hấp dẫn/evidence chưa đủ để ưu tiên kiểm chứng; tiếp tục cập nhật dữ liệu.'};
    }
    if(score!==null&&score>=55){
      return {key:'watch',label:'P4 · Theo dõi thêm',desc:'Có cơ hội nhưng tín hiệu chưa đủ mạnh hoặc chưa đồng thuận để ưu tiên ngay.'};
    }
    return {key:'low',label:'P5 · Chưa ưu tiên',desc:'Tăng trưởng, khả năng kiếm tiền hoặc mức phù hợp hiện chưa đủ hấp dẫn.'};
  }
  function marketAnalytics(mechanics){
    const list=(mechanics||[]);
    const dlVals=list.map(m=>marketPositive(m.Downloads_30d)).filter(x=>x!==null),revVals=list.map(m=>marketPositive(m.Revenue_30d_USD)).filter(x=>x!==null);
    const dlgVals=list.filter(m=>marketPositive(m.Downloads_30d)!==null).map(m=>num(m.DL_Growth_3m)).filter(x=>x!==null),revgVals=list.filter(m=>marketPositive(m.Revenue_30d_USD)!==null).map(m=>num(m.Rev_Growth_3m)).filter(x=>x!==null);
    const rpdVals=list.map(m=>marketPositive(m.Revenue_per_Download_SAME_COHORT)).filter(x=>x!==null),cpiVals=list.map(m=>marketPositive(m.UA_Benchmark?.CPI_Median)).filter(x=>x!==null);
    return list.map(m=>{
      const dl=marketPositive(m.Downloads_30d),rev=marketPositive(m.Revenue_30d_USD),dlg=dl!==null?num(m.DL_Growth_3m):null,revg=rev!==null?num(m.Rev_Growth_3m):null,rpd=marketPositive(m.Revenue_per_Download_SAME_COHORT),cpi=marketPositive(m.UA_Benchmark?.CPI_Median);
      const scale=marketAvg(marketPctRank(dl,dlVals),marketPctRank(rev,revVals));
      const dlMomentum=marketPctRank(dlg,dlgVals),revMomentum=marketPctRank(revg,revgVals);
      const growth=(dlMomentum!==null&&revMomentum!==null)?(dlMomentum+revMomentum)/2:null;
      const monetization=marketPctRank(rpd,rpdVals);
      const ua=marketPctRank(cpi,cpiVals,{inverse:true});
      const strategicFitInfo=mechanicStrategicFit(m),strategicFit=strategicFitInfo.score;
      const executionFitInfo=mechanicExecutionFit(m.Mechanic),executionFit=executionFitInfo.score;
      // Market Attractiveness is MARKET-ONLY. Internal SAVA fit does not change whether the market itself is attractive.
      // Missing market metrics are excluded and the remaining market weights are re-normalized.
      const parts=[['scale',scale,30],['growth',growth,25],['monetization',monetization,20],['ua',ua,15]].filter(([,v])=>v!==null);
      const observed=[dl,rev,dlg,revg,rpd,cpi].filter(x=>x!==null).length,completeness=observed/6,trend=marketTrendLabel(dlg,revg,scale);
      const weight=parts.reduce((a,x)=>a+x[2],0);const score=weight&&observed>=2?Math.round(parts.reduce((a,x)=>a+x[1]*x[2],0)/weight*10)/10:null;
      const out={m,dl,rev,dlg,revg,rpd,cpi,scale,growth,monetization,ua,strategicFit,strategicFitInfo,executionFit,executionFitInfo,score,completeness,trend};out.direction=marketDirection(out);return out;
    });
  }
  function marketScoreBar(value){const n=num(value),w=n===null?0:Math.max(0,Math.min(100,n));const cls=n===null?'na':n>=80?'priority':n>=70?'pass':n>=55?'conditional':'review';return `<div class="market-score ${cls}" title="${n===null?'Chưa đủ dữ liệu':`${fmt(n,1)}/100`}"><strong>${n===null?'—':fmt(n,1)}</strong><span><i style="width:${w}%"></i></span></div>`;}
  function marketDirectionBadge(x){return `<span class="market-direction ${x.direction.key}" title="${esc(x.direction.desc||'')}">${esc(x.direction.label)}</span>`;}
  function marketDirectionRulesHtml(){
    return `<div class="market-priority-rules">
      <div class="market-priority-rule-head"><div><span class="eyebrow-mini">QUY TẮC ĐỊNH HƯỚNG</span><h3>P1 → P5 = mức độ ưu tiên giảm dần</h3></div><p><b>Sức hấp dẫn</b> là market-only. <b>Phù hợp chiến lược</b> lấy từ Sourcing. <b>Năng lực thực thi</b> lấy từ Game Selection. Ba lớp dữ liệu được dùng chung nhưng không trộn thành một điểm.</p></div>
      <div class="market-priority-rule-grid">
        <div class="market-priority-rule p1"><b>P1 · Ưu tiên chủ động</b><span>Sức hấp dẫn ≥75 + Xu hướng <strong>Bứt phá/Tăng trưởng tốt</strong> + Phù hợp chiến lược ≥70.</span><small>Chủ động tìm game/đối tác và fast-track opportunity phù hợp vào đánh giá/kiểm thử.</small></div>
        <div class="market-priority-rule p2"><b>P2 · Ưu tiên kiểm chứng</b><span>Market ≥70 + trend tích cực; <b>hoặc</b> Market ≥65 + Fit chiến lược ≥85 + trend tích cực; <b>hoặc</b> Market ≥60 + Fit chiến lược cao + bằng chứng/economics đủ mạnh.</span><small>Dùng test thực tế để hoàn thiện Product/Marketing Fit trước khi nâng P1. Case thiếu một Growth metric vẫn có thể P2 nếu tín hiệu còn lại rất mạnh và economics tốt.</small></div>
        <div class="market-priority-rule p3"><b>P3 · Theo dõi chọn lọc</b><span>Xu hướng suy giảm nhưng Khả năng kiếm tiền ≥60/100.</span><small>Không tìm đại trà; chỉ xem xét opportunity có chất lượng/lợi thế rõ.</small></div>
        <div class="market-priority-rule p4"><b>P4 · Theo dõi thêm</b><span>Market có tín hiệu nhưng chưa đủ mạnh/evidence chưa đủ để ưu tiên kiểm chứng.</span><small>Tiếp tục cập nhật market data và bằng chứng thực thi.</small></div>
        <div class="market-priority-rule p5"><b>P5 · Chưa ưu tiên</b><span>Tín hiệu tổng thể yếu, hoặc market suy giảm và khả năng kiếm tiền thấp.</span><small>Chưa nên dành nhiều nguồn lực ở thời điểm hiện tại.</small></div>
      </div>
    </div>`;
  }
  function marketTopBars(items){
    const top=[...items].filter(x=>x.score!==null&&x.completeness>=.34).sort((a,b)=>b.score-a.score).slice(0,8);if(!top.length)return '<div class="empty">Chưa đủ dữ liệu để xếp hạng.</div>';
    return `<div class="market-bars">${top.map((x,i)=>`<button class="market-bar-row" data-open-market="${esc(x.m.Mechanic_ID)}"><span class="market-rank">${i+1}</span><span class="market-bar-name">${esc(x.m.Mechanic)}</span><span class="market-bar-track"><i style="width:${Math.max(0,Math.min(100,x.score))}%"></i></span><b>${fmt(x.score,1)}</b></button>`).join('')}</div>`;
  }
  function marketScatter(items){
    const pts=items.filter(x=>x.growth!==null&&x.monetization!==null).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,18);if(!pts.length)return '<div class="empty">Chưa đủ dữ liệu Đà tăng trưởng + Khả năng kiếm tiền để vẽ biểu đồ.</div>';
    const W=640,H=300,L=54,R=18,T=22,B=42,iw=W-L-R,ih=H-T-B;const sx=v=>L+(Math.max(0,Math.min(100,v))/100)*iw,sy=v=>T+ih-(Math.max(0,Math.min(100,v))/100)*ih;
    const grid=[0,25,50,75,100].map(v=>`<line x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${T+ih}" class="market-grid-line"/><text x="${sx(v)}" y="${H-18}" class="market-axis-text" text-anchor="middle">${v}</text><line x1="${L}" y1="${sy(v)}" x2="${L+iw}" y2="${sy(v)}" class="market-grid-line"/><text x="${L-10}" y="${sy(v)+3}" class="market-axis-text" text-anchor="end">${v}</text>`).join('');
    const dots=pts.map((x,i)=>{const r=5+((x.scale??50)/100)*7;const key=x.direction.key;const show=i<9;const label=String(x.m.Mechanic||'').replace(/\s*\/.*$/,'').slice(0,18);return `<g class="market-dot ${key}"><circle cx="${sx(x.growth)}" cy="${sy(x.monetization)}" r="${r}"><title>${esc(x.m.Mechanic)} · Đà tăng trưởng ${fmt(x.growth,0)}/100 · Khả năng kiếm tiền ${fmt(x.monetization,0)}/100 · Sức hấp dẫn ${x.score===null?'—':fmt(x.score,1)}/100</title></circle>${show?`<text x="${sx(x.growth)+r+4}" y="${sy(x.monetization)+3}" class="market-dot-label">${esc(label)}</text>`:''}</g>`}).join('');
    return `<div class="market-scatter-wrap"><svg class="market-scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ Đà tăng trưởng và Khả năng kiếm tiền">${grid}<line x1="${sx(50)}" y1="${T}" x2="${sx(50)}" y2="${T+ih}" class="market-mid-line"/><line x1="${L}" y1="${sy(50)}" x2="${L+iw}" y2="${sy(50)}" class="market-mid-line"/>${dots}<text x="${L+iw/2}" y="${H-2}" class="market-axis-title" text-anchor="middle">Đà tăng trưởng /100 →</text><text x="15" y="${T+ih/2}" class="market-axis-title" text-anchor="middle" transform="rotate(-90 15 ${T+ih/2})">Khả năng kiếm tiền /100 ↑</text></svg></div>`;
  }
  function marketOpportunityMap(items){
    const sorted=[...items].sort((a,b)=>(b.score??-1)-(a.score??-1));
    const priority=sorted.filter(x=>x.direction.key==='priority');
    const test=sorted.filter(x=>x.direction.key==='test');
    const selective=sorted.filter(x=>x.direction.key==='selective');
    const watch=sorted.filter(x=>x.direction.key==='watch');
    const low=sorted.filter(x=>x.direction.key==='low');
    const data=sorted.filter(x=>x.direction.key==='data');
    const groups=[
      {title:'P1 · Ưu tiên chủ động',key:'priority',items:priority},
      {title:'P2 · Ưu tiên kiểm chứng',key:'new',items:test},
      {title:'P3 · Theo dõi chọn lọc',key:'selective',items:selective},
      {title:'P4 · Theo dõi thêm',key:'watch',items:watch},
      {title:'P5 · Chưa ưu tiên',key:'low',items:low}
    ];
    return `<div class="market-opportunity-map">${groups.map(g=>`<div class="market-opp-card ${g.key}"><div class="market-opp-head"><b>${g.title}</b><span>${g.items.length}</span></div>${g.items.length?g.items.slice(0,5).map(x=>`<button data-open-market="${esc(x.m.Mechanic_ID)}"><strong>${esc(x.m.Mechanic)}</strong><small>${x.score===null?'—':fmt(x.score,1)}/100 · Xu hướng 3M: ${esc(x.trend.label)}</small></button>`).join(''):'<div class="market-opp-empty">Chưa có mechanic phù hợp</div>'}</div>`).join('')}</div>${data.length?`<div class="market-unranked-note"><b>${data.length} mechanic chưa xếp P1–P5</b> vì dữ liệu benchmark chưa đủ. Hoàn thiện dữ liệu trước khi dùng cho quyết định.</div>`:''}`;
  }


  function renderMarket(){
    setHeader('Market Intelligence','3 · Định hướng thị trường + Publisher Landscape');
    const mechanics=(db.market||[]).filter(m=>includesSearch(m.Mechanic_ID,m.Mechanic,m.Geography,m.Platform));
    const insights=marketAnalytics(mechanics),ranked=[...insights].sort((a,b)=>(b.score??-1)-(a.score??-1));
    const priority=insights.filter(x=>x.direction.key==='priority').length;
    const strongGrowth=insights.filter(x=>['breakout','growth-good','low-base'].includes(x.trend.key)).length;
    const strongMon=insights.filter(x=>x.monetization!==null&&x.monetization>=75).length;
    const uaReady=insights.filter(x=>x.ua!==null&&x.ua>=65).length;
    const execRows=ranked.map(x=>{const m=x.m;const scaleLabel=marketBandLabel(x.scale,'scale'),monLabel=marketBandLabel(x.monetization,'mon'),uaLabel=marketBandLabel(x.ua,'ua');const scaleDetail=`DL ${marketNumCompact(x.dl)} · Rev ${marketMoneyCompact(x.rev)}`;const growthDetail=[x.dlg!==null?`DL ${pct(x.dlg,1)}`:null,x.revg!==null?`Rev ${pct(x.revg,1)}`:null].filter(Boolean).join(' · ')||'—';return `<tr><td><button class="linkish" data-open-market="${esc(m.Mechanic_ID)}">${esc(m.Mechanic)}</button><div class="small muted">${esc(m.Geography||'—')} · ${esc(m.Platform||'—')}</div></td><td>${x.score===null?marketScoreBar(x.score):`<button type="button" class="drilldown-trigger compact" data-open-market-score="${esc(m.Mechanic_ID)}" title="Xem cách tính Sức hấp dẫn thị trường">${marketScoreBar(x.score)}<span class="drilldown-hint">Cách tính ↗</span></button>`}</td><td><b>${esc(scaleLabel)}</b><div class="small muted">${esc(scaleDetail)}</div></td><td><span class="market-trend ${x.trend.key}" title="${esc(x.trend.detail||'')}">${esc(x.trend.label)}</span><div class="small muted">${esc(growthDetail)}</div></td><td><b>${esc(monLabel)}</b><div class="small muted">RPD ${x.rpd===null?'—':'$'+fmt(x.rpd,2)}</div></td><td><b>${x.cpi===null?'—':'$'+fmt(x.cpi,2)}</b><div class="small muted">${esc(uaLabel)}</div></td><td>${x.strategicFit===null?'<span class="muted">N/A</span>':marketScoreBar(x.strategicFit)+`<div class="small linked-source">${esc(x.strategicFitInfo?.group||'')}</div>`}</td><td>${x.executionFit===null?'<span class="muted">Chưa có evidence</span>':`<button type="button" class="market-execution-trigger" data-open-execution-fit="${esc(m.Mechanic_ID)}" title="Click để xem Game/Candidate tạo nên điểm Năng lực thực thi">${marketScoreBar(x.executionFit)}<div class="small linked-source">${x.executionFitInfo?.count||0} Game/Candidate</div><span class="market-drilldown-hint">Xem candidate →</span></button>`}</td><td><button type="button" class="drilldown-trigger priority-trigger" data-open-market-priority="${esc(m.Mechanic_ID)}" title="Xem vì sao mechanic được xếp ${esc(x.direction.label)}">${marketDirectionBadge(x)}<span class="drilldown-hint">Vì sao? ↗</span></button></td></tr>`;});
    const rawRows=mechanics.map(m=>`<tr><td>${esc(m.Mechanic_ID)}</td><td><button class="linkish" data-open-market="${esc(m.Mechanic_ID)}">${esc(m.Mechanic)}</button></td><td>${esc(m.Geography||'—')}</td><td>${fmt(m.Downloads_30d,0)}</td><td>${money(m.Revenue_30d_USD)}</td><td>${m.DL_Growth_3m!==null&&m.DL_Growth_3m!==undefined?pct(m.DL_Growth_3m,1):'—'}</td><td>${m.Rev_Growth_3m!==null&&m.Rev_Growth_3m!==undefined?pct(m.Rev_Growth_3m,1):'—'}</td><td>${m.Revenue_per_Download_SAME_COHORT!==null&&m.Revenue_per_Download_SAME_COHORT!==undefined?'$'+fmt(m.Revenue_per_Download_SAME_COHORT,2):'—'}</td><td>${m.UA_Benchmark?.CPI_Median!==null&&m.UA_Benchmark?.CPI_Median!==undefined?'$'+fmt(m.UA_Benchmark.CPI_Median,2):'—'}</td></tr>`);
    const pubs=(db.publisherLandscape||[]).filter(x=>includesSearch(x.name,x.genres,x.testApproach,x.dealApproach)).map(x=>`<tr><td><button class="linkish" data-open-publisher="${x.id}">${esc(x.name)}</button></td><td>${esc(x.genres||'—')}</td><td>${esc(x.lookingFor||'—')}</td><td>${esc(x.testApproach||'—')}</td><td>${esc(x.investmentApproach||'—')}</td><td>${esc(x.dealApproach||'—')}</td><td>${esc(x.operationModel||'—')}</td></tr>`);
    const top=ranked.find(x=>x.score!==null),topGrowth=[...insights].filter(x=>x.growth!==null).sort((a,b)=>(b.growth??-1)-(a.growth??-1))[0];
    const executiveNote=`<div class="market-exec-note"><b>Đọc nhanh cho quyết định:</b> ${top?`Cơ hội tổng hợp cao nhất hiện tại là <strong>${esc(top.m.Mechanic)}</strong> (${fmt(top.score,1)}/100).`: 'Chưa đủ dữ liệu để xếp hạng.'} ${topGrowth?`Đà tăng trưởng tương đối nổi bật: <strong>${esc(topGrowth.m.Mechanic)}</strong> (${fmt(topGrowth.growth,0)}/100 · ${esc(topGrowth.trend.label)}).`:''}<span><b>Đà tăng trưởng /100</b> = xếp hạng tương đối của DL Growth 3M và Revenue Growth 3M theo tỷ trọng 50/50. <b>Khả năng kiếm tiền /100</b> = xếp hạng RPD so với các mechanic khác. 100 = thuộc nhóm tốt nhất trong tập dữ liệu, không phải % tăng trưởng thực tế.</span></div>`;
    const formula=`<div class="market-formula"><span><b>30%</b> Quy mô</span><span><b>25%</b> Đà tăng trưởng</span><span><b>20%</b> Khả năng kiếm tiền</span><span><b>15%</b> UA</span><small><b>Sức hấp dẫn /100 là market-only:</b> 4 nhóm trên được tự chuẩn hóa theo tổng trọng số 90; không cộng Fit nội bộ SAVA. <b>Đà tăng trưởng /100:</b> 50% xếp hạng DL Growth 3M + 50% xếp hạng Revenue Growth 3M. Nếu thiếu một Growth metric, phần Growth không đi vào Market Score; rule Định hướng vẫn có thể dùng tín hiệu còn lại như evidence chưa hoàn chỉnh.</small></div>`;
    content.innerHTML=`<div class="grid kpis market-kpis">${kpi('P1 · Ưu tiên chủ động',priority,'Mức ưu tiên cao nhất: market tốt + trend khỏe + đúng hướng chiến lược SAVA')}${kpi('Tăng trưởng đồng thuận',strongGrowth,'DL & Revenue 3M cùng tăng ≥ 10%')}${kpi('Khả năng kiếm tiền nổi bật',strongMon,'Top quartile theo RPD')}${kpi('UA thuận lợi',uaReady,'CPI tương đối thuận lợi trong tập dữ liệu')}</div>
      ${executiveNote}
      <div class="market-chart-grid"><section class="market-chart-card"><div class="market-chart-head"><div><span class="eyebrow-mini">XẾP HẠNG</span><h3>Top Sức hấp dẫn thị trường /100</h3></div></div>${marketTopBars(insights)}</section><section class="market-chart-card"><div class="market-chart-head"><div><span class="eyebrow-mini">BẢN ĐỒ CƠ HỘI</span><h3>Đà tăng trưởng × Khả năng kiếm tiền</h3></div><small>Kích thước điểm ≈ quy mô tương đối · 100 = nhóm tốt nhất trong dataset</small></div>${marketScatter(insights)}<div class="market-chart-guide"><span><b>Trên phải:</b> tăng nhanh + kiếm tiền tốt</span><span><b>Trên trái:</b> kiếm tiền tốt, tăng chậm</span><span><b>Dưới phải:</b> tăng nhanh, kiếm tiền yếu</span><span><b>Dưới trái:</b> ưu tiên thấp</span></div></section></div>
      ${panel('Định hướng thị trường',formula+table(['Thị trường / Mechanic','Sức hấp dẫn /100','Quy mô','Xu hướng 3M','Khả năng kiếm tiền','CPI','Phù hợp chiến lược /100','Năng lực thực thi /100','Định hướng'],execRows,'market-exec-table'),'Bảng dành cho quyết định: Market Score chỉ phản ánh thị trường; Phù hợp chiến lược lấy từ Sourcing; Năng lực thực thi lấy từ Game Selection.')}
      ${panel('Bản đồ cơ hội SAVA',marketDirectionRulesHtml()+marketOpportunityMap(insights),'P1 → P5 được sắp từ mức độ ưu tiên cao xuống thấp. Rule hiển thị ngay trên bản đồ để người xem hiểu vì sao mechanic được xếp vào từng nhóm.')}
      ${panel('Publisher Landscape',pubs.length?table(['Publisher','Thể loại trọng tâm','Đang tìm gì','Cách test','Cách đầu tư','Cách deal','Cách vận hành'],pubs):'<div class="empty"><b>Chưa có dữ liệu Publisher Landscape riêng trong các file nguồn hiện tại.</b><br/>Team có thể bổ sung benchmark tại đây mà không trộn giả định vào dữ liệu thị trường gốc.</div>','Theo dõi publisher đang tìm game gì, cách họ test, đầu tư, deal và vận hành.',`<button class="primary" data-action="add-publisher">+ Publisher benchmark</button>`)}
      ${panel('Dữ liệu chi tiết',`<details class="market-raw-details"><summary>Xem bảng Market Economics + UA Benchmark (${mechanics.length} mechanics)</summary>${table(['ID','Mechanic','Geo','DL 30D','Revenue 30D','DL Growth 3M','Rev Growth 3M','RPD','CPI Median'],rawRows,'market-raw-table')}</details>`,'Dữ liệu gốc từ Market Economics + UA Benchmark; các tổng lịch sử có thể bị giới hạn coverage đúng như ghi chú trong workbook nguồn.')}`;
    bindOpeners();
  }

  function drilldownMetricRow(label,value,{weight=null,contribution=null,detail='',status='',tone='blue'}={}){
    const n=num(value),width=n===null?0:Math.max(0,Math.min(100,n));
    return `<div class="drill-metric-row ${tone}"><div class="drill-metric-copy"><b>${esc(label)}</b>${detail?`<small>${esc(detail)}</small>`:''}</div><div class="drill-metric-score"><strong>${n===null?'—':fmt(n,1)}</strong><span>/100</span>${weight!==null?`<em>${fmt(weight,1)}% trọng số</em>`:''}${contribution!==null?`<i>+${fmt(contribution,1)} điểm</i>`:''}</div><div class="drill-metric-bar"><span style="width:${width}%"></span></div>${status?`<div class="drill-metric-status">${status}</div>`:''}</div>`;
  }
  function closeDrilldown(){modalRoot.innerHTML='';}
  function marketInsightById(id){return marketAnalytics(db.market||[]).find(x=>x.m.Mechanic_ID===id)||null;}
  function openMarketScoreDrilldown(id){
    const x=marketInsightById(id);if(!x)return;
    const parts=[
      {label:'Quy mô thị trường',score:x.scale,weight:30,detail:`DL 30D ${marketNumCompact(x.dl)} · Revenue 30D ${marketMoneyCompact(x.rev)}`},
      {label:'Đà tăng trưởng',score:x.growth,weight:25,detail:`DL Growth ${x.dlg===null?'—':pct(x.dlg,1)} · Revenue Growth ${x.revg===null?'—':pct(x.revg,1)}`},
      {label:'Khả năng kiếm tiền',score:x.monetization,weight:20,detail:`RPD ${x.rpd===null?'—':'$'+fmt(x.rpd,2)} · xếp hạng tương đối trong dataset`},
      {label:'Hiệu quả UA',score:x.ua,weight:15,detail:`CPI median ${x.cpi===null?'—':'$'+fmt(x.cpi,2)} · CPI thấp được xếp hạng tốt hơn`}
    ];
    const active=parts.filter(p=>p.score!==null),totalWeight=active.reduce((a,b)=>a+b.weight,0);
    const rows=parts.map(p=>{const eff=p.score===null||!totalWeight?null:p.weight/totalWeight*100;const contribution=p.score===null||!totalWeight?null:p.score*p.weight/totalWeight;return drilldownMetricRow(p.label,p.score,{weight:eff,contribution,detail:p.detail,status:p.score===null?'Thiếu dữ liệu · không đưa vào Market Score':''});}).join('');
    const missing=parts.filter(p=>p.score===null).map(p=>p.label);
    modalRoot.innerHTML=`<div class="modal-backdrop drilldown-backdrop"><div class="modal wide drilldown-modal"><div class="modal-head"><div><span class="eyebrow-mini">MARKET INTELLIGENCE · SCORE BREAKDOWN</span><h2>${esc(x.m.Mechanic)}</h2><p>Sức hấp dẫn thị trường được tính từ dữ liệu market, không cộng Fit nội bộ SAVA.</p></div><button class="icon-btn" data-close>×</button></div><div class="modal-body"><div class="drill-hero"><div><span>Sức hấp dẫn thị trường</span><strong>${x.score===null?'—':fmt(x.score,1)}</strong><em>/100</em></div><div>${badge(x.trend.label)}${marketDirectionBadge(x)}</div></div><div class="drill-grid-main"><section><div class="drill-section-head"><h3>Breakdown điểm</h3><small>Trọng số còn lại được tự chuẩn hóa khi metric bị thiếu.</small></div><div class="drill-metric-list">${rows}</div>${missing.length?`<div class="drill-warning"><b>Thiếu dữ liệu:</b> ${esc(missing.join(', '))}. Hệ thống không tự quy về 0.</div>`:''}</section><aside><div class="drill-source-card"><h3>Dữ liệu gốc</h3><div class="drill-source-grid"><div><span>Downloads 30D</span><b>${marketNumCompact(x.dl)}</b></div><div><span>Revenue 30D</span><b>${marketMoneyCompact(x.rev)}</b></div><div><span>DL Growth 3M</span><b>${x.dlg===null?'—':pct(x.dlg,1)}</b></div><div><span>Revenue Growth 3M</span><b>${x.revg===null?'—':pct(x.revg,1)}</b></div><div><span>RPD</span><b>${x.rpd===null?'—':'$'+fmt(x.rpd,2)}</b></div><div><span>CPI median</span><b>${x.cpi===null?'—':'$'+fmt(x.cpi,2)}</b></div><div><span>Data completeness</span><b>${pct(x.completeness,0)}</b></div><div><span>Geo / Platform</span><b>${esc(`${x.m.Geography||'—'} · ${x.m.Platform||'—'}`)}</b></div></div></div><div class="drill-source-card"><h3>Rule tính</h3><p><b>30%</b> Quy mô · <b>25%</b> Đà tăng trưởng · <b>20%</b> Khả năng kiếm tiền · <b>15%</b> UA. Đây là rank tương đối trong dataset hiện tại, không phải % tăng trưởng thực tế.</p></div></aside></div></div><div class="modal-foot"><button class="ghost" data-close>Đóng</button><button class="ghost" data-drill-priority>Xem vì sao xếp ${esc(x.direction.label)} →</button><button class="primary" data-drill-edit>Mở Market để sửa dữ liệu</button></div></div></div>`;
    modalRoot.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDrilldown);
    modalRoot.querySelector('[data-drill-edit]').onclick=()=>{closeDrilldown();openMarket(id);};
    modalRoot.querySelector('[data-drill-priority]').onclick=()=>openMarketPriorityDrilldown(id);
  }
  function marketPriorityRuleMatch(x){
    const score=num(x.score),strategic=num(x.strategicFit),execution=num(x.executionFit),trend=x.trend?.key||'na',mon=num(x.monetization),ua=num(x.ua),dl=num(x.dlg),rev=num(x.revg);
    const declining=['decline','sharp-decline','rev-decline','user-decline'].includes(trend),strongTrend=['breakout','growth-good'].includes(trend),testTrend=['low-base','user-expand','rev-growth'].includes(trend),splitTrend=['user-up-rev-down','rev-up-user-down'].includes(trend),positiveTrend=strongTrend||testTrend;
    const oneGrowthMissing=(dl===null)!==(rev===null),availableGrowth=dl===null?rev:rev===null?dl:null,partialPositive=oneGrowthMissing&&availableGrowth!==null&&availableGrowth>=.10,partialStrong=oneGrowthMissing&&availableGrowth!==null&&availableGrowth>=.50,economicsGood=mon!==null&&mon>=60&&ua!==null&&ua>=60;
    const checks=[];const add=(label,actual,ok)=>checks.push({label,actual,ok});
    if(x.completeness<.34){add('Data completeness ≥34%',pct(x.completeness,0),false);return {rule:'Bổ sung dữ liệu trước khi xếp P1–P5',checks};}
    if(declining){add('Xu hướng đang suy giảm',x.trend.label,true);add('Khả năng kiếm tiền ≥60',mon===null?'—':fmt(mon,1),mon!==null&&mon>=60);return {rule:mon!==null&&mon>=60?'P3 · Market suy giảm nhưng monetization còn tốt':score!==null&&score>=60&&strategic!==null&&strategic>=85&&execution!==null&&execution>=80?'P4 · Market suy giảm nhưng SAVA vẫn có strategic/execution fit':'P5 · Market suy giảm và economics chưa đủ mạnh',checks};}
    if(score!==null&&score>=75&&strategic!==null&&strategic>=70&&strongTrend){add('Market Score ≥75',fmt(score,1),true);add('Phù hợp chiến lược ≥70',fmt(strategic,1),true);add('Trend Bứt phá/Tăng trưởng tốt',x.trend.label,true);return {rule:'P1 · Ưu tiên chủ động',checks};}
    if(score!==null&&score>=70&&(positiveTrend||(trend==='stable'&&mon!==null&&mon>=75)||(splitTrend&&mon!==null&&mon>=65))&&(strategic===null||strategic>=60)){add('Market Score ≥70',fmt(score,1),true);add('Trend/economics đủ để kiểm chứng',x.trend.label,true);add('Strategic Fit không dưới 60',strategic===null?'N/A':fmt(strategic,1),strategic===null||strategic>=60);return {rule:'P2-A · Market đủ tốt để kiểm chứng',checks};}
    if(score!==null&&score>=65&&strategic!==null&&strategic>=85&&positiveTrend){add('Market Score ≥65',fmt(score,1),true);add('Strategic Fit ≥85',fmt(strategic,1),true);add('Trend tích cực',x.trend.label,true);return {rule:'P2-B · Đúng trọng tâm + trend tốt',checks};}
    if(score!==null&&score>=60&&strategic!==null&&strategic>=85&&execution!==null&&execution>=85&&(positiveTrend||strongTrend||partialPositive)){add('Market Score ≥60',fmt(score,1),true);add('Strategic Fit ≥85',fmt(strategic,1),true);add('Execution Fit ≥85',fmt(execution,1),true);add('Growth signal tích cực',x.trend.label,positiveTrend||strongTrend||partialPositive);return {rule:'P2-C · SAVA đã chứng minh năng lực thực thi',checks};}
    if(score!==null&&score>=60&&strategic!==null&&strategic>=85&&partialStrong&&economicsGood){add('Market Score ≥60',fmt(score,1),true);add('Strategic Fit ≥85',fmt(strategic,1),true);add('Một Growth metric ≥50%',availableGrowth===null?'—':pct(availableGrowth,1),partialStrong);add('Monetization & UA ≥60',`${mon===null?'—':fmt(mon,1)} / ${ua===null?'—':fmt(ua,1)}`,economicsGood);return {rule:'P2-D · Thiếu 1 Growth metric nhưng signal/economics mạnh',checks};}
    if(score!==null&&score>=45&&(positiveTrend||partialPositive||splitTrend)){add('Market Score ≥45',fmt(score,1),true);add('Có growth signal',x.trend.label,true);return {rule:'P4 · Có tín hiệu nhưng chưa đủ mạnh để ưu tiên kiểm chứng',checks};}
    if(score!==null&&score>=55){add('Market Score ≥55',fmt(score,1),true);add('Trend chưa đủ mạnh/đồng thuận',x.trend.label,false);return {rule:'P4 · Theo dõi thêm',checks};}
    add('Market Score',score===null?'—':fmt(score,1),score!==null&&score>=55);add('Trend',x.trend.label,false);return {rule:'P5 · Chưa ưu tiên',checks};
  }
  function openMarketPriorityDrilldown(id){
    const x=marketInsightById(id);if(!x)return;const match=marketPriorityRuleMatch(x);const checks=match.checks.map(c=>`<div class="drill-check ${c.ok?'pass':'miss'}"><span>${c.ok?'✓':'!'}</span><div><b>${esc(c.label)}</b><small>${esc(c.actual)}</small></div></div>`).join('');
    const signals=[['Market Attractiveness',x.score],['Phù hợp chiến lược',x.strategicFit],['Năng lực thực thi',x.executionFit],['Khả năng kiếm tiền',x.monetization],['Hiệu quả UA',x.ua]].map(([l,v])=>`<div><span>${esc(l)}</span><b>${v===null?'—':fmt(v,1)+'/100'}</b></div>`).join('');
    modalRoot.innerHTML=`<div class="modal-backdrop drilldown-backdrop"><div class="modal wide drilldown-modal"><div class="modal-head"><div><span class="eyebrow-mini">MARKET INTELLIGENCE · PRIORITY EXPLAINER</span><h2>${esc(x.m.Mechanic)}</h2><p>Giải thích rule đang xếp mechanic vào nhóm ưu tiên hiện tại.</p></div><button class="icon-btn" data-close>×</button></div><div class="modal-body"><div class="drill-priority-hero"><div>${marketDirectionBadge(x)}<h3>${esc(match.rule)}</h3><p>${esc(x.direction.desc||'')}</p></div><div class="drill-priority-score"><span>Market Score</span><strong>${x.score===null?'—':fmt(x.score,1)}</strong><em>/100</em></div></div><div class="drill-grid-main"><section><div class="drill-section-head"><h3>Điều kiện đang kích hoạt</h3><small>Hiển thị đúng thứ tự rule P1 → P5 đang dùng trong hệ thống.</small></div><div class="drill-check-list">${checks}</div><div class="drill-source-card"><h3>Xu hướng 3M</h3><p><b>${esc(x.trend.label)}</b> · ${esc(x.trend.detail||'')}</p><div class="drill-inline-values"><span>DL Growth <b>${x.dlg===null?'—':pct(x.dlg,1)}</b></span><span>Revenue Growth <b>${x.revg===null?'—':pct(x.revg,1)}</b></span></div></div></section><aside><div class="drill-source-card"><h3>Các tín hiệu dùng cho định hướng</h3><div class="drill-source-grid">${signals}</div></div><div class="drill-source-card"><h3>Data lineage</h3><p><b>Market Score</b> từ Market Intelligence · <b>Strategic Fit</b> từ Sourcing · <b>Execution Fit</b> từ Game Selection. Các lớp này được đọc chung nhưng không trộn thành một score duy nhất.</p></div></aside></div></div><div class="modal-foot"><button class="ghost" data-close>Đóng</button><button class="ghost" data-drill-score>Xem cách tính Market Score →</button><button class="primary" data-drill-edit>Mở Market Intelligence</button></div></div></div>`;
    modalRoot.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDrilldown);modalRoot.querySelector('[data-drill-score]').onclick=()=>openMarketScoreDrilldown(id);modalRoot.querySelector('[data-drill-edit]').onclick=()=>{closeDrilldown();openMarket(id);};
  }
  function openPartnerFitDrilldown(id){
    const p=byId(db.partners,id);if(!p)return;const d=partnerDerived(p),s=p.scores||{};const weights=[['Thành tích sản phẩm',score100(s.trackRecord),10],['Năng lực team',score100(s.team),15],['Năng lực sản xuất',d.production,15],['Dữ liệu & kỹ thuật',score100(s.dataTech),10],['Khả năng phối hợp',score100(s.collaboration),15],['Phù hợp chiến lược',score100(s.strategicFit),15],['Tiềm năng dài hạn',score100(s.longTerm),10]];const total=weights.reduce((a,b)=>a+b[2],0);const rows=weights.map(([l,v,w])=>drilldownMetricRow(l,v,{weight:w/total*100,contribution:v===null?null:v*w/total,detail:l==='Năng lực sản xuất'?'Composite Capacity + Cadence + Milestone + LiveOps':''})).join('');const rs=partnerRiskStats(id);const decision=p.decision?.status||p.decision?.recommendation||d.final;
    modalRoot.innerHTML=`<div class="modal-backdrop drilldown-backdrop"><div class="modal wide drilldown-modal"><div class="modal-head"><div><span class="eyebrow-mini">PARTNER SELECTION · FIT BREAKDOWN</span><h2>${esc(profile(p,'Tên Partner / Studio')||p.id)}</h2><p>Mức độ phù hợp được tính từ 7 nhóm score; Hard Gate có thể override kết luận cuối.</p></div><button class="icon-btn" data-close>×</button></div><div class="modal-body"><div class="drill-hero"><div><span>Mức độ phù hợp</span><strong>${d.fit===null?'—':fmt(d.fit,1)}</strong><em>/100</em></div><div>${badge(d.classification)}${badge(`Hard Gate · ${d.hard}`)}</div></div><div class="drill-grid-main"><section><div class="drill-section-head"><h3>7 nhóm tạo nên Partner Fit</h3><small>Điểm 1–5 trong playbook được quy đổi sang /100 trước khi áp trọng số.</small></div><div class="drill-metric-list">${rows}</div></section><aside><div class="drill-source-card"><h3>Evidence & Risk</h3><div class="drill-source-grid"><div><span>Evidence coverage</span><b>${pct(d.coverage,0)}</b></div><div><span>Độ tin cậy</span><b>${esc(d.confidence)}</b></div><div><span>Minimum Evidence Gate</span><b>${esc(d.minimumGate)}</b></div><div><span>Risk đang mở</span><b>${rs.open.length}</b></div><div><span>Risk cao</span><b>${rs.high.length}</b></div><div><span>Kết luận</span><b>${esc(decision)}</b></div></div>${d.missing?.length?`<div class="drill-warning"><b>Evidence còn thiếu:</b> ${esc(d.missing.map(k=>PARTNER_EVIDENCE_LABELS[k]||k).join(', '))}</div>`:''}</div><div class="drill-source-card"><h3>Rule quyết định</h3><p>Hard Gate <b>Không đạt</b> luôn chặn score. Nếu Hard Gate đạt, Partner Fit dùng ngưỡng: ≥85 Ưu tiên · ≥75 Đạt · ≥65 Có điều kiện · &lt;65 Cần xem xét.</p></div></aside></div></div><div class="modal-foot"><button class="ghost" data-close>Đóng</button><button class="primary" data-drill-edit>Mở Partner Assessment</button></div></div></div>`;
    modalRoot.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDrilldown);modalRoot.querySelector('[data-drill-edit]').onclick=()=>{closeDrilldown();openPartner(id);};
  }
  function openDealRiskDrilldown(id){
    const raw=byId(db.deals,id);if(!raw)return;const d=dealInitialDefaults(raw),x=dealDerived(d),r=dealRules();const vals=[
      ['Rủi ro Partner',x.partnerStrength,x.partnerStrength===null?null:(5-x.partnerStrength)/4*100,r.riskWeights.partner,'Partner Fit quy đổi về thang 1–5; Partner mạnh làm giảm risk'],
      ['Bằng chứng Game',dealNum(d.gameEvidence),dealNum(d.gameEvidence)===null?null:(5-dealNum(d.gameEvidence))/4*100,r.riskWeights.game,'Game evidence yếu làm tăng risk'],
      ['Mức chịu rủi ro SAVA',dealNum(d.riskTolerance),dealNum(d.riskTolerance)===null?null:(dealNum(d.riskTolerance)-1)/4*100,r.riskWeights.riskTolerance,'Commitment/downside cao làm tăng risk'],
      ['Áp lực cạnh tranh',dealNum(d.competitionPressure),dealNum(d.competitionPressure)===null?null:(dealNum(d.competitionPressure)-1)/4*100,r.riskWeights.competition,'Competition cao làm tăng risk'],
      ['Lợi thế đàm phán',dealNum(d.bargainingPower),dealNum(d.bargainingPower)===null?null:(5-dealNum(d.bargainingPower))/4*100,r.riskWeights.bargaining,'Leverage SAVA cao làm giảm risk'],
      ['Mức bảo vệ',dealNum(d.protection),dealNum(d.protection)===null?null:(5-dealNum(d.protection))/4*100,r.riskWeights.protection,'Recoup/Milestone/Data/Exit mạnh làm giảm risk']
    ];const rows=vals.map(([l,raw5,risk100,w,detail])=>drilldownMetricRow(l,risk100,{weight:w*100,contribution:risk100===null?null:risk100*w,detail:`Điểm gốc ${raw5===null?'—':fmt(raw5,1)}/5 · ${detail}`,tone:risk100!==null&&risk100>=60?'risk':'blue'})).join('');const decision=dealDisplayDecision(d,x),next=dealDisplayNextAction(d,x);const p=dealPartner(d);
    modalRoot.innerHTML=`<div class="modal-backdrop drilldown-backdrop"><div class="modal wide drilldown-modal"><div class="modal-head"><div><span class="eyebrow-mini">DEAL MAKING · RISK BREAKDOWN</span><h2>${esc(d.sourceDealId||d.id)} · ${esc(profile(p,'Tên Partner / Studio')||d.partnerId||'—')}</h2><p>Deal Risk /100 gồm 6 nhóm theo đúng weight của playbook.</p></div><button class="icon-btn" data-close>×</button></div><div class="modal-body"><div class="drill-hero risk"><div><span>Deal Risk</span><strong>${x.riskScore===null?'—':fmt(x.riskScore,0)}</strong><em>/100</em></div><div>${badge(x.riskBand.label)}${badge(`Hard Gate · ${x.hard}`)}</div></div><div class="drill-grid-main"><section><div class="drill-section-head"><h3>6 nhóm rủi ro</h3><small>Contribution hiển thị trực tiếp số điểm mỗi nhóm đóng góp vào tổng Risk /100.</small></div><div class="drill-metric-list">${rows}</div></section><aside><div class="drill-source-card"><h3>Decision context</h3><div class="drill-source-grid"><div><span>Readiness</span><b>${x.readiness===null?'—':fmt(x.readiness,0)+'/100'}</b></div><div><span>Hướng Deal</span><b>${esc(x.direction||'—')}</b></div><div><span>RS floor</span><b>${x.rsFloor===null?'—':pct(x.rsFloor,0)}</b></div><div><span>RS target</span><b>${x.rsTarget===null?'—':pct(x.rsTarget,0)}</b></div><div><span>Vốn tối đa</span><b>${x.maxInvestment===null?'—':money(x.maxInvestment)}</b></div><div><span>Quyết định</span><b>${esc(decision)}</b></div></div></div><div class="drill-source-card"><h3>Bước tiếp theo</h3><p>${esc(next)}</p><small>Risk band: &lt;30 Thấp · 30–49 Trung bình · 50–69 Cao · ≥70 Rất cao.</small></div></aside></div></div><div class="modal-foot"><button class="ghost" data-close>Đóng</button><button class="primary" data-drill-edit>Mở Deal để review</button></div></div></div>`;
    modalRoot.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDrilldown);modalRoot.querySelector('[data-drill-edit]').onclick=()=>{closeDrilldown();openDeal(id);};
  }
  function operationMetricCheck(label,current,target,pass,detail=''){
    return `<div class="operation-gate-metric ${current===null?'na':pass?'pass':'miss'}"><div><b>${esc(label)}</b><small>${esc(detail)}</small></div><strong>${current===null?'—':esc(current)}</strong><span>${esc(target)}</span><em>${current===null?'Chưa có dữ liệu':pass?'Đạt':'Chưa đạt'}</em></div>`;
  }
  function operationGateMetrics(p,m){
    const idx=operationStageIndex(p),model=p.monetizationModel;
    if(idx===0)return [operationMetricCheck('P0 / tracking',String(m.p0Pass??true)==='true'||m.p0Pass===true?'PASS':'FAIL','PASS',m.p0Pass!==false,'Build/tracking/store/SDK'),operationMetricCheck('Data mature',m.dataMature===false?'NO':'YES','YES',m.dataMature!==false,'Cohort đủ mature để review'),operationMetricCheck('Content runway',m.contentRunway===false?'NO':'YES','YES',m.contentRunway!==false,'Đủ content cho phase tiếp theo')];
    if(idx===1){const cpi=num(m.cpi),bench=num(m.cpiBenchmark),crash=num(m.crash),anr=num(m.anr),play=num(m.playtime),d1=num(m.d1);return [operationMetricCheck('CPI',cpi===null?null:'$'+fmt(cpi,2),bench===null?'≤120% benchmark':`≤ $${fmt(bench*1.2,2)}`,cpi!==null&&bench!==null&&cpi<=bench*1.2,'Benchmark '+(bench===null?'—':'$'+fmt(bench,2))),operationMetricCheck('Crash rate',crash===null?null:pct(crash,2),'<1%',crash!==null&&crash<.01),operationMetricCheck('ANR rate',anr===null?null:pct(anr,2),'<0.5%',anr!==null&&anr<.005),operationMetricCheck('Playtime',play===null?null:fmt(play,1)+'m','≥10m/ngày',play!==null&&play>=10),operationMetricCheck('D1 retention',d1===null?null:pct(d1,1),'≥35%',d1!==null&&d1>=.35,'Hard fail nếu <28%')];}
    if(idx===2){const r14=num(m.roasD14),rv=num(m.rvEngagement);return model==='Hybrid IAA'?[operationMetricCheck('ROAS D14',r14===null?null:pct(r14,1),'≥80%',r14!==null&&r14>=.8,'Hard fail <64%'),operationMetricCheck('RV engagement',rv===null?null:pct(rv,1),'≥40%',rv!==null&&rv>=.4,'Hard fail <32%')]:[operationMetricCheck('ROAS D14',r14===null?null:pct(r14,1),'≥120%',r14!==null&&r14>=1.2,'Test-more floor 96%')];}
    if(idx===3){const r14=num(m.roasD14),floor=model==='Hybrid IAA'?.8:1;return [operationMetricCheck('ROAS D14',r14===null?null:pct(r14,1),`≥${floor*100}%`,r14!==null&&r14>=floor,'Operating floor trong Expansion')];}
    const r14=num(m.roasD14),r21=num(m.roasD21),r30=num(m.roasD30);if(model==='Hybrid IAA')return [operationMetricCheck('ROAS D14',r14===null?null:pct(r14,1),'≥80%',r14!==null&&r14>=.8),operationMetricCheck('ROAS D21',r21===null?null:pct(r21,1),'≥110%',r21!==null&&r21>=1.1),operationMetricCheck('ROAS D30',r30===null?null:pct(r30,1),'≥130%',r30!==null&&r30>=1.3)];return [operationMetricCheck('ROAS D14',r14===null?null:pct(r14,1),'≥100%',r14!==null&&r14>=1),operationMetricCheck('ROAS D21',r21===null?null:pct(r21,1),'So với Approved Scale Reference',r21!==null,'Cần đối chiếu reference đã freeze'),operationMetricCheck('ROAS D30',r30===null?null:pct(r30,1),'So với Approved Scale Reference',r30!==null,'Cần đối chiếu reference đã freeze')];
  }
  function openOperationGateDrilldown(id){
    const p=byId(db.projects,id);if(!p)return;const m=p.gateReview?.metrics||{},idx=operationStageIndex(p),def=OPERATION_ROADMAP[idx],evalr=evaluateProject(p,m),saved=p.gateReview?.result||p.latestDecision||'Chưa review',metrics=operationGateMetrics(p,m).join('');
    modalRoot.innerHTML=`<div class="modal-backdrop drilldown-backdrop"><div class="modal wide drilldown-modal"><div class="modal-head"><div><span class="eyebrow-mini">PUBLISHING OPERATION · GATE EXPLAINER</span><h2>${esc(p.name||p.id)}</h2><p>${esc(def.code)} · ${esc(def.title)} — ${esc(def.objective)}</p></div><button class="icon-btn" data-close>×</button></div><div class="modal-body"><div class="drill-operation-hero"><div><span>Gate hiện tại</span><strong>${esc(def.title)}</strong><small>${esc(p.monetizationModel||'—')} · Attempt ${esc(m.attempt??1)}</small></div><div>${badge(saved)}<p>${esc(p.gateReview?.reason||evalr.reason||'')}</p></div></div><div class="drill-section-head"><h3>KPI & điều kiện Gate</h3><small>${esc(def.pass)}</small></div><div class="operation-gate-metric-grid">${metrics}</div><div class="drill-grid-main operation"><section><div class="drill-source-card"><h3>Rule chung</h3><p>${esc(def.common)}</p></div><div class="drill-source-card"><h3>Rule ${esc(p.monetizationModel||'model')}</h3><p>${esc(p.monetizationModel==='Hybrid IAA'?def.iaa:def.iap)}</p></div></section><aside><div class="drill-source-card"><h3>Đánh giá hiện tại</h3><div class="drill-source-grid"><div><span>Saved decision</span><b>${esc(saved)}</b></div><div><span>Auto evaluate</span><b>${esc(evalr.result)}</b></div><div><span>Reviewed by</span><b>${esc(p.gateReview?.reviewedBy||'—')}</b></div><div><span>Reviewed at</span><b>${p.gateReview?.reviewedAt?esc(new Date(p.gateReview.reviewedAt).toLocaleString('vi-VN')):'—'}</b></div></div>${saved!==evalr.result?`<div class="drill-warning"><b>Lưu ý:</b> Decision đã lưu khác kết quả auto hiện tại. Hãy mở Project và review lại Gate.</div>`:''}</div><div class="drill-source-card"><h3>Hành động tiếp theo</h3><p>${esc(p.nextAction||'—')}</p></div></aside></div></div><div class="modal-foot"><button class="ghost" data-close>Đóng</button><button class="primary" data-drill-edit>Mở Project để Review/Edit</button></div></div></div>`;
    modalRoot.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDrilldown);modalRoot.querySelector('[data-drill-edit]').onclick=()=>{closeDrilldown();openProject(id);};
  }

  function renderGames(){
    setHeader('Game Selection','4 · Lựa chọn Game trước Test · Market Fit + Product Fit + Marketing Fit + Business Potential');
    const derived=db.games.map(g=>({g,d:gameDerived(g)}));
    const rows=db.games.filter(g=>includesSearch(g.id,intake(g,'Game_Title'),intake(g,'Studio'),intake(g,'Mechanic'),gameDerived(g).selectionDecision,gameDerived(g).recommendation)).map(g=>{
      const d=gameDerived(g),sf=gameSavaFitDerived(g);
      return `<tr><td><button class="linkish" data-open-game="${g.id}">${g.id}</button></td><td><b>${esc(intake(g,'Game_Title'))}</b><div class="small muted">${esc(intake(g,'Studio')||'')}</div></td><td>${esc(intake(g,'Mechanic')||'—')}</td><td>${badge(intake(g,'Monetization_Model')||'—')}</td><td>${sf.score===null?'—':marketScoreBar(sf.score)}</td><td class="num">${d.market??g.scorecard?.marketScore??'—'}</td><td class="num"><b>${d.prescan??'—'}</b><div class="small muted">Hoàn thiện ${pct(d.preScanCompleteness,0)}</div></td><td>${gameEvidenceStatusHtml(g,d)}</td><td class="num">${d.stage==='POST-TEST'?(d.final??'—'):'—'}</td><td>${badge(d.hard)}</td><td>${gameSelectionDecisionHtml(d)}</td><td><button class="ghost" data-open-game="${g.id}">Edit</button></td></tr>`;
    });
    const proceed=derived.filter(({d})=>/^Tiếp tục$/.test(d.selectionDecision)).length;
    const conditional=derived.filter(({d})=>/Tiếp tục có điều kiện/.test(d.selectionDecision)).length;
    const withEvidence=derived.filter(({d})=>d.stage==='POST-TEST').length;
    const gateOpen=derived.filter(({d})=>d.hard!=='PASS').length;
    const workbookGuide=`<div class="notice"><b>Cách đọc đúng workbook:</b> <b>Pre-Scan</b> là quyết định lựa chọn Game trước Test. Nếu Game/Candidate đã có ít nhất <b>2/5 nhóm Product Evidence thực tế</b> (UA Test, Retention, Engagement, Monetization Test, Gamefeel Test), workbook tự bật nhánh <b>POST-TEST</b> để chấm thêm một lớp evidence. Trong Publishing OS, lớp này được hiển thị là <b>“Có Product Evidence”</b> và không đồng nghĩa Test phải xảy ra trước Deal. Funnel vận hành vẫn giữ <b>Deal → Test</b>. Product Evidence có thể là data thực tế đã có của chính Game/Candidate hoặc data Test mới; không dùng benchmark thị trường để thay thế.</div>`;
    content.innerHTML=`<div class="grid kpis">${kpi('Game đang đánh giá',db.games.length)}${kpi('Có thể đi tiếp',proceed+conditional,`${proceed} tiếp tục · ${conditional} có điều kiện`)}${kpi('Có Product Evidence',withEvidence,'Ít nhất 2/5 nhóm evidence thực tế')}${kpi('Hard Gate cần xử lý',gateOpen)}</div>
      ${workbookGuide}
      ${panel('Game decision pipeline',table(['ID','Game','Mechanic','Monetization','SAVA Fit /100','Market /100','Pre-Scan /100','Product Evidence','Điểm theo Evidence /100','Hard Gate','Kết luận lựa chọn',''],rows),'Kết luận chính của tab là quyết định Pre-Scan trước Test. Product Evidence sẵn có được dùng như lớp evidence bổ sung, theo đúng logic 10_SCORECARD.',`<button class="primary" data-action="add-game">+ Game</button>`)}
      ${panel('Logic chấm điểm theo workbook',`<div class="three"><div class="rule-card"><h3>Pre-Scan · Quyết định chính</h3><p>Market <b>45%</b> · Publishing Readiness <b>20%</b> · Deal Economics <b>20%</b> · SAVA Fit <b>15%</b>.</p><p class="small muted">Market Score cần tối thiểu 3/5 market evidence. Pre-Scan dùng để quyết định có nên tiếp tục Deal/Test hay không.</p></div><div class="rule-card"><h3>Có Product Evidence · Lớp bổ sung</h3><p>Market <b>25%</b> · Product Evidence <b>35%</b> · Readiness <b>15%</b> · Deal <b>15%</b> · SAVA Fit <b>10%</b>.</p><p class="small muted">Tự bật khi có ≥2/5 evidence của chính candidate. Workbook gọi trạng thái này là POST-TEST.</p></div><div class="rule-card"><h3>Ngưỡng nguồn</h3><p>Pre-Scan: Direct <b>&gt;75</b> · Conditional <b>≥60</b>. Evidence: Greenlight <b>≥80</b> · Test-more <b>≥68</b>. Data completeness <b>≥80%</b>. Hard Gate FAIL luôn override.</p></div></div>`,'Giữ nguyên trọng số/ngưỡng của 10_SCORECARD; UI tách quyết định lựa chọn trước Test khỏi lớp Product Evidence để không hiểu nhầm workflow.')}`;
    bindOpeners();
  }

  function sourcingDate(x,key){return x?.[key]||x?.milestones?.[key]||'';}
  function sourcingQualified(x){
    const sr=String(x?.screeningResult||'').trim();
    if(sr==='Loại') return 'Không';
    if(['Cân nhắc, cần đánh giá thêm','Tiếp tục','Tiếp tục nhưng cần chỉnh sửa'].includes(sr)) return 'Có';
    if(x?.qualified==='Có'||x?.qualified===true||sourcingDate(x,'qualifiedDate')) return 'Có';
    if(x?.qualified==='Không'||x?.qualified===false) return 'Không';
    const si=STAGES.indexOf(x?.stage);return si>=1?'Có':'Chờ';
  }
  function sourcingCurrentStage(x){
    if(sourcingDate(x,'scaleDate'))return 'Scale';
    if(sourcingDate(x,'launchDate'))return 'Launch';
    if(sourcingDate(x,'testDate'))return 'Test';
    if(sourcingDate(x,'dealDate'))return 'Deal';
    if(sourcingDate(x,'evaluationDate'))return 'Evaluation';
    const q=sourcingQualified(x);
    if(q==='Có')return 'Evaluation';
    if(sourcingDate(x,'qualifiedDate'))return 'Qualified';
    return STAGES.includes(x?.stage)&&STAGES.indexOf(x.stage)>0?x.stage:'Lead';
  }
  function sourcingStatus(x){return x?.screeningResult==='Loại'?'Loại':(x?.status||'Đang xử lý');}
  function dayDiff(a,b){if(!a||!b)return null;const x=new Date(a),y=new Date(b);if(Number.isNaN(x.getTime())||Number.isNaN(y.getTime()))return null;return Math.max(0,Math.floor((y-x)/86400000));}
  function sourcingStageStart(x,stage=sourcingCurrentStage(x)){
    const map={Lead:'leadDate',Qualified:'qualifiedDate',Evaluation:'evaluationDate',Deal:'dealDate',Test:'testDate',Launch:'launchDate',Scale:'scaleDate'};
    return sourcingDate(x,map[stage])||((stage==='Evaluation')?sourcingDate(x,'qualifiedDate'):'')||x?.createdAt||'';
  }
  function sourcingDaysInStage(x){const st=sourcingStageStart(x);return st?dayDiff(st,today()):null;}
  function sourcingPipelineAlert(x){const stage=sourcingCurrentStage(x),days=sourcingDaysInStage(x);if(sourcingStatus(x)!=='Đang xử lý'||days===null)return '—';return days>(SOURCING_SLA[stage]??999)?'STUCK':'OK';}
  function sourcingOverdue(x){if(sourcingStatus(x)!=='Đang xử lý'||!x?.actionDeadline)return false;return x.actionDeadline<today();}
  function sourcingReached(x,stage){
    if(stage==='Lead')return true;
    if(stage==='Qualified'||stage==='Evaluation')return sourcingQualified(x)==='Có';
    const idx=STAGES.indexOf(sourcingCurrentStage(x)),target=STAGES.indexOf(stage);return idx>=target;
  }
  function sourcingMarketAlignment(x){
    const linkedGame=byId(db.games,x?.gameId);
    const mechanic=intake(linkedGame,'Mechanic')||x?.mechanic||'';
    const exactName=mechanic||x?.genre||'';
    const marketItem=(db.market||[]).find(m=>normalizeMechanicName(m.Mechanic)===normalizeMechanicName(exactName));
    if(marketItem){
      const insight=marketAnalytics(db.market||[]).find(z=>z.m.Mechanic_ID===marketItem.Mechanic_ID);
      if(insight)return {group:marketItem.Mechanic,label:insight.direction.label,score:insight.score===null?null:Math.round(insight.score),source:'market',direction:insight.direction.key};
    }
    const g=String(x?.genre||'').toLowerCase();
    if(!g)return {group:'Chưa xác định',label:'Chưa xác định',score:null,source:'fallback'};
    if(g.includes('rpg')||/td/.test(g))return {group:'RPG / TD',label:'Cao — Đúng trọng tâm',score:100,source:'fallback'};
    if(g.includes('simulation'))return {group:'Simulation',label:'Cao — Đúng trọng tâm',score:100,source:'fallback'};
    if(g.includes('platform'))return {group:'Platform',label:'Cao — Đúng trọng tâm',score:100,source:'fallback'};
    if(g.includes('puzzle')||g.includes('block blast'))return {group:'Puzzle',label:'Cao — Đúng trọng tâm',score:100,source:'fallback'};
    if(g.includes('hybrid casual')||(g.includes('casual')&&!g.includes('hyper')))return {group:'Casual / Hybrid Casual',label:'Cao — Đúng trọng tâm',score:100,source:'fallback'};
    if(g.includes('hyper')||g.includes('strategy'))return {group:'Hyper / Strategy liền kề',label:'Trung bình — Liền kề',score:60,source:'fallback'};
    return {group:'Khác / Ngoài trọng tâm',label:'Thấp — Ngoài trọng tâm',score:20,source:'fallback'};
  }
  function sourcingScreeningAction(x){
    const q=sourcingQualified(x),a=sourcingMarketAlignment(x);
    if(a.score===null)return 'Cần bổ sung Genre / mapping thị trường';
    if(a.source==='market'){
      if(q==='Không'&&['priority','test'].includes(a.direction))return 'Market tốt / game chưa qua Screening — loại hoặc xem lại Product Fit';
      if(q==='Có'&&a.direction==='priority')return 'P1 · Ưu tiên chủ động — Qualified + Market ưu tiên cao';
      if(q==='Có'&&a.direction==='test')return 'P2 · Ưu tiên kiểm chứng — Qualified + Market đủ tốt để test';
      if(q==='Có'&&['selective','watch'].includes(a.direction))return 'Qualified — theo dõi chọn lọc / thêm evidence';
      if(q==='Không')return 'Giảm ưu tiên — Screening không đạt';
      return 'Chờ Screening';
    }
    if(a.score===100&&q==='Có')return 'Ưu tiên — đúng hướng & Qualified';
    if(a.score===100&&q==='Không')return 'Đúng thị trường / game yếu — loại';
    if(a.score===60&&q==='Có')return 'Ngoại lệ — Qualified, hướng liền kề';
    if(a.score===60&&q==='Không')return 'Giảm ưu tiên — liền kề & bị loại';
    if(a.score===20&&q==='Có')return 'Ngoại lệ — ngoài trọng tâm; cần bằng chứng';
    if(a.score===20&&q==='Không')return 'Dừng — độ phù hợp chiến lược thấp & bị loại';
    return 'Chờ Screening';
  }
  function sourcingFunnelVisual(passed,current){
    return `<div class="sourcing-funnel">${STAGES.map((st,i)=>{const prev=i?passed[STAGES[i-1]]:null;const conv=i===0?null:(prev?passed[st]/prev:null);return `<div class="sourcing-funnel-step sourcing-stage-${i}"><div class="sourcing-funnel-top"><div class="sourcing-funnel-name">${esc(st)}</div><span class="sourcing-stage-index">${i+1}</span></div><strong>${passed[st]}</strong><small>${i===0?'Tổng Lead':conv===null?'Chưa đủ dữ liệu chuyển đổi':`${(conv*100).toFixed(1)}% từ bước trước`}</small><span class="sourcing-active-pill">${current[st]||0} đang xử lý</span></div>${i<STAGES.length-1?'<div class="sourcing-funnel-arrow">→</div>':''}`}).join('')}</div>`;
  }
  function sourcingDistribution(items,keyFn){const map={};items.forEach(x=>{const k=keyFn(x)||'Chưa có';map[k]=(map[k]||0)+1});return map;}
  function sourcingBarRows(map,total){return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="sourcing-bar-row"><span>${esc(k)}</span><div class="sourcing-bar"><i style="width:${total?Math.max(2,v/total*100):0}%"></i></div><b>${v}</b><small>${total?`${(v/total*100).toFixed(1)}%`:'—'}</small></div>`).join('');}
  function sourcingTransitionAvg(items,a,b){const vals=items.map(x=>dayDiff(sourcingDate(x,a),sourcingDate(x,b))).filter(v=>v!==null);return vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null;}
  function renderSourcing(){
    setHeader('Sourcing Funnel & KPI','5 · Lead → Qualified → Evaluation → Deal → Test → Launch → Scale');
    const items=(db.sourcing||[]).filter(x=>includesSearch(x.id,x.leadName,x.game,x.studio,x.partnerId,x.source,x.owner,x.genre,x.screeningResult));
    const all=db.sourcing||[];
    const passed=Object.fromEntries(STAGES.map(st=>[st,all.filter(x=>sourcingReached(x,st)).length]));
    const current=Object.fromEntries(STAGES.map(st=>[st,all.filter(x=>sourcingCurrentStage(x)===st&&sourcingStatus(x)==='Đang xử lý').length]));
    const screened=all.filter(x=>x.screeningResult),qualified=all.filter(x=>sourcingQualified(x)==='Có').length;
    const passRate=all.length?qualified/all.length:null;
    const stuck=all.filter(x=>sourcingPipelineAlert(x)==='STUCK').length,overdue=all.filter(sourcingOverdue).length;
    const testDone=all.filter(x=>['Đạt','Không đạt'].includes(x.testResult));const testPass=testDone.length?testDone.filter(x=>x.testResult==='Đạt').length/testDone.length:null;
    const screeningDist=sourcingDistribution(screened,x=>x.screeningResult);
    const bottlenecks=STAGES.slice(1).map((st,i)=>{const prev=passed[STAGES[i]],cur=passed[st];return {label:`${STAGES[i]} → ${st}`,rate:prev?cur/prev:null};}).filter(x=>x.rate!==null).sort((a,b)=>a.rate-b.rate);
    const bottleneck=bottlenecks[0];
    const avgTransitions=[['Lead → Qualified','leadDate','qualifiedDate',14],['Qualified → Evaluation','qualifiedDate','evaluationDate',10],['Evaluation → Deal','evaluationDate','dealDate',30],['Deal → Test','dealDate','testDate',21],['Test → Launch','testDate','launchDate',30],['Launch → Scale','launchDate','scaleDate',30]];
    const speedRows=avgTransitions.map(([label,a,b,sla])=>{const avg=sourcingTransitionAvg(all,a,b);return `<tr><td>${esc(label)}</td><td class="num">${avg===null?'—':fmt(avg,1)+' ngày'}</td><td class="num">${sla} ngày</td><td>${avg===null?badge('Chưa có dữ liệu'):avg>sla?'<span class="badge bad">CHẬM</span>':'<span class="badge good">OK</span>'}</td></tr>`;});
    const activeRows=items.filter(x=>sourcingStatus(x)==='Đang xử lý').sort((a,b)=>Number(sourcingPipelineAlert(b)==='STUCK')-Number(sourcingPipelineAlert(a)==='STUCK')||Number(sourcingOverdue(b))-Number(sourcingOverdue(a))).slice(0,25).map(x=>{const stage=sourcingCurrentStage(x),days=sourcingDaysInStage(x),align=sourcingMarketAlignment(x),alert=sourcingPipelineAlert(x),isOverdue=sourcingOverdue(x),rowCls=alert==='STUCK'?'sourcing-row-stuck':isOverdue?'sourcing-row-overdue':'';return `<tr class="${rowCls}"><td><button class="linkish" data-open-sourcing="${esc(x.id)}">${esc(x.id)}</button></td><td><b>${esc(x.game||x.leadName||'—')}</b><div class="small muted">${esc(x.studio||'')}</div></td><td>${esc(x.source||'—')}</td><td>${esc(x.owner||'Chưa có')}</td><td>${badge(stage)}</td><td>${days===null?'—':`${days} / ${SOURCING_SLA[stage]??'—'} ngày`}</td><td>${alert==='STUCK'?'<span class="badge bad">STUCK</span>':badge(alert)}</td><td><b>${esc(align.label)}</b><div class="small muted">${align.score===null?'—':align.score+'/100'}</div></td><td>${esc(clipText(x.nextAction||'—',90))}<div class="small ${isOverdue?'danger-text':'muted'}">${x.actionDeadline?isOverdue?'Quá hạn · '+esc(x.actionDeadline):'Hạn '+esc(x.actionDeadline):'Chưa có deadline'}</div></td><td><button class="ghost" data-open-sourcing="${esc(x.id)}">Edit</button></td></tr>`;});
    const pipelineRows=items.slice(0,250).map(x=>{const align=sourcingMarketAlignment(x);return `<tr><td><button class="linkish" data-open-sourcing="${esc(x.id)}">${esc(x.id)}</button></td><td>${esc(x.game||x.leadName||'—')}<div class="small muted">${esc(x.studio||'')}</div></td><td>${esc(x.genre||'—')}</td><td>${esc(x.screeningResult||'Chưa Screening')}</td><td>${badge(sourcingQualified(x))}</td><td>${badge(sourcingCurrentStage(x))}</td><td>${badge(sourcingStatus(x))}</td><td>${esc(align.label)}</td><td>${esc(x.source||'—')}</td><td>${esc(x.owner||'—')}</td><td>${esc(clipText(x.nextAction||'—',85))}</td></tr>`;});
    const sourceGroups={};all.forEach(x=>{const k=x.source||'Chưa có nguồn';(sourceGroups[k]||(sourceGroups[k]=[])).push(x)});
    const sourceRows=Object.entries(sourceGroups).map(([source,list])=>{const c=Object.fromEntries(STAGES.map(st=>[st,list.filter(x=>sourcingReached(x,st)).length]));return `<tr><td>${esc(source)}</td><td class="num">${list.length}</td><td class="num">${c.Qualified}</td><td class="num">${c.Deal}</td><td class="num">${c.Test}</td><td class="num">${c.Launch}</td><td class="num">${c.Scale}</td><td class="num">${list.length?pct(c.Qualified/list.length,1):'—'}</td><td class="num">${c.Deal?pct(c.Test/c.Deal,1):'—'}</td><td class="num">${list.length?pct(c.Scale/list.length,1):'—'}</td></tr>`;});
    const bdGroups={};all.filter(x=>x.owner).forEach(x=>{const k=x.owner;(bdGroups[k]||(bdGroups[k]=[])).push(x)});
    const bdRows=Object.entries(bdGroups).map(([owner,list])=>{const c=Object.fromEntries(STAGES.map(st=>[st,list.filter(x=>sourcingReached(x,st)).length]));const st=list.filter(x=>sourcingPipelineAlert(x)==='STUCK').length;return `<tr><td>${esc(owner)}</td><td class="num">${list.length}</td><td class="num">${c.Qualified}</td><td class="num">${c.Deal}</td><td class="num">${c.Test}</td><td class="num">${c.Launch}</td><td class="num">${c.Scale}</td><td class="num">${list.length?pct(c.Deal/list.length,1):'—'}</td><td class="num">${list.length?pct(c.Scale/list.length,1):'—'}</td><td class="num">${st}</td></tr>`;});
    const lossMap=sourcingDistribution(all.filter(x=>x.reasonLost),x=>x.reasonLost),lossTotal=Object.values(lossMap).reduce((a,b)=>a+b,0);
    const alignMap=sourcingDistribution(all,x=>sourcingMarketAlignment(x).label),alignTotal=all.length;
    const guide=`<div class="sourcing-guide"><div><b>Qualified</b><span>Kết quả Screening khác “Loại” → Có và đi vào Evaluation.</span></div><div><b>Deal trước Test</b><span>Test chỉ được bắt đầu sau khi Deal/ký hợp đồng đã chốt.</span></div><div><b>Lead đang xử lý</b><span>Bắt buộc có BD phụ trách + Hành động tiếp theo + Deadline.</span></div><div><b>Đánh giá BD</b><span>Không chỉ nhìn số Lead; ưu tiên Chất lượng + Chuyển đổi + Tốc độ + Kết quả.</span></div></div>`;
    content.innerHTML=`<div class="sourcing-page"><div class="sourcing-section-label"><span>Tổng quan Funnel</span><small>Nhìn nhanh quy mô, chất lượng và các điểm cần xử lý</small></div><div class="grid kpis sourcing-kpis">${kpi('Tổng Lead',all.length,'Toàn bộ cơ hội đã ghi nhận')}${kpi('Tỷ lệ qua Screening',passRate===null?'—':pct(passRate,1),`${qualified} Qualified`)}${kpi('Deal đã ký',passed.Deal,'Test chỉ sau Deal')}${kpi('Scale',passed.Scale,'Kết quả cuối Funnel')}${kpi('Cần xử lý',stuck+overdue,`${stuck} STUCK · ${overdue} quá hạn`)}</div>
      ${panel('Funnel Sourcing',sourcingFunnelVisual(passed,current)+`<div class="sourcing-target"><b>Target tham chiếu Strategy:</b> 100 Qualified → 30 Evaluation/Pre-Screen → 10 Test → 5 Validation → 2 Launch → 1 Scale. Deal là bước ký hợp đồng thực tế trước Test và không có target riêng trong Strategy.</div>`,'Theo dõi số lượng + chuyển đổi từng bước để tìm điểm nghẽn, không đánh giá Sourcing chỉ bằng số Lead.')}
      <div class="sourcing-two-col">${panel('Chất lượng Screening',`<div class="sourcing-quality">${sourcingBarRows(screeningDist,screened.length||1)}</div><div class="sourcing-summary-line"><span><b>Tỷ lệ Test đạt:</b> ${testPass===null?'—':pct(testPass,1)}</span><span><b>Lead → Scale:</b> ${all.length?pct(passed.Scale/all.length,2):'—'}</span></div>`,'Screening quyết định Qualified. Dữ liệu lịch sử có Screening được tính vào Lead/Qualified/Evaluation.')}${panel('Điểm nghẽn & Tốc độ',`<div class="bottleneck-card"><span>Điểm nghẽn chính</span><strong>${esc(bottleneck?.label||'Chưa đủ dữ liệu')}</strong><b>${bottleneck?.rate===null||bottleneck?.rate===undefined?'—':pct(bottleneck.rate,1)}</b></div>${table(['Chuyển giai đoạn','Số ngày TB','SLA','Đánh giá'],speedRows)}`,'Chỉ tính tốc độ với case có đủ ngày chuyển giai đoạn; dữ liệu lịch sử thiếu ngày không bị đưa vào average.')}</div>
      ${panel('Pipeline cần hành động',activeRows.length?table(['ID','Game / Studio','Nguồn','BD','Giai đoạn','Ngày / SLA','Cảnh báo','Phù hợp thị trường','Hành động tiếp theo',''],activeRows,'sourcing-action-table'):'<div class="empty">Chưa có Lead đang xử lý phù hợp bộ lọc.</div>','Ưu tiên xử lý STUCK và Hành động tiếp theo quá hạn.',`<button class="primary" data-action="add-sourcing">+ Lead</button>`)}
      <div class="sourcing-two-col">${panel('Hiệu quả theo nguồn',sourceRows.length?table(['Nguồn','Lead','Qualified','Deal','Test','Launch','Scale','Lead→Qualified','Deal→Test','Scale/Lead'],sourceRows,'sourcing-source-table'):'<div class="empty">Chưa có dữ liệu nguồn.</div>','So sánh chất lượng nguồn Sourcing thay vì chỉ so Lead volume.')}${panel('Hiệu quả BD',bdRows.length?table(['BD phụ trách','Lead','Qualified','Deal','Test','Launch','Scale','Lead→Deal','Lead→Scale','STUCK'],bdRows,'sourcing-bd-table'):'<div class="empty">Dữ liệu lịch sử chưa có BD phụ trách; KPI này sẽ đầy dần từ dữ liệu vận hành mới.</div>','BD được đánh giá theo chuyển đổi, tốc độ và kết quả; không chỉ số Lead.')}</div>
      <div class="sourcing-two-col">${panel('Lý do loại',lossTotal?sourcingBarRows(lossMap,lossTotal):'<div class="empty">Dữ liệu lịch sử chưa có lý do loại chi tiết. BD nên chọn lý do khi đóng Lead.</div>','Review hàng tháng để biết Lead fail vì Product, Market, Team hay Deal.')}${panel('Mức phù hợp với định hướng thị trường',sourcingBarRows(alignMap,alignTotal||1),'Nếu Lead đã link Game hoặc khớp chính xác Mechanic, hệ thống lấy trực tiếp Định hướng + Sức hấp dẫn từ Market Intelligence; nếu chưa map được thì mới dùng nhóm chiến lược fallback. Không thay thế Screening.')}</div>
      ${panel('Nguyên tắc vận hành',guide,'Nguồn: workbook SAVA Sourcing Funnel & KPI. Review Funnel hàng tuần; review Nguồn / Lý do loại / Điểm nghẽn hàng tháng.')}
      ${panel('Toàn bộ Pipeline',`<details class="market-raw-details"><summary>Xem ${items.length} Lead theo bộ lọc hiện tại</summary>${table(['Lead ID','Game / Studio','Genre','Screening','Qualified','Giai đoạn','Trạng thái','Phù hợp thị trường','Nguồn','BD','Hành động'],pipelineRows,'sourcing-pipeline-table')}</details>`,'Các Lead lịch sử thiếu ngày/người phụ trách vẫn được giữ để tính chất lượng Screening, nhưng không dùng để suy diễn tốc độ.')}</div>`;
    bindOpeners();
  }

  const OPERATION_ROADMAP=[
    {key:'p0',code:'P0',title:'Publishing Preflight',vn:'Sẵn sàng chạy campaign',summary:'Build · tracking · store · SDK',objective:'Xác nhận build, tracking, store và monetization setup đủ tin cậy trước khi MKT chạy campaign.',pass:'P0 PASS → Product Test',common:'Tracking/attribution, QA, crash/ANR, store/policy, backend, save/load và basic monetization phải PASS.',iap:'Billing + test purchase + restore/acknowledge + IAP mapping + purchase events.',iaa:'Mediation + ad units/adapters + rewarded delivery + interstitial cap + ad-revenue connector.'},
    {key:'product',code:'G2',title:'Product Test',vn:'Chứng minh chất lượng Product',summary:'CPI · Stability · Playtime · D1',objective:'Chứng minh core loop và chất lượng sản phẩm bằng cohort thực tế; content runway đủ đến D7.',pass:'PASS → Monetization Test · tối đa 2 attempts',common:'PASS: CPI ≤120% benchmark · Crash <1% · ANR <0.5% · Playtime ≥10m/ngày · D1 ≥35%. Hard FAIL: CPI >120% benchmark hoặc D1 <28%. D3/D7 chỉ là target/monitoring.',iap:'Theo dõi payer conversion, ARPPU, offer/price friction và mix IAP/IAA.',iaa:'Theo dõi ad engagement, reward acceptance, ad ARPDAU và impact ads lên retention.'},
    {key:'monet',code:'M',title:'Monetization Test',vn:'Chứng minh economics',summary:'ROAS D14 · LiveOps · Economy/Ads',objective:'Sau Product Test PASS, kiểm thử monetization trên cohort có content runway D14. ROAS D7 chỉ là early signal; quyết định Gate đọc D14.',pass:'PASS → Big Budget / Expansion · tối đa 2 attempts',common:'LiveOps phải sẵn sàng ngay khi vào phase. Data/ROAS chưa mature hoặc content runway D14 thiếu → HOLD.',iap:'PASS: ROAS D14 ≥120% · TEST THÊM: 96%–<120% · STOP: <96%.',iaa:'PASS: ROAS D14 ≥80% + RV engagement ≥40%. Hard FAIL: ROAS <64% hoặc RV <32%.'},
    {key:'expansion',code:'BB',title:'Big Budget / Expansion',vn:'Xác nhận economics khi tăng spend',summary:'Budget · Geo · Network · Creative',objective:'Chỉ mở ngân sách lớn sau Monetization PASS; kiểm tra economics còn giữ khi tăng spend, geo, network và creative.',pass:'PASS → Scale Gate · theo budget step / committee',common:'D14 mature quyết định budget step. D21/D30 chưa mature không tự động HOLD Expansion.',iap:'Entry từ Monetization PASS ≥120%; trong Expansion giữ D14 operating floor ≥100% và không deterioration đáng kể.',iaa:'Entry từ Monetization PASS; trong Expansion giữ D14 operating floor ≥80% + ad/RV quality ổn định.'},
    {key:'scale',code:'S',title:'Scale',vn:'Scale bền vững',summary:'Long-term cohort · Rollback trigger',objective:'Sau Expansion PASS, dùng cohort dài hạn để xác nhận khả năng scale bền vững và duy trì quality.',pass:'PASS → tiếp tục scale · TEST THÊM → giữ step · FAIL → rollback',common:'Chỉ review Scale sau khi Big Budget / Expansion đã PASS và cohort dài hạn cần thiết đã mature.',iap:'D14 operating floor ≥100% + D21/D30 so với Approved Scale Reference đã freeze trước Scale Gate.',iaa:'D14 ≥80% + D21 ≥110% + D30 ≥130%, CPI/retention/ad quality ổn định.'}
  ];
  function operationStageIndex(p){
    const t=`${p?.sopStage||''} ${p?.gatePhase||''}`.toLowerCase();
    if(/scale/.test(t))return 4;
    if(/big budget|expansion/.test(t))return 3;
    if(/monet/.test(t))return 2;
    if(/product test|g2/.test(t))return 1;
    return 0;
  }
  function operationStageValue(p){return ['P0 / Chờ Product Test','Product Test','Monetization Test','Big Budget / Expansion','Scale'][operationStageIndex(p)];}
  function operationGateLabel(stage){
    const i=['P0 / Chờ Product Test','Product Test','Monetization Test','Big Budget / Expansion','Scale'].indexOf(stage);
    return ['P0 – Publishing Preflight','G2 – Product Test','Monetization Test – ROAS D14','Big Budget / Expansion – Validate Expansion Economics','Scale – Long-term Scalability & Cohort Health'][Math.max(0,i)]||'P0 – Publishing Preflight';
  }
  function operationRoadmapHtml(p,{mini=false}={}){
    const idx=operationStageIndex(p),decision=String(p?.gateReview?.result||p?.latestDecision||'').toUpperCase();
    return `<div class="operation-project-roadmap ${mini?'mini':''}">${OPERATION_ROADMAP.map((s,i)=>{let state=i<idx?'done':i===idx?'current':'future';if(i===idx&&/FAIL|STOP|ROLLBACK/.test(decision))state='failed';else if(i===idx&&/HOLD/.test(decision))state='hold';else if(i===idx&&/TEST/.test(decision))state='testing';return `<div class="operation-project-step ${state}"><span>${esc(s.code)}</span><b>${esc(s.title)}</b></div>${i<OPERATION_ROADMAP.length-1?'<i class="operation-project-arrow">→</i>':''}`}).join('')}</div>`;
  }
  function operationRoadmapCards(){
    return `<div class="operation-roadmap">${OPERATION_ROADMAP.map((s,i)=>`<div class="operation-roadmap-stage operation-roadmap-${i}"><div class="operation-stage-head"><span class="operation-stage-code">${esc(s.code)}</span><div><b>${esc(s.title)}</b><small>${esc(s.vn)}</small></div></div><p class="operation-stage-objective">${esc(s.objective)}</p><div class="operation-stage-summary">${esc(s.summary)}</div><div class="operation-stage-rule"><span>Điều kiện chung</span><p>${esc(s.common)}</p></div><div class="operation-model-rules"><div><em>IAP</em><p>${esc(s.iap)}</p></div><div><em>IAA</em><p>${esc(s.iaa)}</p></div></div><div class="operation-stage-exit">${esc(s.pass)}</div></div>${i<OPERATION_ROADMAP.length-1?'<div class="operation-roadmap-arrow">→</div>':''}`).join('')}</div>`;
  }
  function operationDecisionLegend(){return `<div class="operation-legend"><div><span class="dot pass"></span><b>PASS</b><small>Qua Gate → phase tiếp theo</small></div><div><span class="dot test"></span><b>TEST THÊM</b><small>Giữ Gate, fix theo hypothesis rồi retest</small></div><div><span class="dot fail"></span><b>FAIL / STOP</b><small>Dừng hoặc rollback / post-mortem</small></div><div><span class="dot hold"></span><b>HOLD</b><small>Data/P0/cohort chưa hợp lệ; chưa kết luận</small></div></div>`;}

  function sourceStatusLabel(meta){
    if(sourceStorageState.loading)return '<span class="badge">Đang kiểm tra…</span>';
    if(sourceStorageState.error)return '<span class="badge bad">Lỗi Storage</span>';
    return sourceStorageState.files?.[meta.storagePath]?'<span class="badge good">Đã lưu</span>':'<span class="badge warn">Chưa upload</span>';
  }
  function renderSources(){
    setHeader('Tài liệu nguồn','One Source of Truth · File Excel gốc + data lineage');
    const canUpload=window.SAVA_SUPABASE?.configured&&window.SAVA_SUPABASE.getRole?.()==='admin';
    const cards=SOURCE_WORKBOOKS.map(meta=>{const file=sourceStorageState.files?.[meta.storagePath];const updated=file?.updated_at||file?.created_at||'';const size=file?.metadata?.size;return `<article class="source-file-card"><div class="source-file-top"><div><span class="source-file-type">${esc(meta.type)}</span><h3>${esc(meta.module)}</h3></div>${sourceStatusLabel(meta)}</div><p class="source-file-name">${esc(meta.name)}</p><div class="source-file-stats"><span><b>${meta.sheets}</b> sheets</span><span><b>${meta.formulas.toLocaleString('en-US')}</b> formulas</span><span><b>Owner:</b> ${esc(meta.owner)}</span></div><p>${esc(meta.note)}</p>${file?`<div class="source-file-saved"><b>✓ Đã lưu trên Supabase</b><span>${updated?`Cập nhật: ${esc(new Date(updated).toLocaleString('vi-VN'))}`:''}${size?` · ${(size/1024/1024).toFixed(2)} MB`:''}</span></div>`:''}<div class="source-file-actions"><button class="ghost" data-source-download="${meta.id}" ${file?'':'disabled'}>↓ Tải file Excel gốc</button>${canUpload?`<button class="ghost" data-source-upload="${meta.id}">${file?'Thay file nguồn':'Upload file nguồn'}</button>`:''}</div></article>`}).join('');
    const mapRows=[
      ['Partner Selection','Partner profile · Hard Gate · Evidence · Partner Fit · Risk · Decision','Các module khác chỉ đọc Partner ID / Fit / Risk / Deal summary'],
      ['Game Selection','Candidate intake · Product/Market score · SAVA Publishing Fit','Market dùng làm evidence năng lực; Sourcing/Deal/Operation link theo Game ID'],
      ['Market Intelligence','Market economics · Growth · RPD · CPI · taxonomy mechanic','Sourcing đọc Định hướng/Market evidence; Game Selection đọc Market inputs'],
      ['Deal Making','RS · MG/đầu tư · UA commitment · Recoup · negotiation · milestone · exit','Partner/Operation chỉ hiển thị lại Deal đã link; không nhập lại'],
      ['Sourcing','Stage Funnel · Screening · SLA · strategic direction fit 100/60/20','Tham chiếu Partner/Game/Market; không thay thế score của các module nguồn'],
      ['Publishing Operation','Post-deal SOP · Product Test · Monetization · Expansion · Scale gate','Nhận Game/Partner/Deal đã chốt và phản hồi performance thực tế về hệ thống']
    ].map(r=>`<tr>${r.map((x,i)=>`<td${i===0?'><b>':'>'}${esc(x)}${i===0?'</b>':''}</td>`).join('')}</tr>`);
    content.innerHTML=`<div class="notice"><b>Nguyên tắc:</b> mỗi dữ liệu chỉ có một module sở hữu. Các tab khác đọc lại bằng ID/link thay vì nhập lại. File Excel trong mục này được lưu ở <b>Supabase Storage private</b>, không nằm trong GitHub Pages public.</div><div class="source-files-grid">${cards}</div>${panel('Bản đồ nguồn dữ liệu',table(['Module sở hữu','Dữ liệu gốc','Cách module khác sử dụng'],mapRows,'source-map-table'),'Rule nền để tránh nhập trùng và tránh hai tab cho ra hai giá trị khác nhau.')}${panel('Luồng dữ liệu chung',`<div class="source-flow"><span>Market Intelligence</span><b>→</b><span>Sourcing</span><b>→</b><span>Partner + Game Selection</span><b>→</b><span>Deal Making</span><b>→</b><span>Publishing Operation</span><b>↺</b><span>Performance feedback</span></div>`,'Performance thực tế sau Test/Launch/Scale phải quay lại làm evidence cho Game, Partner và Market.')}`;
    bindSourceActions();
    if(window.SAVA_SUPABASE?.configured&&!sourceStorageState.loaded&&!sourceStorageState.loading)refreshSourceStorage();
  }
  function bindSourceActions(){
    document.querySelectorAll('[data-source-download]').forEach(btn=>btn.onclick=async()=>{const meta=SOURCE_WORKBOOKS.find(x=>x.id===btn.dataset.sourceDownload);if(!meta)return;btn.disabled=true;try{await window.SAVA_SUPABASE.downloadSourceFile(meta.storagePath,meta.name);toast('Đã tải file Excel gốc');}catch(e){console.error(e);toast(`Tải file thất bại: ${e.message}`);}finally{btn.disabled=false;}});
    document.querySelectorAll('[data-source-upload]').forEach(btn=>btn.onclick=()=>{const meta=SOURCE_WORKBOOKS.find(x=>x.id===btn.dataset.sourceUpload);if(!meta)return;const input=document.createElement('input');input.type='file';input.accept=meta.type==='XLSM'?'.xlsm':'.xlsx';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;btn.disabled=true;try{await window.SAVA_SUPABASE.uploadSourceFile(meta.storagePath,file);toast(`Đã lưu ${meta.module} vào kho riêng tư`);sourceStorageState.loaded=false;await refreshSourceStorage();}catch(e){console.error(e);toast(`Upload thất bại: ${e.message}`);}finally{btn.disabled=false;}};input.click();});
  }
  async function refreshSourceStorage(){
    if(!window.SAVA_SUPABASE?.configured||!window.SAVA_SUPABASE.listSourceFiles)return;
    sourceStorageState.loading=true;sourceStorageState.error='';if(currentView==='sources')renderSources();
    try{const list=await window.SAVA_SUPABASE.listSourceFiles();sourceStorageState.files=Object.fromEntries((list||[]).map(x=>[x.name,x]));sourceStorageState.loaded=true;}catch(e){sourceStorageState.error=e.message;console.error(e);}finally{sourceStorageState.loading=false;if(currentView==='sources')renderSources();}
  }

  function auditValue(v){
    if(v===undefined)return '∅';
    if(v===null||v==='')return '—';
    if(typeof v==='boolean')return v?'Có':'Không';
    if(typeof v==='number')return String(v);
    if(typeof v==='string')return v.length>120?v.slice(0,117)+'…':v;
    try{const x=JSON.stringify(v);return x.length>120?x.slice(0,117)+'…':x;}catch{return String(v);}
  }
  function auditChangeHtml(changes=[]){
    if(!changes.length)return '<span class="muted">Không có diff chi tiết</span>';
    const rows=changes.map(c=>`<div class="audit-diff-row"><code>${esc(c.field)}</code><span class="audit-old">${esc(auditValue(c.old))}</span><b>→</b><span class="audit-new">${esc(auditValue(c.new))}</span></div>`).join('');
    const short=changes.slice(0,2).map(c=>`${c.field}: ${auditValue(c.old)} → ${auditValue(c.new)}`).join(' · ');
    return `<details class="audit-details"><summary>${esc(short||`${changes.length} thay đổi`)}${changes.length>2?` · +${changes.length-2} trường`:''}</summary><div class="audit-diff-list">${rows}</div></details>`;
  }
  function renderAudit(){
    setHeader('Lịch sử thay đổi','8 · Audit log toàn hệ thống');
    const all=db.audit||[];
    const items=all.filter(a=>includesSearch(a.user,a.module,a.tableName,a.recordId,a.summary,a.action,...(a.changes||[]).flatMap(c=>[c.field,auditValue(c.old),auditValue(c.new)])));
    const now=Date.now(),day=86400000;
    const last24=all.filter(a=>{const t=new Date(a.at).getTime();return Number.isFinite(t)&&now-t<=day;}).length;
    const users=new Set(all.map(a=>a.user).filter(Boolean)).size;
    const modules=new Set(all.map(a=>a.module).filter(Boolean)).size;
    const rows=items.map(a=>`<tr><td class="nowrap"><b>${esc(new Date(a.at).toLocaleString('vi-VN'))}</b></td><td>${esc(a.user||'System')}</td><td>${esc(a.module||a.tableName||'—')}</td><td><b>${esc(a.recordId||'—')}</b><div class="small muted">${esc(a.tableName||'')}</div></td><td>${badge(({INSERT:'Thêm',UPDATE:'Sửa',DELETE:'Xóa',UPLOAD:'Upload',REPLACE:'Thay file'})[a.actionType]||a.actionType||'Cập nhật')}</td><td>${auditChangeHtml(a.changes||[])}</td></tr>`);
    const notice=window.SAVA_SUPABASE?.configured?'<b>Log được ghi tại Supabase.</b> Mỗi lần thêm/sửa/xóa record đều lưu người sửa, thời gian và old/new data. Thay file nguồn cũng được ghi riêng.':'Đang chạy local: log chỉ nằm trong trình duyệt hiện tại.';
    content.innerHTML=`<div class="notice audit-notice">${notice}</div><div class="grid kpis">${kpi('Log đang hiển thị',items.length,`${all.length} log gần nhất đã tải`)}${kpi('24 giờ gần nhất',last24)}${kpi('Người đã thay đổi',users)}${kpi('Nhóm dữ liệu',modules)}</div>${panel('Audit log',table(['Thời gian','Người sửa','Module','Bản ghi','Hành động','Chi tiết thay đổi'],rows,'audit-table'),'Dùng ô tìm kiếm phía trên để lọc theo Partner/Game/Deal/field/người sửa. Log là read-only; Viewer cũng có thể xem.')}`;
  }

  function renderOperations(){
    setHeader('Publishing Operation','6 · Roadmap vận hành sau Deal');
    const projects=(db.projects||[]).filter(p=>includesSearch(p.id,p.name,p.genre,p.sopStage,p.gatePhase,p.owner,p.monetizationModel));
    const stageCounts=OPERATION_ROADMAP.map((_,i)=>(db.projects||[]).filter(p=>operationStageIndex(p)===i).length);
    const roadmapRows=projects.map(p=>`<tr><td><button class="linkish" data-open-project="${p.id}">${esc(p.id)}</button></td><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.genre||'')} · ${esc(p.monetizationModel||'—')}</div></td><td>${operationRoadmapHtml(p,{mini:true})}</td><td><button type="button" class="drilldown-trigger operation-gate-trigger" data-open-operation-gate="${esc(p.id)}" title="Xem KPI và rule của Gate hiện tại"><b>${esc(p.gatePhase||operationGateLabel(operationStageValue(p)))}</b><div class="small muted">${esc(p.deploymentStatus||'—')}</div><span class="drilldown-hint">Xem Gate ↗</span></button></td><td><button type="button" class="drilldown-trigger operation-decision-trigger" data-open-operation-gate="${esc(p.id)}" title="Xem vì sao Gate có quyết định này">${badge(p.gateReview?.result||p.latestDecision||'Chưa review')}<div class="small muted">${esc(p.gateReview?.reason||'')}</div><span class="drilldown-hint">Xem evidence ↗</span></button></td><td>${esc(clipText(p.nextAction||'—',110))}</td><td><button class="ghost" data-open-project="${p.id}">Review</button></td></tr>`);
    const currentDist=OPERATION_ROADMAP.map((s,i)=>`<div class="operation-stage-count operation-count-${i}"><span>${esc(s.code)} · ${esc(s.title)}</span><b>${stageCounts[i]}</b><small>${esc(s.vn)}</small></div>`).join('');
    content.innerHTML=`<div class="operation-page"><div class="grid kpis operation-kpis">${kpi('Dự án',(db.projects||[]).length,'Portfolio sau Deal')}${kpi('P0 · Preflight',stageCounts[0],'Chuẩn bị trước campaign')}${kpi('Product Test',stageCounts[1],'Đọc CPI · D1 · stability')}${kpi('Monetization+',stageCounts[2]+stageCounts[3],`${stageCounts[2]} Monetization · ${stageCounts[3]} Expansion`)}${kpi('Scale',stageCounts[4],'Long-term scalability')}</div>
      ${panel('Roadmap Publishing sau Deal',`${operationRoadmapCards()}${operationDecisionLegend()}<div class="operation-source-note"><b>Rule đọc chung:</b> D1 nằm trong Product Test · ROAS D7 chỉ là early signal · Monetization Gate đọc ROAS D14 · Product Test & Monetization Test tối đa 2 attempts · HOLD do data/P0/maturity không tính là failed attempt.</div>`,'Source of truth: Publishing_Launching_1 → Publishing flow + Decision Criteria của Hybrid IAP / Hybrid IAA.')}
      ${panel('Dự án đang ở đâu trên Roadmap',`<div class="operation-stage-distribution">${currentDist}</div>${roadmapRows.length?table(['ID','Dự án','Roadmap','Gate hiện tại','Quyết định','Hành động tiếp theo',''],roadmapRows,'operation-project-table'):'<div class="empty">Chưa có dự án phù hợp bộ lọc.</div>'}`,'Mỗi dự án đi từ trái sang phải. Xanh lá = đã qua · xanh dương = phase hiện tại · cam = test thêm/HOLD · đỏ = fail/rollback.',`<button class="primary" data-action="add-project">+ Project</button>`)}
      ${panel('Cách đọc từng đoạn',`<div class="operation-reading"><div><b>1 · P0</b><span>Không chạy UA nếu build, tracking, store hoặc SDK chưa PASS.</span></div><div><b>2 · Product Test</b><span>Chứng minh Product trước: CPI + stability + playtime + D1. D3/D7 chỉ theo dõi.</span></div><div><b>3 · Monetization</b><span>Chỉ vào sau Product PASS. D14 là Gate; LiveOps/economy/ads phải chạy ngay trong phase.</span></div><div><b>4 · Expansion</b><span>Chỉ tăng budget sau Monetization PASS; kiểm tra economics có giữ khi tăng spend/geo/network.</span></div><div><b>5 · Scale</b><span>Chỉ vào sau Expansion PASS; đọc cohort dài hạn và luôn có rollback trigger.</span></div></div>`,'Roadmap không khóa timeline production; chỉ chuyển phase khi evidence đủ mature và Gate đã được review.')}
    </div>`;
    bindOpeners();
  }
  function gateCards(branch={}){ return Object.entries(branch).map(([k,v])=>`<div class="rule-card" style="margin-bottom:9px"><h3>${esc(k)}</h3>${Object.entries(v||{}).map(([a,b])=>`<p><b>${esc(a)}:</b> ${esc(b)}</p>`).join('')}</div>`).join(''); }

  function bindOpeners(){
    document.querySelectorAll('[data-open-partner]').forEach(b=>b.onclick=()=>openPartner(b.dataset.openPartner));
    document.querySelectorAll('[data-delete-partner]').forEach(b=>b.onclick=()=>{if(window.SAVA_SUPABASE?.configured&&!window.SAVA_SUPABASE.canDelete()){toast('Only Admin can delete records');return;}const id=b.dataset.deletePartner;if(confirm('Delete this partner from the shared database?')){db.partners=db.partners.filter(x=>x.id!==id);db.partnerRisks=(db.partnerRisks||[]).filter(x=>x.partnerId!==id);(db.deals||[]).forEach(x=>{if(x.partnerId===id)x.partnerId=null;});(db.sourcing||[]).forEach(x=>{if(x.partnerId===id)x.partnerId=null;});(db.projects||[]).forEach(x=>{if(x.partnerId===id)x.partnerId=null;});persist(`Deleted partner ${id}`);}});
    document.querySelectorAll('[data-open-deal]').forEach(b=>b.onclick=()=>openDeal(b.dataset.openDeal));
    document.querySelectorAll('[data-open-market]').forEach(b=>b.onclick=()=>openMarket(b.dataset.openMarket));
    document.querySelectorAll('[data-open-execution-fit]').forEach(b=>b.onclick=()=>openExecutionFit(b.dataset.openExecutionFit));
    document.querySelectorAll('[data-open-market-score]').forEach(b=>b.onclick=()=>openMarketScoreDrilldown(b.dataset.openMarketScore));
    document.querySelectorAll('[data-open-market-priority]').forEach(b=>b.onclick=()=>openMarketPriorityDrilldown(b.dataset.openMarketPriority));
    document.querySelectorAll('[data-open-partner-fit]').forEach(b=>b.onclick=()=>openPartnerFitDrilldown(b.dataset.openPartnerFit));
    document.querySelectorAll('[data-open-deal-risk]').forEach(b=>b.onclick=()=>openDealRiskDrilldown(b.dataset.openDealRisk));
    document.querySelectorAll('[data-open-operation-gate]').forEach(b=>b.onclick=()=>openOperationGateDrilldown(b.dataset.openOperationGate));
    document.querySelectorAll('[data-open-publisher]').forEach(b=>b.onclick=()=>openPublisher(b.dataset.openPublisher));
    document.querySelectorAll('[data-open-game]').forEach(b=>b.onclick=()=>openGame(b.dataset.openGame));
    document.querySelectorAll('[data-open-sourcing]').forEach(b=>b.onclick=()=>openSourcing(b.dataset.openSourcing));
    document.querySelectorAll('[data-open-project]').forEach(b=>b.onclick=()=>openProject(b.dataset.openProject));
  }

  function modal(title,body,onSave,{wide=false,saveText='Save'}={}){
    const readOnly=window.SAVA_SUPABASE?.configured && !window.SAVA_SUPABASE.canEdit();
    modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal ${wide?'wide':''}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close>×</button></div><div class="modal-body">${readOnly?'<div class="notice source-edit-note"><b>Chế độ Viewer · chỉ xem.</b> Tài khoản này không thể sửa ở bất kỳ module nào. Muốn chỉnh dữ liệu cần quyền <b>Editor</b> hoặc <b>Admin</b>.</div>':''}${body}</div><div class="modal-foot"><button class="ghost" data-close>${readOnly?'Close':'Cancel'}</button>${readOnly?'':`<button class="primary" data-save>${esc(saveText)}</button>`}</div></div></div>`;
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
    const linkedDeal=partnerPrimaryDeal(p.id),commercial=dealCommercialSnapshot(linkedDeal);
    const shareS=commercial?.sava??profile(p,'Rev Share SAVA (%)'),shareP=commercial?.partner??profile(p,'Rev Share Partner (%)');
    const dealModelValue=commercial?.dealModel||profile(p,'Mô hình hợp tác tài chính')||'';
    const partnerCommitValue=commercial?.partnerInvestment||profile(p,'Mức cam kết đầu tư cho Partner')||'';
    const uaCommitValue=commercial?.uaCommitment||profile(p,'Cam kết UA / Marketing Spend')||'';
    const uaCondValue=commercial?.uaCondition||profile(p,'Điều kiện cam kết UA')||'';
    const commercialSummary=`${esc(dealModelValue||'Chưa có')} · SAVA ${num(shareS)!==null?pct(shareS,0):'—'} / Đối tác ${num(shareP)!==null?pct(shareP,0):'—'}`;
    const commercialSource=linkedDeal?`<div class="notice source-edit-note"><b>🔒 Phần này chỉ được chỉnh tại Deal Making · ${esc(linkedDeal.sourceDealId||linkedDeal.id)}</b>. Các ô màu xám bên dưới chỉ hiển thị dữ liệu dùng chung để tránh nhập trùng. ${commercial?.rsSource?`Revenue Share hiện lấy theo <b>${esc(commercial.rsSource)}</b>.`:''} <button type="button" class="ghost compact-btn" data-open-linked-deal="${esc(linkedDeal.id)}">Mở Deal để sửa</button></div>`:`<div class="notice">Partner này chưa có Deal liên kết. Có thể nhập term tạm thời tại đây; khi tạo Deal, <b>Deal Making</b> sẽ trở thành nơi duy nhất được sửa các term thương mại.</div>`;
    const body=`
      <div class="partner-exec-grid">
        <div class="exec-card"><span>Mức độ phù hợp</span><strong>${d.fit===null?'—':fmt(d.fit,1)}/100</strong><small>${esc(d.classification)}</small></div>
        <div class="exec-card"><span>Tiềm lực sản xuất</span><strong>${prod.overall===null?'—':fmt(prod.overall,1)}/100</strong><small>${esc(prod.maturity)}</small></div>
        <div class="exec-card"><span>Kết luận hiện tại</span><strong class="exec-status">${esc(d.final)}</strong><small>Hard Gate: ${esc(d.hard)}</small></div>
        <div class="exec-card commercial-card"><span>Hợp tác hiện tại</span><strong class="exec-status">${commercialSummary}</strong><small>UA: ${esc(uaCommitValue||'Chưa có cam kết')}</small></div>
      </div>
      <div class="section-title">Thông tin đối tác</div><div class="form-grid three-cols">
      ${fText('id','Partner ID',p.id)}${fText('name','Partner / Studio',profile(p,'Tên Partner / Studio'))}${fText('country','Quốc gia',profile(p,'Quốc gia'))}${fText('contact','Founder / Đầu mối chính',profile(p,'Founder / Đầu mối chính'))}${fText('teamSize','Quy mô team',profile(p,'Quy mô team'))}${fText('genres','Thể loại chính',profile(p,'Genre chính'))}${fText('platform','Nền tảng',profile(p,'Platform chính'))}${fText('projects','Dự án đang đánh giá',profile(p,'Dự án đang đánh giá'))}${fText('source','Nguồn tiếp cận',profile(p,'Nguồn'))}${fText('owner','Phụ trách Publishing',profile(p,'Owner Publishing'))}${fText('status','Giai đoạn / trạng thái',profile(p,'Trạng thái'))}${fArea('profileNotes','Ghi chú',profile(p,'Ghi chú'))}</div>
      <div class="section-title">Thông tin hợp tác & UA</div>${commercialSource}<div class="form-grid three-cols commercial-fields">
      ${fText('dealModel','Mô hình hợp tác',dealModelValue)}${fText('partnerCommit','Phí đối tác',partnerCommitValue)}${fText('uaCommit','Cam kết UA',uaCommitValue)}${fText('savaShare','Tỷ lệ SAVA (0-1)',shareS,'','number')}${fText('partnerShare','Tỷ lệ đối tác (0-1)',shareP,'','number')}${fArea('uaCond','Điều kiện UA',uaCondValue)}</div>
      <div class="section-title">Tiềm lực đội sản xuất</div><div class="notice production-helper">Điểm tổng là trung bình 6 nhóm năng lực. Dùng thang <b>0–100</b>; hệ thống vẫn tự chuyển đổi dữ liệu cũ 1–5 sang /100.</div><div class="form-grid three-cols">
      ${fText('prod_teamCapacity','Năng lực team /100',prod.dims.teamCapacity??'','','number')}${fText('prod_productQuality','Chất lượng sản phẩm /100',prod.dims.productQuality??'','','number')}${fText('prod_productionSpeed','Tốc độ sản xuất /100',prod.dims.productionSpeed??'','','number')}${fText('prod_technical','Năng lực kỹ thuật /100',prod.dims.technical??'','','number')}${fText('prod_liveOps','Khả năng LiveOps /100',prod.dims.liveOps??'','','number')}${fText('prod_scalability','Khả năng mở rộng /100',prod.dims.scalability??'','','number')}${fSelect('prod_maturity','Mức trưởng thành sản xuất',prod.maturity,['Chưa đánh giá','Prototype','Full Game','LiveOps','Scale-ready'])}${fArea('prod_notes','Nhận định tiềm lực sản xuất',prod.notes||'')}</div>
      <div class="section-title">Hard Gate</div><div class="form-grid three-cols">${[['legalContract','Pháp lý / hợp đồng'],['ipSourceRights','Quyền IP / source code'],['publisherConflict','Xung đột Publisher'],['dataTransparency','Minh bạch dữ liệu'],['teamContinuity','Tính ổn định của team'],['compliance','Tuân thủ']].map(([k,l])=>fSelect(`gate_${k}`,l,p.hardGate?.[k]||'Chờ xác minh',GATE_STATUS)).join('')}${fArea('gateEvidence','Bằng chứng / ghi chú Hard Gate',p.hardGate?.evidence||'')}${fText('gateOwner','Người phụ trách kiểm tra',p.hardGate?.owner||'')}${fText('gateDue','Hạn hoàn tất',p.hardGate?.dueDate||'','','date')}</div>
      <div class="section-title">Bằng chứng & trạng thái xác minh</div><div class="form-grid">${evidenceFields.map(([k,l])=>`${fArea(`ev_${k}_text`,l,p.evidence?.[k]?.text||'')}${fSelect(`ev_${k}_status`,`${l} · trạng thái`,p.evidence?.[k]?.status||'',EVIDENCE_STATUS)}`).join('')}${fText('evSource','Nguồn / cập nhật gần nhất',p.evidence?.sourceUpdated||'','full')}${fArea('evFollow','Việc cần bổ sung',p.evidence?.followUp||'')}</div>
      <div class="section-title">Điểm đánh giá /100</div><div class="form-grid three-cols">${scoreFields.map(([k,l])=>fText(`score_${k}`,`${l} /100`,scoreVal(k),'','number')).join('')}</div>
      ${partnerRiskSectionHtml(p.id,isNew)}
      <div class="section-title-row"><div class="section-title">Quyết định</div><button type="button" class="ghost decision-generate" data-generate-partner-decision>✨ Tạo quyết định tự động</button></div><div class="notice decision-helper">Tạo từ <b>Hard Gate + Evidence tối thiểu + mức độ phù hợp + Risk Register + tiềm lực sản xuất</b>. Có thể sửa tay trước khi lưu.</div><div class="form-grid decision-grid">${fText('decisionReco','Khuyến nghị cuối',p.decision?.recommendation||'')}${fText('decisionStatus','Trạng thái quyết định',p.decision?.status||'')}${fArea('strengths','Điểm mạnh',p.decision?.strengths||'')}${fArea('risks','Rủi ro chính',p.decision?.risks||'')}${fArea('conditions','Điều kiện trước bước tiếp theo',p.decision?.conditions||'')}${fArea('nextAction','Hành động tiếp theo',p.decision?.nextAction||'')}${fText('decisionOwner','Người ra quyết định',p.decision?.owner||'')}${fText('decisionDate','Ngày quyết định',p.decision?.decisionDate?.slice?.(0,10)||p.decision?.decisionDate||'','','date')}${fArea('decisionNotes','Ghi chú quyết định',p.decision?.notes||'')}</div>`;
    modal(isNew?'Thêm Partner':`${p.id} · ${profile(p,'Tên Partner / Studio')||'Partner'}`,body,(root)=>{
      const oldId=p.id; p.id=formVal(root,'id')||oldId;
      const map={'Tên Partner / Studio':'name','Quốc gia':'country','Founder / Đầu mối chính':'contact','Quy mô team':'teamSize','Genre chính':'genres','Platform chính':'platform','Dự án đang đánh giá':'projects','Nguồn':'source','Owner Publishing':'owner','Trạng thái':'status','Ghi chú':'profileNotes'};
      p.profile=p.profile||{}; Object.entries(map).forEach(([k,n])=>p.profile[k]=formVal(root,n)||null); p.profile['Partner ID']=p.id;
      if(!linkedDeal){p.profile['Mô hình hợp tác tài chính']=formVal(root,'dealModel')||null;p.profile['Mức cam kết đầu tư cho Partner']=formVal(root,'partnerCommit')||null;p.profile['Cam kết UA / Marketing Spend']=formVal(root,'uaCommit')||null;p.profile['Điều kiện cam kết UA']=formVal(root,'uaCond')||null;p.profile['Rev Share SAVA (%)']=formNum(root,'savaShare');p.profile['Rev Share Partner (%)']=formNum(root,'partnerShare');}
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
    if(linkedDeal&&partnerModal){
      ['dealModel','partnerCommit','uaCommit','savaShare','partnerShare','uaCond'].forEach(name=>{const el=partnerModal.querySelector(`[name="${name}"]`);if(el){el.disabled=true;el.title=`Chỉ sửa tại Deal Making · ${linkedDeal.sourceDealId||linkedDeal.id}`;const field=el.closest('.field');if(field&&!field.querySelector('.field-source-note'))field.insertAdjacentHTML('beforeend',`<div class="field-source-note">🔒 Chỉ sửa tại <b>Deal Making · ${esc(linkedDeal.sourceDealId||linkedDeal.id)}</b></div>`);}});
      const openDealBtn=partnerModal.querySelector('[data-open-linked-deal]');
      if(openDealBtn)openDealBtn.onclick=()=>{modalRoot.innerHTML='';openDeal(linkedDeal.id);};
    }
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

  function dealNegotiationRowHtml(n={},idx=0,derived=null){const term=n.term||'';return `<tr data-neg-row><td>${fSelect(`neg_term_${idx}`,'',term,DEAL_TERMS).replace('<label></label>','')}</td><td><div class="deal-auto-logic" data-neg-logic>${esc(dealTermDefaultLogic(term,derived))||'—'}</div></td><td>${fText(`neg_market_${idx}`,'',n.marketRef||'').replace('<label></label>','')}</td><td>${fText(`neg_target_${idx}`,'',n.target??'').replace('<label></label>','')}</td><td>${fText(`neg_accept_${idx}`,'',n.acceptable??'').replace('<label></label>','')}</td><td>${fText(`neg_stop_${idx}`,'',n.stop??'').replace('<label></label>','')}</td><td>${fText(`neg_ask_${idx}`,'',n.partnerAsk??'').replace('<label></label>','')}</td><td>${fText(`neg_final_${idx}`,'',n.final??'').replace('<label></label>','')}</td><td>${fText(`neg_trade_${idx}`,'',n.tradeoff||'').replace('<label></label>','')}</td><td><span class="badge" data-neg-check>—</span></td><td>${fText(`neg_notes_${idx}`,'',n.notes||'').replace('<label></label>','')}</td><td><button type="button" class="ghost compact-btn" data-remove-neg>×</button></td></tr>`;}
  function dealMilestoneRowHtml(m={},idx=0){return `<tr data-mile-row><td>${fSelect(`mile_type_${idx}`,'',m.type||'Mốc vốn / KPI',DEAL_MILESTONE_TYPES).replace('<label></label>','')}</td><td>${fText(`mile_name_${idx}`,'',m.milestone||'').replace('<label></label>','')}</td><td>${fText(`mile_cond_${idx}`,'',m.condition||'').replace('<label></label>','')}</td><td>${fText(`mile_cap_${idx}`,'',m.capitalUnlocked??'','','number').replace('<label></label>','')}</td><td>${fText(`mile_duty_${idx}`,'',m.partnerDuty||'').replace('<label></label>','')}</td><td>${fText(`mile_fail_${idx}`,'',m.ifFail||'').replace('<label></label>','')}</td><td>${fText(`mile_right_${idx}`,'',m.savaRight||'').replace('<label></label>','')}</td><td>${fText(`mile_owner_${idx}`,'',m.owner||'').replace('<label></label>','')}</td><td>${fSelect(`mile_status_${idx}`,'',m.status||'Chưa bắt đầu',DEAL_MILESTONE_STATUS).replace('<label></label>','')}</td><td>${fText(`mile_notes_${idx}`,'',m.notes||'').replace('<label></label>','')}</td><td><button type="button" class="ghost compact-btn" data-remove-mile>×</button></td></tr>`;}
  function collectDealDraft(root,base){
    const d=dealInitialDefaults(base);d.id=formVal(root,'id')||d.id;d.sourceDealId=formVal(root,'sourceDealId')||d.sourceDealId;d.partnerId=formVal(root,'partnerId');d.gameId=formVal(root,'gameId');d.gameName=formVal(root,'gameName');d.status=formVal(root,'status');d.stage=formVal(root,'stage');d.gameEvidence=formNum(root,'gameEvidence');d.competitionPressure=formNum(root,'competition');d.riskTolerance=formNum(root,'riskTolerance');d.strategicOverride=formNum(root,'strategicOverride');d.bargainingPower=formNum(root,'bargaining');d.protection=formNum(root,'protection');d.forecastNetRevenue12m=formNum(root,'forecast');d.modelSavaRs=ratio(formNum(root,'modelRs'));d.directPublishingCost=formNum(root,'directCost');d.internalBudgetCap=formNum(root,'budgetCap');d.partnerCapitalAsk=formNum(root,'partnerAsk');d.supportLevel=formVal(root,'support');d.uaBudgetMonthly=formNum(root,'uaBudget');d.dealModel=formVal(root,'dealModel');d.partnerInvestment=formVal(root,'partnerInvestment');d.uaCommitment=formVal(root,'uaCommitment');d.uaCondition=formVal(root,'uaCondition');d.savaShare=ratio(formNum(root,'savaShare'));d.partnerShare=ratio(formNum(root,'partnerShare'));d.owner=formVal(root,'owner');d.notes=formVal(root,'notes');
    d.negotiations=[...root.querySelectorAll('[data-neg-row]')].map((tr,i)=>({term:formVal(tr,`neg_term_${i}`),marketRef:formVal(tr,`neg_market_${i}`),target:formVal(tr,`neg_target_${i}`),acceptable:formVal(tr,`neg_accept_${i}`),stop:formVal(tr,`neg_stop_${i}`),partnerAsk:formVal(tr,`neg_ask_${i}`),final:formVal(tr,`neg_final_${i}`),tradeoff:formVal(tr,`neg_trade_${i}`),notes:formVal(tr,`neg_notes_${i}`)})).filter(x=>x.term||x.marketRef||x.target||x.partnerAsk||x.final);
    d.milestoneRows=[...root.querySelectorAll('[data-mile-row]')].map((tr,i)=>({type:formVal(tr,`mile_type_${i}`),milestone:formVal(tr,`mile_name_${i}`),condition:formVal(tr,`mile_cond_${i}`),capitalUnlocked:formNum(tr,`mile_cap_${i}`),partnerDuty:formVal(tr,`mile_duty_${i}`),ifFail:formVal(tr,`mile_fail_${i}`),savaRight:formVal(tr,`mile_right_${i}`),owner:formVal(tr,`mile_owner_${i}`),status:formVal(tr,`mile_status_${i}`),notes:formVal(tr,`mile_notes_${i}`)})).filter(x=>x.milestone||x.condition||x.capitalUnlocked!==null);
    d.approval={...(d.approval||{}),dataCheck:formVal(root,'ap_data'),ipCheck:formVal(root,'ap_ip'),exitCheck:formVal(root,'ap_exit'),decision:formVal(root,'ap_decision'),conditions:formVal(root,'ap_conditions'),openRisks:formVal(root,'ap_risks'),approver:formVal(root,'ap_approver'),decisionDate:formVal(root,'ap_date'),notes:formVal(root,'ap_notes')};
    return d;
  }
  function updateDealLive(root,base){
    const d=collectDealDraft(root,base),x=dealDerived(d),rsDisplay=dealDisplayRs(d,x);
    const decisionDisplay=dealDisplayDecision(d,x),nextDisplay=dealDisplayNextAction(d,x);
    const box=root.querySelector('[data-deal-live]');
    if(box)box.innerHTML=`<div class="deal-exec-card"><span>Mức sẵn sàng</span>${readinessScoreBar(x.readiness)}</div><div class="deal-exec-card"><span>Rủi ro Deal</span>${riskScoreBar(x.riskScore)}</div><div class="deal-exec-card"><span>RS</span><strong>${x.rsFloor===null?'—':pct(x.rsFloor,0)} → ${rsDisplay.value===null?'—':pct(rsDisplay.value,0)} → ${x.rsTarget===null?'—':pct(x.rsTarget,0)}</strong><small>Ngưỡng → ${esc(rsDisplay.label)} → mục tiêu</small></div><div class="deal-exec-card"><span>Quyết định</span><strong class="exec-status">${esc(decisionDisplay)}</strong><small>${esc(nextDisplay)}</small></div>`;
    root.querySelectorAll('[data-neg-row]').forEach((tr,i)=>{const term=formVal(tr,`neg_term_${i}`),final=formVal(tr,`neg_final_${i}`),logic=tr.querySelector('[data-neg-logic]'),el=tr.querySelector('[data-neg-check]');if(logic)logic.textContent=dealTermDefaultLogic(term,x)||'—';if(el)el.outerHTML=badge(dealTermAutoCheck(term,final,x)).replace('<span','<span data-neg-check');});
    const extra=root.querySelector('[data-deal-derived]');
    if(extra)extra.innerHTML=`<div><span>Hard Gate</span><b>${esc(x.hard)}</b></div><div><span>Hướng Deal</span><b>${esc(x.direction||'—')}</b></div><div><span>Nấc UA</span><b>${esc(x.uaTier||'—')}</b></div><div><span>Vốn tối đa</span><b>${x.maxInvestment===null?'—':money(x.maxInvestment)}</b></div><div><span>Cam kết ban đầu</span><b>${x.initialCommit===null?'—':money(x.initialCommit)}</b></div><div><span>Kiểm soát RS</span><b>${esc(rsDisplay.control)}</b></div>`;
  }
  function openDeal(id){
    let original=byId(db.deals,id);const isNew=!original;if(!original)original={id:`DEAL-${String(db.deals.length+1).padStart(3,'0')}`,partnerId:db.partners[0]?.id||'',gameId:'',status:'Đang xác định phạm vi'};const d=dealInitialDefaults(original),x=dealDerived(d);const negotiationRows=d.negotiations.length?d.negotiations:dealDefaultNegotiations();const milestones=d.milestoneRows.length?d.milestoneRows:dealDefaultMilestones();const approval=d.approval||{};
    const rsDisplay=dealDisplayRs(d,x),decisionDisplay=dealDisplayDecision(d,x),nextDisplay=dealDisplayNextAction(d,x);
    const body=`<div class="deal-exec-grid" data-deal-live><div class="deal-exec-card"><span>Mức sẵn sàng</span>${readinessScoreBar(x.readiness)}</div><div class="deal-exec-card"><span>Rủi ro Deal</span>${riskScoreBar(x.riskScore)}</div><div class="deal-exec-card"><span>RS</span><strong>${x.rsFloor===null?'—':pct(x.rsFloor,0)} → ${rsDisplay.value===null?'—':pct(rsDisplay.value,0)} → ${x.rsTarget===null?'—':pct(x.rsTarget,0)}</strong><small>Ngưỡng → ${esc(rsDisplay.label)} → mục tiêu</small></div><div class="deal-exec-card"><span>Quyết định</span><strong class="exec-status">${esc(decisionDisplay)}</strong><small>${esc(nextDisplay)}</small></div></div>
      <div class="deal-derived-strip" data-deal-derived><div><span>Hard Gate</span><b>${esc(x.hard)}</b></div><div><span>Hướng Deal</span><b>${esc(x.direction||'—')}</b></div><div><span>Nấc UA</span><b>${esc(x.uaTier||'—')}</b></div><div><span>Vốn tối đa</span><b>${x.maxInvestment===null?'—':money(x.maxInvestment)}</b></div><div><span>Cam kết ban đầu</span><b>${x.initialCommit===null?'—':money(x.initialCommit)}</b></div><div><span>Kiểm soát RS</span><b>${esc(rsDisplay.control)}</b></div></div><div class="source-edit-note compact"><b>ℹ️ Các chỉ số phía trên là tự tính, không sửa trực tiếp.</b> Hard Gate đọc từ <b>Partner Selection</b>; các chỉ số Deal còn lại được tính lại từ dữ liệu bạn nhập trong <b>Deal Making</b>.</div>
      <details class="deal-section" open><summary>1. Dữ liệu Deal & Economics</summary><div class="deal-section-body">${dealDataGuideHtml()}<div class="form-grid three-cols">${fText('id','ID trên hệ thống',d.id)}${fText('sourceDealId','Mã Deal nguồn',d.sourceDealId||'')}${fSelect('partnerId','Partner',d.partnerId,db.partners.map(p=>p.id))}${fSelect('gameId','Game đã link',d.gameId||'',['',...db.games.map(g=>g.id)])}${fText('gameName','Game sử dụng',d.gameName||dealGameName(d))}${fSelect('status','Trạng thái Deal',d.status||'',DEAL_STATUS)}${fSelect('stage','Giai đoạn Game',d.stage||'',DEAL_STAGES)}${fText('gameEvidence','Bằng chứng Game /5',d.gameEvidence??'','','number')}${fText('competition','Áp lực cạnh tranh Deal /5',d.competitionPressure??'','','number')}${fText('riskTolerance','Mức chịu rủi ro SAVA /5',d.riskTolerance??'','','number')}${fText('strategicOverride','Điều chỉnh giá trị chiến lược /5',d.strategicOverride??'','','number')}${fText('bargaining','Lợi thế đàm phán SAVA /5',d.bargainingPower??'','','number')}${fText('protection','Mức bảo vệ /5',d.protection??'','','number')}${fText('forecast','Doanh thu thuần dự báo 12T (USD)',d.forecastNetRevenue12m??'','','number')}${fText('modelRs','SAVA RS dùng cho mô hình (0-1)',d.modelSavaRs??d.savaShare??'','','number')}${fText('directCost','Chi phí vận hành trực tiếp (USD)',d.directPublishingCost??'','','number')}${fText('budgetCap','Giới hạn ngân sách nội bộ (USD)',d.internalBudgetCap??'','','number')}${fText('partnerAsk','Vốn Partner đề xuất (USD)',d.partnerCapitalAsk??'','','number')}${fSelect('support','Mức hỗ trợ SAVA',d.supportLevel||'',DEAL_SUPPORT)}${fText('uaBudget','Ngân sách UA cam kết / tháng (USD)',d.uaBudgetMonthly??'','','number')}</div>
      <div class="section-title">Điều khoản thương mại hiện tại</div><div class="form-grid three-cols">${fText('dealModel','Mô hình hợp tác',d.dealModel||'')}${fText('partnerInvestment','Phí / hỗ trợ Partner hiện tại',d.partnerInvestment||'')}${fText('uaCommitment','Cam kết UA hiện tại',d.uaCommitment||'')}${fArea('uaCondition','Điều kiện UA',d.uaCondition||'','full')}${fText('savaShare','SAVA / Revenue Share (0-1)',d.savaShare??'','','number')}${fText('partnerShare','Partner / Revenue Share (0-1)',d.partnerShare??'','','number')}${fText('owner','Owner',d.owner||'')}${fArea('notes','Ghi chú',d.notes||'','full')}</div></div></details>
      <details class="deal-section"><summary>2. Đàm phán · Mục tiêu / Chấp nhận / Ngưỡng dừng</summary><div class="deal-section-body">${dealNegotiationGuideHtml()}<div class="notice">1 dòng = 1 điều khoản. Cột <b>Logic / Mặc định SAVA</b> tự sinh theo file nguồn. Không nhượng bộ miễn phí: nếu SAVA nhượng RS/MG/UA thì ghi rõ giá trị đổi lại.</div><div class="table-wrap deal-edit-table"><table class="table"><thead><tr><th>Điều khoản</th><th>Logic / Mặc định SAVA</th><th>Tham chiếu thị trường</th><th>Mục tiêu</th><th>Mức chấp nhận</th><th>Ngưỡng dừng</th><th>Yêu cầu Partner</th><th>Kết quả cuối</th><th>Giá trị đổi lại</th><th>Kiểm tra</th><th>Ghi chú</th><th></th></tr></thead><tbody data-neg-body>${negotiationRows.map((n,i)=>dealNegotiationRowHtml(n,i,x)).join('')}</tbody></table></div><button type="button" class="ghost" data-add-neg>+ Điều khoản</button></div></details>
      <details class="deal-section"><summary>3. Mốc / KPI / Exit</summary><div class="deal-section-body">${dealMilestoneGuideHtml()}<div class="notice">Mở vốn theo bằng chứng. Nếu mốc không đạt, giữ tranche tiếp theo / giảm UA / dừng theo điều kiện đã chốt.</div><div class="table-wrap deal-edit-table"><table class="table"><thead><tr><th>Loại</th><th>Mốc / Điều kiện</th><th>KPI / Điều kiện đạt</th><th>Vốn được mở</th><th>Nghĩa vụ Partner</th><th>Nếu không đạt</th><th>Quyền SAVA / Xử lý</th><th>Người phụ trách</th><th>Trạng thái</th><th>Ghi chú</th><th></th></tr></thead><tbody data-mile-body>${milestones.map((m,i)=>dealMilestoneRowHtml(m,i)).join('')}</tbody></table></div><button type="button" class="ghost" data-add-mile>+ Mốc</button></div></details>
      <details class="deal-section"><summary>4. Phê duyệt cuối</summary><div class="deal-section-body">${dealApprovalGuideHtml()}<div class="form-grid three-cols">${fSelect('ap_data','Data access',approval.dataCheck||'',DEAL_CORE_CHECK)}${fSelect('ap_ip','IP / pháp lý',approval.ipCheck||'',DEAL_CORE_CHECK)}${fSelect('ap_exit','Exit protection',approval.exitCheck||'',DEAL_CORE_CHECK)}${fSelect('ap_decision','Quyết định phê duyệt',approval.decision||'',DEAL_APPROVAL_DECISIONS)}${fText('ap_approver','Người phê duyệt',approval.approver||'')}${fText('ap_date','Ngày quyết định',approval.decisionDate||'','','date')}${fArea('ap_conditions','Điều kiện trước khi ký',approval.conditions||'','full')}${fArea('ap_risks','Rủi ro / điểm chưa chốt',approval.openRisks||'','full')}${fArea('ap_notes','Ghi chú phê duyệt',approval.notes||'','full')}</div><div class="notice warn" style="margin-top:12px">RS cuối được lấy từ dòng <b>Rev Share SAVA</b> trong phần Đàm phán. Trước khi ký, Data + IP + Exit phải được kiểm tra rõ.</div></div></details>`;
    modal(isNew?'Thêm Deal':`${d.sourceDealId||d.id} · ${profile(dealPartner(d),'Tên Partner / Studio')||d.partnerId}`,body,(root)=>{const saved=collectDealDraft(root,d);const old=original.id;const der=dealDerived(saved);saved.derived={riskScore:der.riskScore,riskGroup:der.riskBand.label,readiness:der.readiness,direction:der.direction,rsFloor:der.rsFloor,rsTarget:der.rsTarget,rsControl:der.rsControl,uaTier:der.uaTier,maxInvestment:der.maxInvestment,initialCommitment:der.initialCommit,capitalCheck:der.capitalCheck,recommendation:der.recommendation,decision:der.decision,nextAction:der.nextAction,finalRs:der.finalRs,finalRsControl:der.finalRsControl,coreStatus:der.coreStatus};if(isNew)db.deals.push(saved);else{const ix=db.deals.findIndex(z=>z.id===old);if(ix>=0)db.deals[ix]=saved;}modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} deal ${saved.id}`);},{wide:true,saveText:'Lưu & tính lại'});
    const root=modalRoot.querySelector('.modal');if(!root)return;let negIndex=negotiationRows.length,mileIndex=milestones.length;
    root.querySelector('[data-add-neg]').onclick=()=>{root.querySelector('[data-neg-body]').insertAdjacentHTML('beforeend',dealNegotiationRowHtml({},negIndex++,dealDerived(collectDealDraft(root,d))));renumberDealRows(root);bindDealRowEvents(root,d);updateDealLive(root,d);};
    root.querySelector('[data-add-mile]').onclick=()=>{root.querySelector('[data-mile-body]').insertAdjacentHTML('beforeend',dealMilestoneRowHtml({},mileIndex++));renumberDealRows(root);bindDealRowEvents(root,d);};
    function bindDealRowEvents(rt,base){rt.querySelectorAll('[data-remove-neg]').forEach(b=>b.onclick=()=>{b.closest('[data-neg-row]').remove();renumberDealRows(rt);updateDealLive(rt,base);});rt.querySelectorAll('[data-remove-mile]').forEach(b=>b.onclick=()=>{b.closest('[data-mile-row]').remove();renumberDealRows(rt);updateDealLive(rt,base);});rt.querySelectorAll('input,select,textarea').forEach(el=>{el.oninput=()=>updateDealLive(rt,base);el.onchange=()=>updateDealLive(rt,base);});}
    bindDealRowEvents(root,d);updateDealLive(root,d);
  }
  function renumberDealRows(root){root.querySelectorAll('[data-neg-row]').forEach((tr,i)=>{tr.querySelectorAll('[name]').forEach(el=>el.name=el.name.replace(/neg_([a-z]+)_\d+/,(_,a)=>`neg_${a}_${i}`));});root.querySelectorAll('[data-mile-row]').forEach((tr,i)=>{tr.querySelectorAll('[name]').forEach(el=>el.name=el.name.replace(/mile_([a-z]+)_\d+/,(_,a)=>`mile_${a}_${i}`));});}
  function openDealRules(){const r=dealRules();const body=`<div class="notice">Các tham số dưới đây lấy từ tab <b>01_LOGIC_DEAL_SAVA</b>. Chỉ Admin/Editor nên chỉnh khi SAVA thay đổi policy.</div><div class="section-title">Revenue Share</div><div class="form-grid three-cols">${fText('base','Trước Soft Launch · Không hỗ trợ',r.rsBaseFloor,'','number')}${fText('sl','Soft Launch+ · Không hỗ trợ',r.rsNoSupportSoftLaunchFloor,'','number')}${fText('support','Deal có hỗ trợ · Ngưỡng',r.rsSupportFloor,'','number')}${fText('material','Hỗ trợ đáng kể · Mục tiêu',r.rsMaterialTarget,'','number')}</div><div class="section-title">Nấc ngân sách UA</div><div class="form-grid three-cols">${fText('ua1','T1 Test tối đa (USD/tháng)',r.uaTestMax,'','number')}${fText('ua2','T2 Tăng trưởng tối đa',r.uaGrowthMax,'','number')}${fText('ua3','T3 Scale tối đa',r.uaScaleMax,'','number')}${fText('rs1','T1 mục tiêu RS',r.uaT1RsTarget,'','number')}${fText('rs2','T2 mục tiêu RS',r.uaT2RsTarget,'','number')}${fText('rs3','T3/T4 mục tiêu RS',r.uaT3RsTarget,'','number')}</div><div class="section-title">Risk / Bảo vệ</div><div class="form-grid">${fText('riskHigh','Mức chịu rủi ro cao (score)',r.riskHighScore,'','number')}${fText('protect','Mức bảo vệ tối thiểu khi risk cao',r.protectionMinWhenHigh,'','number')}</div>`;modal('Logic & tham số Deal SAVA',body,(root)=>{db.playbook=db.playbook||{};db.playbook.dealMaking=db.playbook.dealMaking||{};db.playbook.dealMaking.params={...(db.playbook.dealMaking.params||{}),rsBaseFloor:ratio(formNum(root,'base')),rsNoSupportSoftLaunchFloor:ratio(formNum(root,'sl')),rsSupportFloor:ratio(formNum(root,'support')),rsMaterialTarget:ratio(formNum(root,'material')),uaTestMax:formNum(root,'ua1'),uaGrowthMax:formNum(root,'ua2'),uaScaleMax:formNum(root,'ua3'),uaT1RsTarget:ratio(formNum(root,'rs1')),uaT2RsTarget:ratio(formNum(root,'rs2')),uaT3RsTarget:ratio(formNum(root,'rs3')),riskHighScore:formNum(root,'riskHigh'),protectionMinWhenHigh:formNum(root,'protect')};modalRoot.innerHTML='';persist('Updated Deal Making parameters');},{wide:true,saveText:'Lưu tham số'});}

  function marketEditGuideHtml(x){
    const currentTrend=x?.trend?.label||'Chưa đủ dữ liệu';
    const currentMon=x?.monetization===null||x?.monetization===undefined?'—':`${fmt(x.monetization,1)}/100 · ${marketBandLabel(x.monetization,'mon')}`;
    const currentRpd=x?.rpd===null||x?.rpd===undefined?'—':`$${fmt(x.rpd,2)}`;
    const currentDirection=x?.direction?.label||'—';
    const currentScore=x?.score===null||x?.score===undefined?'—':`${fmt(x.score,1)}/100`;
    const currentStrategic=x?.strategicFit===null||x?.strategicFit===undefined?'N/A':`${fmt(x.strategicFit,0)}/100 · ${x.strategicFitInfo?.level||''}`;
    const currentExecution=x?.executionFit===null||x?.executionFit===undefined?'Chưa đủ dữ liệu':`${fmt(x.executionFit,1)}/100 · ${x.executionFitInfo?.count||0} Game/Candidate`;
    return `<div class="market-edit-guide">
      <div class="market-guide-current"><div><span>Xu hướng 3M hiện tại</span><b>${esc(currentTrend)}</b></div><div><span>Khả năng kiếm tiền</span><b>${esc(currentMon)}</b><small>RPD ${esc(currentRpd)}</small></div><div><span>Sức hấp dẫn thị trường</span><b>${esc(currentScore)}</b></div><div><span>Phù hợp chiến lược</span><b>${esc(currentStrategic)}</b></div><div><span>Năng lực thực thi</span><b>${esc(currentExecution)}</b></div><div><span>Định hướng hiện tại</span><b>${esc(currentDirection)}</b></div></div>
      <details open><summary>Rule 1 · Xu hướng 3M được xác định như thế nào?</summary><div class="market-rule-body"><p>Xu hướng 3M <b>không lấy trung bình cộng</b> DL Growth và Revenue Growth. Hệ thống đọc hai tín hiệu song song để phân biệt tăng user, tăng doanh thu và các trường hợp trái chiều.</p><table class="market-rule-table"><thead><tr><th>DL Growth 3M</th><th>Revenue Growth 3M</th><th>Nhãn</th><th>Cách hiểu</th></tr></thead><tbody>
        <tr><td>≥ +50%</td><td>≥ +50%</td><td><b>Bứt phá</b></td><td>User và doanh thu cùng tăng rất mạnh.</td></tr>
        <tr><td>≥ +50%</td><td>≥ +50%</td><td><b>Tăng mạnh từ nền thấp</b></td><td>Cùng tăng mạnh nhưng quy mô hiện tại thuộc nhóm thấp; cần tránh hiệu ứng low-base.</td></tr>
        <tr><td>≥ +10%</td><td>≥ +10%</td><td><b>Tăng trưởng tốt</b></td><td>Tăng trưởng đồng thuận ở cả user và doanh thu.</td></tr>
        <tr><td>-10% → +10%</td><td>-10% → +10%</td><td><b>Ổn định</b></td><td>Market tương đối đi ngang.</td></tr>
        <tr><td>&gt; +10%</td><td>-10% → +10%</td><td><b>Mở rộng user</b></td><td>DL tăng nhưng Revenue chưa tăng tương ứng.</td></tr>
        <tr><td>-10% → +10%</td><td>&gt; +10%</td><td><b>Tăng trưởng doanh thu</b></td><td>User ổn định nhưng monetization/revenue tốt lên.</td></tr>
        <tr><td>&gt; +10%</td><td>&lt; -10%</td><td><b>User ↑ / Revenue ↓</b></td><td>Volume tăng nhưng giá trị kinh tế suy yếu; cần thận trọng.</td></tr>
        <tr><td>&lt; -10%</td><td>&gt; +10%</td><td><b>Revenue ↑ / User ↓</b></td><td>User thu hẹp nhưng monetization cải thiện.</td></tr>
        <tr><td>&lt; -10%</td><td>-10% → +10%</td><td><b>User suy giảm</b></td><td>DL giảm nhưng Revenue đang giữ tương đối.</td></tr>
        <tr><td>-10% → +10%</td><td>&lt; -10%</td><td><b>Doanh thu suy giảm</b></td><td>User giữ được nhưng doanh thu giảm.</td></tr>
        <tr><td>≤ -10%</td><td>≤ -10%</td><td><b>Suy giảm</b></td><td>Cả user và doanh thu cùng đi xuống.</td></tr>
        <tr><td>≤ -30%</td><td>≤ -30%</td><td><b>Suy giảm mạnh</b></td><td>Market co lại rõ ở cả hai chiều.</td></tr>
      </tbody></table><p class="small muted"><b>Nếu thiếu một Growth metric:</b> nhãn Xu hướng = “Chưa đủ dữ liệu”. Tuy nhiên Định hướng có thể vẫn xếp P2 để <b>kiểm chứng</b> nếu tín hiệu Growth còn lại ≥50%, Fit chiến lược ≥85, khả năng kiếm tiền và UA đều ≥60/100. Đây là case validation, không phải kết luận trend đầy đủ.</p></div></details>
      <details open><summary>Rule 2 · Khả năng kiếm tiền /100 được tính như thế nào?</summary><div class="market-rule-body"><p>Hệ thống dùng <b>RPD (Revenue per Download)</b> và xếp hạng tương đối so với các mechanic khác trong tập dữ liệu hiện tại. Đây là điểm percentile 0–100, không phải số USD và không phải % tăng trưởng.</p><div class="market-rule-bands"><span><b>≥80</b> Rất tốt</span><span><b>60–79.9</b> Tốt</span><span><b>40–59.9</b> Trung bình</span><span><b>&lt;40</b> Thấp</span></div></div></details>
      <details open><summary>Rule 3 · Hai loại “Fit SAVA” khác nhau ở đâu?</summary><div class="market-rule-body"><table class="market-rule-table"><thead><tr><th>Chỉ số</th><th>Nguồn sở hữu</th><th>Ý nghĩa</th><th>Cách tính</th></tr></thead><tbody>
        <tr><td><b>Phù hợp chiến lược /100</b></td><td>Sourcing · 07_Market_Intel_Ref</td><td>Mechanic/genre có nằm trong hướng SAVA muốn tập trung hay không.</td><td>Đúng trọng tâm = 100 · Liền kề = 60 · Ngoài trọng tâm = 20. Mapping tự động từ taxonomy mechanic.</td></tr>
        <tr><td><b>Năng lực thực thi /100</b></td><td>Game Selection</td><td>SAVA đã có evidence thực tế để publish dòng này tốt đến đâu.</td><td>Trung bình SAVA Publishing Fit của Game/Candidate cùng mechanic. Thiếu evidence = để trống, không quy thành 0.</td></tr>
      </tbody></table><p class="small muted">Hai điểm này <b>không cộng vào Sức hấp dẫn thị trường</b>. Chúng chỉ giúp quyết định SAVA nên hành động thế nào trên một market đã được đánh giá độc lập.</p></div></details>
      <details open><summary>Rule 4 · Định hướng P1 → P5 được quyết định như thế nào?</summary><div class="market-rule-body"><p><b>P1 → P5 là mức độ ưu tiên giảm dần.</b> “Bổ sung dữ liệu” nằm ngoài P1–P5.</p><table class="market-rule-table"><thead><tr><th>Điều kiện chính</th><th>Định hướng</th><th>Ý nghĩa</th></tr></thead><tbody>
        <tr><td>Market ≥75 + Bứt phá/Tăng trưởng tốt + Fit chiến lược ≥70</td><td><b>P1 · Ưu tiên chủ động</b></td><td>Chủ động tìm game/đối tác và fast-track opportunity phù hợp.</td></tr>
        <tr><td>Market ≥70 + trend tích cực + không ngoài trọng tâm</td><td><b>P2 · Ưu tiên kiểm chứng</b></td><td>Market đủ tốt để ưu tiên test nhưng chưa đủ P1.</td></tr>
        <tr><td>Market ≥65 + Fit chiến lược ≥85 + trend tích cực</td><td><b>P2 · Ưu tiên kiểm chứng</b></td><td>Tránh cliff effect 69.x/70 khi market đúng hướng SAVA.</td></tr>
        <tr><td>Market ≥60 + Fit chiến lược ≥85 + Năng lực thực thi ≥85 + tín hiệu tích cực</td><td><b>P2 · Ưu tiên kiểm chứng</b></td><td>Dùng lợi thế thực thi đã chứng minh để ưu tiên kiểm chứng tiếp.</td></tr>
        <tr><td>Market ≥60 + Fit chiến lược ≥85 + 1 Growth ≥50% (metric còn lại thiếu) + Monetization & UA ≥60</td><td><b>P2 · Ưu tiên kiểm chứng</b></td><td>Case như Tycoon: evidence chưa đủ để kết luận trend, nhưng đáng dành slot test để hoàn thiện bằng chứng.</td></tr>
        <tr><td>Xu hướng suy giảm + Khả năng kiếm tiền ≥60</td><td><b>P3 · Theo dõi chọn lọc</b></td><td>Chỉ xem opportunity chất lượng cao, không tìm đại trà.</td></tr>
        <tr><td>Có tín hiệu nhưng chưa đủ P1–P3</td><td><b>P4 · Theo dõi thêm</b></td><td>Tiếp tục cập nhật dữ liệu/evidence.</td></tr>
        <tr><td>Tín hiệu tổng thể yếu</td><td><b>P5 · Chưa ưu tiên</b></td><td>Chưa nên dành nhiều nguồn lực.</td></tr>
      </tbody></table><p class="small muted"><b>Sức hấp dẫn /100 là market-only:</b> Quy mô 30 · Đà tăng trưởng 25 · Khả năng kiếm tiền 20 · UA 15; tổng trọng số 90 và tự chuẩn hóa khi metric thiếu. Không cộng Fit SAVA vào Market Score.</p></div></details>
    </div>`;
  }

  function openMarket(id){
    const m=(db.market||[]).find(x=>x.Mechanic_ID===id);if(!m)return;
    const currentInsight=marketAnalytics(db.market||[]).find(x=>x.m.Mechanic_ID===id);
    const strategicInfo=mechanicStrategicFit(m),executionInfo=mechanicExecutionFit(m.Mechanic);
    const body=`<div class="notice"><b>Hướng dẫn BD:</b> chỉ nhập/cập nhật benchmark thị trường và ghi chú. <b>Sức hấp dẫn, Xu hướng 3M, Khả năng kiếm tiền, Phù hợp chiến lược, Năng lực thực thi và Định hướng đều tự tính/tự lấy từ module sở hữu.</b></div>${marketEditGuideHtml(currentInsight)}<div class="section-title">Dữ liệu dùng chung từ Sourcing</div><div class="source-edit-note compact"><b>🔒 Chỉ đọc tại Market Intelligence.</b> Phù hợp chiến lược lấy từ <b>Sourcing · 07_Market_Intel_Ref</b>; muốn thay đổi phải cập nhật mapping chiến lược ở nguồn Sourcing, không sửa tại đây.</div>${mechanicStrategicFitHtml(strategicInfo)}<div class="section-title">Dữ liệu dùng chung từ Game Selection</div><div class="source-edit-note compact"><b>🔒 Chỉ đọc tại Market Intelligence.</b> Năng lực thực thi lấy từ <b>Game Selection</b>; muốn thay đổi cần cập nhật SAVA Publishing Fit của Game/Candidate tương ứng.</div>${mechanicExecutionFitHtml(executionInfo)}<div class="section-title">Dữ liệu thị trường</div><div class="form-grid three-cols">${fText('name','Mechanic',m.Mechanic)}${fText('geo','Geography',m.Geography)}${fText('platform','Platform',m.Platform)}${fText('dl30','Downloads 30d',m.Downloads_30d??'','','number')}${fText('dl90','Downloads 90d',m.Downloads_90d??'','','number')}${fText('dl12','Downloads 12m',m.Downloads_12m??'','','number')}${fText('rev30','Revenue 30d USD',m.Revenue_30d_USD??'','','number')}${fText('rev90','Revenue 90d USD',m.Revenue_90d_USD??'','','number')}${fText('rev12','Revenue 12m USD',m.Revenue_12m_USD??'','','number')}${fText('dlg3','Tăng trưởng DL 3M (decimal)',m.DL_Growth_3m??'','','number')}${fText('revg3','Tăng trưởng Revenue 3M (decimal)',m.Rev_Growth_3m??'','','number')}${fText('rpd','RPD (Revenue / Download)',m.Revenue_per_Download_SAME_COHORT??'','','number')}${fText('cpi','CPI median',m.UA_Benchmark?.CPI_Median??'','','number')}</div><div class="section-title">Ghi chú định hướng</div><div class="form-grid">${fArea('savaNote','Ghi chú / bối cảnh bổ sung',m.SAVA_Direction_Note||'')}</div>`;
    modal(`${id} · ${m.Mechanic}`,body,(root)=>{m.Mechanic=formVal(root,'name');m.Geography=formVal(root,'geo');m.Platform=formVal(root,'platform');m.Downloads_30d=formNum(root,'dl30');m.Downloads_90d=formNum(root,'dl90');m.Downloads_12m=formNum(root,'dl12');m.Revenue_30d_USD=formNum(root,'rev30');m.Revenue_90d_USD=formNum(root,'rev90');m.Revenue_12m_USD=formNum(root,'rev12');m.DL_Growth_3m=formNum(root,'dlg3');m.Rev_Growth_3m=formNum(root,'revg3');m.Revenue_per_Download_SAME_COHORT=formNum(root,'rpd');m.UA_Benchmark=m.UA_Benchmark||{};m.UA_Benchmark.CPI_Median=formNum(root,'cpi');m.SAVA_Direction_Note=formVal(root,'savaNote');modalRoot.innerHTML='';persist(`Updated market mechanic ${id}`);},{wide:true});
  }

  function openPublisher(id){
    let p=byId(db.publisherLandscape,id);const isNew=!p;if(!p)p={id:`PUBLR-${String(db.publisherLandscape.length+1).padStart(3,'0')}`,name:''};
    const body=`<div class="form-grid">${fText('id','ID',p.id)}${fText('name','Publisher',p.name)}${fText('genres','Focus genres',p.genres||'')}${fArea('looking','What they are looking for',p.lookingFor||'')}${fArea('test','How they test',p.testApproach||'')}${fArea('investment','How they invest',p.investmentApproach||'')}${fArea('deal','Deal approach',p.dealApproach||'')}${fArea('operation','Operation model',p.operationModel||'')}${fText('source','Source / evidence link',p.source||'','full')}${fArea('notes','Notes',p.notes||'')}</div>`;
    modal(isNew?'Add publisher benchmark':p.name,body,(root)=>{p.id=formVal(root,'id');p.name=formVal(root,'name');p.genres=formVal(root,'genres');p.lookingFor=formVal(root,'looking');p.testApproach=formVal(root,'test');p.investmentApproach=formVal(root,'investment');p.dealApproach=formVal(root,'deal');p.operationModel=formVal(root,'operation');p.source=formVal(root,'source');p.notes=formVal(root,'notes');if(isNew)db.publisherLandscape.push(p);modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} publisher benchmark ${p.name}`);});
  }

  function openGame(id){
    let g=byId(db.games,id);const isNew=!g;if(!g)g={id:`PUB-${String(db.games.length+1).padStart(3,'0')}`,intake:{},scorecard:{},tests:[]}; const d=gameDerived(g);
    const evidenceSourceOptions=['','Dữ liệu thực tế đã có của chính Game/Candidate','Dữ liệu Test mới sau Deal','Nguồn thực tế khác đã xác minh'];
    const derivedSummary=`<div class="sourcing-derived"><div><span>Pre-Scan /100</span><b>${d.prescan??'—'}</b><small>Hoàn thiện ${pct(d.preScanCompleteness,0)}</small></div><div><span>Kết luận lựa chọn</span><b>${esc(d.selectionDecision)}</b></div><div><span>Product Evidence</span><b>${d.productEvidenceCount}/5 nhóm</b><small>${d.stage==='POST-TEST'?'Có lớp evidence bổ sung':'Pre-Scan only'}</small></div><div><span>Điểm theo Evidence</span><b>${d.stage==='POST-TEST'?(d.final??'—'):'—'}</b><small>${d.stage==='POST-TEST'?esc(d.evidenceDecision):'Chưa áp dụng'}</small></div></div>`;
    const body=`<div class="notice"><b>Hướng dẫn:</b> Game Selection là bước lựa chọn Game <b>trước Test</b>. PRE-SCAN dùng Market + Publishing Readiness + Deal Economics + SAVA Fit. Các điểm 1–5 ưu tiên <b>AUTO SCORE từ dữ liệu nguồn</b>; chỉ Override thủ công khi có evidence tốt hơn và phải ghi lý do. Product Test để trống tới khi có data thực tế ở 08/09. Khi có ≥2/5 nhóm Product Evidence, workbook tự bật nhánh POST-TEST để bổ sung lớp evidence. <b>Hard Gate FAIL luôn override mọi score.</b></div>${derivedSummary}<div class="source-edit-note compact"><b>ℹ️ Pre-Scan, kết luận lựa chọn và Product Evidence summary là kết quả tự tính, không sửa trực tiếp.</b> Market inputs chỉnh tại <b>Market Intelligence</b>; Deal inputs chỉnh tại <b>Deal Making</b>; các field Candidate / Hard Gate / SAVA Fit / Override chỉnh ngay tại <b>Game Selection</b>.</div>
      <div class="section-title">Candidate</div><div class="form-grid three-cols">${fText('id','Candidate ID',g.id)}${fText('title','Game title',intake(g,'Game_Title'))}${fText('studio','Studio',intake(g,'Studio'))}${fText('mechanic','Mechanic',intake(g,'Mechanic'))}${fText('archetype','Gamefeel archetype',intake(g,'Gamefeel_Archetype'))}${fText('theme','Theme / hook',intake(g,'Theme_Hook'))}${fText('geo','Target GEO',intake(g,'Target_GEO'))}${fSelect('monModel','Monetization',intake(g,'Monetization_Model')||'', ['', 'Hybrid IAP','Hybrid IAA'])}${fText('stage','Build stage',intake(g,'Build_Stage'))}${fText('buildUrl','Build URL',intake(g,'Build_URL'))}${fText('storeUrl','Store URL',intake(g,'Store_URL'))}${fText('owner','Owner',intake(g,'Owner'))}</div>
      <div class="section-title">Hard Gate</div><div class="form-grid three-cols">${[['legal','Gate_Legal_IP','Legal / IP'],['build','Gate_Build_Playable','Playable build'],['tracking','Gate_Tracking_Access','Tracking access'],['store','Gate_Store_Compliance','Store compliance'],['commercial','Gate_Commercial_Terms','Commercial terms'],['rights','Gate_Rights_Confirmed','Rights confirmed']].map(([n,k,l])=>fSelect(`gate_${n}`,l,intake(g,k)||'PENDING',GAME_GATE_STATUS)).join('')}</div>
      <div class="section-title">Market score 1–5 · AUTO + Override</div><div class="notice"><b>Rule workbook:</b> các cột 1–5 hiển thị <b>AUTO SCORE</b> từ dữ liệu nguồn. Chỉ dùng Override khi có evidence tốt hơn; nếu để trống, hệ thống luôn dùng AUTO. Market Score cần tối thiểu 3/5 nhóm và tự chia lại trọng số khi thiếu dữ liệu.</div><div class="score-override-list">${scoreOverrideField('ovr_marketSize','Market Size',g,'marketSize','Nguồn Market')}${scoreOverrideField('ovr_growth','Growth / Momentum',g,'growth','Nguồn Market')}${scoreOverrideField('ovr_entry','Entry Accessibility',g,'entryAccess','Nguồn Competition')}${scoreOverrideField('ovr_marketMon','Market Monetization',g,'marketMonetization','Nguồn Market')}${scoreOverrideField('ovr_marketUa','UA / Creative Scalability',g,'marketUaScalability','Nguồn UA benchmark')}</div>
      <div class="section-title">Publishing / Deal · AUTO + Override</div><div class="score-override-list">${scoreOverrideField('ovr_readiness','Publishing Readiness',g,'readiness','Nguồn Publishing Intake')}${scoreOverrideField('ovr_deal','Deal Economics',g,'dealEconomics','Nguồn Publishing Intake / Deal')}${scoreOverrideField('ovr_savaFit','SAVA Publishing Fit',g,'savaFit','Trung bình 7 tiêu chí Fit')}${fText('evidenceQ','Evidence Quality 1-5',g.scorecard?.evidenceQuality??'','','number')}</div>
      <div class="section-title">SAVA Publishing Fit · Dữ liệu nguồn</div><div class="notice"><b>AUTO:</b> ${gameSavaFitDerived(g).score===null?'Chưa đủ dữ liệu':fmt(gameSavaFitDerived(g).score,1)+'/100'} · Trung bình 7 tiêu chí bên dưới (1–5) × 20. Có thể override tổng Fit phía trên nếu có evidence tốt hơn, nhưng 7 tiêu chí nguồn vẫn được giữ để truy vết.</div><div class="form-grid three-cols">${SAVA_FIT_COMPONENTS.map(([k,l],i)=>fText(`savaFit_${i}`,`${l} /5`,intake(g,k)??'','','number')).join('')}${fText('fitConfidence','Độ tin cậy Fit /5',intake(g,'Fit_Confidence_1_5')??'','','number')}</div>
      <div class="section-title">Product Evidence thực tế · AUTO + Override</div><div class="notice"><b>Product Test giữ trống cho tới khi có dữ liệu ở 08/09.</b> AUTO SCORE lấy từ UA/Product Test và Gamefeel Test của chính candidate. Chỉ override khi có evidence thực tế tốt hơn; không dùng benchmark thị trường thay thế. Có ít nhất <b>2/5</b> nhóm evidence hiệu lực thì workbook chuyển sang nhánh POST-TEST.</div><div class="form-grid three-cols">${fSelect('evidenceSource','Nguồn Product Evidence',g.scorecard?.productEvidenceSource||'',evidenceSourceOptions)}</div><div class="score-override-list">${scoreOverrideField('ovr_uaTest','UA Test',g,'uaTest','08/09')}${scoreOverrideField('ovr_retention','Retention',g,'retention','08/09')}${scoreOverrideField('ovr_engagement','Engagement',g,'engagement','08/09')}${scoreOverrideField('ovr_monTest','Monetization Test',g,'monetizationTest','08/09')}${scoreOverrideField('ovr_gamefeel','Gamefeel Test',g,'gamefeelTest','08_GAMEFEEL_USER_TEST')}</div>${fArea('overrideEvidence','Evidence / lý do cho Override',g.scorecard?.overrideEvidence||'','full')}${fArea('notes','Decision notes',g.scorecard?.decisionNotes||'')}</div>`;
    modal(isNew?'Add game':`${g.id} · ${intake(g,'Game_Title')}`,body,(root)=>{const old=g.id;g.id=formVal(root,'id')||old;g.intake=g.intake||{};Object.assign(g.intake,{Candidate_ID:g.id,Game_Title:formVal(root,'title'),Studio:formVal(root,'studio'),Mechanic:formVal(root,'mechanic'),Gamefeel_Archetype:formVal(root,'archetype'),Theme_Hook:formVal(root,'theme'),Target_GEO:formVal(root,'geo'),Monetization_Model:formVal(root,'monModel'),Build_Stage:formVal(root,'stage'),Build_URL:formVal(root,'buildUrl'),Store_URL:formVal(root,'storeUrl'),Owner:formVal(root,'owner'),Gate_Legal_IP:formVal(root,'gate_legal'),Gate_Build_Playable:formVal(root,'gate_build'),Gate_Tracking_Access:formVal(root,'gate_tracking'),Gate_Store_Compliance:formVal(root,'gate_store'),Gate_Commercial_Terms:formVal(root,'gate_commercial'),Gate_Rights_Confirmed:formVal(root,'gate_rights'),Fit_Confidence_1_5:formNum(root,'fitConfidence')});SAVA_FIT_COMPONENTS.forEach(([k],i)=>{g.intake[k]=formNum(root,`savaFit_${i}`);});
      g.scorecard=g.scorecard||{};const sc=gameEnsureScoreLayers(g);sc.overrides=sc.overrides||{};
      const overrideMap={marketSize:'ovr_marketSize',growth:'ovr_growth',entryAccess:'ovr_entry',marketMonetization:'ovr_marketMon',marketUaScalability:'ovr_marketUa',readiness:'ovr_readiness',dealEconomics:'ovr_deal',savaFit:'ovr_savaFit',uaTest:'ovr_uaTest',retention:'ovr_retention',engagement:'ovr_engagement',monetizationTest:'ovr_monTest',gamefeelTest:'ovr_gamefeel'};
      let hasOverride=false;Object.entries(overrideMap).forEach(([k,nm])=>{const v=formNum(root,nm);if(v!==null){hasOverride=true;sc.overrides[k]=v;}else delete sc.overrides[k];});
      const overrideEvidence=formVal(root,'overrideEvidence').trim();if(hasOverride&&!overrideEvidence){toast('Override thủ công cần ghi rõ evidence / lý do tốt hơn nguồn AUTO.');return;}sc.overrideEvidence=overrideEvidence;sc.overrideUpdatedAt=hasOverride?new Date().toISOString():sc.overrideUpdatedAt||null;
      sc.evidenceQuality=formNum(root,'evidenceQ');sc.productEvidenceSource=formVal(root,'evidenceSource');sc.decisionNotes=formVal(root,'notes');
      // Backward-compatible effective values. AUTO stays in sc.autoScores; manual changes stay in sc.overrides.
      GAME_SCORE_KEYS.forEach(k=>{sc[k]=gameEffectiveScore(g,k);});sc.savaFit=gameSavaFitEffective(g);
      const der=gameDerived(g);Object.assign(sc,{marketScore:der.market,productScore:der.product,preScanScore:der.prescan,finalScore:der.final,dataCompleteness:der.completeness,hardGate:der.hard,decisionStage:der.stage,recommendation:der.recommendation,selectionDecision:der.selectionDecision,evidenceDecision:der.evidenceDecision});if(isNew)db.games.push(g); else if(old!==g.id){db.sourcing.forEach(s=>{if(s.gameId===old)s.gameId=g.id;});db.deals.forEach(d=>{if(d.gameId===old)d.gameId=g.id;});}modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} game ${g.id}`);},{wide:true});
  }

  function sourcingEditGuide(){return `<div class="sourcing-edit-guide"><div class="guide-title">Hướng dẫn BD</div><div class="guide-grid"><div><b>1. Screening → Qualified</b><p>“Loại” = Không Qualified. “Cân nhắc / Tiếp tục / Tiếp tục nhưng cần chỉnh sửa” = Qualified và vào Evaluation.</p></div><div><b>2. Deal → Test</b><p>Không nhập Ngày Test nếu chưa có Ngày Deal/ký hợp đồng. Test chỉ bắt đầu sau Deal.</p></div><div><b>3. Lead đang xử lý</b><p>Bắt buộc có BD phụ trách, Hành động tiếp theo và Hạn hành động để hệ thống theo dõi STUCK/quá hạn.</p></div><div><b>4. Market Intelligence</b><p>Nếu Lead đã link Game hoặc match đúng mechanic, hệ thống tự lấy Định hướng + Sức hấp dẫn từ Market Intelligence; không nhập lại. Nếu chưa map được mới dùng nhóm chiến lược fallback.</p></div></div></div>`;}
  function openSourcing(id){
    let x=byId(db.sourcing,id);const isNew=!x;if(!x)x={id:`SRC-${String((db.sourcing||[]).filter(y=>/^SRC-/.test(y.id||'')).length+1).padStart(3,'0')}`,partnerId:'',gameId:'',leadName:'',game:'',studio:'',source:'',screeningResult:'',status:'Đang xử lý'};
    const align=sourcingMarketAlignment(x),stage=sourcingCurrentStage(x),q=sourcingQualified(x),alert=sourcingPipelineAlert(x);
    const partner=byId(db.partners,x.partnerId);const partnerRisk=(db.partnerRisks||[]).filter(r=>r.partnerId===x.partnerId&&r.status!=='Đã đóng');
    const partnerRef=partner?`<div class="sourcing-ref-grid"><div><span>Hard Gate đối tác</span><b>${esc(partnerDerived(partner).hard)}</b></div><div><span>Mức độ phù hợp đối tác</span><b>${displayScore100(partnerDerived(partner).fit)}</b></div><div><span>Risk đang mở</span><b>${partnerRisk.length}</b></div><div><span>Mô hình hợp tác</span><b>${esc(dealCommercialSnapshot(partnerPrimaryDeal(partner.id))?.dealModel||profile(partner,'Mô hình hợp tác tài chính')||'—')}</b></div></div>`:'<div class="notice">Chưa link với Partner Selection. Có thể chọn Partner ở phần Thông tin Lead nếu đây là đối tác đã biết.</div>';
    const body=`${sourcingEditGuide()}<div class="sourcing-derived"><div><span>Qualified</span><b>${esc(q)}</b></div><div><span>Giai đoạn hiện tại</span><b>${esc(stage)}</b></div><div><span>Cảnh báo Pipeline</span><b>${esc(alert)}</b></div><div><span>Phù hợp thị trường</span><b>${esc(align.label)}${align.score===null?'':` · ${align.score}/100`}</b></div></div>
      <div class="section-title">1. Thông tin Lead</div><div class="form-grid three-cols">${fText('id','Lead ID',x.id)}${fText('gameName','Game',x.game||x.leadName||'')}${fText('studio','Studio / Đối tác',x.studio||'')}${fText('country','Quốc gia',x.country||'')}${fText('genre','Genre',x.genre||'')}${fSelect('source','Nguồn',x.source||'',SOURCING_SOURCES)}${fText('owner','BD phụ trách',x.owner||'')}${fSelect('partner','Link Partner Selection',x.partnerId||'', ['',...db.partners.map(p=>p.id)])}${fSelect('gameLink','Link Game Selection',x.gameId||'', ['',...db.games.map(g=>g.id)])}</div>
      <div class="section-title">2. Screening & trạng thái</div><div class="form-grid three-cols">${fSelect('screening','Kết quả Screening',x.screeningResult||'',SOURCING_SCREENING)}${fSelect('status','Trạng thái',sourcingStatus(x),SOURCING_STATUS)}${fSelect('testResult','Kết quả Test',x.testResult||'',SOURCING_TEST_RESULT)}${fSelect('lost','Lý do loại',x.reasonLost||'',SOURCING_LOSS_REASONS)}${fArea('next','Hành động tiếp theo',x.nextAction||'','full')}${fText('deadline','Hạn hành động',x.actionDeadline||'','','date')}${fArea('notes','Ghi chú',x.notes||'','full')}</div>
      <div class="section-title">3. Mốc Funnel</div><div class="form-grid three-cols">${fText('leadDate','Ngày Lead',sourcingDate(x,'leadDate')||x.createdAt?.slice?.(0,10)||'','','date')}${fText('qualifiedDate','Ngày Qualified',sourcingDate(x,'qualifiedDate'),'','date')}${fText('evaluationDate','Ngày Evaluation',sourcingDate(x,'evaluationDate'),'','date')}${fText('dealDate','Ngày Deal / ký',sourcingDate(x,'dealDate'),'','date')}${fText('testDate','Ngày Test',sourcingDate(x,'testDate'),'','date')}${fText('launchDate','Ngày Launch',sourcingDate(x,'launchDate'),'','date')}${fText('scaleDate','Ngày Scale',sourcingDate(x,'scaleDate'),'','date')}</div>
      <div class="section-title">4. Tham chiếu Partner</div><div class="source-edit-note compact"><b>🔒 Đây là dữ liệu tham chiếu, không sửa tại Sourcing.</b> Hard Gate / Fit / Risk chỉnh tại <b>Partner Selection</b>; Mô hình hợp tác / RS / UA chỉnh tại <b>Deal Making</b>.</div>${partnerRef}
      <div class="section-title">5. Tham chiếu Market Intelligence</div><div class="source-edit-note compact"><b>🔒 Đây là dữ liệu tham chiếu, không sửa tại Sourcing.</b> Benchmark, Growth, RPD, CPI và định hướng market chỉnh tại <b>Market Intelligence</b>.</div><div class="sourcing-ref-grid"><div><span>Market / nhóm chiến lược</span><b>${esc(align.group)}</b></div><div><span>Định hướng / mức phù hợp</span><b>${esc(align.label)}</b></div><div><span>Điểm tham chiếu</span><b>${align.score===null?'—':align.score+'/100'}</b><small>${align.source==='market'?'Từ Market Intelligence':'Fallback chiến lược'}</small></div><div><span>Kết hợp Screening</span><b>${esc(sourcingScreeningAction(x))}</b></div></div>${x.historicalEvaluation?`<div class="section-title">6. Tham chiếu đánh giá lịch sử</div><div class="sourcing-ref-grid"><div><span>Kết quả</span><b>${esc(x.historicalEvaluation.result||'—')}</b></div><div><span>Mức hoàn thiện</span><b>${esc(x.historicalEvaluation.completion||'—')}</b></div><div><span>Tiềm năng</span><b>${esc(x.historicalEvaluation.potential||'—')}</b></div><div><span>Monetization</span><b>${esc(x.historicalEvaluation.monetization||'—')}</b></div></div>`:''}`;
    modal(isNew?'Thêm Lead Sourcing':`${x.id} · ${x.game||x.leadName||x.studio||''}`,body,(root)=>{
      const screening=formVal(root,'screening'),status=screening==='Loại'?'Loại':formVal(root,'status');const owner=formVal(root,'owner'),next=formVal(root,'next'),deadline=formVal(root,'deadline');const dealDate=formVal(root,'dealDate'),testDate=formVal(root,'testDate');
      if(testDate&&!dealDate){toast('Không thể lưu: Test chỉ bắt đầu sau khi Deal/ký hợp đồng.');return;}
      if(status==='Đang xử lý'&&(!owner||!next||!deadline)){toast('Lead đang xử lý cần BD phụ trách + Hành động tiếp theo + Deadline.');return;}
      x.id=formVal(root,'id');x.game=formVal(root,'gameName');x.leadName=x.game||formVal(root,'studio');x.studio=formVal(root,'studio');x.country=formVal(root,'country');x.genre=formVal(root,'genre');x.source=formVal(root,'source');x.owner=owner;x.partnerId=formVal(root,'partner');x.gameId=formVal(root,'gameLink');x.screeningResult=screening;x.qualified=sourcingQualified({...x,screeningResult:screening});x.status=status;x.testResult=formVal(root,'testResult');x.reasonLost=formVal(root,'lost');x.nextAction=next;x.actionDeadline=deadline;x.notes=formVal(root,'notes');x.leadDate=formVal(root,'leadDate');x.qualifiedDate=formVal(root,'qualifiedDate');x.evaluationDate=formVal(root,'evaluationDate');x.dealDate=dealDate;x.testDate=testDate;x.launchDate=formVal(root,'launchDate');x.scaleDate=formVal(root,'scaleDate');x.stage=sourcingCurrentStage(x);x.updatedAt=new Date().toISOString();if(!x.createdAt)x.createdAt=x.leadDate||today();if(isNew)db.sourcing.push(x);modalRoot.innerHTML='';persist(`${isNew?'Added':'Updated'} sourcing ${x.id}`);
    },{wide:true,saveText:'Lưu Lead'});
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
    const currentStage=operationStageValue(p),currentDef=OPERATION_ROADMAP[operationStageIndex(p)];
    const body=`<div class="operation-edit-roadmap"><div class="section-title">Roadmap dự án</div>${operationRoadmapHtml(p)}<div class="notice"><b>${esc(currentDef.code)} · ${esc(currentDef.title)}</b> — ${esc(currentDef.objective)}<br><span class="muted">${esc(currentDef.pass)}</span></div></div>
      <div class="section-title">1. Thông tin dự án</div><div class="form-grid three-cols">${fText('id','Project ID',p.id)}${fText('name','Project',p.name)}${fText('status','Trạng thái triển khai',p.deploymentStatus||'')}${fText('genre','Genre',p.genre||'')}${fSelect('model','Monetization',p.monetizationModel||'Hybrid IAP',['Hybrid IAP','Hybrid IAA'])}${fSelect('flow','Luồng Publishing',p.publishingFlow||'Luồng 1',['Luồng 1','Luồng 2'])}${fSelect('stage','Giai đoạn Roadmap',currentStage,['P0 / Chờ Product Test','Product Test','Monetization Test','Big Budget / Expansion','Scale'])}${fText('owner','Owner',p.owner||'')}${fArea('action','Hành động tiếp theo',p.nextAction||'')}${fText('evidence','Evidence / link',p.evidenceLink||'','full')}</div>
      <div class="section-title">2. Điều kiện dữ liệu / Gate</div><div class="form-grid three-cols">${fText('attempt','Attempt',m.attempt??1,'','number')}${fSelect('p0','P0 / tracking hợp lệ',String(m.p0Pass??true),['true','false'])}${fSelect('mature','Data mature',String(m.dataMature??true),['true','false'])}${fSelect('content','Content runway hợp lệ',String(m.contentRunway??true),['true','false'])}</div>
      <div class="section-title">3. Product Test metrics</div><div class="form-grid three-cols">${fText('cpi','CPI',m.cpi??'','','number')}${fText('cpiBench','CPI benchmark',m.cpiBenchmark??'','','number')}${fText('crash','Crash rate (0-1)',m.crash??'','','number')}${fText('anr','ANR rate (0-1)',m.anr??'','','number')}${fText('playtime','Playtime min/day',m.playtime??'','','number')}${fText('d1','D1 retention (0-1)',m.d1??'','','number')}</div><div class="small muted operation-field-help">Product PASS: CPI ≤120% benchmark · Crash &lt;1% · ANR &lt;0.5% · Playtime ≥10m/ngày · D1 ≥35%. Hard FAIL: CPI &gt;120% benchmark hoặc D1 &lt;28%.</div>
      <div class="section-title">4. Monetization / Expansion metrics</div><div class="form-grid three-cols">${fText('r14','ROAS D14 (0-1)',m.roasD14??'','','number')}${fText('rv','RV engagement (0-1, IAA)',m.rvEngagement??'','','number')}</div><div class="small muted operation-field-help">IAP Monetization PASS ≥120%; Expansion floor ≥100%. IAA Monetization PASS: D14 ≥80% + RV ≥40%; Expansion floor D14 ≥80%.</div>
      <div class="section-title">5. Scale metrics</div><div class="form-grid three-cols">${fText('r21','ROAS D21 (0-1)',m.roasD21??'','','number')}${fText('r30','ROAS D30 (0-1)',m.roasD30??'','','number')}</div><div class="small muted operation-field-help">IAA Scale: D14 ≥80% · D21 ≥110% · D30 ≥130%. IAP: D14 ≥100% + D21/D30 so với Approved Scale Reference đã freeze.</div>`;
    modal(isNew?'Thêm dự án Publishing':p.name,body,(root)=>{p.id=formVal(root,'id');p.name=formVal(root,'name');p.deploymentStatus=formVal(root,'status');p.genre=formVal(root,'genre');p.monetizationModel=formVal(root,'model');p.publishingFlow=formVal(root,'flow');p.sopStage=formVal(root,'stage');p.gatePhase=operationGateLabel(p.sopStage);p.owner=formVal(root,'owner');p.nextAction=formVal(root,'action');p.evidenceLink=formVal(root,'evidence');const met={attempt:formNum(root,'attempt'),p0Pass:formVal(root,'p0')==='true',dataMature:formVal(root,'mature')==='true',contentRunway:formVal(root,'content')==='true',cpi:formNum(root,'cpi'),cpiBenchmark:formNum(root,'cpiBench'),crash:formNum(root,'crash'),anr:formNum(root,'anr'),playtime:formNum(root,'playtime'),d1:formNum(root,'d1'),roasD14:formNum(root,'r14'),rvEngagement:formNum(root,'rv'),roasD21:formNum(root,'r21'),roasD30:formNum(root,'r30')};const evalr=evaluateProject(p,met);p.gateReview={metrics:met,result:evalr.result,reason:evalr.reason,reviewedAt:new Date().toISOString(),reviewedBy:db.settings?.currentUser||''};p.latestDecision=evalr.result;if(isNew)db.projects.push(p);modalRoot.innerHTML='';persist(`${isNew?'Added':'Reviewed'} project ${p.name}: ${evalr.result}`);toast(`${p.name}: ${evalr.result}`);},{wide:true,saveText:'Lưu & đánh giá Gate'});
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
    if(act==='account')window.SAVA_SUPABASE?.accountAction?.(); else if(act==='refresh-cloud')refreshCloud(); else if(act==='open-sync')openSync(); else if(act==='export-json')exportJson(); else if(act==='quick-add'){({partners:()=>openPartner(),deals:()=>openDeal(),market:()=>openPublisher(),games:()=>openGame(),sourcing:()=>openSourcing(),operations:()=>openProject(),sources:()=>toast('Tài liệu nguồn chỉ Admin mới được upload/replace'),audit:()=>toast('Lịch sử thay đổi chỉ dùng để tra cứu')}[currentView]||(()=>openSourcing()))();}
    else if(act==='add-partner')openPartner();else if(act==='add-risk')addRisk();else if(act==='add-deal')openDeal();else if(act==='deal-rules')openDealRules();else if(act==='add-publisher')openPublisher();else if(act==='add-game')openGame();else if(act==='add-sourcing')openSourcing();else if(act==='add-project')openProject();
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
