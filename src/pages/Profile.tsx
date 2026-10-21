import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, useUIStore } from '@/stores';
import WorksPage from './WorksPage';
import { ModelManager } from '@/components/ModelManager';
import { UserAvatar } from '@/components/UserAvatar';
import { readFileAsDataUrl } from '@/components/Chat/chatUtils';
import './Auth.css';
import './Profile.css';

function Profile() {
  const navigate = useNavigate();
  const [ searchParams, setSearchParams ] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = requestedTab === 'works' || requestedTab === 'models' ? requestedTab : 'info';
  // 第一次打开才加载作品，之后切换只隐藏面板，保留列表与编辑状态。
  const [ worksVisited, setWorksVisited ] = useState(activeTab === 'works');
  if (activeTab === 'works' && !worksVisited) setWorksVisited(true);
  const selectTab = (tab: 'info' | 'works' | 'models') => {
    if (tab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    if (tab !== 'info') next.set('tab', tab);
    else next.delete('tab');
    setSearchParams(next);
  };
  const { user, isLoading, error, updateProfile, changePassword, fetchUser } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);

  // Profile form
  const [ nickname, setNickname ] = useState(user?.nickname ?? '');
  const [ avatarUploading, setAvatarUploading ] = useState(false);
  const [ avatarError, setAvatarError ] = useState('');

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || avatarUploading) return;
    setAvatarError('');
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('头像原图大小不能超过 2MB，请选择较小的图片。');
      return;
    }
    if (![ 'image/png', 'image/jpeg', 'image/webp' ].includes(file.type)) {
      setAvatarError('请选择 PNG、JPEG 或 WebP 图片。');
      return;
    }
    setAvatarUploading(true);
    try {
      const data = await readFileAsDataUrl(file);
      await useAuthStore.getState().uploadAvatar(data, file.type);
      showToast('success', '头像已更新');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : '头像上传失败，请稍后重试');
    } finally {
      setAvatarUploading(false);
    }
  };

  // Password form
  const [ currentPwd, setCurrentPwd ] = useState('');
  const [ newPwd, setNewPwd ] = useState('');
  const [ confirmPwd, setConfirmPwd ] = useState('');
  const [ pwdError, setPwdError ] = useState('');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await updateProfile({ nickname });
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
        <button
          className="profile-card__back"
          onClick={ () => navigate(-1) }
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line
              x1="19"
              y1="12"
              x2="5"
              y2="12"
            />
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          返回
        </button>

        {/* ─── Avatar ─── */ }
        <div className="profile-card__header">
          <div className="profile-card__avatar">
            <UserAvatar
              avatar={ user?.avatar }
              nickname={ user?.nickname }
            />
          </div>
          <div><p className="profile-card__eyebrow">个人中心</p>
            <h1 className="profile-card__title">{ user?.nickname || '我的账号' }</h1>
            <p className="profile-card__subtitle">{ user?.email }</p>
          </div>
        </div>

        <div
          className="profile-tabs"
          role="tablist"
          aria-label="个人中心"
        >
          { ( [ { key:'info', label:'个人信息' }, { key:'works', label:'个人作品集' }, {
            key:'models',
            label:'模型管理'
          } ] as const ).map(({ key, label }) => (
            <button
              key={ key }
              id={ `profile-tab-${ key }` }
              type="button"
              role="tab"
              aria-selected={ activeTab === key }
              aria-controls={ `profile-panel-${ key }` }
              tabIndex={ activeTab === key ? 0 : -1 }
              className={ `profile-tab${ activeTab === key ? ' is-active' : '' }` }
              onClick={ () => selectTab(key) }
              onKeyDown={ (event) => {
                if ([ 'ArrowLeft', 'ArrowRight', 'Home', 'End' ].includes(event.key)) {
                  event.preventDefault();
                  const tabs = [ 'info', 'works', 'models' ] as const;
                  const index = tabs.indexOf(activeTab);
                  const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 2 : ( index + ( event.key === 'ArrowLeft' ? 2 : 1 ) ) % 3];
                  selectTab(next);
                  document.getElementById(`profile-tab-${ next }`)?.focus();
                }
              } }
            >{ label }
            </button>
          )) }
        </div>
        <div
          id="profile-panel-info"
          role="tabpanel"
          aria-labelledby="profile-tab-info"
          hidden={ activeTab !== 'info' }
        >
          { error && <div className="auth-card__error">{ error }</div> }
          <div className="profile-settings">
            <section className="profile-section">
              <h2 className="profile-card__section-title">基本资料</h2>
              <p className="profile-section__desc">设置昵称与头像，让大家认识你。</p>

              {/* ─── Profile Form ─── */ }
              <form
                className="auth-form"
                onSubmit={ handleProfileSave }
              >
                <label className="auth-form__field">
                  <span className="auth-form__label">昵称</span>
                  <input
                    className="auth-form__input"
                    type="text"
                    placeholder="您的昵称"
                    value={ nickname }
                    onChange={ (e) => setNickname(e.target.value) }
                    required
                  />
                </label>

                <label className="auth-form__field">
                  <span className="auth-form__label">自定义头像</span>
                  <input
                    className="auth-form__input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={ avatarUploading || isLoading }
                    onChange={ handleAvatarUpload }
                  />
                  <span className="profile-avatar-hint">支持 PNG、JPEG、WebP，原图最大 2MB；选择后上传保存。</span>
                </label>
                { avatarUploading && <p
                  className="profile-avatar-hint"
                  role="status"
                >头像上传中…
                </p> }
                { avatarError && <p
                  className="auth-card__error"
                  role="alert"
                >{ avatarError }
                </p> }

                <button
                  className="auth-form__btn"
                  type="submit"
                  disabled={ isLoading || avatarUploading }
                >
                  { isLoading ? '保存中...' : '保存资料' }
                </button>
              </form>

            </section>
            <section className="profile-section">

              <h2 className="profile-card__section-title">账号安全</h2>
              <p className="profile-section__desc">定期更新密码，保护你的账号与作品。</p>

              { pwdError && <div className="auth-card__error">{ pwdError }</div> }

              <form
                className="auth-form"
                onSubmit={ handleChangePassword }
              >
                <label className="auth-form__field">
                  <span className="auth-form__label">当前密码</span>
                  <input
                    className="auth-form__input"
                    type="password"
                    placeholder="输入当前密码"
                    value={ currentPwd }
                    onChange={ (e) => setCurrentPwd(e.target.value) }
                    required
                  />
                </label>

                <label className="auth-form__field">
                  <span className="auth-form__label">新密码</span>
                  <input
                    className="auth-form__input"
                    type="password"
                    placeholder="至少 6 位"
                    value={ newPwd }
                    onChange={ (e) => setNewPwd(e.target.value) }
                    minLength={ 6 }
                    required
                  />
                </label>

                <label className="auth-form__field">
                  <span className="auth-form__label">确认新密码</span>
                  <input
                    className="auth-form__input"
                    type="password"
                    placeholder="再次输入新密码"
                    value={ confirmPwd }
                    onChange={ (e) => setConfirmPwd(e.target.value) }
                    required
                  />
                </label>

                <button
                  className="auth-form__btn"
                  type="submit"
                  disabled={ isLoading }
                >
                  { isLoading ? '修改中...' : '修改密码' }
                </button>
              </form>

            </section>
          </div>
          <h2 className="profile-card__section-title profile-account-title">账号信息</h2>
          <div className="profile-card__info">
            <div className="profile-card__info-row">
              <span className="profile-card__info-label">邮箱</span>
              <span className="profile-card__info-value">{ user?.email }</span>
            </div>
            <div className="profile-card__info-row">
              <span className="profile-card__info-label">积分余额</span>
              <span className="profile-card__info-value profile-card__info-value--accent">{ user?.credits }</span>
            </div>
            <div className="profile-card__info-row">
              <span className="profile-card__info-label">注册时间</span>
              <span
                className="profile-card__info-value">{ user?.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '-' }</span>
            </div>
          </div>
        </div>
        <div
          id="profile-panel-works"
          role="tabpanel"
          aria-labelledby="profile-tab-works"
          hidden={ activeTab !== 'works' }
        >
          { worksVisited && <WorksPage embedded/> }
        </div>
        <div
          id="profile-panel-models"
          role="tabpanel"
          aria-labelledby="profile-tab-models"
          hidden={ activeTab !== 'models' }
        >
          { activeTab === 'models' && <ModelManager/> }
        </div>
      </div>
    </div>
  );
}

export default Profile;
