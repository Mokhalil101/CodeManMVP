// Grid-based mover shared by Player and Ghost (smooth tile-to-tile motion)
class Mover {
  constructor(gx, gy, speed){ this.sx=gx; this.sy=gy; this.speed=speed; this.reset(); }
  reset(){ this.gx=this.sx; this.gy=this.sy; this.dir={x:0,y:0}; this.moving=false; this.prog=0; }
  get fx(){ return this.gx + (this.moving ? this.dir.x*this.prog : 0); }
  get fy(){ return this.gy + (this.moving ? this.dir.y*this.prog : 0); }
  update(dt, decide, free){
    if (!this.moving) {
      const d = decide(this);
      if (d && free(this.gx+d.x, this.gy+d.y)) { this.dir = d; this.moving = true; this.prog = 0; }
    }
    if (this.moving) {
      this.prog += this.speed*dt;
      if (this.prog >= 1) { this.gx += this.dir.x; this.gy += this.dir.y; this.moving = false; this.prog = 0; }
    }
  }
}
