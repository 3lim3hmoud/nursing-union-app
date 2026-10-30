/* اختبارات تلقائية للتطبيق (بتشتغل في CI): بتحمّل كل ملفات js بنفس ترتيب index.html زي المتصفح بالظبط
   (نفس النطاق العام للـ const/let) وبتتأكد إن مفيش حاجة بتنكسر.  تشغيل محلي:  npm i && npm test */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { JSDOM, ResourceLoader } = require('jsdom');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
const SCRIPTS = [...html.matchAll(/<script[^>]*\ssrc="((?:js\/|firebase-config)[^"]*)"/g)].map(m=>m[1]).filter(f=>!f.includes('vendor'));
const results = []; const ok = (n, pass, why) => { results.push({ n, pass, why }); };
const sleep = ms => new Promise(r=>setTimeout(r, ms));
/* أخطاء async غير ملتقَطة جوه التطبيق (زي ReferenceError في callback) بتتسجّل بدل ما توقّف الاختبارات */
const PROC_ERRORS = [];
process.on('unhandledRejection', e=>PROC_ERRORS.push(String(e && e.message || e)));
process.on('uncaughtException', e=>PROC_ERRORS.push(String(e && e.message || e)));

/* ---------- بيئة المتصفح الوهمية ---------- */
function makeWindow(withFirebase, ua){
  const dom = new JSDOM(html.replace(/<script[^>]*\ssrc=[^>]*><\/script>/g, ''), Object.assign({ runScripts:'outside-only', url:'https://example.github.io/nursing-union-app/' }, ua ? { resources:new ResourceLoader({ userAgent:ua }) } : {}));   /* jsdom بياخد الـ User-Agent من ResourceLoader */
  const w = dom.window, errors = [];
  w.addEventListener('error', e=>errors.push(String(e.message||e)));
  w.addEventListener('unhandledrejection', e=>errors.push('unhandled: '+String(e.reason&&e.reason.message||e.reason)));
  w.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){} });
  w.IntersectionObserver = class{ observe(){} unobserve(){} disconnect(){} };
  w.requestAnimationFrame = cb => setTimeout(cb, 0); w.TextEncoder = TextEncoder; w.confirm = () => true;
  const authCbs = [];
  if(withFirebase){
    const chain = (name, limit) => ({
      doc:id=>chain(name+'/'+id, 1), collection:n=>chain(n), orderBy:()=>chain(name, limit), limit:k=>chain(name, k), where:()=>chain(name, limit),
      onSnapshot:()=>{ w.__listeners.push({ name, limit: limit||1 }); return ()=>{}; },
      get:async()=>({exists:false,docs:[],data:()=>({})}), set:async()=>{}, update:async()=>{}, delete:async()=>{} });
    w.__listeners = []; w.__persist = 0;
    w.firebase = { initializeApp(){}, auth:()=>({ currentUser:{uid:'u1',email:'a@b.c'}, onAuthStateChanged:cb=>{ authCbs.push(cb); setTimeout(()=>cb({uid:'u1',email:'a@b.c',emailVerified:true,getIdTokenResult:async()=>({claims:{}})}), 5); return ()=>{}; }, getRedirectResult:async()=>({}), signOut:async()=>{}, sendPasswordResetEmail:async e=>{ w.__reset = e; } }),
      firestore:()=>Object.assign(chain(''), { batch:()=>({set(){},update(){},delete(){},commit:async()=>{}}), enablePersistence:async()=>{ w.__persist++; } }) };
    w.firebase.firestore.FieldValue = { delete:()=>null, increment:n=>n, arrayUnion:x=>x, arrayRemove:x=>x };
    w.firebase.auth.GoogleAuthProvider = function(){ this.setCustomParameters = ()=>{}; };
  }
  const ctx = dom.getInternalVMContext();
  const run = (code, name) => new vm.Script(code, { filename:name||'inline' }).runInContext(ctx);
  return { dom, w, errors, run, loadFile:f=>run(read(f), f) };
}

/* ---------- 1) فحوصات ثابتة ---------- */
(function staticChecks(){
  const missing = SCRIPTS.filter(f=>!fs.existsSync(path.join(ROOT, f)));
  ok('كل سكربت في index.html موجود كملف', !missing.length, missing.join(', '));
  const sw = read('sw.js'), m = sw.match(/const ASSETS = \[([\s\S]*?)\];/), assets = m ? [...m[1].matchAll(/'\.\/([^']*)'/g)].map(x=>x[1]) : [];
  const notInSw = SCRIPTS.filter(f=>!assets.includes(f));
  ok('كل سكربت متسجّل في ASSETS بتاع الـ Service Worker (وإلا مش هيشتغل أوفلاين)', !notInSw.length, notInSw.join(', '));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]), dups = [...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
  ok('مفيش IDs مكررة في index.html', !dups.length, dups.join(', '));
  /* دوال معرّفة مرتين في ملفات مختلفة = واحدة بتلغي التانية بصمت */
  const defs = {}, dupFn = [];
  SCRIPTS.forEach(f=>{ for(const mm of read(f).matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)){ if(defs[mm[1]] && defs[mm[1]]!==f) dupFn.push(mm[1]+' ('+defs[mm[1]]+' / '+f+')'); defs[mm[1]] = f; } });
  ok('مفيش دالة معرّفة في ملفين', !dupFn.length, dupFn.join(', '));
  /* سباق التحميل: كود على مستوى الملف بينادي دالة معرّفة في ملف بيتحمّل بعده */
  const idx = {}; SCRIPTS.forEach((f,i)=>idx[f]=i); const hazards = [];
  SCRIPTS.forEach(f=>{
    let depth = 0;
    read(f).split('\n').forEach((line,i)=>{
      if(depth===0 && !/^\s*(function|async function|\/\/|\/\*|\*)/.test(line)){
        for(const c of line.matchAll(/\b([A-Za-z_$][\w$]*)\(/g)){ const n = c[1]; if(defs[n] && idx[defs[n]] > idx[f]) hazards.push(f+':'+(i+1)+' → '+n); }
      }
      depth += (line.match(/{/g)||[]).length - (line.match(/}/g)||[]).length;
    });
  });
  ok('مفيش كود بيتنفّذ وقت التحميل وبينادي دالة لسه متحمّلتش', !hazards.length, hazards.join(' | '));
  /* قواعد التسجيل لازم تتطابق مع اللي الكود بيكتبه، وتمنع الطالب يكتب attended:true لنفسه */
  const rules = read('firestore.rules'), act = read('js/07-activities.js');
  const regBlock = (rules.match(/match \/registrations\/\{uid\} \{[\s\S]*?\n      \}/)||[''])[0];
  const createRule = (regBlock.match(/allow create:[\s\S]*?;\n/)||[''])[0], delRule = (regBlock.match(/allow delete:[\s\S]*?;\n/)||[''])[0];
  const ruleKeys = ((createRule.match(/hasOnly\(\[([^\]]*)\]\)/)||[,''])[1].match(/'([^']+)'/g)||[]).map(x=>x.replace(/'/g,''));
  const clientKeys = ((act.match(/batch\.set\(regRef,\s*\{([^}]*)\}/)||[,''])[1].match(/(\w+)\s*:/g)||[]).map(x=>x.replace(/\s*:/,''));
  ok('قاعدة التسجيل: بتمنع الطالب يكتب attended:true لنفسه', /request\.resource\.data\.attended == false/.test(createRule), 'مفيش شرط attended == false');
  ok('قاعدة التسجيل: حقول الكود كلها مسموحة في القاعدة (وإلا التسجيل هيتمنع)', clientKeys.length>0 && clientKeys.every(k=>ruleKeys.includes(k)), 'الكود: '+clientKeys+' | القاعدة: '+ruleKeys);
  ok('الطالب مش بيقدر يلغي تسجيله بعد الحضور', /attended', false\) == false/.test(delRule), 'مفيش شرط على الحذف');

})();

/* ---------- 2) تحميل كل الملفات + رسم الشاشات الأساسية ببيانات تجريبية ---------- */
async function renderSmoke(){
  const E = makeWindow(false);
  try{ SCRIPTS.forEach(f=>E.loadFile(f)); ok('كل الملفات بتتحمّل من غير أخطاء', true); }
  catch(e){ ok('كل الملفات بتتحمّل من غير أخطاء', false, e.message); return; }
  const out = E.run(`(function(){
    const R = {}; const T = ms => ({toDate:()=>new Date(ms), toMillis:()=>ms});
    STATE.activities = [
      {id:'a1',title:'مؤتمر',cat:'scientific',place:'قاعة',date:'غدا',startAt:T(Date.now()+864e5),requiresRegistration:true,capacity:10,registeredCount:9,photoURL:'https://res.cloudinary.com/x/image/upload/a.jpg',images:['https://res.cloudinary.com/x/image/upload/b.jpg']},
      {id:'a2',title:'قديمة',cat:'sports',place:'ملعب',date:'قبل',startAt:T(Date.now()-9*864e5),requiresRegistration:true,registeredCount:3}];
    STATE.news = [{id:'n1',title:'خبر',desc:'x',createdAt:Date.now()-20*864e5,likeUids:[]}];
    STATE.polls = [{id:'p1',question:'سؤال؟',options:['أ','ب'],endsAt:T(Date.now()+36e5)}];
    STATE.campaigns = [{id:'c1',title:'حملة',desc:'و',date:'د',place:'م',cat:'ص',status:'current',color1:'#111',color2:'#222',photoURL:'https://res.cloudinary.com/x/image/upload/p.jpg'}];
    STATE.ldAct = STATE.ldNews = true;
    const step = (n,f) => { try{ f(); R[n] = 'ok'; }catch(e){ R[n] = 'ERR '+e.message; } };
    step('renderHome', renderHome); step('renderActivities', renderActivities);
    step('renderCamps', ()=>{ campFilter='current'; renderCamps(); }); step('openActivityModal', ()=>openActivityModal('a1'));
    step('renderAdminDash', renderAdminDash); step('renderAdminActivities', renderAdminActivities); step('renderAdminCampaigns', renderAdminCampaigns);
    step('renderRanking', renderRanking); step('renderProfile', renderProfile);
    IS_ADMIN = true; renderAllAdmin();   /* الأدمن اتعرّف بعد وصول البيانات */
    R.guestGuard = document.body.classList.contains('guest') ? (goPage('news'), document.querySelector('.page.active').id) : 'not-guest';
    return R; })()`);
  await sleep(60);
  const rows = id => E.run("document.querySelectorAll('#" + id + " .admin-item-row').length");
  ok('الأدمن اللي اتعرّف متأخر: قايمة الفعاليات بتتملي', rows('admin-actList')>0, 'rows='+rows('admin-actList'));
  ok('الأدمن اللي اتعرّف متأخر: قايمة الأخبار بتتملي', rows('admin-newsList')>0, 'rows='+rows('admin-newsList'));
  ok('الأدمن اللي اتعرّف متأخر: قايمة الحملات بتتملي', rows('admin-campList')>0, 'rows='+rows('admin-campList'));
  Object.keys(out).forEach(k=>{ if(k==='guestGuard') ok('الزائر (من غير دخول) بيتحوّل لصفحة الدخول', out[k]==='page-profile', out[k]); else ok('رسم: '+k, out[k]==='ok', out[k]); });
  await sleep(50);
  ok('مفيش أخطاء وقت التشغيل أثناء الرسم', !E.errors.filter(e=>!/Firebase init|Not implemented/.test(e)).length, E.errors.join(' | '));
}

/* ---------- 3) سباق التحميل: نت بطيء + Firebase بيرد بدري ---------- */
async function raceTest(){
  const E = makeWindow(true);
  try{
    for(const f of SCRIPTS){ E.loadFile(f); if(f.includes('02-polls')) await sleep(60); }   /* باقي الملفات بتوصل متأخر */
    await sleep(300);
  }catch(e){ E.errors.push('LOAD '+e.message); }
  const bad = E.errors.concat(PROC_ERRORS.splice(0)).filter(e=>!/Firebase init|Not implemented/.test(e));
  ok('نت بطيء: مفيش ReferenceError لما Firebase يرد قبل باقي الملفات', !bad.length, [...new Set(bad)].join(' | '));
}


/* ---------- 4) ميزانية الأداء: كام وثيقة بتتقرا في الفتحة، وإيه اللي بيتحمّل بس لما الصفحة تتفتح ---------- */
async function budgetTest(){
  const E = makeWindow(true);
  try{ for(const f of SCRIPTS) E.loadFile(f); await sleep(1700); }catch(e){ E.errors.push('LOAD '+e.message); }
  const L = () => E.w.__listeners, docs = list => list.filter(x=>x.limit>1).reduce((a,x)=>a+x.limit,0);
  const names = () => L().map(x=>x.name);
  const lazy = ['members','committees','magazines','leaderboard'];
  const boot = docs(L());
  ok('فتحة الطالب: أقصى وثائق ممكن تتقرا ≤ 450 (كان 1200 + 1400 بعد ثواني)', boot <= 450, 'الحالي: '+boot);
  ok('الأعضاء/اللجان/المجلات/الترتيب مش بتتحمّل في أول فتحة', !lazy.some(n=>names().includes(n)), lazy.filter(n=>names().includes(n)).join(', '));
  ok('الكاش الدائم على الجهاز متفعّل', E.w.__persist === 1, 'enablePersistence اتنادت '+E.w.__persist+' مرة');
  E.run("goPage('ranking')"); await sleep(30);
  const lb = L().filter(x=>x.name==='leaderboard');
  ok('صفحة الترتيب بتحمّل أعلى 100 بس (مرة واحدة)', lb.length===1 && lb[0].limit<=100, JSON.stringify(lb));
  E.run("goPage('ranking'); goPage('profile')"); await sleep(30);
  ok('فتح الصفحة تاني مش بيكرر المستمع', L().filter(x=>x.name==='leaderboard').length===1);
  E.run("goPage('leadership')"); await sleep(30);
  ok('صفحة اللجان بتحمّل اللجان والأعضاء', names().includes('committees') && names().includes('members'));
  E.run("goPage('magazines')"); await sleep(30);
  ok('صفحة المجلات بتحمّل المجلات', names().includes('magazines'));
  const bad = E.errors.concat(PROC_ERRORS.splice(0)).filter(e=>!/Firebase init|Not implemented/.test(e));
  ok('مفيش أخطاء أثناء فتح الصفحات', !bad.length, bad.join(' | '));
}

/* ---------- 5) تجهيزات الإطلاق: نسيت كلمة السر، المتصفح المدمج، الخصوصية ---------- */
const FB_UA = 'Mozilla/5.0 (Linux; Android 12; SM-G991B Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/420.0.0.0;]';
async function launchTest(){
  const E = makeWindow(true);
  try{ for(const f of SCRIPTS) E.loadFile(f); await sleep(150); }catch(e){ E.errors.push('LOAD '+e.message); }
  const $ = (c)=>E.run(c);
  $("document.getElementById('gateLoginEmail').value='  a@b.com '"); await $("studentForgotPassword()");
  ok('نسيت كلمة السر: بيبعت لينك للإيميل المكتوب', E.w.__reset === 'a@b.com', 'اتبعت: '+E.w.__reset);
  E.w.__reset = null; $("document.getElementById('gateLoginEmail').value=''"); await $("studentForgotPassword()");
  ok('نسيت كلمة السر: من غير إيميل بيطلب كتابته ومبيبعتش', E.w.__reset === null && /اكتب إيميلك/.test($("document.getElementById('gateError').textContent")));
  const names = $(`[${JSON.stringify(FB_UA)}, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/430.0]',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'].map(u=>inAppBrowserName(u))`);
  ok('كشف المتصفح المدمج: فيسبوك أندرويد + فيسبوك آيفون + WebView آيفون = نعم', !!names[0] && !!names[1] && names[4] === 'iOS-WebView', JSON.stringify(names));
  ok('كشف المتصفح المدمج: Chrome أندرويد و Safari آيفون = لأ', names[2] === '' && names[3] === '', JSON.stringify(names));
  const chrome = makeWindow(false, 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
  SCRIPTS.forEach(f=>chrome.loadFile(f));
  ok('متصفح عادي: مفيش بانر تحذير', chrome.run("!document.getElementById('inAppBanner')"));
  const fb = makeWindow(false, FB_UA); SCRIPTS.forEach(f=>fb.loadFile(f));
  ok('فيسبوك: بانر "افتح في Chrome/Safari" بيظهر في بوابة الدخول', fb.run("!!document.querySelector('#profileLoggedOut .gate-card #inAppBanner')"));
  ok('فيسبوك على أندرويد: زرار فتح Chrome بيظهر برابط intent', fb.run("(function(){const a=document.getElementById('inAppChrome');return a.style.display!=='none' && a.href.startsWith('intent://')})()"));
  $("openPrivacy()");
  ok('سياسة الخصوصية: بتفتح وفيها أقسامها', $("document.getElementById('privacyModal').classList.contains('show') && document.querySelectorAll('#privacyModal h4').length>=6"));
  ok('التسجيل: خانة الموافقة على الخصوصية إجبارية', $("document.getElementById('gateConsent').required === true"));
  $("['gateSignupName','gateSignupId','gateSignupLevel','gateSignupEmail','gateSignupPass'].forEach(i=>document.getElementById(i).value='x1'); document.getElementById('gateConsent').checked=false");
  await $("studentSignup({preventDefault(){}})");
  ok('التسجيل من غير موافقة بيتمنع برسالة واضحة', /سياسة الخصوصية/.test($("document.getElementById('gateError').textContent")));
  const bad = E.errors.concat(fb.errors, chrome.errors, PROC_ERRORS.splice(0)).filter(e=>!/Firebase init|Not implemented/.test(e));
  ok('مفيش أخطاء وقت التشغيل في تجهيزات الإطلاق', !bad.length, bad.join(' | '));
}

setTimeout(()=>{ console.log('  ✗ الاختبارات اتأخرت أكتر من دقيقتين (اتوقفت)'); process.exit(1); }, 120000);   /* أمان: ما يعلّقش الـ CI أبداً */
(async()=>{
  for(const t of [renderSmoke, raceTest, budgetTest, launchTest]){
    try{ await t(); }catch(e){ ok('تشغيل '+t.name, false, 'خطأ غير متوقع: '+(e && e.message || e)); }   /* أي انهيار بيتسجّل كفشل بدل ما يوقف التقرير */
  }
  let failed = 0;
  results.forEach(r=>{ console.log((r.pass?'  ✓ ':'  ✗ ')+r.n+(r.pass?'':'\n      → '+r.why)); if(!r.pass) failed++; });
  console.log('\n'+(failed ? failed+' اختبار فشل ❌' : 'كل الاختبارات نجحت ('+results.length+') ✅'));
  process.exit(failed ? 1 : 0);
})();
