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
    fbReady = true;
  }
}catch(e){ console.error('Firebase init error:', e); }

/* الحالة الحيّة اللي بتتحدث تلقائي من قاعدة البيانات */
const STATE = {
  nextEvent:{name:'اليوم العلمي 2026', place:'القاعة الرئيسية', image:'images/building.jpg',
    date:new Date(Date.now()+(3*86400+14*3600+27*60)*1000).toISOString()},
  studentOfWeek:{name:'—', initial:'-', level:'—', points:0},
  leadership:{presidentName:'—', presidentPhoto:'', vpName:'—', vpPhoto:''},
  dean:{...DEFAULT_DEAN}, viceDean:{...DEFAULT_VICE},
  activities:[], magazines:[], campaigns:[], committees:[], leaderboard:[], members:[], news:[], polls:[], pollVotes:{}, media:[], myRegs:{}
};

function docToItem(doc){ const d=doc.data(); d.id=doc.id; return d; }

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
  db.collection('activities').orderBy('createdAt','desc').onSnapshot(snap=>{
    STATE.activities = snap.docs.map(docToItem);
    if(typeof notifCheck==='function') notifCheck('activities', STATE.activities);
    renderActivities(); renderHome(); renderAdminActivities(); startCountdown(); adminDashRefresh();
  }, ()=>{});
  db.collection('magazines').orderBy('createdAt','desc').onSnapshot(snap=>{
    STATE.magazines = snap.docs.map(docToItem);
    renderMags(); renderAdminMagazines();
  }, ()=>{});
  db.collection('campaigns').orderBy('createdAt','desc').onSnapshot(snap=>{
    STATE.campaigns = snap.docs.map(docToItem);
    renderCamps(); renderHome(); renderAdminCampaigns();
  }, ()=>{});
  db.collection('committees').orderBy('createdAt','desc').onSnapshot(snap=>{
    STATE.committees = snap.docs.map(docToItem);
    if(['committees','members'].includes(document.querySelector('.lead-tab.active')?.dataset.lt)) switchLead(document.querySelector('.lead-tab.active').dataset.lt);
    renderAdminCommittees();
  }, ()=>{});
  db.collection('leaderboard').orderBy('createdAt','desc').onSnapshot(snap=>{
    STATE.leaderboard = snap.docs.map(docToItem);
    renderRanking(); renderAdminLeaderboard();
  }, ()=>{});
  db.collection('members').orderBy('createdAt','desc').onSnapshot(snap=>{
    STATE.members = snap.docs.map(docToItem);
    if(document.querySelector('.lead-tab.active')?.dataset.lt==='members') switchLead('members');
    renderAdminMembers();
  }, ()=>{});
  db.collection('news').orderBy('createdAt','desc').onSnapshot(snap=>{
    STATE.news = snap.docs.map(docToItem); adminDashRefresh();
    if(typeof notifCheck==='function') notifCheck('news', STATE.news);
    renderNews(); renderAdminNews();
  }, ()=>{});
  db.collection('polls').orderBy('createdAt','desc').onSnapshot(snap=>{
    STATE.pollErr = '';
    STATE.polls = snap.docs.map(docToItem);
    syncPollVotes(); renderPolls(); renderAdminPolls(); adminDashRefresh();
  }, err=>pollLoadError(err));
  db.collection('media').orderBy('createdAt','desc').limit(300).onSnapshot(snap=>{
    STATE.media = snap.docs.map(docToItem);
    renderMediaCarousel(); renderMediaPage(); renderAdminMedia(); adminDashRefresh();
  }, ()=>{});
}

/* ========================= تسجيل دخول الأدمن ========================= */
let adminLoginAttempted = false;
function adminLogin(ev){
  ev.preventDefault();
  if(!fbReady){ showToast('لازم تحط بيانات Firebase الأول في firebase-config.js'); return false; }
  const email = document.getElementById('admLoginEmail').value.trim();
  const pass = document.getElementById('admLoginPass').value;
  document.getElementById('adminLoginError').textContent = '';
  adminLoginAttempted = true;
  auth.signInWithEmailAndPassword(email, pass).catch(err=>{
    adminLoginAttempted = false;
    document.getElementById('adminLoginError').textContent = 'الإيميل أو كلمة السر غلط، أو الحساب ده مش متعمل في Firebase.';
  });
  return false;
}
function adminLoginGoogle(){
  if(!fbReady){ showToast('لازم تحط بيانات Firebase الأول في firebase-config.js'); return; }
  document.getElementById('adminLoginError').textContent = '';
  adminLoginAttempted = true;
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err=>{
    adminLoginAttempted = false;
    document.getElementById('adminLoginError').textContent = 'حصل خطأ في تسجيل الدخول بجوجل، جرّب تاني.';
  });
}
function adminLogout(){ if(fbReady) auth.signOut(); }
const ADMIN_EMAILS = ['alikimo1942@gmail.com'];
if(fbReady){
  auth.onAuthStateChanged(user=>{
    const loginBox = document.getElementById('adminLogin');
    const panel = document.getElementById('adminPanel');
    if(user && ADMIN_EMAILS.includes((user.email||'').toLowerCase())){
      loginBox.style.display='none'; panel.style.display='block';
      document.getElementById('adminUserEmail').textContent = user.email;
    }else{
      /* المستخدم مسجل دخول كطالب عادي (مش أدمن) — منسيبه في التطبيق، بس ملوش صلاحية يشوف لوحة التحكم */
      if(user && adminLoginAttempted){
        document.getElementById('adminLoginError').textContent = 'الحساب ده مش من ضمن حسابات الأدمن المسموح لها.';
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
  const palettes=[['#4d8dff','#1b2c5c'],['#b27cff','#1b2c5c'],['#33c77b','#132147'],['#ff6fa0','#1b2c5c'],['#caa53d','#1b2c5c']];
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
