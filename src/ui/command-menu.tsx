import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { t } from '@/core/i18n';
import { Icon, type IconName } from './icons';
import './command-menu.css';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: IconName;
  run: () => void | Promise<void>;
}

export function CommandMenu(props: { commands: Command[]; label?: string; compact?: boolean }): JSX.Element {
  const label = props.label ?? t('cmd_default_label');
  // Alt+K always reaches the page. Ctrl/Meta+K are kept as familiar aliases where the
  // browser does not consume them first.
  const shortcut = 'Alt K';
  const shortcutKey = 'Alt+K Control+K Meta+K';
  const dialogId = useId();
  const listId = `${dialogId}-list`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wasOpenRef = useRef(false);

  const highlighted = Math.min(activeIndex, Math.max(props.commands.length - 1, 0));

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    setActiveIndex(0);
    setOpen(true);
  }, []);

  const runCommand = useCallback(
    async (command: Command) => {
      closeMenu();
      try {
        await command.run();
      } catch {
        // Command errors are deliberately silent; the menu must not leak rejections.
      }
    },
    [closeMenu],
  );

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = optionRefs.current[highlighted];
    if (!node) return;
    node.focus();
    if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' });
  }, [open, highlighted]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const isShortcut =
        !event.shiftKey &&
        event.key.toLowerCase() === 'k' &&
        (event.altKey || event.ctrlKey || event.metaKey);
      if (isShortcut) {
        event.preventDefault();
        openMenu();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openMenu]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' && props.commands.length) {
      event.preventDefault();
      setActiveIndex((current) => (Math.min(current, props.commands.length - 1) + 1) % props.commands.length);
      return;
    }
    if (event.key === 'ArrowUp' && props.commands.length) {
      event.preventDefault();
      setActiveIndex(
        (current) => (Math.min(current, props.commands.length - 1) - 1 + props.commands.length) % props.commands.length,
      );
      return;
    }
    if (event.key === 'Enter') {
      const command = props.commands[highlighted];
      if (command) {
        event.preventDefault();
        void runCommand(command);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  };

  return (
    <div className="pkcmd">
      <button
        ref={triggerRef}
        type="button"
        className="pkcmd__trigger"
        data-compact={props.compact ? 'true' : undefined}
        aria-label={props.compact ? t('cmd_trigger_compact_label', label, shortcut) : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-keyshortcuts={shortcutKey}
        onClick={openMenu}
      >
        <Icon name="zap" size={14} />
        <span className={props.compact ? 'sr-only' : undefined}>{label}</span>
        <kbd className="pkcmd__key">{shortcut}</kbd>
      </button>

      {open && (
        <div
          className="pkcmd__overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeMenu();
          }}
        >
          <div
            id={dialogId}
            className="pkcmd__dialog"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
          >
            <div className="pkcmd__head">
              <span className="pkcmd__title">{label}</span>
              <button type="button" className="pkcmd__close" aria-label={t('cmd_close_label')} onClick={closeMenu}>
                <Icon name="x" size={14} />
              </button>
            </div>

            {props.commands.length > 0 ? (
              <div id={listId} className="pkcmd__list" role="listbox" aria-label={t('cmd_list_label', label)}>
                {props.commands.map((command, index) => (
                  <div
                    key={command.id}
                    id={`${listId}-option-${index}`}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    className="pkcmd__option"
                    role="option"
                    aria-selected={index === highlighted}
                    tabIndex={index === highlighted ? 0 : -1}
                    data-active={index === highlighted ? 'true' : undefined}
                    title={command.label}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void runCommand(command)}
                  >
                    {command.icon ? (
                      <Icon name={command.icon} size={15} />
                    ) : (
                      <span className="pkcmd__option-dot" aria-hidden="true" />
                    )}
                    <span className="pkcmd__option-label">{command.label}</span>
                    {command.hint && <span className="pkcmd__option-hint">{command.hint}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="pkcmd__empty" role="status">
                {t('cmd_empty')}
              </div>
            )}

            <div className="pkcmd__footer" aria-hidden="true">
              <span className="pkcmd__keys">
                <kbd className="pkcmd__key">↑</kbd>
                <kbd className="pkcmd__key">↓</kbd>
                {t('cmd_footer_navigate')}
              </span>
              <span className="pkcmd__keys">
                <kbd className="pkcmd__key">↵</kbd>
                {t('cmd_footer_run')}
                <kbd className="pkcmd__key">Esc</kbd>
                {t('cmd_footer_close')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
