/* ========================= حضور بـ QR =========================
   الطالب: تذكرة فيها QR لكل فعالية سجّل فيها.  الأدمن: يمسح التذكرة عند الباب فيتسجل الحضور وتتضاف النقاط.
   صيغة الكود: NUQR1|<activityId>|<uid> */
const QR_PREFIX = 'NUQR1';
const _loaded = {};
function loadScriptOnce(src){
  if(_loaded[src]) return _loaded[src];
  return _loaded[src] = new Promise((res, rej)=>{
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = ()=>{ delete _loaded[src]; rej(new Error('load '+src)); };
    document.head.appendChild(s);
  });
}

/* ---------- تذكرة الطالب ---------- */
async function showTicket(){
  const a = STATE.activities.find(x=>x.id===modalActivityId);
  if(!a || !STUDENT.uid){ showToast('سجّل دخولك الأول'); return; }
  document.getElementById('tkTitle').textContent = a.title || '';
  document.getElementById('tkName').textContent = STUDENT.name || '';
  document.getElementById('tkMeta').textContent = [STUDENT.studentId, STUDENT.level].filter(Boolean).join(' · ');
  const st = document.getElementById('tkStatus'); st.className = 'tk-status'; st.textContent = 'اعرض الكود ده للمنظّم عند الباب';
  const box = document.getElementById('tkQr'); box.innerHTML = '<div class="skel" style="min-height:220px;margin:0"></div>';
  document.getElementById('ticketModal').classList.add('show');
  try{
    await loadScriptOnce('js/vendor/qrcode.min.js');
    const qr = qrcode(0, 'M'); qr.addData(`${QR_PREFIX}|${a.id}|${STUDENT.uid}`); qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize:6, margin:2, scalable:true });
  }catch(e){ box.textContent = 'مقدرتش أعمل الكود — اتأكد من النت'; }
  try{
    const d = await db.collection('activities').doc(a.id).collection('registrations').doc(STUDENT.uid).get();
    if(d.exists && d.data().attended){ st.className = 'tk-status ok'; st.textContent = '✔ تم تسجيل حضورك'; }
  }catch(_){}
}
function closeTicket(){ document.getElementById('ticketModal').classList.remove('show'); }

/* ---------- ماسح الأدمن ---------- */
const SCAN = { stream:null, timer:0, det:null, canvas:null, last:'', lastAt:0, busy:false, hideT:0 };

function scanTone(kind){
  try{
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    const c = SCAN.ac || (SCAN.ac = new AC()), o = c.createOscillator(), g = c.createGain();
    o.frequency.value = kind==='ok' ? 880 : 220; g.gain.value = .08; o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + (kind==='ok' ? .12 : .25));
  }catch(_){}
  if(navigator.vibrate) navigator.vibrate(kind==='ok' ? 60 : [80,60,80]);
}
function scanFeedback(kind, text, sub){
  const r = document.getElementById('scanResult');
  r.className = 'scan-result show ' + kind;
  r.innerHTML = `<b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  scanTone(kind);
  clearTimeout(SCAN.hideT); SCAN.hideT = setTimeout(()=>r.classList.remove('show'), 2400);
}
function scanCounter(){
  const att = REG.items.filter(x=>x.attended).length;
  document.getElementById('scanCount').textContent = `حضروا ${att} من ${REG.items.length} مسجل`;
}
async function openScanner(){
  if(!REG || !REG.id){ return; }
  document.getElementById('scanTitle').textContent = REG.a ? REG.a.title : '';
  document.getElementById('scanModal').classList.add('show');
  scanCounter();
  const vid = document.getElementById('scanVideo'), msg = document.getElementById('scanMsg');
  msg.textContent = 'بفتح الكاميرا...';
  try{
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
    SCAN.stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 } }, audio:false });
    vid.srcObject = SCAN.stream; await vid.play();
    if('BarcodeDetector' in window){
      try{ const f = await BarcodeDetector.getSupportedFormats(); if(f.includes('qr_code')) SCAN.det = new BarcodeDetector({ formats:['qr_code'] }); }catch(_){}
    }
    if(!SCAN.det){ await loadScriptOnce('js/vendor/jsqr.min.js'); SCAN.canvas = document.createElement('canvas'); }
    msg.textContent = 'وجّه الكاميرا على QR التذكرة';
    scanLoop();
  }catch(e){
    msg.textContent = 'مقدرتش أفتح الكاميرا — اسمح بالإذن أو استخدم الإدخال بالرقم الجامعي تحت';
  }
}
function scanLoop(){
  clearTimeout(SCAN.timer);
  if(!SCAN.stream) return;
  SCAN.timer = setTimeout(async ()=>{
    const vid = document.getElementById('scanVideo');
    if(vid.readyState >= 2 && !SCAN.busy){
      let code = '';
      try{
        if(SCAN.det){ const r = await SCAN.det.detect(vid); if(r.length) code = r[0].rawValue; }
        else{
          const w = Math.min(640, vid.videoWidth), h = Math.round(vid.videoHeight * w / vid.videoWidth);
          const cv = SCAN.canvas; cv.width = w; cv.height = h;
          const cx = cv.getContext('2d', { willReadFrequently:true }); cx.drawImage(vid, 0, 0, w, h);
          const r = jsQR(cx.getImageData(0,0,w,h).data, w, h, { inversionAttempts:'dontInvert' }); if(r) code = r.data;
        }
      }catch(_){}
      if(code && !(code===SCAN.last && Date.now()-SCAN.lastAt < 4000)){ SCAN.last = code; SCAN.lastAt = Date.now(); await handleScanned(code); }
    }
    scanLoop();
  }, 140);
}
function closeScanner(){
  clearTimeout(SCAN.timer); SCAN.timer = 0;
  if(SCAN.stream){ SCAN.stream.getTracks().forEach(t=>t.stop()); SCAN.stream = null; }
  const vid = document.getElementById('scanVideo'); if(vid) vid.srcObject = null;
  document.getElementById('scanModal').classList.remove('show');
  document.getElementById('scanResult').classList.remove('show');
  if(typeof renderRegList==='function') renderRegList();
}
async function handleScanned(raw){
  const p = String(raw||'').trim().split('|');
  if(p[0] !== QR_PREFIX || p.length < 3){ scanFeedback('bad', 'ده مش QR تذكرة تبع الاتحاد'); return; }
  if(p[1] !== REG.id){ scanFeedback('bad', 'التذكرة دي لفعالية تانية'); return; }
  await markAttended(p[2]);
}
/* تسجيل الحضور: معاملة واحدة (Transaction) عشان نفس الطالب ميتحسبش مرتين حتى لو اتمسح من جهازين */
async function markAttended(uid){
  if(SCAN.busy) return; SCAN.busy = true;
  try{
    const ref = db.collection('activities').doc(REG.id).collection('registrations').doc(uid);
    const pts = (REG.a && REG.a.points) || 0;
    const res = await db.runTransaction(async tx=>{
      const d = await tx.get(ref);
      if(!d.exists) return { state:'none' };
      const data = d.data();
      if(data.attended) return { state:'dup', data };
      tx.update(ref, { attended:true, attendedAt:Date.now() });
      if(pts > 0) tx.update(db.collection('students').doc(uid), { points: firebase.firestore.FieldValue.increment(pts) });
      return { state:'ok', data };
    });
    if(res.state === 'none') scanFeedback('bad', 'الطالب ده مش مسجّل في الفعالية');
    else{
      const it = REG.items.find(x=>x.id===uid);
      if(it){ it.attended = true; } else { REG.items.push({ id:uid, ...res.data, attended:true }); }
      scanCounter();
      if(res.state === 'dup') scanFeedback('warn', res.data.name || 'طالب', 'اتسجّل حضوره قبل كده');
      else scanFeedback('ok', res.data.name || 'تم', pts>0 ? `✔ تم الحضور · +${pts} نقطة` : '✔ تم تسجيل الحضور');
    }
  }catch(e){ scanFeedback('bad', 'مقدرتش أسجّل — اتأكد إنك داخل بحساب الأدمن'); }
  SCAN.busy = false;
}
/* إدخال يدوي بالرقم الجامعي (احتياطي لو الكاميرا مش شغالة) */
async function manualAttend(ev){
  if(ev) ev.preventDefault();
  const inp = document.getElementById('scanManual'); const v = inp.value.trim(); if(!v) return false;
  const it = REG.items.find(x=>String(x.studentId||'').trim() === v);
  if(!it){ scanFeedback('bad', 'مفيش مسجّل بالرقم ده'); return false; }
  inp.value = ''; await markAttended(it.id); return false;
}

/* ========================= الوضع الداكن ========================= */
function applyTheme(t){
  if(t==='dark') document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme');
  const m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content', t==='dark' ? '#0b2a63' : '#1360d2');
  const l = document.getElementById('themeLabel'); if(l) l.textContent = t==='dark' ? 'الوضع الفاتح' : 'الوضع الداكن';
}
function toggleTheme(){
  const to = document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
  try{ localStorage.setItem('nuTheme', to); }catch(_){}
  applyTheme(to);
}
applyTheme(document.documentElement.getAttribute('data-theme')==='dark' ? 'dark' : 'light');
/* شيل هياكل التحميل لو البيانات اتأخرت */
setTimeout(()=>document.querySelectorAll('.skel[data-boot]').forEach(n=>n.remove()), 9000);
