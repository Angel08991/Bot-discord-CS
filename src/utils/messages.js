import { baseEmbed } from './embeds.js';

export function professionalEmbed(config, title, description, options = {}) {
  return baseEmbed(config?.branding, {
    title,
    description,
    fields: options.fields,
    image: options.image,
    thumbnail: options.thumbnail,
    timestamp: options.timestamp ?? true
  });
}

export async function replySuccess(interaction, config, title, description, options = {}) {
  const payload = { embeds: [professionalEmbed(config, `✅ ${title}`, description, options)], ephemeral: options.ephemeral ?? false };
  return interaction.reply(payload);
}

export async function replyError(interaction, config, title, description, options = {}) {
  const payload = { embeds: [professionalEmbed(config, `⚠️ ${title}`, description, options)], ephemeral: options.ephemeral ?? true };
  return interaction.reply(payload);
}

export async function replyInfo(interaction, config, title, description, options = {}) {
  const payload = { embeds: [professionalEmbed(config, `ℹ️ ${title}`, description, options)], ephemeral: options.ephemeral ?? true };
  return interaction.reply(payload);
}
