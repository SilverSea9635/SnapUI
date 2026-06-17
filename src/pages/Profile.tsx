import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore } from '@/stores';

function Profile() {
  const navigate = useNavigate();
  const { user, isLoading, error, updateProfile, changePassword, fetchUser } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);

  // Profile form
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');

  // Password form
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await updateProfile({ nickname, avatar });
    if (ok) {
      showToast('success', '个人资料已更新');
      fetchUser();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');

    if (newPwd.length < 6) {
      setPwdError('新密码至少 6 位');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('两次输入的密码不一致');
      return;
    }

    const ok = await changePassword(currentPwd, newPwd);
    if (ok) {
      showToast('success', '密码修改成功');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <button className="profile-card__back" onClick={() => navigate(-1)} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          返回
        </button>

        {/* ─── Avatar ─── */}
        <div className="profile-card__header">
          <div className="profile-card__avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.nickname} />
            ) : (
              <span>{user?.nickname?.[0]?.toUpperCase() || 'U'}</span>
            )}
          </div>
          <h1 className="profile-card__title">个人资料</h1>
          <p className="profile-card__subtitle">{user?.email}</p>
        </div>

        {error && <div className="auth-card__error">{error}</div>}

        {/* ─── Profile Form ─── */}
        <form className="auth-form" onSubmit={handleProfileSave}>
          <label className="auth-form__field">
            <span className="auth-form__label">昵称</span>
            <input
              className="auth-form__input"
              type="text"
              placeholder="您的昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </label>

          <label className="auth-form__field">
            <span className="auth-form__label">头像 URL</span>
            <input
              className="auth-form__input"
              type="url"
              placeholder="https://example.com/avatar.jpg"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
            />
          </label>

          <button className="auth-form__btn" type="submit" disabled={isLoading}>
            {isLoading ? '保存中...' : '保存资料'}
          </button>
        </form>

        {/* ─── Password Section ─── */}
        <div className="profile-card__divider" />

        <h2 className="profile-card__section-title">修改密码</h2>

        {pwdError && <div className="auth-card__error">{pwdError}</div>}

        <form className="auth-form" onSubmit={handleChangePassword}>
          <label className="auth-form__field">
            <span className="auth-form__label">当前密码</span>
            <input
              className="auth-form__input"
              type="password"
              placeholder="输入当前密码"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              required
            />
          </label>

          <label className="auth-form__field">
            <span className="auth-form__label">新密码</span>
            <input
              className="auth-form__input"
              type="password"
              placeholder="至少 6 位"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
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
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
            />
          </label>

          <button className="auth-form__btn" type="submit" disabled={isLoading}>
            {isLoading ? '修改中...' : '修改密码'}
          </button>
        </form>

        {/* ─── Account Info ─── */}
        <div className="profile-card__divider" />
        <div className="profile-card__info">
          <div className="profile-card__info-row">
            <span className="profile-card__info-label">邮箱</span>
            <span className="profile-card__info-value">{user?.email}</span>
          </div>
          <div className="profile-card__info-row">
            <span className="profile-card__info-label">积分余额</span>
            <span className="profile-card__info-value profile-card__info-value--accent">{user?.credits}</span>
          </div>
          <div className="profile-card__info-row">
            <span className="profile-card__info-label">注册时间</span>
            <span className="profile-card__info-value">{user?.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
