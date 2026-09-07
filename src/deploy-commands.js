import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { loadCommands } from './command-loader.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ Faltan DISCORD_TOKEN o CLIENT_ID en .env');
  process.exit(1);
}

const commands = await loadCommands();
const body = [...commands.values()].map(command => command.data.toJSON());
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

try {
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
    console.log(`✅ ${body.length} comandos registrados en el servidor ${GUILD_ID}.`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
    console.log(`✅ ${body.length} comandos registrados globalmente.`);
  }
} catch (error) {
  console.error('❌ No se pudieron registrar los comandos:', error);
  process.exit(1);
}
