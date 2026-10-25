/* =========================================================================
   شهادات الحضور (PDF) — القالب بتصمّمه إنت بالكامل (شكل، لوجو، نصوص، ختم، توقيع) وبترفعه كصورة،
   والتطبيق بيكتب اسم الطالب بس تلقائياً في المكان اللي إنت محدده، وبيطلّع الشهادة PDF.
   - قالب افتراضي: config/certificate        - قالب خاص بفعالية (اختياري): activities/{id}.certificate
   - شكل الحقل: { templateURL, nameX, nameY, nameSize, nameMaxW, nameColor, nameFont, nameAlign, nameUpper }
     (X/Y/الحجم/أقصى عرض كلها نسب من عرض/ارتفاع الصورة، فالمكان بيفضل ثابت مهما كان مقاس الصورة)
   - الرسم على canvas والـ PDF بيتبني من غير أي مكتبة. الطالب بيشوف الزرار بعد ما الأدمن يسجّل حضوره.
   ========================================================================= */
const CERT = { cfg:null, cfgAt:0, busy:false, blob:null, pdf:null, name:'', imgCache:{} };
const CERT_MAX_PX = 3508;                                   /* أطول ضلع للشهادة (A4 بدقة 300) */
const CERT_FONTS = {
  'Great Vibes':      { w:400, label:'Great Vibes — خط توقيع' },
  'Playfair Display': { w:600, label:'Playfair Display — كلاسيكي' },
  'Cinzel':           { w:600, label:'Cinzel — حروف كابيتال' },
  'Montserrat':       { w:600, label:'Montserrat — عصري' },
  'Amiri':            { w:700, label:'Amiri — للأسماء العربي' }
};
const CERT_DEF = { nameX:.5, nameY:.5, nameSize:.06, nameMaxW:.7, nameColor:'#1a2b52', nameFont:'Playfair Display', nameAlign:'center', nameUpper:false };

/* ---------- خطوط (من Google Fonts أول مرة بس) ---------- */
const certFontP = {};
function certFonts(names){
  try{
    if(!document.getElementById('certFontLink')){
      const l = document.createElement('link'); l.id = 'certFontLink'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@600&family=Cinzel:wght@600&family=Montserrat:wght@600&family=Amiri:wght@700&display=swap';
      document.head.appendChild(l);
    }
  }catch(_){}
  return Promise.all([].concat(names).map(n=>{
    const f = CERT_FONTS[n]; if(!f) return null;
    if(!certFontP[n]) certFontP[n] = Promise.race([document.fonts.load(`${f.w} 48px "${n}"`, 'Aa أب'), new Promise(r=>setTimeout(r,6000))]).catch(()=>{});
    return certFontP[n];
  }));
}
/* الاسم العربي بيرجع لخط أميري لو الخط المختار مفيهوش حروف عربي */
function certFontStack(n){ return `"${n}", Amiri, Tajawal, sans-serif`; }
function certHasArabic(s){ return /[؀-ۿ]/.test(s); }

function certImage(src){
  if(!src) return Promise.resolve(null);
  if(CERT.imgCache[src]) return CERT.imgCache[src];
  return CERT.imgCache[src] = new Promise(res=>{
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = ()=>res(im);
    im.onerror = ()=>{ delete CERT.imgCache[src]; res(null); };
    im.src = src;
  });
}

/* ---------- رسم الشهادة: صورة القالب + الاسم بس ---------- */
async function certRender(tpl, name){
  const t = Object.assign({}, CERT_DEF, tpl);
  await certFonts([t.nameFont, 'Amiri']);
  const img = await certImage(t.templateURL);
  if(!img) throw new Error('template-load');
  const k = Math.min(1, CERT_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth*k), H = Math.round(img.naturalHeight*k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0,0,W,H);
  x.drawImage(img, 0, 0, W, H);
  let txt = String(name||'').replace(/\s+/g,' ').trim();
  if(t.nameUpper) txt = txt.toUpperCase();
  const f = CERT_FONTS[t.nameFont] || CERT_FONTS[CERT_DEF.nameFont];
  x.textBaseline = 'middle'; x.textAlign = t.nameAlign; x.direction = certHasArabic(txt) ? 'rtl' : 'ltr'; x.fillStyle = t.nameColor;
  let px = Math.max(14, Math.round(t.nameSize*W)); const maxW = t.nameMaxW*W;
  for(; px > 14; px -= 2){ x.font = `${f.w} ${px}px ${certFontStack(t.nameFont)}`; if(x.measureText(txt).width <= maxW) break; }
  x.font = `${f.w} ${px}px ${certFontStack(t.nameFont)}`;
  x.fillText(txt, t.nameX*W, t.nameY*H);
  return c;
}

/* ---------- PDF بسيط بصفحة واحدة (صورة JPEG ملء الصفحة، بنفس نسبة القالب) ---------- */
function certBuildPdf(jpeg, iw, ih, title){
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const add = b=>{ const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n, body)=>{ offs[n] = len; add(`${n} 0 obj\n`); add(body); add('\nendobj\n'); };
  const PW = iw >= ih ? 842 : 595, PH = Math.round(PW*ih/iw*100)/100;          /* A4 بالنقاط، أفقي أو رأسي حسب القالب */
  const hex = Array.from(title).map(ch=>ch.charCodeAt(0).toString(16).padStart(4,'0')).join('').toUpperCase();
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offs[4] = len; add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg); add('\nendstream\nendobj\n');
  const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, `<< /Title <FEFF${hex}> /Producer (Nursing Union App) >>`);
  const xref = len;
  add(`xref\n0 7\n0000000000 65535 f \n`);
  for(let i=1;i<=6;i++) add(String(offs[i]).padStart(10,'0')+' 00000 n \n');
  add(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0; parts.forEach(u=>{ out.set(u,p); p += u.length; });
  return new Blob([out], { type:'application/pdf' });
}

/* ---------- توليد + معاينة + تنزيل ---------- */
async function certMake(tpl, name, title){
  const cv = await certRender(tpl, name);
  const jpegBlob = await new Promise(r=>cv.toBlob(r,'image/jpeg',.93));
  if(!jpegBlob) throw new Error('encode');
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  CERT.pdf = certBuildPdf(jpeg, cv.width, cv.height, 'Certificate - '+(title||''));
  CERT.blob = jpegBlob;
  CERT.name = ('Certificate - '+(title||'Event')).replace(/[\\/:*?"<>|]/g,' ').trim();
  const prev = document.getElementById('certPrev');
  if(prev.dataset.u) URL.revokeObjectURL(prev.dataset.u);
  prev.dataset.u = prev.src = URL.createObjectURL(jpegBlob);
  prev.style.aspectRatio = cv.width+'/'+cv.height;
}
async function certMakeShow(tpl, name, title, btn){
  if(CERT.busy) return; CERT.busy = true; if(btn) btn.disabled = true;
  showToast('بجهّز الشهادة...');
  try{ await certMake(tpl, name, title); document.getElementById('certModal').classList.add('show'); }
  catch(e){ console.error('certificate error', e); showToast(e && e.message==='template-load' ? 'مقدرتش أحمّل صورة القالب — اتأكد من النت وجرّب تاني' : 'مقدرتش أجهّز الشهادة — جرّب تاني'); }
  CERT.busy = false; if(btn) btn.disabled = false;
}
function closeCertificate(){ document.getElementById('certModal').classList.remove('show'); }
async function certDeliver(blob, name){
  try{
    const file = new File([blob], name, { type:blob.type });
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    if(ios && navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:name }); return; }   /* iOS: حفظ/مشاركة من القايمة */
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 30000); showToast('اتحفظت الشهادة 📥');
  }catch(e){ if(!(e && e.name==='AbortError')) showToast('مقدرتش أحفظ الملف — جرّب تاني'); }
}
function downloadCertificatePdf(){ if(CERT.pdf) certDeliver(CERT.pdf, CERT.name+'.pdf'); }
function downloadCertificateImage(){ if(CERT.blob) certDeliver(CERT.blob, CERT.name+'.jpg'); }

/* ---------- القالب الافتراضي (بيتخزّن في الذاكرة 5 دقايق) + القالب الفعلي لفعالية ---------- */
async function certLoadDefault(force){
  if(!fbReady) return null;
  if(!force && CERT.cfgAt && Date.now()-CERT.cfgAt < 300000) return CERT.cfg;
  try{
    const d = await db.collection('config').doc('certificate').get();
    CERT.cfg = d.exists && d.data().templateURL ? d.data() : null; CERT.cfgAt = Date.now();
  }catch(_){}
  return CERT.cfg;
}
function certTplFor(a){ return a && a.certificate && a.certificate.templateURL ? a.certificate : CERT.cfg; }

/* ---------- جانب الطالب: الزرار بيظهر بعد تسجيل الحضور، لو فيه قالب ---------- */
async function certRefreshBtn(id){
  const btn = document.getElementById('certBtn'); if(!btn) return;
  btn.style.display = 'none';
  const a = STATE.activities.find(x=>x.id===id);
  if(!a || !a.requiresRegistration || !fbReady || !STUDENT.uid) return;
  try{
    const [d] = await Promise.all([ db.collection('activities').doc(id).collection('registrations').doc(STUDENT.uid).get(), certLoadDefault() ]);
    if(modalActivityId === id && d.exists && d.data().attended && certTplFor(a)) btn.style.display = '';
  }catch(_){}
}
const _certOpenAct = openActivityModal;
openActivityModal = function(id){ _certOpenAct(id); certRefreshBtn(id); };

function openCertificate(){
  const a = STATE.activities.find(x=>x.id===modalActivityId);
  if(!a || !STUDENT.uid){ showToast('سجّل دخولك الأول'); return; }
  const tpl = certTplFor(a); if(!tpl){ showToast('الشهادة لسه ما اتجهزتش'); return; }
  certMakeShow(tpl, STUDENT.name || 'Student', a.title, document.getElementById('certBtn'));
}

/* =========================================================================
   جانب الأدمن: قايمة القوالب + محرر مكان الاسم
   ========================================================================= */
const CE = { target:'default', tpl:null, file:null, obj:'', url:'', drag:false, busy:false };
const ceEl = id=>document.getElementById(id);

async function certAdminRender(force){
  const wrap = ceEl('certAdminList'); if(!wrap) return;
  const def = await certLoadDefault(force);
  let h = `<div class="admin-item-row"><div class="ai-info"><b>القالب الافتراضي</b><span>${def ? '✔ جاهز — بيتستخدم لأي فعالية ملهاش قالب خاص' : 'لسه ما اترفعش قالب'}</span></div>
    <div class="ai-actions"><button type="button" class="mini-btn" onclick="certEdOpen('default')">${def ? 'تعديل' : 'رفع وتصميم'}</button></div></div>
    <div class="adm-group">قالب خاص لفعالية (اختياري — مثلاً مؤتمر باسمه وتاريخه)</div>`;
  const acts = STATE.activities.filter(a=>a.requiresRegistration);
  if(!acts.length) h += '<div class="empty-note">مفيش فعاليات بتسجيل حضور لسه</div>';
  acts.forEach(a=>{
    const own = a.certificate && a.certificate.templateURL;
    h += `<div class="admin-item-row"><div class="ai-info"><b>${esc(a.title)}</b><span>${own ? '✔ ليها قالب خاص' : (def ? 'بتستخدم القالب الافتراضي' : 'مفيش قالب — الطلاب مش هيشوفوا زرار الشهادة')}</span></div>
      <div class="ai-actions"><button type="button" class="mini-btn" onclick="certEdOpen('${a.id}')">${own ? 'تعديل' : 'قالب خاص'}</button></div></div>`;
  });
  wrap.innerHTML = h;
}
const _certAdmOn = admOnSection;
admOnSection = function(key){ _certAdmOn(key); if(key==='certificates') certAdminRender(true); };
const _certRAA = renderAdminActivities;
renderAdminActivities = function(){ _certRAA.apply(this, arguments); if(document.querySelector('#adminSections > details[data-sec="certificates"].sec-active')) certAdminRender(false); };

/* الصورة الكبيرة جداً بتتصغّر (أطول ضلع 3508) عشان رفعها على Cloudinary ميفشلش */
async function certPrepTemplate(file){
  const url = URL.createObjectURL(file);
  try{
    const im = await new Promise((res,rej)=>{ const i = new Image(); i.onload = ()=>res(i); i.onerror = rej; i.src = url; });
    const long = Math.max(im.naturalWidth, im.naturalHeight);
    if(file.size <= 9*1024*1024 && long <= 4200) return file;
    const k = CERT_MAX_PX/long, c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth*k); c.height = Math.round(im.naturalHeight*k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const blob = await new Promise(r=>c.toBlob(r,'image/jpeg',.93));
    return new File([blob], 'certificate-template.jpg', { type:'image/jpeg' });
  } finally { URL.revokeObjectURL(url); }
}

function certEdFill(){            /* من الحالة للعناصر */
  const t = CE.tpl;
  ceEl('ceFont').value = t.nameFont; ceEl('ceSize').value = (t.nameSize*100).toFixed(1); ceEl('ceMaxW').value = Math.round(t.nameMaxW*100);
  ceEl('ceColor').value = t.nameColor; ceEl('ceAlign').value = t.nameAlign; ceEl('ceX').value = (t.nameX*100).toFixed(1); ceEl('ceY').value = (t.nameY*100).toFixed(1);
  ceEl('ceUpper').checked = !!t.nameUpper;
}
function certEdRead(){            /* من العناصر للحالة */
  const n = (id,d)=>{ const v = parseFloat(ceEl(id).value); return isNaN(v) ? d : v; };
  Object.assign(CE.tpl, { nameFont:ceEl('ceFont').value, nameSize:n('ceSize',6)/100, nameMaxW:n('ceMaxW',70)/100, nameColor:ceEl('ceColor').value,
    nameAlign:ceEl('ceAlign').value, nameX:n('ceX',50)/100, nameY:n('ceY',50)/100, nameUpper:ceEl('ceUpper').checked });
}
function certEdPaint(){           /* رسم الاسم فوق الصورة في المحرر */
  const st = ceEl('ceStage'), w = st.clientWidth, t = CE.tpl; if(!w || !t) return;
  const nm = ceEl('ceName'), bx = ceEl('ceBox'), f = CERT_FONTS[t.nameFont] || CERT_FONTS[CERT_DEF.nameFont];
  let s = ceEl('ceSample').value.trim() || 'Student Name'; if(t.nameUpper) s = s.toUpperCase();
  const tx = t.nameAlign==='left' ? '0' : t.nameAlign==='right' ? '-100%' : '-50%', maxW = t.nameMaxW*w;
  nm.textContent = s; nm.style.direction = certHasArabic(s) ? 'rtl' : 'ltr'; nm.style.color = t.nameColor;
  nm.style.left = (t.nameX*100)+'%'; nm.style.top = (t.nameY*100)+'%'; nm.style.transform = `translate(${tx},-50%)`;
  let px = Math.max(8, t.nameSize*w);
  for(; px > 8; px -= 2){ nm.style.font = `${f.w} ${px}px ${certFontStack(t.nameFont)}`; if(nm.offsetWidth <= maxW) break; }
  nm.style.font = `${f.w} ${px}px ${certFontStack(t.nameFont)}`;
  bx.style.width = maxW+'px'; bx.style.height = (t.nameSize*w*1.4)+'px'; bx.style.left = (t.nameX*100)+'%'; bx.style.top = (t.nameY*100)+'%'; bx.style.transform = `translate(${tx},-50%)`;
}
function certEdUpdate(){ if(!CE.tpl) return; certEdRead(); certEdPaint(); }
function certEdPoint(e){          /* ضغطة/سحب على الصورة بيحط الاسم هناك */
  const r = ceEl('ceStage').getBoundingClientRect(); if(!r.width || !r.height) return;
  CE.tpl.nameX = Math.min(1, Math.max(0, (e.clientX-r.left)/r.width)); CE.tpl.nameY = Math.min(1, Math.max(0, (e.clientY-r.top)/r.height));
  ceEl('ceX').value = (CE.tpl.nameX*100).toFixed(1); ceEl('ceY').value = (CE.tpl.nameY*100).toFixed(1); certEdPaint();
}
(function bindStage(){
  const st = ceEl('ceStage'); if(!st) return;
  st.addEventListener('pointerdown', e=>{ if(!CE.tpl || !(CE.file || CE.url)) return; e.preventDefault(); try{ st.setPointerCapture(e.pointerId); }catch(_){} CE.drag = true; certEdPoint(e); });
  st.addEventListener('pointermove', e=>{ if(CE.drag) certEdPoint(e); });
  ['pointerup','pointercancel'].forEach(ev=>st.addEventListener(ev, ()=>{ CE.drag = false; }));
  window.addEventListener('resize', ()=>{ if(CE.tpl) certEdPaint(); });
  ceEl('ceImg').addEventListener('load', ()=>{
    ceEl('ceEmpty').style.display = 'none'; certEdPaint();
    if(CE.file && ceEl('ceImg').naturalWidth < 1500) showToast('الصورة صغيرة — الأفضل عرض 2000 بكسل أو أكتر عشان الطباعة تطلع واضحة');
  });
})();

async function certEdOpen(target){
  if(!requireFB()) return;
  CE.target = target; CE.file = null; CE.drag = false; if(CE.obj){ URL.revokeObjectURL(CE.obj); CE.obj = ''; }
  const def = await certLoadDefault(true);
  let own = null, title = 'القالب الافتراضي';
  if(target !== 'default'){
    const a = STATE.activities.find(x=>x.id===target); if(!a) return;
    title = 'قالب «'+a.title+'»';
    own = a.certificate && a.certificate.templateURL ? a.certificate : null;
  }
  const base = target==='default' ? def : (own || (def ? Object.assign({}, def, { templateURL:'' }) : null));   /* فعالية جديدة: تبدأ بمكان الاسم من الافتراضي */
  const cur = target==='default' ? def : own;
  CE.tpl = Object.assign({}, CERT_DEF, base || {}); CE.url = cur && cur.templateURL ? cur.templateURL : '';
  ceEl('ceTitle').textContent = '📜 '+title;
  ceEl('ceFont').innerHTML = Object.keys(CERT_FONTS).map(n=>`<option value="${n}">${CERT_FONTS[n].label}</option>`).join('');
  ceEl('ceFile').value = ''; ceEl('ceRemove').textContent = target==='default' ? 'مسح القالب' : 'استخدام الافتراضي';
  certEdFill();
  const img = ceEl('ceImg'); img.style.display = CE.url ? 'block' : 'none'; ceEl('ceEmpty').style.display = CE.url ? 'none' : 'flex';
  img.removeAttribute('src'); if(CE.url) img.src = CE.url;
  ceEl('certEditModal').classList.add('show');
  await certFonts(Object.keys(CERT_FONTS)); certEdPaint();
}
function certEdClose(){ ceEl('certEditModal').classList.remove('show'); CE.drag = false; }
async function certEdFile(inp){
  const f = inp.files[0]; if(!f) return;
  if(f.type === 'application/pdf' || /\.pdf$/i.test(f.name)){ showToast('ملفات PDF مش مدعومة — احفظ القالب صورة PNG أو JPG وارفعها'); inp.value = ''; return; }
  try{
    const prepared = await certPrepTemplate(f);
    CE.file = prepared; if(CE.obj) URL.revokeObjectURL(CE.obj);
    CE.obj = URL.createObjectURL(prepared);
    const img = ceEl('ceImg'); img.style.display = 'block'; img.src = CE.obj;
  }catch(e){ showToast('مقدرتش أقرأ الصورة دي — جرّب PNG أو JPG'); inp.value = ''; }
}
async function certEdSave(){
  if(CE.busy) return; certEdRead();
  if(!CE.file && !CE.url){ showToast('ارفع صورة القالب الأول'); return; }
  CE.busy = true; const btn = ceEl('ceSave'); btn.disabled = true;
  try{
    let url = CE.url;
    if(CE.file){ url = await uploadImage(CE.file, 'certificates'); if(!url) throw new Error('upload'); }
    const data = Object.assign({}, CE.tpl, { templateURL:url, updatedAt:Date.now() });
    if(CE.target === 'default'){ await db.collection('config').doc('certificate').set(data); CERT.cfg = data; CERT.cfgAt = Date.now(); }
    else await db.collection('activities').doc(CE.target).update({ certificate:data });
    CE.file = null; CE.url = url; ceEl('ceFile').value = '';
    showToast('اتحفظ قالب الشهادة ✔'); certAdminRender(false);
  }catch(e){ console.error('certificate save', e); showToast('مقدرتش أحفظ القالب — جرّب تاني'); }
  CE.busy = false; btn.disabled = false;
}
async function certEdRemove(){
  if(!requireFB()) return;
  const isDef = CE.target === 'default';
  if(!confirm(isDef ? 'تمسح القالب الافتراضي؟ الطلاب مش هيشوفوا زرار الشهادة لحد ما ترفع قالب تاني.' : 'تمسح القالب الخاص بالفعالية دي؟ هتستخدم القالب الافتراضي.')) return;
  try{
    if(isDef){ await db.collection('config').doc('certificate').delete(); CERT.cfg = null; CERT.cfgAt = Date.now(); }
    else await db.collection('activities').doc(CE.target).update({ certificate: firebase.firestore.FieldValue.delete() });
    showToast('تم ✔'); certEdClose(); certAdminRender(false);
  }catch(e){ showToast('مقدرتش أمسح — جرّب تاني'); }
}
function certEdPreview(){
  certEdRead();
  const url = CE.file ? CE.obj : CE.url; if(!url){ showToast('ارفع صورة القالب الأول'); return; }
  certMakeShow(Object.assign({}, CE.tpl, { templateURL:url }), ceEl('ceSample').value.trim() || 'Student Name', 'Preview');
}
