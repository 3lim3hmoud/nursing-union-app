/* اختبارات تلقائية للتطبيق (بتشتغل في CI): بتحمّل كل ملفات js بنفس ترتيب index.html زي المتصفح بالظبط
   (نفس النطاق العام للـ const/let) وبتتأكد إن مفيش حاجة بتنكسر.  تشغيل محلي:  npm i && npm test */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { JSDOM } = require('jsdom');
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
function makeWindow(withFirebase){
  const dom = new JSDOM(html.replace(/<script[^>]*\ssrc=[^>]*><\/script>/g, ''), { runScripts:'outside-only', url:'https://example.github.io/nursing-union-app/' });
  const w = dom.window, errors = [];
  w.addEventListener('error', e=>errors.push(String(e.message||e)));
  w.addEventListener('unhandledrejection', e=>errors.push('unhandled: '+String(e.reason&&e.reason.message||e.reason)));
  w.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){} });
  w.IntersectionObserver = class{ observe(){} unobserve(){} disconnect(){} };
  w.requestAnimationFrame = cb => setTimeout(cb, 0); w.TextEncoder = TextEncoder; w.confirm = () => true;
  const authCbs = [];
  if(withFirebase){
    const col = () => ({ doc:col, collection:col, orderBy:col, limit:col, where:col, onSnapshot:()=>()=>{}, get:async()=>({exists:false,docs:[],data:()=>({})}), set:async()=>{}, update:async()=>{}, delete:async()=>{} });
    w.firebase = { initializeApp(){}, auth:()=>({ onAuthStateChanged:cb=>{ authCbs.push(cb); setTimeout(()=>cb({uid:'u1',email:'a@b.c',emailVerified:true,getIdTokenResult:async()=>({claims:{}})}), 5); return ()=>{}; }, getRedirectResult:async()=>({}), signOut:async()=>{} }),
      firestore:()=>Object.assign(col(), { batch:()=>({set(){},update(){},delete(){},commit:async()=>{}}) }) };
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
    R.guestGuard = document.body.classList.contains('guest') ? (goPage('news'), document.querySelector('.page.active').id) : 'not-guest';
    return R; })()`);
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

(async()=>{
  await renderSmoke(); await raceTest();
  let failed = 0;
  results.forEach(r=>{ console.log((r.pass?'  ✓ ':'  ✗ ')+r.n+(r.pass?'':'\n      → '+r.why)); if(!r.pass) failed++; });
  console.log('\n'+(failed ? failed+' اختبار فشل ❌' : 'كل الاختبارات نجحت ('+results.length+') ✅'));
  process.exit(failed ? 1 : 0);
})();
