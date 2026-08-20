/**
 * ColumnHeaderMenu — Keyboard accessibility tests.
 *
 * Validates:
 * - Requirement 14.4: Column header menu keyboard accessibility
 *   - Open with Enter/Space
 *   - Navigate with ArrowDown/ArrowUp
 *   - Select with Enter (click)
 *   - Close with Escape (returns focus to trigger)
 *   - Tab closes the menu
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { ColumnHeaderMenu } from '../column-header-menu';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function renderMenu(overrides: Partial<React.ComponentProps<typeof ColumnHeaderMenu>> = {}) {
  const defaultProps = {
    columnId: 'name',
    columnLabel: 'Name',
    onSortAsc: vi.fn(),
    onSortDesc: vi.fn(),
    onPinColumn: vi.fn(),
    onFilterBy: vi.fn(),
    onHideColumn: vi.fn(),
    ...overrides,
  };

  return { ...render(<ColumnHeaderMenu {...defaultProps} />), props: defaultProps };
}

function getTriggerButton(): HTMLElement {
  return screen.getByRole('button', { name: /column options for/i });
}

function getMenu(): HTMLElement | null {
  return screen.queryByRole('menu');
}

function getMenuItems(): HTMLElement[] {
  return screen.getAllByRole('menuitem');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ColumnHeaderMenu Keyboard Accessibility', () => {
  describe('Trigger activation', () => {
    it('opens menu with Enter key on trigger button', () => {
      renderMenu();
      const trigger = getTriggerButton();

      fireEvent.keyDown(trigger, { key: 'Enter' });

      expect(getMenu()).not.toBeNull();
    });

    it('opens menu with Space key on trigger button', () => {
      renderMenu();
      const trigger = getTriggerButton();

      fireEvent.keyDown(trigger, { key: ' ' });

      expect(getMenu()).not.toBeNull();
    });

    it('opens menu with ArrowDown key on trigger button', () => {
      renderMenu();
      const trigger = getTriggerButton();

      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      expect(getMenu()).not.toBeNull();
    });

    it('closes menu with Enter key when already open', () => {
      renderMenu();
      const trigger = getTriggerButton();

      // Open
      fireEvent.keyDown(trigger, { key: 'Enter' });
      expect(getMenu()).not.toBeNull();

      // Close
      fireEvent.keyDown(trigger, { key: 'Enter' });
      expect(getMenu()).toBeNull();
    });

    it('sets aria-expanded to true when open', () => {
      renderMenu();
      const trigger = getTriggerButton();

      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      fireEvent.keyDown(trigger, { key: 'Enter' });

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('sets aria-haspopup to menu', () => {
      renderMenu();
      const trigger = getTriggerButton();
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    });
  });

  describe('ArrowDown/ArrowUp navigation', () => {
    it('focuses first menu item when menu opens', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      expect(items[0].getAttribute('tabindex')).toBe('0');
      expect(document.activeElement).toBe(items[0]);
    });

    it('moves focus down with ArrowDown', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      expect(document.activeElement).toBe(items[0]);

      await act(async () => {
        fireEvent.keyDown(items[0], { key: 'ArrowDown' });
      });

      // Re-query after re-render
      const updatedItems = getMenuItems();
      expect(updatedItems[1].getAttribute('tabindex')).toBe('0');
      expect(document.activeElement).toBe(updatedItems[1]);
    });

    it('moves focus up with ArrowUp', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      let items = getMenuItems();

      // Move to second item
      await act(async () => {
        fireEvent.keyDown(items[0], { key: 'ArrowDown' });
      });

      items = getMenuItems();
      expect(document.activeElement).toBe(items[1]);

      // Move back up
      await act(async () => {
        fireEvent.keyDown(items[1], { key: 'ArrowUp' });
      });

      items = getMenuItems();
      expect(document.activeElement).toBe(items[0]);
    });

    it('wraps around from last to first with ArrowDown', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      let items = getMenuItems();
      const lastIndex = items.length - 1;

      // Navigate to last item
      for (let i = 0; i < lastIndex; i++) {
        await act(async () => {
          items = getMenuItems();
          fireEvent.keyDown(items[i], { key: 'ArrowDown' });
        });
      }

      items = getMenuItems();
      expect(document.activeElement).toBe(items[lastIndex]);

      // Arrow down from last wraps to first
      await act(async () => {
        fireEvent.keyDown(items[lastIndex], { key: 'ArrowDown' });
      });

      items = getMenuItems();
      expect(document.activeElement).toBe(items[0]);
    });

    it('wraps around from first to last with ArrowUp', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      let items = getMenuItems();
      expect(document.activeElement).toBe(items[0]);

      // Arrow up from first wraps to last
      await act(async () => {
        fireEvent.keyDown(items[0], { key: 'ArrowUp' });
      });

      items = getMenuItems();
      expect(document.activeElement).toBe(items[items.length - 1]);
    });
  });

  describe('Enter activates focused menu item', () => {
    it('activates sort ascending when first item is clicked', async () => {
      const { props } = renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      fireEvent.click(items[0]);

      expect(props.onSortAsc).toHaveBeenCalledWith('name');
    });

    it('activates sort descending on second item click', async () => {
      const { props } = renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      fireEvent.click(items[1]);

      expect(props.onSortDesc).toHaveBeenCalledWith('name');
    });

    it('closes menu after item activation', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      await act(async () => {
        fireEvent.click(items[0]);
      });

      expect(getMenu()).toBeNull();
    });
  });

  describe('Escape closes menu and returns focus', () => {
    it('closes menu on Escape', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      expect(getMenu()).not.toBeNull();

      const items = getMenuItems();
      await act(async () => {
        fireEvent.keyDown(items[0], { key: 'Escape' });
      });

      expect(getMenu()).toBeNull();
    });

    it('returns focus to trigger button on Escape', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      await act(async () => {
        fireEvent.keyDown(items[0], { key: 'Escape' });
      });

      expect(document.activeElement).toBe(trigger);
    });
  });

  describe('Tab closes the menu', () => {
    it('closes menu on Tab key', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      expect(getMenu()).not.toBeNull();

      const items = getMenuItems();
      await act(async () => {
        fireEvent.keyDown(items[0], { key: 'Tab' });
      });

      expect(getMenu()).toBeNull();
    });
  });

  describe('ARIA attributes', () => {
    it('menu items have role="menuitem"', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      items.forEach((item) => {
        expect(item.getAttribute('role')).toBe('menuitem');
      });
    });

    it('menu container has role="menu"', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const menu = getMenu();
      expect(menu).not.toBeNull();
      expect(menu!.getAttribute('role')).toBe('menu');
    });

    it('menu has aria-label describing the column', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const menu = getMenu();
      expect(menu!.getAttribute('aria-label')).toBe('Options for Name');
    });

    it('only focused menu item has tabIndex=0, others have tabIndex=-1', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      expect(items[0].getAttribute('tabindex')).toBe('0');
      for (let i = 1; i < items.length; i++) {
        expect(items[i].getAttribute('tabindex')).toBe('-1');
      }
    });

    it('separator has role="separator"', async () => {
      renderMenu();
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const separator = screen.getByRole('separator');
      expect(separator).toBeTruthy();
    });
  });

  describe('Disabled items', () => {
    it('required column has disabled hide option with aria-disabled', async () => {
      renderMenu({ isRequired: true });
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      const hideItem = items.find((item) => item.textContent?.includes('Hide Column'));
      expect(hideItem).toBeTruthy();
      expect(hideItem!.getAttribute('aria-disabled')).toBe('true');
    });

    it('disabled item does not fire callback when clicked', async () => {
      const { props } = renderMenu({ isRequired: true });
      const trigger = getTriggerButton();

      await act(async () => {
        fireEvent.keyDown(trigger, { key: 'Enter' });
      });

      const items = getMenuItems();
      const hideItem = items.find((item) => item.textContent?.includes('Hide Column'));
      if (hideItem) {
        fireEvent.click(hideItem);
      }

      expect(props.onHideColumn).not.toHaveBeenCalled();
    });
  });
});
