import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, saveGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';
import { baseEmbed } from '../../utils/embeds.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Configura la protección automática de CS Studios Bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName('status').setDescription('Muestra la configuración actual.'))
  .addSubcommand(s => s.setName('toggle').setDescription('Activa o desactiva AutoMod.')
    .addBooleanOption(o => o.setName('activo').setDescription('¿Activar AutoMod?').setRequired(true)))
  .addSubcommand(s => s.setName('antiinvite').setDescription('Activa/desactiva el bloqueo de invitaciones.')
    .addBooleanOption(o => o.setName('activo').setDescription('¿Activarlo?').setRequired(true)))
  .addSubcommand(s => s.setName('antilink').setDescription('Activa/desactiva el bloqueo de enlaces.')
    .addBooleanOption(o => o.setName('activo').setDescription('¿Activarlo?').setRequired(true)))
  .addSubcommand(s => s.setName('caps').setDescription('Configura el porcentaje máximo de mayúsculas.')
    .addIntegerOption(o => o.setName('porcentaje').setDescription('0 desactiva.').setRequired(true).setMinValue(0).setMaxValue(100)))
  .addSubcommand(s => s.setName('mentions').setDescription('Configura el máximo de menciones por mensaje.')
    .addIntegerOption(o => o.setName('maximo').setDescription('0 desactiva.').setRequired(true).setMinValue(0).setMaxValue(50)))
  .addSubcommand(s => s.setName('ignore-channel').setDescription('Agrega o quita un canal ignorado.')
    .addChannelOption(o => o.setName('canal').setDescription('Canal.').setRequired(true)));

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  if (!config.modules?.automod && interaction.options.getSubcommand() !== 'status') config.modules.automod = true;
  const sub = interaction.options.getSubcommand();
  const a = config.automod;
  if (sub === 'status') {
    const ignored = a.ignoredChannelIds?.length ? a.ignoredChannelIds.map(id => `<#${id}>`).join(', ') : 'Ninguno';
    return interaction.reply({ embeds: [baseEmbed(config.branding, { title: '🤖 Estado de AutoMod', description: [
      `${a.enabled ? '🟢' : '🔴'} **AutoMod:** ${a.enabled ? 'Activo' : 'Inactivo'}`,
      `${a.antiInvite ? '🟢' : '🔴'} **Anti-invitaciones:** ${a.antiInvite ? 'Activo' : 'Inactivo'}`,
      `${a.antiLink ? '🟢' : '🔴'} **Anti-links:** ${a.antiLink ? 'Activo' : 'Inactivo'}`,
      `🔤 **Mayúsculas:** ${a.capsPercent}%`,
      `📣 **Menciones máximas:** ${a.maxMentions}`,
      `🙈 **Canales ignorados:** ${ignored}`
    ].join('\n'), timestamp: true })], ephemeral: true });
  }
  if (sub === 'toggle') a.enabled = interaction.options.getBoolean('activo', true);
  if (sub === 'antiinvite') a.antiInvite = interaction.options.getBoolean('activo', true);
  if (sub === 'antilink') a.antiLink = interaction.options.getBoolean('activo', true);
  if (sub === 'caps') a.capsPercent = interaction.options.getInteger('porcentaje', true);
  if (sub === 'mentions') a.maxMentions = interaction.options.getInteger('maximo', true);
  if (sub === 'ignore-channel') {
    const id = interaction.options.getChannel('canal', true).id;
    if (a.ignoredChannelIds.includes(id)) a.ignoredChannelIds = a.ignoredChannelIds.filter(x => x !== id);
    else a.ignoredChannelIds.push(id);
  }
  config.modules.automod = true;
  saveGuildConfig(interaction.guildId, config);
  return interaction.reply({ content: '✅ Configuración de AutoMod actualizada.', ephemeral: true });
}
