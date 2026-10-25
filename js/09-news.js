/* ========================= الأخبار ========================= */
/* ========================= الأخبار ========================= */
const NEWS_CATS = {
  union:{label:'أخبار الاتحاد',icon:'📣'}, events:{label:'فعاليات',icon:'🎉'}, academic:{label:'أكاديمي',icon:'🎓'},
  achievements:{label:'إنجازات',icon:'🏆'}, announce:{label:'إعلانات',icon:'📌'}
};
let NEWS_FILTER = 'all', NEWS_OPEN = null, NEWS_DEEP_DONE = false, NEWS_Q = '';
const NEWS_PAGE = 10; let NEWS_SHOWN = NEWS_PAGE;   /* عدد الأخبار اللي بتظهر في القايمة (بعد الخبر الرئيسي) */
function newsSorted(){
  return [...STATE.news].sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0) || (b.createdAt||0)-(a.createdAt||0));
}
function newsDate(n){
  if(n.date) return n.date;
  return n.createdAt ? new Date(n.createdAt).toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}) : '';
}
function newsTag(n){ const c = NEWS_CATS[n.cat]; return c ? `<span class="nw-tag">${c.icon} ${c.label}</span>` : ''; }
function newsFlags(n){ return (n.breaking && Date.now()-(n.createdAt||0) < 3*86400000 ? '<span class="nw-tag brk">🔴 عاجل</span>' : '') + (n.pinned ? '<span class="nw-tag pin">📌 مثبّت</span>' : ''); }
function newsThumb(n,w,h){ return n.photoURL ? `<img src="${esc(cld(n.photoURL,'c_fill,w_'+w+',h_'+h+',q_auto,f_auto'))}" alt="" loading="lazy">` : '📰'; }
function renderNews(){
  const chips = document.getElementById('newsChips'), feat = document.getElementById('newsFeatured'), wrap = document.getElementById('newsList');
  if(chips && feat && wrap){
    const all = newsSorted();
    const cats = Object.keys(NEWS_CATS).filter(k=>all.some(n=>n.cat===k));
    if(NEWS_FILTER!=='all' && !cats.includes(NEWS_FILTER)) NEWS_FILTER = 'all';
    chips.innerHTML = '';
    if(cats.length){
      [['all','الكل',all.length]].concat(cats.map(k=>[k, NEWS_CATS[k].icon+' '+NEWS_CATS[k].label, all.filter(n=>n.cat===k).length])).forEach(d=>{
        chips.appendChild(el(`<button type="button" class="mchip ${NEWS_FILTER===d[0]?'active':''}" data-f="${d[0]}">${d[1]} <i>${d[2]}</i></button>`));
      });
    }
    let list = NEWS_FILTER==='all' ? all : all.filter(n=>n.cat===NEWS_FILTER);
    if(NEWS_Q) list = list.filter(n=>normAr([n.title,n.desc].join(' ')).includes(NEWS_Q));
    document.getElementById('newsCount').textContent = list.length ? list.length+' خبر' : '';
    feat.innerHTML = ''; wrap.innerHTML = '';
    if(!list.length){ wrap.appendChild(el(NEWS_Q ? '<div class="empty-note">مفيش نتائج للبحث ده 🔍</div>' : '<div class="empty-note">لسه مفيش أخبار</div>')); }
    else {
      const f = list[0];
      const fe = el(`<div class="nw-feat">${f.photoURL ? `<img src="${esc(cld(f.photoURL,'c_fill,w_900,h_560,q_auto,f_auto'))}" alt="" decoding="async">` : '<div class="nw-ph">📰</div>'}<div class="shade"></div><div class="info"><div>${newsFlags(f)}${newsTag(f)}</div><b>${esc(f.title)}</b><small>📅 ${esc(newsDate(f))}${(f.likeUids||[]).length?` · ❤ ${(f.likeUids||[]).length}`:''}</small></div></div>`);
      fe.addEventListener('click', ()=>openNews(f.id));
      feat.appendChild(fe);
      const rest = list.slice(1);
      rest.slice(0, NEWS_SHOWN).forEach(n=>{
        const it = el(`<div class="card nw-item"><div class="nw-th">${newsThumb(n,200,200)}</div><div class="nw-in"><b>${esc(n.title)}</b><p>${esc((n.desc||'').replace(/\s+/g,' '))}</p><div class="nw-meta">${newsFlags(n)}${newsTag(n)}<span>📅 ${esc(newsDate(n))}</span>${(n.likeUids||[]).length?`<span>❤ ${(n.likeUids||[]).length}</span>`:''}</div></div></div>`);
        it.addEventListener('click', ()=>openNews(n.id));
        wrap.appendChild(it);
      });
      const left = rest.length - NEWS_SHOWN;
      if(left > 0){
        const mb = el(`<button type="button" class="more-btn">عرض المزيد (${left})</button>`);
        mb.addEventListener('click', ()=>{ NEWS_SHOWN += NEWS_PAGE; renderNews(); });
        wrap.appendChild(mb);
      }
    }
  }
  renderHomeNews();
  if(NEWS_OPEN){ const cur = STATE.news.find(x=>x.id===NEWS_OPEN); if(cur) fillNewsReader(cur); }
  if(!NEWS_DEEP_DONE && STATE.news.length){
    NEWS_DEEP_DONE = true;
    const m = /^#news-(.+)$/.exec(location.hash || '');
    if(m && STATE.news.some(x=>x.id===m[1])) openNews(m[1]);
  }
}
function renderHomeNews(){
  const sc = document.getElementById('homeNewsScroll'), br = document.getElementById('homeBreaking');
  if(sc){
    sc.innerHTML = '';
    const list = newsSorted().slice(0,6);
    if(!list.length) sc.appendChild(el('<div class="empty-note" style="width:100%;">لسه مفيش أخبار</div>'));
    list.forEach(n=>{
      const c = el(`<div class="nw-card"><div class="im">${newsThumb(n,420,224)}</div><div class="tx"><b>${esc(n.title)}</b><small>${n.pinned?'📌 ':''}${esc(newsDate(n))}</small></div></div>`);
      c.addEventListener('click', ()=>openNews(n.id));
      sc.appendChild(c);
    });
  }
  if(br){
    const b = [...STATE.news].filter(n=>n.breaking && Date.now()-(n.createdAt||0) < 3*86400000).sort((x,y)=>(y.createdAt||0)-(x.createdAt||0))[0];
    br.innerHTML = '';
    if(b){
      const d = el(`<div class="breaking"><span class="bk"><i></i>عاجل</span><b>${esc(b.title)}</b><span>‹</span></div>`);
      d.addEventListener('click', ()=>openNews(b.id));
      br.appendChild(d);
    }
  }
}
document.getElementById('newsChips').addEventListener('click', e=>{
  const b = e.target.closest('.mchip'); if(!b) return;
  NEWS_FILTER = b.dataset.f; NEWS_SHOWN = NEWS_PAGE; renderNews();
});
function fillNewsReader(n){
  const likes = n.likeUids || [], liked = !!(STUDENT.uid && likes.includes(STUDENT.uid));
  const gal = (n.images||[]).length ? `<div class="nr-gal">${n.images.map((u,i)=>`<img src="${esc(cld(u,'c_fill,w_300,h_220,q_auto,f_auto'))}" alt="" data-i="${i}" loading="lazy">`).join('')}</div>` : '';
  document.getElementById('nrBody').innerHTML = `
    ${n.photoURL ? `<img class="nr-hero" src="${esc(cld(n.photoURL,'c_fill,w_1000,h_690,q_auto,f_auto'))}" alt="">` : '<div class="nr-hero-ph">📰</div>'}
    <div class="nr-body">
      <div>${newsFlags(n)}${newsTag(n)}</div>
      <h1>${esc(n.title)}</h1>
      <div class="nr-info"><span>📅 ${esc(newsDate(n))}</span><span id="nrLikeCount">${likes.length ? '❤ '+likes.length : ''}</span></div>
      <div class="nr-text">${esc(n.desc||'')}</div>
      ${gal}
      <div class="nr-actions">
        <button type="button" class="nr-btn ${liked?'on':''}" id="nrLike" onclick="toggleLike()">${liked?'❤ أعجبني':'🤍 أعجبني'}${likes.length?' ('+likes.length+')':''}</button>
        <button type="button" class="nr-btn" onclick="shareNews()">⤴ مشاركة</button>
      </div>
    </div>`;
  document.querySelectorAll('#nrBody .nr-gal img').forEach(im=>im.addEventListener('click', ()=>
    openLightboxList((n.images||[]).map(u=>({type:'image',url:u,title:n.title,album:''})), Number(im.dataset.i))));
}
function openNews(id){
  const n = STATE.news.find(x=>x.id===id); if(!n) return;
  NEWS_OPEN = id;
  fillNewsReader(n);
  const r = document.getElementById('newsReader'); r.classList.add('show');
  document.getElementById('nrBody').scrollTop = 0;
  try{ history.replaceState(history.state,'',location.pathname+location.search+'#news-'+id); }catch(e){}
}
function closeNews(){
  NEWS_OPEN = null;
  document.getElementById('newsReader').classList.remove('show');
  try{ history.replaceState(history.state,'',location.pathname+location.search); }catch(e){}
}
async function toggleLike(){
  const n = STATE.news.find(x=>x.id===NEWS_OPEN); if(!n) return;
  if(!STUDENT.uid){ showToast('سجّل دخولك الأول علشان تتفاعل'); closeNews(); goPage('profile'); return; }
  if(!fbReady) return;
  const likes = n.likeUids || [], liked = likes.includes(STUDENT.uid);
  const FV = firebase.firestore.FieldValue;
  n.likeUids = liked ? likes.filter(u=>u!==STUDENT.uid) : [...likes, STUDENT.uid];   /* تحديث فوري */
  fillNewsReader(n);
  try{
    await db.collection('news').doc(n.id).update({ likeUids: liked ? FV.arrayRemove(STUDENT.uid) : FV.arrayUnion(STUDENT.uid) });
  }catch(e){
    n.likeUids = likes; fillNewsReader(n); showToast('مقدرتش أسجل تفاعلك، جرّب تاني');
  }
}
function shareNews(){
  const n = STATE.news.find(x=>x.id===NEWS_OPEN); if(!n) return;
  const url = location.href.split('#')[0] + '#news-' + n.id;
  const data = { title:n.title, text:n.title, url };
  if(navigator.share){ navigator.share(data).catch(()=>{}); }
  else if(navigator.clipboard){ navigator.clipboard.writeText(url).then(()=>showToast('تم نسخ رابط الخبر ✔')).catch(()=>showToast(url)); }
  else showToast(url);
}

/* ----- لوحة الأدمن: الأخبار ----- */
function resetNewsForm(){
  const f = document.getElementById('newsForm'); if(!f) return;
  f.reset();
  document.getElementById('af-newsId').value = '';
  document.getElementById('af-newsSubmitBtn').textContent = 'نشر الخبر';
  document.getElementById('af-newsCancel').style.display = 'none';
}
function editNews(id){
  const n = STATE.news.find(x=>x.id===id); if(!n) return;
  resetNewsForm();
  document.getElementById('af-newsId').value = id;
  document.getElementById('af-newsTitle').value = n.title;
  document.getElementById('af-newsDesc').value = n.desc || '';
  document.getElementById('af-newsCat').value = n.cat || 'union';
  document.getElementById('af-newsPinned').checked = !!n.pinned;
  document.getElementById('af-newsBreaking').checked = !!n.breaking;
  document.getElementById('af-newsSubmitBtn').textContent = 'حفظ التعديل';
  document.getElementById('af-newsCancel').style.display = '';
  openAdminSection('news');
}
function deleteNews(id){
  if(!confirm('حذف الخبر ده؟')) return;
  db.collection('news').doc(id).delete().then(()=>showToast('تم الحذف ✔'));
}
function toggleNewsFlag(id, flag){
  const n = STATE.news.find(x=>x.id===id); if(!n || !requireFB()) return;
  const upd = { [flag]: !n[flag] };
  if(flag==='breaking' && !n.breaking) upd.createdAt = Date.now();   /* العاجل يبدأ عدّاد الـ 3 أيام من لحظة التفعيل */
  db.collection('news').doc(id).update(upd).then(()=>showToast('تم التحديث ✔'));
}
async function saveNews(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const btn = document.getElementById('af-newsSubmitBtn');
  const id = document.getElementById('af-newsId').value;
  const title = document.getElementById('af-newsTitle').value.trim();
  const desc = document.getElementById('af-newsDesc').value.trim();
  if(!title || !desc){ showToast('اكتب العنوان ونص الخبر'); return false; }
  btn.disabled = true; btn.textContent = 'جاري الحفظ...';
  try{
    const DEL = firebase.firestore.FieldValue.delete();
    const old = id ? (STATE.news.find(x=>x.id===id) || {}) : {};
    const item = {
      title, desc,
      cat: document.getElementById('af-newsCat').value,
      pinned: document.getElementById('af-newsPinned').checked,
      breaking: document.getElementById('af-newsBreaking').checked
    };
    if(!id) item.date = new Date().toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'});
    if(item.breaking && !old.breaking && id) item.createdAt = Date.now();
    const cover = document.getElementById('af-newsPhoto').files[0];
    if(cover){ const u = await uploadImage(await resizeImage(cover,1400),'news'); if(u) item.photoURL = u; }
    else if(id && document.getElementById('af-newsRmCover').checked) item.photoURL = DEL;
    const gal = [...document.getElementById('af-newsGallery').files];
    const keep = (id && !document.getElementById('af-newsRmImgs').checked) ? (old.images || []) : [];
    if(gal.length){
      const urls = [];
      for(let i=0;i<gal.length;i++){
        btn.textContent = `رفع الصور ${i+1} من ${gal.length}...`;
        const u = await uploadImage(await resizeImage(gal[i],1400),'news'); if(u) urls.push(u);
      }
      item.images = [...keep, ...urls];
    } else if(id && document.getElementById('af-newsRmImgs').checked){ item.images = DEL; }
    if(id) await db.collection('news').doc(id).update(item);
    else await db.collection('news').add({ ...item, likeUids:[], createdAt:Date.now() });
    showToast(id ? 'تم حفظ التعديل ✔' : 'تم نشر الخبر ✔');
    resetNewsForm();
  }catch(e){
    showToast('حصل خطأ في الحفظ، اتأكد إنك داخل بحساب الأدمن');
  }finally{
    btn.disabled = false; btn.textContent = document.getElementById('af-newsId').value ? 'حفظ التعديل' : 'نشر الخبر';
  }
  return false;
}
function renderAdminNews(){
  const wrap = document.getElementById('admin-newsList'); if(!wrap) return;
  wrap.innerHTML='';
  newsSorted().forEach(n=>{
    const flags = (n.pinned?' · 📌 مثبّت':'') + (n.breaking?' · 🔴 عاجل':'') + ((n.likeUids||[]).length?' · ❤ '+n.likeUids.length:'');
    wrap.appendChild(el(`
      <div class="admin-item-row">
        <div class="ai-info"><b>${esc(n.title)}</b><span>${esc(newsDate(n))}${flags}</span></div>
        <div class="ai-actions" style="flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" class="mini-btn" onclick="toggleNewsFlag('${n.id}','pinned')">${n.pinned?'إلغاء التثبيت':'تثبيت'}</button>
          <button type="button" class="mini-btn" onclick="toggleNewsFlag('${n.id}','breaking')">${n.breaking?'إلغاء العاجل':'عاجل'}</button>
          <button type="button" class="mini-btn" onclick="editNews('${n.id}')">تعديل</button>
          <button type="button" class="mini-btn danger" onclick="deleteNews('${n.id}')">حذف</button>
        </div>
      </div>
    `));
  });
}
document.getElementById('newsSearch').addEventListener('input', e=>{ NEWS_Q = normAr(e.target.value); NEWS_SHOWN = NEWS_PAGE; renderNews(); });
