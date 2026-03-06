const fs = require("fs");

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.log(JSON.stringify({ error: "No input file provided" }));
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, "utf-8");
  const { data, prompt } = JSON.parse(raw);
  const parsed = typeof data === "string" ? JSON.parse(data) : data;

  const result = {
    inputSummary: `Analyzed ${Array.isArray(parsed) ? parsed.length : 1} data item(s)`,
    prompt,
    data: parsed,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.log(JSON.stringify({ error: err.message }));
  process.exit(1);
});
