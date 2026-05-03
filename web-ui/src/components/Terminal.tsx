import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface Props {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  readOnly?: boolean;
}

export interface TerminalHandle {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
}

export const Terminal = forwardRef<TerminalHandle, Props>(
  ({ onData, onResize, readOnly = false }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    // Keep latest callbacks in refs so effect doesn't re-run on prop changes
    const onDataRef = useRef(onData);
    const onResizeRef = useRef(onResize);
    const readOnlyRef = useRef(readOnly);
    onDataRef.current = onData;
    onResizeRef.current = onResize;
    readOnlyRef.current = readOnly;

    useImperativeHandle(ref, () => ({
      write: (data: string) => xtermRef.current?.write(data),
      writeln: (data: string) => xtermRef.current?.writeln(data),
      clear: () => xtermRef.current?.clear(),
    }));

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

      term.writeln('\x1b[1;36mRemote Claude Terminal\x1b[0m');
      term.writeln('Starting interactive Claude session...');
      term.writeln('');

      term.onData((data: string) => {
        if (readOnlyRef.current) return;
        onDataRef.current(data);
      });

      const handleResize = () => {
        fitAddon.fit();
        onResizeRef.current?.(term.cols, term.rows);
      };
      window.addEventListener('resize', handleResize);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      return () => {
        window.removeEventListener('resize', handleResize);
        term.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      };
    }, []); // only mount once, use refs for latest callbacks

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
  },
);

// Helper to get terminal API from other components (kept for backward compat)
export function getTerminal() {
  return (window as unknown as Record<string, TerminalHandle | undefined>)['__terminal_api'];
}
