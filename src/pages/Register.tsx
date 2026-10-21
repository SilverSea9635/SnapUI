import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import './Auth.css';

function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isLoading, error } = useAuthStore();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (password !== confirm) {
      setLocalError('两次输入的密码不一致');
      return;
    }
    const ok = await register(email, password, nickname);
    if (ok) {
      const iframe = document.createElement('iframe');
      iframe.name = 'register-bridge';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const form = formRef.current!;
      const originalTarget = form.target;
      form.target = 'register-bridge';
      form.action = '/api/auth/register';
      form.method = 'POST';
      form.submit();
      form.target = originalTarget;
      form.removeAttribute('action');

      const from = (location.state as { from?: string })?.from || '/';
      setTimeout(() => {
        iframe.remove();
        navigate(from, { replace: true });
      }, 200);
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">注册 SnapUI</h1>
        <p className="auth-card__subtitle">创建账号，开始使用 AI 组件生成</p>

        {displayError && <div className="auth-card__error">{displayError}</div>}

        <form className="auth-form" ref={formRef} onSubmit={handleSubmit}>
          <label className="auth-form__field">
            <span className="auth-form__label">昵称</span>
            <input
              className="auth-form__input"
              type="text"
              name="nickname"
              placeholder="您的昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </label>

          <label className="auth-form__field">
            <span className="auth-form__label">邮箱</span>
            <input
              className="auth-form__input"
              type="email"
              name="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-form__field">
            <span className="auth-form__label">密码</span>
            <input
              className="auth-form__input"
              type="password"
              name="password"
              placeholder="至少 6 位密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>

          <label className="auth-form__field">
            <span className="auth-form__label">确认密码</span>
            <input
              className="auth-form__input"
              type="password"
              name="confirm_password"
              placeholder="再次输入密码"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>

          <button className="auth-form__btn" type="submit" disabled={isLoading}>
            {isLoading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="auth-card__footer">
          已有账号？<Link to="/login">立即登录</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
