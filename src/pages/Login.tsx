import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) {
      // Use the REAL form (with type="password" input) to trigger
      // the browser's save-password prompt.
      const iframe = document.createElement('iframe');
      iframe.name = 'login-bridge';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const form = formRef.current!;
      const originalTarget = form.target;
      form.target = 'login-bridge';
      form.action = '/api/auth/login';
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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">登录 SnapUI</h1>
        <p className="auth-card__subtitle">欢迎回来，请输入您的账号信息</p>

        {error && <div className="auth-card__error">{error}</div>}

        <form className="auth-form" ref={formRef} onSubmit={handleSubmit}>
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
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button className="auth-form__btn" type="submit" disabled={isLoading}>
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="auth-card__footer">
          还没有账号？<Link to="/register">立即注册</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
