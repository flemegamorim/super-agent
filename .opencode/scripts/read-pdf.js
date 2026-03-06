const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

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

  const buffer = fs.readFileSync(resolved);
  const data = await pdf(buffer);

  console.log(
    JSON.stringify({
      filename: path.basename(resolved),
      type: "pdf",
      content: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info,
        version: data.version,
      },
      error: null,
    }),
  );
}

main().catch((err) => {
  console.log(JSON.stringify({ error: err.message }));
  process.exit(1);
});
