import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';
import { baseEmbed } from '../../utils/embeds.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Muestra la configuración resumida del bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  const modules = Object.entries(config.modules ?? {})
    .map(([name, enabled]) => `${enabled ? '🟢' : '🔴'} ${name}`)
    .join('\n');

  const embed = baseEmbed(config.branding, {
    title: '⚙️ Configuración actual',
    description: `**Branding**\nNombre: ${config.branding?.name}\nColor: ${config.branding?.color}\n\n**Módulos**\n${modules}`
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
