/* =========================================================================
   تقييم الفعالية + أسئلة القاعة (للحاضرين فقط) + حفظ التذكرة كصورة
   - الطالب بيقيّم ويسأل بس بعد ما الأدمن يسجّل حضوره (من QR أو يدوي)
   - الأدمن بيشوف ملخص التقييمات والتعليقات وأسئلة القاعة لحظياً
   ========================================================================= */
const LIVE_CRIT = [['overall','التقييم العام',true],['content','المحتوى',false],['organization','التنظيم',false],['speaker','المحاضر / المقدّم',false]];
const LIVE = { unsub:null, id:null, vals:{}, lastQ:0 };

function liveStop(){ if(LIVE.unsub){ try{ LIVE.unsub(); }catch(_){} LIVE.unsub = null; } LIVE.id = null; }
function liveStarRow(k, label, req){
  return `<div class="lv-row"><span>${label}${req?' <em>*</em>':''}</span><div class="lv-stars" data-k="${k}">${[1,2,3,4,5].map(n=>`<button type="button" data-v="${n}" aria-label="${n} من 5">★</button>`).join('')}</div></div>`;
}
function liveSetStars(box, k, v){
  LIVE.vals[k] = v;
  box.querySelectorAll('.lv-stars[data-k="'+k+'"] button').forEach(b=>b.classList.toggle('on', Number(b.dataset.v) <= v));
}

/* ---------- جانب الطالب: بيتضاف جوه نافذة الفعالية ---------- */
async function liveRender(id){
  liveStop();
  const old = document.getElementById('liveBox'); if(old) old.remove();
  const a = STATE.activities.find(x=>x.id===id);
  if(!a || !a.requiresRegistration || !fbReady || !STUDENT.uid) return;
  const box = document.createElement('div'); box.id = 'liveBox'; box.className = 'live-box';
  document.getElementById('modalExtra').insertAdjacentElement('afterend', box);
  LIVE.id = id; LIVE.vals = {};
  const act = db.collection('activities').doc(id);
  let reg;
  try{ reg = await act.collection('registrations').doc(STUDENT.uid).get(); }catch(_){ box.remove(); return; }
  if(LIVE.id !== id) return;                       /* الطالب قفل النافذة أو فتح فعالية تانية */
  if(!reg.exists){ box.remove(); return; }
  if(!reg.data().attended){
    box.innerHTML = '<div class="lv-lock">⭐ التقييم وأسئلة القاعة بيتفتحوا بعد ما يتسجّل حضورك عند الباب</div>';
    return;
  }
  let mine = null;
  try{ const f = await act.collection('feedback').doc(STUDENT.uid).get(); if(f.exists) mine = f.data(); }catch(_){}
  if(LIVE.id !== id) return;
  box.innerHTML = `
    <div class="lv-h">⭐ قيّم الفعالية</div>
    ${LIVE_CRIT.map(c=>liveStarRow(c[0],c[1],c[2])).join('')}
    <textarea id="lvComment" maxlength="300" rows="2" placeholder="عايز تقول إيه كمان؟ (اختياري)">${esc(mine ? (mine.comment||'') : '')}</textarea>
    <button type="button" class="btn-primary lv-btn" id="lvSend">${mine?'تحديث تقييمي':'إرسال التقييم'}</button>
    <div class="lv-h" style="margin-top:18px;">🙋 أسئلة القاعة</div>
    <div class="lv-ask"><input id="lvQ" maxlength="200" placeholder="اكتب سؤالك للمحاضر..."><button type="button" class="btn-primary" id="lvAsk">إرسال</button></div>
    <label class="adm-chk"><input type="checkbox" id="lvAnon"> إرسال كمجهول (الاسم مش هيظهر)</label>
    <div id="lvQs" class="lv-qs"><div class="empty-note">لسه مفيش أسئلة — كن أول واحد 👋</div></div>`;
  if(mine) LIVE_CRIT.forEach(c=>{ if(mine[c[0]]) liveSetStars(box, c[0], Number(mine[c[0]])); });
  box.querySelectorAll('.lv-stars button').forEach(b=>b.addEventListener('click', ()=>liveSetStars(box, b.parentNode.dataset.k, Number(b.dataset.v))));

  box.querySelector('#lvSend').addEventListener('click', async ev=>{
    if(!LIVE.vals.overall){ showToast('اختار التقييم العام بالنجوم الأول'); return; }
    const btn = ev.currentTarget; btn.disabled = true;
    const data = { uid:STUDENT.uid, name:STUDENT.name||'طالب', overall:LIVE.vals.overall, comment:box.querySelector('#lvComment').value.trim().slice(0,300), updatedAt:Date.now() };
    ['content','organization','speaker'].forEach(k=>{ if(LIVE.vals[k]) data[k] = LIVE.vals[k]; });
    try{ await act.collection('feedback').doc(STUDENT.uid).set(data); showToast('شكراً على تقييمك 💙'); btn.textContent = 'تحديث تقييمي'; }
    catch(e){ showToast('مقدرتش أبعت التقييم — جرّب تاني'); }
    btn.disabled = false;
  });

  box.querySelector('#lvAsk').addEventListener('click', async ()=>{
    const inp = box.querySelector('#lvQ'); const text = inp.value.trim();
    if(text.length < 3){ showToast('اكتب سؤالك (3 حروف على الأقل)'); return; }
    if(Date.now() - LIVE.lastQ < 15000){ showToast('استنى شوية قبل السؤال الجاي'); return; }
    try{
      await act.collection('questions').add({ uid:STUDENT.uid, name: box.querySelector('#lvAnon').checked ? 'مجهول' : (STUDENT.name||'طالب'),
        text:text.slice(0,200), createdAt:Date.now(), upUids:[], answered:false });
      LIVE.lastQ = Date.now(); inp.value = ''; showToast('وصل سؤالك للمنظّم ✔');
    }catch(e){ showToast('مقدرتش أبعت السؤال — جرّب تاني'); }
  });

  LIVE.unsub = act.collection('questions').orderBy('createdAt','desc').limit(50).onSnapshot(sn=>{
    const list = sn.docs.map(d=>({id:d.id, ...d.data()})).sort((x,y)=>(y.upUids||[]).length-(x.upUids||[]).length || y.createdAt-x.createdAt);
    const wrap = box.querySelector('#lvQs'); if(!wrap) return;
    if(!list.length){ wrap.innerHTML = '<div class="empty-note">لسه مفيش أسئلة — كن أول واحد 👋</div>'; return; }
    wrap.innerHTML = list.map(q=>{
      const ups = q.upUids||[], did = ups.includes(STUDENT.uid);
      return `<div class="lv-q ${q.answered?'done':''}"><div class="lv-qt"><b>${esc(q.text)}</b><span>${esc(q.name||'')}${q.answered?' · ✔ اتجاوب عليه':''}</span></div>
        <button type="button" class="lv-up ${did?'on':''}" data-q="${q.id}" ${did?'disabled':''}>▲ ${ups.length}</button></div>`;
    }).join('');
    wrap.querySelectorAll('.lv-up:not([disabled])').forEach(b=>b.addEventListener('click', ()=>{
      b.disabled = true;
      act.collection('questions').doc(b.dataset.q).update({ upUids: firebase.firestore.FieldValue.arrayUnion(STUDENT.uid) }).catch(()=>showToast('مقدرتش أسجّل تصويتك'));
    }));
  }, ()=>{});
}
const _liveOpenAct = openActivityModal;
openActivityModal = function(id){ _liveOpenAct(id); liveRender(id); };
const _liveCloseAct = closeActivityModal;
closeActivityModal = function(){ _liveCloseAct(); liveStop(); const b = document.getElementById('liveBox'); if(b) b.remove(); };

/* ---------- جانب الأدمن: ملخص التقييمات + أسئلة القاعة ---------- */
const LA = { id:null, a:null, fb:[], unsub:null };
async function openLiveAdmin(id){
  const a = STATE.activities.find(x=>x.id===id); if(!a || !requireFB()) return;
  if(LA.unsub){ LA.unsub(); LA.unsub = null; }
  LA.id = id; LA.a = a; LA.fb = [];
  document.getElementById('laTitle').textContent = 'تقييم «'+a.title+'»';
  document.getElementById('laBody').innerHTML = '<div class="empty-note">جاري التحميل...</div>';
  document.getElementById('liveAdminModal').classList.add('show');
  const act = db.collection('activities').doc(id);
  try{ const sn = await act.collection('feedback').get(); LA.fb = sn.docs.map(d=>d.data()); }catch(e){ document.getElementById('laBody').innerHTML = '<div class="empty-note">مقدرتش أحمّل التقييمات</div>'; return; }
  let qs = [];
  const paint = ()=>{
    const n = LA.fb.length;
    const avg = k=>{ const v = LA.fb.map(f=>Number(f[k])).filter(Boolean); return v.length ? v.reduce((s,x)=>s+x,0)/v.length : 0; };
    const bars = LIVE_CRIT.map(c=>{ const m = avg(c[0]); return `<div class="la-bar"><span>${c[1]}</span><div><i style="width:${m/5*100}%"></i></div><b>${m?m.toFixed(1):'—'}</b></div>`; }).join('');
    const comments = LA.fb.filter(f=>f.comment).sort((x,y)=>(y.updatedAt||0)-(x.updatedAt||0)).map(f=>`<div class="la-cm"><b>${esc(f.name||'')}</b> <em>${'★'.repeat(Number(f.overall)||0)}</em><p>${esc(f.comment)}</p></div>`).join('');
    const qHtml = qs.length ? qs.map(q=>`<div class="lv-q ${q.answered?'done':''}"><div class="lv-qt"><b>${esc(q.text)}</b><span>${esc(q.name||'')} · ▲ ${(q.upUids||[]).length}</span></div>
        <div class="ai-actions"><button type="button" class="mini-btn" data-ans="${q.id}">${q.answered?'↩ رجّع':'✔ اتجاوب'}</button><button type="button" class="mini-btn danger" data-del="${q.id}">حذف</button></div></div>`).join('')
      : '<div class="empty-note">مفيش أسئلة لسه</div>';
    document.getElementById('laBody').innerHTML = `<div class="la-sum"><b>${n}</b><span>تقييم</span></div>${n?bars:'<div class="empty-note">لسه محدش قيّم</div>'}
      ${comments?'<div class="adm-group">التعليقات</div>'+comments:''}<div class="adm-group">أسئلة القاعة (${qs.length})</div>${qHtml}`;
    document.querySelectorAll('#laBody [data-ans]').forEach(b=>b.addEventListener('click', ()=>{
      const q = qs.find(x=>x.id===b.dataset.ans); act.collection('questions').doc(q.id).update({ answered: !q.answered }).catch(()=>showToast('مقدرتش أعدّل'));
    }));
    document.querySelectorAll('#laBody [data-del]').forEach(b=>b.addEventListener('click', ()=>{
      if(confirm('تحذف السؤال ده؟')) act.collection('questions').doc(b.dataset.del).delete().catch(()=>showToast('مقدرتش أحذف'));
    }));
  };
  LA.unsub = act.collection('questions').orderBy('createdAt','desc').limit(100).onSnapshot(sn=>{
    qs = sn.docs.map(d=>({id:d.id, ...d.data()})).sort((x,y)=>(y.upUids||[]).length-(x.upUids||[]).length || y.createdAt-x.createdAt);
    paint();
  }, ()=>paint());
}
function closeLiveAdmin(){ if(LA.unsub){ LA.unsub(); LA.unsub = null; } document.getElementById('liveAdminModal').classList.remove('show'); }
function exportFeedbackCsv(){
  if(!LA.fb.length){ showToast('مفيش تقييمات للتصدير'); return; }
  const q = v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const rows = [['الاسم','التقييم العام','المحتوى','التنظيم','المحاضر','تعليق']].concat(LA.fb.map(f=>[f.name,f.overall,f.content,f.organization,f.speaker,f.comment]));
  const blob = new Blob(['\ufeff'+rows.map(r=>r.map(q).join(',')).join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'تقييم - '+(LA.a.title||'فعالية').replace(/[\\/:*?"<>|]/g,' ')+'.csv'; a.click();
}

/* ---------- حفظ التذكرة كصورة باسم الفعالية ---------- */
function tkWrap(ctx, text, maxW){
  const words = String(text).split(/\s+/), lines = []; let cur = '';
  words.forEach(w=>{ const t = cur ? cur+' '+w : w; if(ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; });
  if(cur) lines.push(cur); return lines.slice(0,3);
}
async function saveTicketImage(){
  const svg = document.querySelector('#tkQr svg');
  if(!svg){ showToast('استنى الكود يظهر الأول'); return; }
  const title = document.getElementById('tkTitle').textContent || 'فعالية';
  const who = document.getElementById('tkName').textContent, meta = document.getElementById('tkMeta').textContent;
  try{
    if(document.fonts && document.fonts.ready) await document.fonts.ready;
    const clone = svg.cloneNode(true);          /* فايرفوكس محتاج عرض وارتفاع صريحين عشان يرسم الـ SVG على canvas */
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg'); clone.setAttribute('width','600'); clone.setAttribute('height','600');
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    await new Promise((res,rej)=>{ img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml); });
    const W = 900, H = 1240, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.direction = 'rtl'; x.textAlign = 'center';
    x.fillStyle = '#eef4fb'; x.fillRect(0,0,W,H);
    x.fillStyle = '#1360d2'; x.fillRect(0,0,W,300);
    x.fillStyle = '#fff'; x.font = '700 30px Tajawal, sans-serif'; x.fillText('تذكرة حضور', W/2, 70);
    x.font = '800 54px Tajawal, sans-serif';
    tkWrap(x, title, W-120).forEach((l,i,a)=>x.fillText(l, W/2, 150 + i*68 - (a.length-1)*18));
    x.fillStyle = '#fff'; x.beginPath(); x.roundRect ? x.roundRect(110, 340, 680, 680, 36) : x.rect(110,340,680,680); x.fill();
    x.drawImage(img, 150, 380, 600, 600);
    x.fillStyle = '#0b1f4d'; x.font = '800 52px Tajawal, sans-serif'; x.fillText(who, W/2, 1100);
    x.fillStyle = '#5a6b8c'; x.font = '500 34px Tajawal, sans-serif'; x.fillText(meta, W/2, 1155);
    x.font = '500 28px Tajawal, sans-serif'; x.fillText('اعرض الكود للمنظّم عند الباب', W/2, 1205);
    const blob = await new Promise(r=>c.toBlob(r, 'image/png'));
    const name = ('تذكرة - '+title).replace(/[\\/:*?"<>|]/g,' ').trim()+'.png';
    const file = new File([blob], name, {type:'image/png'});
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    if(ios && navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:name}); }   /* iOS: "حفظ الصورة" من قايمة المشاركة */
    else{ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); showToast('اتحفظت الصورة 📥'); }
  }catch(e){ if(!(e && e.name==='AbortError')) showToast('مقدرتش أحفظ الصورة — جرّب تاني'); }
}
