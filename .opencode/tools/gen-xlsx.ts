import { tool } from "@opencode-ai/plugin"

export default tool({
  description:
    "Generate an Excel (.xlsx) file with one or more sheets. Each sheet has headers and rows of data.",
  args: {
    outputPath: tool.schema.string().describe("Output file path for the generated Excel file"),
    sheets: tool.schema.string().describe("JSON string with sheets array: [{name, headers: string[], rows: any[][]}]"),
  },
  async execute(args, context) {
    const script = `${context.worktree}/.opencode/scripts/gen-xlsx.js`
    const inputFile = `${context.worktree}/.opencode/scripts/.tmp-xlsx-input.json`
    await Bun.write(
      inputFile,
      JSON.stringify({ outputPath: args.outputPath, sheets: args.sheets }),
    )
    const result = await Bun.$`node ${script} ${inputFile}`.text()
    await Bun.$`rm -f ${inputFile}`
    return result.trim()
  },
})
