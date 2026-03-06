import { tool } from "@opencode-ai/plugin"

export default tool({
  description:
    "Generate or process an image file. Can create charts/diagrams from data or resize/convert existing images.",
  args: {
    outputPath: tool.schema.string().describe("Output file path for the generated image"),
    operation: tool.schema
      .enum(["chart", "resize", "convert", "composite"])
      .describe("Operation type: chart (bar/line/pie from data), resize, convert format, or composite"),
    config: tool.schema.string().describe("JSON string with operation-specific config"),
  },
  async execute(args, context) {
    const script = `${context.worktree}/.opencode/scripts/gen-image.js`
    const inputFile = `${context.worktree}/.opencode/scripts/.tmp-image-input.json`
    await Bun.write(
      inputFile,
      JSON.stringify({ outputPath: args.outputPath, operation: args.operation, config: args.config }),
    )
    const result = await Bun.$`node ${script} ${inputFile}`.text()
    await Bun.$`rm -f ${inputFile}`
    return result.trim()
  },
})
