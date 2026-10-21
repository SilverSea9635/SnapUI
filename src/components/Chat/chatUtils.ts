export function formatTime(time: Date | number | string) {
  const date = time instanceof Date ? time : new Date(time);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatFileSize(size: number) {
  return `${(size / 1024).toFixed(0)} KB`;
}

// 提取完整的代码块（```tsx 或 ```jsx 包裹，且已闭合）
export function extractJSX(content: string): string | null {
  const match = content.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((
    resolve,
    reject
  ) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('图片读取失败'));
    };

    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}
