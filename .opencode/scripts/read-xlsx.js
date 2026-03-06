const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const sheetIdx = args.indexOf("--sheet");
  const targetSheet = sheetIdx !== -1 ? args[sheetIdx + 1] : null;

  if (!filePath) {
    console.log(JSON.stringify({ error: "No file path provided" }));
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.log(JSON.stringify({ error: `File not found: ${resolved}` }));
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolved);

  const sheets = [];
  workbook.eachSheet((worksheet) => {
    if (targetSheet && worksheet.name !== targetSheet) return;

    const headers = [];
    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
      const values = row.values.slice(1); // ExcelJS rows are 1-indexed
      if (rowNumber === 1) {
        values.forEach((v) => headers.push(String(v ?? "")));
      } else {
        rows.push(values.map((v) => (v != null ? v : null)));
      }
    });

    sheets.push({
      name: worksheet.name,
      headers,
      rowCount: rows.length,
      rows: rows.slice(0, 500), // cap at 500 rows to avoid token overflow
    });
  });

  console.log(
    JSON.stringify({
      filename: path.basename(resolved),
      type: "xlsx",
      content: sheets,
      metadata: {
        sheetCount: workbook.worksheets.length,
        sheetNames: workbook.worksheets.map((s) => s.name),
      },
      error: null,
    }),
  );
}

main().catch((err) => {
  console.log(JSON.stringify({ error: err.message }));
  process.exit(1);
});
