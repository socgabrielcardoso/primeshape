import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "live-server.spec.js",
  timeout: 180000,
  workers: 1,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:5500", headless: true, launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
  webServer: { command: "node server.js", port: 5500, reuseExistingServer: false }
});
