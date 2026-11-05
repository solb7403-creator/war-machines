# Claude Code — LUNAR: War Machines

Read and follow [AGENTS.md](AGENTS.md) as the **canonical shared engineering instructions** for Claude Code and Codex. Consult [docs/AI_TOOLCHAIN.md](docs/AI_TOOLCHAIN.md) for tools, ownership boundaries, branch/PR handoff, and the graphics asset pipeline.

Use the existing repository and current branch as the source of truth. Do not infer that Graphify or REA is configured unless their tools respond successfully. Do not merge/deploy, change game economy, or modify another agent's working branch without explicit owner approval. Prefer narrow source reads and focused validation to save tokens; do not silently replace project architecture.

## Hosted Graphify MCP (project-scoped)

The repository's `.mcp.json` declares the hosted Graphify MCP endpoint (`https://api.graphify.com/mcp`). On first use, authorize Graphify via the Claude Code OAuth prompt if requested; configuration does **not** bypass user sign-in. Check `list_repositories`/`graph_stats` to confirm `solb7403-creator/war-machines` is indexed and to compare the indexed commit with your working branch. For substantial code changes, use the graph to identify relevant files, callers, dependencies and linked tests before expensive whole-file reads. Fall back to current source if Graphify tools are unavailable; treat static graph relationships as guidance, not runtime verification. Never commit tokens or OAuth credentials.
