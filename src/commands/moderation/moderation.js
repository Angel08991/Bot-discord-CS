import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  userMention,
  time,
  TimestampStyles
} from 'discord.js';
import { getGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';
import { addModerationCase, getModerationCases, getModerationCase, getRecentModerationCases } from '../../database/database.js';
import { baseEmbed } from '../../utils/embeds.js';
import { canModerate } from '../../utils/permissions.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('Herramientas de moderación de CS Studios Bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(sub => sub
    .setName('ban')
    .setDescription('Banea a un usuario.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a banear.').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón del baneo.').setRequired(false).setMaxLength(500)))
  .addSubcommand(sub => sub
    .setName('unban')
    .setDescription('Quita el baneo usando el ID del usuario.')
    .addStringOption(o => o.setName('usuario').setDescription('ID del usuario.').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('kick')
    .setDescription('Expulsa a un usuario.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a expulsar.').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón.').setRequired(false).setMaxLength(500)))
  .addSubcommand(sub => sub
    .setName('timeout')
    .setDescription('Aplica un timeout.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario.').setRequired(true))
    .addIntegerOption(o => o.setName('minutos').setDescription('Duración en minutos.').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('razon').setDescription('Razón.').setRequired(false).setMaxLength(500)))
  .addSubcommand(sub => sub
    .setName('untimeout')
    .setDescription('Retira un timeout.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario.').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('warn')
    .setDescription('Advierte a un usuario.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario.').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón.').setRequired(true).setMaxLength(500)))
  .addSubcommand(sub => sub
    .setName('warnings')
    .setDescription('Muestra los avisos de un usuario.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario.').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('clear')
    .setDescription('Elimina mensajes recientes.')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Entre 1 y 100.').setRequired(true).setMinValue(1).setMaxValue(100)))
  .addSubcommand(sub => sub
    .setName('slowmode')
    .setDescription('Configura el slowmode del canal.')
    .addIntegerOption(o => o.setName('segundos').setDescription('0 desactiva.').setRequired(true).setMinValue(0).setMaxValue(21600)))
  .addSubcommand(sub => sub
    .setName('lock')
    .setDescription('Bloquea el canal para @everyone.'))
  .addSubcommand(sub => sub
    .setName('unlock')
    .setDescription('Desbloquea el canal para @everyone.'))
  .addSubcommand(sub => sub
    .setName('softban')
    .setDescription('Banea y desbanea para limpiar mensajes recientes.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario.').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón.').setRequired(false).setMaxLength(500)))
  .addSubcommand(sub => sub
    .setName('case')
    .setDescription('Muestra los detalles de un caso de moderación.')
    .addIntegerOption(o => o.setName('numero').setDescription('Número del caso.').setRequired(true).setMinValue(1)))
  .addSubcommand(sub => sub
    .setName('cases')
    .setDescription('Muestra los casos recientes del servidor.')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Entre 1 y 25.').setRequired(false).setMinValue(1).setMaxValue(25)));

function canActOn(interaction, target) {
  if (target.id === interaction.user.id) return 'No puedes aplicar esta acción sobre ti mismo.';
  if (target.id === interaction.client.user.id) return 'No puedes aplicar esta acción al bot.';
  const me = interaction.guild.members.me;
  if (target.roles.highest.comparePositionTo(me.roles.highest) >= 0) return 'Mi rol está por debajo o al mismo nivel que el objetivo.';
  if (interaction.member.roles.highest.comparePositionTo(target.roles.highest) <= 0 && interaction.guild.ownerId !== interaction.user.id) return 'No puedes moderar a alguien con un rol igual o superior al tuyo.';
  return null;
}

async function dmUser(member, title, description) {
  try {
    await member.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle(title).setDescription(description).setTimestamp().setFooter({ text: 'CS Studios Bot' })] });
  } catch {}
}

export async function execute(interaction) {
  if (!interaction.guild) return interaction.reply({ content: '❌ Este comando solo puede usarse en un servidor.', ephemeral: true });
  const config = getGuildConfig(interaction.guildId, defaults);
  if (!config.modules?.moderation || !config.moderation?.enabled) return interaction.reply({ content: '❌ La moderación está desactivada.', ephemeral: true });
  const sub = interaction.options.getSubcommand();

  if (sub === 'case') {
    if (!canModerate(interaction, config)) return interaction.reply({ content: '❌ No tienes permisos de moderación.', ephemeral: true });
    const id = interaction.options.getInteger('numero', true);
    const item = getModerationCase(interaction.guildId, id);
    if (!item) return interaction.reply({ content: '❌ No existe ese caso en este servidor.', ephemeral: true });
    const when = Math.floor(new Date(`${item.created_at}Z`).getTime() / 1000);
    const embed = baseEmbed(config.branding, {
      title: `🧾 Caso #${item.id}`,
      description: [`**Acción:** ${item.action}`, `**Usuario:** <@${item.user_id}>`, `**Moderador:** <@${item.moderator_id}>`, `**Razón:** ${item.reason || 'Sin razón indicada'}`, `**Duración:** ${item.duration_seconds ? `${Math.ceil(item.duration_seconds / 60)} min` : 'No aplica'}`, `**Fecha:** <t:${when}:F> (<t:${when}:R>)`].join('\n'),
      timestamp: true
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'cases') {
    if (!canModerate(interaction, config)) return interaction.reply({ content: '❌ No tienes permisos de moderación.', ephemeral: true });
    const amount = interaction.options.getInteger('cantidad') ?? 10;
    const rows = getRecentModerationCases(interaction.guildId, amount);
    const embed = baseEmbed(config.branding, {
      title: '🧾 Casos recientes',
      description: rows.length ? rows.map(c => `**#${c.id}** • \`${c.action}\` • <@${c.user_id}> • <t:${Math.floor(new Date(`${c.created_at}Z`).getTime()/1000)}:R>\n> ${c.reason || 'Sin razón indicada'}`).join('\n\n') : 'No hay casos registrados todavía.',
      timestamp: true
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (['clear','slowmode','lock','unlock'].includes(sub)) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: '❌ Necesitas **Gestionar canales**.', ephemeral: true });
    try {
      if (sub === 'clear') {
        if (!interaction.channel?.isTextBased()) return interaction.reply({ content: '❌ Este canal no admite mensajes.', ephemeral: true });
        const amount = interaction.options.getInteger('cantidad', true);
        const messages = await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `🧹 Se eliminaron **${messages.size}** mensajes.`, ephemeral: true });
      }
      if (sub === 'slowmode') {
        await interaction.channel.setRateLimitPerUser(interaction.options.getInteger('segundos', true), 'Configurado por moderación');
        return interaction.reply({ content: '🐢 Slowmode actualizado correctamente.', ephemeral: true });
      }
      const everyone = interaction.guild.roles.everyone;
      await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: sub === 'unlock' ? null : false }, { reason: `${sub} por ${interaction.user.tag}` });
      return interaction.reply({ content: sub === 'lock' ? '🔒 Canal bloqueado.' : '🔓 Canal desbloqueado.', ephemeral: true });
    } catch {
      return interaction.reply({ content: '❌ No pude modificar este canal. Comprueba mis permisos.', ephemeral: true });
    }
  }

  if (sub === 'warnings') {
    const user = interaction.options.getUser('usuario', true);
    const cases = getModerationCases(interaction.guildId, user.id, 20).filter(c => c.action === 'WARN');
    const embed = baseEmbed(config.branding, {
      title: `⚠️ Advertencias de ${user.username}`,
      description: cases.length ? cases.map(c => `**#${c.id}** • <t:${Math.floor(new Date(`${c.created_at}Z`).getTime()/1000)}:R> • <@${c.moderator_id}>\n> ${c.reason || 'Sin razón'}`).join('\n\n') : '✅ Este usuario no tiene advertencias.',
      timestamp: true
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'unban') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '❌ Necesitas **Banear miembros**.', ephemeral: true });
    const id = interaction.options.getString('usuario', true).trim();
    try {
      await interaction.guild.members.unban(id, `Por ${interaction.user.tag}`);
      addModerationCase({ guildId: interaction.guildId, userId: id, moderatorId: interaction.user.id, action: 'UNBAN', reason: 'Sin razón indicada' });
      return interaction.reply({ content: `✅ <@${id}> ha sido desbaneado.` });
    } catch {
      return interaction.reply({ content: '❌ No pude quitar el baneo. Revisa el ID y los permisos.', ephemeral: true });
    }
  }

  const target = interaction.options.getMember('usuario', true);
  const guard = canActOn(interaction, target);
  if (guard) return interaction.reply({ content: `❌ ${guard}`, ephemeral: true });

  const reason = interaction.options.getString('razon') ?? 'Sin razón indicada';
  try {
    switch (sub) {
      case 'ban': {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '❌ Necesitas **Banear miembros**.', ephemeral: true });
        if (!target.bannable) return interaction.reply({ content: '❌ No puedo banear a este usuario.', ephemeral: true });
        if (config.moderation.dmUser) await dmUser(target, '🔨 Has sido baneado', `Servidor: **${interaction.guild.name}**\nRazón: **${reason}**`);
        await target.ban({ reason });
        const caseId = addModerationCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'BAN', reason });
        return interaction.reply({ embeds: [baseEmbed(config.branding, { title: '🔨 Usuario baneado', description: `${userMention(target.id)} ha sido baneado.\n\n**Caso:** #${caseId}\n**Razón:** ${reason}`, timestamp: true })] });
      }
      case 'kick': {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '❌ Necesitas **Expulsar miembros**.', ephemeral: true });
        if (!target.kickable) return interaction.reply({ content: '❌ No puedo expulsar a este usuario.', ephemeral: true });
        if (config.moderation.dmUser) await dmUser(target, '👢 Has sido expulsado', `Servidor: **${interaction.guild.name}**\nRazón: **${reason}**`);
        await target.kick(reason);
        const caseId = addModerationCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'KICK', reason });
        return interaction.reply({ embeds: [baseEmbed(config.branding, { title: '👢 Usuario expulsado', description: `${userMention(target.id)} ha sido expulsado.\n\n**Caso:** #${caseId}\n**Razón:** ${reason}`, timestamp: true })] });
      }
      case 'timeout': {
        const minutes = interaction.options.getInteger('minutos', true);
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) return interaction.reply({ content: '❌ Necesitas **Moderar miembros**.', ephemeral: true });
        if (!target.moderatable) return interaction.reply({ content: '❌ No puedo aplicar timeout a este usuario.', ephemeral: true });
        if (config.moderation.dmUser) await dmUser(target, '⏳ Has recibido un timeout', `Servidor: **${interaction.guild.name}**\nDuración: **${minutes} minutos**\nRazón: **${reason}**`);
        await target.timeout(minutes * 60_000, reason);
        const caseId = addModerationCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'TIMEOUT', reason, durationSeconds: minutes * 60 });
        return interaction.reply({ embeds: [baseEmbed(config.branding, { title: '⏳ Timeout aplicado', description: `${userMention(target.id)} recibió timeout por **${minutes} minutos**.\n\n**Caso:** #${caseId}\n**Razón:** ${reason}`, timestamp: true })] });
      }
      case 'untimeout': {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) return interaction.reply({ content: '❌ Necesitas **Moderar miembros**.', ephemeral: true });
        if (!target.moderatable) return interaction.reply({ content: '❌ No puedo quitar el timeout a este usuario.', ephemeral: true });
        await target.timeout(null, 'Timeout retirado');
        addModerationCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'UNTIMEOUT', reason: 'Timeout retirado' });
        return interaction.reply({ embeds: [baseEmbed(config.branding, { title: '✅ Timeout retirado', description: `${userMention(target.id)} ya puede volver a hablar.`, timestamp: true })] });
      }
      case 'softban': {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '❌ Necesitas **Banear miembros**.', ephemeral: true });
        if (!target.bannable) return interaction.reply({ content: '❌ No puedo banear a este usuario.', ephemeral: true });
        const reason = interaction.options.getString('razon') ?? 'Sin razón indicada';
        if (config.moderation.dmUser) await dmUser(target, '🧹 Has recibido un softban', `Servidor: **${interaction.guild.name}**\nRazón: **${reason}**`);
        await target.ban({ deleteMessageSeconds: 86400, reason });
        await interaction.guild.members.unban(target.id, 'Softban completado');
        const caseId = addModerationCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'SOFTBAN', reason, durationSeconds: 0 });
        return interaction.reply({ embeds: [baseEmbed(config.branding, { title: '🧹 Softban completado', description: `${userMention(target.id)} fue expulsado temporalmente para limpiar mensajes.\n\n**Caso:** #${caseId}\n**Razón:** ${reason}`, timestamp: true })] });
      }
      case 'warn': {
        const caseId = addModerationCase({ guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, action: 'WARN', reason });
        if (config.moderation.dmUser) await dmUser(target, '⚠️ Has recibido una advertencia', `Servidor: **${interaction.guild.name}**\nRazón: **${reason}**\nCaso: **#${caseId}**`);
        return interaction.reply({ embeds: [baseEmbed(config.branding, { title: '⚠️ Advertencia registrada', description: `${userMention(target.id)} ha recibido una advertencia.\n\n**Caso:** #${caseId}\n**Razón:** ${reason}`, timestamp: true })] });
      }
    }
  } catch (error) {
    console.error(`Moderation ${sub} error:`, error);
    return interaction.reply({ content: '❌ No pude completar la acción. Comprueba permisos y jerarquía de roles.', ephemeral: true });
  }
}
