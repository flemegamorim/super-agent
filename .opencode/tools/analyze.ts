import { tool } from "@opencode-ai/plugin"

export default tool({
  description:
    "Run analysis on extracted data. Accepts a JSON string of extracted file data and an analysis prompt. Returns analysis results as JSON.",
  args: {
    data: tool.schema.string().describe("JSON string containing the extracted data to analyze"),
    prompt: tool.schema.string().describe("Analysis instructions — what to look for or compute"),
  },
  async execute(args, context) {
    const script = `${context.worktree}/.opencode/scripts/analyze.js`
    const inputFile = `${context.worktree}/.opencode/scripts/.tmp-analysis-input.json`
    await Bun.write(inputFile, JSON.stringify({ data: args.data, prompt: args.prompt }))
    const result = await Bun.$`node ${script} ${inputFile}`.text()
    await Bun.$`rm -f ${inputFile}`
    return result.trim()
  },
})
