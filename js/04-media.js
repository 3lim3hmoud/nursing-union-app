/* ========================= مركز الميديا ========================= */
function cld(u,t){
  if(u && u.indexOf('/video/upload/')>-1) return u;
  return (u && u.indexOf('res.cloudinary.com')>-1 && u.indexOf('/upload/')>-1) ? u.replace('/upload/','/upload/'+t+'/') : u;
}
function isCldVideo(u){ return /res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(u||''); }
function cldPoster(u){ return u.replace('/video/upload/','/video/upload/so_1,c_fill,w_800,h_800,q_auto/').replace(/\.[a-z0-9]+(\?.*)?$/i,'.jpg'); }
function cldVideoSrc(u){ return u.replace('/video/upload/','/video/upload/f_mp4,vc_h264,q_auto/').replace(/\.[a-z0-9]+(\?.*)?$/i,'.mp4'); }
function ytId(u){
  const m = String(u||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : '';
}
function mediaThumb(m){
  if(m.type==='image') return m.url;
  if(m.coverURL) return m.coverURL;
  if(isCldVideo(m.url)) return cldPoster(m.url);
  const y = ytId(m.url);
  return y ? `https://img.youtube.com/vi/${y}/hqdefault.jpg` : '';
}
function mediaAlbums(){
  const out=[]; STATE.media.forEach(m=>{ if(m.album && !out.includes(m.album)) out.push(m.album); }); return out;
}
let MEDIA_FILTER = 'all';
const MEDIA_PAGE = 24; let MEDIA_SHOWN = MEDIA_PAGE;   /* عدد العناصر اللي بتظهر في الشبكة */
function filteredMedia(){
  return STATE.media.filter(m=>
    MEDIA_FILTER==='all' ||
    (MEDIA_FILTER==='image' && m.type==='image') ||
    (MEDIA_FILTER==='video' && m.type==='video') ||
    (MEDIA_FILTER.indexOf('a:')===0 && m.album===MEDIA_FILTER.slice(2)));
}
function renderMediaPage(){
  const chips = document.getElementById('mediaChips'), grid = document.getElementById('mediaGrid');
  if(!chips || !grid) return;
  const imgs = STATE.media.filter(m=>m.type==='image').length, vids = STATE.media.length - imgs;
  const defs = [['all','الكل',STATE.media.length],['image','📷 صور',imgs],['video','🎬 فيديو',vids]]
    .concat(mediaAlbums().map(a=>['a:'+a, a, STATE.media.filter(m=>m.album===a).length]));
  if(!defs.some(d=>d[0]===MEDIA_FILTER)) MEDIA_FILTER='all';
  chips.innerHTML='';
  defs.forEach(d=>{
    if(d[0]!=='all' && !d[2]) return;
    const c = el(`<button type="button" class="mchip ${MEDIA_FILTER===d[0]?'active':''}" data-f="${esc(d[0])}">${esc(d[1])} <i>${d[2]}</i></button>`);
    chips.appendChild(c);
  });
  const list = filteredMedia();
  document.getElementById('mediaCount').textContent = list.length ? list.length+' عنصر' : '';
  grid.innerHTML='';
  if(!list.length){
    grid.style.display='block';
    grid.appendChild(el('<div class="empty-note">مفيش ميديا لسه — الأدمن يقدر يضيف صور وفيديوهات من لوحة التحكم 🖼️</div>'));
    return;
  }
  grid.style.display='';
  list.slice(0, MEDIA_SHOWN).forEach(m=>{
    const th = mediaThumb(m);
    const img = th ? `<img src="${esc(cld(th,'c_fill,w_500,h_500,q_auto,f_auto'))}" alt="" loading="lazy">` : '<div class="mg-ph"></div>';
    const play = m.type==='video' ? '<div class="mg-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>' : '';
    const t = m.title || '';
    const cap = (t || m.album) ? `<div class="mg-cap">${esc(t || m.album)}${t && m.album ? `<small>${esc(m.album)}</small>` : ''}</div>` : '';
    const it = el(`<div class="mg-item" data-id="${esc(m.id)}">${img}<div class="mg-shade"></div>${play}${cap}</div>`);
    grid.appendChild(it);
  });
  const left = list.length - MEDIA_SHOWN;
  if(left > 0){
    const mb = el(`<button type="button" class="more-btn">عرض المزيد (${left})</button>`);
    mb.addEventListener('click', e=>{ e.stopPropagation(); MEDIA_SHOWN += MEDIA_PAGE; renderMediaPage(); });
    grid.appendChild(mb);
  }
}
document.getElementById('mediaChips').addEventListener('click', e=>{
  const b = e.target.closest('.mchip'); if(!b) return;
  MEDIA_FILTER = b.dataset.f; MEDIA_SHOWN = MEDIA_PAGE; renderMediaPage();
});
document.getElementById('mediaGrid').addEventListener('click', e=>{
  const it = e.target.closest('.mg-item'); if(!it) return;
  openLightbox(it.dataset.id,'grid');
});

/* ----- العارض الكامل ----- */
const LB = { list:[], i:0, deletable:true };
function openLightbox(id, scope){
  LB.deletable = true;
  LB.list = scope==='home' ? STATE.media.slice(0,6) : filteredMedia();
  const i = LB.list.findIndex(m=>m.id===id);
  if(i<0) return;
  LB.i = i;
  document.getElementById('lightbox').classList.add('show');
  renderLightbox();
}
function openLightboxList(list, i){
  LB.deletable = false; LB.list = list; LB.i = i || 0;
  document.getElementById('lightbox').classList.add('show');
  renderLightbox();
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('show');
  document.getElementById('lbStage').innerHTML='';
}
function lbMove(d){
  if(!LB.list.length) return;
  LB.i = (LB.i + d + LB.list.length) % LB.list.length;
  renderLightbox();
}
function renderLightbox(){
  const m = LB.list[LB.i]; if(!m) return;
  const st = document.getElementById('lbStage');
  if(m.type==='image'){
    st.innerHTML = `<img src="${esc(cld(m.url,'w_1600,q_auto,f_auto'))}" alt="">`;
  } else {
    const y = ytId(m.url);
    if(y) st.innerHTML = `<iframe src="https://www.youtube.com/embed/${y}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    else if(/facebook\.com|fb\.watch/i.test(m.url)) st.innerHTML = `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(m.url)}&show_text=false&autoplay=true" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    else if(isCldVideo(m.url)) st.innerHTML = `<video src="${esc(cldVideoSrc(m.url))}" poster="${esc(m.coverURL || cldPoster(m.url))}" controls autoplay playsinline></video>`;
    else if(/\.(mp4|webm|mov)(\?|$)/i.test(m.url)) st.innerHTML = `<video src="${esc(m.url)}" controls autoplay playsinline></video>`;
    else st.innerHTML = `<div class="lb-msg">الفيديو ده بيتفتح في موقعه الأصلي<br><a href="${esc(m.url)}" target="_blank" rel="noopener">فتح الفيديو ↗</a></div>`;
  }
  document.getElementById('lbTitle').textContent = m.title || m.album || '';
  document.getElementById('lbAlbum').textContent = m.title && m.album ? m.album : '';
  document.getElementById('lbCount').textContent = (LB.i+1)+' / '+LB.list.length;
  document.getElementById('lbDel').style.display = (IS_ADMIN && LB.deletable) ? '' : 'none';
  document.querySelectorAll('#lightbox .lb-nav').forEach(b=>b.style.display = LB.list.length>1 ? '' : 'none');
}
function shareMedia(){
  const m = LB.list[LB.i]; if(!m) return;
  const data = { title: m.title || m.album || 'اتحاد طلاب كلية التمريض', url: m.url };
  if(navigator.share){ navigator.share(data).catch(()=>{}); }
  else if(navigator.clipboard){ navigator.clipboard.writeText(m.url).then(()=>showToast('تم نسخ الرابط ✔')); }
}
async function deleteMediaItem(){
  const m = LB.list[LB.i]; if(!m || !requireFB() || !confirm('تحذف العنصر ده؟')) return;
  try{
    await db.collection('media').doc(m.id).delete();
    showToast('تم الحذف');
    LB.list.splice(LB.i,1);
    if(!LB.list.length) closeLightbox(); else { LB.i = Math.min(LB.i, LB.list.length-1); renderLightbox(); }
  }catch(e){ showToast('مقدرتش أحذف'); }
}
(function(){
  const stage = document.getElementById('lbStage'); let sx=0;
  stage.addEventListener('touchstart', e=>{ sx=e.touches[0].clientX; }, {passive:true});
  stage.addEventListener('touchend', e=>{
    const dx = e.changedTouches[0].clientX - sx;
    if(Math.abs(dx)>50) lbMove(dx>0 ? 1 : -1);
  });
  document.addEventListener('keydown', e=>{
    if(!document.getElementById('lightbox').classList.contains('show')) return;
    if(e.key==='Escape') closeLightbox();
    else if(e.key==='ArrowLeft') lbMove(1);
    else if(e.key==='ArrowRight') lbMove(-1);
  });
})();

/* ----- لوحة الأدمن: رفع الميديا ----- */
function uploadVideo(file, folder, onProgress){
  return new Promise((resolve,reject)=>{
    if(typeof CLOUDINARY_CLOUD_NAME==='undefined' || CLOUDINARY_CLOUD_NAME.includes('ضع_')){ reject(new Error('Cloudinary غير مظبوط')); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', folder);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`);
    xhr.upload.onprogress = e=>{ if(e.lengthComputable && onProgress) onProgress(Math.round(e.loaded*100/e.total)); };
    xhr.onload = ()=>{
      try{
        const d = JSON.parse(xhr.responseText);
        if(d.secure_url) resolve(d); else reject(new Error((d.error && d.error.message) || 'upload failed'));
      }catch(e){ reject(e); }
    };
    xhr.onerror = ()=>reject(new Error('مشكلة في الاتصال بالنت'));
    xhr.send(fd);
  });
}
function toggleMediaType(){
  const t = document.getElementById('af-mediaType').value;
  document.getElementById('mediaImgFields').style.display = t==='image' ? 'flex' : 'none';
  document.getElementById('mediaVidUpFields').style.display = t==='videoup' ? 'flex' : 'none';
  document.getElementById('mediaVidFields').style.display = t==='video' ? 'flex' : 'none';
}
function resetMediaForm(){
  const f = document.getElementById('mediaForm'); if(!f) return;
  const keepAlbum = document.getElementById('af-mediaAlbum').value;
  const t = document.getElementById('af-mediaType').value;
  f.reset();
  document.getElementById('af-mediaAlbum').value = keepAlbum; /* غالباً هيضيف في نفس الألبوم */
  document.getElementById('af-mediaType').value = t;
  toggleMediaType();
  setMediaProgress(-1);
}
function setMediaProgress(p){
  const bar = document.getElementById('mediaProgress'); if(!bar) return;
  bar.style.display = p<0 ? 'none' : 'block';
  bar.firstElementChild.style.width = Math.max(0,p)+'%';
}
async function saveMedia(ev){
  ev.preventDefault();
  if(!requireFB()) return false;
  const type = document.getElementById('af-mediaType').value;
  const album = document.getElementById('af-mediaAlbum').value.trim();
  const btn = document.getElementById('mediaSubmitBtn');
  if(!album){ showToast('اكتب اسم الألبوم'); return false; }
  btn.disabled = true; btn.textContent = 'جاري الرفع...';
  try{
    const base = Date.now(), items = [];
    if(type==='image'){
      const files = [...document.getElementById('af-mediaFiles').files];
      if(!files.length){ showToast('اختار صورة واحدة على الأقل'); return false; }
      const caption = document.getElementById('af-mediaCaption').value.trim();
      for(let i=0;i<files.length;i++){
        btn.textContent = `جاري رفع ${i+1} من ${files.length}...`;
        const small = await resizeImage(files[i], 1600);
        const u = await uploadImage(small,'media');
        if(!u) throw new Error('upload failed');
        items.push({ type:'image', album, title:caption, url:u, createdAt: base + (files.length - i) });
      }
    } else if(type==='videoup'){
      const vf = document.getElementById('af-mediaVideo').files[0];
      if(!vf){ showToast('اختار فيديو من الجهاز'); return false; }
      if(vf.size > 100*1024*1024){ showToast('الفيديو أكبر من 100 ميجا — صغّره الأول'); return false; }
      setMediaProgress(0);
      const d = await uploadVideo(vf,'media-videos', p=>{ setMediaProgress(p); btn.textContent = p<100 ? `رفع الفيديو ${p}%` : 'بيتم معالجة الفيديو...'; });
      const item = { type:'video', source:'upload', album, title: document.getElementById('af-mediaVTitle').value.trim(), url:d.secure_url, createdAt: base };
      if(d.duration) item.duration = Math.round(d.duration);
      const cover = document.getElementById('af-mediaVCover').files[0];
      if(cover){ const u = await uploadImage(await resizeImage(cover,1200),'media'); if(u) item.coverURL = u; }
      items.push(item);
    } else {
      const url = document.getElementById('af-mediaUrl').value.trim();
      if(!/^https?:\/\//i.test(url)){ showToast('الصق رابط فيديو صحيح (يبدأ بـ https)'); return false; }
      const item = { type:'video', album, title: document.getElementById('af-mediaTitle').value.trim(), url, createdAt: base };
      const cover = document.getElementById('af-mediaCover').files[0];
      if(cover){ const u = await uploadImage(await resizeImage(cover,1200),'media'); if(u) item.coverURL = u; }
      items.push(item);
    }
    const batch = db.batch();
    items.forEach(it=>batch.set(db.collection('media').doc(), it));
    await batch.commit();
    showToast(`تم نشر ${items.length} ${items.length>1?'عناصر':'عنصر'} ✔`);
    resetMediaForm();
  }catch(e){
    showToast('تعذر النشر: ' + ((e && e.message) ? e.message : 'اتأكد إنك داخل بحساب الأدمن'));
  }finally{
    btn.disabled = false; btn.textContent = 'نشر'; setMediaProgress(-1);
  }
  return false;
}
function renderAdminMedia(){
  const wrap = document.getElementById('admin-mediaList'); if(!wrap) return;
  const dl = document.getElementById('albumList');
  if(dl) dl.innerHTML = mediaAlbums().map(a=>`<option value="${esc(a)}">`).join('');
  wrap.innerHTML='';
  mediaAlbums().forEach(a=>{
    const items = STATE.media.filter(m=>m.album===a);
    const v = items.filter(m=>m.type==='video').length;
    const row = el(`<div class="admin-item-row"><div class="ai-info"><b>${esc(a)}</b><span>${items.length-v} صورة${v?` · ${v} فيديو`:''}</span></div><div class="ai-actions"><button type="button" class="mini-btn danger">حذف الألبوم</button></div></div>`);
    row.querySelector('button').addEventListener('click', ()=>deleteAlbum(a));
    wrap.appendChild(row);
  });
}
async function deleteAlbum(a){
  if(!requireFB() || !confirm('تحذف ألبوم «'+a+'» بكل اللي فيه؟')) return;
  try{
    const batch = db.batch();
    STATE.media.filter(m=>m.album===a).forEach(m=>batch.delete(db.collection('media').doc(m.id)));
    await batch.commit();
    showToast('تم حذف الألبوم');
  }catch(e){ showToast('مقدرتش أحذف الألبوم'); }
}

