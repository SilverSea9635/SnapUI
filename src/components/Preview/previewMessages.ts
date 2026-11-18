export type PreviewTheme = 'light' | 'dark';

export type PreviewInit = {
  type: 'snapui-preview:init';
  script: string;
  compact: boolean;
  theme: PreviewTheme;
};

export type PreviewMessage =
  | { type: 'size'; height: number }
  | { type: 'error'; message: string };
