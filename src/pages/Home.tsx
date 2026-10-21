import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LivePreview } from '@/components/Chat/LivePreview.tsx';
import './Home.css';


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

function Home() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [active, setActive] = useState(0);
  const [view, setView] = useState<'preview' | 'code'>('preview');

  return (
    <main className="studio-home">
      <section className="studio-hero">
        <div className="studio-intro">
          <div className="studio-eyebrow"><span /> 你的下一件作品，从这里开始</div>
          <h1>让灵感成形。<br /><span>让创作，更简单。</span></h1>
          <p className="studio-description">一句描述，一张截图。把脑海中的想法变成可以交互的 React 组件，在每一次预览中，离理想的设计更近一步。</p>
          <form className="idea-box" onSubmit={e => { e.preventDefault(); if (prompt.trim()) navigate('/chat', { state: { prompt: prompt.trim() } }); }}>
            <label htmlFor="idea-prompt">你想创造什么？</label>
            <textarea id="idea-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="例如：一个简洁的任务管理面板，带进度统计…" rows={2} required />
            <div className="idea-box__bottom"><span>✧ 从想法到组件</span><button type="submit">开始创作 <span>↗</span></button></div>
          </form>
          <div className="starter-ideas"><span>试试：</span>{EXAMPLES.map(ex => <button key={ex.title} onClick={() => setPrompt(ex.prompt)}>{ex.title} ↗</button>)}</div>
          <div className="studio-note"><span className="note-icon">✓</span> 实时预览 <span className="note-icon">✓</span> 可编辑代码 <span className="note-icon">✓</span> 灵感持续复用</div>
        </div>
        <div className="studio-demo">
          <div className="demo-caption"><span>灵感 → 代码 → 你的作品</span><span>LIVE PLAYGROUND</span></div>
          <div className="demo-window">
            <div className="demo-toolbar"><div className="window-dots"><i /><i /><i /></div><span>component.tsx</span><span className="demo-status">● 实时预览</span></div>
            <div className="demo-tabs"><div>{EXAMPLES.map((
              ex,
              i
            ) => <button key={ex.title} className={active === i ? 'is-active' : ''} onClick={() => setActive(i)}>{ex.title}</button>)}
                                       </div><button className="code-toggle" onClick={() => setView(view === 'preview' ? 'code' : 'preview')}>{view === 'preview' ? '〈/〉 代码' : '◫ 预览'}</button>
            </div>
            <div className="demo-canvas">{view === 'preview' ? <><div className="canvas-label">INTERACTIVE COMPONENT</div><LivePreview code={EXAMPLES[active].code} /><div className="canvas-hint">点击组件，体验真实交互</div></> : <pre className="demo-code"><code>{EXAMPLES[active].code}</code></pre>}</div>
            <div className="demo-message"><span className="ai-mark">✧</span><div><strong>你的灵感，已经准备就绪</strong><p>继续描述，让每一个细节都恰到好处。</p></div><Link to="/chat" state={{ prompt: EXAMPLES[active].prompt }} aria-label="使用当前示例开始创作">↗</Link></div>
          </div>
          <div className="demo-footnote"><span>REACT + TSX</span><span>为创造者而设计 ✦</span></div>
        </div>
      </section>
      <section className="workflow" id="scenarios">
        <div className="section-heading"><div><p className="section-kicker">LESS FRICTION. MORE CREATION.</p><h2>从一个想法，到无限可能</h2></div><p>把重复的工作交给 AI，<br />把时间留给更好的想法。</p></div>
        <div className="workflow-grid">{SCENARIOS.map((
          s,
          i
        ) => <article key={s.number}><div className="workflow-top"><span className="workflow-icon">{['◈', '◫', '↗'][i]}</span><span>{s.number} /</span></div><h3>{s.title}</h3><p>{s.desc}</p></article>)}
        </div>
      </section>
      <section className="explore-banner"><div><p className="section-kicker">MADE TO BE REMIXED</p><h2>好设计，值得成为新的起点。</h2><p>发现社区里的精彩组件，收藏、引用，再加入你自己的想法。</p></div><Link to="/gallery">探索作品广场 <span>↗</span></Link></section>
    </main>
  );
}

export default Home;
