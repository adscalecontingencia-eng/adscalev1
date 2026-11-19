import React, { useState } from "react";
import { tr } from '@/i18n';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  BookOpen, CheckSquare, ExternalLink, Copy, ShieldCheck, Users, KeyRound,
  AlertTriangle, ArrowRight, ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

type Props = { trigger?: React.ReactNode };

const REQUIRED = [
  { name: "ads_read", get why() { return tr('meta.guide.why.ads_read'); } },
  { name: "ads_management", get why() { return tr('meta.guide.why.ads_management'); } },
  { name: "business_management", get why() { return tr('meta.guide.why.business_management'); } },
];
const OPTIONAL = [
  { name: "pages_show_list", get why() { return tr('meta.guide.why.pages_show_list'); } },
  { name: "pages_read_engagement", get why() { return tr('meta.guide.why.pages_read_engagement'); } },
  { name: "read_insights", get why() { return tr('meta.guide.why.read_insights'); } },
];

const copy = (text: string) => {
  navigator.clipboard.writeText(text).then(
    () => toast.success(tr('meta.guide.copied')),
    () => toast.error(tr('meta.guide.copyFail'))
  );
};

export const SystemUserTokenGuide: React.FC<Props> = ({ trigger }) => {
  const [step, setStep] = useState(1);
  const total = 5;

  return (
    <Dialog onOpenChange={(o) => { if (o) setStep(1); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <BookOpen size={14} /> {tr('meta.guide.howTo')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary" />
            {tr('meta.guide.title')}
          </DialogTitle>
          <div className="flex items-center gap-1 pt-2">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded ${i + 1 <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-2">
              {tr('meta.guide.step', { n: step, total })}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: tr('meta.guide.h1') }} />
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Users size={14} className="text-primary" /> {tr('meta.guide.s1a')}
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li>{tr('meta.guide.openBmBiz')}</li>
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h2') }} />
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h3') }} />
                </ol>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open("https://business.facebook.com/settings/system-users", "_blank")}
                >
                  {tr('meta.guide.openUsers')} <ExternalLink size={12} />
                </Button>
              </Card>
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck size={14} className="text-primary" /> {tr('meta.guide.s1b')}
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h4') }} />
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h5') }} />
                </ol>
              </Card>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: tr('meta.guide.h6') }} />
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Users size={14} className="text-primary" /> {tr('meta.guide.s2')}
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h7') }} />
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h8') }} />
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h9') }} />
                  <li>
                    <span dangerouslySetInnerHTML={{ __html: tr('meta.guide.access') }} />{" "}
                    <Badge variant="outline" className="ml-1">{tr('meta.guide.recommended')}</Badge>{" "}
                    <span dangerouslySetInnerHTML={{ __html: tr('meta.guide.atLeast') }} />
                  </li>
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h10') }} />
                </ol>
              </Card>
              <div className="flex gap-2 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded p-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span dangerouslySetInnerHTML={{ __html: tr('meta.guide.warn2') }} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: tr('meta.guide.h11') }} />
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <KeyRound size={14} className="text-primary" /> {tr('meta.guide.s3')}
                </div>
                <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h12') }} />
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h13') }} />
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h14') }} />
                </ul>
              </Card>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('meta.guide.required')}
                </div>
                {REQUIRED.map((s) => (
                  <div key={s.name} className="flex items-start gap-2 border border-primary/40 bg-primary/5 rounded p-2">
                    <CheckSquare size={16} className="text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded">{s.name}</code>
                        <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => copy(s.name)}>
                          <Copy size={11} />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.why}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('meta.guide.optional')}
                </div>
                {OPTIONAL.map((s) => (
                  <div key={s.name} className="flex items-start gap-2 border rounded p-2">
                    <CheckSquare size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded">{s.name}</code>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.why}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: tr('meta.guide.h15') }} />
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <ClipboardCheck size={14} className="text-primary" /> {tr('meta.guide.s4')}
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h16') }} />
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h17') }} />
                  <li>{tr('meta.guide.saveForm')}</li>
                </ol>
              </Card>
              <div className="flex gap-2 text-xs bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 rounded p-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  {tr('meta.guide.never')}
                </span>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: tr('meta.guide.h18') }} />
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck size={14} className="text-primary" /> {tr('meta.guide.s5')}
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h19') }} />
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h20') }} />
                  <li dangerouslySetInnerHTML={{ __html: tr('meta.guide.h21') }} />
                  <li>{tr('meta.guide.zero')}</li>
                </ol>
              </Card>
              <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30" dangerouslySetInnerHTML={{ __html: tr('meta.guide.h22') }} />
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            {tr('meta.guide.back')}
          </Button>
          {step < total ? (
            <Button className="gap-1" onClick={() => setStep((s) => Math.min(total, s + 1))}>
              {tr('meta.guide.next')} <ArrowRight size={14} />
            </Button>
          ) : (
            <Button
              className="gap-1"
              onClick={() => window.open("https://business.facebook.com/settings/system-users", "_blank")}
            >
              {tr('meta.guide.openNow')} <ExternalLink size={14} />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SystemUserTokenGuide;
