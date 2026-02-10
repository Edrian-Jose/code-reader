import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Configure Atlassian MCP server
const transport = new StdioClientTransport({
 command: "npx",
 args: ["-y", "@modelcontextprotocol/server-atlassian"],
 env: {
  ATLASSIAN_INSTANCE_URL: "https://your-domain.atlassian.net",
  ATLASSIAN_USERNAME: "your-email@example.com",
  ATLASSIAN_API_TOKEN: process.env.ATLASSIAN_API_TOKEN,
 },
});

const client = new Client(
 {
  name: "code-reader-client",
  version: "1.0.0",
 },
 {
  capabilities: {},
 },
);

await client.connect(transport);
