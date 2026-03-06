import { tool } from "@opencode-ai/plugin"

export default tool({
  description:
    "Generate a PDF file with the given content. Supports title, sections with text, and simple tables.",
  args: {
    outputPath: tool.schema.string().describe("Output file path for the generated PDF"),
    title: tool.schema.string().describe("Document title"),
    content: tool.schema.string().describe("JSON string with sections array: [{heading, text?, table?: {headers, rows}}]"),
  },
  async execute(args, context) {
    const script = `${context.worktree}/.opencode/scripts/gen-pdf.js`
    const inputFile = `${context.worktree}/.opencode/scripts/.tmp-pdf-input.json`
    await Bun.write(
      inputFile,
      JSON.stringify({ outputPath: args.outputPath, title: args.title, content: args.content }),
    )
    const result = await Bun.$`node ${script} ${inputFile}`.text()
    await Bun.$`rm -f ${inputFile}`
    return result.trim()
  },
})
