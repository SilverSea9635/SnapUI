import { useEffect } from 'react';
import { useCreditsStore, useUIStore } from '@/stores';

function SignInButton() {
  const signedToday = useCreditsStore((s) => s.signedToday);
  const nextReward = useCreditsStore((s) => s.nextReward);
  const isLoading = useCreditsStore((s) => s.isLoading);
  const fetchSigninStatus = useCreditsStore((s) => s.fetchSigninStatus);
  const signin = useCreditsStore((s) => s.signin);
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    fetchSigninStatus();
  }, [fetchSigninStatus]);

  const handleSignin = async () => {
    if (signedToday || isLoading) return;
    const ok = await signin();
    if (ok) {
      const { consecutiveDays: days, nextReward: reward } = useCreditsStore.getState();
      showToast('success', `签到成功！连续${days}天 +${reward}积分`);
    } else {
      const { error } = useCreditsStore.getState();
      showToast('error', error || '签到失败');
    }
  };

  if (signedToday) {
    return (
      <button className="signin-btn signin-btn--done" type="button" disabled>
        <span className="signin-btn__icon">&#10003;</span>
        已签到
      </button>
    );
  }

  return (
    <button
      className="signin-btn"
      type="button"
      onClick={handleSignin}
      disabled={isLoading}
      title={`签到可获得${nextReward}积分`}
    >
      <span className="signin-btn__icon">&#9733;</span>
      签到 +{nextReward}
    </button>
  );
}

export default SignInButton;
