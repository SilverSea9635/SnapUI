import { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuthStore, useUIStore, useCreditsStore } from '@/stores';
import SignInButton from '@/components/SignInButton';

function Layout() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const balance = useCreditsStore((s) => s.balance);
  const fetchBalance = useCreditsStore((s) => s.fetchBalance);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const token = useAuthStore((s) => s.token);

  // On mount: if token exists but user is null, restore user from API
  useEffect(() => {
    if (token && !user) fetchUser();
  }, [token, user, fetchUser]);

  useEffect(() => {
    if (user) fetchBalance();
  }, [user, fetchBalance]);

  return (
    <div className="page">
      {/* ─── Nav ─── */}
      <nav className="nav">
        <Link className="nav__logo" to="/">
          Snap<span>UI</span>
        </Link>
        <ul className="nav__links">
          <li><Link className="nav__link" to="/quick-start">开始使用</Link></li>
          <li><a className="nav__link" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a></li>
          {user ? (
            <>
              <li className="nav__credits">
                <span className="nav__credits-icon">&#9733;</span>
                <span className="nav__credits-value">{balance}</span>
              </li>
              <li><SignInButton /></li>
              <li className="nav__user">
                <Link className="nav__username" to="/profile">{user.nickname}</Link>
                <button className="nav__link nav__logout" onClick={logout} type="button">退出</button>
              </li>
            </>
          ) : (
            <li><Link className="nav__link nav__link--login" to="/login">登录</Link></li>
          )}
          <li>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              type="button"
              aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
            >
              <span className="theme-toggle__track">
                <span>☀️</span>
                <span>🌙</span>
              </span>
              <span className="theme-toggle__thumb" />
            </button>
          </li>
        </ul>
      </nav>

      <Outlet />

      {/* ─── Footer ─── */}
      <footer className="footer">
        <span>© 2026 SnapUI</span>
        <ul className="footer__links">
          <li><a className="footer__link" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a></li>
          <li><Link className="footer__link" to="/quick-start">开始使用</Link></li>
        </ul>
      </footer>
    </div>
  );
}

export default Layout;