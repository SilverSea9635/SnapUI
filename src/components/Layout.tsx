import { UserAvatar } from '@/components/UserAvatar';
import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuthStore, useUIStore, useCreditsStore } from '@/stores';
import SignInButton from '@/components/SignInButton';
import { NavSearch } from '@/components/NavSearch';
import './Layout.css';

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
        <Link
          className="nav__logo"
          to="/"
        >
          Snap<span>UI</span>
        </Link>
        <ul className="nav__links">
          <li><NavLink
            className="nav__link"
            to="/chat"
              >开始使用
              </NavLink>
          </li>
          <li><NavLink
            className="nav__link"
            to="/gallery"
              >作品广场
              </NavLink>
          </li>
          {user && <li><NavLink
            className="nav__link"
            to="/works"
                       >我的作品
                       </NavLink>
                   </li>}
          {user && <li><NavLink
            className="nav__link"
            to="/history"
                       >历史记录
                       </NavLink>
                   </li>}
          {/* GitHub 风格：搜索常驻导航栏，在非广场页回车即跳 /gallery?q=… */}
          <li className="nav__search-slot"><NavSearch /></li>
          <li><a
            className="nav__link"
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
              >GitHub
              </a>
          </li>
          {user ? (
            <>
              <li>
                <NavLink
                  className="nav__credits"
                  to="/credits"
                  aria-label={`积分余额 ${balance}`}
                >
                <span className="nav__credits-icon">&#9733;</span>
                <span className="nav__credits-value">{balance}</span>
                </NavLink>
              </li>
              <li><SignInButton /></li>
              <li className="nav__user">
                <NavLink
                  className="nav__username"
                  to="/profile"
                >
                  <span className="nav__avatar">
                    <UserAvatar
                      avatar={user.avatar}
                      nickname={user.nickname}
                    />
                  </span>
                  {user.nickname}
                </NavLink>
                <button
                  className="nav__link nav__logout"
                  onClick={logout}
                  type="button"
                >退出
                </button>
              </li>
            </>
          ) : (
            <li><NavLink
              className="nav__link nav__link--login"
              to="/login"
                >登录
                </NavLink>
            </li>
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
          <li><a
            className="footer__link"
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
              >GitHub
              </a>
          </li>
          <li><Link
            className="footer__link"
            to="/chat"
              >开始使用
              </Link>
          </li>
        </ul>
      </footer>
    </div>
  );
}

export default Layout;
