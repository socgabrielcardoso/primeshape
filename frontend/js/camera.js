export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.captureCanvas = document.createElement("canvas");
    this.captureContext = this.captureCanvas.getContext("2d", { alpha: false });
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      throw new Error("Abra index.html pelo Live Server em localhost ou 127.0.0.1.");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  pixels() {
    const width = Math.min(640, this.video.videoWidth);
    const height = Math.round(this.video.videoHeight * width / this.video.videoWidth);
    if (!width || !height || this.video.readyState < 2) return null;
    if (this.captureCanvas.width !== width || this.captureCanvas.height !== height) {
      this.captureCanvas.width = width;
      this.captureCanvas.height = height;
    }
    this.captureContext.drawImage(this.video, 0, 0, width, height);
    return this.captureContext.getImageData(0, 0, width, height);
  }

  capture() {
    if (!this.pixels()) return Promise.resolve(null);
    return new Promise(resolve => this.captureCanvas.toBlob(resolve, "image/jpeg", 0.85));
  }

  stop() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
