import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) console.log(await page.locator("body").innerText());
});

test("Windows: vídeo contínuo, formas entre os dedos, modo leve, objetos opcionais e reinício", async ({ page }) => {
  const photo = (await readFile(new URL("./hands.jpg",import.meta.url))).toString("base64");
  const failures = [];
  const objectRequests = [];
  page.on("pageerror",error => failures.push(error.message));
  page.on("request",request => {
    if (/127\.0\.0\.1:(8080|8765)/.test(request.url())) failures.push("Dependência indevida de backend");
    if (request.url().includes("opencv")) objectRequests.push(request.url());
  });
  await page.addInitScript(({ photo }) => {
    window.processing = { frames:0,pending:0,peak:0 };
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener("message",({data})=>{
          if (data.data?.maos) { window.processing.frames++;window.processing.pending--; }
        });
      }
      postMessage(data,...args) {
        if (data.type==="frame") {
          window.processing.pending++;
          window.processing.peak=Math.max(window.processing.peak,window.processing.pending);
        }
        return super.postMessage(data,...args);
      }
    };
    navigator.mediaDevices.getUserMedia = async () => {
      const image = new Image(); image.src = "data:image/jpeg;base64," + photo; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width=640; canvas.height=480;
      const ctx=canvas.getContext("2d");
      const paint = () => {
        ctx.fillStyle="#fff";ctx.fillRect(0,0,640,480);
        ctx.drawImage(image,0,0,640,340);
        ctx.fillStyle="#111";ctx.fillRect(90,365,75,75);
        ctx.beginPath();ctx.arc(350,400,37,0,Math.PI*2);ctx.fill();
      };
      paint();
      const timer=setInterval(paint,80),stream=canvas.captureStream(12);
      const track=stream.getVideoTracks()[0],originalStop=track.stop.bind(track);
      track.stop=() => { clearInterval(timer);originalStop(); };
      return stream;
    };
  },{ photo });
  await page.goto("/index.html");
  await expect(page.locator("body")).toHaveAttribute("data-running","false");
  await expect(page.locator("#engineSelect")).toHaveValue("browser");
  await expect(page.locator("#objectsToggle")).not.toBeChecked();
  await expect(page.locator("#handShapeCatalog span")).toHaveCount(9);
  await page.getByRole("button",{ name:"INICIAR CÂMERA", exact:true }).click();
  await expect(page.locator("#backendStatus")).toHaveText("DETECÇÃO NO NAVEGADOR",{ timeout:150000 });
  await expect(page.locator("#handCount")).toHaveText("2 DETECTADAS",{ timeout:20000 });
  await expect(page.locator("#handShapeCatalog .active")).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>window.processing.frames),{timeout:20000}).toBeGreaterThanOrEqual(8);
  expect(objectRequests).toEqual([]);
  expect(await page.evaluate(()=>window.processing.peak)).toBe(1);
  await page.getByRole("button",{ name:"DETALHES",exact:true }).click();
  await expect(page.locator("#handsDetails")).toContainText("5 dedos estendidos");
  const colors = await page.locator("#visionCanvas").evaluate(canvas => {
    const data=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;
    let fill=0,tips=0,transparent=0;
    for(let i=0;i<data.length;i+=4) {
      if(data[i]<100 && data[i+1]>140 && data[i+2]>210 && data[i+3]>30 && data[i+3]<80) fill++;
      if(data[i]>170 && data[i+1]>235 && data[i+2]>240 && data[i+3]>220) tips++;
      if(data[i+3]===0) transparent++;
    }
    return { fill,tips,transparent,total:data.length/4 };
  });
  expect(colors.fill).toBeGreaterThan(200);
  expect(colors.tips).toBeGreaterThan(50);
  expect(colors.transparent).toBeGreaterThan(colors.total/2);
  await page.locator("#objectsToggle").check();
  await expect(page.locator("#shapesList")).toContainText("Quadrado",{timeout:60000});
  await expect(page.locator("#shapesList")).toContainText("Círculo");
  expect(objectRequests.length).toBeGreaterThan(0);
  await page.getByRole("button",{ name:"Fechar detalhes",exact:true }).click();
  await page.getByRole("button",{ name:"PARAR",exact:true }).click();
  await expect(page.locator("#backendStatus")).toHaveText("PARADO");
  await expect(page.getByRole("button",{ name:"INICIAR CÂMERA",exact:true })).toBeVisible();
  await page.getByRole("button",{ name:"DETALHES",exact:true }).click();
  await page.locator("#objectsToggle").uncheck();
  await page.getByRole("button",{ name:"Fechar detalhes",exact:true }).click();
  await page.getByRole("button",{ name:"INICIAR CÂMERA",exact:true }).click();
  await expect(page.locator("#handCount")).toHaveText("2 DETECTADAS",{timeout:30000});
  await page.getByRole("button",{ name:"PARAR",exact:true }).click();
  await expect(page.locator("#backendStatus")).toHaveText("PARADO");
  expect(failures).toEqual([]);
});
