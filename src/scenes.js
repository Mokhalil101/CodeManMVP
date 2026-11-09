function btn(s, x, y, label, cb){
  const t = s.add.text(x, y, label, {fontFamily:FONT, fontSize:'14px', color:'#ffe94d'}).setOrigin(.5).setInteractive({useHandCursor:true});
  t.on('pointerover', ()=>t.setColor('#ffffff')); t.on('pointerout', ()=>t.setColor('#ffe94d')); t.on('pointerup', cb);
  return t;
}
const txt = (s,x,y,str,size='12px',color='#e8e8ff',o=.5) => s.add.text(x,y,str,{fontFamily:FONT,fontSize:size,color,align:'center',wordWrap:{width:540}}).setOrigin(o);

// BootScene: load JSON data (FR-014, NFR-027/028)
class BootScene extends Phaser.Scene {
  constructor(){ super('Boot'); }
  preload(){
    txt(this, 304, 260, 'LOADING...', '16px', '#ffe94d');
    this.load.json('q', 'data/questions.json'); this.load.json('l', 'data/levels.json');
  }
  create(){
    const q = this.cache.json.get('q'), l = this.cache.json.get('l');
    if (!q || !l) { txt(this, 304, 300, 'Could not load data.\nOpen via a web server\n(see README).', '12px', '#ff4d6d'); return; }
    this.registry.set('qm', new QuestionManager(q)); this.registry.set('levels', l.levels);
    this.scene.start('Menu');
  }
}

class MenuScene extends Phaser.Scene {
  constructor(){ super('Menu'); }
  create(){
    SAVE = Save.load();
    const n = this.registry.get('levels').length;
    txt(this, 304, 90, 'CODE MAN', '36px', '#ffe94d');
    txt(this, 304, 140, 'Eat Code. Escape Bugs.\nMaster Programming.', '10px', '#33e0ff');
    this.add.circle(304, 215, 26, 0xffe94d);
    [[190,0xff4d4d],[250,0xff7ad9],[358,0x33e0ff],[418,0xffa94d]].forEach(([x,c])=>this.add.circle(x,215,16,c));
    let y = 285; const add = (l, cb) => { btn(this, 304, y, l, cb); y += 40; };
    add('PLAY GAME', ()=>this.scene.start('Game',{level:0}));
    if (SAVE.unlocked > 1) add('CONTINUE LV '+Math.min(SAVE.unlocked,n), ()=>this.scene.start('Game',{level:Math.min(SAVE.unlocked-1,n-1)}));
    add('HOW TO PLAY', ()=>this.panel('HOW TO PLAY',
      'Arrows / WASD / swipe / d-pad: move\nEat all CODE BITS, answer every ? node, reach the green EXIT.\nBugs cost a life (3 lives).\nU = Power Compiler: freeze bugs, touch them to send them back (5s)\nS = Speed Boost (7s)   D = Debug Shield (1 hit)\nB = Bonus Chip +250\nLevel 7: beat the CORE VIRUS by answering its hard questions.\nP / Esc: pause'));
    add('LEADERBOARD', ()=>{ const s=SAVE.stats;
      this.panel('PERSONAL BEST', `Best score: ${SAVE.best}\nLevels unlocked: ${Math.min(SAVE.unlocked,n)} / ${n}\nGames: ${s.games}   Levels cleared: ${s.levels}\nCorrect: ${s.correct}   Wrong: ${s.wrong}\nBugs squashed: ${s.bugs}\nPlay time: ${Math.round(s.time)}s`); });
    add('ACHIEVEMENTS', ()=>this.panel('ACHIEVEMENTS', ACH.map(a=>`${SAVE.ach[a.id]?'[X]':'[ ]'} ${a.name}\n${a.desc}`).join('\n')));
    add('SETTINGS', ()=>this.scene.start('Settings'));
  }
  panel(title, body){
    const c = this.add.container(0,0).setDepth(10);
    c.add(this.add.rectangle(304,260,580,460,0x10104a).setStrokeStyle(3,0x6c5cff).setInteractive());
    c.add(txt(this,304,50,title,'16px','#ffe94d')); c.add(txt(this,304,255,body,'9px'));
    c.add(btn(this,304,480,'BACK',()=>c.destroy()));
  }
}

class SettingsScene extends Phaser.Scene {
  constructor(){ super('Settings'); }
  create(){
    txt(this,304,100,'SETTINGS','24px','#ffe94d');
    const snd = btn(this,304,200,'',()=>{ SAVE.settings.sound=!SAVE.settings.sound; Save.save(SAVE); upd(); Sfx.beep(660,0.1); });
    const df = btn(this,304,260,'',()=>{ SAVE.settings.diff=(SAVE.settings.diff+1)%3; Save.save(SAVE); upd(); });
    const upd = () => { snd.setText('SOUND: '+(SAVE.settings.sound?'ON':'OFF')); df.setText('ENEMIES: '+['EASY','NORMAL','HARD'][SAVE.settings.diff]); };
    upd();
    btn(this,304,340,'RESET SAVED DATA',()=>{ Save.reset(); SAVE=Save.load(); upd(); txt(this,304,385,'Data cleared.','10px','#7dff9b'); });
    btn(this,304,440,'BACK',()=>this.scene.start('Menu'));
  }
}

class GameScene extends Phaser.Scene {
  constructor(){ super('Game'); }
  init(d){ this.lvIdx=(d&&d.level)||0; this.carry=d||{}; }
  create(){
    const levels = this.registry.get('levels'); const L = this.L = levels[this.lvIdx];
    this.map = L.mazeLayout;
    this.qm = this.registry.get('qm'); this.qm.reset();
    this.score = this.carry.score||0; this.lives = this.carry.lives||3;
    this.state='playing'; this.t=0; this.modeT=0; this.freeze=0; this.spd=0; this.inv=0; this.shield=false;
    this.lostLife=false; this.unlocked=false; this.total=0; this.left=0; this.scatter=true; this.boss=null;
    this.gspeed = (L.ghostSpeed||3) * ([0.85,1,1.15][SAVE.settings.diff]||1);
    Input.x=0; Input.y=0;
    this.items=new Map(); this.nodes=new Map(); this.ghosts=[];
    const names=['Syntax','Logic','Runtime','Memory'], cols=[0xff4d4d,0xff7ad9,0x33e0ff,0xffa94d], corners=[[17,1],[1,1],[17,13],[1,13]];
    const g=this.add.graphics(); let gi=0, ps={x:1,y:1}, ex={x:9,y:1}, bp=null;
    this.map.forEach((row,y)=>[...row].forEach((c,x)=>{
      const px=x*T+T/2, py=HUD+y*T+T/2;
      if (c==='#') { g.fillStyle(0x14145a,1).fillRect(x*T+2,HUD+y*T+2,T-4,T-4); g.lineStyle(2,0x6c5cff,1).strokeRect(x*T+2,HUD+y*T+2,T-4,T-4); }
      else if (c==='.') { this.items.set(x+','+y,{t:c,o:[this.add.circle(px,py,3,0xe8e8ff)]}); this.total++; this.left++; }
      else if (c==='B') this.items.set(x+','+y,{t:c,o:[this.add.circle(px,py,8,0xffd700).setStrokeStyle(2,0xffffff)]});
      else if ('USD'.includes(c)) { const col={U:0x33e0ff,S:0x7dff9b,D:0x6c8cff}[c];
        this.items.set(x+','+y,{t:c,o:[this.add.circle(px,py,10,col),this.add.text(px,py,c,{fontFamily:FONT,fontSize:'10px',color:'#000'}).setOrigin(.5)]}); }
      else if (c==='Q') this.nodes.set(x+','+y,[this.add.rectangle(px,py,24,24,0x8b3dff).setStrokeStyle(2,0xffffff),this.add.text(px,py,'?',{fontFamily:FONT,fontSize:'14px',color:'#fff'}).setOrigin(.5)]);
      else if (c==='P') ps={x,y};
      else if (c==='E') ex={x,y};
      else if (c==='X') bp={x,y};
      else if (c==='G' && gi<4) { const m=new Mover(x,y,this.gspeed);
        this.ghosts.push({m,s:this.add.circle(0,0,12,cols[gi]),type:names[gi],c:cols[gi],corner:corners[gi],delay:gi*2,ret:false,dist:null}); gi++; }
    }));
    this.ghosts.forEach(gh=>gh.dist=this.bfs(gh.m.sx,gh.m.sy));
    if (bp) this.boss={m:new Mover(bp.x,bp.y,this.gspeed*1.1),s:this.add.circle(0,0,17,0xff0044).setStrokeStyle(3,0xffffff),type:'Syntax',corner:[9,7],always:true,delay:3,hp:L.bossHP||3,down:false};
    this.exit=this.add.rectangle(ex.x*T+T/2,HUD+ex.y*T+T/2,26,26,0x555566).setStrokeStyle(2,0xffffff); this.exitPos=ex;
    this.p=new Mover(ps.x,ps.y,4.2); this.ps=this.add.circle(0,0,12,0xffe94d);
    this.hudA=this.add.text(6,5,'',{fontFamily:FONT,fontSize:'10px',color:'#ffe94d'});
    this.hudB=this.add.text(6,23,'',{fontFamily:FONT,fontSize:'9px',color:'#33e0ff'});
    this.cur=this.input.keyboard.createCursorKeys(); this.wasd=this.input.keyboard.addKeys('W,A,S,D');
    this.keyP=this.input.keyboard.addKey('P'); this.keyEsc=this.input.keyboard.addKey('ESC');
    this.input.on('pointerup',p=>{ const dx=p.upX-p.downX, dy=p.upY-p.downY;
      if (Math.max(Math.abs(dx),Math.abs(dy))>20) { if (Math.abs(dx)>Math.abs(dy)) {Input.x=Math.sign(dx);Input.y=0;} else {Input.y=Math.sign(dy);Input.x=0;} } });
    this.pauseTxt=txt(this,304,260,'PAUSED','24px','#ffe94d').setVisible(false).setDepth(5);
    this.pop(`LEVEL ${L.levelId}: ${L.name}`,304,HUD+20,'#33e0ff');
    this.placeAll(); this.updateExit();
  }
  free(x,y){ const c=this.map[y]&&this.map[y][x]; if(!c||c==='#')return false; if(c==='E'&&!this.unlocked)return false; return true; }
  freeG(x,y){ const c=this.map[y]&&this.map[y][x]; return !!c&&c!=='#'&&c!=='E'; }
  bfs(sx,sy){
    const d=this.map.map(r=>[...r].map(()=>Infinity)); d[sy][sx]=0; const q=[[sx,sy]];
    for (let i=0;i<q.length;i++){ const [x,y]=q[i]; for (const v of DIRS){ const nx=x+v.x, ny=y+v.y; if (this.freeG(nx,ny)&&d[ny][nx]===Infinity){ d[ny][nx]=d[y][x]+1; q.push([nx,ny]); } } }
    return d;
  }
  pop(s,x,y,color='#ffe94d'){ const t=this.add.text(x,y,s,{fontFamily:FONT,fontSize:'10px',color}).setOrigin(.5).setDepth(4);
    this.tweens.add({targets:t,y:y-26,alpha:0,duration:1400,onComplete:()=>t.destroy()}); }
  place(o,m){ o.setPosition(m.fx*T+T/2, HUD+m.fy*T+T/2); }
  placeAll(){ this.place(this.ps,this.p); this.ghosts.forEach(g=>this.place(g.s,g.m)); if(this.boss&&!this.boss.down) this.place(this.boss.s,this.boss.m); }
  readKeys(){ const c=this.cur,w=this.wasd;
    if(c.left.isDown||w.A.isDown){Input.x=-1;Input.y=0;} else if(c.right.isDown||w.D.isDown){Input.x=1;Input.y=0;}
    else if(c.up.isDown||w.W.isDown){Input.x=0;Input.y=-1;} else if(c.down.isDown||w.S.isDown){Input.x=0;Input.y=1;} }
  playerDecide(m){
    if ((Input.x||Input.y) && this.free(m.gx+Input.x,m.gy+Input.y)) return {x:Input.x,y:Input.y};
    return (m.dir.x||m.dir.y) ? m.dir : null;
  }
  // Enemy AI (FR-049/052): Chase/Scatter cycle, per-enemy targeting
  ghostDecide(g){
    const p=this.p, m=g.m; let tx=g.corner[0], ty=g.corner[1];
    if (!this.scatter || g.always) switch(g.type){
      case 'Syntax': tx=p.gx; ty=p.gy; break;
      case 'Logic': tx=p.gx+p.dir.x*4; ty=p.gy+p.dir.y*4; break;
      case 'Runtime': { const s=this.ghosts[0].m; tx=(p.gx+p.dir.x*2)*2-s.gx; ty=(p.gy+p.dir.y*2)*2-s.gy; break; }
      case 'Memory': if (Math.hypot(m.gx-p.gx,m.gy-p.gy)>6) { tx=p.gx; ty=p.gy; } break;
    }
    const opts=DIRS.filter(d=>this.freeG(m.gx+d.x,m.gy+d.y));
    let c=opts.filter(d=>!(d.x===-m.dir.x&&d.y===-m.dir.y)); if(!c.length)c=opts;
    let best=null, bd=1e9;
    for (const d of c) { const dd=(m.gx+d.x-tx)**2+(m.gy+d.y-ty)**2+Math.random()*0.01; if(dd<bd){bd=dd;best=d;} }
    return best;
  }
  retDecide(g){ // Return state: walk the shortest path back to spawn
    const m=g.m; let best=null, bd=Infinity;
    for (const v of DIRS) { const nx=m.gx+v.x, ny=m.gy+v.y; if(!this.freeG(nx,ny))continue; const val=g.dist[ny][nx]; if(val<bd){bd=val;best=v;} }
    return best;
  }
  togglePause(){
    if (this.state==='playing') { this.state='paused'; this.pauseTxt.setVisible(true); }
    else if (this.state==='paused') { this.state='playing'; this.pauseTxt.setVisible(false); }
  }
  update(_, ms){
    if (Phaser.Input.Keyboard.JustDown(this.keyP)||Phaser.Input.Keyboard.JustDown(this.keyEsc)) this.togglePause();
    if (this.state!=='playing') return;
    const dt=Math.min(ms/1000,0.05); this.t+=dt; this.readKeys();
    this.freeze=Math.max(0,this.freeze-dt); this.spd=Math.max(0,this.spd-dt); this.inv=Math.max(0,this.inv-dt);
    this.modeT+=dt; this.scatter=(this.modeT%20)<5;
    const p=this.p; p.speed=this.spd>0?6:4.2;
    p.update(dt,m=>this.playerDecide(m),(x,y)=>this.free(x,y));
    this.pickups(); if(this.state!=='playing')return;
    for (const g of this.ghosts) {
      if (g.ret) {
        g.m.speed=7; g.m.update(dt,()=>this.retDecide(g),(x,y)=>this.freeG(x,y));
        if (!g.m.moving && g.m.gx===g.m.sx && g.m.gy===g.m.sy) { g.ret=false; g.delay=1; g.m.speed=this.gspeed; }
      } else if (g.delay>0) g.delay-=dt;
      else if (this.freeze<=0) g.m.update(dt,()=>this.ghostDecide(g),(x,y)=>this.freeG(x,y));
      g.s.setFillStyle(g.ret?0xffffff:this.freeze>0?0x3b6bff:g.c).setScale(g.ret?0.5:1); this.place(g.s,g.m);
      this.hit(g); if (this.state!=='playing') return;
    }
    const b=this.boss;
    if (b && !b.down) {
      if (b.delay>0) b.delay-=dt; else b.m.update(dt,()=>this.ghostDecide(b),(x,y)=>this.freeG(x,y));
      this.place(b.s,b.m); b.s.setAlpha(b.delay>0?0.4:1); this.bossTouch(); if (this.state!=='playing') return;
    }
    this.place(this.ps,p); this.ps.setStrokeStyle(this.shield?3:0,0x33e0ff); this.ps.setAlpha(this.inv>0?0.5:1);
    this.checkNode(); if(this.state!=='playing')return;
    this.checkExit(); this.hud();
  }
  tileKey(){ return Math.round(this.p.fx)+','+Math.round(this.p.fy); }
  pickups(){
    const k=this.tileKey(), it=this.items.get(k); if(!it) return;
    this.items.delete(k); it.o.forEach(o=>o.destroy());
    const p=this.ps;
    switch(it.t){
      case '.': this.score+=10; this.left--; Sfx.beep(660,0.04); this.updateExit(); break;
      case 'B': this.score+=250; this.pop('+250',p.x,p.y); Sfx.beep(900,0.15); break;
      case 'U': this.freeze=5; this.pop('POWER COMPILER!',p.x,p.y,'#33e0ff'); Sfx.beep(300,0.2,'sawtooth'); break;
      case 'S': this.spd=7; this.pop('SPEED BOOST!',p.x,p.y,'#7dff9b'); Sfx.beep(800,0.15); break;
      case 'D': this.shield=true; this.pop('DEBUG SHIELD!',p.x,p.y,'#6c8cff'); Sfx.beep(500,0.15); break;
    }
  }
  hit(g){
    if (g.ret || g.delay>0 || Math.hypot(g.m.fx-this.p.fx,g.m.fy-this.p.fy)>0.6) return;
    if (this.freeze>0) { this.score+=200; SAVE.stats.bugs++; g.ret=true; this.pop('+200 BUG FIXED',this.ps.x,this.ps.y,'#ff7ad9'); Sfx.beep(200,0.15); this.ach(); return; }
    if (this.inv>0) return;
    if (this.shield) { this.shield=false; this.inv=1.5; g.m.reset(); g.delay=2; this.pop('SHIELD BROKEN',this.ps.x,this.ps.y,'#6c8cff'); return; }
    this.loseLife();
  }
  loseLife(){
    this.lives--; this.lostLife=true; Sfx.beep(120,0.4,'sawtooth');
    if (this.lives<=0) { this.gameOver(); return true; }
    this.p.reset(); this.ghosts.forEach((x,i)=>{ x.m.reset(); x.ret=false; x.delay=i*1.5; });
    if (this.boss && !this.boss.down) { this.boss.m.reset(); this.boss.delay=3; }
    Input.x=0; Input.y=0; this.inv=1.5; this.placeAll(); return false;
  }
  bossTouch(){ // Core Virus: every touch opens a hard question
    const b=this.boss; if (b.delay>0 || this.inv>0 || Math.hypot(b.m.fx-this.p.fx,b.m.fy-this.p.fy)>0.7) return;
    this.state='quiz';
    Quiz.open(this.qm.next({3:1},null), r=>{
      const s=SAVE.stats;
      if (r.ok) { s.correct++; if (r.fast) s.fast++; this.score+=(r.q.points||100)+300; b.hp--; Sfx.beep(880,0.2);
        if (b.hp<=0) { b.down=true; b.s.destroy(); this.score+=1000; this.pop('CORE VIRUS DEFEATED!',304,HUD+200,'#7dff9b'); }
        else this.pop('HIT! '+b.hp+' LEFT',304,HUD+200,'#ff4d6d');
      } else { s.wrong++; this.score=Math.max(0,this.score-50); Sfx.beep(150,0.3,'sawtooth'); }
      if (!b.down) { b.m.reset(); b.delay=3; }
      this.inv=Math.max(this.inv,1.5); Input.x=0; Input.y=0;
      if (!r.ok && this.loseLife()) return;
      this.state='playing'; this.updateExit(); this.ach();
    });
  }
  checkNode(){
    const k=this.tileKey(), n=this.nodes.get(k); if(!n) return;
    this.nodes.delete(k); n.forEach(o=>o.destroy()); this.state='quiz';
    Quiz.open(this.qm.next(this.L.difficultyMix,this.L.topic), r=>{
      const s=SAVE.stats;
      if (r.ok) { this.score+=(r.q.points||100)+(r.fast?50:0); s.correct++; if (r.fast) s.fast++; Sfx.beep(880,0.2); }
      else { this.score=Math.max(0,this.score-50); s.wrong++; Sfx.beep(150,0.3,'sawtooth'); }
      Input.x=0; Input.y=0; this.state='playing'; this.updateExit(); this.ach();
    });
  }
  updateExit(){ this.unlocked=(this.left===0&&this.nodes.size===0&&(!this.boss||this.boss.down)); this.exit.setFillStyle(this.unlocked?0x1fe06b:0x555566); }
  checkExit(){ if(this.unlocked && Math.round(this.p.fx)===this.exitPos.x && Math.round(this.p.fy)===this.exitPos.y) this.complete(); }
  ach(){
    const l=Ach.check({score:this.score,done:this.state==='done',lost:this.lostLife,boss:!!(this.boss&&this.boss.down)});
    l.forEach((a,i)=>this.pop('ACHIEVEMENT: '+a.name,304,HUD+60+i*16,'#ffd700')); return l;
  }
  finishStats(){ SAVE.stats.time+=this.t; SAVE.best=Math.max(SAVE.best,this.score); }
  complete(){
    this.state='done'; const bonus=500+(this.lostLife?0:300); this.score+=bonus;
    SAVE.stats.levels++; SAVE.unlocked=Math.max(SAVE.unlocked,this.lvIdx+2); this.finishStats();
    const na=this.ach(); Save.save(SAVE);
    this.scene.start('LevelComplete',{score:this.score,lives:this.lives,level:this.lvIdx,bonus,hasNext:this.lvIdx+1<this.registry.get('levels').length,ach:na});
  }
  gameOver(){ this.state='over'; SAVE.stats.games++; this.finishStats(); const na=this.ach(); Save.save(SAVE); this.scene.start('GameOver',{score:this.score,ach:na}); }
  hud(){
    const pw=[this.freeze>0?'COMPILER '+this.freeze.toFixed(0):'',this.spd>0?'SPEED '+this.spd.toFixed(0):'',this.shield?'SHIELD':''].filter(Boolean).join(' ')||'-';
    const m=Math.floor(this.t/60), s=Math.floor(this.t%60);
    this.hudA.setText(`SCORE ${this.score}  LIVES ${'♥'.repeat(this.lives)}  LV ${this.L.levelId}`);
    this.hudB.setText(`BITS ${this.left}  ${Math.round((1-this.left/this.total)*100)}%  ${m}:${String(s).padStart(2,'0')}  PWR ${pw}`+(this.boss&&!this.boss.down?`  BOSS HP ${this.boss.hp}`:''));
  }
}

class LevelCompleteScene extends Phaser.Scene {
  constructor(){ super('LevelComplete'); }
  create(d){
    const last=!d.hasNext;
    txt(this,304,110,last?'ALL LEVELS CLEARED!':'LEVEL COMPLETED!','22px','#7dff9b');
    txt(this,304,190,`Level bonus: +${d.bonus}\nScore: ${d.score}`,'14px');
    if (d.ach&&d.ach.length) txt(this,304,260,d.ach.map(a=>'ACHIEVEMENT: '+a.name).join('\n'),'10px','#ffd700');
    if (d.hasNext) btn(this,304,340,'NEXT LEVEL ▶',()=>this.scene.start('Game',{level:d.level+1,score:d.score,lives:d.lives}));
    else txt(this,304,340,'The Core Virus is gone.\nYou are a true CODE MAN!','12px','#ffe94d');
    btn(this,304,430,'MAIN MENU',()=>this.scene.start('Menu'));
  }
}
class GameOverScene extends Phaser.Scene {
  constructor(){ super('GameOver'); }
  create(d){
    txt(this,304,120,'GAME OVER','30px','#ff4d6d');
    txt(this,304,200,`Final score: ${d.score}\nBest: ${SAVE.best}`,'14px');
    if (d.ach&&d.ach.length) txt(this,304,262,d.ach.map(a=>'ACHIEVEMENT: '+a.name).join('\n'),'10px','#ffd700');
    btn(this,304,340,'TRY AGAIN',()=>this.scene.start('Game',{level:0}));
    btn(this,304,400,'MAIN MENU',()=>this.scene.start('Menu'));
  }
}
