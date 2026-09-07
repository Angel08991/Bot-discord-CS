import { EmbedBuilder } from 'discord.js';
import { parseColor } from './format.js';

export function baseEmbed(branding, options = {}) {
  const embed = new EmbedBuilder()
    .setColor(parseColor(branding?.color))
    .setFooter({ text: branding?.footer || 'Bot desarrollado por CS Studios' });

  if (branding?.thumbnail) embed.setThumbnail(branding.thumbnail);
  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.url) embed.setURL(options.url);
  if (options.timestamp) embed.setTimestamp();
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.fields) embed.addFields(options.fields);

  return embed;
}
