import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  Collection,
  ActivityType,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder
} from 'discord.js';
import { loadCommands } from './command-loader.js';
import { loadDefaults } from './utils/config.js';
import {
  getGuildConfig, saveGuildConfig, closeDatabase, createTicket, getOpenTicketByUser,
  getTicketByChannel, closeTicket, claimTicket, addRating, addModerationCase, getActiveGiveaways,
  getGiveawayByMessage, addGiveawayEntry, hasGiveawayEntry, getSuggestionByMessage, updateSuggestionStatus
} from './database/database.js';
import { baseEmbed } from './utils/embeds.js';
import { buildSuggestionModal, handleSuggestionModal } from './commands/community/suggestion.js';
import { finishGiveaway } from './commands/giveaways/end.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN no está configurado. Revisa tu archivo .env');
  process.exit(1);
}

const defaults = loadDefaults();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User]
});

client.commands = new Collection();

const commands = await loadCommands();
for (const [name, command] of commands) client.commands.set(name, command);

client.once(Events.ClientReady, readyClient => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       🤖 CS STUDIOS BOT v1.7.0          ║');
  console.log('║     Bot desarrollado por CS Studios      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`✅ Conectado como ${readyClient.user.tag}`);
  console.log(`✅ Servidores: ${readyClient.guilds.cache.size}`);
  console.log(`✅ Comandos cargados: ${client.commands.size}`);

  readyClient.user.setPresence({
    activities: [{ name: 'Bot desarrollado por CS Studios', type: ActivityType.Watching }],
    status: 'online'
  });
});


async function sendLog(guild, type, description, extraFields = []) {
  try {
    const config = getGuildConfig(guild.id, defaults);
    if (!config.logs?.enabled || !config.logs?.channelId) return;
    const channel = guild.channels.cache.get(config.logs.channelId);
    if (!channel?.isTextBased()) return;
    const embed = baseEmbed(config.branding, {
      title: type,
      description,
      fields: extraFields,
      timestamp: true
    });
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Log error:', error);
  }
}

async function showSetupSection(interaction, selected) {
  const config = getGuildConfig(interaction.guild.id, defaults);
  const labels = {
    branding: '🎨 Branding',
    welcome: '👋 Bienvenidas',
    goodbye: '🚪 Despedidas',
    logs: '📋 Logs',
    ticket: '🎫 Tickets',
    moderation: '🛡️ Moderación',
    staff: '👮 Staff',
    modules: '🧩 Módulos'
  };

  const embed = baseEmbed(config.branding, { title: labels[selected] ?? '⚙️ Configuración', timestamp: true });
  const rows = [];

  if (selected === 'moderation') {
    embed.setDescription([
      `${config.moderation?.enabled ? '🟢' : '🔴'} **Moderación:** ${config.moderation?.enabled ? 'Activada' : 'Desactivada'}`,
      `${config.automod?.enabled ? '🟢' : '🔴'} **AutoMod:** ${config.automod?.enabled ? 'Activado' : 'Desactivado'}`,
      `${config.raidProtection?.enabled ? '🟢' : '🔴'} **Anti-Raid:** ${config.raidProtection?.enabled ? 'Activado' : 'Desactivado'}`,
      `👮 **Roles de staff:** ${(config.moderation?.staffRoleIds?.length ?? 0) || 'Sin configurar'}`,
      '',
      'Usa `/mod case <numero>` para consultar un caso y `/mod cases` para ver los últimos casos.'
    ].join('\n'));
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cs_setup_moderation_modal').setLabel('Configurar staff').setStyle(ButtonStyle.Primary).setEmoji('👮')
    ));
  } else if (selected === 'staff') {
    const ids = config.moderation?.staffRoleIds ?? [];
    embed.setDescription([
      'Los roles configurados aquí podrán usar las herramientas de moderación del bot.',
      '',
      `👮 **Roles actuales:** ${ids.length ? ids.map(id => `<@&${id}>`).join(', ') : 'Ninguno'}`,
      '',
      'Añade IDs separados por comas. Los administradores y propietarios siguen teniendo acceso.'
    ].join('\n'));
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cs_setup_moderation_modal').setLabel('Editar roles de staff').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
    ));
  } else if (selected === 'modules') {
    embed.setDescription(Object.entries(config.modules ?? {}).map(([k, v]) => `${v ? '🟢' : '🔴'} **${k}**`).join('\n'));
    const menu = new StringSelectMenuBuilder()
      .setCustomId('cs_setup_modules_toggle')
      .setPlaceholder('Activa/desactiva un módulo...')
      .addOptions(Object.entries(config.modules ?? {}).map(([value, enabled]) => ({
        label: value.slice(0, 100), value, emoji: enabled ? '🟢' : '🔴'
      })));
    rows.push(new ActionRowBuilder().addComponents(menu));
  } else if (selected === 'branding') {
    embed.setDescription(`**Nombre:** ${config.branding?.name}\n**Color:** ${config.branding?.color}\n**Footer:** ${config.branding?.footer}`);
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cs_setup_branding_modal').setLabel('Editar branding').setStyle(ButtonStyle.Primary).setEmoji('🎨')
    ));
  } else if (selected === 'welcome' || selected === 'goodbye') {
    const block = config[selected];
    embed.setDescription([
      `${block.enabled ? '🟢' : '🔴'} **Estado:** ${block.enabled ? 'Activado' : 'Desactivado'}`,
      `📢 **Canal:** ${block.channelId ? `<#${block.channelId}>` : 'No configurado'}`,
      `🖼️ **Imagen:** ${block.image ? 'Configurada' : 'No configurada'}`,
      `🔲 **Thumbnail:** ${block.thumbnail ? 'Configurado' : 'No configurado'}`,
      `📝 **Mensaje:** ${block.message}`
    ].join('\n'));
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cs_setup_${selected}_toggle`).setLabel(block.enabled ? 'Desactivar' : 'Activar').setStyle(block.enabled ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(block.enabled ? '🔴' : '🟢'),
      new ButtonBuilder().setCustomId(`cs_setup_${selected}_modal`).setLabel('Editar mensaje/imagen').setStyle(ButtonStyle.Primary).setEmoji('🖼️')
    ));
  } else if (selected === 'logs') {
    embed.setDescription(`${config.logs?.enabled ? '🟢' : '🔴'} **Estado:** ${config.logs?.enabled ? 'Activado' : 'Desactivado'}\n📢 **Canal:** ${config.logs?.channelId ? `<#${config.logs.channelId}>` : 'No configurado'}`);
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cs_setup_logs_toggle').setLabel(config.logs?.enabled ? 'Desactivar' : 'Activar').setStyle(config.logs?.enabled ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('📋'),
      new ButtonBuilder().setCustomId('cs_setup_logs_modal').setLabel('Configurar canal').setStyle(ButtonStyle.Primary).setEmoji('⚙️')
    ));
  } else if (selected === 'ticket') {
    embed.setDescription([
      `${config.ticket?.enabled ? '🟢' : '🔴'} **Estado:** ${config.ticket?.enabled ? 'Activado' : 'Desactivado'}`,
      `📁 **Categoría:** ${config.ticket?.categoryId ? `<#${config.ticket.categoryId}>` : 'No configurada'}`,
      `👮 **Staff:** ${config.ticket?.supportRoleId ? `<@&${config.ticket.supportRoleId}>` : 'Administradores'}`,
      `🖼️ **Imagen:** ${config.ticket?.image ? 'Configurada' : 'No configurada'}`
    ].join('\n'));
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cs_setup_ticket_modal').setLabel('Editar panel').setStyle(ButtonStyle.Primary).setEmoji('🎫')
    ));
  }

  await interaction.update({ embeds: [embed], components: rows });
}

async function openTicketFromInteraction(interaction) {
  const config = getGuildConfig(interaction.guild.id, defaults);
  if (!config.modules?.tickets || !config.ticket?.enabled) {
    return interaction.reply({ content: '❌ Los tickets están desactivados.', ephemeral: true });
  }
  const existing = getOpenTicketByUser(interaction.guild.id, interaction.user.id);
  if (existing) return interaction.reply({ content: `❌ Ya tienes un ticket abierto: <#${existing.channel_id}>`, ephemeral: true });

  const category = interaction.values[0];
  const label = config.ticket.categories?.[category] ?? `🎫 ${category}`;
  const safeName = `${category}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: ['ViewChannel'] },
    { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
    { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'ManageMessages'] }
  ];
  if (config.ticket.supportRoleId) {
    overwrites.push({ id: config.ticket.supportRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] });
  }

  const channel = await interaction.guild.channels.create({
    name: safeName,
    type: ChannelType.GuildText,
    parent: config.ticket.categoryId || null,
    permissionOverwrites: overwrites,
    topic: `CS Studios Ticket | ${interaction.user.tag} | ${label}`
  });

  createTicket({ guildId: interaction.guild.id, channelId: channel.id, userId: interaction.user.id, category });

  const embed = baseEmbed(config.branding, {
    title: `🎫 ${label.replace(/^\S+\s/, '')}`,
    description: `Hola <@${interaction.user.id}> 👋\n\nGracias por contactar con el equipo. Explica tu problema con el mayor detalle posible.\n\n🛡️ **Categoría:** ${label}`,
    image: config.ticket.image || undefined,
    thumbnail: config.ticket.thumbnail || undefined,
    timestamp: true
  });
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cs_ticket_close').setLabel('Cerrar ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('cs_ticket_claim').setLabel('Reclamar').setStyle(ButtonStyle.Primary).setEmoji('🙋')
  );
  await channel.send({ content: `<@${interaction.user.id}>${config.ticket.supportRoleId ? ` <@&${config.ticket.supportRoleId}>` : ''}`, embeds: [embed], components: [buttons] });
  await interaction.reply({ content: `✅ Tu ticket ha sido creado: ${channel}`, ephemeral: true });
  await sendLog(interaction.guild, '🎫 Ticket creado', `Se creó un ticket para <@${interaction.user.id}>.`, [
    { name: 'Categoría', value: label, inline: true },
    { name: 'Canal', value: `${channel}`, inline: true }
  ]);
}



// XP / AFK / reminders: kept in the core so they work with every guild without extra setup.
const xpCooldowns = new Map();
client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot) return;
  try {
    const cfg = getGuildConfig(message.guild.id, defaults);
    const afkUser = getAFK(message.guild.id, message.author.id);
    if (afkUser) {
      removeAFK(message.guild.id, message.author.id);
      await message.reply({ content: '👋 Bienvenido de vuelta. Tu estado AFK ha sido desactivado.' }).catch(() => {});
    }
    for (const user of message.mentions.users.values()) {
      if (user.bot) continue;
      const afk = getAFK(message.guild.id, user.id);
      if (afk) await message.reply({ content: `💤 **${user.username}** está AFK.\n📝 ${afk.reason}` }).catch(() => {});
    }
    if (!cfg.modules.levels || cfg.levels?.ignoredChannelIds?.includes(message.channel.id)) return;
    const last = xpCooldowns.get(`${message.guild.id}:${message.author.id}`) || 0;
    const cooldown = Number(cfg.levels?.cooldownSeconds ?? 45) * 1000;
    if (Date.now() - last < cooldown) return;
    xpCooldowns.set(`${message.guild.id}:${message.author.id}`, Date.now());
    const min = Number(cfg.levels?.xpPerMessageMin ?? 8), max = Number(cfg.levels?.xpPerMessageMax ?? 15);
    const gained = Math.floor(Math.random() * Math.max(1, max - min + 1)) + min;
    const result = addXP(message.guild.id, message.author.id, Math.round(gained * Number(cfg.levels?.levelMultiplier ?? 1)));
    if (result.leveledUp) {
      await message.channel.send({ embeds: [baseEmbed(cfg.branding, { title: '🎉 ¡Subiste de nivel!', description: `¡Felicidades <@${message.author.id}>! Ahora eres **nivel ${result.level}**.`, thumbnail: message.author.displayAvatarURL(), timestamp: true })] }).catch(() => {});
      const reward = cfg.levels?.rewards?.[String(result.level)];
      if (reward && message.guild.roles.cache.has(String(reward))) await message.member.roles.add(String(reward)).catch(() => {});
    }
  } catch (error) { console.error('Message handler error:', error); }
});

setInterval(async () => {
  for (const reminder of getDueReminders()) {
    try {
      const guild = client.guilds.cache.get(reminder.guild_id);
      const channel = guild?.channels.cache.get(reminder.channel_id);
      if (channel?.isTextBased()) await channel.send(`<@${reminder.user_id}> ⏰ **Recordatorio:** ${reminder.message}`);
    } catch (error) { console.error('Reminder error:', error); }
    markReminderSent(reminder.id);
  }
}, 15000);

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'cs_ticket_category') {
      await openTicketFromInteraction(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('cs_poll_')) {
      const choice = interaction.customId.split('_').at(-1);
      return interaction.reply({ content: `✅ Has votado por la opción **${Number(choice) + 1}**.`, ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'cs_autorole_select') {
      const cfg = getGuildConfig(interaction.guild.id, defaults);
      const allowed = new Set(cfg.autoroles?.roleIds ?? []);
      const selected = new Set(interaction.values.filter(v => allowed.has(v)));
      const member = await interaction.guild.members.fetch(interaction.user.id);
      for (const roleId of allowed) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role || role.position >= interaction.guild.members.me.roles.highest.position) continue;
        if (selected.has(roleId)) await member.roles.add(role).catch(() => {});
        else await member.roles.remove(role).catch(() => {});
      }
      await interaction.reply({ content: '✅ Tus roles han sido actualizados.', ephemeral: true });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'cs_setup_menu') {
      await showSetupSection(interaction, interaction.values[0]);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'cs_setup_modules_toggle') {
      if (!interaction.guild) return;
      const config = getGuildConfig(interaction.guild.id, defaults);
      const module = interaction.values[0];
      config.modules[module] = !config.modules[module];
      saveGuildConfig(interaction.guild.id, config);
      await showSetupSection(interaction, 'modules');
      return;
    }

    if (interaction.isButton()) {
      if (!interaction.guild) return;
      const customId = interaction.customId;
      if (customId === 'cs_setup_branding_modal') {
        const config = getGuildConfig(interaction.guild.id, defaults);
        const modal = new ModalBuilder().setCustomId('cs_modal_branding').setTitle('🎨 Branding');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Nombre').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setValue(config.branding?.name ?? 'CS Studios Bot')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Color HEX').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7).setValue(config.branding?.color ?? '#8B5CF6')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200).setValue(config.branding?.footer ?? 'Bot desarrollado por CS Studios'))
        );
        await interaction.showModal(modal);
        return;
      }
      if (customId === 'cs_setup_moderation_modal') {
        const current = (config.moderation?.staffRoleIds ?? []).join(', ');
        const modal = new ModalBuilder().setCustomId('cs_modal_moderation_staff').setTitle('👮 Roles de staff');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('roleIds').setLabel('IDs de roles, separados por comas').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(current).setMaxLength(1000)
        ));
        return interaction.showModal(modal);
      }

      if (customId === 'cs_setup_logs_toggle') {
        const config = getGuildConfig(interaction.guild.id, defaults);
        config.logs.enabled = !config.logs.enabled;
        saveGuildConfig(interaction.guild.id, config);
        await showSetupSection(interaction, 'logs');
        return;
      }
      if (customId === 'cs_setup_logs_modal') {
        const config = getGuildConfig(interaction.guild.id, defaults);
        const modal = new ModalBuilder().setCustomId('cs_modal_logs').setTitle('📋 Canal de logs');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channelId').setLabel('ID del canal de logs').setStyle(TextInputStyle.Short).setRequired(true).setValue(config.logs?.channelId ?? '')));
        await interaction.showModal(modal);
        return;
      }
      if (customId === 'cs_setup_ticket_modal') {
        const config = getGuildConfig(interaction.guild.id, defaults);
        const modal = new ModalBuilder().setCustomId('cs_modal_ticket').setTitle('🎫 Panel de tickets');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel('URL de imagen/banner').setStyle(TextInputStyle.Short).setRequired(false).setValue(config.ticket?.image ?? '')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true).setValue(config.ticket?.panelTitle ?? '🎫 Centro de Soporte')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Descripción').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(config.ticket?.panelDescription ?? 'Necesitas ayuda? Selecciona una categoría.'))
        );
        await interaction.showModal(modal);
        return;
      }
      if (customId === 'cs_ticket_claim') {
        const ticket = getTicketByChannel(interaction.channelId);
        if (!ticket) return interaction.reply({ content: '❌ Este canal no es un ticket válido.', ephemeral: true });
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ No tienes permiso para reclamar tickets.', ephemeral: true });
        claimTicket(interaction.channelId, interaction.user.id);
        await interaction.channel.send({ embeds: [baseEmbed(getGuildConfig(interaction.guild.id, defaults).branding, { title: '🙋 Ticket reclamado', description: `<@${interaction.user.id}> se ha hecho cargo de este ticket.`, timestamp: true })] });
        await interaction.reply({ content: '✅ Ticket reclamado.', ephemeral: true });
        return;
      }
      if (customId === 'cs_ticket_close') {
        const ticket = getTicketByChannel(interaction.channelId);
        if (!ticket) return interaction.reply({ content: '❌ Este canal no es un ticket válido.', ephemeral: true });
        const isOwner = interaction.user.id === ticket.user_id;
        const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
        if (!isOwner && !isStaff) return interaction.reply({ content: '❌ Solo el creador del ticket o el staff puede cerrarlo.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        closeTicket(interaction.channelId);
        const config = getGuildConfig(interaction.guild.id, defaults);
        const fetched = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
        const messages = fetched ? [...fetched.values()].sort((a,b) => a.createdTimestamp-b.createdTimestamp) : [];
        const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
        const transcript = `<!doctype html><html><head><meta charset="utf-8"><title>CS Studios Ticket</title><style>body{font-family:Arial;background:#111;color:#eee;padding:24px}article{padding:12px;margin:8px 0;background:#1b1b1b;border-radius:8px}small{color:#aaa}</style></head><body><h1>🎫 Ticket ${escape(interaction.channel.name)}</h1><p>Servidor: ${escape(interaction.guild.name)}<br>Creador: ${escape(ticket.user_id)}<br>Categoría: ${escape(ticket.category)}</p>${messages.map(m=>`<article><b>${escape(m.author?.tag || m.author?.username || 'Desconocido')}</b> <small>${new Date(m.createdTimestamp).toLocaleString()}</small><div>${escape(m.content || '[sin texto]')}</div></article>`).join('')}</body></html>`;
        const buffer = Buffer.from(transcript, 'utf8');
        const attachment = new AttachmentBuilder(buffer, { name: `ticket-${interaction.channelId}.html` });
        if (config.logs?.enabled && config.logs?.channelId) {
          const logChannel = interaction.guild.channels.cache.get(config.logs.channelId);
          if (logChannel?.isTextBased()) await logChannel.send({ content: `📄 **Transcripción:** ${interaction.channel.name} • creado por <@${ticket.user_id}> • cerrado por <@${interaction.user.id}>`, files: [attachment] }).catch(() => {});
        }
        const ratingRow = new ActionRowBuilder().addComponents(...[1,2,3,4,5].map(n => new ButtonBuilder().setCustomId(`cs_rating_${n}`).setLabel(String(n)).setStyle(n >= 4 ? ButtonStyle.Success : n >= 3 ? ButtonStyle.Primary : ButtonStyle.Danger).setEmoji('⭐')));
        await interaction.editReply({ content: '✅ Ticket cerrado y transcripción enviada a los logs (si están configurados).', });
        await interaction.channel.send({ embeds: [baseEmbed(config.branding, { title: '🔒 Ticket cerrado', description: 'Antes de eliminar el ticket, puedes valorar la atención recibida.', timestamp: true })], components: [ratingRow] });
        await sendLog(interaction.guild, '🔒 Ticket cerrado', `Ticket de <@${ticket.user_id}> cerrado por <@${interaction.user.id}>.`, [{ name: 'Canal', value: `#${interaction.channel.name}`, inline: true }]);
        setTimeout(() => interaction.channel.delete('Ticket cerrado').catch(() => {}), 120000);
        return;
      }
      if (customId.startsWith('cs_setup_welcome_toggle') || customId.startsWith('cs_setup_goodbye_toggle')) {
        const section = customId.includes('welcome') ? 'welcome' : 'goodbye';
        const config = getGuildConfig(interaction.guild.id, defaults);
        config[section].enabled = !config[section].enabled;
        saveGuildConfig(interaction.guild.id, config);
        await showSetupSection(interaction, section);
        return;
      }
      if (customId === 'cs_setup_welcome_modal' || customId === 'cs_setup_goodbye_modal') {
        const section = customId.includes('welcome') ? 'welcome' : 'goodbye';
        const config = getGuildConfig(interaction.guild.id, defaults);
        const modal = new ModalBuilder().setCustomId(`cs_modal_${section}`).setTitle(section === 'welcome' ? '👋 Bienvenidas' : '🚪 Despedidas');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channelId').setLabel('ID del canal').setStyle(TextInputStyle.Short).setRequired(true).setValue(config[section]?.channelId ?? '')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel('URL de imagen/banner').setStyle(TextInputStyle.Short).setRequired(false).setValue(config[section]?.image ?? '')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail').setLabel('URL de thumbnail').setStyle(TextInputStyle.Short).setRequired(false).setValue(config[section]?.thumbnail ?? '')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message').setLabel('Mensaje').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(config[section]?.message ?? ''))
        );
        await interaction.showModal(modal);
        return;
      }
      if (customId.startsWith('cs_rating_')) {
        const rating = Number(customId.split('_').at(-1));
        const ticket = getTicketByChannel(interaction.channelId);
        if (!ticket) return interaction.reply({ content: '❌ No se encontró el ticket.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`cs_modal_rating_${rating}`).setTitle(`⭐ Valoración: ${rating}/5`);
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('comment').setLabel('Comentario (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)));
        await interaction.showModal(modal);
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      const config = getGuildConfig(interaction.guild.id, defaults);
      if (interaction.customId === 'cs_modal_branding') {
        config.branding.name = interaction.fields.getTextInputValue('name');
        config.branding.color = interaction.fields.getTextInputValue('color');
        config.branding.footer = interaction.fields.getTextInputValue('footer');
        saveGuildConfig(interaction.guild.id, config);
        await interaction.reply({ content: '✅ Branding actualizado.', ephemeral: true });
        return;
      }
      if (interaction.customId === 'cs_modal_moderation_staff') {
        const raw = interaction.fields.getTextInputValue('roleIds').trim();
        const ids = raw ? raw.split(/[\s,]+/).filter(Boolean).slice(0, 20) : [];
        const invalid = ids.filter(id => !/^\d{17,20}$/.test(id));
        if (invalid.length) return interaction.reply({ content: '❌ Hay IDs de roles inválidos. Usa únicamente IDs numéricos de Discord.', ephemeral: true });
        config.moderation.staffRoleIds = ids;
        saveGuildConfig(interaction.guildId, config);
        await interaction.reply({ content: `✅ Roles de staff actualizados: **${ids.length}**.`, ephemeral: true });
        return;
      }

      if (interaction.customId === 'cs_modal_logs') {
        config.logs.channelId = interaction.fields.getTextInputValue('channelId').trim();
        config.logs.enabled = true;
        saveGuildConfig(interaction.guild.id, config);
        await interaction.reply({ content: '✅ Canal de logs configurado y activado.', ephemeral: true });
        return;
      }
      if (interaction.customId === 'cs_modal_ticket') {
        config.ticket.image = interaction.fields.getTextInputValue('image').trim();
        config.ticket.panelTitle = interaction.fields.getTextInputValue('title');
        config.ticket.panelDescription = interaction.fields.getTextInputValue('description');
        saveGuildConfig(interaction.guild.id, config);
        await interaction.reply({ content: '✅ Panel de tickets actualizado. Usa `/ticket panel` para publicarlo.', ephemeral: true });
        return;
      }
      for (const section of ['welcome', 'goodbye']) {
        if (interaction.customId === `cs_modal_${section}`) {
          config[section].channelId = interaction.fields.getTextInputValue('channelId').trim();
          config[section].image = interaction.fields.getTextInputValue('image').trim();
          config[section].thumbnail = interaction.fields.getTextInputValue('thumbnail').trim();
          config[section].message = interaction.fields.getTextInputValue('message');
          config[section].enabled = true;
          saveGuildConfig(interaction.guild.id, config);
          await interaction.reply({ content: `✅ ${section === 'welcome' ? 'Bienvenidas' : 'Despedidas'} actualizadas.`, ephemeral: true });
          return;
        }
      }
      if (interaction.customId.startsWith('cs_modal_rating_')) {
        const rating = Number(interaction.customId.split('_').at(-1));
        const ticket = getTicketByChannel(interaction.channelId);
        if (!ticket) return interaction.reply({ content: '❌ No se encontró el ticket.', ephemeral: true });
        if (interaction.user.id !== ticket.user_id) return interaction.reply({ content: '❌ Solo la persona que abrió el ticket puede dejar la valoración.', ephemeral: true });
        const comment = interaction.fields.getTextInputValue('comment');
        addRating({ guildId: interaction.guild.id, ticketChannelId: interaction.channelId, userId: interaction.user.id, rating, comment });
        await interaction.reply({ embeds: [baseEmbed(config.branding, { title: '⭐ Gracias por tu valoración', description: `Has dejado **${rating}/5 ⭐**.\n\n${comment ? `💬 ${comment}` : 'Tu opinión nos ayuda a mejorar.'}`, timestamp: true })] });
        return;
      }
    }

  } catch (error) {
    console.error('Interaction error:', error);
    const reply = {
      content: '❌ Ocurrió un error procesando esta acción.',
      ephemeral: true
    };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
});


const spamBuckets = new Map();

async function moderateMessage(message, config) {
  if (!message.guild || message.author?.bot || !config.modules?.automod || !config.automod?.enabled) return false;
  const a = config.automod;
  if (a.ignoredChannelIds?.includes(message.channelId)) return false;
  if (message.member && a.ignoredRoleIds?.some(id => message.member.roles.cache.has(id))) return false;

  const content = message.content || '';
  const lower = content.toLowerCase();
  let reason = '';
  const spamKey = `${message.guild.id}:${message.author.id}`;
  const bucket = spamBuckets.get(spamKey) || [];
  const now = Date.now();
  bucket.push(now);
  const fresh = bucket.filter(ts => now - ts <= Number(a.spamWindowMs || 5000));
  spamBuckets.set(spamKey, fresh);
  if (a.antiSpam && fresh.length > Number(a.spamMaxMessages || 6)) reason = 'Spam detectado';
  if (!reason && a.badWords?.some(word => word && lower.includes(String(word).toLowerCase()))) reason = 'Palabra bloqueada';
  const invite = /(discord\.gg|discord(?:app)?\.com\/invite)\/[^\s]+/i.test(content);
  const link = /https?:\/\/[^\s]+/i.test(content);
  if (!reason && a.antiInvite && invite) reason = 'Invitación de Discord bloqueada';
  if (!reason && a.antiLink && link) reason = 'Enlace bloqueado';
  const letters = content.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const upper = letters.replace(/[^A-ZÀ-Ý]/g, '').length;
  const capsPct = letters.length ? (upper / letters.length) * 100 : 0;
  if (!reason && a.capsPercent > 0 && letters.length >= 10 && capsPct >= a.capsPercent) reason = 'Exceso de mayúsculas';
  if (!reason && a.maxMentions > 0 && message.mentions.users.size > a.maxMentions) reason = 'Exceso de menciones';

  if (!reason) return false;
  await message.delete().catch(() => {});
  const seconds = Number(a.timeoutSeconds) || 0;
  if (seconds > 0 && message.member?.moderatable) await message.member.timeout(Math.min(seconds, 28 * 24 * 60 * 60) * 1000, `AutoMod: ${reason}`).catch(() => {});
  addModerationCase({ guildId: message.guild.id, userId: message.author.id, moderatorId: client.user.id, action: 'AUTOMOD', reason, durationSeconds: seconds });
  await sendLog(message.guild, '🤖 AutoMod', `Se bloqueó un mensaje de <@${message.author.id}>.`, [{ name: 'Motivo', value: reason, inline: true }, { name: 'Canal', value: `<#${message.channelId}>`, inline: true }]);
  const warning = await message.channel.send({ embeds: [baseEmbed(config.branding, { title: '🤖 AutoMod activado', description: `<@${message.author.id}>, tu mensaje fue eliminado.\n\n**Motivo:** ${reason}`, timestamp: true })] }).catch(() => null);
  if (warning) setTimeout(() => warning.delete().catch(() => {}), 7000);
  return true;
}

client.on(Events.MessageCreate, async message => {
  try {
    const config = getGuildConfig(message.guild?.id ?? '', defaults);
    await moderateMessage(message, config);
  } catch (error) {
    console.error('AutoMod error:', error);
  }
});


client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton() && interaction.customId === 'cs_suggestion_new') {
      return interaction.showModal(buildSuggestionModal());
    }
    if (interaction.isButton() && (interaction.customId === 'cs_suggestion_up' || interaction.customId === 'cs_suggestion_down')) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ Solo el staff puede cambiar el estado de una sugerencia.', ephemeral: true });
      const suggestion = getSuggestionByMessage(interaction.message.id);
      if (!suggestion) return interaction.reply({ content: '❌ Esta sugerencia ya no existe.', ephemeral: true });
      const status = interaction.customId === 'cs_suggestion_up' ? 'approved' : 'rejected';
      updateSuggestionStatus(interaction.message.id, status);
      const config = getGuildConfig(interaction.guild.id, defaults);
      const labels = { approved: '🟢 Aprobada', rejected: '🔴 Rechazada' };
      const embed = baseEmbed(config.branding, { title: `💡 Sugerencia #${suggestion.id}`, description: `👤 **Autor:** <@${suggestion.user_id}>\n\n${suggestion.content}\n\n**Estado:** ${labels[status]}`, timestamp: true });
      await interaction.message.edit({ embeds: [embed], components: [] });
      return interaction.reply({ content: `✅ Sugerencia marcada como **${labels[status]}**.`, ephemeral: true });
    }
    if (interaction.isButton() && interaction.customId === 'cs_giveaway_join') {
      const giveaway = getGiveawayByMessage(interaction.message.id);
      if (!giveaway || giveaway.ended || giveaway.ends_at <= Date.now()) return interaction.reply({ content: '❌ Este sorteo ya terminó.', ephemeral: true });
      if (hasGiveawayEntry(giveaway.id, interaction.user.id)) return interaction.reply({ content: 'ℹ️ Ya estás participando en este sorteo.', ephemeral: true });
      addGiveawayEntry(giveaway.id, interaction.user.id);
      return interaction.reply({ content: '🎉 ¡Ya estás participando! Mucha suerte.', ephemeral: true });
    }
    if (interaction.isModalSubmit() && interaction.customId === 'cs_modal_suggestion') return handleSuggestionModal(interaction);
  } catch (error) {
    console.error('Community interaction error:', error);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ No pude procesar esta acción.', ephemeral: true }).catch(() => {});
  }
});

setInterval(async () => {
  try {
    for (const giveaway of getActiveGiveaways()) {
      if (giveaway.ends_at <= Date.now()) await finishGiveaway(client, giveaway);
    }
  } catch (error) {
    console.error('Giveaway scheduler error:', error);
  }
}, 5000);


client.on(Events.MessageDelete, async message => {
  if (!message.guild || message.author?.bot) return;
  await sendLog(message.guild, '🗑️ Mensaje eliminado', `Se eliminó un mensaje en <#${message.channelId}>.`, [
    { name: 'Autor', value: message.author ? `<@${message.author.id}>` : 'Desconocido', inline: true },
    { name: 'Contenido', value: (message.content || '[sin texto]').slice(0, 1000), inline: false }
  ]);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
  await sendLog(newMessage.guild, '✏️ Mensaje editado', `Se editó un mensaje en <#${newMessage.channelId}>.`, [
    { name: 'Autor', value: newMessage.author ? `<@${newMessage.author.id}>` : 'Desconocido', inline: true },
    { name: 'Antes', value: (oldMessage.content || '[sin texto]').slice(0, 900), inline: false },
    { name: 'Después', value: (newMessage.content || '[sin texto]').slice(0, 900), inline: false }
  ]);
});

client.on(Events.GuildCreate, guild => {
  // Inicializa la configuración del servidor cuando el bot entra por primera vez.
  saveGuildConfig(guild.id, getGuildConfig(guild.id, defaults));
});

client.on(Events.GuildMemberAdd, async member => {
  try {
    const config = getGuildConfig(member.guild.id, defaults);
    if (!config.welcome?.enabled || !config.welcome?.channelId) return;
    const channel = member.guild.channels.cache.get(config.welcome.channelId);
    if (!channel?.isTextBased()) return;

    const { replaceVariables } = await import('./utils/format.js');
    const content = replaceVariables(config.welcome.message, {
      user: `<@${member.id}>`,
      username: member.user.username,
      server: member.guild.name,
      membercount: member.guild.memberCount
    });

    const embed = baseEmbed(config.branding, {
      title: '👋 ¡Bienvenido!',
      description: content,
      image: config.welcome.image || undefined,
      thumbnail: config.welcome.thumbnail || undefined,
      timestamp: true
    });
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Welcome error:', error);
  }
});

client.on(Events.GuildMemberRemove, async member => {
  try {
    const config = getGuildConfig(member.guild.id, defaults);
    if (!config.goodbye?.enabled || !config.goodbye?.channelId) return;
    const channel = member.guild.channels.cache.get(config.goodbye.channelId);
    if (!channel?.isTextBased()) return;

    const { replaceVariables } = await import('./utils/format.js');
    const content = replaceVariables(config.goodbye.message, {
      user: `<@${member.id}>`,
      username: member.user.username,
      server: member.guild.name,
      membercount: member.guild.memberCount
    });

    const embed = baseEmbed(config.branding, {
      title: '🚪 Hasta pronto',
      description: content,
      image: config.goodbye.image || undefined,
      thumbnail: config.goodbye.thumbnail || undefined,
      timestamp: true
    });
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Goodbye error:', error);
  }
});

const raidJoins = new Map();
client.on(Events.GuildMemberAdd, async member => {
  try {
    const cfg = getGuildConfig(member.guild.id, defaults);
    const rp = cfg.raidProtection;
    if (!rp?.enabled) return;
    const key = member.guild.id; const now = Date.now();
    const joins = (raidJoins.get(key) || []).filter(ts => now - ts <= Number(rp.windowSeconds || 15) * 1000);
    joins.push(now); raidJoins.set(key, joins);
    if (joins.length < Number(rp.maxJoins || 6)) return;
    const seconds = Math.min(Number(rp.timeoutSeconds || 600), 28 * 24 * 60 * 60);
    for (const recent of member.guild.members.cache.filter(m => (now - (m.joinedTimestamp || 0)) <= Number(rp.windowSeconds || 15) * 1000 && !m.user.bot).values()) {
      if (rp.action === 'timeout' && recent.moderatable && member.guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) await recent.timeout(seconds * 1000, 'Protección Anti-Raid').catch(() => {});
    }
    await sendLog(member.guild, '🚨 Anti-Raid activado', `Se detectó una oleada de incorporaciones. Se aplicó protección automática.`, [{ name: 'Entradas detectadas', value: String(joins.length), inline: true }]);
    raidJoins.set(key, []);
  } catch (error) { console.error('Anti-Raid error:', error); }
});



client.on(Events.ChannelCreate, async channel => {
  if (!channel.guild) return;
  await sendLog(channel.guild, '📁 Canal creado', `Se creó el canal <#${channel.id}>.`, [
    { name: 'Nombre', value: channel.name, inline: true },
    { name: 'Tipo', value: String(channel.type), inline: true },
    { name: 'ID', value: channel.id, inline: false }
  ]);
});

client.on(Events.ChannelDelete, async channel => {
  if (!channel.guild) return;
  await sendLog(channel.guild, '🗑️ Canal eliminado', `Se eliminó el canal **${channel.name}**.`, [
    { name: 'ID', value: channel.id, inline: false }
  ]);
});

client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
  if (!newChannel.guild) return;
  const fields = [];
  if (oldChannel.name !== newChannel.name) fields.push({ name: 'Nombre anterior', value: String(oldChannel.name).slice(0, 500), inline: true }, { name: 'Nombre nuevo', value: String(newChannel.name).slice(0, 500), inline: true });
  if (oldChannel.parentId !== newChannel.parentId) fields.push({ name: 'Categoría anterior', value: oldChannel.parentId ? `<#${oldChannel.parentId}>` : 'Sin categoría', inline: true }, { name: 'Categoría nueva', value: newChannel.parentId ? `<#${newChannel.parentId}>` : 'Sin categoría', inline: true });
  if (fields.length) await sendLog(newChannel.guild, '✏️ Canal actualizado', `Se actualizaron propiedades de <#${newChannel.id}>.`, fields);
});

client.on(Events.GuildRoleCreate, async role => {
  await sendLog(role.guild, '🎭 Rol creado', `Se creó el rol <@&${role.id}>.`, [{ name: 'ID', value: role.id, inline: false }]);
});

client.on(Events.GuildRoleDelete, async role => {
  await sendLog(role.guild, '🗑️ Rol eliminado', `Se eliminó el rol **${role.name}**.`, [{ name: 'ID', value: role.id, inline: false }]);
});

client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
  const fields = [];
  if (oldRole.name !== newRole.name) fields.push({ name: 'Nombre', value: `${oldRole.name} → ${newRole.name}`, inline: false });
  if (oldRole.color !== newRole.color) fields.push({ name: 'Color', value: `${oldRole.hexColor} → ${newRole.hexColor}`, inline: true });
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) fields.push({ name: 'Permisos', value: 'Los permisos del rol han cambiado.', inline: true });
  if (fields.length) await sendLog(newRole.guild, '✏️ Rol actualizado', `Se actualizaron propiedades de <@&${newRole.id}>.`, fields);
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const fields = [];
  if (oldMember.nickname !== newMember.nickname) fields.push({ name: 'Apodo', value: `${oldMember.nickname ?? 'Sin apodo'} → ${newMember.nickname ?? 'Sin apodo'}`, inline: false });
  const oldRoles = oldMember.roles.cache.map(r => r.id).filter(id => id !== newMember.guild.id);
  const newRoles = newMember.roles.cache.map(r => r.id).filter(id => id !== newMember.guild.id);
  if (oldRoles.join(',') !== newRoles.join(',')) fields.push({ name: 'Roles', value: 'La asignación de roles del miembro ha cambiado.', inline: false });
  if (fields.length) await sendLog(newMember.guild, '👤 Miembro actualizado', `Se actualizaron datos de <@${newMember.id}>.`, fields);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (!newState.guild) return;
  let title = null;
  let description = null;
  if (!oldState.channelId && newState.channelId) { title = '🔊 Entrada a voz'; description = `<@${newState.id}> entró a <#${newState.channelId}>.`; }
  else if (oldState.channelId && !newState.channelId) { title = '🔇 Salida de voz'; description = `<@${newState.id}> salió de <#${oldState.channelId}>.`; }
  else if (oldState.channelId !== newState.channelId) { title = '🔄 Cambio de canal de voz'; description = `<@${newState.id}> pasó de <#${oldState.channelId}> a <#${newState.channelId}>.`; }
  if (title) await sendLog(newState.guild, title, description);
});

const shutdown = () => {
  closeDatabase();
  client.destroy();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

client.login(token);
