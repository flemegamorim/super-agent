const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.log(JSON.stringify({ error: "No input file provided" }));
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, "utf-8");
  const { outputPath, sheets } = JSON.parse(raw);
  const sheetData = typeof sheets === "string" ? JSON.parse(sheets) : sheets;
  const resolved = path.resolve(outputPath);

  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheetData) {
    const ws = workbook.addWorksheet(sheet.name);

    if (sheet.headers && sheet.headers.length > 0) {
      ws.addRow(sheet.headers);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    }

    if (sheet.rows) {
      for (const row of sheet.rows) {
        ws.addRow(row);
      }
    }

    ws.columns.forEach((col) => {
      col.width = 18;
    });
  }

  await workbook.xlsx.writeFile(resolved);

  console.log(JSON.stringify({ success: true, outputPath: resolved }));
}

main().catch((err) => {
  console.log(JSON.stringify({ error: err.message }));
  process.exit(1);
});
