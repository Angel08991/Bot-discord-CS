import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('about')
  .setDescription('Muestra información de CS Studios Bot.');

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  const embed = baseEmbed(config.branding, {
    title: '🤖 CS Studios Bot',
    description: [
      'Bot multifunción para comunidades de Discord.',
      '',
      '**Versión:** 1.2.0',
      '**Desarrollado por:** CS Studios',
      '',
      '🎨 Sistema visual configurable',
      '⚙️ Configuración por servidor',
      '💾 Persistencia local con SQLite',
      '🎫 Tickets + valoraciones',
      '🖼️ Imágenes y banners configurables',
      '📋 Logs y moderación',
      '🤖 AutoMod',
      '💡 Sugerencias',
      '🎉 Sorteos persistentes'
    ].join('\n'),
    timestamp: true
  });
  await interaction.reply({ embeds: [embed] });
}
