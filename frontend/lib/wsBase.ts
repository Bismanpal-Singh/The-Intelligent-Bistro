import { getApiBase } from './apiBase';

export function getVoiceWsUrl(): string {
  const httpBase = getApiBase();
  return `${httpBase.replace(/^http/, 'ws')}/voice/realtime`;
}
