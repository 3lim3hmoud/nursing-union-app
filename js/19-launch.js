/* =========================================================================
   تجهيزات الإطلاق: نسيت كلمة السر + تنبيه المتصفح المدمج (فيسبوك/ماسنجر…) + سياسة الخصوصية
   ========================================================================= */
const UNION_CONTACT = '';   /* ضع هنا إيميل أو واتساب الاتحاد: بيظهر في سياسة الخصوصية (سيبه فاضي لو مش عايز) */

/* ---------- نسيت كلمة السر ---------- */
async function studentForgotPassword(){
  const box = document.getElementById('gateError'), inp = document.getElementById('gateLoginEmail');
  box.textContent = '';
  if(!fbReady){ box.textContent = 'التطبيق مش متوصل بقاعدة بيانات لسه — راجع ملف firebase-config.js'; return; }
  const email = inp.value.trim();
  if(!email){ box.textContent = 'اكتب إيميلك في خانة الإيميل الأول، وبعدين اضغط «نسيت كلمة السر؟».'; try{ inp.focus(); }catch(_){} return; }
  try{
    auth.languageCode = 'ar';                       /* الرسالة توصل بالعربي */
    await auth.sendPasswordResetEmail(email);
    showToast('لو الإيميل ده متسجّل هيوصلك لينك لتغيير كلمة السر — راجع الـ Spam كمان 📩');
  }catch(err){ box.textContent = gateErrorMsg(err); }
}
try{ if(fbReady && auth) auth.languageCode = 'ar'; }catch(_){}

/* ---------- المتصفح المدمج: جوجل بترفض تسجيل الدخول منه ---------- */
function inAppBrowserName(ua){
  ua = ua || navigator.userAgent || '';
  const m = /(FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|Snapchat|TikTok|BytedanceWebview|musical_ly|Twitter|MicroMessenger|; wv\))/i.exec(ua);
  if(m) return m[1];
  const ios = /iPhone|iPad|iPod/.test(ua);
  const standalone = (typeof navigator !== 'undefined' && navigator.standalone === true) || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if(ios && !standalone && !/Safari|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return 'iOS-WebView';   /* WKWebView جوه تطبيقات آيفون */
  return '';
}
function showInAppBanner(){
  const host = document.querySelector('#profileLoggedOut .gate-card');
  if(!host || document.getElementById('inAppBanner') || !inAppBrowserName()) return;
  const url = location.href.split('#')[0];
  const b = document.createElement('div'); b.id = 'inAppBanner'; b.className = 'inapp-banner';
  b.innerHTML = '<b>⚠️ أنت فاتح الرابط من جوه تطبيق (فيسبوك / ماسنجر / ...)</b>' +
    '<p>تسجيل الدخول بحساب Google <u>مش هيشتغل</u> هنا. افتح الرابط في <b>Chrome</b> أو <b>Safari</b>، أو سجّل بالإيميل وكلمة السر.</p>' +
    '<div class="inapp-btns"><button type="button" id="inAppCopy">📋 انسخ الرابط</button><a id="inAppChrome" style="display:none">🌐 افتح في Chrome</a></div>';
  host.insertBefore(b, host.firstChild);
  b.querySelector('#inAppCopy').addEventListener('click', ()=>{
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(()=>showToast('اتنسخ الرابط — الصقه في Chrome أو Safari'), ()=>window.prompt('انسخ الرابط:', url));
    else window.prompt('انسخ الرابط:', url);
  });
  if(/Android/i.test(navigator.userAgent||'')){      /* أندرويد: محاولة فتح Chrome مباشرة */
    const a = b.querySelector('#inAppChrome');
    a.href = 'intent://' + location.host + location.pathname + location.search + '#Intent;scheme=https;package=com.android.chrome;end';
    a.style.display = '';
  }
}
showInAppBanner();

/* ---------- سياسة الخصوصية ---------- */
function openPrivacy(){
  const c = document.getElementById('privContact'); if(c && UNION_CONTACT) c.textContent = UNION_CONTACT;
  document.getElementById('privacyModal').classList.add('show');
}
function closePrivacy(){ document.getElementById('privacyModal').classList.remove('show'); }
