/* =========================================================================
   إعداد ثابت (تصنيفات، ألوان) — مش بيانات، ده شكل التطبيق بس
   ========================================================================= */
const CATS = {
  scientific:{label:'علمي', color:'#4d8dff'},
  cultural:{label:'ثقافي', color:'#b27cff'},
  sports:{label:'رياضي', color:'#33c77b'},
  artistic:{label:'فني', color:'#ff6fa0'},
  social:{label:'اجتماعي', color:'#caa53d'}
};

const GUEST_STUDENT = {
  uid:null, name:'زائر', studentId:'', avatarInitial:'؟', level:'', points:0, rank:'—',
  events:0, workshops:0, competitions:0, campaigns:0, activeLevel:'—'
};
let STUDENT = {...GUEST_STUDENT};

/* القيم دي هي الافتراضية بس — الأدمن يقدر يعدلها من لوحة التحكم وهتتحفظ في Firestore */
const DEFAULT_DEAN = {
  name:'أ.د. هناء محمد', role:'عميدة كلية التمريض', initial:'هـ', photoURL:'',
  bio:'تشغل أ.د. هناء محمد منصب عميدة كلية التمريض، وتمتلك خبرة تتجاوز 20 عاماً في القيادة الأكاديمية والبحث العلمي والرعاية الصحية. تسعى دائماً لتطوير بيئة تعليمية داعمة للطلاب.',
  quote:'"معاً نبني مستقبلاً أفضل لطلابنا ومجتمعنا."'
};
const DEFAULT_VICE = {
  name:'د. سارة علي', role:'وكيلة الكلية لشؤون الطلاب', initial:'س', photoURL:'',
  bio:'تتولى د. سارة علي متابعة الأنشطة الطلابية وشؤون الاتحاد، وتدعم مبادرات الطلاب العلمية والثقافية بشكل مستمر.',
  quote:'"طاقة الطلاب هي وقود أي إنجاز حقيقي."'
};

const MEDIA_ITEMS = [
  {type:'image', src:'images/building.jpg', tag:'المقر', title:'مبنى كلية التمريض', sub:'جامعة الريادة'},
  {type:'image', src:'', color1:'#4d8dff', color2:'#0d1836', tag:'علمي', title:'اليوم العلمي 2026', sub:'فعاليات وورش تفاعلية'},
  {type:'video', src:'', color1:'#33c77b', color2:'#0d1836', tag:'رياضي', title:'بطولة كرة القدم', sub:'شاهد ملخص المباراة'},
  {type:'image', src:'', color1:'#b27cff', color2:'#0d1836', tag:'ثقافي', title:'مسابقة الشعر', sub:'أجمل اللحظات'},
  {type:'video', src:'', color1:'#caa53d', color2:'#0d1836', tag:'تطوعي', title:'حملة التبرع بالدم', sub:'فيديو توعوي قصير'},
];

/* =========================================================================
   Firebase — الاتصال بقاعدة البيانات + تسجيل الدخول + تخزين الصور
   ========================================================================= */
let fbReady = false, auth = null, db = null;
try{
  if(typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('ضع_')){
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    /* كاش دائم على الجهاز: الفتحة التانية بتظهر فوراً من الكاش وبتقرا من السيرفر اللي اتغيّر بس (أسرع + أرخص) */
    try{ if(typeof db.enablePersistence === 'function') db.enablePersistence({ synchronizeTabs:true }).catch(()=>{}); }catch(_){}
    fbReady = true;
  }
}catch(e){ console.error('Firebase init error:', e); }

/* الحالة الحيّة اللي بتتحدث تلقائي من قاعدة البيانات */
const STATE = {
  nextEvent:{name:'اليوم العلمي 2026', place:'القاعة الرئيسية', image:'images/building.jpg',
    date:new Date(Date.now()+(3*86400+14*3600+27*60)*1000).toISOString()},
  studentOfWeek:{name:'—', initial:'-', level:'—', points:0, photoURL:'', uid:''},
  leadership:{presidentName:'—', presidentPhoto:'', vpName:'—', vpPhoto:''},
  dean:{...DEFAULT_DEAN}, viceDean:{...DEFAULT_VICE},
  activities:[], magazines:[], campaigns:[], committees:[], leaderboard:[], members:[], news:[], polls:[], pollVotes:{}, pollTally:{}, myVote:{}, myVoteLoaded:{}, media:[], myRegs:{}
};

function docToItem(doc){ const d=doc.data(); d.id=doc.id; return d; }

/* ---------- أداء: حدود القراءة + تجميع الرسم + تحميل كسول ---------- */
/* أحدث N عنصر بس: بيقلل القراءات والبطء. (الأقدم مش بيظهر في التطبيق) */
const LIM = { activities:120, campaigns:60, news:100, polls:40, media:80, magazines:60, committees:60, members:150, leaderboard:100 };
/* رسم واحد بس لكل دالة في الفريم الواحد — بدل ما الرئيسية تتبني 6 مرات وقت التحميل */
const _rqSet = new Set();
function rq(fn){
  if(_rqSet.has(fn)) return; _rqSet.add(fn);
  const run = ()=>{ _rqSet.delete(fn); try{ fn(); }catch(e){ console.error('render error:', e); } };
  if(typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 16);
}
const _isAdm = ()=> typeof IS_ADMIN !== 'undefined' && IS_ADMIN;
/* مجموعات مش بتتحمّل غير لما صاحبها يفتح الصفحة (أو لما الأدمن يدخل) */
const LAZY_ON = {};
const LAZY_DEF = {
  magazines(){ db.collection('magazines').orderBy('createdAt','desc').limit(LIM.magazines).onSnapshot(snap=>{
    STATE.magazines = snap.docs.map(docToItem); STATE.ldMags = true; rq(renderMags); if(_isAdm()) rq(renderAdminMagazines);
  }, ()=>{}); },
  committees(){ db.collection('committees').orderBy('createdAt','desc').limit(LIM.committees).onSnapshot(snap=>{
    STATE.committees = snap.docs.map(docToItem); STATE.ldComm = true;
    if(['committees','members'].includes(document.querySelector('.lead-tab.active')?.dataset.lt)) switchLead(document.querySelector('.lead-tab.active').dataset.lt);
    if(_isAdm()) rq(renderAdminCommittees);
  }, ()=>{}); },
  members(){ db.collection('members').orderBy('createdAt','desc').limit(LIM.members).onSnapshot(snap=>{
    STATE.members = snap.docs.map(docToItem);
    if(document.querySelector('.lead-tab.active')?.dataset.lt==='members') switchLead('members');
    if(_isAdm()) rq(renderAdminMembers);
  }, ()=>{}); },
  leaderboard(){ db.collection('leaderboard').orderBy('points','desc').limit(LIM.leaderboard).onSnapshot(snap=>{
    STATE.leaderboard = snap.docs.map(docToItem); STATE.ldBoard = true;
    rq(renderRanking); if(_isAdm()) rq(renderAdminLeaderboard); rq(renderProfile);
  }, ()=>{}); }
};
const LAZY_PAGES = { leadership:['committees','members'], magazines:['magazines'], ranking:['leaderboard'], profile:['leaderboard'] };
function startLazy(name){
  if(LAZY_ON[name] || !fbReady || !auth || !auth.currentUser || !LAZY_DEF[name]) return;
  LAZY_ON[name] = true; LAZY_DEF[name]();
}
function startAllLazy(){ Object.keys(LAZY_DEF).forEach(startLazy); }
/* لحظة ما الأدمن يتعرّف: نرسم قوايم الإدارة بالبيانات اللي وصلت قبل كده (القوايم الكسولة بترسم نفسها لما بياناتها توصل) */
function renderAllAdmin(){
  [renderAdminActivities, renderAdminCampaigns, renderAdminNews, renderAdminMedia, adminDashRefresh].forEach(f=>rq(f));
  startAllLazy();
}
function ensurePageData(page){
  if(page === 'admin') startAllLazy(); else (LAZY_PAGES[page]||[]).forEach(startLazy);
  if(page === 'polls' && typeof loadClosedPollTallies === 'function') loadClosedPollTallies();   /* نتايج التصويتات المنتهية: مرة واحدة */
}

function initFirestoreListeners(){
  if(!fbReady){
    showToast('التطبيق مش متوصل بقاعدة بيانات لسه — راجع ملف firebase-config.js');
    return;
  }
  db.collection('config').doc('nextEvent').onSnapshot(doc=>{
    if(doc.exists) Object.assign(STATE.nextEvent, doc.data());
    renderHome(); startCountdown();
  });
  db.collection('config').doc('studentOfWeek').onSnapshot(doc=>{
    if(doc.exists) Object.assign(STATE.studentOfWeek, doc.data());
    renderHome();
  });
  db.collection('config').doc('leadership').onSnapshot(doc=>{
    if(doc.exists) Object.assign(STATE.leadership, doc.data());
    if(['members','committees'].includes(document.querySelector('.lead-tab.active')?.dataset.lt)) switchLead(document.querySelector('.lead-tab.active').dataset.lt);
    if(document.getElementById('af-ldPresName') && !document.getElementById('af-ldPresName').value){
      document.getElementById('af-ldPresName').value = STATE.leadership.presidentName||'';
      document.getElementById('af-ldVpName').value = STATE.leadership.vpName||'';
    }
  });
  db.collection('config').doc('dean').onSnapshot(doc=>{
    if(doc.exists) Object.assign(STATE.dean, doc.data());
    if(document.querySelector('.lead-tab.active')?.dataset.lt==='dean') switchLead('dean');
    if(document.getElementById('af-deanName') && !document.getElementById('af-deanName').value){
      document.getElementById('af-deanName').value = STATE.dean.name||'';
      document.getElementById('af-deanRole').value = STATE.dean.role||'';
      document.getElementById('af-deanBio').value = STATE.dean.bio||'';
      document.getElementById('af-deanQuote').value = STATE.dean.quote||'';
    }
  });
  db.collection('config').doc('viceDean').onSnapshot(doc=>{
    if(doc.exists) Object.assign(STATE.viceDean, doc.data());
    if(document.querySelector('.lead-tab.active')?.dataset.lt==='vice') switchLead('vice');
    if(document.getElementById('af-viceName') && !document.getElementById('af-viceName').value){
      document.getElementById('af-viceName').value = STATE.viceDean.name||'';
      document.getElementById('af-viceRole').value = STATE.viceDean.role||'';
      document.getElementById('af-viceBio').value = STATE.viceDean.bio||'';
      document.getElementById('af-viceQuote').value = STATE.viceDean.quote||'';
    }
  });
  db.collection('activities').orderBy('createdAt','desc').limit(LIM.activities).onSnapshot(snap=>{
    STATE.activities = snap.docs.map(docToItem); STATE.ldAct = true;
    if(typeof notifCheck==='function') notifCheck('activities', STATE.activities);
    rq(renderActivities); rq(renderHome); rq(startCountdown);
    if(_isAdm()){ rq(renderAdminActivities); rq(adminDashRefresh); }
  }, ()=>{});
  db.collection('campaigns').orderBy('createdAt','desc').limit(LIM.campaigns).onSnapshot(snap=>{
    STATE.campaigns = snap.docs.map(docToItem);
    rq(renderCamps); rq(renderHome);
    if(_isAdm()) rq(renderAdminCampaigns);
  }, ()=>{});
  db.collection('news').orderBy('createdAt','desc').limit(LIM.news).onSnapshot(snap=>{
    STATE.news = snap.docs.map(docToItem); STATE.ldNews = true;
    if(typeof notifCheck==='function') notifCheck('news', STATE.news);
    rq(renderNews); rq(renderHome);
    if(_isAdm()){ rq(adminDashRefresh); rq(renderAdminNews); }
  }, ()=>{});
  db.collection('polls').orderBy('createdAt','desc').limit(LIM.polls).onSnapshot(snap=>{
    STATE.pollErr = '';
    STATE.polls = snap.docs.map(docToItem);
    syncPollVotes(); rq(renderPolls);
    if(_isAdm()){ rq(renderAdminPolls); rq(adminDashRefresh); }
  }, err=>pollLoadError(err));
  db.collection('media').orderBy('createdAt','desc').limit(LIM.media).onSnapshot(snap=>{
    STATE.media = snap.docs.map(docToItem);
    rq(renderMediaCarousel); rq(renderMediaPage);
    if(_isAdm()){ rq(renderAdminMedia); rq(adminDashRefresh); }
  }, ()=>{});
  const later = ()=>initDeferredListeners();
  if('requestIdleCallback' in window) requestIdleCallback(later, { timeout:2000 }); else setTimeout(later, 1200);
}

/* بعد الدخول: بنبدأ بس المجموعات اللي الصفحة الحالية محتاجاها. الباقي بيتحمّل لما الطالب يفتح صفحته (goPage → ensurePageData). */
function initDeferredListeners(){
  ensurePageData(typeof CUR_PAGE !== 'undefined' ? CUR_PAGE : 'home');
}


/* ========================= تسجيل دخول الأدمن ========================= */
let adminLoginAttempted = false;
/* رسالة واضحة بدل "حصل خطأ" — عشان نعرف المشكلة فين بالظبط */
function authErrMsg(err){
  const c = (err && err.code) || '';
  if(c.includes('unauthorized-domain')) return 'الدومين ده ('+location.hostname+') مش مضاف في Firebase: Authentication ← Settings ← Authorized domains ← Add domain.';
  if(c.includes('requests-from-referer') || c.includes('api-key-not-valid') || c.includes('invalid-api-key')) return 'مفتاح Firebase (API key) مقفول على دومينات معينة والدومين ده ('+location.hostname+') مش منهم: Google Cloud Console ← APIs & Services ← Credentials ← Browser key ← Website restrictions ← ضيف '+location.hostname+'/* .';
  if(c.includes('operation-not-allowed')) return 'طريقة الدخول دي مش مفعّلة في Firebase: Authentication ← Sign-in method ← فعّل Google (أو Email/Password).';
  if(c.includes('popup-closed-by-user') || c.includes('cancelled-popup-request')) return 'نافذة جوجل اتقفلت قبل ما تكمّل الدخول.';
  if(c.includes('popup-blocked')) return 'المتصفح منع نافذة جوجل — هجرّب طريقة تانية تلقائي.';
  if(c.includes('network-request-failed')) return 'مشكلة في الاتصال بالنت، جرّب تاني.';
  if(c.includes('too-many-requests')) return 'محاولات كتير — استنى شوية وجرّب تاني.';
  if(c.includes('user-disabled')) return 'الحساب ده متعطّل في Firebase.';
  if(c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email')) return 'الإيميل أو كلمة السر غلط، أو الحساب ده مش متعمل في Firebase.';
  return 'حصل خطأ في تسجيل الدخول'+(c?' ('+c+')':'')+'، جرّب تاني.';
}
function adminLoginShowErr(err){
  adminLoginAttempted = false;
  const b = document.getElementById('adminLoginError'); if(b) b.textContent = authErrMsg(err);
  console.error('Admin login error:', err);
}
function adminLogin(ev){
  ev.preventDefault();
  if(!fbReady){ showToast('لازم تحط بيانات Firebase الأول في firebase-config.js'); return false; }
  const email = document.getElementById('admLoginEmail').value.trim();
  const pass = document.getElementById('admLoginPass').value;
  document.getElementById('adminLoginError').textContent = '';
  adminLoginAttempted = true;
  auth.signInWithEmailAndPassword(email, pass).catch(adminLoginShowErr);
  return false;
}
/* دخول جوجل (للطلاب والأدمن): نافذة منبثقة الأول — لأن الـ redirect بيرجّعك للصفحة الرئيسية من غير ما يكمّل الدخول
   في المتصفحات اللي بتمنع التخزين بين المواقع (كروم/سفاري الجداد). الـ redirect احتياطي بس لو النافذة اتمنعت. */
async function googleSignIn(onErr){
  if(!fbReady){ showToast('لازم تحط بيانات Firebase الأول في firebase-config.js'); return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt:'select_account' });
  try{
    await auth.signInWithPopup(provider);
  }catch(err){
    const c = (err && err.code) || '';
    if(c.includes('popup-blocked') || c.includes('operation-not-supported') || c.includes('web-storage-unsupported')){
      try{ sessionStorage.setItem('nuAuthRedirect','1'); }catch(_){}
      try{ await auth.signInWithRedirect(provider); return; }catch(e2){ err = e2; }
    }
    onErr(err);
  }
}
function adminLoginGoogle(){
  document.getElementById('adminLoginError').textContent = '';
  adminLoginAttempted = true;
  try{ sessionStorage.setItem('nuAdminTry','1'); }catch(_){}
  googleSignIn(adminLoginShowErr);
}
function studentLoginGoogle(){
  const box = document.getElementById('gateError'); if(box) box.textContent = '';
  googleSignIn(err=>{ if(box) box.textContent = authErrMsg(err); console.error('Student Google login error:', err); });
}
/* نتيجة الدخول بالتحويل (redirect): لازم نلتقط الخطأ لو حصل */
if(fbReady){ auth.getRedirectResult().catch(adminLoginShowErr); }
function adminLogout(){ if(fbReady) auth.signOut(); }
/* ملاحظة: الفحص ده للواجهة بس (يظهر/يخفي لوحة التحكم). الحماية الحقيقية في firestore.rules.
   الأدمن = إيميل من القايمة دي، أو uid موجود في collection اسمها admins (بتتضاف من Firebase Console). */
const ADMIN_EMAILS = ['alikimo1942@gmail.com'];
const ADMIN_CACHE = {};
function isAdminEmail(user){ return !!(user && ADMIN_EMAILS.includes((user.email||'').toLowerCase())); }
async function resolveIsAdmin(user){
  if(!user) return false;
  if(isAdminEmail(user)) return true;
  if(Object.prototype.hasOwnProperty.call(ADMIN_CACHE, user.uid)) return ADMIN_CACHE[user.uid];
  try{
    const d = await db.collection('admins').doc(user.uid).get();
    return (ADMIN_CACHE[user.uid] = d.exists);
  }catch(e){ return false; }
}
if(fbReady){
  auth.onAuthStateChanged(async user=>{
    const isAdm = await resolveIsAdmin(user);
    const loginBox = document.getElementById('adminLogin');
    const panel = document.getElementById('adminPanel');
    if(isAdm){
      loginBox.style.display='none'; panel.style.display='block';
      document.getElementById('adminUserEmail').textContent = user.email || '';
    }else{
      /* المستخدم مسجل دخول كطالب عادي (مش أدمن) — منسيبه في التطبيق، بس ملوش صلاحية يشوف لوحة التحكم */
      if(user){
        document.getElementById('adminLoginError').textContent = 'إنت داخل بحساب ('+(user.email||'بدون إيميل')+') وهو مش أدمن. لو ده إيميلك: ضيفه في ADMIN_EMAILS و firestore.rules، أو اعمل وثيقة admins/'+user.uid+' من Firebase Console.';
      }
      loginBox.style.display='block'; panel.style.display='none';
    }
    adminLoginAttempted = false;
  });
}

/* ========================= أدوات مساعدة عامة ========================= */
async function uploadImage(file, folder){
  if(!file) return '';
  if(typeof CLOUDINARY_CLOUD_NAME === 'undefined' || CLOUDINARY_CLOUD_NAME.includes('ضع_')){
    showToast('لازم تحط بيانات Cloudinary الأول في firebase-config.js'); return '';
  }
  showToast('جاري رفع الصورة...');
  try{
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', folder);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method:'POST', body: fd });
    const data = await res.json();
    if(!data.secure_url) throw new Error('no url in response');
    return data.secure_url;
  }catch(err){
    showToast('حصل خطأ في رفع الصورة، جرّب تاني');
    return '';
  }
}
function avatarGradient(seed){
  const palettes=[['#47a6ff','#1360d2'],['#38bdf8','#0c4a9e'],['#6c8cff','#1b3a9a'],['#22b8e6','#12409a'],['#5aa0f5','#0c2f6b']];
  const idx = Math.abs(hashStr(seed)) % palettes.length;
  return `linear-gradient(135deg, ${palettes[idx][0]}, ${palettes[idx][1]})`;
}
function hashStr(s){let h=0;for(let i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i);h|=0;}return h;}
function el(html){const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstChild;}
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm=setTimeout(()=>t.classList.remove('show'),2200);
}
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* تبسيط النص العربي للبحث: يشيل التشكيل ويوحّد الألف والتاء المربوطة والياء */
function normAr(s){
  return String(s==null?'':s).toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').trim();
}

/* ========================= حماية الصور =========================
   لو صورة فشلت: نجرّب الأصل من غير تحويلات Cloudinary، وبعدين إعادة محاولة، وآخر حاجة صورة الكلية — عمر مكان الصورة ما يفضل فاضي. */
document.addEventListener('error', e=>{
  const im = e.target; if(!im || im.tagName !== 'IMG') return;
  const step = +(im.dataset.fb || 0);
  if(step >= 3) return;
  im.dataset.fb = step + 1;
  const cur = im.getAttribute('src') || '';
  if(step === 0){
    const orig = cur.replace(/\/upload\/(?:[a-z]{1,4}_[^\/]*\/)+/, '/upload/');
    if(orig !== cur){ im.src = orig; return; }
  }
  if(step <= 1){ setTimeout(()=>{ im.src = cur + (cur.indexOf('?')>-1 ? '&' : '?') + 'r=' + Date.now(); }, 900); return; }
  im.src = 'images/building.jpg';
}, true);
