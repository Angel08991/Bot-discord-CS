import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, saveGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('setup-ticket')
  .setDescription('Configura rápidamente el sistema de tickets.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption(option => option
    .setName('categoria')
    .setDescription('Categoría de Discord donde se crearán los tickets.')
    .addChannelTypes(4)
    .setRequired(true))
  .addRoleOption(option => option
    .setName('staff')
    .setDescription('Rol que tendrá acceso a los tickets.')
    .setRequired(false));

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  config.ticket ??= structuredClone(defaults.ticket);
  config.ticket.enabled = true;
  config.ticket.categoryId = interaction.options.getChannel('categoria').id;
  config.ticket.supportRoleId = interaction.options.getRole('staff')?.id || config.ticket.supportRoleId || '';
  config.modules.tickets = true;
  saveGuildConfig(interaction.guildId, config);

  await interaction.reply({
    content: `✅ Tickets configurados.\n📁 Categoría: <#${config.ticket.categoryId}>\n👮 Staff: ${config.ticket.supportRoleId ? `<@&${config.ticket.supportRoleId}>` : 'administradores del servidor'}`,
    ephemeral: true
  });
}
