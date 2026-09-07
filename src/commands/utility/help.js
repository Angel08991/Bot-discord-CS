import {
  SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { baseEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';

const defaults = loadDefaults();

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Abre el centro de ayuda de CS Studios Bot.')
  .addStringOption(o => o
    .setName('categoria')
    .setDescription('Abre directamente una categoría.')
    .setRequired(false)
    .addChoices(
      { name: 'Moderación', value: 'moderation' },
      { name: 'Tickets', value: 'tickets' },
      { name: 'Comunidad', value: 'community' },
      { name: 'Diversión', value: 'fun' },
      { name: 'Economía y niveles', value: 'progression' },
      { name: 'Utilidades', value: 'utility' }
    ));

const sections = {
  home: { title: '🏠 Centro de ayuda', description: `CS Studios Bot reúne herramientas de moderación, soporte, comunidad, progreso y entretenimiento.\n\nSelecciona una categoría para consultar sus comandos.` },
  moderation: { title: '🛡️ Moderación y seguridad', description: `**Moderación:** \`/mod ban\` \`/mod unban\` \`/mod kick\` \`/mod timeout\` \`/mod untimeout\` \`/mod warn\` \`/mod warnings\` \`/mod clear\` \`/mod slowmode\` \`/mod lock\` \`/mod unlock\` \`/mod softban\` \`/mod case\` \`/mod cases\`\n\n**Seguridad:** \`/automod status\` \`/automod toggle\` \`/raid status\` \`/raid toggle\`` },
  tickets: { title: '🎫 Tickets y soporte', description: `\`/ticket panel\` \`/setup-ticket\` — Paneles personalizados, categorías, reclamo, cierre, transcripciones HTML y valoraciones de servicio.` },
  community: { title: '🌐 Comunidad', description: `\`/suggestion panel\` \`/suggestion status\` \`/giveaway create\` \`/giveaway end\` \`/autorole panel\` \`/poll\` — Herramientas para organizar y mantener activa tu comunidad.` },
  fun: { title: '🎮 Diversión', description: `\`/coinflip\` \`/dice\` \`/rps\` \`/trivia\` \`/guess\` \`/blackjack\` \`/duel\` \`/slots\` — Minijuegos para mantener la actividad de los miembros.` },
  progression: { title: '📈 Niveles y economía', description: `\`/rank\` \`/level leaderboard\` \`/balance\` \`/daily\` \`/work\` \`/pay\` \`/economy leaderboard\` — Progreso, recompensas y economía comunitaria.` },
  utility: { title: '🧰 Utilidades y configuración', description: `\`/setup\` \`/config\` \`/ping\` \`/about\` \`/afk\` \`/remind\` — Configuración, información y herramientas prácticas.` }
};

function menu(selected = 'home') {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId('cs_help_category')
    .setPlaceholder('Selecciona una categoría...')
    .addOptions([
      { label: 'Inicio', value: 'home', emoji: '🏠', default: selected === 'home' },
      { label: 'Moderación', value: 'moderation', emoji: '🛡️', default: selected === 'moderation' },
      { label: 'Tickets', value: 'tickets', emoji: '🎫', default: selected === 'tickets' },
      { label: 'Comunidad', value: 'community', emoji: '🌐', default: selected === 'community' },
      { label: 'Diversión', value: 'fun', emoji: '🎮', default: selected === 'fun' },
      { label: 'Economía y niveles', value: 'progression', emoji: '📈', default: selected === 'progression' },
      { label: 'Utilidades', value: 'utility', emoji: '🧰', default: selected === 'utility' }
    ]));
}

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cs_help_home').setLabel('Inicio').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    new ButtonBuilder().setCustomId('cs_help_setup').setLabel('Configurar bot').setStyle(ButtonStyle.Primary).setEmoji('⚙️')
  );
}

export async function execute(interaction) {
  const config = getGuildConfig(interaction.guildId, defaults);
  const selected = interaction.options.getString('categoria') ?? 'home';
  const section = sections[selected] ?? sections.home;
  const embed = baseEmbed(config.branding, {
    title: section.title,
    description: `${section.description}

🏷️ **Bot desarrollado por CS Studios**`,
    timestamp: true
  });
  await interaction.reply({ embeds: [embed], components: [menu(selected), buttons()] });

  const reply = await interaction.fetchReply();
  const collector = reply.createMessageComponentCollector({ time: 120000 });
  collector.on('collect', async i => {
    if (i.user.id !== interaction.user.id) return i.reply({ content: '⚠️ Este menú de ayuda pertenece a la persona que lo abrió.', ephemeral: true });
    if (i.isButton()) {
      if (i.customId === 'cs_help_home') {
        const e = baseEmbed(config.branding, { title: sections.home.title, description: `${sections.home.description}

🏷️ **Bot desarrollado por CS Studios**`, timestamp: true });
        return i.update({ embeds: [e], components: [menu('home'), buttons()] });
      }
      if (i.customId === 'cs_help_setup') return i.reply({ content: '⚙️ Usa `/setup` para abrir el configurador principal de CS Studios Bot.', ephemeral: true });
    }
    if (i.isStringSelectMenu() && i.customId === 'cs_help_category') {
      const key = i.values[0]; const sec = sections[key] ?? sections.home;
      const e = baseEmbed(config.branding, { title: sec.title, description: `${sec.description}

🏷️ **Bot desarrollado por CS Studios**`, timestamp: true });
      return i.update({ embeds: [e], components: [menu(key), buttons()] });
    }
  });
  collector.on('end', async () => {
    const disabledMenu = menu(selected);
    disabledMenu.components[0].setDisabled(true);
    const disabledButtons = buttons();
    for (const b of disabledButtons.components) b.setDisabled(true);
    await reply.edit({ components: [disabledMenu, disabledButtons] }).catch(() => {});
  });
}
