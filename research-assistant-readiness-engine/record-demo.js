"use strict";

const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: path.join(__dirname, "demo-video"),
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  await page.goto(`file://${path.join(__dirname, "demo.html").replace(/\\/g, "/")}`);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Run Peer Review" }).click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Check Reproducibility" }).click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Find Research Gaps" }).click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Build Digest" }).click();
  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
