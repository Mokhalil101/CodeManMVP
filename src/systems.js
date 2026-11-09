// Save Manager (FR-084..088, NFR-019: tolerate unavailable storage)
const Save = {
  key: 'codeman_v1',
  def(){ return {best:0, unlocked:1, ach:{}, settings:{sound:true, diff:1}, stats:{correct:0, wrong:0, levels:0, games:0, time:0, bugs:0, fast:0}}; },
  load(){ try { const r = JSON.parse(localStorage.getItem(this.key)||'{}'), d = this.def();
    return Object.assign(d, r, {stats:Object.assign(d.stats, r.stats), settings:Object.assign(d.settings, r.settings), ach:Object.assign({}, r.ach)}); } catch(e){ return this.def(); } },
  save(d){ try { localStorage.setItem(this.key, JSON.stringify(d)); } catch(e){} },
  reset(){ try { localStorage.removeItem(this.key); } catch(e){} }
};
let SAVE = Save.load();

// Audio (Web Audio beeps)
const Sfx = { ctx:null,
  beep(f=440, d=0.08, type='square'){
    if (typeof SAVE !== 'undefined' && SAVE.settings && !SAVE.settings.sound) return;
    try { this.ctx = this.ctx || new (window.AudioContext||window.webkitAudioContext)();
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type=type; o.frequency.value=f; g.gain.value=0.04; o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime+d); } catch(e){}
  } };

// Question Manager (FR-038..046, NFR-015/021: validate data)
class QuestionManager {
  constructor(list){ this.all = (list||[]).filter(QuestionManager.valid); this.used = new Set(); }
  static valid(q){
    return q && typeof q.id==='string' && typeof q.question==='string' && Array.isArray(q.options) &&
      q.options.length>=2 && q.options.length<=6 && Number.isInteger(q.correctAnswer) &&
      q.correctAnswer>=0 && q.correctAnswer<q.options.length && [1,2,3].includes(q.difficulty);
  }
  reset(){ this.used.clear(); }
  next(mix, topic){
    const r=Math.random(); let acc=0, d=1;
    for (const k of [1,2,3]) { acc += (mix&&mix[k])||0; d=k; if (r<=acc) break; }
    const free = q => !this.used.has(q.id), tp = q => !topic || q.topic===topic;
    let pool = this.all.filter(q=>free(q)&&tp(q)&&q.difficulty===d);
    if (!pool.length) pool = this.all.filter(q=>free(q)&&tp(q));
    if (!pool.length) pool = this.all.filter(q=>free(q)&&q.difficulty===d);
    if (!pool.length) pool = this.all.filter(free);
    if (!pool.length) { this.used.clear(); pool = this.all; }
    const q = pool[Math.floor(Math.random()*pool.length)];
    this.used.add(q.id); return q;
  }
}

// Quiz overlay (DOM). Uses textContent only -> no unsafe HTML (NFR-022/023)
const Quiz = {
  open(q, cb){
    const $ = id => document.getElementById(id), root = $('quiz');
    const limit = q.timeLimit || 15; let left = limit, done = false, t = null;
    $('qmeta').textContent = `${q.category||''} · ${'★'.repeat(q.difficulty)}`;
    $('qtext').textContent = q.question;
    const c = $('qcode'); c.textContent = q.code||''; c.hidden = !q.code;
    const o = $('qopts'); o.textContent = ''; $('qfb').textContent = ''; $('qnext').hidden = true;
    const finish = idx => {
      if (done) return; done = true; clearInterval(t);
      const ok = idx === q.correctAnswer;
      [...o.children].forEach((b,i)=>{ b.disabled = true;
        if (i===q.correctAnswer) b.classList.add('ok'); else if (i===idx) b.classList.add('bad'); });
      $('qfb').textContent = (idx<0 ? 'TIME UP! ' : ok ? 'CORRECT! ' : 'WRONG! ') + (q.explanation||'');
      const nb = $('qnext'); nb.hidden = false;
      nb.onclick = () => { root.hidden = true; cb({ok, fast: ok && left > limit/2, q}); };
      nb.focus();
    };
    q.options.forEach((txt,i)=>{
      const b = document.createElement('button'); b.textContent = `${'ABCDEF'[i]}. ${txt}`;
      b.onclick = () => finish(i); o.appendChild(b);
    });
    const bar = $('qbarin'); bar.style.width = '100%';
    t = setInterval(()=>{ left -= 0.1; bar.style.width = Math.max(0,left/limit*100)+'%'; if (left<=0) finish(-1); }, 100);
    root.hidden = false;
  }
};

// Achievements (FR-092/093)
const ACH = [
 {id:'first', name:'FIRST COMMIT', desc:'Answer a question correctly', t:s=>s.correct>=1},
 {id:'quiz10', name:'QUIZ MASTER', desc:'10 correct answers', t:s=>s.correct>=10},
 {id:'quiz50', name:'CODE SAGE', desc:'50 correct answers', t:s=>s.correct>=50},
 {id:'bug10', name:'BUG SQUASHER', desc:'Squash 10 bugs', t:s=>s.bugs>=10},
 {id:'fast5', name:'SPEED TYPIST', desc:'5 fast answers', t:s=>s.fast>=5},
 {id:'score5k', name:'HIGH SCORER', desc:'Reach 5000 points', t:(s,g)=>g.score>=5000},
 {id:'clean', name:'FLAWLESS', desc:'Clear a level without losing a life', t:(s,g)=>g.done&&!g.lost},
 {id:'lv3', name:'WORLD TRAVELER', desc:'Complete 3 levels', t:s=>s.levels>=3},
 {id:'lv7', name:'FULL STACK', desc:'Complete 7 levels', t:s=>s.levels>=7},
 {id:'boss', name:'CORE BREAKER', desc:'Defeat the Core Virus', t:(s,g)=>g.boss}
];
const Ach = { check(g){
  const out=[]; for (const a of ACH) if (!SAVE.ach[a.id] && a.t(SAVE.stats,g)) { SAVE.ach[a.id]=true; out.push(a); }
  if (out.length) Save.save(SAVE); return out; } };
