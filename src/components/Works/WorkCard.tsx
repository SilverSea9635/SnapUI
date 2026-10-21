import { UserAvatar } from '@/components/UserAvatar';
import { memo, useState } from 'react';
import { WorkPreviewModal } from './WorkPreviewModal';
import { Link } from 'react-router-dom';
import { PreviewFrame } from './PreviewFrame';
import type { Work } from '@/hooks/worksApi';
import { formatRelativeTime, normalizeTags } from '@/utils/works';
import './WorkCard.css';

type Props = {
  work: Work;
  /** 点击收藏：父级负责乐观更新与失败回滚 */
  onToggleFavorite?: (work: Work) => void;
  /** 列表中的序号，用于渲染「№ 03」式藏品编号 */
  index?: number;
  /** 是否展示预览（广场上可一键收起全部预览以省性能） */
  showPreview?: boolean;
  onTagClick?: (tag: string) => void;
};

function WorkCardBase({ work, onToggleFavorite, index = 0, showPreview = true, onTagClick }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const tags = normalizeTags(work.tags);
  const badgeNo = `№ ${String(index + 1).padStart(2, '0')}`;

  return (
    <article className="work-card">
      {showPreview ? (
        <div className="work-card__preview">
          <div inert>
            <PreviewFrame
              code={work.sourceCode}
              title={work.title}
              lazy
              bare
              height={220}
            />
          </div>
          <button
            className="work-card__expand"
            type="button"
            aria-label={`放大预览《${work.title}》`}
            onClick={() => setPreviewOpen(true)}
          >
            <span>⤢ 放大预览</span>
          </button>
        </div>
      ) : (
        <Link
          className="work-card__plain"
          to={`/works/${work.id}`}
        >
          <span className="work-card__plain-mark">{badgeNo}</span>
          <span className="work-card__plain-title">{work.title}</span>
          <span className="work-card__plain-hint">点开查看预览与源码</span>
        </Link>
      )}

      <div className="work-card__body">
        <div className="work-card__head">
          <span className="work-card__no">{badgeNo}</span>
          <Link
            className="work-card__title"
            to={`/works/${work.id}`}
          >{work.title}
          </Link>

          <button
            className={`work-card__stamp${work.favorited ? ' is-on' : ''}`}
            onClick={() => onToggleFavorite?.(work)}
            type="button"
            aria-pressed={work.favorited}
            aria-label={work.favorited ? '取消收藏' : '收藏'}
            title={work.favorited ? '取消收藏' : '收藏'}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill={work.favorited ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            >
              <path d="M12 3l2.6 5.6 6 .8-4.3 4.2 1 6-5.3-2.9L6.7 19.6l1-6L3.4 9.4l6-.8z" />
            </svg>
            <span>{work.favoriteCount}</span>
          </button>
        </div>

        {work.description ? <p className="work-card__desc">{work.description}</p> : null}

        {tags.length > 0 ? (
          <ul className="work-card__tags">
            {tags.map((tag) => (
              <li key={tag}>
                <button
                  className="work-card__tag"
                  onClick={() => onTagClick?.(tag)}
                  type="button"
                >
                  #{tag}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="work-card__foot">
          <span className="work-card__author">
            <span
              className="work-card__avatar"
              aria-hidden="true"
            >
              <UserAvatar
                avatar={work.author?.avatar}
                nickname={work.author?.nickname}
              />
            </span>
            {work.author?.nickname || '匿名'}
          </span>
          <time
            className="work-card__time"
            dateTime={work.createdAt}
          >{formatRelativeTime(work.createdAt)}
          </time>
        </div>

        {work.sourceWork ? (
          <Link
            className="work-card__lineage"
            to={`/works/${work.sourceWork.id}`}
          >
            <span
              className="work-card__lineage-mark"
              aria-hidden="true"
            >↳
            </span>
            引用自 {work.sourceWork.author?.nickname}《{work.sourceWork.title}》
          </Link>
        ) : null}
      </div>
      {previewOpen && <WorkPreviewModal
        code={work.sourceCode}
        title={work.title}
        onClose={() => setPreviewOpen(false)}
                      />}
    </article>
  );
}

export const WorkCard = memo(WorkCardBase);
