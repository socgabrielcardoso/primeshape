import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("ZIP estático: câmera, formas, mãos, dedos e encerramento sem backend", async ({ page }) => {
  const photo = (await readFile(new URL("./hands.jpg",import.meta.url))).toString("base64");
  const failures = [];
  page.on("pageerror",error => failures.push(error.message));
  page.on("request",request => {
    if (/127\.0\.0\.1:(8080|8765)/.test(request.url())) failures.push("Dependência indevida de backend");
  });
  await page.addInitScript(({ photo }) => {
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
  await expect(page.locator("#engineSelect")).toHaveValue("browser");
  await page.getByRole("button",{ name:"INICIAR CÂMERA", exact:true }).click();
  await expect(page.locator("#backendStatus")).toHaveText("DETECÇÃO NO NAVEGADOR",{ timeout:150000 });
  await expect(page.locator("#handCount")).toHaveText("2 DETECTADAS",{ timeout:20000 });
  await expect(page.locator("#shapeName")).toContainText("Quadrado");
  await expect(page.locator("#shapeName")).toContainText("Círculo");
  await page.getByRole("button",{ name:"DETALHES",exact:true }).click();
  await expect(page.locator("#handsDetails")).toContainText("5 dedos estendidos");
  const colors = await page.locator("#visionCanvas").evaluate(canvas => {
    const data=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;
    let green=0,yellow=0;
    for(let i=0;i<data.length;i+=4) {
      if(data[i]<130 && data[i+1]>220 && data[i+2]>120 && data[i+2]<200) green++;
      if(data[i]>240 && data[i+1]>190 && data[i+1]<240 && data[i+2]<120) yellow++;
    }
    return { green,yellow };
  });
  expect(colors.green).toBeGreaterThan(100);
  expect(colors.yellow).toBeGreaterThan(20);
  await page.getByRole("button",{ name:"Fechar detalhes",exact:true }).click();
  await page.getByRole("button",{ name:"PARAR",exact:true }).click();
  await expect(page.locator("#backendStatus")).toHaveText("PARADO");
  await expect(page.getByRole("button",{ name:"INICIAR CÂMERA",exact:true })).toBeVisible();
  expect(failures).toEqual([]);
});
