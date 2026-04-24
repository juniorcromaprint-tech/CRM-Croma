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

// Forca stdout do processo atual para UTF-8 (evita conversao de codepage no Windows)
if (process.stdout.isTTY === false || !process.stdout.isTTY) {
  // Pipe mode: garante que Buffer UTF-8 seja escrito sem conversao
  process.stdout.setDefaultEncoding('utf8');
}

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

// Acumula bytes brutos — NAO converte para string ainda (evita corrupcao de encoding)
let stdoutBuf = Buffer.alloc(0);

server.stdout.on('data', (data) => {
  // data e um Buffer — acumula como bytes
  stdoutBuf = Buffer.concat([stdoutBuf, data]);
  
  // Decodifica como UTF-8 para checar se chegou o JSON completo
  const text = stdoutBuf.toString('utf8');
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed.id === 2) {
          if (parsed.result && parsed.result.content) {
            for (const c of parsed.result.content) {
              if (c.type === 'text') {
                // c.text e uma string JS (UTF-16 internamente) — escreve como UTF-8 no pipe
                const outBuf = Buffer.from(c.text + '\n', 'utf8');
                process.stdout.write(outBuf);
              }
            }
          } else if (parsed.error) {
            process.stderr.write('ERROR: ' + JSON.stringify(parsed.error) + '\n');
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
  process.stderr.write('Timeout after 30s\n');
  server.kill();
  process.exit(1);
}, 30000);
