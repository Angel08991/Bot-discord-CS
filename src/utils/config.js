import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = path.resolve(process.cwd());
const defaultsPath = path.join(root, 'config', 'defaults.yml');

export function loadDefaults() {
  const raw = fs.readFileSync(defaultsPath, 'utf8');
  return yaml.load(raw);
}
