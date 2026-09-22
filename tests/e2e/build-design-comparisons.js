const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const sourceDark = process.env.PATHFINDER_SOURCE_DARK;
const sourceLight = process.env.PATHFINDER_SOURCE_LIGHT;
if (!sourceDark || !sourceLight) {
  throw new Error("PATHFINDER_SOURCE_DARK and PATHFINDER_SOURCE_LIGHT are required");
}

const outputDir = path.resolve(process.cwd(), "docs", "design-qa");

async function normalize(input, width, height) {
  return sharp(input).resize(width, height, { fit: "cover", position: "top" }).png().toBuffer();
}

async function cropAndNormalize(input, extract, width, height) {
  return sharp(input).extract(extract).resize(width, height, { fit: "fill" }).png().toBuffer();
}

async function join(left, right, output, width, height, gap = 20) {
  await sharp({
    create: {
      width: width * 2 + gap,
      height,
      channels: 4,
      background: { r: 20, g: 22, b: 27, alpha: 1 },
    },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: width + gap, top: 0 },
    ])
    .png()
    .toFile(path.join(outputDir, output));
}

async function buildTheme(theme, sourcePath) {
  const implementationPath = path.join(outputDir, `implementation-home-${theme}-1440.png`);
  const sourceFull = await normalize(sourcePath, 1440, 1024);
  const implementationFull = await normalize(implementationPath, 1440, 1024);
  await join(sourceFull, implementationFull, `comparison-home-${theme}.png`, 1440, 1024);

  const sourceCenter = await cropAndNormalize(
    sourcePath,
    { left: 174, top: 70, width: 930, height: 750 },
    930,
    750,
  );
  const implementationCenter = await cropAndNormalize(
    implementationPath,
    { left: 182, top: 72, width: 885, height: 750 },
    930,
    750,
  );
  await join(sourceCenter, implementationCenter, `comparison-home-${theme}-center.png`, 930, 750);

  const sourceAssistant = await cropAndNormalize(
    sourcePath,
    { left: 1095, top: 70, width: 392, height: 860 },
    392,
    860,
  );
  const implementationAssistant = await cropAndNormalize(
    implementationPath,
    { left: 1067, top: 72, width: 373, height: 860 },
    392,
    860,
  );
  await join(sourceAssistant, implementationAssistant, `comparison-home-${theme}-assistant.png`, 392, 860);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await buildTheme("dark", sourceDark);
  await buildTheme("light", sourceLight);
  process.stdout.write(`Design comparison images written to ${outputDir}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
