import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getGuildConfig, saveGuildConfig, createSuggestion, getSuggestionByMessage, updateSuggestionStatus } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';
import { baseEmbed } from '../../utils/embeds.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('suggestion')
  .setDescription('Sistema de sugerencias de la comunidad.')
  .addSubcommand(s => s.setName('panel').setDescription('Publica el panel para enviar sugerencias.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild))
  .addSubcommand(s => s.setName('config').setDescription('Configura el canal de sugerencias.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('canal').setDescription('Canal donde se publicarán.').setRequired(true)))
  .addSubcommand(s => s.setName('status').setDescription('Cambia el estado de una sugerencia.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('mensaje').setDescription('ID del mensaje de la sugerencia.').setRequired(true))
    .addStringOption(o => o.setName('estado').setDescription('Nuevo estado.').setRequired(true).addChoices(
      { name: '🟡 Pendiente', value: 'pending' }, { name: '🟢 Aprobada', value: 'approved' }, { name: '🔴 Rechazada', value: 'rejected' }, { name: '🔵 Implementada', value: 'implemented' }
    )));

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  if (!config.modules?.suggestions || !config.suggestions?.enabled) return interaction.reply({ content: '❌ Las sugerencias están desactivadas.', ephemeral: true });
  const sub = interaction.options.getSubcommand();
  if (sub === 'config') {
    const channel = interaction.options.getChannel('canal', true);
    if (!channel.isTextBased()) return interaction.reply({ content: '❌ Ese canal no admite mensajes.', ephemeral: true });
    config.suggestions.channelId = channel.id;
    saveGuildConfig(interaction.guildId, config);
    return interaction.reply({ content: `✅ Canal de sugerencias configurado en ${channel}.`, ephemeral: true });
  }
  if (sub === 'panel') {
    const target = config.suggestions.channelId ? interaction.guild.channels.cache.get(config.suggestions.channelId) : interaction.channel;
    if (!target?.isTextBased()) return interaction.reply({ content: '❌ El canal configurado no es válido.', ephemeral: true });
    const embed = baseEmbed(config.branding, {
      title: '💡 Sugerencias de la comunidad',
      description: '¿Tienes una idea para mejorar el servidor? Pulsa el botón de abajo y cuéntanosla.\n\nCada sugerencia podrá recibir votos y una respuesta del equipo.',
      timestamp: true
    });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cs_suggestion_new').setLabel('Enviar sugerencia').setStyle(ButtonStyle.Primary).setEmoji('💡'));
    await target.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: `✅ Panel publicado en ${target}.`, ephemeral: true });
  }
  const messageId = interaction.options.getString('mensaje', true);
  const status = interaction.options.getString('estado', true);
  const suggestion = getSuggestionByMessage(messageId);
  if (!suggestion) return interaction.reply({ content: '❌ No encontré una sugerencia con ese ID de mensaje.', ephemeral: true });
  updateSuggestionStatus(messageId, status);
  const channel = interaction.guild.channels.cache.get(suggestion.channel_id);
  const msg = await channel?.messages.fetch(messageId).catch(() => null);
  if (msg) {
    const newEmbed = baseEmbed(config.branding, { title: `💡 Sugerencia #${suggestion.id}`, description: `👤 <@${suggestion.user_id}>\n\n${suggestion.content}\n\n**Estado:** ${statusMap[status]}`, timestamp: true });
    await msg.edit({ embeds: [newEmbed] });
  }
  return interaction.reply({ content: `✅ Estado actualizado a **${statusMap(status)}**.`, ephemeral: true });
}

function statusMap(status) {
  return ({ pending: '🟡 Pendiente', approved: '🟢 Aprobada', rejected: '🔴 Rechazada', implemented: '🔵 Implementada' })[status] ?? status;
}

export async function handleSuggestionModal(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  const content = interaction.fields.getTextInputValue('content').trim();
  if (!content) return interaction.reply({ content: '❌ La sugerencia no puede estar vacía.', ephemeral: true });
  const channelId = config.suggestions.channelId || interaction.channelId;
  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return interaction.reply({ content: '❌ El canal de sugerencias no es válido.', ephemeral: true });
  const embed = baseEmbed(config.branding, {
    title: '💡 Nueva sugerencia',
    description: `👤 **Autor:** ${config.suggestions.allowAnonymous ? 'Anónimo' : `<@${interaction.user.id}>`}\n\n${content}\n\n🟡 **Estado:** Pendiente`,
    timestamp: true
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cs_suggestion_up').setStyle(ButtonStyle.Success).setLabel('Aprobar / 👍').setEmoji('👍'),
    new ButtonBuilder().setCustomId('cs_suggestion_down').setStyle(ButtonStyle.Danger).setLabel('Rechazar / 👎').setEmoji('👎')
  );
  const msg = await channel.send({ embeds: [embed], components: [row] });
  createSuggestion({ guildId: interaction.guildId, channelId: channel.id, messageId: msg.id, userId: interaction.user.id, content });
  await interaction.reply({ content: '✅ Tu sugerencia ha sido enviada.', ephemeral: true });
}

export function buildSuggestionModal() {
  return new ModalBuilder().setCustomId('cs_modal_suggestion').setTitle('💡 Nueva sugerencia')
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('content').setLabel('¿Qué propones?').setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1800).setRequired(true)));
}
