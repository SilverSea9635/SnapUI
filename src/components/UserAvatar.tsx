import { useState } from 'react';
import { API_BASE } from '@/utils/request';
import './UserAvatar.css';

export function UserAvatar({ avatar, nickname }: { avatar?: string | null; nickname?: string }) {
  const [failedUrl, setFailedUrl] = useState('');
  const src = avatar?.startsWith('/api/') ? `${API_BASE.replace(/\/$/, '')}${avatar}` : avatar;
  return (
    <span className="user-avatar">
      {src && failedUrl !== src ? (
        <img
          src={src}
          alt=""
          onError={() => setFailedUrl(src)}
        />
      ) : (nickname?.[0]?.toUpperCase() || 'U')}
    </span>
  );
}
