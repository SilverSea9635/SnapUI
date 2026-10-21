import { useUIStore } from '@/stores';
import './Toast.css';

function Toast() {
  const toast = useUIStore((s) => s.toast);

  if (!toast) return null;

  return (
    <div className={`toast toast--${toast.type}`}>
      {toast.message}
    </div>
  );
}

export default Toast;