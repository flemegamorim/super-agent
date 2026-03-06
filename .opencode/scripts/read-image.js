const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log(JSON.stringify({ error: "No file path provided" }));
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.log(JSON.stringify({ error: `File not found: ${resolved}` }));
    process.exit(1);
  }

  const metadata = await sharp(resolved).metadata();
  const stats = fs.statSync(resolved);

  console.log(
    JSON.stringify({
      filename: path.basename(resolved),
      type: "image",
      content: `Image: ${metadata.width}x${metadata.height} ${metadata.format}, ${metadata.channels} channels, ${metadata.space} color space`,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        channels: metadata.channels,
        colorSpace: metadata.space,
        fileSize: stats.size,
        hasAlpha: metadata.hasAlpha,
        density: metadata.density,
      },
      error: null,
    }),
  );
}

main().catch((err) => {
  console.log(JSON.stringify({ error: err.message }));
  process.exit(1);
});
