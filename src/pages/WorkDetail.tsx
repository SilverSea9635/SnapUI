import { UserAvatar } from '@/components/UserAvatar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PreviewFrame } from '@/components/Works/PreviewFrame';
import { CodeSurface } from '@/components/Works/CodeSurface';
import {
  deleteWork,
  fetchWork,
  recordWorkReference,
  toggleWorkFavorite,
  updateWork,
  type Work,
} from '@/hooks/worksApi';
import { useAuthStore, useUIStore } from '@/stores';
import { countCodeLines, formatDateTime, formatRelativeTime, normalizeTags } from '@/utils/works';
import './WorkDetail.css';

export default function WorkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const showToast = useUIStore((s) => s.showToast);

  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    fetchWork(id)
      .then((res) => {
        if (!cancelled) setWork(res.work);
      })
      .catch(() => {
        if (!cancelled) setWork(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const tags = useMemo(() => normalizeTags(work?.tags), [work]);

  // ─── 收藏 ───
  const handleFavorite = useCallback(async () => {
    if (!work) return;
    if (!token) {
      showToast('info', '登录后即可收藏作品');
      return;
    }

    const next = !work.favorited;
    setWork({ ...work, favorited: next, favoriteCount: Math.max(0, work.favoriteCount + (next ? 1 : -1)) });

    try {
      const res = await toggleWorkFavorite(work.id, next);
      setWork((prev) => (prev ? { ...prev, favorited: res.favorited, favoriteCount: res.favoriteCount } : prev));
      showToast('success', res.favorited ? '已收藏' : '已取消收藏');
    } catch {
      setWork(work);
      showToast('error', '操作失败，请稍后重试');
    }
  }, [work, token, showToast]);

  // ─── 引用：把原作品带进对话，用户描述改动后由 AI 产出新组件 ───
  const handleReference = useCallback(async () => {
    if (!work) return;
    if (!token) {
      showToast('info', '登录后即可引用作品做二次调整');
      navigate('/login', { state: { from: `/works/${work.id}` } });
      return;
    }

    setBusy(true);
    try {
      await recordWorkReference(work.id, '引用调整');
    } catch {
      // 引用记录只是统计用途，失败不拦用户的调整流程
    } finally {
      setBusy(false);
    }

    navigate('/chat', {
      state: {
        reference: {
          workId: work.id,
          title: work.title,
          author: work.author?.nickname || '匿名',
          code: work.sourceCode,
        },
      },
    });
  }, [work, token, showToast, navigate]);

  // ─── 删除（仅作者） ───
  const handleDelete = useCallback(async () => {
    if (!work) return;
    if (!window.confirm(`删除作品《${work.title}》？该操作不可恢复。`)) return;

    setBusy(true);
    try {
      await deleteWork(work.id);
      showToast('success', '作品已删除');
      navigate('/works', { replace: true });
    } catch {
      showToast('error', '删除失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }, [work, showToast, navigate]);

  // ─── 公开 / 私密切换 ───
  const handleTogglePublic = useCallback(async () => {
    if (!work) return;
    const next = !work.isPublic;
    setWork({ ...work, isPublic: next });
    try {
      const res = await updateWork(work.id, { isPublic: next });
      setWork(res.work);
      showToast('success', next ? '已公开到作品广场' : '已改为仅自己可见');
    } catch {
      setWork(work);
      showToast('error', '修改可见性失败');
    }
  }, [work, showToast]);

  if (loading) {
    return (
      <div className="wd-page">
        <div className="wd-loading">
          <div className="wd-spinner" />
          <span>加载作品...</span>
        </div>
      </div>
    );
  }

  if (!work) {
    return (
      <div className="wd-page">
        <div className="wd-missing">
          <h1>作品不存在或未公开</h1>
          <p>它可能已被作者删除，或者作者把它设成了仅自己可见。</p>
          <Link className="wd-btn wd-btn--primary" to="/gallery">回到作品广场</Link>
        </div>
      </div>
    );
  }

  const derived = work.sourceWorks ?? [];

  return (
    <div className="wd-page">
      {/* ─── 顶栏 ─── */}
      <div className="wd-topbar">
        <button className="wd-back" onClick={() => navigate(-1)} type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          返回
        </button>
        <Link className="wd-back" to="/gallery">作品广场</Link>
        {work.isOwner ? <Link className="wd-back" to="/works">我的作品</Link> : null}
      </div>

      <div className="wd-layout">
        {/* ─── 左：展台 ─── */}
        <div className="wd-stage">
          <PreviewFrame code={work.sourceCode} title={work.title} height={520} />
          <div className="wd-stage__ops">
            <button className="wd-btn" onClick={() => setFullscreen(true)} type="button">全屏预览</button>
            <button className="wd-btn" onClick={() => setCodeOpen((v) => !v)} type="button">
              {codeOpen ? '收起源码' : '查看源码'}
            </button>
          </div>
          {codeOpen ? (
            <div className="wd-code">
              <CodeSurface code={work.sourceCode} />
            </div>
          ) : null}
        </div>

        {/* ─── 右：档案 ─── */}
        <aside className="wd-aside">
          <header className="wd-head">
            <div className="wd-head__flags">
              <span className={`wd-flag${work.isPublic ? ' is-public' : ''}`}>
                {work.isPublic ? '公开' : '私密'}
              </span>
              <span className="wd-flag wd-flag--plain">{countCodeLines(work.sourceCode)} 行代码</span>
            </div>
            <h1 className="wd-title">{work.title}</h1>
            {work.sourceWork ? (
              <Link className="wd-lineage" to={`/works/${work.sourceWork.id}`}>
                <span aria-hidden="true">↳</span>
                引用自 {work.sourceWork.author?.nickname}《{work.sourceWork.title}》
              </Link>
            ) : (
              <p className="wd-lineage wd-lineage--origin"><span aria-hidden="true">✦</span>原创作品</p>
            )}
          </header>

          <div className="wd-author">
            <span className="wd-author__avatar" aria-hidden="true">
              <UserAvatar
                avatar={work.author?.avatar}
                nickname={work.author?.nickname}
              />
            </span>
            <span className="wd-author__meta">
              <b>{work.author?.nickname || '匿名'}</b>
              <time dateTime={work.createdAt}>{formatDateTime(work.createdAt)}（{formatRelativeTime(work.createdAt)}）</time>
            </span>
          </div>

          {work.description ? <p className="wd-desc">{work.description}</p> : null}

          {tags.length > 0 ? (
            <ul className="wd-tags">
              {tags.map((tag) => (
                <li key={tag}>
                  <Link className="wd-tag" to={`/gallery?q=${encodeURIComponent(tag)}`}>#{tag}</Link>
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="wd-stats">
            <div>
              <dt>收藏</dt>
              <dd>{work.favoriteCount}</dd>
            </div>
            <div>
              <dt>被引用</dt>
              <dd>{work.referenceCount}</dd>
            </div>
          </dl>

          <div className="wd-actions">
            <button
              className={`wd-btn wd-btn--primary${work.favorited ? ' is-on' : ''}`}
              onClick={handleFavorite}
              type="button"
              aria-pressed={work.favorited}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={work.favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l2.6 5.6 6 .8-4.3 4.2 1 6-5.3-2.9L6.7 19.6l1-6L3.4 9.4l6-.8z" />
              </svg>
              {work.favorited ? '已收藏' : '收藏'}
            </button>

            <button className="wd-btn wd-btn--hero" onClick={handleReference} disabled={busy} type="button">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h9l7 7v9a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
                <path d="M13 4v7h7" />
                <path d="M12 12v6M9 15h6" />
              </svg>
              引用并二次调整
            </button>
          </div>

          {work.isOwner ? (
            <div className="wd-owner">
              <span className="wd-owner__hint">这是你的作品</span>
              <div className="wd-owner__ops">
                <button className="wd-btn wd-btn--sm" onClick={handleTogglePublic} type="button">
                  {work.isPublic ? '改为仅自己可见' : '公开到广场'}
                </button>
                <button className="wd-btn wd-btn--sm wd-btn--danger" onClick={handleDelete} disabled={busy} type="button">
                  删除作品
                </button>
              </div>
            </div>
          ) : null}

          <p className="wd-tip">
            引用会把这件作品的源码带进对话，你描述要改的地方，AI 产出的新组件会自动记在你的作品里，
            并标注「引用自 {work.author?.nickname}」。
          </p>

          {derived.length > 0 ? (
            <div className="wd-derived">
              <h2 className="wd-derived__title">由此派生的作品（{derived.length}）</h2>
              <ul className="wd-derived__list">
                {derived.map((item) => (
                  <li key={item.id}>
                    <Link to={`/works/${item.id}`}>
                      {item.author?.nickname}《{item.title}》
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {/* ─── 全屏预览 ─── */}
      {fullscreen ? (
        <div className="wd-fullscreen" onClick={() => setFullscreen(false)} role="presentation">
          <div className="wd-fullscreen__panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="全屏预览">
            <div className="wd-fullscreen__bar">
              <span>{work.title}</span>
              <button className="wd-fullscreen__close" onClick={() => setFullscreen(false)} type="button" aria-label="关闭">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="wd-fullscreen__body">
              <PreviewFrame code={work.sourceCode} title={work.title} height="auto" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
