/**
 * Bridge Cowork → MCP Server Croma
 * Permite ao Claude no Cowork chamar ferramentas croma_* via Desktop Commander
 *
 * Uso: node call-tool.cjs <tool_name> [json_args]
 * Exemplo: node call-tool.cjs croma_health_check
 * Exemplo: node call-tool.cjs croma_listar_leads {"status":"novo","limit":5}
 */
const { spawn } = require('child_process');
const path = require('path');

const toolName = process.argv[2];

// Suporta duas formas de passar JSON:
// 1. Via variável de ambiente CROMA_ARGS (mais seguro, sem problemas com espaços no CMD)
//    Uso: set CROMA_ARGS={"busca": "valor com espacos"} && croma.cmd croma_listar_clientes
// 2. Via argumentos diretos (join de todos os args após o tool name)
//    Uso: croma.cmd croma_listar_clientes {"busca":"semEspacos"}
const rawArgs = process.env.CROMA_ARGS || process.argv.slice(3).join(' ');
let toolArgs = {};
if (rawArgs.trim()) {
  try {
    toolArgs = JSON.parse(rawArgs);
  } catch (e) {
    console.error('Erro ao parsear argumentos JSON:', e.message);
    console.error('Recebido:', rawArgs);
    console.error('Dica: use CROMA_ARGS para JSON com espacos: set CROMA_ARGS={"chave": "valor"} && croma.cmd <tool>');
    process.exit(1);
  }
}

if (!toolName) {
  console.error('Uso: node call-tool.cjs <tool_name> [json_args]');
  process.exit(1);
}

const serverPath = path.join(__dirname, 'dist', 'index.js');

const nodeExe = process.execPath;  // usa o mesmo node.exe que está rodando este script
const server = spawn(nodeExe, [serverPath], {
  env: {
    ...process.env,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_USER_EMAIL: process.env.SUPABASE_USER_EMAIL || 'junior@cromaprint.com.br',
    SUPABASE_USER_PASSWORD: process.env.SUPABASE_USER_PASSWORD,
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stdout = '';

server.stdout.on('data', (data) => {
  stdout += data.toString();
  const lines = stdout.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed.id === 2) {
          if (parsed.result && parsed.result.content) {
            for (const c of parsed.result.content) {
              if (c.type === 'text') console.log(c.text);
            }
          } else if (parsed.error) {
            console.error('ERROR:', JSON.stringify(parsed.error));
          }
          server.kill();
          process.exit(0);
        }
      } catch (e) { /* not complete JSON yet */ }
    }
  }
});

server.stderr.on('data', () => {}); // suppress stderr

// MCP protocol: initialize then call
setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'croma-cowork-bridge', version: '1.0.0' }
    }
  }) + '\n');
  setTimeout(() => {
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: toolName, arguments: toolArgs }
    }) + '\n');
  }, 2000);
}, 1000);

setTimeout(() => {
  console.error('Timeout after 30s');
  server.kill();
  process.exit(1);
}, 30000);
