import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { WorkCard } from '@/components/Works/WorkCard';
import { fetchWorks, toggleWorkFavorite, type Work, type WorkListResult, type WorkSort } from '@/hooks/worksApi';
import { useAuthStore, useUIStore } from '@/stores';
import './Gallery.css';

const PAGE_SIZE = 12;

type SortKey = WorkSort | 'newest';
type Counts = { total: number; favorite: number; reference: number };

const EMPTY_COUNTS: Counts = { total: 0, favorite: 0, reference: 0 };

/** 只统计当前这一页：库里有多少作品是另一回事，这里要做的是"眼前这版面的热度" */
function countPage(works: Work[]): Counts {
  return works.reduce<Counts>(
    (
      acc,
      work
    ) => ({
      total: acc.total + 1,
      favorite: acc.favorite + (work.favoriteCount || 0),
      reference: acc.reference + (work.referenceCount || 0),
    }),
    { ...EMPTY_COUNTS },
  );
}

function SkeletonCard() {
  return (
    <div className="work-skeleton" aria-hidden="true">
      <div className="work-skeleton__stage" />
      <div className="work-skeleton__line" />
      <div className="work-skeleton__line work-skeleton__line--short" />
    </div>
  );
}

function Gallery() {
  const token = useAuthStore((s) => s.token);
  const showToast = useUIStore((s) => s.showToast);

  const [sort, setSort] = useState<SortKey>('newest');
  const [searchParams] = useSearchParams();
  // 支持从作品详情页点标签跳过来：/gallery?q=标签
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [page, setPage] = useState(1);
  const [showPreview, setShowPreview] = useState(true);

  // URL 上的 q 变化（例如从详情页再次跳转）时同步到搜索框
  const urlQ = searchParams.get('q');
  useEffect(() => {
    if (urlQ !== null) {
      setQ(urlQ);
      setPage(1);
    }
  }, [urlQ]);

  const [data, setData] = useState<WorkListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pageCounts, setPageCounts] = useState<Counts>(EMPTY_COUNTS);
  const [reloadNonce, setReloadNonce] = useState(0);

  const deferredQ = useDeferredValue(q);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const effectiveSort: WorkSort = sort === 'newest' ? 'latest' : sort;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetchWorks({ scope: 'public', sort: effectiveSort, q: deferredQ.trim() || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setPageCounts(countPage(res.works || []));
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
  }, [effectiveSort, deferredQ, page, reloadNonce]);

  const works = data?.works ?? [];
  // 收藏是唯一会就地改写数据的操作，用独立计数避免与翻页竞态
  const [favoriteToggles, setFavoriteToggles] = useState(0);

  useEffect(() => {
    if (favoriteToggles === 0) return;
    // 收藏数变了，重新拉一次让排序/计数与后端一致（静默，不闪加载态）
    fetchWorks({ scope: 'public', sort: effectiveSort, q: deferredQ.trim() || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setData(res);
        setPageCounts(countPage(res.works || []));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteToggles]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const handleSort = (next: SortKey) => {
    setSort(next);
    setPage(1);
  };

  const handleSearch = (value: string) => {
    setQ(value);
    setPage(1);
  };

  const handleToggleFavorite = useCallback(
    async (work: Work) => {
      if (!token) {
        showToast('info', '登录后即可收藏作品');
        return;
      }

      const nextFavorited = !work.favorited;
      // 乐观更新：印章动画要立刻给反馈，失败再回滚
      setData((prev) =>
        prev
          ? {
            ...prev,
            works: prev.works.map((item) =>
              item.id === work.id
                ? {
                  ...item,
                  favorited: nextFavorited,
                  favoriteCount: Math.max(0, item.favoriteCount + (nextFavorited ? 1 : -1)),
                }
                : item,
            ),
          }
          : prev,
      );

      try {
        const res = await toggleWorkFavorite(work.id, nextFavorited);
        setData((prev) =>
          prev
            ? {
              ...prev,
              works: prev.works.map((item) =>
                item.id === work.id
                  ? { ...item, favorited: res.favorited, favoriteCount: res.favoriteCount }
                  : item,
              ),
            }
            : prev,
        );
        showToast('success', res.favorited ? '已收藏' : '已取消收藏');
        setFavoriteToggles((n) => n + 1);
      } catch {
        setData((prev) =>
          prev
            ? { ...prev, works: prev.works.map((item) => (item.id === work.id ? work : item)) }
            : prev,
        );
        showToast('error', '收藏失败，请稍后重试');
      }
    },
    [token, showToast],
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      setQ(tag);
      setPage(1);
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [],
  );

  const gridClass = useMemo(
    () => `gallery-grid${showPreview ? '' : ' gallery-grid--compact'}`,
    [showPreview],
  );

  const goToPage = (next: number) => {
    setPage(next);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="gallery-page">
      {/* ─── 展签：只留标题与一句说明（搜索已移到导航栏） ─── */}
      <header className="gallery-hero">
        <div className="gallery-hero__inner">
          {/* 页面主标题（保留 h1 以维持语义/SEO） */}
          <h1 className="gallery-hero__eyebrow">SNAPUI · 作品广场</h1>
          <p className="gallery-hero__desc">
            这里陈列着社区里已经跑通的组件。看中哪个就收藏，或者直接引用它做二次调整
          </p>
        </div>
      </header>

      {/* ─── 结果栏：紧贴导航栏，排序在左、统计在右；搜索词来自地址栏 ─── */}
      <div className="gallery-bar">
        <div className="gallery-bar__inner">
          <div className="gallery-sort" role="tablist" aria-label="排序方式">
            <button
              className={`gallery-sort__btn${sort === 'newest' ? ' is-active' : ''}`}
              onClick={() => handleSort('newest')}
              role="tab"
              aria-selected={sort === 'newest'}
              type="button"
            >
              最新
            </button>
            <button
              className={`gallery-sort__btn${sort === 'hot' ? ' is-active' : ''}`}
              onClick={() => handleSort('hot')}
              role="tab"
              aria-selected={sort === 'hot'}
              type="button"
            >
              最热
            </button>
          </div>

          <div className="gallery-bar__meta">
            {q ? (
              <span className="gallery-bar__query">
                搜「{q}」· {data?.total ?? 0} 个结果
                <button className="gallery-bar__clear" onClick={() => handleSearch('')} type="button">
                  清空
                </button>
              </span>
            ) : (
              <span className="gallery-bar__stats">
                <b>{data?.total ?? 0}</b> 件公开作品 · 本页 <b>{pageCounts.favorite}</b> 次收藏 · 本页 <b>{pageCounts.reference}</b> 次被引用
              </span>
            )}

            {token ? (
              <Link className="gallery-bar__mine" to="/works">我的作品与收藏</Link>
            ) : null}

            <button
              className={`gallery-bar__preview${showPreview ? ' is-on' : ''}`}
              onClick={() => setShowPreview((v) => !v)}
              type="button"
              aria-pressed={showPreview}
              title={showPreview ? '收起实时预览（更省性能）' : '展开实时预览'}
              aria-label={showPreview ? '收起实时预览' : '展开实时预览'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
                <circle cx="12" cy="12" r="2.6" />
              </svg>
              实时预览
              <span className="gallery-bar__switch" aria-hidden="true">
                <span className="gallery-bar__thumb" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 结果 ─── */}
      <div className="gallery-results" ref={resultsRef}>
        {loading ? (
          <div className={gridClass}>
            {Array.from({ length: 6 }, (
              _,
              i
            ) => <SkeletonCard key={i} />)}
          </div>
        ) : failed ? (
          <div className="gallery-state">
            <p className="gallery-state__title">作品广场暂时打不开</p>
            <p className="gallery-state__hint">后端接口没有返回数据，稍后再试一次。</p>
            <button className="gallery-state__btn" onClick={() => setReloadNonce((n) => n + 1)} type="button">
              重试
            </button>
          </div>
        ) : works.length === 0 ? (
          <div className="gallery-state">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.35" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 15l5-5 4 4 3-3 6 6" />
              <circle cx="8.5" cy="8.5" r="1.4" />
            </svg>
            <p className="gallery-state__title">{q ? '没有匹配的作品' : '广场上还没有公开作品'}</p>
            <p className="gallery-state__hint">
              {q ? '换个关键词试试，或者清空搜索看全部。' : '在对话里生成组件后，点「发布到广场」就会出现在这里。'}
            </p>
            {q ? (
              <button className="gallery-state__btn" onClick={() => handleSearch('')} type="button">清空搜索</button>
            ) : (
              <Link className="gallery-state__btn" to="/chat">去生成第一个作品</Link>
            )}
          </div>
        ) : (
          <>
            <div className={gridClass}>
              {works.map((
                work,
                index
              ) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  index={(page - 1) * PAGE_SIZE + index}
                  showPreview={showPreview}
                  onToggleFavorite={handleToggleFavorite}
                  onTagClick={handleTagClick}
                />
              ))}
            </div>

            {totalPages > 1 ? (
              <nav className="gallery-pager" aria-label="分页">
                <button
                  className="gallery-pager__btn"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  type="button"
                >
                  上一页
                </button>
                <span className="gallery-pager__info">
                  <b>{page}</b> / {totalPages}
                </span>
                <button
                  className="gallery-pager__btn"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  type="button"
                >
                  下一页
                </button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default Gallery;
