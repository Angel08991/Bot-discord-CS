import { SlashCommandBuilder } from 'discord.js';
import { getLevelProfile, getLevelRank } from '../../database/database.js';
import { baseEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../database/database.js';
import { loadDefaults } from '../../utils/config.js';

const defaults = loadDefaults();
export const data = new SlashCommandBuilder().setName('level').setDescription('Muestra el nivel y XP de un usuario.').addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(false));
export async function execute(interaction) {
  if (!interaction.guild) return interaction.reply({ content: '❌ Este comando solo funciona en servidores.', ephemeral: true });
  const cfg = getGuildConfig(interaction.guild.id, defaults);
  if (!cfg.modules.levels) return interaction.reply({ content: '❌ Los niveles están desactivados.', ephemeral: true });
  const user = interaction.options.getUser('usuario') ?? interaction.user;
  const p = getLevelProfile(interaction.guild.id, user.id);
  const rank = getLevelRank(interaction.guild.id, user.id);
  const next = Math.max(1, (p.level + 1) ** 2 * 100);
  const prev = Math.max(0, p.level ** 2 * 100);
  const progress = Math.max(0, p.xp - prev);
  const need = Math.max(1, next - prev);
  const filled = Math.min(14, Math.floor((progress / need) * 14));
  const bar = '█'.repeat(filled) + '░'.repeat(14-filled);
  return interaction.reply({ embeds: [baseEmbed(cfg.branding, { title: `⭐ Nivel de ${user.username}`, description: `**Nivel:** ${p.level}\n**XP:** ${p.xp.toLocaleString()}\n\`${bar}\`\n**Progreso:** ${Math.min(100, Math.floor(progress / need * 100))}%\n🏆 **Puesto:** #${rank}`, thumbnail: user.displayAvatarURL(), timestamp: true })] });
}
