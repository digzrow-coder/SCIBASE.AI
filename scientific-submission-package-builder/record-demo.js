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
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Create Workspace" }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Add Required Artifacts" }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Build Review Package" }).click();
  await page.waitForTimeout(1800);
  await context.close();
  await browser.close();
})();
