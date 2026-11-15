/* =========================================================================
   دالة Vercel: بتبعت إشعار (Web Push) لموبايلات الطلاب المشتركين — حتى والتطبيق مقفول.
   - الأدمن بس: بنبعت توكن الدخول بتاعه لـ Firestore نفسه، وقواعد pushSubs بتسمح بالقراءة للأدمن بس.
     (يعني مفيش كود تحقق هنا ممكن يتغلّط فيه، والسيرفر مش محتاج مفتاح خدمة Firebase.)
   - المتغيرات (Vercel → Settings → Environment Variables):
       VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (مثلاً mailto:union@college.edu)
       FIREBASE_PROJECT_ID (اختياري، الافتراضي nursing-union-5ab79)
   ========================================================================= */
const webpush = require('web-push');

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'nursing-union-5ab79';
const FS = 'https://firestore.googleapis.com/v1';
const DB = `${FS}/projects/${PROJECT}/databases/(default)/documents`;

/* نفس normAr بتاعة التطبيق بالظبط، عشان اختيار المستوى يطلع نفس النتيجة */
function normAr(s){
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
}
function levelMatches(subLevel, want){
  const w = String(want || '').trim();
  if(!w || w === 'all') return true;
  return normAr(subLevel).includes(normAr(w));
}
function cors(req, res){
  const o = req.headers && req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if(o) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
}
const str = v => (v && typeof v.stringValue === 'string') ? v.stringValue : '';

async function listSubs(token){
  const subs = []; let pageToken = '';
  for(let guard = 0; guard < 50; guard++){
    const r = await fetch(`${DB}/pushSubs?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`, { headers:{ Authorization:'Bearer ' + token } });
    if(r.status === 401 || r.status === 403) return { denied:true };
    if(!r.ok) throw new Error('firestore ' + r.status);
    const j = await r.json();
    (j.documents || []).forEach(d=>{
      const f = d.fields || {};
      subs.push({ name:d.name, level:str(f.level), endpoint:str(f.endpoint), p256dh:str(f.p256dh), auth:str(f.auth) });
    });
    pageToken = j.nextPageToken || '';
    if(!pageToken) break;
  }
  return { subs };
}

module.exports = async function handler(req, res){
  cors(req, res);
  if(req.method === 'OPTIONS') return res.status(204).end();
  if(req.method !== 'POST') return res.status(405).json({ error:'POST only' });

  const m = /^Bearer (.+)$/.exec((req.headers && req.headers.authorization) || '');
  if(!m) return res.status(401).json({ error:'missing token' });
  const token = m[1];

  if(!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return res.status(500).json({ error:'push not configured (VAPID keys)' });

  let b = req.body; if(typeof b === 'string'){ try{ b = JSON.parse(b); }catch(_){ b = null; } }
  const title = b && typeof b.title === 'string' ? b.title.trim() : '', body = b && typeof b.body === 'string' ? b.body.trim() : '';
  if(!title || title.length > 80 || body.length > 200) return res.status(400).json({ error:'invalid title/body' });
  let url = b && typeof b.url === 'string' ? b.url : './';
  if(!/^\.\/[#?\w\-./=&]*$/.test(url)) url = './';            /* روابط داخل التطبيق بس */
  const level = b && typeof b.level === 'string' ? b.level.slice(0, 40) : 'all';
  const tag = b && typeof b.tag === 'string' && /^[\w-]{1,30}$/.test(b.tag) ? b.tag : 'nu-push';

  let listed;
  try{ listed = await listSubs(token); }catch(e){ return res.status(502).json({ error:'could not read subscriptions' }); }
  if(listed.denied) return res.status(403).json({ error:'admin only' });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const targets = listed.subs.filter(s=>s.endpoint && s.p256dh && s.auth && levelMatches(s.level, level));
  const payload = JSON.stringify({ title, body, url, tag });
  let sent = 0, failed = 0; const dead = [];
  for(let i = 0; i < targets.length; i += 80){
    const chunk = targets.slice(i, i + 80);
    const out = await Promise.allSettled(chunk.map(s=>webpush.sendNotification({ endpoint:s.endpoint, keys:{ p256dh:s.p256dh, auth:s.auth } }, payload, { TTL:86400, urgency:'normal' })));
    out.forEach((o, k)=>{
      if(o.status === 'fulfilled') sent++;
      else{ failed++; const code = o.reason && o.reason.statusCode; if(code === 404 || code === 410) dead.push(chunk[k].name); }
    });
  }
  /* اشتراكات ماتت (الطالب مسح التطبيق/منع الإشعارات): بننضّفها */
  await Promise.allSettled(dead.map(name=>fetch(`${FS}/${name}`, { method:'DELETE', headers:{ Authorization:'Bearer ' + token } })));
  return res.status(200).json({ total:targets.length, sent, failed, removed:dead.length });
};
module.exports.levelMatches = levelMatches;
