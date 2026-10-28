/* ========================= تسجيل دخول / حساب الطالب/* ========================= تسجيل دخول / حساب الطالب ========================= */
function switchGate(which){
  document.querySelectorAll('.gate-tab').forEach(t=>t.classList.toggle('active', t.dataset.gt===which));
  document.getElementById('gateLoginForm').style.display = which==='login' ? 'flex' : 'none';
  document.getElementById('gateSignupForm').style.display = which==='signup' ? 'flex' : 'none';
  document.getElementById('gateError').textContent = '';
}
function gateErrorMsg(err){
  const code = (err && err.code) || '';
  if(code.includes('email-already-in-use')) return 'الإيميل ده متسجل قبل كده — جرّب تسجيل الدخول بدل الحساب الجديد.';
  if(code.includes('weak-password')) return 'كلمة السر لازم تكون 6 أحرف على الأقل.';
  if(code.includes('invalid-email')) return 'الإيميل مش صحيح.';
  if(code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) return 'الإيميل أو كلمة السر غلط.';
  return (typeof authErrMsg==='function') ? authErrMsg(err) : 'حصل خطأ، جرّب تاني.';
}
function studentLogin(ev){
  ev.preventDefault();
  document.getElementById('gateError').textContent = '';
  if(!fbReady){ document.getElementById('gateError').textContent = 'التطبيق مش متوصل بقاعدة بيانات لسه — راجع ملف firebase-config.js'; return false; }
  const email = document.getElementById('gateLoginEmail').value.trim();
  const pass = document.getElementById('gateLoginPass').value;
  auth.signInWithEmailAndPassword(email, pass).catch(err=>{
    document.getElementById('gateError').textContent = gateErrorMsg(err);
  });
  return false;
}
async function studentSignup(ev){
  ev.preventDefault();
  document.getElementById('gateError').textContent = '';
  if(!fbReady){ document.getElementById('gateError').textContent = 'التطبيق مش متوصل بقاعدة بيانات لسه — راجع ملف firebase-config.js'; return false; }
  const name = document.getElementById('gateSignupName').value.trim();
  const studentId = document.getElementById('gateSignupId').value.trim();
  const level = document.getElementById('gateSignupLevel').value.trim();
  const email = document.getElementById('gateSignupEmail').value.trim();
  const pass = document.getElementById('gateSignupPass').value;
  if(!studentId){ document.getElementById('gateError').textContent = 'الرقم الجامعي (ID) إجباري.'; return false; }
  try{
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await db.collection('students').doc(cred.user.uid).set({
      name, studentId, level, points:0, events:0, workshops:0, competitions:0, campaigns:0,
      activeLevel:'منخفض', email, createdAt:Date.now()
    });
  }catch(err){
    document.getElementById('gateError').textContent = gateErrorMsg(err);
  }
  return false;
}
function studentLogout(){
  if(fbReady) auth.signOut();
  else { resetStudentToGuest(); renderHome(); renderProfile(); }
  closeMenu();
}
async function loadStudentProfile(user){
  if(!db) return;
  const ref = db.collection('students').doc(user.uid);
  let snap;
  try{ snap = await ref.get(); }catch(e){ return; }
  if(!snap.exists){
    const fallbackName = user.displayName || (user.email||'طالب').split('@')[0];
    const initial = {
      name:fallbackName, studentId:'', level:'غير محدد', points:0, events:0, workshops:0,
      competitions:0, campaigns:0, activeLevel:'منخفض', email:user.email||'', createdAt:Date.now()
    };
    try{ await ref.set(initial); }catch(e){}
    snap = { data:()=>initial };
  }
  const d = snap.data();
  STUDENT.uid = user.uid;
  STUDENT.name = d.name || 'طالب';
  STUDENT.studentId = d.studentId || '';
  STUDENT.level = d.level || 'غير محدد';
  STUDENT.points = d.points||0;
  STUDENT.events = d.events||0;
  STUDENT.workshops = d.workshops||0;
  STUDENT.competitions = d.competitions||0;
  STUDENT.campaigns = d.campaigns||0;
  STUDENT.activeLevel = d.activeLevel || 'منخفض';
  STUDENT.photoURL = d.photoURL || '';
  STUDENT.bio = d.bio || '';
  STUDENT.rank = STUDENT.rank && STUDENT.rank!=='—' ? STUDENT.rank : '—';
  STUDENT.avatarInitial = (STUDENT.name.trim()[0]) || '؟';
}

/* ========================= التنقل بين الصفحات ========================= */
let CUR_PAGE = 'home';
function goPage(name, fromPop){
  if(document.body.classList.contains('guest') && name!=='profile') name = 'profile';   /* الزائر مالوش غير صفحة الدخول */
  ensurePageData(name);   /* بيحمّل بيانات الصفحة دي بس لو لسه ما اتحملتش */
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.nav===name));
  document.getElementById('pages').scrollTop=0;
  closeMenu();
  /* كل صفحة ليها خطوة في تاريخ المتصفح، عشان زر الرجوع يرجّع للصفحة اللي قبلها بدل ما يقفل التطبيق */
  if(!fromPop && name !== CUR_PAGE){ try{ history.pushState({nu:1, page:name}, ''); }catch(e){} }
  CUR_PAGE = name;
  if((name==='profile' || name==='ranking') && typeof refreshMyStudent==='function') refreshMyStudent();
}

/* ========================= زر الرجوع ========================= */
/* النوافذ المنبثقة (الأقرب للمستخدم أولاً): الرجوع بيقفل أعلى نافذة مفتوحة قبل ما يغيّر الصفحة */
const BACK_OVERLAYS = [
  ['lightbox','closeLightbox'], ['regListModal','closeRegList'], ['profileEditModal','closeProfileEdit'],
  ['admStuModal','closeStuEditor'], ['stuCardModal','closeStuCard'],
  ['activityModal','closeActivityModal'], ['newsReader','closeNews'], ['sideMenu','closeMenu']
];
const IS_STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
let lastBackAt = 0;
try{
  history.replaceState({nu:1, page:'home', base:true}, '');
  history.pushState({nu:1, page:'home'}, '');   /* خطوة حماية: بتخلّي الرجوع يقفل النافذة المفتوحة بدل ما يطلّع من التطبيق */
}catch(e){}
window.addEventListener('popstate', e=>{
  for(const [id, fn] of BACK_OVERLAYS){
    const box = document.getElementById(id);
    if(box && box.classList.contains('show')){
      window[fn]();
      try{ history.pushState({nu:1, page:CUR_PAGE}, ''); }catch(_){}   /* نرجّع الخطوة اللي رجعنا منها */
      return;
    }
  }
  const st = e.state || {};
  if(st.base){
    /* وصلنا لخطوة الحماية (يعني المستخدم ضغط رجوع من الرئيسية): نخرج فعلاً.
       في وضع التطبيق المثبّت بنطلب ضغطة تانية الأول عشان محدش يخرج بالغلط */
    if(CUR_PAGE !== 'home') goPage('home', true);
    if(IS_STANDALONE && Date.now()-lastBackAt >= 2000){
      lastBackAt = Date.now();
      showToast('اضغط رجوع مرة تانية للخروج');
      try{ history.pushState({nu:1, page:'home'}, ''); }catch(_){}
      return;
    }
    history.back();
    return;
  }
  const target = st.page || 'home';
  if(target !== CUR_PAGE) goPage(target, true);
});
function openMenu(){document.getElementById('sideMenu').classList.add('show');document.getElementById('overlay').classList.add('show');}
function closeMenu(){document.getElementById('sideMenu').classList.remove('show');document.getElementById('overlay').classList.remove('show');}
document.getElementById('openMenuBtn').addEventListener('click', openMenu);

function openArchive(){
  showToast('أرشيف طالب الأسبوع — قريباً هيتم عرض كل الفائزين السابقين هنا');
}
function joinNextEvent(){
  const ne = homeNextEvent();
  if(ne.activityId){ openActivityModal(ne.activityId); }
  else { showToast('تابع صفحة الفعاليات لمعرفة طريقة التسجيل'); goPage('activities'); }
}

