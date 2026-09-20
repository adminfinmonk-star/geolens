export {
  listPlannedTools,
  listSlashCommands,
  callMcpTool,
  MCP_TOOLS,
  MCP_SLASH_COMMANDS,
} from "./tools.js";

import { listPlannedTools, listSlashCommands } from "./tools.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
