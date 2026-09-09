export class Overlay {
  constructor(canvas, video) {
    this.canvas=canvas;
    this.video=video;
    this.ctx=canvas.getContext("2d");
    this.mirror=true;
    this.showPoints=true;
    this.lastResult=undefined;
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

  render(result) {
    const width=Math.min(960,this.video.videoWidth||960);
    const height=Math.round(width*(this.video.videoHeight||540)/(this.video.videoWidth||960));
    const resized=this.canvas.width!==width || this.canvas.height!==height;
    if (!resized && this.lastResult===result && this.lastMirror===this.mirror && this.lastPoints===this.showPoints) return;
    if (resized) { this.canvas.width=width;this.canvas.height=height; }
    this.lastResult=result;this.lastMirror=this.mirror;this.lastPoints=this.showPoints;
    this.video.style.transform=this.mirror?"scaleX(-1)":"none";
    const ctx=this.ctx;
    ctx.clearRect(0,0,width,height);
    if (!result) return;
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
    if (!this.showPoints) return;
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
