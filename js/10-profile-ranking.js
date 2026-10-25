/* ========================= الحساب الشخصي ========================= */
function renderProfile(){
  const loggedIn = !!STUDENT.uid;
  document.getElementById('profileLoggedIn').style.display = loggedIn ? 'block' : 'none';
  document.getElementById('profileLoggedOut').style.display = loggedIn ? 'none' : 'block';
  document.getElementById('smName').textContent = loggedIn ? STUDENT.name : 'زائر';
  document.getElementById('smLevel').textContent = loggedIn ? STUDENT.level : 'سجّل دخولك من صفحة حسابي';
  if(loggedIn) setAvatarEl(document.getElementById('smAvatar'), STUDENT.name, STUDENT.photoURL, STUDENT.avatarInitial);
  else { const sa=document.getElementById('smAvatar'); sa.textContent='؟'; sa.classList.remove('has-photo'); sa.style.background='linear-gradient(135deg,var(--gold),#173a86)'; }
  if(!loggedIn) return;

  setAvatarEl(document.getElementById('profAvatar'), STUDENT.name, STUDENT.photoURL, STUDENT.avatarInitial);
  const pb = document.getElementById('profBio'); pb.textContent = STUDENT.bio || ''; pb.style.display = STUDENT.bio ? '' : 'none';
  document.getElementById('profName').textContent = STUDENT.name;
  document.getElementById('profRole').textContent = STUDENT.level;
  document.getElementById('profId').textContent = 'ID: ' + (STUDENT.studentId || '—');
  document.getElementById('chipPoints').textContent = STUDENT.points;
  const rk = myRank(); STUDENT.rank = rk;
  document.getElementById('chipRank').textContent = rk==='—' ? '—' : '#'+rk;
  document.getElementById('chipEvents').textContent = STUDENT.events;
  document.getElementById('statComp').textContent = STUDENT.competitions;
  document.getElementById('statCamp').textContent = STUDENT.campaigns;
  document.getElementById('statVol').textContent = STUDENT.workshops;
  document.getElementById('statActive').textContent = levelFromPoints(STUDENT.points);

  const isSow = !!(STATE.studentOfWeek && STATE.studentOfWeek.uid && STATE.studentOfWeek.uid===STUDENT.uid);
  const badges = [
    {icon:'🏅', label:'طالب نشط', on:(STUDENT.points||0)>=30},
    {icon:'🏆', label:'بطل مسابقة', on:(STUDENT.competitions||0)>0},
    {icon:'🤝', label:'متطوع', on:(STUDENT.workshops||0)>0},
    {icon:'⭐', label:'طالب الأسبوع', on:isSow},
  ];
  const wrap = document.getElementById('achievCard');
  wrap.innerHTML='';
  badges.forEach(b=>{
    wrap.appendChild(el(`
      <div style="flex:1;min-width:70px;text-align:center;padding:10px 4px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line);${b.on?'':'opacity:.38;filter:grayscale(1);'}">
        <div style="font-size:22px;">${b.icon}</div>
        <div style="font-size:9.5px;color:var(--muted);margin-top:4px;">${b.label}</div>
      </div>
    `));
  });
}

/* ========================= الترتيب ========================= */
function renderRankTabs(){ /* التابات القديمة (أسبوع/شهر) اتشالت لأنها ماكانتش بتفلتر حاجة */ }
function rankRowAv(cls, s){
  return `<div class="${cls}" style="${esc(avStyle(s.name, s.photoURL))}">${avInner(s.name, s.photoURL)}</div>`;
}
function renderRanking(){
  const sorted = sortedBoard();
  const podium = document.getElementById('podium');
  const listCard = document.getElementById('rankListCard');
  if(!sorted.length){
    podium.innerHTML='';
    listCard.innerHTML = '<div class="empty-note">لسه مفيش طلاب في الترتيب</div>';
    return;
  }
  const pod = (s, cls, rank, crown)=> s ? `<div class="pod ${cls}" data-i="${rank-1}" style="cursor:pointer;">${crown?'<div class="crown">👑</div>':''}${rankRowAv('rank-avatar', s)}<b>${esc(s.name)}</b><div class="pts">${esc(s.points||0)} نقطة</div></div>` : '';
  const [p1,p2,p3] = sorted;
  podium.innerHTML = pod(p2,'silver',2,false) + pod(p1,'gold',1,true) + pod(p3,'bronze',3,false);
  podium.querySelectorAll('.pod').forEach(n=>n.addEventListener('click', ()=>{
    const i = Number(n.dataset.i); const s = sorted[i]; if(s) openStuCard({ name:s.name, level:s.level, photoURL:s.photoURL, points:s.points, rank:i+1 });
  }));
  listCard.innerHTML='';
  sorted.forEach((s,i)=>{
    const isMe = !!STUDENT.uid && (s.uid===STUDENT.uid || s.id===STUDENT.uid);
    const row = el(`
      <div class="rank-list-row ${isMe?'me':''}" style="cursor:pointer;">
        <div class="rank-num">${i+1}</div>
        ${rankRowAv('r-avatar', s)}
        <div class="rname">${esc(s.name)}${isMe?' (أنت)':''}</div>
        <div class="rpts">${esc(s.points||0)} نقطة</div>
      </div>
    `);
    row.addEventListener('click', ()=>openStuCard({ name:s.name, level:s.level, photoURL:s.photoURL, points:s.points, rank:i+1 }));
    listCard.appendChild(row);
  });
}
