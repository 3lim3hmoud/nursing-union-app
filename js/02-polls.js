/* ========================= التصويت ========================= */
const pollVoteUnsubs = {};
let IS_ADMIN = false;
const myRegPending = {};

function optText(o){ return typeof o==='string' ? o : ((o && o.text) || ''); }
function optImg(o){ return (o && typeof o==='object') ? (o.imageURL||'') : ''; }
function pollClosed(p){ return !!(p.endsAt && p.endsAt.toDate && p.endsAt.toDate() < new Date()); }
function activePolls(){ return STATE.polls.filter(p=>!pollClosed(p)); }
function pollEndsIn(p){
  if(!p.endsAt || !p.endsAt.toDate) return 'مفتوح';
  const ms = p.endsAt.toDate() - Date.now();
  if(ms<=0) return 'انتهى';
  const m=Math.floor(ms/60000), h=Math.floor(m/60), d=Math.floor(h/24);
  if(d>=1) return 'باقي '+d+' يوم';
  if(h>=1) return 'باقي '+h+' ساعة';
  return 'باقي '+Math.max(m,1)+' دقيقة';
}
function myUid(){ return (fbReady && auth.currentUser) ? auth.currentUser.uid : null; }

/* التصويت بالعدّادات: الطالب بيقرا عدّاد كل اختيار (وثيقة صغيرة) مش كل الأصوات — أسرع بكتير وأرخص، وأصوات الباقي مش بتتبعتله.
   الأدمن (وأي جهاز القواعد عنده لسه قديمة) بيقرا الأصوات كاملة. */
const pollTallyUnsubs = {}, pollHealTimers = {};
let POLL_LEGACY = false;       /* بيتفعّل لو قراءة العدّادات اتمنعت (قواعد قديمة) */
const _pollLegacy = ()=> POLL_LEGACY || (typeof IS_ADMIN !== 'undefined' && IS_ADMIN);
function tallyFromSnap(snap){ const t = {}; snap.forEach(d=>{ t[d.id] = Number(d.data().n) || 0; }); return t; }
function myVoteKey(pid){ return 'nuVote_'+((auth.currentUser&&auth.currentUser.uid)||'')+'_'+pid; }
function readMyVote(pid){ try{ const v = localStorage.getItem(myVoteKey(pid)); return v===null ? undefined : Number(v); }catch(_){ return undefined; } }
function rememberMyVote(pid, idx){ STATE.myVote[pid] = idx; try{ localStorage.setItem(myVoteKey(pid), String(idx)); }catch(_){} }
function pollView(p){
  const me = myUid(), votes = STATE.pollVotes[p.id];
  let counts;
  if(votes){ counts = p.options.map(()=>0); Object.values(votes).forEach(i=>{ if(counts[i]!==undefined) counts[i]++; }); }
  else{ const t = STATE.pollTally[p.id] || {}; counts = p.options.map((_,i)=>Number(t[i])||0); }
  return { counts, total:counts.reduce((a,b)=>a+b,0), mine: me ? (votes ? votes[me] : STATE.myVote[p.id]) : undefined };
}
async function loadMyVote(p){
  if(STATE.myVote[p.id] !== undefined || STATE.myVoteLoaded[p.id]) return;
  const cached = readMyVote(p.id); if(cached !== undefined){ STATE.myVote[p.id] = cached; STATE.myVoteLoaded[p.id] = true; return; }
  STATE.myVoteLoaded[p.id] = true;
  try{
    const d = await db.collection('polls').doc(p.id).collection('votes').doc(auth.currentUser.uid).get();
    if(d.exists){ rememberMyVote(p.id, d.data().option); renderPolls(); }
  }catch(_){ STATE.myVoteLoaded[p.id] = false; }
}
/* التصويتات المنتهية: نتيجتها ثابتة، فبنقراها مرة (من الكاش لو موجودة) ومن غير مستمع */
async function loadClosedPollTallies(){
  if(!fbReady || !auth || !auth.currentUser || _pollLegacy()) return;
  const todo = STATE.polls.filter(p=>pollClosed(p) && !STATE.pollTally[p.id]);
  for(const p of todo){
    const ref = db.collection('polls').doc(p.id).collection('tally');
    let snap = null;
    try{ snap = await ref.get({ source:'cache' }); }catch(_){}
    if(!snap || snap.empty){ try{ snap = await ref.get(); }catch(e){ if(e && e.code==='permission-denied') POLL_LEGACY = true; continue; } }
    STATE.pollTally[p.id] = tallyFromSnap(snap);
    loadMyVote(p);
  }
  if(POLL_LEGACY) syncPollVotes(true); else renderPolls();
}
/* الأدمن: لو العدّاد مش مطابق للأصوات الفعلية (تصويتات قديمة أو جهاز قديم) بيصلّحه — الأصوات هي المصدر الأصلي */
function healPollTally(p){
  clearTimeout(pollHealTimers[p.id]);
  pollHealTimers[p.id] = setTimeout(async ()=>{
    if(typeof IS_ADMIN === 'undefined' || !IS_ADMIN || !STATE.pollVotes[p.id] || !STATE.pollTally[p.id]) return;
    const live = pollView(p).counts, t = STATE.pollTally[p.id], fix = [];
    live.forEach((n,i)=>{ if((Number(t[i])||0) !== n) fix.push([i,n]); });
    if(!fix.length) return;
    try{ const b = db.batch(); fix.forEach(([i,n])=>b.set(db.collection('polls').doc(p.id).collection('tally').doc(String(i)), { n })); await b.commit(); }catch(e){ console.warn('tally heal', e); }
  }, 2000);
}
function syncPollVotes(force){
  if(!fbReady) return;
  if(force){
    Object.keys(pollVoteUnsubs).forEach(id=>{ pollVoteUnsubs[id](); delete pollVoteUnsubs[id]; });
    Object.keys(pollTallyUnsubs).forEach(id=>{ pollTallyUnsubs[id](); delete pollTallyUnsubs[id]; });
    STATE.pollVotes = {}; STATE.pollTally = {};
  }
  const ids = new Set(STATE.polls.map(p=>p.id));
  [pollVoteUnsubs, pollTallyUnsubs].forEach(m=>Object.keys(m).forEach(id=>{ if(!ids.has(id)){ m[id](); delete m[id]; } }));
  Object.keys(STATE.pollVotes).forEach(id=>{ if(!ids.has(id)) delete STATE.pollVotes[id]; });
  if(!auth.currentUser) return; /* قراية الأصوات للمسجلين بس */
  STATE.polls.forEach(p=>{
    const poll = db.collection('polls').doc(p.id);
    if(_pollLegacy() && !pollVoteUnsubs[p.id]){
      pollVoteUnsubs[p.id] = poll.collection('votes').onSnapshot(snap=>{
        const m = {}; snap.forEach(v=>{ m[v.id] = v.data().option; });
        STATE.pollVotes[p.id] = m;
        renderPolls(); renderAdminPolls();
        if(IS_ADMIN && INS_VISIBLE()) admRenderInsights();
        if(IS_ADMIN) healPollTally(p);
      }, ()=>{});
    }
    /* عدّادات التصويتات الشغالة: مستمع صغير (عدد الاختيارات وثائق) */
    if(!pollTallyUnsubs[p.id] && (!pollClosed(p) || IS_ADMIN)){
      pollTallyUnsubs[p.id] = poll.collection('tally').onSnapshot(snap=>{
        STATE.pollTally[p.id] = tallyFromSnap(snap);
        renderPolls(); if(IS_ADMIN){ renderAdminPolls(); healPollTally(p); }
      }, err=>{
        if(err && err.code==='permission-denied' && !POLL_LEGACY){ POLL_LEGACY = true; syncPollVotes(true); }   /* قواعد قديمة: نرجع للطريقة القديمة */
      });
    }
    if(!_pollLegacy()) loadMyVote(p);
  });
}

function pollLoadError(err){
  STATE.pollErr = (err && err.code) || 'error';
  renderPolls();
}

function renderPolls(){
  const wrap = document.getElementById('pollList');
  if(wrap){
    wrap.innerHTML='';
    if(!STATE.polls.length){
      const msg = STATE.pollErr
        ? `تعذر تحميل التصويتات (${esc(STATE.pollErr)}).<br>اتأكد إن قواعد Firestore اتنشرت وإنك متصل بالإنترنت.`
        : (IS_ADMIN ? 'مفيش تصويتات لسه — ضيف أول تصويت من لوحة الأدمن 🗳️' : 'مفيش تصويتات حالياً');
      wrap.appendChild(el(`<div class="empty-note">${msg}</div>`));
    } else {
      const me = myUid();
      const list = [...activePolls(), ...STATE.polls.filter(pollClosed)];
      list.forEach(p=>{
        const pv = pollView(p), counts = pv.counts, total = pv.total, mine = pv.mine;
        const max = Math.max(0,...counts);
        const closed = pollClosed(p);
        const canVote = !closed && mine===undefined;
        const canSee = !!me;
        const showBars = canSee && (mine!==undefined || closed || IS_ADMIN);
        const opts = p.options.map((o,i)=>{
          const img = optImg(o) ? `<img class="poi" src="${esc(optImg(o))}" alt="" loading="lazy">` : '';
          const pct = total ? Math.round(counts[i]*100/total) : 0;
          const win = closed && showBars && max>0 && counts[i]===max;
          const bar = showBars ? `<span class="pbar" style="width:${pct}%"></span>` : '';
          const right = showBars ? `<span class="ppct">${win?'🏆 ':''}${pct}% · ${counts[i]}</span>` : (canVote ? '<span class="pdot"></span>' : '');
          const inner = `${bar}${img}<span class="prow"><span>${mine===i?'✓ ':''}${esc(optText(o))}</span>${right}</span>`;
          const cls = `poll-opt ${mine===i?'mine':''} ${win?'win':''}`;
          return canVote
            ? `<button type="button" class="${cls}" onclick="castVote('${p.id}',${i})">${inner}</button>`
            : `<div class="${cls}">${inner}</div>`;
        }).join('');
        const status = closed ? '<span class="poll-status closed">انتهى التصويت</span>' : '<span class="poll-status live"><i></i>مباشر</span>';
        const note = (closed && !canSee) ? '<div class="poll-note">سجّل دخولك من صفحة حسابي علشان تشوف النتيجة</div>' : '';
        wrap.appendChild(el(`<div class="card poll-card">
          ${p.imageURL ? `<img class="poll-cover" src="${esc(p.imageURL)}" alt="" loading="lazy">` : ''}
          <div class="poll-body">
            ${status}
            <div class="poll-q">${esc(p.question)}</div>
            ${p.description ? `<div class="poll-desc">${esc(p.description)}</div>` : ''}
            ${opts}
            ${note}
            <div class="poll-meta"><span>${canSee ? total+' صوت' : ''}</span><span>${closed ? '' : pollEndsIn(p)}</span></div>
          </div>
        </div>`));
      });
    }
  }
  renderHomePollBanner();
}

function renderHomePollBanner(){
  const box = document.getElementById('homePollBanner'); if(!box) return;
  const act = activePolls();
  if(!act.length){ box.innerHTML=''; return; }
  const p = act[0];
  const me = myUid();
  const pv = pollView(p);
  const voted = me && pv.mine!==undefined;
  const total = pv.total;
  const bg = p.imageURL ? `background-image:linear-gradient(180deg,rgba(8,20,50,.20),rgba(8,20,50,.90)),url('${esc(p.imageURL)}');` : '';
  box.innerHTML = `<div class="poll-banner" onclick="goPage('polls')" style="${bg}">
    <div class="pb-top"><span class="pb-badge"><i></i>تصويت جديد</span>${act.length>1 ? `<span class="pb-more">+${act.length-1} كمان</span>` : ''}</div>
    <div class="pb-q">${esc(p.question)}</div>
    <div class="pb-meta">${me ? total+' صوت · ' : ''}${pollEndsIn(p)}</div>
    <div class="pb-cta">${voted ? '✓ صوّتّ — شوف النتايج' : 'شارك برأيك الآن ←'}</div>
  </div>`;
}

function castVote(pollId, idx){
  if(!fbReady) return;
  const u = auth.currentUser;
  if(!u){ showToast('لازم تسجل دخولك الأول من صفحة حسابي'); goPage('profile'); return; }
  const p = STATE.polls.find(x=>x.id===pollId);
  if(!p || pollClosed(p)) return showToast('التصويت منتهي');
  if(pollView(p).mine!==undefined) return showToast('صوّتّ قبل كده');
  const poll = db.collection('polls').doc(pollId), vote = poll.collection('votes').doc(u.uid);
  const done = ()=>{
    rememberMyVote(pollId, idx);
    if(!STATE.pollVotes[pollId]){ const t = STATE.pollTally[pollId] = STATE.pollTally[pollId] || {}; t[idx] = (Number(t[idx])||0) + 1; }   /* ظهور فوري قبل رد السيرفر */
    showToast('تم تسجيل صوتك ✔'); renderPolls();
  };
  const batch = db.batch();
  batch.set(vote, { option: idx, createdAt: Date.now() });
  batch.set(poll.collection('tally').doc(String(idx)), { n: firebase.firestore.FieldValue.increment(1) }, { merge:true });
  batch.commit().then(done).catch(err=>{
    if(err && err.code==='permission-denied'){        /* قواعد قديمة لسه مفيهاش العدّادات: نسجّل الصوت لوحده */
      vote.set({ option: idx, createdAt: Date.now() }).then(done).catch(()=>showToast('مقدرتش أسجل صوتك، جرب تاني'));
    }else showToast('مقدرتش أسجل صوتك، جرب تاني');
  });
}

/* ----- لوحة الأدمن: إنشاء تصويت ----- */
function addPollOptRow(){
  const rows = document.getElementById('pollOptRows'); if(!rows) return;
  if(rows.children.length>=6){ showToast('الحد الأقصى 6 اختيارات'); return; }
  const n = rows.children.length+1;
  rows.appendChild(el(`<div class="poll-opt-row"><input class="po-text" placeholder="الاختيار ${n}"><label class="po-img" title="صورة للاختيار (اختياري)">🖼️<input type="file" accept="image/*" class="po-file" onchange="this.parentNode.classList.toggle('has', this.files.length>0)"></label></div>`));
}
function resetPollForm(){
  const f = document.getElementById('pollForm'); if(!f) return;
  f.reset();
  document.getElementById('pollOptRows').innerHTML='';
  addPollOptRow(); addPollOptRow();
}
async function savePoll(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const btn = document.getElementById('pollSubmitBtn');
  const question = document.getElementById('af-pollQ').value.trim();
  const desc = document.getElementById('af-pollDesc').value.trim();
  const ends = document.getElementById('af-pollEnds').value;
  const opts = [...document.querySelectorAll('#pollOptRows .poll-opt-row')]
    .map(r=>({ text:r.querySelector('.po-text').value.trim(), file:r.querySelector('.po-file').files[0] }))
    .filter(o=>o.text);
  if(!question || opts.length<2){ showToast('اكتب السؤال واختيارين على الأقل'); return false; }
  btn.disabled = true; btn.textContent = 'جاري النشر...';
  try{
    const item = { question, options:[], createdAt: Date.now() };
    if(desc) item.description = desc;
    const cover = document.getElementById('af-pollCover').files[0];
    if(cover){ const u = await uploadImage(cover,'polls'); if(u) item.imageURL = u; }
    for(const o of opts){
      const opt = { text:o.text };
      if(o.file){ const u = await uploadImage(o.file,'polls'); if(u) opt.imageURL = u; }
      item.options.push(opt);
    }
    if(ends) item.endsAt = firebase.firestore.Timestamp.fromDate(new Date(ends));
    await db.collection('polls').add(item);
    showToast('تم نشر التصويت ✔');
    resetPollForm();
  }catch(e){
    showToast('حصل خطأ، اتأكد إنك داخل بحساب الأدمن');
  }finally{
    btn.disabled = false; btn.textContent = 'نشر التصويت';
  }
  return false;
}
function closePoll(id){
  if(!requireFB()) return;
  db.collection('polls').doc(id).update({ endsAt: firebase.firestore.Timestamp.now() }).then(()=>showToast('تم إغلاق التصويت'));
}
function deletePoll(id){
  if(!requireFB() || !confirm('تحذف التصويت ده؟')) return;
  db.collection('polls').doc(id).delete().then(()=>showToast('تم الحذف'));
}
function renderAdminPolls(){
  const wrap = document.getElementById('admin-pollList'); if(!wrap) return;
  wrap.innerHTML='';
  STATE.polls.forEach(p=>{
    const n = Object.keys(STATE.pollVotes[p.id]||{}).length;
    wrap.appendChild(el(`<div class="admin-item-row"><div class="ai-info"><b>${esc(p.question)}</b><span>${n} صوت${pollClosed(p)?' · منتهي':''}</span></div><div class="ai-actions">${pollClosed(p)?'':`<button type="button" class="mini-btn" onclick="closePoll('${p.id}')">إغلاق</button> `}<button type="button" class="mini-btn danger" onclick="deletePoll('${p.id}')">حذف</button></div></div>`));
  });
}
resetPollForm();
/* بتتنادى من initApp() (13-init.js) بعد ما كل ملفات الـ js تتحمل.
   لو اتسجّل المستمع هنا مباشرة وFirebase رد بدري، كان بينادي دوال لسه متحمّلتش (renderAdminDash / renderActivities...) ويطلع ReferenceError. */
function startPollsAuthWatch(){
  try{ actKindChanged(); toggleMediaType(); }catch(e){}
  if(!fbReady) return;
  auth.onAuthStateChanged(async user=>{
    IS_ADMIN = await resolveIsAdmin(user);
    document.body.classList.toggle('is-admin', IS_ADMIN);
    if(IS_ADMIN){ loadAdminStats(); if(typeof admOnLogin==='function') admOnLogin(); renderAllAdmin(); }
    STATE.myRegs = {}; Object.keys(myRegPending).forEach(k=>delete myRegPending[k]);
    syncPollVotes(true); renderPolls(); renderAdminPolls(); renderAdminDash(); renderActivities();
  });
}

