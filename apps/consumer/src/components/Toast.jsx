import { CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';
import { useAppState } from '../state/AppContext.jsx';

export function Toast() {
  const { state, dispatch } = useAppState();
  useEffect(() => {
    if (!state.toast) return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2600);
    return () => window.clearTimeout(timer);
  }, [state.toast, dispatch]);

  if (!state.toast) return null;
  return <div className="fixed bottom-5 left-4 right-4 z-50 mx-auto flex min-h-12 max-w-md items-center gap-2 rounded-card bg-zinc-950 px-4 font-semibold text-white shadow-soft"><CheckCircle2 size={19} />{state.toast.message}</div>;
}
