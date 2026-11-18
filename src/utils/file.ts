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
