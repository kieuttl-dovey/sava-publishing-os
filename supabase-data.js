(() => {
  'use strict';

  const cfg = window.SAVA_SUPABASE_CONFIG || {};
  if (!window.supabase || !cfg.url || !cfg.publishableKey) {
    window.SAVA_SUPABASE = { configured: false };
    return;
  }

  const client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let session = null;
  let profile = null;
  let snapshot = null;

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const field = (obj, path, fallback = null) => {
    let cur = obj;
    for (const p of path) cur = cur?.[p];
    return cur === undefined ? fallback : cur;
  };

  function authScreen(message = '') {
    let root = document.getElementById('authRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'authRoot';
      document.body.appendChild(root);
    }
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          <div class="auth-brand"><div class="brand-mark">S</div><div><strong>SAVA</strong><span>Publishing OS</span></div></div>
          <p class="eyebrow">Internal workspace</p>
          <h1>Sign in</h1>
          <p class="muted">Use the account created by the SAVA Publishing admin.</p>
          <form id="authForm" class="auth-form">
            <label>Email<input name="email" type="email" autocomplete="username" required></label>
            <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
            <button class="primary" type="submit">Sign in</button>
            <div id="authMessage" class="auth-message ${message ? 'bad-text' : ''}">${message || ''}</div>
          </form>
        </div>
      </div>`;
    root.hidden = false;
    return root;
  }

  function hideAuthScreen() {
    const root = document.getElementById('authRoot');
    if (root) root.hidden = true;
  }

  async function ensureSignedIn() {
    const res = await client.auth.getSession();
    if (res.error) throw res.error;
    session = res.data.session;
    if (session) return session;

    return new Promise((resolve) => {
      const root = authScreen();
      const form = root.querySelector('#authForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = root.querySelector('#authMessage');
        const btn = form.querySelector('button');
        btn.disabled = true;
        msg.className = 'auth-message';
        msg.textContent = 'Signing in…';
        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        btn.disabled = false;
        if (error) {
          msg.className = 'auth-message bad-text';
          msg.textContent = error.message;
          return;
        }
        session = data.session;
        hideAuthScreen();
        resolve(session);
      });
    });
  }

  async function loadProfile() {
    if (!session?.user?.id) return null;
    const { data, error } = await client.from('profiles').select('id,email,full_name,role').eq('id', session.user.id).single();
    if (error) throw error;
    profile = data;
    return data;
  }

  function mapAudit(logs, profiles) {
    const names = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || p.email || 'User']));
    return (logs || []).map(a => ({
      at: a.changed_at,
      user: names[a.actor_id] || 'System',
      action: `${a.action} ${a.table_name}${a.record_id ? ` · ${a.record_id}` : ''}`
    }));
  }

  async function checked(promise, label) {
    const { data, error } = await promise;
    if (error) throw new Error(`${label}: ${error.message}`);
    return data || [];
  }

  async function loadDb() {
    if (!session) await ensureSignedIn();
    if (!profile) await loadProfile();

    const [appCfg, playbookCfg, partners, risks, games, market, publishers, deals, sourcing, projects, audit, profiles] = await Promise.all([
      checked(client.from('app_config').select('key,data'), 'app_config'),
      checked(client.from('playbook_configs').select('key,data'), 'playbook_configs'),
      checked(client.from('partners').select('*').order('id'), 'partners'),
      checked(client.from('partner_risks').select('*').order('id'), 'partner_risks'),
      checked(client.from('games').select('*').order('id'), 'games'),
      checked(client.from('market_benchmarks').select('*').order('id'), 'market_benchmarks'),
      checked(client.from('publisher_landscape').select('*').order('id'), 'publisher_landscape'),
      checked(client.from('deals').select('*').order('id'), 'deals'),
      checked(client.from('sourcing').select('*').order('id'), 'sourcing'),
      checked(client.from('projects').select('*').order('id'), 'projects'),
      checked(client.from('audit_logs').select('*').order('changed_at', { ascending: false }).limit(100), 'audit_logs'),
      checked(client.from('profiles').select('id,email,full_name,role'), 'profiles')
    ]);

    const app = Object.fromEntries(appCfg.map(x => [x.key, x.data || {}]));
    const pb = Object.fromEntries(playbookCfg.map(x => [x.key, x.data || {}]));
    const db = {
      meta: app.meta || { name: 'SAVA Publishing OS', version: '0.2.0' },
      settings: {
        ...(app.settings || {}),
        currentUser: profile.full_name || profile.email || session.user.email || 'User',
        currentUserEmail: profile.email || session.user.email || '',
        role: profile.role || 'viewer'
      },
      partners: partners.map(x => x.data || {}),
      partnerRisks: risks.map(x => x.data || {}),
      games: games.map(x => x.data || {}),
      market: market.map(x => x.data || {}),
      publisherLandscape: publishers.map(x => x.data || {}),
      deals: deals.map(x => x.data || {}),
      sourcing: sourcing.map(x => x.data || {}),
      projects: projects.map(x => x.data || {}),
      playbook: {
        partnerSelection: pb.partnerSelection || {},
        gameSelection: pb.gameSelection || {},
        operation: pb.operation || {}
      },
      audit: mapAudit(audit, profiles)
    };
    snapshot = clone(db);
    return db;
  }

  const primary = {
    partners: x => x.id,
    partnerRisks: x => x.id,
    games: x => x.id,
    market: x => x.Mechanic_ID,
    publisherLandscape: x => x.id,
    deals: x => x.id,
    sourcing: x => x.id,
    projects: x => x.id
  };

  const specs = [
    ['partners', 'partners', p => ({
      id: p.id,
      name: field(p, ['profile', 'Tên Partner / Studio']),
      status: field(p, ['profile', 'Trạng thái']),
      owner: field(p, ['profile', 'Owner Publishing']),
      data: p
    })],
    ['games', 'games', g => ({
      id: g.id,
      title: field(g, ['intake', 'Game_Title']),
      studio: field(g, ['intake', 'Studio']),
      stage: field(g, ['scorecard', 'decisionStage']) || field(g, ['intake', 'Build_Stage']),
      recommendation: field(g, ['scorecard', 'recommendation']),
      owner: field(g, ['intake', 'Owner']),
      data: g
    })],
    ['market', 'market_benchmarks', m => ({
      id: m.Mechanic_ID,
      mechanic: m.Mechanic || null,
      geography: m.Geography || null,
      platform: m.Platform || null,
      data: m
    })],
    ['publisherLandscape', 'publisher_landscape', p => ({
      id: p.id,
      publisher_name: p.name || null,
      focus: p.genres || null,
      owner: p.owner || null,
      data: p
    })],
    ['partnerRisks', 'partner_risks', r => ({
      id: r.id,
      partner_id: r.partnerId || null,
      status: r.status || null,
      level: r.level || null,
      owner: r.owner || null,
      data: r
    })],
    ['deals', 'deals', d => ({
      id: d.id,
      partner_id: d.partnerId || null,
      game_id: d.gameId || null,
      status: d.status || null,
      owner: d.owner || null,
      data: d
    })],
    ['sourcing', 'sourcing', s => ({
      id: s.id,
      partner_id: s.partnerId || null,
      game_id: s.gameId || null,
      lead_name: s.leadName || null,
      stage: s.stage || null,
      owner: s.owner || null,
      data: s
    })],
    ['projects', 'projects', p => ({
      id: p.id,
      game_id: p.gameId || null,
      partner_id: p.partnerId || null,
      name: p.name || null,
      sop_stage: p.sopStage || null,
      gate_phase: p.gatePhase || null,
      owner: p.owner || null,
      data: p
    })]
  ];

  function indexBy(list, keyFn) {
    const out = new Map();
    for (const item of (list || [])) {
      const id = keyFn(item);
      if (id) out.set(String(id), item);
    }
    return out;
  }

  async function upsertRows(table, rows) {
    if (!rows.length) return;
    const payload = rows.map(r => ({ ...r, updated_by: session.user.id }));
    const { error } = await client.from(table).upsert(payload, { onConflict: 'id' });
    if (error) throw new Error(`${table} save failed: ${error.message}`);
  }

  async function deleteRows(table, ids) {
    if (!ids.length) return;
    const { error } = await client.from(table).delete().in('id', ids);
    if (error) throw new Error(`${table} delete failed: ${error.message}`);
  }

  async function syncConfig(db) {
    const cleanSettings = { ...(db.settings || {}) };
    delete cleanSettings.currentUser;
    delete cleanSettings.currentUserEmail;
    delete cleanSettings.role;
    delete cleanSettings.github;

    const oldSettings = { ...(snapshot?.settings || {}) };
    delete oldSettings.currentUser;
    delete oldSettings.currentUserEmail;
    delete oldSettings.role;
    delete oldSettings.github;

    const configRows = [];
    if (!eq(db.meta, snapshot?.meta)) configRows.push({ key: 'meta', data: db.meta || {}, updated_by: session.user.id });
    if (!eq(cleanSettings, oldSettings)) configRows.push({ key: 'settings', data: cleanSettings, updated_by: session.user.id });
    if (configRows.length) {
      const { error } = await client.from('app_config').upsert(configRows, { onConflict: 'key' });
      if (error) throw new Error(`app_config save failed: ${error.message}`);
    }

    const pbRows = [];
    for (const key of ['partnerSelection', 'gameSelection', 'operation']) {
      if (!eq(db.playbook?.[key], snapshot?.playbook?.[key])) {
        pbRows.push({ key, data: db.playbook?.[key] || {}, updated_by: session.user.id });
      }
    }
    if (pbRows.length) {
      const { error } = await client.from('playbook_configs').upsert(pbRows, { onConflict: 'key' });
      if (error) throw new Error(`playbook_configs save failed: ${error.message}`);
    }
  }

  async function syncDb(db) {
    if (!profile) await loadProfile();
    if (!['admin', 'editor'].includes(profile.role)) throw new Error('Your account is Viewer. Ask an Admin to grant Editor or Admin access.');
    if (!snapshot) snapshot = clone(db);

    await syncConfig(db);

    const deletes = [];
    for (const [dbKey, table, toRow] of specs) {
      const keyFn = primary[dbKey];
      const oldMap = indexBy(snapshot?.[dbKey], keyFn);
      const newMap = indexBy(db?.[dbKey], keyFn);
      const changed = [];
      for (const [id, item] of newMap) {
        if (!oldMap.has(id) || !eq(item, oldMap.get(id))) changed.push(toRow(item));
      }
      await upsertRows(table, changed);
      const removed = [...oldMap.keys()].filter(id => !newMap.has(id));
      if (removed.length) deletes.push([table, removed]);
    }

    // Delete dependents first. This also makes ID-renames safer.
    const order = ['partner_risks', 'deals', 'sourcing', 'projects', 'publisher_landscape', 'market_benchmarks', 'games', 'partners'];
    deletes.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    for (const [table, ids] of deletes) await deleteRows(table, ids);

    snapshot = clone(db);
    return true;
  }

  async function refreshProfile() {
    await loadProfile();
    return clone(profile);
  }

  async function signOut() {
    await client.auth.signOut();
    session = null;
    profile = null;
    snapshot = null;
    location.reload();
  }

  async function accountAction() {
    if (!profile) await loadProfile();
    const who = profile.full_name || profile.email || 'User';
    const ok = confirm(`${who}\nRole: ${profile.role}\n\nSign out?`);
    if (ok) await signOut();
  }

  window.SAVA_SUPABASE = {
    configured: true,
    client,
    async init() {
      await ensureSignedIn();
      await loadProfile();
      hideAuthScreen();
      return loadDb();
    },
    loadDb,
    syncDb,
    refreshProfile,
    accountAction,
    signOut,
    canEdit: () => ['admin', 'editor'].includes(profile?.role),
    canDelete: () => profile?.role === 'admin',
    getRole: () => profile?.role || 'viewer',
    getUser: () => clone(profile || {}),
    getSnapshot: () => snapshot ? clone(snapshot) : null
  };
})();
