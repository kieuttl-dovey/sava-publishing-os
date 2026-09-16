(() => {
  'use strict';

  const cfg = window.SAVA_SUPABASE_CONFIG || {};
  if (!window.supabase || !cfg.url || !cfg.publishableKey) {
    window.SAVA_SUPABASE = { configured: false };
    return;
  }

  const authEntry = (() => {
    const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const search = new URLSearchParams(window.location.search || '');
    return {
      type: hash.get('type') || search.get('type') || '',
      hasAuthToken: hash.has('access_token') || hash.has('refresh_token') || search.has('code') || search.has('token_hash')
    };
  })();

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
          <div class="auth-brand"><div class="brand-mark"><img src="assets/sava-logo.png" alt="SAVA" /></div><div><strong>SAVA</strong><span>Publishing OS</span></div></div>
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

  function cleanAuthCallbackUrl() {
    const url = new URL(window.location.href);
    ['code','token_hash','type','redirect_to'].forEach(k => url.searchParams.delete(k));
    const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const authHash = hash.has('access_token') || hash.has('refresh_token') || ['invite','recovery','signup','magiclink'].includes(hash.get('type'));
    if (authHash) url.hash = '';
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }

  async function waitForUrlSession(timeoutMs = 3500) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session) return data.session;
      await new Promise(r => setTimeout(r, 120));
    }
    return null;
  }

  function passwordSetupScreen({ firstTime = false, allowCancel = false, message = '' } = {}) {
    let root = document.getElementById('authRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'authRoot';
      document.body.appendChild(root);
    }
    const email = session?.user?.email || profile?.email || '';
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          <div class="auth-brand"><div class="brand-mark"><img src="assets/sava-logo.png" alt="SAVA" /></div><div><strong>SAVA</strong><span>Publishing OS</span></div></div>
          <p class="eyebrow">${firstTime ? 'Thiết lập tài khoản lần đầu' : 'Bảo mật tài khoản'}</p>
          <h1>${firstTime ? 'Tạo mật khẩu đăng nhập' : 'Đổi mật khẩu'}</h1>
          <p class="muted">${firstTime ? 'Email đã được xác minh. Hãy tạo mật khẩu để những lần sau bạn có thể đăng nhập trực tiếp vào SAVA Publishing OS.' : 'Đặt mật khẩu mới cho tài khoản của bạn.'}</p>
          ${email ? `<div class="auth-account-chip">${email}</div>` : ''}
          <form id="passwordSetupForm" class="auth-form">
            <label>Mật khẩu mới<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
            <label>Nhập lại mật khẩu<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label>
            <div class="password-hint">Tối thiểu 8 ký tự. Không chia sẻ mật khẩu qua chat hoặc email.</div>
            <button class="primary" type="submit">${firstTime ? 'Lưu mật khẩu & vào hệ thống' : 'Cập nhật mật khẩu'}</button>
            ${allowCancel ? '<button class="ghost" type="button" data-auth-cancel>Hủy</button>' : ''}
            <div id="passwordSetupMessage" class="auth-message ${message ? 'bad-text' : ''}">${message || ''}</div>
          </form>
        </div>
      </div>`;
    root.hidden = false;
    return root;
  }

  async function requirePasswordSetup({ firstTime = false, allowCancel = false } = {}) {
    return new Promise((resolve) => {
      const root = passwordSetupScreen({ firstTime, allowCancel });
      const form = root.querySelector('#passwordSetupForm');
      const cancel = root.querySelector('[data-auth-cancel]');
      if (cancel) cancel.addEventListener('click', () => { hideAuthScreen(); resolve(false); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = root.querySelector('#passwordSetupMessage');
        const btn = form.querySelector('button[type=submit]');
        const password = form.elements.password.value;
        const confirmPassword = form.elements.confirmPassword.value;
        if (password.length < 8) {
          msg.className = 'auth-message bad-text';
          msg.textContent = 'Mật khẩu cần tối thiểu 8 ký tự.';
          return;
        }
        if (password !== confirmPassword) {
          msg.className = 'auth-message bad-text';
          msg.textContent = 'Hai mật khẩu chưa khớp.';
          return;
        }
        btn.disabled = true;
        msg.className = 'auth-message';
        msg.textContent = 'Đang lưu mật khẩu…';
        const currentMetadata = session?.user?.user_metadata || {};
        const { data, error } = await client.auth.updateUser({
          password,
          data: {
            ...currentMetadata,
            sava_password_initialized: true,
            sava_password_initialized_at: new Date().toISOString()
          }
        });
        btn.disabled = false;
        if (error) {
          msg.className = 'auth-message bad-text';
          msg.textContent = error.message;
          return;
        }
        if (data?.user && session) session = { ...session, user: data.user };
        msg.className = 'auth-message good-text';
        msg.textContent = 'Đã cập nhật mật khẩu.';
        if (firstTime) cleanAuthCallbackUrl();
        setTimeout(() => { hideAuthScreen(); resolve(true); }, 450);
      });
    });
  }

  async function ensureSignedIn() {
    let res = await client.auth.getSession();
    if (res.error) throw res.error;
    session = res.data.session;
    if (!session && authEntry.hasAuthToken) session = await waitForUrlSession();
    if (session) {
      if (authEntry.type === 'invite') await requirePasswordSetup({ firstTime: true, allowCancel: false });
      else if (authEntry.type === 'recovery') await requirePasswordSetup({ firstTime: false, allowCancel: false });
      return session;
    }

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
        dealMaking: pb.dealMaking || {},
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
    for (const key of ['partnerSelection', 'dealMaking', 'gameSelection', 'operation']) {
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

  const SOURCE_BUCKET = 'publishing-source-workbooks';

  async function listSourceFiles() {
    if (!session) await ensureSignedIn();
    const { data, error } = await client.storage.from(SOURCE_BUCKET).list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Source files: ${error.message}`);
    return data || [];
  }

  async function uploadSourceFile(path, file) {
    if (!session) await ensureSignedIn();
    if (!profile) await loadProfile();
    if (profile.role !== 'admin') throw new Error('Chỉ Admin được thay file nguồn.');
    const { error } = await client.storage.from(SOURCE_BUCKET).upload(path, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type || undefined
    });
    if (error) throw new Error(`Upload source file: ${error.message}`);
    return true;
  }

  async function downloadSourceFile(path, downloadName) {
    if (!session) await ensureSignedIn();
    const { data, error } = await client.storage.from(SOURCE_BUCKET).download(path);
    if (error) throw new Error(`Download source file: ${error.message}`);
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName || path;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
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

  function accountScreen() {
    let root = document.getElementById('authRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'authRoot';
      document.body.appendChild(root);
    }
    const who = profile?.full_name || profile?.email || session?.user?.email || 'User';
    const roleLabel = ({admin:'Admin',editor:'Editor',viewer:'Viewer'})[profile?.role] || profile?.role || 'Viewer';
    root.innerHTML = `
      <div class="auth-screen account-overlay">
        <div class="auth-card account-card">
          <div class="auth-brand"><div class="brand-mark"><img src="assets/sava-logo.png" alt="SAVA" /></div><div><strong>SAVA</strong><span>Publishing OS</span></div></div>
          <p class="eyebrow">Tài khoản</p>
          <h1>${who}</h1>
          <div class="account-role-row"><span>Quyền truy cập</span><strong>${roleLabel}</strong></div>
          <div class="account-actions">
            <button class="primary" type="button" data-account-password>Đổi / thiết lập mật khẩu</button>
            <button class="ghost" type="button" data-account-close>Đóng</button>
            <button class="ghost danger-ghost" type="button" data-account-signout>Đăng xuất</button>
          </div>
        </div>
      </div>`;
    root.hidden = false;
    root.querySelector('[data-account-close]').addEventListener('click', hideAuthScreen);
    root.querySelector('[data-account-signout]').addEventListener('click', signOut);
    root.querySelector('[data-account-password]').addEventListener('click', async () => {
      await requirePasswordSetup({ firstTime: false, allowCancel: true });
    });
    return root;
  }

  async function accountAction() {
    if (!profile) await loadProfile();
    accountScreen();
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
    getSnapshot: () => snapshot ? clone(snapshot) : null,
    listSourceFiles,
    uploadSourceFile,
    downloadSourceFile
  };
})();
