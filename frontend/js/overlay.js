export class Overlay {
  constructor(canvas, video) {
    this.canvas=canvas;
    this.video=video;
    this.ctx=canvas.getContext("2d");
    this.mirror=true;
    this.showPoints=true;
    this.lastResult=undefined;
    this.resetEffects();
  }

  resetEffects() {
    this.bubbles=[];
    this.lastShapeEventKey="";
    this.lastEventResult=undefined;
    this.emitBubbleNext=true;
    this.bubbleSequence=0;
  }

  point(point) {
    return [(this.mirror?1-point[0]:point[0])*this.canvas.width,point[1]*this.canvas.height];
  }

  path(points) {
    const path=new Path2D();
    points.forEach((point,i)=>{
      const [x,y]=this.point(point);
      if (i===0) path.moveTo(x,y); else path.lineTo(x,y);
    });
    path.closePath();
    return path;
  }

  label(text,point) {
    const ctx=this.ctx,[px,py]=this.point(point),fontSize=Math.max(14,Math.round(this.canvas.width/65));
    ctx.font=`600 ${fontSize}px Arial`;
    const width=ctx.measureText(text).width+16;
    const x=Math.max(4,Math.min(px,this.canvas.width-width-4));
    const y=Math.max(fontSize+12,Math.min(py,this.canvas.height-8));
    ctx.fillStyle="rgba(10,25,35,.82)";
    ctx.fillRect(x,y-fontSize-7,width,fontSize+12);
    ctx.fillStyle="#dbfaff";
    ctx.fillText(text,x+8,y-3);
  }

  shapeCenter(shape) {
    if (shape.kind==="ellipse") return shape.centro;
    const points=shape.pontos||[];
    if (!points.length) return [0.5,0.5];
    return [
      points.reduce((sum,p)=>sum+p[0],0)/points.length,
      points.reduce((sum,p)=>sum+p[1],0)/points.length
    ];
  }

  bubbleFromShape(shape, now) {
    const center=this.shapeCenter(shape);
    const bubble={
      createdAt:now,
      duration:2350,
      center,
      kind:shape.kind,
      label:shape.rotulo,
      direction:(this.bubbleSequence++ % 2===0)?1:-1,
      points:null,
      ratio:1
    };
    if (shape.kind==="ellipse") {
      bubble.ratio=(shape.raios?.[0]||1)/Math.max(shape.raios?.[1]||1,1e-6);
    } else if (shape.pontos?.length) {
      bubble.points=shape.pontos.map(p=>[p[0]-center[0],p[1]-center[1]]);
    }
    return bubble;
  }

  observeShapeEvent(result, now) {
    if (this.lastEventResult===result) return;
    this.lastEventResult=result;
    const shape=result?.formas_maos?.[0];
    if (!shape) {
      this.lastShapeEventKey="";
      return;
    }
    const key=`${shape.kind||"shape"}:${shape.rotulo||""}`;
    if (key===this.lastShapeEventKey) return;
    this.lastShapeEventKey=key;
    if (this.emitBubbleNext) this.bubbles.push(this.bubbleFromShape(shape,now));
    this.emitBubbleNext=!this.emitBubbleNext;
  }

  drawBubbleShape(bubble, x, y, radius) {
    const ctx=this.ctx;
    ctx.beginPath();
    if (bubble.kind==="ellipse") {
      const ratio=Math.max(0.45,Math.min(2.2,bubble.ratio||1));
      const rx=ratio>=1?radius*0.58:radius*0.58*ratio;
      const ry=ratio>=1?radius*0.58/ratio:radius*0.58;
      ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    } else if (bubble.points?.length) {
      const screen=bubble.points.map(p=>[(this.mirror?-p[0]:p[0])*this.canvas.width,p[1]*this.canvas.height]);
      const maxSpan=Math.max(
        1,
        ...screen.map(p=>Math.abs(p[0])),
        ...screen.map(p=>Math.abs(p[1]))
      );
      const scale=radius*0.62/maxSpan;
      screen.forEach((p,i)=>{
        const px=x+p[0]*scale,py=y+p[1]*scale;
        if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      });
      ctx.closePath();
    } else {
      ctx.arc(x,y,radius*0.42,0,Math.PI*2);
    }
    ctx.stroke();
  }

  drawBubbles(now) {
    if (!this.bubbles.length) return;
    const ctx=this.ctx,width=this.canvas.width,height=this.canvas.height;
    const active=[];
    for (const bubble of this.bubbles) {
      const progress=(now-bubble.createdAt)/bubble.duration;
      if (progress>=1) continue;
      const [baseX,baseY]=this.point(bubble.center);
      const radius=Math.max(24,Math.min(46,width*0.038))*(1+Math.sin(progress*Math.PI)*0.08);
      const x=baseX+bubble.direction*Math.sin(progress*Math.PI*2)*Math.max(8,width*0.012);
      const y=baseY-progress*height*0.30;
      const alpha=Math.max(0,1-progress);
      ctx.save();
      ctx.globalAlpha=alpha*0.92;
      ctx.lineWidth=Math.max(1.5,width*0.0018);
      ctx.fillStyle="rgba(95,218,238,.10)";
      ctx.strokeStyle="rgba(181,247,255,.88)";
      ctx.beginPath();
      ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha=alpha;
      ctx.lineWidth=Math.max(1.5,width*0.0022);
      ctx.strokeStyle="#c8f8ff";
      this.drawBubbleShape(bubble,x,y,radius);
      ctx.restore();
      active.push(bubble);
    }
    this.bubbles=active;
  }

  render(result) {
    const width=Math.min(960,this.video.videoWidth||960);
    const height=Math.round(width*(this.video.videoHeight||540)/(this.video.videoWidth||960));
    const resized=this.canvas.width!==width || this.canvas.height!==height;
    if (resized) { this.canvas.width=width;this.canvas.height=height; }
    const now=performance.now();
    this.observeShapeEvent(result,now);
    const same=!resized && this.lastResult===result && this.lastMirror===this.mirror && this.lastPoints===this.showPoints;
    if (same && this.bubbles.length===0) return;
    this.lastResult=result;this.lastMirror=this.mirror;this.lastPoints=this.showPoints;
    this.video.style.transform=this.mirror?"scaleX(-1)":"none";
    const ctx=this.ctx;
    ctx.clearRect(0,0,width,height);
    if (result) {
      ctx.lineWidth=Math.max(2,width*0.0025);
      ctx.strokeStyle="#71dbea";
      for (const shape of result.formas||[]) {
        ctx.stroke(this.path(shape.contorno));
        this.label(shape.rotulo,shape.caixa);
      }
      for (const shape of result.formas_maos||[]) {
        let path;
        if (shape.kind==="ellipse") {
          path=new Path2D();
          const [x,y]=this.point(shape.centro);
          path.ellipse(x,y,shape.raios[0]*width,shape.raios[1]*height,0,0,Math.PI*2);
        } else path=this.path(shape.pontos);
        ctx.save();
        ctx.fillStyle="rgba(65,175,239,.20)";
        ctx.fill(path);
        ctx.setLineDash([9,6]);
        ctx.strokeStyle="#81e4ef";
        ctx.stroke(path);
        ctx.restore();
      }
      if (this.showPoints) {
        for (const hand of result.maos) for (const index of [4,8,12,16,20]) {
          const [x,y]=this.point(hand.pontos[index]);
          const anchor=index===4 || index===8;
          ctx.beginPath();
          ctx.arc(x,y,anchor?4.5:2.8,0,Math.PI*2);
          ctx.fillStyle=anchor?"#b9f5ff":"#fff";
          ctx.fill();
          ctx.lineWidth=1.5;
          ctx.strokeStyle="rgba(0,0,0,.6)";
          ctx.stroke();
        }
      }
    }
    this.drawBubbles(now);
  }
}
