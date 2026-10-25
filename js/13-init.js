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
  initFirestoreListeners();
}
function resetStudentToGuest(){ STUDENT = {...GUEST_STUDENT}; }
function bootAuthGate(){
  initApp();
  if(fbReady){
    auth.onAuthStateChanged(async user=>{
      if(user){ await loadStudentProfile(user); }
      else{ resetStudentToGuest(); }
      renderHome(); renderProfile();
    });
  }
}
bootAuthGate();

window.addEventListener('load', ()=>{
  setTimeout(()=>{ document.getElementById('splash').classList.add('hide'); }, 1400);
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
