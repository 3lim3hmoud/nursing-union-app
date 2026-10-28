/* ========================= التهيئة ========================= */
function initApp(){
  renderHome();
  startCountdown();
  renderMediaCarousel();
  mcAutoplay();
  renderActivityTabs(); renderActivities();
  switchLead('dean');
  renderMagTabs(); renderMags();
  renderCampTabs(); renderCamps();
  renderNews();
  renderProfile();
  renderRankTabs(); renderRanking();
  if(!fbReady) initFirestoreListeners();   /* من غير Firebase: بس يظهر تنبيه الإعداد */
  startPollsAuthWatch();
}
function resetStudentToGuest(){ STUDENT = {...GUEST_STUDENT}; }
/* المحتوى (فعاليات، أخبار، حملات...) متاح للمسجّلين بس: الزائر بيشوف صفحة الدخول، والقواعد في Firestore بتمنع القراءة من غير تسجيل */
let LISTENERS_ON = false;
function bootAuthGate(){
  initApp();
  if(fbReady){
    auth.onAuthStateChanged(async user=>{
      if(user){
        document.body.classList.remove('guest');
        await loadStudentProfile(user);
        if(!LISTENERS_ON){ LISTENERS_ON = true; initFirestoreListeners(); }
        let tryAdmin = false; try{ tryAdmin = sessionStorage.getItem('nuAdminTry')==='1'; sessionStorage.removeItem('nuAdminTry'); sessionStorage.removeItem('nuAuthRedirect'); }catch(_){}
        if(tryAdmin) goPage('admin');          /* رجّعه للوحة التحكم بعد دخول الأدمن */
        else if(CUR_PAGE==='profile' && STUDENT.uid && !window.__nuStayProfile) goPage('home');
      }else{
        if(LISTENERS_ON){ location.reload(); return; }   /* خروج: إعادة تحميل نضيفة عشان نفصل كل المستمعات */
        document.body.classList.add('guest');
        resetStudentToGuest();
        goPage('profile');
      }
      renderHome(); renderProfile();
    });
  }
}
bootAuthGate();

window.addEventListener('load', ()=>{
  setTimeout(()=>{ document.getElementById('splash').classList.add('hide'); }, 500);
});

/* شريط "فيه تحديث جديد" — بيظهر لما نسخة جديدة من الـ Service Worker تتفعل والتطبيق مفتوح */
function showUpdateBar(){
  if(document.getElementById('updBar')) return;
  const b = el('<div class="upd-bar" id="updBar"><span>🔄 فيه تحديث جديد للتطبيق</span><button type="button">تحديث</button></div>');
  b.querySelector('button').addEventListener('click', ()=>{ window.__nuReloading = true; location.reload(); });
  document.body.appendChild(b);
}
if('serviceWorker' in navigator){
  const hadController = !!navigator.serviceWorker.controller;   /* أول تثبيت: مفيش شريط */
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(hadController && !window.__nuReloading) showUpdateBar();
  });
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) reg.update().catch(()=>{}); });
    }).catch(()=>{});
  });
}
