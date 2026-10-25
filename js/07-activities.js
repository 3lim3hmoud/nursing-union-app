/* ========================= الأنشطة ========================= */
let actFilter='all';
function renderActivityTabs(){
  const wrap = document.getElementById('actFilterTabs');
  const cats = ['all', ...Object.keys(CATS)];
  wrap.innerHTML='';
  cats.forEach(c=>{
    const label = c==='all' ? 'الكل' : CATS[c].label;
    wrap.appendChild(el(`<div class="pill-tab ${c===actFilter?'active':''}" data-c="${c}">${label}</div>`));
  });
  wrap.querySelectorAll('.pill-tab').forEach(t=>t.addEventListener('click',()=>{
    actFilter = t.dataset.c; renderActivityTabs(); renderActivities();
  }));
}
function iconForCat(cat){
  if(cat==='scientific') return '<path d="M9 2v6L4 20a1 1 0 001 1h14a1 1 0 001-1L15 8V2"/><path d="M9 2h6"/>';
  if(cat==='cultural') return '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>';
  if(cat==='sports') return '<circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 000 20M2 12h20"/>';
  if(cat==='artistic') return '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1"/><circle cx="14" cy="9" r="1"/><circle cx="15" cy="14" r="1"/>';
  return '<path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M12 12a4 4 0 100-8 4 4 0 000 8z"/>';
}
/* ===== الفعاليات والمؤتمرات: أدوات مساعدة ===== */
const KINDS = { activity:{label:'نشاط',icon:'🎯'}, event:{label:'فعالية',icon:'🎉'}, conference:{label:'مؤتمر',icon:'🎤'}, workshop:{label:'ورشة عمل',icon:'🛠️'} };
function actStart(a){ return a.startAt && a.startAt.toDate ? a.startAt.toDate() : null; }
function actEnd(a){ return a.endAt && a.endAt.toDate ? a.endAt.toDate() : null; }
function actIsPast(a){
  const st = actStart(a); if(!st) return false;
  const en = actEnd(a) || new Date(st.getTime() + 3*3600*1000);
  return en < new Date();
}
function fmtArDate(d){ return d.toLocaleString('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit'}); }
function relWhen(d){
  const t0 = new Date(); t0.setHours(0,0,0,0);
  const d0 = new Date(d); d0.setHours(0,0,0,0);
  const diff = Math.round((d0 - t0)/86400000);
  if(diff<0) return 'انتهت';
  if(diff===0) return 'النهاردة';
  if(diff===1) return 'بكرة';
  if(diff===2) return 'بعد يومين';
  return diff<=10 ? 'بعد '+diff+' أيام' : 'بعد '+diff+' يوم';
}
function seatsLeft(a){ return a.capacity ? Math.max(0, a.capacity - (a.registeredCount||0)) : null; }
function toLocalInput(ts){
  if(!ts || !ts.toDate) return '';
  const d = ts.toDate(), p = n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function nextActivity(){
  const now = Date.now();
  return STATE.activities.filter(a=>actStart(a) && actStart(a).getTime()>now).sort((x,y)=>actStart(x)-actStart(y))[0] || null;
}
function homeNextEvent(){
  const manual = STATE.nextEvent, mT = new Date(manual.date).getTime();
  const a = nextActivity();
  if(a && (!(mT>Date.now()) || actStart(a).getTime() < mT)){
    return { name:a.title, place:a.place, image:a.photoURL || manual.image, date:actStart(a).toISOString(), activityId:a.id };
  }
  return manual;
}
function ensureMyRegs(){
  if(!fbReady || !STUDENT.uid) return;
  const need = STATE.activities.filter(a=>a.requiresRegistration && STATE.myRegs[a.id]===undefined && !myRegPending[a.id]);
  if(!need.length) return;
  need.forEach(a=>{ myRegPending[a.id] = true; });
  Promise.all(need.map(a=>db.collection('activities').doc(a.id).collection('registrations').doc(STUDENT.uid).get()
    .then(d=>{ STATE.myRegs[a.id] = d.exists; }).catch(()=>{ STATE.myRegs[a.id] = false; })
  )).then(()=>renderActivities());
}

function renderActivities(){
  const wrap = document.getElementById('actList');
  wrap.innerHTML='';
  let list = STATE.activities.filter(a=>actFilter==='all'||a.cat===actFilter);
  const up = list.filter(a=>actStart(a) && !actIsPast(a)).sort((x,y)=>actStart(x)-actStart(y));
  const none = list.filter(a=>!actStart(a));
  const past = list.filter(a=>actStart(a) && actIsPast(a)).sort((x,y)=>actStart(y)-actStart(x));
  list = [...up, ...none, ...past];
  if(!list.length){wrap.appendChild(el('<div class="empty-note">لا توجد أنشطة في هذا التصنيف حالياً</div>'));return;}
  list.forEach((a,i)=>{
    const c=CATS[a.cat]||CATS.scientific;
    const interestedCount = (a.interestedUids||[]).length;
    const past = actIsPast(a);
    const thumb = a.photoURL
      ? `<img src="${esc(a.photoURL)}" alt="${esc(a.title)}" loading="lazy" decoding="async">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;
    const kind = a.kind && a.kind!=='activity' && KINDS[a.kind] ? `<span class="ev-chip kind">${KINDS[a.kind].icon} ${KINDS[a.kind].label}</span>` : '';
    const st = actStart(a);
    const when = st ? `<span class="ev-chip ${past?'past':''}">${past?'انتهت':'⏰ '+relWhen(st)}</span>` : '';
    let seat = '';
    if(a.requiresRegistration && !past){
      const left = seatsLeft(a);
      if(STATE.myRegs[a.id]) seat = '<span class="ev-chip ok">✔ مسجّل</span>';
      else if(a.registrationClosed) seat = '<span class="ev-chip warn">التسجيل مقفول</span>';
      else if(left===0) seat = '<span class="ev-chip warn">اكتمل العدد</span>';
      else seat = `<span class="ev-chip ok">${left!==null ? 'متبقي '+left+' مكان' : 'التسجيل مفتوح'}</span>`;
    }
    const card = el(`
      <div class="card event-card ${past?'is-past':''}" style="animation-delay:${Math.min(i*0.05,0.4)}s;">
        <div class="ev-thumb" style="background:linear-gradient(135deg, ${c.color}, #0d1836)">
          ${thumb}
          ${interestedCount ? `<div class="interest-badge">⭐ ${interestedCount}</div>` : ''}
        </div>
        <div class="ev-body">
          <span class="cat" style="background:${c.color}22;color:${c.color}">${esc(c.label)}</span>
          <b>${esc(a.title)}</b>
          <div class="meta"><span>📅 ${esc(a.date||'')}</span><span>📍 ${esc(a.place)}</span></div>
          <div class="ev-chips">${kind}${when}${seat}</div>
        </div>
      </div>
    `);
    card.addEventListener('click', ()=>openActivityModal(a.id));
    wrap.appendChild(card);
  });
  ensureMyRegs();
  if(modalActivityId){ const m = STATE.activities.find(x=>x.id===modalActivityId); if(m && m.requiresRegistration) refreshRegBox(m); }
}

/* ========================= مودال تفاصيل النشاط ========================= */
let modalActivityId = null;
function openActivityModal(id){
  const a = STATE.activities.find(x=>x.id===id); if(!a) return;
  modalActivityId = id;
  const c = CATS[a.cat]||CATS.scientific;
  const kindLbl = a.kind && KINDS[a.kind] && a.kind!=='activity' ? KINDS[a.kind].icon+' '+KINDS[a.kind].label+' · ' : '';
  document.getElementById('modalCat').textContent = kindLbl + c.label;
  document.getElementById('modalCat').style.background = c.color+'22';
  document.getElementById('modalCat').style.color = c.color;
  document.getElementById('modalTitle').textContent = a.title;
  const st = actStart(a);
  document.getElementById('modalDate').textContent = '📅 '+(a.date||'') + (st && !actIsPast(a) ? ' · '+relWhen(st) : '');
  document.getElementById('modalPlace').textContent = '📍 '+a.place;
  document.getElementById('modalDesc').textContent = a.desc || 'مفيش تفاصيل إضافية للنشاط ده لسه.';
  document.getElementById('modalHeroWrap').innerHTML = a.photoURL
    ? `<img class="modal-hero" src="${esc(a.photoURL)}" alt="${esc(a.title)}">`
    : `<div class="modal-hero-fallback" style="background:linear-gradient(135deg, ${c.color}, #0d1836)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>`;
  let extra = '';
  if((a.speakers||[]).length){
    extra += `<div class="mx-h">🎤 المتحدثون</div><div class="spk-grid">` + a.speakers.map(sp=>{
      const ph = sp.photoURL ? `style="background-image:url('${esc(sp.photoURL)}')"` : `style="background:${avatarGradient(sp.name)}"`;
      return `<div class="spk"><div class="spk-ph" ${ph}>${sp.photoURL?'':esc((sp.name||'?')[0])}</div><b>${esc(sp.name)}</b>${sp.role?`<span>${esc(sp.role)}</span>`:''}</div>`;
    }).join('') + `</div>`;
  }
  if((a.agenda||[]).length){
    extra += `<div class="mx-h">🗓️ برنامج اليوم</div><div class="agenda">` + a.agenda.map(g=>
      `<div class="ag-item"><div class="ag-time">${esc(g.time||'')}</div><div class="ag-body"><b>${esc(g.title)}</b>${g.speaker?`<span>${esc(g.speaker)}</span>`:''}</div></div>`
    ).join('') + `</div>`;
  }
  document.getElementById('modalExtra').innerHTML = extra;
  const needsReg = !!a.requiresRegistration;
  document.getElementById('regBox').style.display = needsReg ? '' : 'none';
  const ib = document.getElementById('modalInterestBtn');
  ib.style.display = needsReg ? 'none' : '';
  if(needsReg){ refreshRegBox(a); ensureMyRegs(); }
  else {
    const uids = a.interestedUids || [];
    const already = STUDENT.uid && uids.includes(STUDENT.uid);
    ib.textContent = already ? `✔ سجّلت اهتمامك${uids.length?' ('+uids.length+')':''}` : `أنا مهتم بالحضور ⭐${uids.length?' ('+uids.length+')':''}`;
    ib.disabled = !!already;
  }
  document.getElementById('activityModal').classList.add('show');
}
function closeActivityModal(){
  document.getElementById('activityModal').classList.remove('show');
  modalActivityId = null;
}
function refreshRegBox(a){
  const mine = !!STATE.myRegs[a.id];
  const cnt = a.registeredCount || 0, cap = a.capacity || 0;
  const left = seatsLeft(a), past = actIsPast(a);
  const btn = document.getElementById('regBtn');
  let info = cap ? `المسجلين: <b>${cnt}</b> من ${cap} — ${left>0 ? 'متبقي '+left+' مكان' : 'اكتمل العدد'}`
                 : `عدد المسجلين: <b>${cnt}</b>`;
  if(cap) info += `<div class="reg-bar"><i style="width:${Math.min(100,Math.round(cnt*100/cap))}%"></i></div>`;
  if(a.points>0) info += `<div style="font-size:11px;color:var(--muted);margin-top:6px;">🎁 بتاخد ${a.points} نقطة لما يتأكد حضورك</div>`;
  document.getElementById('regInfo').innerHTML = info;
  btn.classList.toggle('cancel', mine);
  if(mine){ btn.textContent = past ? '✔ كنت مسجّل' : 'إلغاء التسجيل'; btn.disabled = past; }
  else if(past){ btn.textContent = 'الفعالية انتهت'; btn.disabled = true; }
  else if(a.registrationClosed){ btn.textContent = 'التسجيل مقفول'; btn.disabled = true; }
  else if(left===0){ btn.textContent = 'اكتمل العدد'; btn.disabled = true; }
  else { btn.textContent = 'سجّل حضورك ✅'; btn.disabled = false; }
}
async function toggleRegistration(){
  if(!STUDENT.uid){ showToast('لازم تسجل دخولك الأول من صفحة حسابي'); closeActivityModal(); goPage('profile'); return; }
  const a = STATE.activities.find(x=>x.id===modalActivityId); if(!a || !fbReady) return;
  const btn = document.getElementById('regBtn');
  const mine = !!STATE.myRegs[a.id];
  if(mine && !confirm('تلغي تسجيلك في «'+a.title+'»؟')) return;
  btn.disabled = true;
  try{
    const ref = db.collection('activities').doc(a.id);
    const regRef = ref.collection('registrations').doc(STUDENT.uid);
    const batch = db.batch();
    if(mine){
      batch.delete(regRef);
      batch.update(ref, { registeredCount: firebase.firestore.FieldValue.increment(-1) });
    } else {
      batch.set(regRef, { uid:STUDENT.uid, name:STUDENT.name, studentId:STUDENT.studentId||'', level:STUDENT.level||'', createdAt:Date.now(), attended:false });
      batch.update(ref, { registeredCount: firebase.firestore.FieldValue.increment(1) });
    }
    await batch.commit();
    STATE.myRegs[a.id] = !mine;
    showToast(mine ? 'تم إلغاء تسجيلك' : 'تم تسجيلك ✔ نشوفك هناك!');
    renderActivities();
  }catch(e){
    showToast(mine ? 'مقدرتش ألغي التسجيل، جرّب تاني' : 'مقدرتش أسجلك — يمكن العدد اكتمل أو التسجيل اتقفل');
  }
  refreshRegBox(STATE.activities.find(x=>x.id===a.id) || a);
}
async function markInterested(){
  if(!STUDENT.uid){ showToast('لازم تسجل دخولك الأول من صفحة حسابي'); closeActivityModal(); goPage('profile'); return; }
  if(!modalActivityId || !fbReady) return;
  const btn = document.getElementById('modalInterestBtn');
  btn.disabled = true;
  try{
    await db.collection('activities').doc(modalActivityId).update({
      interestedUids: firebase.firestore.FieldValue.arrayUnion(STUDENT.uid)
    });
    await db.collection('students').doc(STUDENT.uid).update({
      events: firebase.firestore.FieldValue.increment(1)
    });
    STUDENT.events += 1;
    renderProfile();
    showToast('تم تسجيل اهتمامك بالنشاط ✔');
  }catch(e){
    btn.disabled = false;
    showToast('حصل خطأ، جرّب تاني');
  }
}

