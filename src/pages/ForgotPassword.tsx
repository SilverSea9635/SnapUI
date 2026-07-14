import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';

function ForgotPassword() {
  const navigate = useNavigate();
  const { forgotPassword, resetPassword, isLoading, error } = useAuthStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    const ok = await forgotPassword(email);
    if (ok) {
      setStep(2);
      setSuccess('验证码已发送到您的邮箱，请查收');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccess('');

    if (newPassword !== confirm) {
      setLocalError('两次输入的密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      setLocalError('密码至少需要 6 位');
      return;
    }

    const ok = await resetPassword(email, code, newPassword);
    if (ok) {
      setSuccess('密码重置成功，即将跳转到登录页...');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">忘记密码</h1>
        <p className="auth-card__subtitle">
          {step === 1 ? '输入您的注册邮箱，我们将发送验证码' : '输入验证码和新密码'}
        </p>

        {displayError && <div className="auth-card__error">{displayError}</div>}
        {success && <div className="auth-card__success">{success}</div>}

        {step === 1 ? (
          <form className="auth-form" onSubmit={handleSendCode}>
            <label className="auth-form__field">
              <span className="auth-form__label">邮箱</span>
              <input
                className="auth-form__input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <button className="auth-form__btn" type="submit" disabled={isLoading}>
              {isLoading ? '发送中...' : '发送验证码'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleReset}>
            <label className="auth-form__field">
              <span className="auth-form__label">验证码</span>
              <input
                className="auth-form__input"
                type="text"
                placeholder="输入 6 位验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                required
              />
            </label>

            <label className="auth-form__field">
              <span className="auth-form__label">新密码</span>
              <input
                className="auth-form__input"
                type="password"
                placeholder="至少 6 位新密码"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>

            <label className="auth-form__field">
              <span className="auth-form__label">确认新密码</span>
              <input
                className="auth-form__input"
                type="password"
                placeholder="再次输入新密码"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>

            <button className="auth-form__btn" type="submit" disabled={isLoading}>
              {isLoading ? '重置中...' : '重置密码'}
            </button>

            <button
              className="auth-form__btn auth-form__btn--secondary"
              type="button"
              onClick={() => {
                setStep(1);
                setLocalError('');
                setSuccess('');
              }}
            >
              返回上一步
            </button>
          </form>
        )}

        <p className="auth-card__footer">
          <Link to="/login">返回登录</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;