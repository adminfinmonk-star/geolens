export {
  listPlannedTools,
  listSlashCommands,
  callMcpTool,
  MCP_TOOLS,
  MCP_SLASH_COMMANDS,
} from "./tools.js";

import { listPlannedTools, listSlashCommands } from "./tools.js";

async function main() {
  console.log(
    JSON.stringify(
      {
        tools: listPlannedTools(),
        slash_commands: listSlashCommands(),
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js")
) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
