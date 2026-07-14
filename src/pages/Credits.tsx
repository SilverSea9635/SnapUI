import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreditsStore } from '@/stores';
import './Credits.css';

const PAGE_SIZE = 20;

const TYPE_CONFIG = {
  gift: { label: '赠送', icon: '🎁' },
  deduct: { label: '扣减', icon: '💸' },
  recharge: { label: '充值', icon: '💎' },
} as const;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const dayMs = 86400000;

  if (diff < dayMs && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 2 * dayMs) return '昨天';
  if (diff < 7 * dayMs) return `${Math.floor(diff / dayMs)}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function Credits() {
  const navigate = useNavigate();
  const {
    balance,
    transactions,
    transactionsTotal,
    transactionsPage,
    isLoading,
    fetchBalance,
    fetchTransactions,
  } = useCreditsStore();

  useEffect(() => {
    fetchBalance();
    fetchTransactions(1);
  }, [fetchBalance, fetchTransactions]);

  const totalPages = Math.ceil(transactionsTotal / PAGE_SIZE);

  return (
    <div className="credits-page">
      <div className="credits-container">
        <div className="credits-header">
          <button className="credits-back" onClick={() => navigate(-1)} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            返回
          </button>
          <h1 className="credits-header__title">积分明细</h1>
        </div>

        <div className="credits-balance">
          <div className="credits-balance__icon">★</div>
          <div className="credits-balance__info">
            <div className="credits-balance__label">当前积分余额</div>
            <div className="credits-balance__value">{balance}</div>
          </div>
        </div>

        <h2 className="credits-section-title">收支记录</h2>

        {isLoading ? (
          <div className="credits-loading">
            <div className="credits-spinner" />
            <span>加载中...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="credits-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.3">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p>暂无积分记录</p>
          </div>
        ) : (
          <>
            <div className="credits-list">
              {transactions.map((tx) => {
                const cfg = TYPE_CONFIG[tx.type] || TYPE_CONFIG.deduct;
                const isPositive = tx.type === 'gift' || tx.type === 'recharge';
                return (
                  <div key={tx.id} className="credits-item">
                    <div className={`credits-item__icon credits-item__icon--${tx.type}`}>
                      {cfg.icon}
                    </div>
                    <div className="credits-item__body">
                      <div className="credits-item__desc">{tx.description || cfg.label}</div>
                      <div className="credits-item__time">{formatDate(tx.createdAt)}</div>
                    </div>
                    <div className={`credits-item__amount ${isPositive ? 'credits-item__amount--positive' : 'credits-item__amount--negative'}`}>
                      {isPositive ? '+' : '-'}{tx.amount}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="credits-pagination">
                <button
                  className="credits-page-btn"
                  disabled={transactionsPage <= 1}
                  onClick={() => fetchTransactions(transactionsPage - 1)}
                  type="button"
                >
                  上一页
                </button>
                <span className="credits-page-info">{transactionsPage} / {totalPages}</span>
                <button
                  className="credits-page-btn"
                  disabled={transactionsPage >= totalPages}
                  onClick={() => fetchTransactions(transactionsPage + 1)}
                  type="button"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Credits;
