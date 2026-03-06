import { tool } from "@opencode-ai/plugin"

export default tool({
  description:
    "Read and extract text content from a PDF file. Returns the full text and metadata (page count, info).",
  args: {
    filePath: tool.schema.string().describe("Absolute or relative path to the PDF file"),
  },
  async execute(args, context) {
    const script = `${context.worktree}/.opencode/scripts/read-pdf.js`
    const result = await Bun.$`node ${script} ${args.filePath}`.text()
    return result.trim()
  },
})
