import { tool } from "@opencode-ai/plugin"

export default tool({
  description:
    "Read and extract data from an Excel (.xlsx) file. Returns sheet names, headers, and row data as JSON.",
  args: {
    filePath: tool.schema.string().describe("Absolute or relative path to the Excel file"),
    sheetName: tool.schema.string().optional().describe("Specific sheet name to read. If omitted, reads all sheets."),
  },
  async execute(args, context) {
    const script = `${context.worktree}/.opencode/scripts/read-xlsx.js`
    const sheetArg = args.sheetName ? `--sheet "${args.sheetName}"` : ""
    const result = await Bun.$`node ${script} ${args.filePath} ${sheetArg}`.text()
    return result.trim()
  },
})
