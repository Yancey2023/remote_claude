import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { translate } from '../i18n';

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
      let disposed = false;

      const term = new XTerm({
        cursorBlink: false,
        cursorStyle: 'block',
        fontSize: 14,
        // Use a resilient cross-platform monospace stack to avoid blocked local font lookups
        // (e.g. Firefox privacy levels blocking Cascadia Code) and keep terminal rendering stable.
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        lineHeight: 1.25,
        theme: {
          background: '#1a1a2e',
          foreground: '#e0e0e0',
          cursor: 'transparent',
          cursorAccent: 'transparent',
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

      const reportSize = () => {
        onResizeRef.current?.(term.cols, term.rows);
      };

      // Delay fit to let xterm.js fully initialize the renderer
      const fitRaf = requestAnimationFrame(() => {
        if (disposed) return;
        try { fitAddon.fit(); } catch { /* ignore */ }
        reportSize();
      });

      term.writeln(`\x1b[1;36m${translate('terminalBanner')}\x1b[0m`);
      term.writeln(translate('terminalStarting'));
      term.writeln('');

      term.onData((data: string) => {
        if (readOnlyRef.current) return;
        onDataRef.current(data);
      });

      const handleResize = () => {
        try { fitAddon.fit(); } catch { /* ignore */ }
        reportSize();
      };
      window.addEventListener('resize', handleResize);
      const resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => handleResize())
        : null;
      resizeObserver?.observe(terminalRef.current);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      return () => {
        disposed = true;
        cancelAnimationFrame(fitRaf);
        window.removeEventListener('resize', handleResize);
        resizeObserver?.disconnect();
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
          minHeight: 0,
        }}
      />
    );
  },
);
