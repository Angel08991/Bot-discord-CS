import { PermissionFlagsBits } from 'discord.js';

export function hasConfiguredStaffRole(interaction, config) {
  const ids = config?.moderation?.staffRoleIds ?? [];
  if (!Array.isArray(ids) || ids.length === 0) return false;
  return ids.some(id => interaction.member?.roles?.cache?.has(id));
}

export function canManageGuild(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

export function canModerate(interaction, config) {
  if (interaction.guild?.ownerId === interaction.user?.id) return true;
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    hasConfiguredStaffRole(interaction, config)
  );
}
