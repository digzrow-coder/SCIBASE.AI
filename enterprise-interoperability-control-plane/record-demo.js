"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const outputPath = path.join(__dirname, "..", "enterprise-interoperability-control-plane-demo.mp4");
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
  await page.getByRole("button", { name: "Build Admin Dashboard" }).click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Evaluate Compliance" }).click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Create Signed Webhooks" }).click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Build Export Packages" }).click();
  await page.waitForTimeout(3000);
  const webmPath = await page.video().path();
  await context.close();
  await browser.close();
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  execFileSync("ffmpeg", [
    "-y",
    "-i",
    webmPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  console.log(`Recorded ${outputPath}`);
})();
