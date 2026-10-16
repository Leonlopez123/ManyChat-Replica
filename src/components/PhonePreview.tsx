import { ExternalLink } from 'lucide-react';
import { fillTemplate } from '@/lib/engine/text';

export interface PreviewData {
  keyword: string;
  publicReply?: string;
  openingText: string;
  openingButtonLabel: string;
  followGate: boolean;
  followPromptText: string;
  followButtonLabel: string;
  deliveryText: string;
  deliveryButtonLabel: string;
  bonusText?: string;
  bonusButtonLabel?: string;
}

const lead = { username: 'anna.beispiel', vorname: 'Anna' };

export function PhonePreview({ d }: { d: PreviewData }) {
  return (
    <div aria-hidden className="mx-auto w-[300px] rounded-[36px] border-8 border-fg bg-bg p-3 shadow-pop">
      <div className="mx-auto mb-3 h-1.5 w-20 rounded-full bg-line" />
      <p className="mb-1 text-[11px] font-semibold text-muted">Kommentare</p>
      <div className="mb-1 text-xs"><b>{lead.username}</b> {d.keyword || 'stichwort'}</div>
      {d.publicReply && <div className="mb-3 ml-4 text-xs"><b>du</b> {fillTemplate(d.publicReply, { username: lead.username })}</div>}
      <hr className="mb-3 border-line" />
      <p className="mb-2 text-center text-[11px] font-semibold text-muted">Direktnachricht an {lead.username}</p>
      <div className="space-y-2">
        <Bubble text={fillTemplate(d.openingText, { username: lead.username })} button={d.openingButtonLabel} />
        <Reply text={d.openingButtonLabel} />
        {d.followGate && (
          <>
            <Hint>falls Anna dir noch nicht folgt:</Hint>
            <Bubble text={fillTemplate(d.followPromptText, { vorname: lead.vorname })} button={d.followButtonLabel} />
            <Reply text={d.followButtonLabel} />
          </>
        )}
        <Bubble text={fillTemplate(d.deliveryText, lead)} button={d.deliveryButtonLabel} link />
        {d.bonusText && <Bubble text={fillTemplate(d.bonusText, lead)} button={d.bonusButtonLabel || 'Zur Website'} link />}
      </div>
    </div>
  );
}

function Bubble({ text, button, link }: { text: string; button: string; link?: boolean }) {
  return (
    <div className="max-w-[85%] overflow-hidden rounded-2xl bg-bubble-in text-[13px] leading-snug">
      <p className="px-3 py-2 whitespace-pre-wrap">{text || '…'}</p>
      <div className="flex items-center justify-center gap-1 border-t border-line bg-bg/60 py-1.5 text-[13px] font-semibold text-accent">
        {button || '…'} {link && <ExternalLink className="size-3" />}
      </div>
    </div>
  );
}

function Reply({ text }: { text: string }) {
  return <div className="ml-auto w-fit rounded-2xl bg-accent px-3 py-1.5 text-[13px] text-on-accent">{text || '…'}</div>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-[10px] text-muted">{children}</p>;
}
