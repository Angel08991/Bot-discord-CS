import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Comprueba la latencia del bot.');

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  const sent = await interaction.reply({ content: '🏓 Midiendo...', fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const ws = Math.round(interaction.client.ws.ping);
  const embed = baseEmbed(config.branding, {
    title: '🏓 Pong!',
    description: `**Bot:** ${latency}ms\n**Gateway:** ${ws}ms`,
    timestamp: true
  });
  return interaction.editReply({ content: '', embeds: [embed] });
}
