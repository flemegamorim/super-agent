const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.log(JSON.stringify({ error: "No input file provided" }));
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, "utf-8");
  const { outputPath, title, content } = JSON.parse(raw);
  const sections = typeof content === "string" ? JSON.parse(content) : content;
  const resolved = path.resolve(outputPath);

  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(resolved);
  doc.pipe(stream);

  doc.fontSize(24).text(title, { align: "center" });
  doc.moveDown(2);

  for (const section of sections) {
    if (section.heading) {
      doc.fontSize(16).text(section.heading);
      doc.moveDown(0.5);
    }

    if (section.text) {
      doc.fontSize(11).text(section.text);
      doc.moveDown(1);
    }

    if (section.table) {
      const { headers, rows } = section.table;
      const colWidth = (doc.page.width - 100) / headers.length;

      doc.fontSize(10);
      headers.forEach((h, i) => {
        doc.text(h, 50 + i * colWidth, doc.y, {
          width: colWidth,
          continued: i < headers.length - 1,
        });
      });
      doc.moveDown(0.5);

      for (const row of rows) {
        const y = doc.y;
        if (y > doc.page.height - 100) {
          doc.addPage();
        }
        row.forEach((cell, i) => {
          doc.text(String(cell ?? ""), 50 + i * colWidth, doc.y, {
            width: colWidth,
            continued: i < row.length - 1,
          });
        });
        doc.moveDown(0.3);
      }
      doc.moveDown(1);
    }
  }

  doc.end();

  await new Promise((resolve) => stream.on("finish", resolve));

  console.log(JSON.stringify({ success: true, outputPath: resolved }));
}

main().catch((err) => {
  console.log(JSON.stringify({ error: err.message }));
  process.exit(1);
});
