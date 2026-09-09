const HAND_LINES = [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
const FACE_LINES = [[33,160,158,133,153,144,33],[362,385,387,263,373,380,362],[61,40,37,0,267,270,291,321,314,17,84,91,61],[78,82,13,312,308,317,14,87,78],[70,63,105,66,107],[336,296,334,293,300],[168,6,197,195,5,4],[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10]];

export class Overlay {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.mirror = true;
    this.showPoints = true;
  }

  point(point) {
    return [(this.mirror ? 1 - point[0] : point[0]) * this.canvas.width, point[1] * this.canvas.height];
  }

  line(points, close = false) {
    if (!points.length) return;
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach((point, index) => {
      const [x, y] = this.point(point);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (close) ctx.closePath();
    ctx.stroke();
  }

  label(text, point) {
    const ctx = this.ctx;
    const [px, py] = this.point(point);
    const fontSize = Math.max(16, Math.round(this.canvas.width / 65));
    ctx.font = `600 ${fontSize}px Arial`;
    const width = ctx.measureText(text).width + 16;
    const x = Math.max(4, Math.min(px, this.canvas.width - width - 4));
    const y = Math.max(fontSize + 12, Math.min(py, this.canvas.height - 8));
    ctx.fillStyle = "rgba(255,255,255,.93)";
    ctx.fillRect(x, y - fontSize - 7, width, fontSize + 12);
    ctx.fillStyle = "#111";
    ctx.fillText(text, x + 8, y - 3);
  }

  render(result) {
    const ctx = this.ctx;
    if (this.video.readyState < 2) {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }
    ctx.save();
    if (this.mirror) { ctx.translate(this.canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    if (!result) return;
    ctx.lineWidth = Math.max(2, this.canvas.width * 0.0018);
    ctx.strokeStyle = "#5effa1";
    for (const shape of result.formas) {
      this.line(shape.contorno, true);
      this.label(shape.rotulo, [shape.caixa[0], shape.caixa[1]]);
    }
    for (const gesture of result.gestos_duas_maos) this.line(gesture.pontos, true);
    if (!this.showPoints) return;
    if (result.rosto.presente) {
      ctx.strokeStyle = "rgba(255,255,255,.65)";
      FACE_LINES.forEach(indices => this.line(indices.map(i => result.rosto.pontos[i])));
    }
    result.maos.forEach(hand => {
      ctx.strokeStyle = "#5effa1";
      HAND_LINES.forEach(indices => this.line(indices.map(i => hand.pontos[i])));
      hand.pontos.forEach((point, index) => {
        const [x, y] = this.point(point);
        ctx.beginPath(); ctx.arc(x, y, this.canvas.width * 0.0028, 0, Math.PI * 2);
        ctx.fillStyle = [4,8,12,16,20].includes(index) ? "#ffdd57" : "#fff"; ctx.fill();
      });
      this.label(`Mão ${hand.lado.toLowerCase()} · ${hand.dedos_estendidos} dedos${hand.parcial ? " · parcial" : ""}`, hand.pontos[0]);
    });
  }
}
