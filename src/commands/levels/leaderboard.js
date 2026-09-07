import { SlashCommandBuilder } from 'discord.js';
import { getLevelLeaderboard, getGuildConfig } from '../../database/database.js';
import { baseEmbed } from '../../utils/embeds.js';
import { loadDefaults } from '../../utils/config.js';
const defaults = loadDefaults();
export const data = new SlashCommandBuilder().setName('leaderboard').setDescription('Muestra el ranking de niveles.');
export async function execute(interaction) { const cfg=getGuildConfig(interaction.guild.id,defaults); if(!cfg.modules.levels) return interaction.reply({content:'❌ Los niveles están desactivados.',ephemeral:true}); const rows=getLevelLeaderboard(interaction.guild.id,10); const desc=rows.length?rows.map((r,i)=>`**${i+1}.** <@${r.user_id}> — Nivel **${r.level}** · ${r.xp.toLocaleString()} XP`).join('\n'):'Todavía no hay datos.'; return interaction.reply({embeds:[baseEmbed(cfg.branding,{title:'🏆 Leaderboard de Niveles',description:desc,timestamp:true})]}); }
