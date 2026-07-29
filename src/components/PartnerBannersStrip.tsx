import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Banner = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  link_url: string | null;
  placement: 'client_dashboard' | 'marketplace' | 'both';
  sort_order: number;
};

type Props = {
  placement: 'client_dashboard' | 'marketplace';
  className?: string;
};

const PartnerBannersStrip: React.FC<Props> = ({ placement, className }) => {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('partner_banners')
        .select('id,title,description,image_url,link_url,placement,sort_order')
        .eq('active', true)
        .in('placement', [placement, 'both'])
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (!cancelled) setBanners((data as Banner[]) || []);
    })();
    return () => { cancelled = true; };
  }, [placement]);

  if (!banners.length) return null;

  return (
    <section className={className ?? 'w-full'} aria-label="Partner banners">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
        <span className="h-px flex-1 bg-border/60" />
        <span>Parceiros</span>
        <span className="h-px flex-1 bg-border/60" />
      </div>
      <div className={`grid gap-3 ${banners.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {banners.map(b => {
          const inner = (
            <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl hover:border-primary/40 transition-all">
              <div className="aspect-[16/6] w-full overflow-hidden bg-muted/30">
                <img
                  src={b.image_url}
                  alt={b.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              {(b.title || b.description) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent p-3">
                  <p className="text-sm font-semibold text-foreground truncate">{b.title}</p>
                  {b.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{b.description}</p>
                  )}
                </div>
              )}
            </div>
          );
          return b.link_url ? (
            <a key={b.id} href={b.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block">
              {inner}
            </a>
          ) : (
            <div key={b.id}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
};

export default PartnerBannersStrip;
