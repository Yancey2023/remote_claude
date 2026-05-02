import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastContainer, showToast } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing initially', () => {
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('shows toast after showToast is called', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('hello', 'info');
    });
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('shows multiple toasts', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('first', 'info');
      showToast('second', 'error');
    });
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByText('second')).toBeTruthy();
  });

  it('removes toast after 4 seconds', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('disappear', 'info');
    });
    expect(screen.getByText('disappear')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('disappear')).toBeNull();
  });

  it('shows toast with different types', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('error msg', 'error');
      showToast('success msg', 'success');
      showToast('info msg', 'info');
    });
    expect(screen.getByText('error msg')).toBeTruthy();
    expect(screen.getByText('success msg')).toBeTruthy();
    expect(screen.getByText('info msg')).toBeTruthy();
  });
});
