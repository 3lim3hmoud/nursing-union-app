/* =========================================================================
   لوحة التحكم — حفظ/تعديل/حذف كل نوع محتوى في Firestore
   ========================================================================= */
function requireFB(){ if(!fbReady){ showToast('لازم تحط بيانات Firebase في firebase-config.js الأول'); return false; } return true; }

/* --- الحدث القادم --- */
function saveNextEvent(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const name = document.getElementById('af-evName').value.trim();
  const place = document.getElementById('af-evPlace').value.trim();
  const dateVal = document.getElementById('af-evDate').value;
  const imageVal = document.getElementById('af-evImage').value.trim();
  if(!name || !place || !dateVal) return false;
  const iso = new Date(dateVal).toISOString();
  const data = {name, place, date: iso};
  if(imageVal) data.image = imageVal;
  db.collection('config').doc('nextEvent').set(data, {merge:true})
    .then(()=>showToast('تم تحديث الحدث القادم ✔'));
  return false;
}

/* --- طالب الأسبوع --- */
function saveStudentOfWeek(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const name = document.getElementById('af-sowName').value.trim();
  const level = document.getElementById('af-sowLevel').value.trim();
  const points = Number(document.getElementById('af-sowPoints').value)||0;
  if(!name || !level) return false;
  const initial = name.trim()[0];
  db.collection('config').doc('studentOfWeek').set({name, initial, level, points})
    .then(()=>showToast('تم تحديث طالب الأسبوع ✔'));
  return false;
}

/* --- الأنشطة --- */
function addSpeakerRow(sp){
  const rows = document.getElementById('actSpeakerRows');
  const row = el(`<div class="poll-opt-row spk-row"><input class="spk-name" placeholder="الاسم"><input class="spk-role" placeholder="الصفة / الوظيفة"><label class="po-img" title="صورة">📷<input type="file" accept="image/*" class="spk-file" onchange="this.parentNode.classList.toggle('has', this.files.length>0)"></label><button type="button" class="mini-btn danger" onclick="this.parentNode.remove()">✕</button></div>`);
  if(sp){ row.querySelector('.spk-name').value = sp.name||''; row.querySelector('.spk-role').value = sp.role||''; if(sp.photoURL){ row.dataset.photo = sp.photoURL; row.querySelector('.po-img').classList.add('has'); } }
  rows.appendChild(row);
}
function addAgendaRow(g){
  const rows = document.getElementById('actAgendaRows');
  const row = el(`<div class="poll-opt-row ag-row"><input class="ag-time" placeholder="10:00" style="max-width:76px;"><input class="ag-title" placeholder="الفقرة"><input class="ag-spk" placeholder="المتحدث (اختياري)"><button type="button" class="mini-btn danger" onclick="this.parentNode.remove()">✕</button></div>`);
  if(g){ row.querySelector('.ag-time').value = g.time||''; row.querySelector('.ag-title').value = g.title||''; row.querySelector('.ag-spk').value = g.speaker||''; }
  rows.appendChild(row);
}
function actKindChanged(){
  const k = document.getElementById('af-actKind').value;
  document.getElementById('actConfFields').style.display = (k==='conference' || k==='workshop') ? '' : 'none';
  if(!document.getElementById('af-actId').value) document.getElementById('af-actReg').checked = (k!=='activity');
}
function resetActForm(){
  const f = document.getElementById('actForm'); if(!f) return;
  f.reset();
  document.getElementById('af-actId').value = '';
  document.getElementById('actSpeakerRows').innerHTML = '';
  document.getElementById('actAgendaRows').innerHTML = '';
  document.getElementById('af-actSubmitBtn').textContent = 'إضافة';
  document.getElementById('af-actCancelEdit').style.display = 'none';
  actKindChanged();
}
function editActivity(id){
  const a = STATE.activities.find(x=>x.id===id); if(!a) return;
  resetActForm();
  document.getElementById('af-actId').value = id;
  document.getElementById('af-actKind').value = a.kind || 'activity';
  document.getElementById('af-actTitle').value = a.title;
  document.getElementById('af-actCat').value = a.cat;
  document.getElementById('af-actStart').value = toLocalInput(a.startAt);
  document.getElementById('af-actEnd').value = toLocalInput(a.endAt);
  document.getElementById('af-actDate').value = a.startAt ? '' : (a.date || '');
  document.getElementById('af-actPlace').value = a.place;
  document.getElementById('af-actDesc').value = a.desc || '';
  document.getElementById('af-actReg').checked = !!a.requiresRegistration;
  document.getElementById('af-actCap').value = a.capacity || '';
  document.getElementById('af-actPts').value = a.points || '';
  (a.speakers||[]).forEach(addSpeakerRow);
  (a.agenda||[]).forEach(addAgendaRow);
  document.getElementById('af-actSubmitBtn').textContent = 'حفظ التعديل';
  document.getElementById('af-actCancelEdit').style.display = '';
  actKindChanged();
  document.getElementById('af-actReg').checked = !!a.requiresRegistration;
  openAdminSection('activities');
}
function deleteActivity(id){
  if(!confirm('حذف النشاط ده؟')) return;
  db.collection('activities').doc(id).delete().then(()=>showToast('تم الحذف ✔'));
}
function toggleRegClosed(id){
  const a = STATE.activities.find(x=>x.id===id); if(!a || !requireFB()) return;
  db.collection('activities').doc(id).update({ registrationClosed: !a.registrationClosed })
    .then(()=>showToast(a.registrationClosed ? 'اتفتح التسجيل ✔' : 'اتقفل التسجيل ✔'));
}
async function saveActivity(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const btn = document.getElementById('af-actSubmitBtn');
  const id = document.getElementById('af-actId').value;
  const title = document.getElementById('af-actTitle').value.trim();
  const place = document.getElementById('af-actPlace').value.trim();
  const startV = document.getElementById('af-actStart').value;
  const endV = document.getElementById('af-actEnd').value;
  const dateText = document.getElementById('af-actDate').value.trim();
  if(!title || !place){ showToast('اكتب الاسم والمكان'); return false; }
  if(!startV && !dateText){ showToast('حدد تاريخ ووقت البداية'); return false; }
  btn.disabled = true; btn.textContent = 'جاري الحفظ...';
  try{
    const DEL = firebase.firestore.FieldValue.delete();
    const item = {
      kind: document.getElementById('af-actKind').value,
      cat: document.getElementById('af-actCat').value,
      title, place,
      desc: document.getElementById('af-actDesc').value.trim(),
      requiresRegistration: document.getElementById('af-actReg').checked,
      points: Math.max(0, Math.floor(Number(document.getElementById('af-actPts').value)||0))
    };
    if(startV){ const d = new Date(startV); item.startAt = firebase.firestore.Timestamp.fromDate(d); item.date = fmtArDate(d); }
    else { item.date = dateText; if(id) item.startAt = DEL; }
    if(endV) item.endAt = firebase.firestore.Timestamp.fromDate(new Date(endV)); else if(id) item.endAt = DEL;
    const cap = Math.floor(Number(document.getElementById('af-actCap').value)||0);
    if(cap>0) item.capacity = cap; else if(id) item.capacity = DEL;
    const spk = [];
    for(const r of document.querySelectorAll('#actSpeakerRows .spk-row')){
      const name = r.querySelector('.spk-name').value.trim(); if(!name) continue;
      const o = { name, role: r.querySelector('.spk-role').value.trim() };
      const f = r.querySelector('.spk-file').files[0];
      if(f){ const u = await uploadImage(await resizeImage(f,600),'speakers'); if(u) o.photoURL = u; }
      else if(r.dataset.photo) o.photoURL = r.dataset.photo;
      spk.push(o);
    }
    item.speakers = spk;
    item.agenda = [...document.querySelectorAll('#actAgendaRows .ag-row')].map(r=>({
      time: r.querySelector('.ag-time').value.trim(), title: r.querySelector('.ag-title').value.trim(), speaker: r.querySelector('.ag-spk').value.trim()
    })).filter(g=>g.title);
    const file = document.getElementById('af-actPhoto').files[0];
    if(file){ const u = await uploadImage(await resizeImage(file,1400),'activities'); if(u) item.photoURL = u; }
    if(id) await db.collection('activities').doc(id).update(item);
    else await db.collection('activities').add({ ...item, interestedUids:[], registeredCount:0, createdAt:Date.now() });
    showToast(id ? 'تم حفظ التعديل ✔' : 'تمت الإضافة ✔');
    resetActForm();
  }catch(e){
    showToast('حصل خطأ في الحفظ، اتأكد إنك داخل بحساب الأدمن');
  }finally{
    btn.disabled = false;
    if(!document.getElementById('af-actId').value) btn.textContent = 'إضافة'; else btn.textContent = 'حفظ التعديل';
  }
  return false;
}
function renderAdminActivities(){
  const wrap = document.getElementById('admin-actList'); if(!wrap) return;
  wrap.innerHTML='';
  STATE.activities.forEach(a=>{
    const k = a.kind && KINDS[a.kind] ? KINDS[a.kind].label : ((CATS[a.cat]||{}).label||a.cat);
    const reg = a.requiresRegistration ? ` · ${a.registeredCount||0}${a.capacity?'/'+a.capacity:''} مسجل${a.registrationClosed?' (مقفول)':''}` : '';
    wrap.appendChild(el(`
      <div class="admin-item-row">
        <div class="ai-info"><b>${esc(a.title)}</b><span>${esc(k)} · ${esc(a.date||'')}${reg}</span></div>
        <div class="ai-actions" style="flex-wrap:wrap;justify-content:flex-end;">
          ${a.requiresRegistration ? `<button type="button" class="mini-btn" onclick="openRegList('${a.id}')">المسجلين</button><button type="button" class="mini-btn" onclick="toggleRegClosed('${a.id}')">${a.registrationClosed?'فتح التسجيل':'قفل التسجيل'}</button>` : ''}
          <button type="button" class="mini-btn" onclick="editActivity('${a.id}')">تعديل</button>
          <button type="button" class="mini-btn danger" onclick="deleteActivity('${a.id}')">حذف</button>
        </div>
      </div>
    `));
  });
}

/* ----- قايمة المسجلين + الحضور + التصدير ----- */
let REG = { id:null, a:null, items:[] };
async function openRegList(id){
  const a = STATE.activities.find(x=>x.id===id); if(!a || !requireFB()) return;
  REG = { id, a, items:[] };
  document.getElementById('rlTitle').textContent = 'المسجلين في «'+a.title+'»';
  document.getElementById('rlSummary').textContent = 'جاري التحميل...';
  document.getElementById('rlList').innerHTML = '';
  document.getElementById('regListModal').classList.add('show');
  try{
    const snap = await db.collection('activities').doc(id).collection('registrations').orderBy('createdAt').get();
    REG.items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderRegList();
  }catch(e){ document.getElementById('rlSummary').textContent = 'مقدرتش أحمّل القايمة'; }
}
function closeRegList(){ document.getElementById('regListModal').classList.remove('show'); }
function renderRegList(){
  const att = REG.items.filter(x=>x.attended).length;
  document.getElementById('rlSummary').textContent = `${REG.items.length} مسجل · ${att} حضروا` + (REG.a.points>0 ? ` · ${REG.a.points} نقطة لكل حاضر` : '');
  const box = document.getElementById('rlList'); box.innerHTML='';
  if(!REG.items.length){ box.appendChild(el('<div class="empty-note">لسه محدش سجّل</div>')); return; }
  REG.items.forEach(it=>{
    const row = el(`<div class="rl-item"><div><b>${esc(it.name||'—')}</b><span>${esc(it.studentId||'—')} · ${esc(it.level||'')}</span></div><button type="button" class="rl-att ${it.attended?'on':''}">${it.attended?'✔ حضر':'تأكيد الحضور'}</button></div>`);
    row.querySelector('button').addEventListener('click', ()=>toggleAttend(it.id));
    box.appendChild(row);
  });
}
async function toggleAttend(uid){
  const it = REG.items.find(x=>x.id===uid); if(!it) return;
  const to = !it.attended, pts = REG.a.points || 0;
  try{
    const batch = db.batch();
    const ref = db.collection('activities').doc(REG.id);
    batch.update(ref.collection('registrations').doc(uid), { attended: to });
    if(pts>0) batch.update(db.collection('students').doc(uid), { points: firebase.firestore.FieldValue.increment(to ? pts : -pts) });
    await batch.commit();
    it.attended = to; renderRegList();
  }catch(e){ showToast('مقدرتش أحدّث الحضور'); }
}
function exportRegCsv(){
  if(!REG.items.length){ showToast('مفيش مسجلين للتصدير'); return; }
  const q = v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const rows = [['الاسم','الرقم الجامعي','المستوى','وقت التسجيل','الحضور']].concat(REG.items.map(i=>[i.name,i.studentId,i.level,new Date(i.createdAt||0).toLocaleString('ar-EG'),i.attended?'حضر':'لم يحضر']));
  const csv = '\uFEFF' + rows.map(r=>r.map(q).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = 'registrants-'+(REG.a.title||'event')+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

/* --- حملات التوعية --- */
function editCampaign(id){
  const c = STATE.campaigns.find(x=>x.id===id); if(!c) return;
  document.getElementById('af-campId').value = id;
  document.getElementById('af-campTitle').value = c.title;
  document.getElementById('af-campDesc').value = c.desc;
  document.getElementById('af-campDate').value = c.date;
  document.getElementById('af-campPlace').value = c.place;
  document.getElementById('af-campCat').value = c.cat;
  document.getElementById('af-campStatus').value = c.status;
  document.getElementById('af-campSubmitBtn').textContent = 'حفظ التعديل';
  openAdminSection('campaigns');
}
function deleteCampaign(id){
  if(!confirm('حذف الحملة دي؟')) return;
  db.collection('campaigns').doc(id).delete().then(()=>showToast('تم الحذف ✔'));
}
function saveCampaign(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const status = document.getElementById('af-campStatus').value;
  const palettes = {current:['#1b3a6b','#0d1836'], upcoming:['#7a1f2f','#1b2c5c'], past:['#1f6b4a','#132147']};
  const item = {
    status,
    title: document.getElementById('af-campTitle').value.trim(),
    desc: document.getElementById('af-campDesc').value.trim(),
    date: document.getElementById('af-campDate').value.trim(),
    place: document.getElementById('af-campPlace').value.trim(),
    cat: document.getElementById('af-campCat').value.trim(),
    color1: palettes[status][0], color2: palettes[status][1]
  };
  if(!item.title||!item.desc) return false;
  const id = document.getElementById('af-campId').value;
  const p = id ? db.collection('campaigns').doc(id).update(item)
               : db.collection('campaigns').add({...item, createdAt:Date.now()});
  p.then(()=>{
    showToast(id?'تم حفظ التعديل ✔':'تمت إضافة الحملة ✔');
    ev.target.reset(); document.getElementById('af-campId').value='';
    document.getElementById('af-campSubmitBtn').textContent='إضافة';
  });
  return false;
}
function renderAdminCampaigns(){
  const wrap = document.getElementById('admin-campList'); if(!wrap) return;
  wrap.innerHTML='';
  STATE.campaigns.forEach(c=>{
    wrap.appendChild(el(`
      <div class="admin-item-row">
        <div class="ai-info"><b>${esc(c.title)}</b><span>${esc(c.status)} · ${esc(c.date)}</span></div>
        <div class="ai-actions">
          <button type="button" class="mini-btn" onclick="editCampaign('${c.id}')">تعديل</button>
          <button type="button" class="mini-btn danger" onclick="deleteCampaign('${c.id}')">حذف</button>
        </div>
      </div>
    `));
  });
}

/* --- المجلات --- */
function editMagazine(id){
  const m = STATE.magazines.find(x=>x.id===id); if(!m) return;
  document.getElementById('af-magId').value = id;
  document.getElementById('af-magTitle').value = m.title;
  document.getElementById('af-magDesc').value = m.desc;
  document.getElementById('af-magDate').value = m.date;
  document.getElementById('af-magType').value = m.type;
  document.getElementById('af-magSubmitBtn').textContent = 'حفظ التعديل';
  openAdminSection('magazines');
}
function deleteMagazine(id){
  if(!confirm('حذف المقال ده؟')) return;
  db.collection('magazines').doc(id).delete().then(()=>showToast('تم الحذف ✔'));
}
function saveMagazine(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const item = {
    type: document.getElementById('af-magType').value,
    title: document.getElementById('af-magTitle').value.trim(),
    desc: document.getElementById('af-magDesc').value.trim(),
    date: document.getElementById('af-magDate').value.trim(),
  };
  if(!item.title||!item.desc) return false;
  const id = document.getElementById('af-magId').value;
  const p = id ? db.collection('magazines').doc(id).update(item)
               : db.collection('magazines').add({...item, createdAt:Date.now()});
  p.then(()=>{
    showToast(id?'تم حفظ التعديل ✔':'تمت إضافة المقال ✔');
    ev.target.reset(); document.getElementById('af-magId').value='';
    document.getElementById('af-magSubmitBtn').textContent='إضافة';
  });
  return false;
}
function renderAdminMagazines(){
  const wrap = document.getElementById('admin-magList'); if(!wrap) return;
  wrap.innerHTML='';
  STATE.magazines.forEach(m=>{
    wrap.appendChild(el(`
      <div class="admin-item-row">
        <div class="ai-info"><b>${esc(m.title)}</b><span>${m.type==='scientific'?'علمي':'ثقافي'} · ${esc(m.date)}</span></div>
        <div class="ai-actions">
          <button type="button" class="mini-btn" onclick="editMagazine('${m.id}')">تعديل</button>
          <button type="button" class="mini-btn danger" onclick="deleteMagazine('${m.id}')">حذف</button>
        </div>
      </div>
    `));
  });
}

/* --- رئيس ونائب رئيس الاتحاد --- */
async function saveLeadership(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const item = {
    presidentName: document.getElementById('af-ldPresName').value.trim(),
    vpName: document.getElementById('af-ldVpName').value.trim(),
  };
  const presFile = document.getElementById('af-ldPresPhoto').files[0];
  const vpFile = document.getElementById('af-ldVpPhoto').files[0];
  if(presFile) item.presidentPhoto = await uploadImage(presFile, 'leadership');
  if(vpFile) item.vpPhoto = await uploadImage(vpFile, 'leadership');
  db.collection('config').doc('leadership').set(item, {merge:true}).then(()=>{
    showToast('تم حفظ بيانات رئيس ونائب الاتحاد ✔');
  });
  return false;
}

/* --- عميدة ووكيلة الكلية --- */
async function saveDean(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const item = {
    name: document.getElementById('af-deanName').value.trim(),
    role: document.getElementById('af-deanRole').value.trim(),
    bio: document.getElementById('af-deanBio').value.trim(),
    quote: document.getElementById('af-deanQuote').value.trim(),
  };
  const file = document.getElementById('af-deanPhoto').files[0];
  if(file) item.photoURL = await uploadImage(file, 'leadership');
  db.collection('config').doc('dean').set(item, {merge:true}).then(()=>{
    showToast('تم حفظ بيانات عميدة الكلية ✔');
  });
  return false;
}
async function saveViceDean(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const item = {
    name: document.getElementById('af-viceName').value.trim(),
    role: document.getElementById('af-viceRole').value.trim(),
    bio: document.getElementById('af-viceBio').value.trim(),
    quote: document.getElementById('af-viceQuote').value.trim(),
  };
  const file = document.getElementById('af-vicePhoto').files[0];
  if(file) item.photoURL = await uploadImage(file, 'leadership');
  db.collection('config').doc('viceDean').set(item, {merge:true}).then(()=>{
    showToast('تم حفظ بيانات وكيلة الكلية ✔');
  });
  return false;
}

/* --- اللجان --- */
function editCommittee(id){
  const c = STATE.committees.find(x=>x.id===id); if(!c) return;
  document.getElementById('af-comId').value = id;
  document.getElementById('af-comName').value = c.name;
  document.getElementById('af-comHead').value = c.head;
  document.getElementById('af-comSubmitBtn').textContent = 'حفظ التعديل';
  openAdminSection('committees');
}
function deleteCommittee(id){
  if(!confirm('حذف اللجنة دي؟')) return;
  db.collection('committees').doc(id).delete().then(()=>showToast('تم الحذف ✔'));
}
async function saveCommittee(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const fileInput = document.getElementById('af-comPhoto');
  const item = {
    name: document.getElementById('af-comName').value.trim(),
    head: document.getElementById('af-comHead').value.trim(),
  };
  if(!item.name||!item.head) return false;
  if(fileInput.files[0]) item.photoURL = await uploadImage(fileInput.files[0], 'committees');
  const id = document.getElementById('af-comId').value;
  const p = id ? db.collection('committees').doc(id).update(item)
               : db.collection('committees').add({...item, createdAt:Date.now()});
  p.then(()=>{
    showToast(id?'تم حفظ التعديل ✔':'تمت إضافة اللجنة ✔');
    ev.target.reset(); document.getElementById('af-comId').value='';
    document.getElementById('af-comSubmitBtn').textContent='إضافة';
  });
  return false;
}
function renderAdminCommittees(){
  const wrap = document.getElementById('admin-comList'); if(!wrap) return;
  wrap.innerHTML='';
  STATE.committees.forEach(c=>{
    wrap.appendChild(el(`
      <div class="admin-item-row">
        <div class="ai-info"><b>${esc(c.name)}</b><span>رئيس: ${esc(c.head)}</span></div>
        <div class="ai-actions">
          <button type="button" class="mini-btn" onclick="editCommittee('${c.id}')">تعديل</button>
          <button type="button" class="mini-btn danger" onclick="deleteCommittee('${c.id}')">حذف</button>
        </div>
      </div>
    `));
  });
}

/* --- الترتيب --- */
function editLeaderboard(id){
  const r = STATE.leaderboard.find(x=>x.id===id); if(!r) return;
  document.getElementById('af-rankId').value = id;
  document.getElementById('af-rankName').value = r.name;
  document.getElementById('af-rankPoints').value = r.points;
  document.getElementById('af-rankSubmitBtn').textContent = 'حفظ التعديل';
  openAdminSection('ranking');
}
function deleteLeaderboard(id){
  if(!confirm('حذف الطالب ده من الترتيب؟')) return;
  db.collection('leaderboard').doc(id).delete().then(()=>showToast('تم الحذف ✔'));
}
function saveLeaderboard(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const item = {
    name: document.getElementById('af-rankName').value.trim(),
    points: Number(document.getElementById('af-rankPoints').value)||0,
  };
  if(!item.name) return false;
  const id = document.getElementById('af-rankId').value;
  const p = id ? db.collection('leaderboard').doc(id).update(item)
               : db.collection('leaderboard').add({...item, createdAt:Date.now()});
  p.then(()=>{
    showToast(id?'تم حفظ التعديل ✔':'تمت الإضافة لقائمة الترتيب ✔');
    ev.target.reset(); document.getElementById('af-rankId').value='';
    document.getElementById('af-rankSubmitBtn').textContent='إضافة';
  });
  return false;
}
function renderAdminLeaderboard(){
  const wrap = document.getElementById('admin-rankList'); if(!wrap) return;
  wrap.innerHTML='';
  STATE.leaderboard.forEach(r=>{
    wrap.appendChild(el(`
      <div class="admin-item-row">
        <div class="ai-info"><b>${esc(r.name)}</b><span>${r.points} نقطة</span></div>
        <div class="ai-actions">
          <button type="button" class="mini-btn" onclick="editLeaderboard('${r.id}')">تعديل</button>
          <button type="button" class="mini-btn danger" onclick="deleteLeaderboard('${r.id}')">حذف</button>
        </div>
      </div>
    `));
  });
}

/* --- أعضاء الاتحاد (بالصورة) --- */
function editMember(id){
  const m = STATE.members.find(x=>x.id===id); if(!m) return;
  document.getElementById('af-memId').value = id;
  document.getElementById('af-memName').value = m.name;
  document.getElementById('af-memRole').value = m.role;
  document.getElementById('af-memSubmitBtn').textContent = 'حفظ التعديل';
  openAdminSection('members');
}
function deleteMember(id){
  if(!confirm('حذف العضو ده؟')) return;
  db.collection('members').doc(id).delete().then(()=>showToast('تم الحذف ✔'));
}
async function saveMember(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const name = document.getElementById('af-memName').value.trim();
  const role = document.getElementById('af-memRole').value.trim();
  const fileInput = document.getElementById('af-memPhoto');
  if(!name||!role) return false;
  const id = document.getElementById('af-memId').value;
  const item = {name, role};
  if(fileInput.files[0]) item.photoURL = await uploadImage(fileInput.files[0], 'members');
  const p = id ? db.collection('members').doc(id).update(item)
               : db.collection('members').add({...item, createdAt:Date.now()});
  p.then(()=>{
    showToast(id?'تم حفظ التعديل ✔':'تمت إضافة العضو ✔');
    ev.target.reset(); document.getElementById('af-memId').value='';
    document.getElementById('af-memSubmitBtn').textContent='إضافة';
  });
  return false;
}
function renderAdminMembers(){
  const wrap = document.getElementById('admin-memList'); if(!wrap) return;
  wrap.innerHTML='';
  STATE.members.forEach(m=>{
    wrap.appendChild(el(`
      <div class="admin-item-row">
        <div class="ai-info"><b>${esc(m.name)}</b><span>${esc(m.role)}</span></div>
        <div class="ai-actions">
          <button type="button" class="mini-btn" onclick="editMember('${m.id}')">تعديل</button>
          <button type="button" class="mini-btn danger" onclick="deleteMember('${m.id}')">حذف</button>
        </div>
      </div>
    `));
  });
}

/* --- الأخبار (بالصورة) --- */
