import { del, get, post } from '@/utils/request';
export type ImageAttachment = { id: string; fileName: string; mimeType: string; sizeBytes: number; width: number; height: number; sha256: string; url: string; expiresAt: number };
export const uploadImageAttachment = (
  data: string,
  mimeType: string,
  fileName: string
) => post<{ attachment: ImageAttachment }>('/api/attachments', { data, mimeType, fileName });
export const fetchImageAttachment = (id: string) => get<{ attachment: ImageAttachment }>(`/api/attachments/${id}`);

export const discardImageAttachment = (id: string) => del(`/api/attachments/${id}`);
