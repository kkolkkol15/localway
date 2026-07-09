import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useAdmin } from '../state/AdminContext.jsx';

export function Toast() {
  const { state, dispatch } = useAdmin();

  useEffect(() => {
    if (!state.toast) return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2600);
    return () => window.clearTimeout(timer);
  }, [state.toast, dispatch]);

  if (!state.toast) return null;

  return (
    <div className="toast">
      <CheckCircle2 size={18} />
      <span>{state.toast.message}</span>
    </div>
  );
}
