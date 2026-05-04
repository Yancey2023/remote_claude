import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from './AdminPage';
import { useI18nStore } from '../i18n';

const mockListUsers = vi.fn();
const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockToggleUserStatus = vi.fn();
let mockUsers: Array<{
  id: string;
  username: string;
  role: string;
  enabled: boolean;
  created_at: number;
}> = [];

vi.mock('../api/client', () => ({
  apiClient: {
    listUsers: (...args: unknown[]) => mockListUsers(...args),
    createUser: (...args: unknown[]) => mockCreateUser(...args),
    deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
    toggleUserStatus: (...args: unknown[]) => mockToggleUserStatus(...args),
  },
}));

vi.mock('../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUsers = [];
  mockListUsers.mockReset();
  mockCreateUser.mockReset();
  mockDeleteUser.mockReset();
  mockToggleUserStatus.mockReset();
  mockListUsers.mockResolvedValue([]);
  useI18nStore.setState({ locale: 'en' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminPage', () => {
  it('renders admin title', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeTruthy();
    });
  });

  it('shows loading state', () => {
    mockListUsers.mockReturnValue(new Promise(() => {})); // never resolves

    renderPage();

    expect(screen.getByText('Loading users...')).toBeTruthy();
  });

  it('shows no users message when list is empty', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No users found/)).toBeTruthy();
    });
  });

  it('displays user list', async () => {
    mockUsers = [
      { id: 'u1', username: 'alice', role: 'User', enabled: true, created_at: 1700000000 },
      { id: 'u2', username: 'bob', role: 'User', enabled: false, created_at: 1700000001 },
    ];
    mockListUsers.mockResolvedValue(mockUsers);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
      expect(screen.getByText('bob')).toBeTruthy();
    });
    expect(screen.getByText('Enabled')).toBeTruthy();
    expect(screen.getByText('Disabled')).toBeTruthy();
  });

  it('shows error when fetching users fails', async () => {
    mockListUsers.mockRejectedValue(new Error('fail'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch users')).toBeTruthy();
    });
  });

  describe('create user', () => {
    it('shows create form when clicking Add User', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Add User')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Add User'));

      expect(screen.getByText('Create')).toBeTruthy();
    });

    it('creates user successfully', async () => {
      mockCreateUser.mockResolvedValue({ id: 'u3', username: 'charlie', role: 'User', enabled: true, created_at: 1700000002 });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Add User')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Add User'));

      const usernameInput = screen.getByPlaceholderText('Username');
      const passwordInput = screen.getByPlaceholderText('Password');

      fireEvent.change(usernameInput, { target: { value: 'charlie' } });
      fireEvent.change(passwordInput, { target: { value: 'pass123' } });

      fireEvent.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(mockCreateUser).toHaveBeenCalledWith('charlie', 'pass123');
      });
    });

    it('shows error when user creation fails', async () => {
      mockCreateUser.mockRejectedValue(new Error('fail'));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Add User')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Add User'));

      const usernameInput = screen.getByPlaceholderText('Username');
      const passwordInput = screen.getByPlaceholderText('Password');

      fireEvent.change(usernameInput, { target: { value: 'charlie' } });
      fireEvent.change(passwordInput, { target: { value: 'pass123' } });

      fireEvent.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(screen.getByText('Failed to create user')).toBeTruthy();
      });
    });

    it('disables create button when inputs are invalid', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Add User')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Add User'));

      const createBtn = screen.getByText('Create');
      expect(createBtn).toBeDisabled();

      // Empty username
      const usernameInput = screen.getByPlaceholderText('Username');
      const passwordInput = screen.getByPlaceholderText('Password');
      fireEvent.change(passwordInput, { target: { value: 'abc' } });
      expect(createBtn).toBeDisabled();

      // Password too short
      fireEvent.change(usernameInput, { target: { value: 'user' } });
      fireEvent.change(passwordInput, { target: { value: '12345' } });
      expect(createBtn).toBeDisabled();

      // Valid
      fireEvent.change(passwordInput, { target: { value: '123456' } });
      expect(createBtn).not.toBeDisabled();
    });
  });

  describe('delete user', () => {
    it('deletes user after confirmation', async () => {
      mockUsers = [
        { id: 'u1', username: 'alice', role: 'User', enabled: true, created_at: 1700000000 },
      ];
      mockListUsers.mockResolvedValue(mockUsers);
      mockDeleteUser.mockResolvedValue({ message: 'user deleted' });
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('alice')).toBeTruthy();
      });

      const deleteBtns = screen.getAllByText('Delete');
      fireEvent.click(deleteBtns[0]);

      await waitFor(() => {
        expect(mockDeleteUser).toHaveBeenCalledWith('u1');
      });
    });

    it('does not delete user when confirm is cancelled', async () => {
      mockUsers = [
        { id: 'u1', username: 'alice', role: 'User', enabled: true, created_at: 1700000000 },
      ];
      mockListUsers.mockResolvedValue(mockUsers);
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('alice')).toBeTruthy();
      });

      const deleteBtns = screen.getAllByText('Delete');
      fireEvent.click(deleteBtns[0]);

      await waitFor(() => {
        expect(mockDeleteUser).not.toHaveBeenCalled();
      });
    });

    it('shows error when deletion fails', async () => {
      mockUsers = [
        { id: 'u1', username: 'alice', role: 'User', enabled: true, created_at: 1700000000 },
      ];
      mockListUsers.mockResolvedValue(mockUsers);
      mockDeleteUser.mockRejectedValue(new Error('fail'));
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('alice')).toBeTruthy();
      });

      const deleteBtns = screen.getAllByText('Delete');
      fireEvent.click(deleteBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Failed to delete user')).toBeTruthy();
      });
    });
  });

  describe('toggle user status', () => {
    it('toggles user enabled status', async () => {
      mockUsers = [
        { id: 'u1', username: 'alice', role: 'User', enabled: true, created_at: 1700000000 },
      ];
      mockListUsers.mockResolvedValue(mockUsers);
      mockToggleUserStatus.mockResolvedValue({ message: 'status updated' });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('alice')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Disable'));

      await waitFor(() => {
        expect(mockToggleUserStatus).toHaveBeenCalledWith('u1', false);
      });
    });

    it('shows error when toggle fails', async () => {
      mockUsers = [
        { id: 'u1', username: 'alice', role: 'User', enabled: true, created_at: 1700000000 },
      ];
      mockListUsers.mockResolvedValue(mockUsers);
      mockToggleUserStatus.mockRejectedValue(new Error('fail'));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('alice')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Disable'));

      await waitFor(() => {
        expect(screen.getByText('Failed to update user status')).toBeTruthy();
      });
    });
  });
});
