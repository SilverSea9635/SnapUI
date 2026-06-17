import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LivePreview } from '@/components/Chat/LivePreview.tsx';
import { useAuthStore, useCreditsStore } from '@/stores';

const TAGLINE = '一帧截图，一个组件';

const EXAMPLES = [
  {
    title: '渐变按钮',
    desc: '带悬停动画的渐变按钮',
    prompt: '生成一个渐变按钮，带有悬停动画效果',
    code: `function Component() {
  return (
    <button style={{
      padding: '12px 32px',
      fontSize: '15px',
      fontWeight: 600,
      color: '#fff',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 6px 20px rgba(102,126,234,0.6)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 15px rgba(102,126,234,0.4)';
    }}>
      Get Started
    </button>
  );
}`,
  },
  {
    title: '标签页切换',
    desc: '可点击切换的内容标签页',
    prompt: '生成一个可点击切换的内容标签页组件',
    code: `function Component() {
  const [active, setActive] = React.useState(0);
  const tabs = ['概览', '详情', '设置'];
  const contents = [
    '这是概览页面的内容概览页面的内容概览页面的内容。',
    '这里是详细信息的展示区域。',
    '在此处管理你的偏好设置。',
  ];
  return (
    <div style={{ width: 320, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb' }}>
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActive(i)} style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
            fontSize: 14, fontWeight: active === i ? 600 : 400,
            color: active === i ? '#b8860b' : '#9ca3af',
            borderBottom: active === i ? '2px solid #b8860b' : '2px solid transparent',
            marginBottom: -2, cursor: 'pointer', transition: 'all 0.2s',
          }}>{tab}</button>
        ))}
      </div>
      <div style={{ padding: '16px 0', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
        {contents[active]}
      </div>
    </div>
  );
}`,
  },
  {
    title: '进度条',
    desc: '带动画的圆形进度指示器',
    prompt: '生成一个带动画的圆形进度指示器组件',
    code: `function Component() {
  const [value, setValue] = React.useState(72);
  const r = 40, c = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, fontFamily: 'system-ui' }}>
      <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
        <circle cx={50} cy={50} r={r} fill="none" stroke="#b8860b" strokeWidth={8}
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1c1917' }}>{value}%</div>
      <input type="range" min={0} max={100} value={value}
        onChange={e => setValue(+e.target.value)} style={{ width: 120 }} />
    </div>
  );
}`,
  },
] as const;

const SCENARIOS = [
  {
    number: '01',
    title: '截图即代码',
    desc: '上传任意 UI 截图，AI 自动识别布局与样式，生成可运行的 React 组件代码。',
  },
  {
    number: '02',
    title: '实时预览',
    desc: '生成的 TSX 代码在浏览器中即时编译渲染，所见即所得，无需等待构建。',
  },
  {
    number: '03',
    title: '快速原型',
    desc: '产品经理和设计师可以直接将灵感截图转化为可交互的前端原型，大幅缩短验证周期。',
  }
] as const;

const SIGNIN_REWARDS = [
  { day: 1, reward: 5 },
  { day: 2, reward: 5 },
  { day: 3, reward: 5 },
  { day: 4, reward: 10 },
  { day: 5, reward: 10 },
  { day: 6, reward: 10 },
  { day: 7, reward: 20 },
] as const;

function useTypingEffect(text: string, speed = 120, startDelay = 1000) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const start = setTimeout(() => {
      const tick = () => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1));
          i++;
          timeout = setTimeout(tick, speed);
        } else {
          setDone(true);
        }
      };
      tick();
    }, startDelay);

    return () => {
      clearTimeout(start);
      clearTimeout(timeout);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

function Home() {
  const { displayed, done } = useTypingEffect(TAGLINE, 140, 1200);
  const user = useAuthStore((s) => s.user);
  const balance = useCreditsStore((s) => s.balance);

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="hero">
        <div className="hero__badge">
          <span className="hero__badge-dot" />
          AI-Powered Component Generator
        </div>

        <h1 className="hero__title">
          从截图到<em>组件</em>
        </h1>

        <p className="hero__tagline">
          <span className="hero__tagline-text">{displayed}</span>
          {!done && <span className="hero__tagline-cursor" />}
        </p>

        <p className="hero__subtitle">
          上传一张 UI 截图，AI 自动生成可运行的 React 组件。
          <br />
          实时编译，即时预览，零配置开箱即用。
        </p>

        <div className="hero__actions">
          <Link className="hero__btn hero__btn--primary" to="/quick-start">
            开始使用
          </Link>
          <a className="hero__btn hero__btn--ghost" href="#scenarios">
            了解更多
          </a>
        </div>

        <div className="hero__divider" />
      </section>

      {/* ─── Scenarios ─── */}
      <section className="scenarios" id="scenarios">
        <header className="scenarios__header">
          <p className="scenarios__label">落地场景</p>
          <h2 className="scenarios__title">三件事，一张截图就够了</h2>
        </header>

        <div className="scenarios__grid">
          {SCENARIOS.map((s) => (
            <article className="scenario-card" key={s.number}>
              <p className="scenario-card__number">{s.number}</p>
              <h3 className="scenario-card__title">{s.title}</h3>
              <p className="scenario-card__desc">{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Showcase ─── */}
      <section className="showcase" id="showcase">
        <header className="showcase__header">
          <p className="showcase__label">效果展示</p>
          <h2 className="showcase__title">看看 AI 能生成什么</h2>
        </header>
        <div className="showcase__grid">
          {EXAMPLES.map((ex, i) => (
            <article className="showcase-card" key={i}>
              <div className="showcase-card__preview">
                <LivePreview code={ex.code} />
              </div>
              <div className="showcase-card__body">
                <h3 className="showcase-card__title">{ex.title}</h3>
                <p className="showcase-card__desc">{ex.desc}</p>
                <Link className="showcase-card__action" to="/chat" state={{ prompt: ex.prompt }}>
                  试试这个
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Sign-in Rewards ─── */}
      <section className="signin-rewards">
        <header className="signin-rewards__header">
          <p className="signin-rewards__label">每日签到</p>
          <h2 className="signin-rewards__title">签到领积分，免费生成组件</h2>
        </header>

        {user && (
          <p className="signin-rewards__balance">
            当前积分：<strong>{balance}</strong>
          </p>
        )}

        <div className="signin-rewards__grid">
          {SIGNIN_REWARDS.map((item) => (
            <div className="signin-rewards__day" key={item.day}>
              <span className="signin-rewards__day-num">第{item.day}天</span>
              <span className="signin-rewards__day-reward">{item.reward}</span>
              <span className="signin-rewards__day-unit">积分</span>
            </div>
          ))}
        </div>

        <p className="signin-rewards__info">
          每次 AI 生成消耗 5 积分 &middot; 7 天为一个签到周期，循环往复
        </p>
      </section>
    </>
  );
}

export default Home;