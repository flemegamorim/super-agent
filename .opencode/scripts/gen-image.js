const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.log(JSON.stringify({ error: "No input file provided" }));
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, "utf-8");
  const { outputPath, operation, config } = JSON.parse(raw);
  const cfg = typeof config === "string" ? JSON.parse(config) : config;
  const resolved = path.resolve(outputPath);

  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  switch (operation) {
    case "resize": {
      await sharp(path.resolve(cfg.inputPath))
        .resize(cfg.width, cfg.height, { fit: cfg.fit || "inside" })
        .toFile(resolved);
      break;
    }

    case "convert": {
      const img = sharp(path.resolve(cfg.inputPath));
      const format = cfg.format || path.extname(resolved).slice(1);
      await img.toFormat(format).toFile(resolved);
      break;
    }

    case "chart": {
      const width = cfg.width || 800;
      const height = cfg.height || 600;
      const padding = 60;
      const chartW = width - padding * 2;
      const chartH = height - padding * 2;
      const values = cfg.values || [];
      const labels = cfg.labels || values.map((_, i) => `Item ${i + 1}`);
      const maxVal = Math.max(...values, 1);
      const barWidth = Math.floor(chartW / values.length) - 4;

      let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
      svg += `<rect width="${width}" height="${height}" fill="white"/>`;
      if (cfg.title) {
        svg += `<text x="${width / 2}" y="30" text-anchor="middle" font-size="18" font-family="sans-serif">${cfg.title}</text>`;
      }

      values.forEach((v, i) => {
        const barH = (v / maxVal) * chartH;
        const x = padding + i * (barWidth + 4);
        const y = padding + chartH - barH;
        const colors = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
        const color = colors[i % colors.length];
        svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="2"/>`;
        svg += `<text x="${x + barWidth / 2}" y="${padding + chartH + 16}" text-anchor="middle" font-size="10" font-family="sans-serif">${labels[i]}</text>`;
        svg += `<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-size="10" font-family="sans-serif">${v}</text>`;
      });

      svg += `</svg>`;

      await sharp(Buffer.from(svg)).png().toFile(resolved);
      break;
    }

    case "composite": {
      const base = sharp(path.resolve(cfg.basePath));
      const composites = (cfg.layers || []).map((layer) => ({
        input: path.resolve(layer.path),
        top: layer.top || 0,
        left: layer.left || 0,
      }));
      await base.composite(composites).toFile(resolved);
      break;
    }

    default:
      console.log(JSON.stringify({ error: `Unknown operation: ${operation}` }));
      process.exit(1);
  }

  console.log(JSON.stringify({ success: true, outputPath: resolved }));
}

main().catch((err) => {
  console.log(JSON.stringify({ error: err.message }));
  process.exit(1);
});
