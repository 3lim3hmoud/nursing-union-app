/* =========================================================================
   الطلاب + التفاعل + التقييم التلقائي (للأدمن)  |  وكارت الطالب (للكل)
   ========================================================================= */

/* ---------- أدوات صغيرة ---------- */
function avStyle(name, photo){
  return photo ? "background:url('"+cssUrl(photo)+"') center/cover no-repeat" : 'background:'+avatarGradient(name||'؟');
}
function avInner(name, photo){ return photo ? '' : esc(((name||'؟').trim()[0])||'؟'); }
function levelFromPoints(p){
  p = Number(p)||0;
  if(p >= 150) return 'ممتاز';
  if(p >= 80)  return 'عالي';
  if(p >= 30)  return 'متوسط';
  return 'منخفض';
}
function sortedBoard(){ return [...STATE.leaderboard].sort((a,b)=>(Number(b.points)||0)-(Number(a.points)||0)); }
function myRank(){
  if(!STUDENT.uid) return '—';
  const i = sortedBoard().findIndex(x=>x.uid===STUDENT.uid || x.id===STUDENT.uid);
  return i<0 ? '—' : i+1;
}
function fmtDateTime(ms){ try{ return new Date(ms).toLocaleString('ar-EG'); }catch(e){ return ''; } }

/* تحديث بيانات الطالب الحالي (نقاطه وإحصائياته) كل ما يفتح صفحة حسابي */
let _refreshingMe = false;
async function refreshMyStudent(){
  if(_refreshingMe || !STUDENT.uid || !fbReady) return;
  _refreshingMe = true;
  try{
    const snap = await db.collection('students').doc(STUDENT.uid).get();
    if(snap.exists){
      const d = snap.data();
      STUDENT.points = d.points||0; STUDENT.events = d.events||0;
      STUDENT.workshops = d.workshops||0; STUDENT.competitions = d.competitions||0; STUDENT.campaigns = d.campaigns||0;
      renderProfile();
    }
  }catch(e){} finally{ _refreshingMe = false; }
}

/* ---------- كارت الطالب (يظهر للكل: من الترتيب وطالب الأسبوع) ---------- */
function openStuCard(o){
  if(!o) return;
  const box = document.getElementById('scBody'); if(!box) return;
  const rankTxt = o.rank ? `<div class="sc-chip">🏆 ترتيبه <b>#${esc(o.rank)}</b></div>` : '';
  box.innerHTML = `
    <div class="sc-av" style="${esc(avStyle(o.name, o.photoURL))}">${avInner(o.name, o.photoURL)}</div>
    <b class="sc-name">${esc(o.name||'—')}</b>
    ${o.level ? `<div class="sc-level">${esc(o.level)}</div>` : ''}
    <div class="sc-chips">
      <div class="sc-chip">🏅 <b>${esc(o.points||0)}</b> نقطة</div>
      ${rankTxt}
      ${o.points!=null ? `<div class="sc-chip">⭐ ${esc(levelFromPoints(o.points))}</div>` : ''}
    </div>`;
  document.getElementById('stuCardModal').classList.add('show');
}
function closeStuCard(){ document.getElementById('stuCardModal').classList.remove('show'); }
function openSowCard(){
  const s = STATE.studentOfWeek; if(!s || !s.name || s.name==='—') return;
  const i = sortedBoard().findIndex(x=>x.uid && x.uid===s.uid);
  openStuCard({ name:s.name, level:s.level, photoURL:s.photoURL, points:s.points, rank: i<0 ? '' : i+1 });
}

/* =========================================================================
   الأدمن
   ========================================================================= */
let ADM_STU = [], ADM_STU_MAP = {};
let ADM_RULES = { enabled:false, vote:2, like:1, interest:1, register:2, lastSync:0 };

async function admLoadStudents(force){
  if(!fbReady || !IS_ADMIN) return ADM_STU;
  if(ADM_STU.length && !force) return ADM_STU;
  const sn = await db.collection('students').limit(3000).get();
  ADM_STU = sn.docs.map(d=>({ id:d.id, ...d.data() }));
  ADM_STU_MAP = {}; ADM_STU.forEach(s=>{ ADM_STU_MAP[s.id] = s; });
  ADM_STUDENTS = ADM_STU.length;
  if(typeof adminDashRefresh==='function') adminDashRefresh();
  return ADM_STU;
}
function stuNameOf(uid){ const s = ADM_STU_MAP[uid]; return s ? (s.name||'—') : 'طالب غير معروف'; }

async function admLoadRules(){
  try{
    const d = await db.collection('config').doc('pointsRules').get();
    if(d.exists) ADM_RULES = { ...ADM_RULES, ...d.data() };
  }catch(e){}
}

/* بيتنادى من مستمع الدخول لما نتأكد إن المستخدم أدمن */
async function admOnLogin(){
  if(!fbReady || !IS_ADMIN) return;
  try{
    await admLoadRules();
    await admLoadStudents();
    admFillSowSelect();
    if(ADM_RULES.enabled && Date.now() - (Number(ADM_RULES.lastSync)||0) > 6*3600*1000) admSyncPoints(false);
  }catch(e){}
}
function admOnSection(key){
  if(key==='students'){ admLoadStudents().then(admRenderStudents).catch(()=>{}); admRenderStudents(); }
  if(key==='insights'){ if(typeof syncPollVotes==='function') syncPollVotes(); admLoadStudents().then(admRenderInsights).catch(()=>{}); admRenderInsights(); }
  if(key==='rating'){ admLoadRules().then(admRenderRating); admRenderRating(); }
  if(key==='sow'){ admLoadStudents().then(admFillSowSelect).catch(()=>{}); }
}

/* ---------- قسم الطلاب ---------- */
let STU_Q = '';
function admRenderStudents(){
  const wrap = document.getElementById('admStuList'); if(!wrap) return;
  const q = normAr(STU_Q);
  let list = [...ADM_STU].sort((a,b)=>(a.name||'').localeCompare(b.name||'','ar'));
  if(q) list = list.filter(s=>normAr((s.name||'')+' '+(s.studentId||'')+' '+(s.level||'')).includes(q));
  document.getElementById('admStuCount').textContent = ADM_STU.length ? `${list.length} من ${ADM_STU.length} طالب` : 'جاري التحميل...';
  wrap.innerHTML = '';
  if(!list.length){ wrap.appendChild(el('<div class="empty-note">مفيش طلاب</div>')); return; }
  list.slice(0,150).forEach(s=>{
    const row = el(`<div class="stu-row"><div class="stu-av" style="${esc(avStyle(s.name, s.photoURL))}">${avInner(s.name, s.photoURL)}</div><div class="stu-info"><b>${esc(s.name||'—')}</b><span>${esc(s.studentId||'—')} · ${esc(s.level||'')}</span></div><div class="pts-pill">${esc(s.points||0)}</div></div>`);
    row.addEventListener('click', ()=>openStuEditor(s.id));
    wrap.appendChild(row);
  });
  if(list.length>150) wrap.appendChild(el('<div class="empty-note">اكتب في البحث عشان تضيّق النتايج (أول 150 بس)</div>'));
}

let STU_EDIT = { uid:null, removePhoto:false };
async function openStuEditor(uid){
  const s = ADM_STU_MAP[uid]; if(!s) return;
  STU_EDIT = { uid, removePhoto:false };
  document.getElementById('seName').value = s.name || '';
  document.getElementById('seLevel').value = s.level || '';
  document.getElementById('seBio').value = s.bio || '';
  document.getElementById('sePoints').value = Number(s.points)||0;
  document.getElementById('seHide').checked = !!s.hideFromRanking;
  document.getElementById('seFile').value = '';
  setAvatarEl(document.getElementById('seAvatar'), s.name, s.photoURL, ((s.name||'؟').trim()[0])||'؟');
  document.getElementById('seRemove').style.display = s.photoURL ? '' : 'none';
  document.getElementById('seMeta').innerHTML =
    `<span>🆔 ${esc(s.studentId||'—')}</span><span>✉️ ${esc(s.email||'—')}</span>` + (s.createdAt ? `<span>📅 انضم ${esc(fmtDateTime(s.createdAt))}</span>` : '');
  const votes = STATE.polls.filter(p=>STATE.pollVotes[p.id] && STATE.pollVotes[p.id][uid]!==undefined).length;
  const likes = STATE.news.filter(n=>(n.likeUids||[]).includes(uid)).length;
  const interested = STATE.activities.filter(a=>(a.interestedUids||[]).includes(uid));
  document.getElementById('seStats').innerHTML =
    `<div><b>${votes}</b><span>تصويت</span></div><div><b>${likes}</b><span>إعجاب</span></div><div><b>${interested.length}</b><span>اهتمام</span></div><div><b>${esc(s.events||0)}</b><span>فعاليات</span></div>`;
  const hist = document.getElementById('seHistory');
  hist.innerHTML = '<div class="empty-note">جاري تحميل نشاطه...</div>';
  document.getElementById('admStuModal').classList.add('show');
  try{
    const regActs = STATE.activities.filter(a=>a.requiresRegistration).slice(0,80);
    const snaps = await Promise.all(regActs.map(a=>db.collection('activities').doc(a.id).collection('registrations').doc(uid).get()));
    if(STU_EDIT.uid !== uid) return;
    const rows = [];
    regActs.forEach((a,i)=>{
      const d = snaps[i];
      if(d.exists) rows.push(`<div class="seh-row"><b>${esc(a.title)}</b><span>${d.data().attended ? '✔ حضر' : 'مسجّل'}</span></div>`);
    });
    interested.forEach(a=>rows.push(`<div class="seh-row"><b>${esc(a.title)}</b><span>⭐ مهتم</span></div>`));
    STATE.polls.forEach(p=>{
      const m = STATE.pollVotes[p.id];
      if(m && m[uid]!==undefined) rows.push(`<div class="seh-row"><b>${esc(p.question)}</b><span>🗳️ ${esc(optText((p.options||[])[m[uid]])||'صوّت')}</span></div>`);
    });
    hist.innerHTML = rows.length ? rows.join('') : '<div class="empty-note">لسه معملش أي تفاعل</div>';
  }catch(e){ hist.innerHTML = '<div class="empty-note">مقدرتش أحمّل نشاطه</div>'; }
}
function closeStuEditor(){ document.getElementById('admStuModal').classList.remove('show'); }
function stuPreviewPhoto(input){
  const f = input.files[0]; if(!f) return;
  STU_EDIT.removePhoto = false;
  const r = new FileReader();
  r.onload = e=>{
    const av = document.getElementById('seAvatar');
    av.style.background = "url('"+e.target.result+"') center/cover no-repeat";
    av.textContent=''; av.classList.add('has-photo');
    document.getElementById('seRemove').style.display='';
  };
  r.readAsDataURL(f);
}
function stuRemovePhoto(){
  STU_EDIT.removePhoto = true;
  document.getElementById('seFile').value = '';
  const name = document.getElementById('seName').value.trim() || '؟';
  setAvatarEl(document.getElementById('seAvatar'), name, '', name.trim()[0]||'؟');
  document.getElementById('seRemove').style.display = 'none';
}
/* نسخة عامة من بيانات الطالب في collection الترتيب (اسم + صورة + نقاط بس — مفيش إيميل ولا رقم جامعي) */
function admMirrorData(s){
  return { uid:s.id, name:s.name||'طالب', level:s.level||'', photoURL:s.photoURL||'', points:Number(s.points)||0, createdAt:Number(s.createdAt)||Date.now(), auto:true };
}
function admBoardRef(uid){ return db.collection('leaderboard').doc(uid); }
async function saveStuEditor(){
  const uid = STU_EDIT.uid; const s = ADM_STU_MAP[uid]; if(!uid || !s || !requireFB()) return;
  const name = document.getElementById('seName').value.trim();
  if(!name){ showToast('اكتب اسم الطالب'); return; }
  const btn = document.getElementById('seSave'); btn.disabled = true; btn.textContent = 'جاري الحفظ...';
  try{
    const upd = {
      name, level: document.getElementById('seLevel').value.trim(),
      bio: document.getElementById('seBio').value.trim(),
      points: Math.floor(Number(document.getElementById('sePoints').value)||0),
      hideFromRanking: document.getElementById('seHide').checked
    };
    const f = document.getElementById('seFile').files[0];
    if(f){
      const u = await uploadImage(await resizeImage(f,800),'students');
      if(!u){ btn.disabled=false; btn.textContent='حفظ'; return; }
      upd.photoURL = u;
    }else if(STU_EDIT.removePhoto){ upd.photoURL = ''; }
    await db.collection('students').doc(uid).update(upd);
    Object.assign(s, upd);
    if(upd.hideFromRanking || upd.points<=0) await admBoardRef(uid).delete().catch(()=>{});
    else await admBoardRef(uid).set(admMirrorData(s), {merge:true});
    showToast('تم حفظ ملف الطالب ✔');
    admRenderStudents(); closeStuEditor();
  }catch(e){ showToast('مقدرتش أحفظ — اتأكد إنك داخل بحساب الأدمن'); }
  finally{ btn.disabled = false; btn.textContent = 'حفظ'; }
}
async function makeSow(){
  const uid = STU_EDIT.uid; const s = ADM_STU_MAP[uid]; if(!s || !requireFB()) return;
  try{
    await db.collection('config').doc('studentOfWeek').set({ uid, name:s.name||'', initial:((s.name||'؟').trim()[0])||'؟', level:s.level||'', points:Number(s.points)||0, photoURL:s.photoURL||'' });
    showToast('تم اختياره طالب الأسبوع ⭐');
  }catch(e){ showToast('مقدرتش أحفظ'); }
}

/* ---------- طالب الأسبوع (اختيار من الطلاب + صورة) ---------- */
function admFillSowSelect(){
  const sel = document.getElementById('af-sowStudent'); if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— اختار طالب من المسجلين (أو اكتب يدوي) —</option>' +
    [...ADM_STU].sort((a,b)=>(a.name||'').localeCompare(b.name||'','ar')).map(s=>`<option value="${esc(s.id)}">${esc(s.name||'—')} — ${esc(s.studentId||'')}</option>`).join('');
  sel.value = cur;
}
function sowStudentChanged(){
  const uid = document.getElementById('af-sowStudent').value; const s = ADM_STU_MAP[uid]; if(!s) return;
  document.getElementById('af-sowName').value = s.name || '';
  document.getElementById('af-sowLevel').value = s.level || '';
  document.getElementById('af-sowPoints').value = Number(s.points)||0;
}

/* ---------- التفاعل والإحصائيات ---------- */
let INS_TAB = 'polls';
function insSetTab(t){ INS_TAB = t; admRenderInsights(); }
function admRenderInsights(){
  const box = document.getElementById('insBody'); if(!box) return;
  document.querySelectorAll('#insTabs button').forEach(b=>b.classList.toggle('on', b.dataset.t===INS_TAB));
  const names = (uids)=>`<ol class="ins-names">${uids.map(u=>`<li>${esc(stuNameOf(u))}</li>`).join('')}</ol>`;
  const more = (label, uids)=> uids.length ? `<details class="ins-more"><summary>${label} (${uids.length})</summary>${names(uids)}</details>` : '';

  let totalVotes = 0; STATE.polls.forEach(p=>{ totalVotes += Object.keys(STATE.pollVotes[p.id]||{}).length; });
  const totalLikes = STATE.news.reduce((n,x)=>n+(x.likeUids||[]).length,0);
  const totalInt = STATE.activities.reduce((n,x)=>n+(x.interestedUids||[]).length,0);
  const totalReg = STATE.activities.reduce((n,x)=>n+(Number(x.registeredCount)||0),0);
  let html = `<div class="ins-sum"><div><b>${ADM_STU.length}</b><span>طالب</span></div><div><b>${totalVotes}</b><span>صوت</span></div><div><b>${totalLikes}</b><span>إعجاب</span></div><div><b>${totalInt}</b><span>اهتمام</span></div><div><b>${totalReg}</b><span>تسجيل</span></div></div>`;

  if(INS_TAB==='polls'){
    if(!STATE.polls.length) html += '<div class="empty-note">مفيش تصويتات</div>';
    STATE.polls.forEach(p=>{
      const m = STATE.pollVotes[p.id] || {}; const uids = Object.keys(m);
      const opts = (p.options||[]).map((o,i)=>{
        const who = uids.filter(u=>m[u]===i);
        const pct = uids.length ? Math.round(who.length*100/uids.length) : 0;
        return `<div class="ins-opt"><div class="ins-bar"><i style="width:${pct}%"></i><span>${esc(optText(o))}</span><b>${who.length} · ${pct}%</b></div>${more('مين اختاره', who)}</div>`;
      }).join('');
      html += `<div class="ins-card"><div class="ins-h"><b>${esc(p.question)}</b><span>${uids.length} صوت${pollClosed(p)?' · منتهي':''}</span></div>${opts}</div>`;
    });
  }else if(INS_TAB==='likes'){
    if(!STATE.news.length) html += '<div class="empty-note">مفيش أخبار</div>';
    STATE.news.forEach(n=>{
      const u = n.likeUids||[];
      html += `<div class="ins-card"><div class="ins-h"><b>${esc(n.title)}</b><span>❤ ${u.length}</span></div>${more('مين أعجبه', u) || '<div class="adm-sub">لسه مفيش إعجابات</div>'}</div>`;
    });
  }else{
    if(!STATE.activities.length) html += '<div class="empty-note">مفيش فعاليات</div>';
    STATE.activities.forEach(a=>{
      const u = a.interestedUids||[];
      html += `<div class="ins-card"><div class="ins-h"><b>${esc(a.title)}</b><span>${esc(a.date||'')}</span></div>
        <div class="ins-chips"><i>⭐ مهتم ${u.length}</i>${a.requiresRegistration?`<i>✅ مسجل ${Number(a.registeredCount)||0}${a.capacity?'/'+esc(a.capacity):''}</i>`:''}</div>
        ${more('مين مهتم', u)}
        ${a.requiresRegistration?`<button type="button" class="mini-btn" data-reg="${esc(a.id)}">المسجلين والحضور</button>`:''}</div>`;
    });
  }
  box.innerHTML = html;
  box.querySelectorAll('[data-reg]').forEach(b=>b.addEventListener('click', ()=>openRegList(b.dataset.reg)));
}

/* ---------- التقييم التلقائي ---------- */
function admRenderRating(){
  const R = ADM_RULES;
  const set = (id,v)=>{ const n=document.getElementById(id); if(n) n.value = v; };
  const en = document.getElementById('rt-enabled'); if(en) en.checked = !!R.enabled;
  set('rt-vote', R.vote); set('rt-like', R.like); set('rt-interest', R.interest); set('rt-register', R.register);
  const st = document.getElementById('rtStatus');
  if(st) st.textContent = R.lastSync ? 'آخر تحديث: '+fmtDateTime(R.lastSync) : 'لسه ما اتعملش تحديث';
}
async function admSaveRules(){
  if(!requireFB()) return;
  const num = id=>Math.max(0, Math.floor(Number(document.getElementById(id).value)||0));
  const data = { enabled: document.getElementById('rt-enabled').checked, vote:num('rt-vote'), like:num('rt-like'), interest:num('rt-interest'), register:num('rt-register') };
  try{ await db.collection('config').doc('pointsRules').set(data, {merge:true}); ADM_RULES = { ...ADM_RULES, ...data }; showToast('تم حفظ إعدادات التقييم ✔'); }
  catch(e){ showToast('مقدرتش أحفظ'); }
}
let _syncing = false;
async function admSyncPoints(manual){
  if(_syncing || !fbReady || !IS_ADMIN) return;
  _syncing = true;
  const st = document.getElementById('rtStatus');
  if(manual && st) st.textContent = 'جاري الحساب...';
  try{
    const R = ADM_RULES;
    /* بنقرا كل حاجة من Firestore مباشرة (مش من الحالة المحلية) عشان لو حاجة ناقصة ما نخصمش نقاط بالغلط */
    const [stu, pollsSn, newsSn, actSn] = await Promise.all([
      admLoadStudents(true),
      db.collection('polls').limit(2000).get(),
      db.collection('news').limit(2000).get(),
      db.collection('activities').limit(2000).get()
    ]);
    const votes = {}, likes = {}, intr = {}, regs = {};
    const bump = (o,k)=>{ o[k] = (o[k]||0)+1; };
    await Promise.all(pollsSn.docs.map(async p=>{
      const sn = await db.collection('polls').doc(p.id).collection('votes').get();
      sn.forEach(v=>bump(votes, v.id));
    }));
    newsSn.forEach(n=>(n.data().likeUids||[]).forEach(u=>bump(likes,u)));
    actSn.forEach(a=>(a.data().interestedUids||[]).forEach(u=>bump(intr,u)));
    await Promise.all(actSn.docs.filter(a=>a.data().requiresRegistration).map(async a=>{
      const sn = await db.collection('activities').doc(a.id).collection('registrations').get();
      sn.forEach(r=>bump(regs, r.id));
    }));

    const boardMap = {}; STATE.leaderboard.forEach(r=>{ boardMap[r.uid||r.id] = r; });
    let batch = db.batch(), ops = 0, changed = 0, total = 0;
    const flush = async ()=>{ if(ops){ await batch.commit(); batch = db.batch(); ops = 0; } };
    for(const s of stu){
      const auto = (votes[s.id]||0)*R.vote + (likes[s.id]||0)*R.like + (intr[s.id]||0)*R.interest + (regs[s.id]||0)*R.register;
      const prev = Number(s.autoPoints)||0;
      const delta = auto - prev;
      const ref = db.collection('students').doc(s.id);
      if(delta !== 0){
        batch.update(ref, { points: firebase.firestore.FieldValue.increment(delta), autoPoints: auto });
        s.points = (Number(s.points)||0) + delta; s.autoPoints = auto; ops++; changed++;
      }
      const visible = !s.hideFromRanking && (Number(s.points)||0) > 0;
      const onBoard = boardMap[s.id];
      /* نكتب في الترتيب بس لو فيه تغيير فعلاً (توفير للكتابات في الخطة المجانية) */
      if(visible){
        const m = admMirrorData(s);
        if(!onBoard || onBoard.name!==m.name || onBoard.level!==m.level || onBoard.photoURL!==m.photoURL || (Number(onBoard.points)||0)!==m.points){
          batch.set(admBoardRef(s.id), m, {merge:true}); ops++;
        }
      }else if(onBoard){ batch.delete(admBoardRef(s.id)); ops++; }
      total++;
      if(ops >= 400) await flush();
    }
    await flush();
    const now = Date.now();
    await db.collection('config').doc('pointsRules').set({ lastSync: now }, {merge:true});
    ADM_RULES.lastSync = now;
    if(st) st.textContent = `تم ✔ — اتحدّث تقييم ${changed} طالب من ${total} · ${fmtDateTime(now)}`;
    if(manual) showToast('تم تحديث التقييم ✔');
    admRenderStudents();
  }catch(e){
    console.error('sync error', e);
    if(st) st.textContent = 'حصل خطأ ومفيش حاجة اتغيّرت — جرّب تاني';
    if(manual) showToast('مقدرتش أحدّث التقييم');
  }finally{ _syncing = false; }
}

function INS_VISIBLE(){
  const d = document.querySelector('#adminSections > details[data-sec="insights"]');
  return !!(d && d.classList.contains('sec-active'));
}
