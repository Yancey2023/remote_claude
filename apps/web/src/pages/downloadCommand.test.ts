import { describe, expect, it } from 'vitest';
import { downloadCommand } from './downloadCommand';
import type { DownloadFileInfo } from '../types/protocol';

const file: DownloadFileInfo = {
  filename: 'remote-claude-desktop-client-v1.2.2-linux-x64',
  platform: 'linux', arch: 'x64', version: '1.2.2', size: 0, modified: '',
};

describe('downloadCommand', () => {
  it('downloads without credentials and launches against the deployed server', () => {
    const command = downloadCommand(file, '/remote_claude/api', '/remote_claude/ws/web', 'https://example.com/remote_claude/downloads');
    expect(command).toBe(`curl -fL 'https://example.com/remote_claude/api/downloads/${file.filename}' -o '${file.filename}' && chmod +x '${file.filename}' && SERVER_URL='wss://example.com/remote_claude/ws/client' './${file.filename}'`);
  });

  it('supports macOS and HTTP deployments', () => {
    const command = downloadCommand({ ...file, platform: 'darwin' }, '/api', '/ws/web', 'http://example.com:8080/downloads');
    expect(command).toContain("SERVER_URL='ws://example.com:8080/ws/client'");
    expect(command).toContain(' && chmod +x ');
  });

  it('uses PowerShell with terminating download errors on Windows', () => {
    const windows = { ...file, platform: 'windows', filename: 'client.exe' };
    expect(downloadCommand(windows, '/api', '/ws/web', 'https://example.com')).toBe("& { $ErrorActionPreference = 'Stop'; Invoke-WebRequest -Uri 'https://example.com/api/downloads/client.exe' -OutFile 'client.exe'; $env:SERVER_URL = 'wss://example.com/ws/client'; & '.\\client.exe' }");
  });

  it('quotes paths containing apostrophes in both shells', () => {
    const args = ['/team\'s/api', '/team\'s/ws/web', 'https://example.com'] as const;
    expect(downloadCommand(file, ...args)).toContain(`https://example.com/team'"'"'s/api/downloads/`);
    expect(downloadCommand({ ...file, platform: 'windows' }, ...args)).toContain("https://example.com/team''s/api/downloads/");
  });
});
