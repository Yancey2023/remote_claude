import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface Props {
  onCommand: (cmd: string) => void;
  onResize?: (cols: number, rows: number) => void;
  readOnly?: boolean;
}

export function Terminal({ onCommand, readOnly = false }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentLineRef = useRef('');

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#e94560',
        selectionBackground: '#4a4a8a',
        black: '#1a1a2e',
        red: '#e74c3c',
        green: '#2ecc71',
        yellow: '#f1c40f',
        blue: '#3498db',
        magenta: '#9b59b6',
        cyan: '#1abc9c',
        white: '#e0e0e0',
      },
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    // Welcome message
    term.writeln('\x1b[1;36mRemote Claude Terminal\x1b[0m');
    term.writeln('Type your prompt and press Enter to send.');
    term.writeln('');

    let currentLine = '';

    term.onKey(({ key, domEvent }) => {
      if (readOnly) return;

      if (domEvent.key === 'Enter') {
        const cmd = currentLine.trim();
        if (cmd) {
          term.writeln('');
          onCommand(cmd);
        }
        currentLine = '';
        currentLineRef.current = '';
      } else if (domEvent.key === 'Backspace') {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          currentLineRef.current = currentLine;
          term.write('\b \b');
        }
      } else if (domEvent.key.length === 1 && !domEvent.ctrlKey && !domEvent.metaKey) {
        currentLine += key;
        currentLineRef.current = currentLine;
        term.write(key);
      }
    });

    // Handle resize
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [onCommand, readOnly]);

  // Public API to write output
  const write = (data: string) => {
    xtermRef.current?.write(data);
  };

  const writeln = (data: string) => {
    xtermRef.current?.writeln(data);
  };

  const clear = () => {
    xtermRef.current?.clear();
  };

  // Expose methods via ref
  const terminalApi = { write, writeln, clear };
  (window as unknown as Record<string, unknown>)['__terminal_api'] = terminalApi;

  return (
    <div
      ref={terminalRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
      }}
    />
  );
}

// Helper to get terminal API from other components
export function getTerminal() {
  return (window as unknown as Record<string, { write: (d: string) => void; writeln: (d: string) => void; clear: () => void }>)['__terminal_api'];
}
