import { useRef, useState } from 'react';
import { fetchImageAttachment, type ImageAttachment } from '@/hooks/attachmentsApi';

function ImageView({ attachment, className }: { attachment: ImageAttachment; className?: string }) {
  const [url, setUrl] = useState(attachment.url);
  const [failed, setFailed] = useState(false);
  const refreshed = useRef(false);
  const refresh = async () => {
    if (refreshed.current) { setFailed(true); return; }
    refreshed.current = true;
    try { const result = await fetchImageAttachment(attachment.id); setUrl(result.attachment.url); }
    catch { setFailed(true); }
  };
  if (failed) return <p className="chat__image-unavailable">截图暂时无法加载</p>;
  return <img
    className={className}
    src={url}
    alt={attachment.fileName || '历史截图'}
    onError={() => void refresh()}
         />;
}

export function AttachmentImage(props: { attachment: ImageAttachment; className?: string }) {
  return <ImageView
    key={`${props.attachment.id}:${props.attachment.url}`}
    {...props}
         />;
}
