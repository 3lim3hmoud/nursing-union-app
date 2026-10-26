/* =========================================================================
   إضافات: (1) لوحة تحكم v2  (2) شارات ومستويات  (3) إعلانات للطلاب (الشهادات في 17-certificate.js)
   ========================================================================= */

/* ============================ 1) لوحة التحكم v2 ============================ */
const ADM_QUICK = [
  {k:'news',ic:'📰',t:'خبر جديد'}, {k:'activities',ic:'🗓️',t:'فعالية جديدة'}, {k:'campaigns',ic:'📢',t:'حملة جديدة'},
  {k:'polls',ic:'🗳️',t:'تصويت جديد'}, {k:'announce',ic:'🔔',t:'إعلان للطلاب'}, {k:'media',ic:'🖼️',t:'ميديا'}
];
function admThumb(url, emoji){
  return url
    ? `<div class="ai-thumb" style="${esc("background-image:url('"+cssUrl(cld(url,'c_fill,w_120,h_120,q_auto,f_auto'))+"')")}"></div>`
    : `<div class="ai-thumb ph">${emoji||'•'}</div>`;
}
function admQuickOpen(k){
  openAdminSection(k);
  setTimeout(()=>{
    const f = document.querySelector('#adminSections details[data-sec="'+k+'"] form input:not([type=hidden]):not([type=file]):not([type=checkbox])');
    if(f) try{ f.focus({preventScroll:true}); }catch(_){}
  }, 120);
}
/* حاجات محتاجة تتابعها دلوقتي — بتتحسب من البيانات الحيّة */
function admAttention(){
  const now = Date.now(), DAY = 864e5, out = [];
  const up = STATE.activities.filter(a=>{ const s = actStart(a); return s && !actIsPast(a) && s.getTime()-now < 7*DAY; });
  if(up.length) out.push({ic:'⏰', t:up.length+' فعالية خلال 7 أيام', s:up.slice(0,2).map(a=>a.title).join('، '), k:'activities'});
  const full = STATE.activities.filter(a=>a.requiresRegistration && !a.registrationClosed && a.capacity && !actIsPast(a) && (a.registeredCount||0) >= a.capacity*0.9);
  if(full.length) out.push({ic:'🔥', t:'التسجيل قارب يكتمل', s:full.slice(0,2).map(a=>a.title+' ('+(a.registeredCount||0)+'/'+a.capacity+')').join('، '), k:'activities'});
  const stale = STATE.activities.filter(a=>a.requiresRegistration && actIsPast(a) && !a.registrationClosed);
  if(stale.length) out.push({ic:'🔓', t:'تسجيل مفتوح على فعاليات انتهت', s:stale.slice(0,2).map(a=>a.title).join('، ')+' — اقفله', k:'activities'});
  const ending = STATE.polls.filter(p=>!pollClosed(p) && p.endsAt && p.endsAt.toDate && p.endsAt.toDate().getTime()-now < DAY);
  if(ending.length) out.push({ic:'🗳️', t:'تصويت بينتهي خلال 24 ساعة', s:ending.slice(0,2).map(p=>p.question).join('، '), k:'polls'});
  const last = STATE.news.reduce((m,n)=>Math.max(m, n.createdAt||0), 0);
  if(STATE.news.length && now-last > 14*DAY) out.push({ic:'📰', t:'آخر خبر من '+Math.floor((now-last)/DAY)+' يوم', s:'الطلاب بيحبوا المحتوى الجديد — انشر خبر', k:'news'});
  return out;
}
function admV2Dash(){
  const dash = document.getElementById('adminDash'); if(!dash) return;
  const att = admAttention();
  const top = document.createElement('div');
  top.innerHTML =
    `<div class="adm-quick">${ADM_QUICK.map(q=>`<button type="button" data-q="${q.k}"><i>${q.ic}</i>${q.t}</button>`).join('')}</div>` +
    `<div class="adm-group">يحتاج انتباه</div><div class="adm-attn">` +
    (att.length ? att.map((x,i)=>`<button type="button" class="adm-att" data-a="${i}"><i>${x.ic}</i><div><b>${esc(x.t)}</b><span>${esc(x.s)}</span></div></button>`).join('')
                : `<div class="adm-ok">✅ كل حاجة تمام — مفيش حاجة محتاجة تدخّل دلوقتي</div>`) + `</div>`;
  dash.insertBefore(top, dash.firstChild);
  top.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click', ()=>admQuickOpen(b.dataset.q)));
  top.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click', ()=>openAdminSection(att[Number(b.dataset.a)].k)));
  admFilterTiles();
}
function admEnsureSearch(){
  if(document.getElementById('admGSearch')) return;
  const dash = document.getElementById('adminDash'); if(!dash || !dash.parentNode) return;
  const box = document.createElement('div'); box.className = 'adm-gsearch';
  box.innerHTML = '<input id="admGSearch" type="search" placeholder="🔍 دوّر في اللوحة: أخبار، طلاب، تصويت...">';
  dash.parentNode.insertBefore(box, dash);
  box.firstChild.addEventListener('input', admFilterTiles);
}
function admFilterTiles(){
  const inp = document.getElementById('admGSearch'); const q = normAr(inp ? inp.value : '');
  const dash = document.getElementById('adminDash'); if(!dash) return;
  dash.querySelectorAll('.adm-tile').forEach(t=>{ t.style.display = (!q || normAr(t.textContent).includes(q)) ? '' : 'none'; });
  dash.querySelectorAll('.adm-tiles').forEach(g=>{
    const any = [...g.children].some(t=>t.style.display!=='none');
    g.style.display = any ? '' : 'none';
    const prev = g.previousElementSibling; if(prev && prev.classList.contains('adm-group')) prev.style.display = any ? '' : 'none';
  });
}
const ADM_LISTS = ['admin-newsList','admin-campList','admin-pollList'];   /* قايمة الفعاليات ليها بحث جاهز */
function admListFilter(wrap){
  const q = normAr(wrap._q || '');
  [...wrap.children].forEach(r=>{ r.style.display = (!q || normAr(r.textContent).includes(q)) ? '' : 'none'; });
}
function admEnsureListSearch(){
  ADM_LISTS.forEach(id=>{
    const wrap = document.getElementById(id); if(!wrap || wrap._admSearch || !wrap.parentNode) return;
    wrap._admSearch = true;
    const inp = document.createElement('input');
    inp.type = 'search'; inp.placeholder = '🔍 بحث في القايمة'; inp.className = 'adm-list-search';
    inp.addEventListener('input', ()=>{ wrap._q = inp.value; admListFilter(wrap); });
    wrap.parentNode.insertBefore(inp, wrap);
    new MutationObserver(()=>admListFilter(wrap)).observe(wrap, {childList:true});
  });
}
const _admDashOrig = renderAdminDash;
renderAdminDash = function(){ _admDashOrig(); admEnsureSearch(); admV2Dash(); admEnsureListSearch(); };

/* ============================ 2) شارات ومستويات ============================ */
const LV_STEPS = [[0,'منخفض'],[30,'متوسط'],[80,'عالي'],[150,'ممتاز']];   /* نفس حدود levelFromPoints */
function stuBadges(){
  const P = Number(STUDENT.points)||0, E = Number(STUDENT.events)||0, W = Number(STUDENT.workshops)||0, C = Number(STUDENT.competitions)||0, K = Number(STUDENT.campaigns)||0;
  const isSow = !!(STATE.studentOfWeek && STATE.studentOfWeek.uid && STATE.studentOfWeek.uid===STUDENT.uid);
  return [
    {id:'start', ic:'🌱', t:'بداية',          h:'اكسب أول نقطة',               on:P>=1},
    {id:'active',ic:'🏅', t:'طالب نشط',       h:'30 نقطة',                      on:P>=30},
    {id:'high',  ic:'⭐', t:'نشاط عالي',      h:'80 نقطة',                      on:P>=80},
    {id:'top',   ic:'👑', t:'ممتاز',          h:'150 نقطة',                     on:P>=150},
    {id:'reg',   ic:'🎟️', t:'حاضر دايماً',    h:'احضر 5 فعاليات',               on:E>=5},
    {id:'work',  ic:'🛠️', t:'ورش',            h:'3 ورش',                         on:W>=3},
    {id:'comp',  ic:'🏆', t:'بطل مسابقة',     h:'شارك في مسابقة',               on:C>0},
    {id:'vol',   ic:'🤝', t:'متطوع',          h:'شارك في ورشة/تطوع',            on:W>0},
    {id:'camp',  ic:'💙', t:'صاحب حملات',     h:'شارك في حملتين',               on:K>=2},
    {id:'sow',   ic:'🌟', t:'طالب الأسبوع',   h:'اتختارت طالب الأسبوع',         on:isSow}
  ];
}
function stuLevelInfo(){
  const P = Number(STUDENT.points)||0; let i = 0;
  LV_STEPS.forEach((s,k)=>{ if(P >= s[0]) i = k; });
  const cur = LV_STEPS[i], nxt = LV_STEPS[i+1];
  return { name:cur[1], next:nxt ? nxt[1] : null, left:nxt ? nxt[0]-P : 0, pct:nxt ? Math.round((P-cur[0])/(nxt[0]-cur[0])*100) : 100 };
}
function extrasProfile(){
  if(!STUDENT.uid) return;
  const wrap = document.getElementById('achievCard'); if(!wrap) return;
  const L = stuLevelInfo(), B = stuBadges();
  let lc = document.getElementById('lvlCard');
  if(!lc){ lc = document.createElement('div'); lc.id = 'lvlCard'; lc.className = 'card lvl-card'; wrap.previousElementSibling.insertAdjacentElement('afterend', lc); }
  lc.innerHTML = `<div class="lvl-top"><b>مستواك: ${esc(L.name)}</b><span>${L.next ? 'باقي '+L.left+' نقطة على «'+esc(L.next)+'»' : 'وصلت لأعلى مستوى 🎉'}</span></div>
    <div class="lvl-bar"><i style="width:${L.pct}%"></i></div>`;
  wrap.style.display = 'grid';
  wrap.innerHTML = B.map(b=>`<div class="bdg ${b.on?'on':''}" title="${esc(b.h)}"><i>${b.ic}</i><b>${esc(b.t)}</b><span>${b.on?'✔':esc(b.h)}</span></div>`).join('');
  /* شارة جديدة؟ (أول مرة بنخزّن من غير إشعار عشان القديم) */
  try{
    const key = 'nuBadges_'+STUDENT.uid, earned = B.filter(b=>b.on).map(b=>b.id), raw = localStorage.getItem(key);
    if(raw !== null){
      const old = JSON.parse(raw||'[]'), fresh = B.filter(b=>b.on && !old.includes(b.id));
      if(fresh.length) showToast('🎉 حصلت على شارة جديدة: '+fresh[0].t);
    }
    localStorage.setItem(key, JSON.stringify(earned));
  }catch(_){}
}
const _renderProfileOrig = renderProfile;
renderProfile = function(){ _renderProfileOrig(); extrasProfile(); };

/* ============================ 3) إعلانات للطلاب ============================ */
const ANN = { list:[], seenAtLoad:0, first:true, unsub:null };
function annMine(a){
  const lv = String(a.level||'').trim();
  if(!lv || lv==='all') return true;
  if(typeof IS_ADMIN!=='undefined' && IS_ADMIN) return true;
  return normAr(STUDENT.level||'').includes(normAr(lv));
}
function annSeen(){ try{ return Number(localStorage.getItem('nuAnnSeen'))||0; }catch(_){ return 0; } }
function annUnread(){ const s = annSeen(); return ANN.list.filter(a=>annMine(a) && (a.createdAt||0) > s).length; }
function annRenderBell(){
  const b = document.getElementById('bellN'); if(!b) return;
  const n = annUnread(); b.textContent = n > 9 ? '9+' : String(n); b.style.display = n ? 'flex' : 'none';
  annRenderHome();
}
function annRenderHome(){
  let box = document.getElementById('homeAnn');
  const page = document.getElementById('page-home'); if(!page) return;
  const latest = ANN.list.filter(annMine)[0];
  const fresh = latest && (Date.now() - (latest.createdAt||0)) < 7*864e5;
  let dismissed = ''; try{ dismissed = localStorage.getItem('nuAnnHide')||''; }catch(_){}
  if(!fresh || dismissed === latest.id){ if(box) box.remove(); return; }
  if(!box){ box = document.createElement('div'); box.id = 'homeAnn'; box.className = 'home-ann'; page.insertBefore(box, page.firstChild); }
  box.innerHTML = `<i>📢</i><div><b>${esc(latest.title)}</b><span>${esc(String(latest.body||'').slice(0,110))}</span></div><button type="button" aria-label="إخفاء">✕</button>`;
  box.querySelector('div').addEventListener('click', openAnnouncements);
  box.querySelector('button').addEventListener('click', ev=>{ ev.stopPropagation(); try{ localStorage.setItem('nuAnnHide', latest.id); }catch(_){} box.remove(); });
}
function openAnnouncements(){
  const m = document.getElementById('annModal'); if(!m) return;
  const mine = ANN.list.filter(annMine), s = annSeen();
  document.getElementById('annList').innerHTML = mine.length ? mine.map(a=>`<div class="ann-item ${(a.createdAt||0)>s?'new':''}"><b>${esc(a.title)}</b><p>${esc(a.body||'')}</p><span>${new Date(a.createdAt||0).toLocaleString('ar-EG')}${a.level&&a.level!=='all'?' · '+esc(a.level):''}</span></div>`).join('')
    : '<div class="empty-note">لا إعلانات حالياً</div>';
  m.classList.add('show');
  try{ localStorage.setItem('nuAnnSeen', String(Math.max(0, ...ANN.list.map(a=>a.createdAt||0)))); }catch(_){}
  annRenderBell();
}
function closeAnnouncements(){ const m = document.getElementById('annModal'); if(m) m.classList.remove('show'); }
function annStart(){
  if(!fbReady || ANN.unsub) return;
  ANN.seenAtLoad = Date.now();
  ANN.unsub = db.collection('announcements').orderBy('createdAt','desc').limit(30).onSnapshot(sn=>{
    ANN.list = sn.docs.map(d=>({id:d.id, ...d.data()}));
    if(!ANN.first){
      sn.docChanges().filter(c=>c.type==='added').forEach(c=>{
        const a = {id:c.doc.id, ...c.doc.data()};
        if(!annMine(a) || (a.createdAt||0) < ANN.seenAtLoad) return;
        const title = '📢 '+(a.title||'إعلان جديد');
        if(document.visibilityState==='visible'){ showToast(title); }
        else if(typeof notifEnabled==='function' && notifEnabled() && navigator.serviceWorker){
          navigator.serviceWorker.ready.then(r=>r.showNotification(title, { body:String(a.body||'').slice(0,100), icon:'images/icon-192.png', badge:'images/icon-192.png', dir:'rtl', lang:'ar', tag:'nu-ann', data:{url:'./'} })).catch(()=>{});
        }
      });
    }
    ANN.first = false;
    annRenderBell(); annRenderAdmin();
  }, err=>console.warn('announcements listener:', err && err.code));
}
const _deferredOrig = initDeferredListeners;
initDeferredListeners = function(){ _deferredOrig(); annStart(); };

/* ----- جانب الأدمن: قسم الإعلانات ----- */
ADMIN_SECTIONS.push({k:'announce', ic:'🔔', t:'إعلانات للطلاب', g:'الرئيسية', c:()=>ANN.list.length});
function annEnsureAdminSection(){
  const host = document.getElementById('adminSections'); if(!host || host.querySelector('[data-sec="announce"]')) return;
  const d = document.createElement('details'); d.className = 'admin-box'; d.dataset.sec = 'announce';
  d.innerHTML = `<summary>🔔 إعلانات للطلاب</summary>
    <form id="annForm">
      <input required id="af-annTitle" maxlength="80" placeholder="عنوان الإعلان">
      <textarea required id="af-annBody" rows="3" maxlength="400" placeholder="نص الإعلان"></textarea>
      <input id="af-annLevel" maxlength="40" placeholder="لمين؟ سيبه فاضي = كل الطلاب، أو اكتب المستوى زي: مستوى 3">
      <button class="btn-primary" type="submit">إرسال الإعلان</button>
      <p class="adm-sub" style="margin:6px 0 0;">الطلاب بيشوفوه في 🔔 وعلى الرئيسية أول ما يفتحوا التطبيق (وإشعار لو مفعّلينه).</p>
    </form>
    <div id="annAdminList" style="padding:0 14px 12px;"></div>`;
  host.appendChild(d);
  d.querySelector('#annForm').addEventListener('submit', async ev=>{
    ev.preventDefault();
    if(!requireFB()) return;
    const f = ev.currentTarget, btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    try{
      const v = id=>f.querySelector('#'+id).value.trim();
      await db.collection('announcements').add({ title:v('af-annTitle'), body:v('af-annBody'),
        level:v('af-annLevel') || 'all', createdAt:Date.now(), by:(auth.currentUser&&auth.currentUser.email)||'' });
      f.reset(); showToast('اتبعت الإعلان للطلاب ✔');
    }catch(e){ showToast('مقدرتش أبعت الإعلان — اتأكد إنك أدمن وإن القواعد منشورة'); }
    btn.disabled = false;
  });
  annRenderAdmin();
}
function annRenderAdmin(){
  const w = document.getElementById('annAdminList'); if(!w) return;
  w.innerHTML = '';
  if(!ANN.list.length){ w.innerHTML = '<div class="empty-note">لسه مفيش إعلانات</div>'; return; }
  ANN.list.forEach(a=>{
    const row = document.createElement('div'); row.className = 'admin-item-row';
    row.innerHTML = `<div class="ai-info"><b>${esc(a.title)}</b><span>${new Date(a.createdAt||0).toLocaleDateString('ar-EG')} · ${a.level&&a.level!=='all'?esc(a.level):'كل الطلاب'}</span></div><div class="ai-actions"><button type="button" class="mini-btn danger">حذف</button></div>`;
    row.querySelector('button').addEventListener('click', ()=>{ if(confirm('تحذف الإعلان ده؟')) db.collection('announcements').doc(a.id).delete().catch(()=>showToast('مقدرتش أحذف')); });
    w.appendChild(row);
  });
}
annEnsureAdminSection();
