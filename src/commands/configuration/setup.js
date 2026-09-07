import { PermissionFlagsBits, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';
import { baseEmbed } from '../../utils/embeds.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Abre el configurador principal de CS Studios Bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  const enabledCount = Object.values(config.modules ?? {}).filter(Boolean).length;
  const totalCount = Object.keys(config.modules ?? {}).length;

  const embed = baseEmbed(config.branding, {
    title: '⚙️ Configuración — CS Studios Bot',
    description: [
      'Selecciona un área para configurar.',
      '',
      `**Módulos activos:** ${enabledCount}/${totalCount}`,
      `**Color:** ${config.branding?.color ?? '#8B5CF6'}`,
      `**Footer:** ${config.branding?.footer ?? 'Bot desarrollado por CS Studios'}`
    ].join('\n')
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('cs_setup_menu')
    .setPlaceholder('Selecciona una categoría...')
    .addOptions([
      { label: 'Branding', value: 'branding', emoji: '🎨' },
      { label: 'Bienvenidas', value: 'welcome', emoji: '👋' },
      { label: 'Despedidas', value: 'goodbye', emoji: '🚪' },
      { label: 'Logs', value: 'logs', emoji: '📋' },
      { label: 'Tickets', value: 'ticket', emoji: '🎫' },
      { label: 'Moderación', value: 'moderation', emoji: '🛡️' },
      { label: 'Staff', value: 'staff', emoji: '👮' },
      { label: 'Módulos', value: 'modules', emoji: '🧩' },
      { label: 'Sugerencias', value: 'suggestions', emoji: '💡' },
      { label: 'Sorteos', value: 'giveaways', emoji: '🎉' },
      { label: 'Niveles', value: 'levels', emoji: '⭐' },
      { label: 'Economía', value: 'economy', emoji: '💰' },
      { label: 'Autoroles', value: 'autoroles', emoji: '🎭' },
      { label: 'Encuestas', value: 'polls', emoji: '📊' },
      { label: 'Recordatorios', value: 'reminders', emoji: '⏰' },
      { label: 'AFK', value: 'afk', emoji: '💤' },
      { label: 'Anti-Raid', value: 'raid', emoji: '🚨' }
    ]);

  await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
}
