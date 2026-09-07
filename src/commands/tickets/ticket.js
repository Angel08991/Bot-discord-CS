import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ChannelType
} from 'discord.js';
import { getGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';
import { baseEmbed } from '../../utils/embeds.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Gestiona el sistema de tickets de CS Studios Bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('panel')
    .setDescription('Publica el panel de tickets en este canal.'));

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  if (!config.modules?.tickets || !config.ticket?.enabled) {
    return interaction.reply({ content: '❌ El sistema de tickets está desactivado en este servidor.', ephemeral: true });
  }

  const embed = baseEmbed(config.branding, {
    title: config.ticket.panelTitle || '🎫 Centro de Soporte',
    description: config.ticket.panelDescription || 'Selecciona una categoría para abrir un ticket.',
    image: config.ticket.image || undefined,
    thumbnail: config.ticket.thumbnail || undefined,
    timestamp: true
  }).addFields({
    name: '📌 Información',
    value: 'No abras tickets duplicados. Usa la categoría que mejor describa tu solicitud.'
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('cs_ticket_category')
    .setPlaceholder('🎫 Selecciona una categoría...')
    .addOptions(
      Object.entries(config.ticket.categories ?? defaults.ticket.categories).map(([value, label]) => ({
        label: String(label).replace(/^\S+\s/, '').slice(0, 100) || value,
        value,
        emoji: String(label).match(/^\S+/)?.[0] || '🎫',
        description: `Abrir un ticket de ${value}`.slice(0, 100)
      }))
    );

  const row = new ActionRowBuilder().addComponents(menu);
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ Panel de tickets publicado correctamente.', ephemeral: true });
}
