import { getGiveawayByMessage, getGiveawayEntries, endGiveaway } from '../../database/database.js';

export async function finishGiveaway(client, giveaway) {
  if (!giveaway || giveaway.ended) return false;
  const channel = client.channels.cache.get(giveaway.channel_id);
  if (!channel?.isTextBased()) return false;
  const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
  const entries = getGiveawayEntries(giveaway.id);
  const winners = chooseWinners(entries, giveaway.winners);
  endGiveaway(giveaway.id);
  if (message) {
    await message.edit({ components: [], embeds: message.embeds.map(embed => ({ ...embed.data, description: `${embed.description ?? ''}\n\n🏁 **SORTEO FINALIZADO**\n${winners.length ? `🎊 Ganadores: ${winners.map(id => `<@${id}>`).join(', ')}` : '😢 No hubo suficientes participantes.'}` })) }).catch(() => {});
  }
  if (winners.length) await channel.send(`🎉 ¡Felicidades ${winners.map(id => `<@${id}>`).join(', ')}! Ganaste **${giveaway.prize}**. ¡Disfruta tu premio!`);
  else await channel.send('😢 El sorteo terminó sin suficientes participantes.');
  return true;
}

function chooseWinners(entries, amount) {
  const pool = [...entries];
  const selected = [];
  while (pool.length && selected.length < amount) {
    const index = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}
