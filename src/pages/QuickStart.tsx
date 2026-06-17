import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chat } from '@/components/Chat/Chat.tsx';
import type { ChatComposePayload } from '@/components/Chat/Chat.tsx';
import './QuickStart.css';

/* ─── Data ─── */

const FLOW_STEPS = [
  {
    icon: '📄',
    title: '描述需求',
    desc: '上传 UI 截图，或用文字描述你想要的组件',
  },
  {
    icon: '⚡',
    title: 'AI 生成代码',
    desc: 'AI 实时分析需求，生成可运行的 React 组件',
  },
  {
    icon: '✨',
    title: '实时预览',
    desc: '代码在浏览器中即时编译渲染，所见即所得',
  },
] as const;

const PROMPT_TEMPLATES = [
  {
    icon: ' ',
    title: '登录表单',
    desc: '用户名、密码输入框 + 登录按钮',
    prompt: '帮我生成一个简洁的登录表单组件，包含用户名和密码输入框、登录按钮，带有基础的表单校验。',
  },
  {
    icon: ' ',
    title: '导航栏',
    desc: 'Logo + 导航链接 + 响应式菜单',
    prompt: '帮我生成一个响应式导航栏组件，左侧 Logo，右侧导航链接，移动端折叠为汉堡菜单。',
  },
  {
    icon: ' ',
    title: '数据表格',
    desc: '表头 + 分页 + 排序功能',
    prompt: '帮我生成一个数据表格组件，支持列排序、分页显示，带斑马纹样式。',
  },
  {
    icon: ' ',
    title: '卡片列表',
    desc: '图片 + 标题 + 描述的卡片网格',
    prompt: '帮我生成一个卡片列表组件，每张卡片包含图片、标题、描述文字，响应式网格布局。',
  },
  {
    icon: ' ',
    title: '仪表盘',
    desc: '统计卡片 + 图表区域',
    prompt: '帮我生成一个仪表盘概览组件，顶部放 4 个统计卡片（数字+标签），下方是简单的柱状图区域。',
  },
  {
    icon: ' ',
    title: '弹窗组件',
    desc: '遮罩层 + 标题 + 内容 + 按钮',
    prompt: '帮我生成一个 Modal 弹窗组件，带遮罩层、标题栏、内容区域、底部确认/取消按钮，支持点击遮罩关闭。',
  },
] as const;

const FLOAT_SYMBOLS = [
  '<', '/>', '{ }', '()', '=>', ';', '[ ]', '***',
  ':', '&&', '||', '===', '!==', '...', '?', '##',
  '**', '{}', '[]', '!=', '++', '--', '>>', '<<',
] as const;

/* ─── Component ─── */

function QuickStart() {
  const navigate = useNavigate();
  const guideRef = useRef<HTMLDivElement>(null);

  const goToChat = (prompt: string) => {
    navigate('/chat', { state: { prompt } });
  };

  const handleSendMessage = (payload: ChatComposePayload) => {
    goToChat(payload.text);
  };

  return (
    <div className="quickstart">
      {/* ─── Decorative Floating Symbols ─── */}
      <div className="qs-decoration qs-decoration--left" aria-hidden="true">
        {FLOAT_SYMBOLS.slice(0, 12).map((sym, i) => (
          <span
            key={i}
            className="qs-float-symbol"
            style={{
              top: `${4 + i * 7.5}%`,
              animationDelay: `${i * 0.35}s`,
              fontSize: `${0.65 + (i % 4) * 0.12}rem`,
            }}
          >
            {sym}
          </span>
        ))}
      </div>
      <div className="qs-decoration qs-decoration--right" aria-hidden="true">
        {FLOAT_SYMBOLS.slice(12).map((sym, i) => (
          <span
            key={i}
            className="qs-float-symbol"
            style={{
              top: `${6 + i * 7.5}%`,
              animationDelay: `${i * 0.35 + 0.15}s`,
              fontSize: `${0.65 + (i % 4) * 0.12}rem`,
            }}
          >
            {sym}
          </span>
        ))}
      </div>

      <div className="quickstart__guide-section" ref={guideRef}>
        {/* ─── Flow Guide ─── */}
        <div className="flow-guide">
          {FLOW_STEPS.map((step, i) => (
            <div key={i}>
              <div className="flow-step">
                <div className="flow-step__icon">{step.icon}</div>
                <p className="flow-step__number">Step {String(i + 1).padStart(2, '0')}</p>
                <h3 className="flow-step__title">{step.title}</h3>
                <p className="flow-step__desc">{step.desc}</p>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div className="flow-arrow" aria-hidden="true">→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Prompt Templates ─── */}
      <section>
        <header className="prompt-section__header">
          <p className="prompt-section__label">快速开始</p>
          <h2 className="prompt-section__title">选一个模板，一键生成</h2>
        </header>
        <div className="prompt-grid">
          {PROMPT_TEMPLATES.map((tpl, i) => (
            <button
              className="prompt-card"
              key={i}
              onClick={() => goToChat(tpl.prompt)}
              type="button"
            >
              <span className="prompt-card__icon">{tpl.icon}</span>
              <h3 className="prompt-card__title">{tpl.title}</h3>
              <p className="prompt-card__desc">{tpl.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Chat Input (navigates to /chat on send) ─── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Chat
          messages={[]}
          onSendMessage={handleSendMessage}
          welcomeText="我是 SnapUI，专注于将想法变为组件"
          welcomeDescription="上传一张截图、粘贴一段设计稿，或用一句话描述你要的组件，我来生成可运行的代码。"
          inputPlaceholder="描述你想要的组件，或上传截图，按 Enter 发送"
        />
      </div>
    </div>
  );
}

export default QuickStart;
