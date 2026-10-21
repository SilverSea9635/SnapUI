import { useEffect } from 'react';
import { useSigninStore, useUIStore } from '@/stores';
import './SignInButton.css';

function SignInButton() {
  const signedToday = useSigninStore((s) => s.signedToday);
  const nextReward = useSigninStore((s) => s.nextReward);
  const isLoading = useSigninStore((s) => s.isLoading);
  const fetchSigninStatus = useSigninStore((s) => s.fetchSigninStatus);
  const signin = useSigninStore((s) => s.signin);
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    fetchSigninStatus();
  }, [fetchSigninStatus]);

  const handleSignin = async () => {
    if (signedToday || isLoading) return;
    const result = await signin();
    if (result) {
      showToast('success', `签到成功，积分+${result.reward}，明日签到可获得积分${result.tomorrowReward}`);
    } else {
      const { error } = useSigninStore.getState();
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
