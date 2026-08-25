import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ReferralStatement from '@/components/client/ReferralStatement';
import ReferralAlerts from '@/components/client/ReferralAlerts';

const ReferralStatementPage: React.FC = () => {
  const { clientId } = useParams();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'support';
  const scopedId = isStaff ? (clientId ?? null) : null;

  const content = (
    <div className="space-y-5">
      <ReferralAlerts clientId={scopedId} />
      <ReferralStatement clientId={scopedId} />
    </div>
  );

  if (isStaff) return content;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-5">
        <Link to="/client-dashboard" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Dashboard
        </Link>
        {content}
      </div>
    </div>
  );
};

export default ReferralStatementPage;
