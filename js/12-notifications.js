/* =========================================================================
   الإشعارات
   - الطالب يفعّلها من القايمة الجانبية (🔔 تفعيل الإشعارات)
   - لو فيه خبر/فعالية جديدة اتنشرت من آخر مرة: التطبيق بيبلّغه (توست لو مفتوح،
     وإشعار نظام لو في الخلفية)
   - ملحوظة: الإشعار وهو التطبيق مقفول تماماً محتاج Firebase Cloud Messaging + سيرفر
     يبعت الرسالة (Cloud Function). الـ Service Worker جاهز لاستقبال push وفتح الصفحة.
   ========================================================================= */
const NOTIF_KEY = 'nu_notif_on', NOTIF_SEEN = 'nu_notif_seen_';
function notifSupported(){ return 'Notification' in window && 'serviceWorker' in navigator; }
function notifLS(k, v){
  try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; }
}
function notifEnabled(){ return notifSupported() && Notification.permission === 'granted' && notifLS(NOTIF_KEY) === '1'; }
function notifRenderToggle(){
  const l = document.getElementById('notifLabel'); if(!l) return;
  l.textContent = notifEnabled() ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات';
}
async function toggleNotifications(){
  if(!notifSupported()){ showToast('جهازك أو متصفحك مش بيدعم الإشعارات'); return; }
  if(notifEnabled()){
    notifLS(NOTIF_KEY, '0'); notifRenderToggle(); showToast('تم إيقاف الإشعارات'); return;
  }
  if(Notification.permission === 'denied'){ showToast('الإشعارات مقفولة من إعدادات المتصفح — فعّلها من هناك'); return; }
  let p; try{ p = await Notification.requestPermission(); }catch(e){ p = 'denied'; }
  if(p !== 'granted'){ showToast('لازم توافق على الإشعارات عشان تتفعل'); return; }
  const now = String(Date.now());
  notifLS(NOTIF_KEY, '1'); notifLS(NOTIF_SEEN+'news', now); notifLS(NOTIF_SEEN+'activities', now);
  notifRenderToggle(); showToast('تم تفعيل الإشعارات 🔔');
}
function notifIsAdmin(){
  return !!IS_ADMIN;
}
/* بتتنادى من مستمعات Firestore كل ما الأخبار أو الفعاليات تتحدث */
function notifCheck(kind, items){
  if(!notifEnabled() || !Array.isArray(items) || !items.length) return;
  const key = NOTIF_SEEN + kind;
  const newest = Math.max(...items.map(x=>x.createdAt||0));
  const seenRaw = notifLS(key);
  if(seenRaw === null){ notifLS(key, String(newest)); return; }       /* أول مرة: متبلّغش عن القديم */
  const seen = Number(seenRaw) || 0;
  const fresh = items.filter(x=>(x.createdAt||0) > seen).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(!fresh.length) return;
  notifLS(key, String(newest));
  if(notifIsAdmin()) return;                                          /* الأدمن هو اللي نشرها */
  const f = fresh[0];
  const title = kind === 'news'
    ? (f.breaking ? '🔴 عاجل: ' : '📰 خبر جديد: ') + (f.title || '')
    : '🎉 فعالية جديدة: ' + (f.title || '');
  const body = fresh.length > 1 ? `و${fresh.length-1} عناصر جديدة تانية` : (kind==='news' ? (f.desc||'').replace(/\s+/g,' ').slice(0,90) : '');
  const url = kind === 'news' ? './#news-' + f.id : './#activities';
  if(document.visibilityState === 'visible'){ showToast(title); return; }
  navigator.serviceWorker.ready.then(reg=>reg.showNotification(title, {
    body, icon:'images/icon-192.png', badge:'images/icon-192.png', dir:'rtl', lang:'ar', tag:'nu-'+kind, data:{url}
  })).catch(()=>{});
}
/* فتح الصفحة المناسبة لما الطالب يدوس على الإشعار */
function notifOpenUrl(url){
  try{
    const h = new URL(url, location.href).hash;
    const m = /^#news-(.+)$/.exec(h);
    if(m){ goPage('news'); openNews(m[1]); }
    else if(h === '#activities'){ goPage('activities'); }
  }catch(e){}
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', e=>{
    if(e.data && e.data.type === 'nu-open') notifOpenUrl(e.data.url);
  });
}
if(location.hash === '#activities') goPage('activities');
notifRenderToggle();
