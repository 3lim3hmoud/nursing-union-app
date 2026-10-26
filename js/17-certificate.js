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
const CERT_DEF_BASE = { nameX:.5, nameY:.5, nameSize:.06, nameMaxW:.7, nameColor:'#1a2b52', nameFont:'Playfair Display', nameAlign:'center', nameUpper:false };
/* حقول إضافية بيحدد الأدمن مكانها وشكلها: اسم الفعالية، التاريخ، رقم الشهادة، وكود QR للتحقق من صحتها */
const CERT_DEF = Object.assign({}, CERT_DEF_BASE, {
  titleOn:false,  titleX:.5,  titleY:.62, titleSize:.03,  titleMaxW:.8, titleColor:'#1a2b52', titleFont:'Amiri',      titleAlign:'center',
  dateOn:false,   dateX:.5,   dateY:.72,  dateSize:.022,  dateMaxW:.5,  dateColor:'#4a5878',  dateFont:'Amiri',       dateAlign:'center',
  serialOn:false, serialX:.86,serialY:.95,serialSize:.016,serialMaxW:.3,serialColor:'#4a5878',serialFont:'Montserrat', serialAlign:'right',
  qrOn:false,     qrX:.1,     qrY:.86,    qrSize:.09
});
const CE_FIELDS = [
  { k:'name',   label:'اسم الطالب',    sample:()=>ceEl('ceSample').value.trim() || 'Student Name' },
  { k:'title',  label:'اسم الفعالية',  sample:()=>'Annual Nursing Conference' },
  { k:'date',   label:'التاريخ',       sample:()=>'15 November 2026' },
  { k:'serial', label:'رقم الشهادة',   sample:()=>'NU-7K2M9QX' },
  { k:'qr',     label:'كود QR للتحقق', qr:true }
];
/* رقم ثابت لكل (فعالية + طالب): نفس الرقم كل مرة */
function certSerial(aid, uid){
  let h = 2166136261; const t = aid+'|'+uid;
  for(let i=0;i<t.length;i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return 'NU-' + h.toString(36).toUpperCase().padStart(7,'0').slice(0,7);
}
function certVerifyUrl(aid, uid){ return location.origin + location.pathname + '#verify=' + aid + '.' + uid; }


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
function certDrawField(x, W, H, t, f, txt){
  txt = String(txt||'').replace(/\s+/g,' ').trim(); if(!txt) return;
  const fo = CERT_FONTS[t[f+'Font']] || CERT_FONTS[CERT_DEF[f+'Font']] || CERT_FONTS.Amiri, fam = certFontStack(t[f+'Font'] || CERT_DEF[f+'Font']);
  x.textBaseline = 'middle'; x.textAlign = t[f+'Align'] || 'center'; x.direction = certHasArabic(txt) ? 'rtl' : 'ltr'; x.fillStyle = t[f+'Color'];
  let px = Math.max(14, Math.round(t[f+'Size']*W)); const maxW = t[f+'MaxW']*W;
  for(; px > 14; px -= 2){ x.font = `${fo.w} ${px}px ${fam}`; if(x.measureText(txt).width <= maxW) break; }
  x.font = `${fo.w} ${px}px ${fam}`;
  x.fillText(txt, t[f+'X']*W, t[f+'Y']*H);
}
async function certDrawQr(x, W, H, t, url){
  await loadScriptOnce('js/vendor/qrcode.min.js');
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
  const n = qr.getModuleCount(), size = Math.round(t.qrSize*W), left = t.qrX*W - size/2, top = t.qrY*H - size/2, pad = size*0.07, cell = (size-pad*2)/n;
  x.fillStyle = '#ffffff'; x.fillRect(left, top, size, size);
  x.fillStyle = '#111111';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qr.isDark(r,c)) x.fillRect(left+pad+c*cell, top+pad+r*cell, Math.ceil(cell), Math.ceil(cell));
}
async function certRender(tpl, name, extra){
  const t = Object.assign({}, CERT_DEF, tpl); extra = extra || {};
  await certFonts([t.nameFont, 'Amiri', t.titleFont, t.dateFont, t.serialFont]);
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
  certDrawField(x, W, H, t, 'name', txt);
  if(t.titleOn)  certDrawField(x, W, H, t, 'title',  extra.title);
  if(t.dateOn)   certDrawField(x, W, H, t, 'date',   extra.date);
  if(t.serialOn) certDrawField(x, W, H, t, 'serial', extra.serial);
  if(t.qrOn && extra.verifyUrl){ try{ await certDrawQr(x, W, H, t, extra.verifyUrl); }catch(e){ console.warn('cert qr', e); } }
  return c;
}

/* ---------- PDF بسيط بصفحة واحدة (صورة JPEG ملء الصفحة، بنفس نسبة القالب) ---------- */
function certBuildPdf(jpeg, iw, ih, title){
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const add = b=>{ const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n, body)=>{ offs[n] = len; add(`${n} 0 obj\n`); add(body); add('\nendobj\n'); };
  const PW = iw >= ih ? 842 : 595, PH = Math.round(PW*ih/iw*100)/100;          /* A4 بالنقاط، أفقي أو رأسي حسب القالب */
  const hex = Array.from({length:title.length}, (_,i)=>title.charCodeAt(i).toString(16).padStart(4,'0')).join('').toUpperCase();   /* UTF-16 صح حتى مع الإيموجي */
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
async function certMake(tpl, name, title, extra){
  const cv = await certRender(tpl, name, Object.assign({ title:title }, extra||{}));
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
async function certMakeShow(tpl, name, title, btn, extra){
  if(CERT.busy) return; CERT.busy = true; if(btn) btn.disabled = true;
  showToast('بجهّز الشهادة...');
  try{ await certMake(tpl, name, title, extra); document.getElementById('certModal').classList.add('show'); }
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
  certMakeShow(tpl, STUDENT.name || 'Student', a.title, document.getElementById('certBtn'),
    { date:a.date||'', serial:certSerial(a.id, STUDENT.uid), verifyUrl:certVerifyUrl(a.id, STUDENT.uid) });
}

/* =========================================================================
   جانب الأدمن: قايمة القوالب + محرر مكان الاسم
   ========================================================================= */
const CE = { field:'name', target:'default', tpl:null, file:null, obj:'', url:'', drag:false, busy:false };
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

function certEdFill(){            /* من الحالة للعناصر (الحقل المختار) */
  const t = CE.tpl, f = CE.field, isQ = f==='qr', isN = f==='name';
  ceEl('ceFieldOn').checked = isN || !!t[f+'On']; ceEl('ceFieldOn').disabled = isN;
  if(!isQ){ ceEl('ceFont').value = t[f+'Font']; ceEl('ceMaxW').value = Math.round(t[f+'MaxW']*100); ceEl('ceColor').value = t[f+'Color']; ceEl('ceAlign').value = t[f+'Align']; }
  ceEl('ceSize').value = (t[f+'Size']*100).toFixed(1); ceEl('ceX').value = (t[f+'X']*100).toFixed(1); ceEl('ceY').value = (t[f+'Y']*100).toFixed(1);
  ceEl('ceUpper').checked = !!t.nameUpper;
  ['ceFont','ceMaxW','ceColor','ceAlign'].forEach(id=>{ ceEl(id).parentNode.style.display = isQ ? 'none' : ''; });
  ceEl('ceUpper').parentNode.style.display = isN ? '' : 'none';
}
function certEdRead(){            /* من العناصر للحالة */
  const n = (id,d)=>{ const v = parseFloat(ceEl(id).value); return isNaN(v) ? d : v; }, t = CE.tpl, f = CE.field;
  t[f+'Size'] = n('ceSize',6)/100; t[f+'X'] = n('ceX',50)/100; t[f+'Y'] = n('ceY',50)/100;
  if(f !== 'qr'){ t[f+'Font'] = ceEl('ceFont').value; t[f+'MaxW'] = n('ceMaxW',70)/100; t[f+'Color'] = ceEl('ceColor').value; t[f+'Align'] = ceEl('ceAlign').value; }
  if(f === 'name') t.nameUpper = ceEl('ceUpper').checked; else t[f+'On'] = ceEl('ceFieldOn').checked;
}
function certEdField(v){ if(!CE.tpl) return; certEdRead(); CE.field = v; certEdFill(); certEdPaint(); }
function certEdPaint(){           /* رسم كل الحقول فوق الصورة في المحرر */
  const st = ceEl('ceStage'), w = st.clientWidth, t = CE.tpl; if(!w || !t) return;
  CE_FIELDS.forEach(F=>{
    const k = F.k, on = k==='name' || !!t[k+'On'];
    let node = k==='name' ? ceEl('ceName') : ceEl('ceF_'+k);
    if(!node){ node = document.createElement('div'); node.id = 'ceF_'+k; node.className = F.qr ? 'ce-qr' : 'ce-name'; st.appendChild(node); }
    node.style.display = on ? '' : 'none'; if(!on) return;
    if(F.qr){
      const sz = t.qrSize*w; node.textContent = 'QR';
      Object.assign(node.style, { width:sz+'px', height:sz+'px', left:(t.qrX*100)+'%', top:(t.qrY*100)+'%', transform:'translate(-50%,-50%)', fontSize:Math.max(9, sz*0.28)+'px' });
      return;
    }
    const fo = CERT_FONTS[t[k+'Font']] || CERT_FONTS.Amiri, al = t[k+'Align'];
    let s2 = F.sample(); if(k==='name' && t.nameUpper) s2 = s2.toUpperCase();
    const tx = al==='left' ? '0' : al==='right' ? '-100%' : '-50%', maxW = t[k+'MaxW']*w;
    node.textContent = s2; node.style.direction = certHasArabic(s2) ? 'rtl' : 'ltr'; node.style.color = t[k+'Color'];
    node.style.left = (t[k+'X']*100)+'%'; node.style.top = (t[k+'Y']*100)+'%'; node.style.transform = `translate(${tx},-50%)`;
    let px = Math.max(8, t[k+'Size']*w);
    for(; px > 8; px -= 2){ node.style.font = `${fo.w} ${px}px ${certFontStack(t[k+'Font'])}`; if(node.offsetWidth <= maxW) break; }
    node.style.font = `${fo.w} ${px}px ${certFontStack(t[k+'Font'])}`;
  });
  /* مربع التحديد حوالين الحقل المختار */
  const bx = ceEl('ceBox'), f = CE.field, activeOn = f==='name' || !!t[f+'On'];
  bx.style.display = activeOn ? '' : 'none'; if(!activeOn) return;
  if(f==='qr'){ const sz = t.qrSize*w; Object.assign(bx.style, { width:sz+'px', height:sz+'px', left:(t.qrX*100)+'%', top:(t.qrY*100)+'%', transform:'translate(-50%,-50%)' }); return; }
  const al = t[f+'Align'], tx = al==='left' ? '0' : al==='right' ? '-100%' : '-50%';
  Object.assign(bx.style, { width:(t[f+'MaxW']*w)+'px', height:(t[f+'Size']*w*1.4)+'px', left:(t[f+'X']*100)+'%', top:(t[f+'Y']*100)+'%', transform:`translate(${tx},-50%)` });
}
function certEdUpdate(){ if(!CE.tpl) return; certEdRead(); certEdPaint(); }
function certEdPoint(e){          /* ضغطة/سحب على الصورة بيحط الاسم هناك */
  const r = ceEl('ceStage').getBoundingClientRect(); if(!r.width || !r.height) return;
  const f = CE.field;
  CE.tpl[f+'X'] = Math.min(1, Math.max(0, (e.clientX-r.left)/r.width)); CE.tpl[f+'Y'] = Math.min(1, Math.max(0, (e.clientY-r.top)/r.height));
  ceEl('ceX').value = (CE.tpl[f+'X']*100).toFixed(1); ceEl('ceY').value = (CE.tpl[f+'Y']*100).toFixed(1); certEdPaint();
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
  CE.target = target; CE.file = null; CE.drag = false; CE.field = 'name'; if(CE.obj){ URL.revokeObjectURL(CE.obj); CE.obj = ''; }
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
  ceEl('ceField').innerHTML = CE_FIELDS.map(F=>`<option value="${F.k}">${F.label}</option>`).join(''); ceEl('ceField').value = 'name';
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
  certMakeShow(Object.assign({}, CE.tpl, { templateURL:url }), ceEl('ceSample').value.trim() || 'Student Name', 'Annual Nursing Conference', null,
    { date:'15 November 2026', serial:'NU-7K2M9QX', verifyUrl:location.origin+location.pathname+'#verify=sample.sample' });
}


/* =========================================================================
   التحقق من الشهادة: الـ QR اللي على الشهادة بيفتح رابط #verify=<فعالية>.<طالب>
   الأدمن بيشوف ✅ لو الطالب سُجّل حضوره فعلاً (القواعد بتسمح بالقراءة للأدمن وصاحب الشهادة بس)
   ========================================================================= */
function cvHtml(state, title, lines){
  const ic = state===true ? '✅' : state===false ? '❌' : '🔒';
  return `<div class="cv ${state===true?'ok':state===false?'bad':'warn'}"><i>${ic}</i><b>${esc(title)}</b>${(lines||[]).map(l=>`<p>${esc(l)}</p>`).join('')}</div>`;
}
async function certVerifyRun(aid, uid){
  const m = ceEl('certVerifyModal'), body = ceEl('cvBody'); if(!m) return;
  body.innerHTML = '<div class="empty-note">جاري التحقق...</div>'; m.classList.add('show');
  try{
    const act = db.collection('activities').doc(aid);
    const [r, a] = await Promise.all([ act.collection('registrations').doc(uid).get(), act.get() ]);
    if(!r.exists || !a.exists){ body.innerHTML = cvHtml(false, 'الشهادة دي غير صحيحة', ['مفيش سجل بالبيانات دي.']); return; }
    const d = r.data(), ad = a.data();
    if(!d.attended){ body.innerHTML = cvHtml(false, 'الشهادة غير صحيحة', ['الطالب مسجّل في الفعالية لكن حضوره ماتسجّلش.']); return; }
    body.innerHTML = cvHtml(true, 'شهادة صحيحة', [d.name||'', ad.title||'', [ad.date, ad.place].filter(Boolean).join(' · '), 'رقم الشهادة: '+certSerial(aid, uid)].filter(Boolean));
  }catch(e){
    body.innerHTML = e && e.code==='permission-denied'
      ? cvHtml(null, 'التحقق للإدارة بس', ['سجّل دخول بحساب الأدمن وامسح الكود تاني.'])
      : cvHtml(null, 'مقدرتش أتحقق', ['اتأكد من النت وجرّب تاني.']);
  }
}
function closeCertVerify(){ ceEl('certVerifyModal').classList.remove('show'); }
function certVerifyFromHash(){
  const m = /^#verify=([^.]+)\.(.+)$/.exec(location.hash || '');
  if(!m || !fbReady || !auth || !auth.currentUser) return;
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(_){}
  certVerifyRun(decodeURIComponent(m[1]), decodeURIComponent(m[2]));
}
const _certDefLis = initDeferredListeners;
initDeferredListeners = function(){ _certDefLis(); certVerifyFromHash(); };
window.addEventListener('hashchange', certVerifyFromHash);
