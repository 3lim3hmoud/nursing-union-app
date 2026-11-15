/* =========================================================================
   إشعارات الموبايل (Web Push): الطالب بيشترك من زرار "تفعيل الإشعارات"، والأدمن يبعت من لوحة التحكم
   بتشتغل بس لو PUSH_PUBLIC_KEY و PUSH_API_URL متظبطين في firebase-config.js — غير كده كل حاجة بتفضل زي ما هي.
   ========================================================================= */
function PUSH_READY(){
  return typeof PUSH_PUBLIC_KEY === 'string' && !!PUSH_PUBLIC_KEY && typeof PUSH_API_URL === 'string' && !!PUSH_API_URL;
}
function pushSupported(){ return notifSupported() && ('PushManager' in window); }
function pushKeyBytes(b64){
  const s = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(s), out = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function pushHash(t){ let h = 2166136261; for(let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }

/* اشتراك الجهاز ده + حفظه في Firestore (مرة، وبعدها بس لو المستوى اتغيّر) */
async function pushSync(){
  if(!PUSH_READY() || !pushSupported() || !fbReady || !auth || !auth.currentUser || !notifEnabled()) return;
  try{
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:pushKeyBytes(PUSH_PUBLIC_KEY) });
    const j = sub.toJSON(), k = j.keys || {};
    if(!j.endpoint || !k.p256dh || !k.auth) return;
    const uid = auth.currentUser.uid, level = String((STUDENT && STUDENT.level) || '').slice(0, 40), id = uid + '_' + pushHash(j.endpoint), sig = id + '|' + level;
    if(localStorage.getItem('nuPushSig') === sig) return;
    await db.collection('pushSubs').doc(id).set({ uid, level, endpoint:j.endpoint, p256dh:k.p256dh, auth:k.auth, createdAt:Date.now() });
    localStorage.setItem('nuPushSig', sig); localStorage.setItem('nuPushId', id);
  }catch(e){
    if(e && e.name === 'InvalidStateError'){            /* اشتراك قديم بمفتاح تاني: نمسحه وهيتعمل من جديد المرة الجاية */
      try{ const s = await (await navigator.serviceWorker.ready).pushManager.getSubscription(); if(s) await s.unsubscribe(); localStorage.removeItem('nuPushSig'); }catch(_){}
    }
    console.warn('push sync:', e && e.message);
  }
}
async function pushUnsubscribe(){
  try{
    const id = localStorage.getItem('nuPushId');
    if(id && fbReady && auth && auth.currentUser) await db.collection('pushSubs').doc(id).delete();
    localStorage.removeItem('nuPushSig'); localStorage.removeItem('nuPushId');
    if(pushSupported()){ const s = await (await navigator.serviceWorker.ready).pushManager.getSubscription(); if(s) await s.unsubscribe(); }
  }catch(e){ console.warn('push unsubscribe:', e && e.message); }
}
/* زرار تفعيل/إيقاف الإشعارات الحالي بقى بيشترك/يلغي الاشتراك كمان */
const _toggleNotifOrig = toggleNotifications;
toggleNotifications = async function(){ await _toggleNotifOrig(); if(notifEnabled()) pushSync(); else pushUnsubscribe(); };
const _pushDeferred = initDeferredListeners;
initDeferredListeners = function(){ _pushDeferred(); pushSync(); };
let _pushLevel = null;
const _pushRenderProfile = renderProfile;
renderProfile = function(){ _pushRenderProfile(); if(STUDENT && STUDENT.uid && STUDENT.level !== _pushLevel){ _pushLevel = STUDENT.level; pushSync(); } };

/* ---------- الأدمن: إرسال إشعار ---------- */
async function adminSendPush(p){
  if(!PUSH_READY()){ showToast('إشعارات الموبايل لسه مش متفعّلة — راجع الدليل في README'); return null; }
  try{
    const token = await auth.currentUser.getIdToken();
    const r = await fetch(PUSH_API_URL, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token }, body:JSON.stringify(p) });
    const d = await r.json().catch(()=>({}));
    if(!r.ok){ showToast(r.status === 403 ? 'الإشعارات للأدمن بس' : 'مقدرتش أبعت الإشعار (' + (d.error || r.status) + ')'); return null; }
    showToast('🔔 اتبعت الإشعار لـ ' + d.sent + ' موبايل' + (d.failed ? ' (فشل ' + d.failed + ')' : ''));
    return d;
  }catch(e){ showToast('مقدرتش أوصل لسيرفر الإشعارات — اتأكد من PUSH_API_URL'); return null; }
}
function adminPushAbout(kind, id){
  const it = (kind === 'news' ? STATE.news : STATE.activities).find(x=>x.id === id); if(!it) return;
  const title = kind === 'news' ? (it.breaking ? '🔴 عاجل: ' : '📰 خبر جديد: ') + (it.title || '') : '🎉 فعالية جديدة: ' + (it.title || '');
  const body = kind === 'news' ? String(it.desc || '').replace(/\s+/g, ' ').slice(0, 100) : [it.date, it.place].filter(Boolean).join(' · ');
  const url = kind === 'news' ? './#news-' + id : './#activities';
  if(!confirm('تبعت إشعار لكل الطلاب؟\n\n' + title)) return;
  adminSendPush({ title, body, url, level:'all', tag:'nu-' + (kind === 'news' ? 'news' : 'activities') });
}
