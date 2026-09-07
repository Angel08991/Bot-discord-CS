import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsRoot = path.join(__dirname, 'commands');

export async function loadCommands() {
  const commands = new Map();
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
    }
  }

  walk(commandsRoot);

  for (const file of files) {
    const module = await import(pathToFileURL(file).href);
    if (!module.data || typeof module.execute !== 'function') continue;
    commands.set(module.data.name, module);
  }

  return commands;
}
