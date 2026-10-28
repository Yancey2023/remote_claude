import type { DownloadFileInfo } from '../types/protocol';

export function downloadCommand(
  file: DownloadFileInfo,
  apiBaseUrl: string,
  wsBaseUrl: string,
  pageUrl: string,
): string {
  const url = new URL(`${apiBaseUrl}/downloads/${encodeURIComponent(file.filename)}`, pageUrl);
  const server = new URL(wsBaseUrl.replace(/\/web$/, '/client'), pageUrl);
  server.protocol = server.protocol === 'https:' || server.protocol === 'wss:' ? 'wss:' : 'ws:';

  if (file.platform === 'windows') {
    const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
    return `& { $ErrorActionPreference = 'Stop'; Invoke-WebRequest -Uri ${quote(url.href)} -OutFile ${quote(file.filename)}; $env:SERVER_URL = ${quote(server.href)}; & ${quote(`.\\${file.filename}`)} }`;
  }

  const quote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
  return `curl -fL ${quote(url.href)} -o ${quote(file.filename)} && chmod +x ${quote(file.filename)} && SERVER_URL=${quote(server.href)} ${quote(`./${file.filename}`)}`;
}
