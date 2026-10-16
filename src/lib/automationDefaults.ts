import type { Automation } from '@/lib/db/schema';

// Vorbelegung für neue Automationen (eigene Texte).
export const DEFAULTS = {
  name: '',
  active: true,
  postScope: 'single' as Automation['postScope'],
  mediaId: '',
  mediaPermalink: '',
  mediaThumbnailUrl: '',
  keywords: [] as string[],
  excludeKeywords: [] as string[],
  publicReplies: ['Schau in deine DMs 📩', 'Hab dir gerade geschrieben ✉️', 'Ist unterwegs – check deine Nachrichten 🙌'],
  openingText: 'Hey {{vorname}}, sende ich dir gerne. Bist du denn schon gefolgt?',
  openingButtonLabel: 'Ja',
  followGate: true,
  followPromptText: 'Fast geschafft! Folg mir kurz und tipp dann auf „Erledigt“ – dann kommt es sofort.',
  followButtonLabel: 'Erledigt',
  maxFollowAttempts: 3,
  deliverWhenGateExhausted: true,
  deliveryText: 'Hier ist dein Leitfaden 👇',
  deliveryUrl: '',
  deliveryButtonLabel: 'Öffnen',
  bonusText: 'Und noch ein Extra für dich: Auf unserer Website findest du mehr dazu.',
  bonusUrl: 'https://teamfinanzblick.de',
  bonusButtonLabel: 'Zur Website',
};
export type AutomationValues = typeof DEFAULTS;

export function fromAutomation(a: Automation): AutomationValues {
  return {
    ...DEFAULTS,
    ...a,
    mediaId: a.mediaId ?? '',
    mediaPermalink: a.mediaPermalink ?? '',
    mediaThumbnailUrl: a.mediaThumbnailUrl ?? '',
    publicReplies: [...a.publicReplies, '', '', ''].slice(0, 3),
    bonusText: a.bonusText ?? '',
    bonusUrl: a.bonusUrl ?? '',
    bonusButtonLabel: a.bonusButtonLabel ?? 'Zur Website',
  };
}

