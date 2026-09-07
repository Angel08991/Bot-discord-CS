import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, saveGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';
import { baseEmbed } from '../../utils/embeds.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('raid')
  .setDescription('Configura la protección Anti-Raid.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName('status').setDescription('Muestra el estado actual.'))
  .addSubcommand(s => s.setName('toggle').setDescription('Activa o desactiva la protección.').addBooleanOption(o => o.setName('activo').setDescription('¿Activarla?').setRequired(true)))
  .addSubcommand(s => s.setName('limits').setDescription('Configura el límite de entradas.').addIntegerOption(o => o.setName('entradas').setDescription('Número de entradas para activar.').setRequired(true).setMinValue(2).setMaxValue(50)).addIntegerOption(o => o.setName('segundos').setDescription('Ventana de detección.').setRequired(true).setMinValue(5).setMaxValue(120)))
  .addSubcommand(s => s.setName('action').setDescription('Configura la acción automática.').addStringOption(o => o.setName('accion').setDescription('Acción.').setRequired(true).addChoices({ name: 'Timeout', value: 'timeout' }, { name: 'Solo registrar', value: 'log' })));

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  const r = config.raidProtection;
  const sub = interaction.options.getSubcommand();
  if (sub === 'status') return interaction.reply({ embeds: [baseEmbed(config.branding, { title: '🚨 Protección Anti-Raid', description: `${r.enabled ? '🟢 Activada' : '🔴 Desactivada'}\n\n👥 **Entradas:** ${r.maxJoins}\n⏱️ **Ventana:** ${r.windowSeconds}s\n🛡️ **Acción:** ${r.action === 'timeout' ? 'Timeout' : 'Solo registrar'}\n⏳ **Timeout:** ${Math.floor(r.timeoutSeconds / 60)} min`, timestamp: true })], ephemeral: true });
  if (sub === 'toggle') r.enabled = interaction.options.getBoolean('activo', true);
  if (sub === 'limits') { r.maxJoins = interaction.options.getInteger('entradas', true); r.windowSeconds = interaction.options.getInteger('segundos', true); }
  if (sub === 'action') r.action = interaction.options.getString('accion', true);
  config.raidProtection = r; saveGuildConfig(interaction.guildId, config);
  return interaction.reply({ content: '✅ Protección Anti-Raid actualizada.', ephemeral: true });
}
