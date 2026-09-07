import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';
import { baseEmbed } from '../../utils/embeds.js';
import { createGiveaway } from '../../database/database.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Crea y gestiona sorteos.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName('create').setDescription('Crea un sorteo.')
    .addStringOption(o => o.setName('premio').setDescription('Premio.').setRequired(true).setMaxLength(200))
    .addIntegerOption(o => o.setName('minutos').setDescription('Duración.').setRequired(true).setMinValue(1).setMaxValue(43200))
    .addIntegerOption(o => o.setName('ganadores').setDescription('Número de ganadores.').setRequired(false).setMinValue(1).setMaxValue(20)));

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  if (!config.modules?.giveaways || !config.giveaways?.enabled) return interaction.reply({ content: '❌ Los sorteos están desactivados.', ephemeral: true });
  const prize = interaction.options.getString('premio', true);
  const minutes = interaction.options.getInteger('minutos', true);
  const winners = interaction.options.getInteger('ganadores') ?? config.giveaways.defaultWinners ?? 1;
  const endsAt = Date.now() + minutes * 60_000;
  const embed = baseEmbed(config.branding, {
    title: '🎉 ¡SORTEO!',
    description: `🏆 **Premio:** ${prize}\n👑 **Ganadores:** ${winners}\n⏰ **Finaliza:** <t:${Math.floor(endsAt / 1000)}:R>\n\nPulsa el botón para participar.`,
    timestamp: true
  });
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cs_giveaway_join').setLabel('Participar').setStyle(ButtonStyle.Success).setEmoji('🎉'));
  const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
  createGiveaway({ guildId: interaction.guildId, channelId: interaction.channelId, messageId: msg.id, hostId: interaction.user.id, prize, winners, endsAt });
  await interaction.reply({ content: '✅ Sorteo creado correctamente.', ephemeral: true });
}
