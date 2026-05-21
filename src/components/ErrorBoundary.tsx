import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        actor_id: user?.id ?? null,
        actor_email: user?.email ?? null,
        action: 'frontend_error',
        entity: 'app',
        metadata: {
          message: error.message,
          stack: error.stack?.slice(0, 4000),
          componentStack: info.componentStack?.slice(0, 4000),
          url: window.location.href,
        },
      });
    } catch { /* silent */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-destructive/40 rounded-xl p-6 text-center">
          <AlertTriangle size={40} className="text-destructive mx-auto mb-3" />
          <h1 className="font-display text-lg font-semibold mb-2">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Registramos o erro automaticamente. Tente recarregar a página.
          </p>
          {this.state.error?.message && (
            <pre className="text-[10px] text-left bg-secondary p-2 rounded mb-4 overflow-auto max-h-32 text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
          >
            <RefreshCw size={14} /> Recarregar
          </button>
        </div>
      </div>
    );
  }
}
