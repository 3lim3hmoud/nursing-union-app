/* =========================================================================
   شهادة الحضور (PDF) — بتتولّد تلقائي للطالب اللي اتسجّل حضوره في الفعالية
   - الرسم على canvas (المتصفح بيشكّل الحروف العربية صح) وبعدين بيتحوّل لملف PDF بدون أي مكتبة
   - الختم والتوقيع: صور بيرفعها الأدمن من لوحة التحكم ← عميدة الكلية (config/dean: sealURL, signatureURL)
     ولو مفيش ختم متحمّل بيترسم ختم افتراضي باسم الكلية، ولو مفيش توقيع بيفضل خط التوقيع فاضي
   ========================================================================= */
const CERT = { W:2339, H:1654, busy:false, blob:null, pdf:null, name:'', fontsP:null, imgCache:{} };
const CERT_NOUN = { conference:'المؤتمر', workshop:'ورشة العمل', event:'الفعالية', activity:'النشاط' };

/* ---------- خطوط الشهادة (أميري للعناوين والاسم) — بتتحمّل أول مرة بس ---------- */
function certFonts(){
  if(CERT.fontsP) return CERT.fontsP;
  CERT.fontsP = (async()=>{
    try{
      if(!document.getElementById('certFontLink')){
        const l = document.createElement('link'); l.id = 'certFontLink'; l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap';
        document.head.appendChild(l);
      }
      const load = Promise.all([
        document.fonts.load('700 80px Amiri','أبت'), document.fonts.load('400 40px Amiri','أبت'),
        document.fonts.load('800 40px Tajawal','أبت'), document.fonts.load('500 40px Tajawal','أبت')
      ]);
      await Promise.race([load, new Promise(r=>setTimeout(r,5000))]);   /* لو النت ضعيف نكمّل بالخط البديل */
    }catch(_){}
  })();
  return CERT.fontsP;
}

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

/* ---------- أدوات رسم ---------- */
function certWrap(ctx, text, maxW, maxLines){
  const words = String(text||'').split(/\s+/).filter(Boolean), lines = []; let cur = '';
  words.forEach(w=>{ const t = cur ? cur+' '+w : w; if(ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; });
  if(cur) lines.push(cur);
  return lines.slice(0, maxLines||3);
}
/* بيصغّر الخط لحد ما النص يتسع في السطر (للأسماء الطويلة) */
function certFit(ctx, text, weight, family, maxPx, minPx, maxW){
  let px = maxPx;
  for(; px > minPx; px -= 4){ ctx.font = `${weight} ${px}px ${family}`; if(ctx.measureText(text).width <= maxW) break; }
  ctx.font = `${weight} ${px}px ${family}`; return px;
}
function certDiamond(ctx, x, y, s){ ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x+s,y); ctx.lineTo(x,y+s); ctx.lineTo(x-s,y); ctx.closePath(); ctx.fill(); }
function certDivider(ctx, cx, y, half, gold){
  const g = ctx.createLinearGradient(cx-half,0,cx+half,0);
  g.addColorStop(0,'rgba(185,143,46,0)'); g.addColorStop(.5,gold); g.addColorStop(1,'rgba(185,143,46,0)');
  ctx.strokeStyle = g; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx-half,y); ctx.lineTo(cx-18,y); ctx.moveTo(cx+18,y); ctx.lineTo(cx+half,y); ctx.stroke();
  ctx.fillStyle = gold; certDiamond(ctx, cx, y, 9);
}
/* زخرفة ركن: أقواس متداخلة + معين صغير (بتتعكس للأركان التانية) */
function certCorner(ctx, x, y, sx, sy, gold, navy){
  ctx.save(); ctx.translate(x,y); ctx.scale(sx,sy);
  ctx.lineCap = 'round';
  [[150,5,gold],[118,3,navy],[86,3,gold],[54,2.5,navy]].forEach(([r,w,c])=>{
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI/2); ctx.stroke();
  });
  ctx.fillStyle = gold; certDiamond(ctx, 178, 12, 8); certDiamond(ctx, 12, 178, 8);
  ctx.fillStyle = navy; ctx.beginPath(); ctx.arc(22,22,7,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ختم افتراضي باسم الكلية (لو الأدمن ماحطش ختم رسمي) — حبر أزرق بتأثير مطبوع */
function certDefaultSeal(ctx, cx, cy, r){
  const ink = '#1a4aa8', ri = r-44;                    /* ri = نصف قطر الحلقة الداخلية */
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(-0.13); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .88;
  ctx.fillStyle = 'rgba(26,74,168,.05)'; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,r-16,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle = ink;
  for(let i=0;i<64;i++){ const a = i/64*Math.PI*2; ctx.beginPath(); ctx.arc(Math.cos(a)*(r-30), Math.sin(a)*(r-30), 3.2, 0, Math.PI*2); ctx.fill(); }
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0,0,ri,0,Math.PI*2); ctx.stroke();
  /* قلب صغير فوق الاسم */
  const hy = -ri*.52, hs = ri*.15;
  ctx.beginPath(); ctx.moveTo(0,hy+hs); ctx.bezierCurveTo(-hs*1.9,hy-hs*.2,-hs*.9,hy-hs*1.5,0,hy-hs*.45); ctx.bezierCurveTo(hs*.9,hy-hs*1.5,hs*1.9,hy-hs*.2,0,hy+hs); ctx.fill();
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  certFit(ctx, 'كلية التمريض', 800, 'Tajawal, sans-serif', 44, 20, ri*1.62); ctx.fillText('كلية التمريض', 0, ri*.06);
  certFit(ctx, 'جامعة الريادة', 700, 'Tajawal, sans-serif', 32, 16, ri*1.4); ctx.fillText('جامعة الريادة', 0, ri*.42);
  ctx.fillRect(-ri*.62, ri*.74-2, ri*.2, 4); ctx.fillRect(ri*.42, ri*.74-2, ri*.2, 4);
  certDiamond(ctx, 0, ri*.74, 6);
  ctx.restore();
}

/* ---------- رسم الشهادة كاملة ----------
   d = { name, studentId, level, title, kind, dateText, place, serial, issuedText, dean:{name,role,signatureURL,sealURL}, president } */
async function certDraw(d){
  await certFonts();
  const W = CERT.W, H = CERT.H, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const NAVY = '#0c2f6b', BLUE = '#1360d2', GOLD = '#b98f2e', GOLD_D = '#8a6a1e', INK = '#22304d', SOFT = '#5a6b8c';
  const SERIF = 'Amiri, "Tajawal", serif', SANS = 'Tajawal, "IBM Plex Sans Arabic", sans-serif';
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';

  /* الخلفية */
  const bg = x.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#fffdf8'); bg.addColorStop(.55,'#fdf9ee'); bg.addColorStop(1,'#f8f1de');
  x.fillStyle = bg; x.fillRect(0,0,W,H);
  /* نسيج خفيف: دوائر متداخلة هادية من المنتصف */
  x.save(); x.translate(W/2,H/2); x.strokeStyle = 'rgba(19,96,210,.045)'; x.lineWidth = 2;
  for(let r=120;r<1500;r+=34){ x.beginPath(); x.ellipse(0,0,r*1.25,r*.9,0,0,Math.PI*2); x.stroke(); }
  x.restore();

  /* العلامة المائية (لوجو الاتحاد باهت في النص) */
  const logo = await certImage('images/logo.png');
  if(logo){ x.save(); x.globalAlpha = .055; x.globalCompositeOperation = 'multiply'; const s = 900; x.drawImage(logo, W/2-s/2, H/2-s/2+30, s, s); x.restore(); }

  /* الإطارات */
  x.strokeStyle = NAVY; x.lineWidth = 16; x.strokeRect(52,52,W-104,H-104);
  x.strokeStyle = GOLD; x.lineWidth = 5; x.strokeRect(84,84,W-168,H-168);
  x.strokeStyle = NAVY; x.lineWidth = 2; x.strokeRect(102,102,W-204,H-204);
  certCorner(x,102,102,1,1,GOLD,NAVY); certCorner(x,W-102,102,-1,1,GOLD,NAVY);
  certCorner(x,102,H-102,1,-1,GOLD,NAVY); certCorner(x,W-102,H-102,-1,-1,GOLD,NAVY);

  /* الرأس: جامعة + لوجو + اتحاد */
  const cx = W/2;
  if(logo){
    x.save(); x.beginPath(); x.arc(cx,238,100,0,Math.PI*2); x.closePath(); x.clip();
    x.fillStyle = '#fff'; x.fillRect(cx-100,138,200,200); x.drawImage(logo, cx-100, 138, 200, 200); x.restore();
    x.strokeStyle = GOLD; x.lineWidth = 5; x.beginPath(); x.arc(cx,238,106,0,Math.PI*2); x.stroke();
  }
  x.fillStyle = NAVY; x.font = `700 52px ${SERIF}`;
  x.fillText('جامعة الريادة', W-420, 232); x.font = `700 42px ${SERIF}`; x.fillText('كلية التمريض', W-420, 290);
  x.fillText('اتحاد طلاب', 420, 232); x.fillText('كلية التمريض', 420, 290);
  x.fillStyle = GOLD; x.fillRect(W-420-110, 312, 220, 4); x.fillRect(420-110, 312, 220, 4);

  /* العنوان */
  const tg = x.createLinearGradient(cx-500,0,cx+500,0); tg.addColorStop(0,NAVY); tg.addColorStop(.5,BLUE); tg.addColorStop(1,NAVY);
  x.fillStyle = tg; x.font = `700 150px ${SERIF}`; x.fillText('شهادة حضور', cx, 480);
  certDivider(x, cx, 522, 470, GOLD);

  /* المتن (كل سطر بيصغّر نفسه لو طويل عشان ميلمسش الإطار أو الختم) */
  const BW = W-520;
  x.fillStyle = SOFT; x.font = `500 42px ${SANS}`; x.fillText('تُمنح هذه الشهادة إلى', cx, 596);
  x.fillStyle = NAVY; certFit(x, d.name || 'اسم الطالب', 700, SERIF, 130, 64, W-620);
  x.fillText(d.name || 'اسم الطالب', cx, 722);
  const ug = x.createLinearGradient(cx-520,0,cx+520,0); ug.addColorStop(0,'rgba(185,143,46,0)'); ug.addColorStop(.5,GOLD); ug.addColorStop(1,'rgba(185,143,46,0)');
  x.strokeStyle = ug; x.lineWidth = 4; x.beginPath(); x.moveTo(cx-520,754); x.lineTo(cx+520,754); x.stroke();
  const meta = [d.studentId ? 'الرقم الجامعي: '+d.studentId : '', d.level ? 'الفرقة: '+d.level : ''].filter(Boolean).join('   •   ');
  let y = 754;
  if(meta){ x.fillStyle = SOFT; certFit(x, meta, 500, SANS, 36, 24, BW); x.fillText(meta, cx, 810); y = 810; }

  const noun = CERT_NOUN[d.kind] || CERT_NOUN.activity;
  x.fillStyle = INK; x.font = `400 48px ${SERIF}`; x.fillText('وذلك لحضور '+noun, cx, y+72);
  x.fillStyle = GOLD_D; x.font = `700 78px ${SERIF}`;
  const tl = certWrap(x, '«'+(d.title||'')+'»', W-560, 2);
  tl.forEach((l,i)=>x.fillText(l, cx, y+156+i*90));
  y = y + 156 + (tl.length-1)*90;
  const when = [d.dateText ? 'المنعقد بتاريخ '+d.dateText : '', d.place ? 'في '+d.place : ''].filter(Boolean).join(' — ');
  if(when){ x.fillStyle = INK; certFit(x, when, 400, SERIF, 42, 28, BW); x.fillText(when, cx, y+76); y += 76; }
  const closing = 'تقديراً للحضور والمشاركة، مع أطيب التمنيات بدوام التوفيق والنجاح';
  x.fillStyle = SOFT; certFit(x, closing, 400, SERIF, 38, 26, BW); x.fillText(closing, cx, y+68);

  /* التوقيعات والختم */
  const baseY = H-262, lineW = 500;
  const sx = W-470;                                   /* العميدة (يمين) */
  const sig = d.dean && d.dean.signatureURL ? await certImage(d.dean.signatureURL) : null;
  if(sig){
    const mh = 170, mw = 420, r = Math.min(mw/sig.width, mh/sig.height), w = sig.width*r, h = sig.height*r;
    x.save(); x.globalCompositeOperation = 'multiply'; x.drawImage(sig, sx-w/2, baseY-h+12, w, h); x.restore();
  }
  x.strokeStyle = NAVY; x.lineWidth = 3; x.beginPath(); x.moveTo(sx-lineW/2,baseY); x.lineTo(sx+lineW/2,baseY); x.stroke();
  x.fillStyle = NAVY; x.font = `700 46px ${SERIF}`; x.fillText((d.dean && d.dean.name) || '', sx, baseY+58);
  x.fillStyle = SOFT; x.font = `500 34px ${SANS}`; x.fillText((d.dean && d.dean.role) || 'عميدة الكلية', sx, baseY+104);

  const px = 470;                                     /* رئيس الاتحاد (شمال) */
  x.strokeStyle = NAVY; x.lineWidth = 3; x.beginPath(); x.moveTo(px-lineW/2,baseY); x.lineTo(px+lineW/2,baseY); x.stroke();
  x.fillStyle = NAVY; x.font = `700 46px ${SERIF}`; x.fillText(d.president || '', px, baseY+58);
  x.fillStyle = SOFT; x.font = `500 34px ${SANS}`; x.fillText('رئيس اتحاد الطلاب', px, baseY+104);

  const seal = d.dean && d.dean.sealURL ? await certImage(d.dean.sealURL) : null;   /* الختم (النص) */
  if(seal){ const s = 280, r = Math.min(s/seal.width, s/seal.height); x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = .92;
    x.drawImage(seal, cx-seal.width*r/2, baseY-48-seal.height*r/2, seal.width*r, seal.height*r); x.restore(); }
  else certDefaultSeal(x, cx, baseY-48, 138);

  /* الذيل: رقم الشهادة وتاريخ الإصدار */
  x.fillStyle = SOFT; x.font = `500 30px ${SANS}`;
  x.fillText(`رقم الشهادة: ${d.serial}   •   تاريخ الإصدار: ${d.issuedText}`, cx, H-122);
  return c;
}

/* ---------- PDF بسيط بصفحة واحدة (صورة JPEG بعرض الصفحة) ---------- */
function certBuildPdf(jpeg, iw, ih, title){
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const add = b=>{ const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n, body)=>{ offs[n] = len; add(`${n} 0 obj\n`); add(body); add('\nendobj\n'); };
  const PW = 842, PH = Math.round(842*ih/iw*100)/100;          /* A4 أفقي بالنقاط */
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

/* ---------- تجهيز بيانات الشهادة من الفعالية والطالب ---------- */
function certSerial(actId, uid){
  const h = Math.abs(hashStr(String(actId)+'|'+String(uid))).toString(36).toUpperCase().padStart(6,'0').slice(0,6);
  const t = new Date(), ym = String(t.getFullYear()).slice(2) + String(t.getMonth()+1).padStart(2,'0');
  return `NU-${ym}-${h}`;
}
function certData(a, who){
  const st = typeof actStart==='function' ? actStart(a) : null;
  const dateText = st ? st.toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}) : (a.date||'');
  const pres = STATE.leadership && STATE.leadership.presidentName;
  return {
    name: who.name, studentId: who.studentId||'', level: who.level||'',
    title: a.title||'', kind: a.kind||'activity', dateText, place: a.place||'',
    serial: certSerial(a.id||'sample', who.uid||'sample'),
    issuedText: new Date().toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}),
    dean: STATE.dean, president: pres && pres !== '—' ? pres : ''
  };
}

/* ---------- الواجهة: نافذة المعاينة + التنزيل ---------- */
async function certMake(d){
  const cv = await certDraw(d);
  const jpegBlob = await new Promise(r=>cv.toBlob(r,'image/jpeg',.93));
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  CERT.pdf = certBuildPdf(jpeg, cv.width, cv.height, 'شهادة حضور - '+(d.title||''));
  CERT.blob = jpegBlob;
  CERT.name = ('شهادة حضور - '+(d.title||'فعالية')).replace(/[\\/:*?"<>|]/g,' ').trim();
  const prev = document.getElementById('certPrev');
  if(prev.dataset.u) URL.revokeObjectURL(prev.dataset.u);
  prev.dataset.u = prev.src = URL.createObjectURL(jpegBlob);
}
async function openCertificate(){
  const a = STATE.activities.find(x=>x.id===modalActivityId);
  if(!a || !STUDENT.uid){ showToast('سجّل دخولك الأول'); return; }
  if(CERT.busy) return; CERT.busy = true;
  const btn = document.getElementById('certBtn'); if(btn) btn.disabled = true;
  showToast('بجهّز شهادتك...');
  try{
    await certMake(certData(a, STUDENT));
    document.getElementById('certModal').classList.add('show');
  }catch(e){ console.error('certificate error', e); showToast('مقدرتش أجهّز الشهادة — جرّب تاني'); }
  CERT.busy = false; if(btn) btn.disabled = false;
}
/* معاينة للأدمن من لوحة التحكم (باسم تجريبي، وبتستخدم الصور اللي اخترتها قبل الحفظ لو موجودة) */
async function previewCertificate(){
  if(CERT.busy) return; CERT.busy = true;
  showToast('بجهّز المعاينة...');
  const urls = [];
  try{
    const a = STATE.activities.find(x=>x.kind==='conference') || STATE.activities[0] || { title:'المؤتمر العلمي لكلية التمريض', kind:'conference', place:'القاعة الرئيسية', date:'' };
    const d = certData(a, { name:'اسم الطالب/ة التجريبي', studentId:'20260001', level:'الفرقة الثالثة', uid:'sample' });
    d.dean = Object.assign({}, STATE.dean);
    const sig = document.getElementById('af-deanSig'), seal = document.getElementById('af-deanSeal');
    if(sig && sig.files[0]){ d.dean.signatureURL = URL.createObjectURL(sig.files[0]); urls.push(d.dean.signatureURL); }
    if(seal && seal.files[0]){ d.dean.sealURL = URL.createObjectURL(seal.files[0]); urls.push(d.dean.sealURL); }
    await certMake(d);
    document.getElementById('certModal').classList.add('show');
  }catch(e){ console.error('certificate preview error', e); showToast('مقدرتش أجهّز المعاينة'); }
  urls.forEach(u=>{ delete CERT.imgCache[u]; setTimeout(()=>URL.revokeObjectURL(u), 60000); });
  CERT.busy = false;
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

/* ---------- زر الشهادة في نافذة الفعالية: بيظهر بعد ما الأدمن يسجّل حضور الطالب ---------- */
async function certRefreshBtn(id){
  const btn = document.getElementById('certBtn'); if(!btn) return;
  btn.style.display = 'none';
  const a = STATE.activities.find(x=>x.id===id);
  if(!a || !a.requiresRegistration || !fbReady || !STUDENT.uid) return;
  try{
    const d = await db.collection('activities').doc(id).collection('registrations').doc(STUDENT.uid).get();
    if(modalActivityId === id && d.exists && d.data().attended) btn.style.display = '';
  }catch(_){}
}
const _certOpenAct = openActivityModal;
openActivityModal = function(id){ _certOpenAct(id); certRefreshBtn(id); };
