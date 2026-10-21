import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WorkCard } from '@/components/Works/WorkCard';
import {
  deleteWork,
  fetchWorks,
  toggleWorkFavorite,
  updateWork,
  type Work,
  type WorkListResult,
} from '@/hooks/worksApi';
import { useUIStore } from '@/stores';
import { normalizeTags, parseTagsInput } from '@/utils/works';
import './WorksPage.css';

const PAGE_SIZE = 12;

type TabKey = 'mine' | 'favorites';

type EditDraft = {
  id: number;
  title: string;
  description: string;
  tagsText: string;
  isPublic: boolean;
};

export default function WorksPage({ embedded = false }: { embedded?: boolean }) {
  const showToast = useUIStore((s) => s.showToast);

  const [tab, setTab] = useState<TabKey>('mine');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WorkListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [counts, setCounts] = useState<Record<TabKey, number>>({ mine: 0, favorites: 0 });

  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // ─── 列表加载 ───
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetchWorks({ scope: tab, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setCounts((prev) => ({ ...prev, [tab]: res.total }));
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, page, reloadNonce]);

  // ─── 两个标签的数量（进入页面时各取一次，切页时不重复请求） ───
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchWorks({ scope: 'mine', page: 1, pageSize: 1 }),
      fetchWorks({ scope: 'favorites', page: 1, pageSize: 1 }),
    ])
      .then(([mine, favorites]) => {
        if (cancelled) return;
        setCounts({ mine: mine.total, favorites: favorites.total });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const works = data?.works ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  const switchTab = (next: TabKey) => {
    if (next === tab) return;
    setTab(next);
    setPage(1);
  };

  // ─── 收藏 / 取消收藏（就地乐观更新） ───
  const handleToggleFavorite = useCallback(
    async (work: Work) => {
      const nextFavorited = !work.favorited;

      if (tab === 'favorites' && !nextFavorited) {
        setData((prev) => (prev ? { ...prev, works: prev.works.filter((w) => w.id !== work.id), total: Math.max(0, prev.total - 1) } : prev));
        setCounts((prev) => ({ ...prev, favorites: Math.max(0, prev.favorites - 1) }));
      } else {
        setData((prev) =>
          prev
            ? {
              ...prev,
              works: prev.works.map((w) =>
                w.id === work.id
                  ? { ...w, favorited: nextFavorited, favoriteCount: Math.max(0, w.favoriteCount + (nextFavorited ? 1 : -1)) }
                  : w,
              ),
            }
            : prev,
        );
      }

      try {
        const res = await toggleWorkFavorite(work.id, nextFavorited);
        setData((prev) =>
          prev
            ? {
              ...prev,
              works: prev.works.map((w) =>
                w.id === work.id ? { ...w, favorited: res.favorited, favoriteCount: res.favoriteCount } : w,
              ),
            }
            : prev,
        );
        showToast('success', res.favorited ? '已收藏' : '已取消收藏');
      } catch {
        showToast('error', '操作失败，正在刷新列表');
        reload();
      }
    },
    [tab, showToast, reload],
  );

  // ─── 删除自己的作品 ───
  const handleDelete = useCallback(
    async (work: Work) => {
      if (!window.confirm(`删除作品《${work.title}》？该操作不可恢复。`)) return;

      setBusyId(work.id);
      try {
        await deleteWork(work.id);
        setData((prev) => (prev ? { ...prev, works: prev.works.filter((w) => w.id !== work.id), total: Math.max(0, prev.total - 1) } : prev));
        setCounts((prev) => ({ ...prev, [tab]: Math.max(0, prev[tab] - 1) }));
        showToast('success', '作品已删除');
      } catch {
        showToast('error', '删除失败，请稍后重试');
      } finally {
        setBusyId(null);
      }
    },
    [showToast, tab],
  );

  // ─── 公开 / 私密切换 ───
  const handleTogglePublic = useCallback(
    async (work: Work) => {
      const nextPublic = !work.isPublic;
      setBusyId(work.id);
      setData((prev) =>
        prev ? { ...prev, works: prev.works.map((w) => (w.id === work.id ? { ...w, isPublic: nextPublic } : w)) } : prev,
      );
      try {
        await updateWork(work.id, { isPublic: nextPublic });
        showToast('success', nextPublic ? '已公开到作品广场' : '已改为仅自己可见');
      } catch {
        setData((prev) =>
          prev ? { ...prev, works: prev.works.map((w) => (w.id === work.id ? { ...w, isPublic: work.isPublic } : w)) } : prev,
        );
        showToast('error', '修改可见性失败');
      } finally {
        setBusyId(null);
      }
    },
    [showToast],
  );

  // ─── 编辑弹窗 ───
  const openEdit = (work: Work) => {
    setEditing({
      id: work.id,
      title: work.title,
      description: work.description || '',
      tagsText: normalizeTags(work.tags).join(' '),
      isPublic: work.isPublic,
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      showToast('error', '标题不能为空');
      return;
    }

    setSaving(true);
    try {
      const { work } = await updateWork(editing.id, {
        title: editing.title.trim(),
        description: editing.description.trim(),
        tags: parseTagsInput(editing.tagsText),
        isPublic: editing.isPublic,
      });
      setData((prev) => (prev ? { ...prev, works: prev.works.map((w) => (w.id === work.id ? work : w)) } : prev));
      setEditing(null);
      showToast('success', '作品信息已更新');
    } catch {
      showToast('error', '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const gridClass = useMemo(() => `works-grid${showPreview ? '' : ' works-grid--compact'}`, [showPreview]);

  const goToPage = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`works-page${embedded ? ' works-page--embedded' : ''}`}>
      {/* ─── 页首 ─── */}
      <header className="works-head">
        <div className="works-head__row">
          <div>
            {embedded ? <h2 className="works-head__title">个人作品集</h2> : <h1 className="works-head__title">我的作品</h1>}
            <p className="works-head__desc">
              引用别人作品后调整出来的成品会自动记在这里；收藏过的作品留在第二个标签里。
            </p>
          </div>
          <div className="works-head__actions">
            <Link className="works-head__link" to="/gallery">去作品广场逛逛</Link>
            <button
              className={`works-head__toggle${showPreview ? ' is-on' : ''}`}
              onClick={() => setShowPreview((v) => !v)}
              type="button"
              aria-pressed={showPreview}
            >
              <span className="works-head__toggle-track"><span className="works-head__toggle-thumb" /></span>
              实时预览
            </button>
          </div>
        </div>

        <div className="works-tabs" role="tablist" aria-label="作品分类">
          <button
            className={`works-tab${tab === 'mine' ? ' is-active' : ''}`}
            onClick={() => switchTab('mine')}
            role="tab"
            aria-selected={tab === 'mine'}
            type="button"
          >
            我创建的
            <span className="works-tab__count">{counts.mine}</span>
          </button>
          <button
            className={`works-tab${tab === 'favorites' ? ' is-active' : ''}`}
            onClick={() => switchTab('favorites')}
            role="tab"
            aria-selected={tab === 'favorites'}
            type="button"
          >
            我收藏的
            <span className="works-tab__count">{counts.favorites}</span>
          </button>
        </div>
      </header>

      {/* ─── 列表 ─── */}
      <div className="works-results">
        {loading ? (
          <div className="works-loading">
            <div className="works-spinner" />
            <span>加载中...</span>
          </div>
        ) : failed ? (
          <div className="works-state">
            <p className="works-state__title">列表加载失败</p>
            <button className="works-state__btn" onClick={reload} type="button">重试</button>
          </div>
        ) : works.length === 0 ? (
          <div className="works-state">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.35" aria-hidden="true">
              <path d="M4 19V5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
              <path d="M14 3v5h5" />
            </svg>
            <p className="works-state__title">
              {tab === 'mine' ? '你还没有作品' : '还没有收藏任何作品'}
            </p>
            <p className="works-state__hint">
              {tab === 'mine'
                ? '去作品广场挑一件，引用它做二次调整，成品就会记在你的名下。'
                : '在作品广场点卡片上的星标即可收藏。'}
            </p>
            <Link className="works-state__btn" to="/gallery">
              {tab === 'mine' ? '去作品广场' : '去收藏几件'}
            </Link>
          </div>
        ) : (
          <>
            <div className={gridClass}>
              {works.map((
                work,
                index
              ) => (
                <div className="works-cell" key={work.id}>
                  <WorkCard
                    work={work}
                    index={(page - 1) * PAGE_SIZE + index}
                    showPreview={showPreview}
                    onToggleFavorite={handleToggleFavorite}
                  />

                  <div className="works-cell__bar">
                    <span className={`works-cell__badge${work.isPublic ? ' is-public' : ''}`}>
                      {work.isPublic ? '已公开' : '仅自己可见'}
                    </span>

                    {work.isOwner ? (
                      <span className="works-cell__ops">
                        <button
                          className="works-cell__op"
                          onClick={() => handleTogglePublic(work)}
                          disabled={busyId === work.id}
                          type="button"
                        >
                          {work.isPublic ? '改为私密' : '公开到广场'}
                        </button>
                        <button className="works-cell__op" onClick={() => openEdit(work)} type="button">
                          编辑
                        </button>
                        <button
                          className="works-cell__op works-cell__op--danger"
                          onClick={() => handleDelete(work)}
                          disabled={busyId === work.id}
                          type="button"
                        >
                          删除
                        </button>
                      </span>
                    ) : (
                      <Link className="works-cell__op works-cell__op--link" to={`/works/${work.id}`}>
                        查看详情
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 ? (
              <nav className="works-pager" aria-label="分页">
                <button className="works-pager__btn" disabled={page <= 1} onClick={() => goToPage(page - 1)} type="button">
                  上一页
                </button>
                <span className="works-pager__info"><b>{page}</b> / {totalPages}</span>
                <button className="works-pager__btn" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} type="button">
                  下一页
                </button>
              </nav>
            ) : null}
          </>
        )}
      </div>

      {/* ─── 编辑弹窗 ─── */}
      {editing ? (
        <div className="works-modal" onClick={() => (saving ? null : setEditing(null))} role="presentation">
          <div className="works-modal__panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="编辑作品">
            <h2 className="works-modal__title">编辑作品信息</h2>

            <label className="works-modal__field">
              <span>标题</span>
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                maxLength={60}
                placeholder="给作品起个名字"
              />
            </label>

            <label className="works-modal__field">
              <span>描述</span>
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                maxLength={300}
                rows={3}
                placeholder="这个组件解决什么问题？"
              />
            </label>

            <label className="works-modal__field">
              <span>标签<span className="works-modal__hint">（空格或逗号分隔，最多 6 个）</span></span>
              <input
                value={editing.tagsText}
                onChange={(e) => setEditing({ ...editing, tagsText: e.target.value })}
                placeholder="仪表盘 图表 深色"
              />
            </label>

            <label className="works-modal__checkbox">
              <input
                type="checkbox"
                checked={editing.isPublic}
                onChange={(e) => setEditing({ ...editing, isPublic: e.target.checked })}
              />
              公开到作品广场（其他人可以浏览、收藏与引用）
            </label>

            <div className="works-modal__actions">
              <button className="works-modal__btn" onClick={() => setEditing(null)} disabled={saving} type="button">
                取消
              </button>
              <button className="works-modal__btn works-modal__btn--primary" onClick={handleSaveEdit} disabled={saving} type="button">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
