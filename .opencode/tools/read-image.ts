import { tool } from "@opencode-ai/plugin"

export default tool({
  description:
    "Read image file metadata and optionally extract text via OCR-like description. Returns dimensions, format, size, and content description.",
  args: {
    filePath: tool.schema.string().describe("Absolute or relative path to the image file"),
  },
  async execute(args, context) {
    const script = `${context.worktree}/.opencode/scripts/read-image.js`
    const result = await Bun.$`node ${script} ${args.filePath}`.text()
    return result.trim()
  },
})
