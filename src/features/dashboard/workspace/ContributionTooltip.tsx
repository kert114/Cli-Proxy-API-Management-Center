import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Workspace.module.scss';

export function ContributionTooltip({
  anchor,
  id,
  text,
  geometryRevision,
  onDismiss,
}: {
  anchor: Element;
  id: string;
  text: string;
  geometryRevision: string;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();

  useLayoutEffect(() => {
    const update = () => {
      const tooltip = ref.current;
      if (!tooltip || !anchor.isConnected) {
        setPosition(undefined);
        return;
      }
      const target = anchor.getBoundingClientRect();
      const visible = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
          visible.left = Math.max(visible.left, rect.left);
          visible.right = Math.min(visible.right, rect.right);
        }
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          visible.top = Math.max(visible.top, rect.top);
          visible.bottom = Math.min(visible.bottom, rect.bottom);
        }
      }
      if (
        target.right <= visible.left ||
        target.left >= visible.right ||
        target.bottom <= visible.top ||
        target.top >= visible.bottom
      ) {
        setPosition(undefined);
        return;
      }
      const { width, height } = tooltip.getBoundingClientRect();
      const margin = 8;
      const left = Math.max(
        margin,
        Math.min(target.left + target.width / 2 - width / 2, innerWidth - width - margin)
      );
      const above = target.top - height - margin;
      const top = Math.max(
        margin,
        Math.min(above >= margin ? above : target.bottom + margin, innerHeight - height - margin)
      );
      setPosition((previous) =>
        previous?.left === left && previous.top === top ? previous : { left, top }
      );
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    update();
    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    for (let element: Element | null = anchor; element; element = element.parentElement) {
      observer.observe(element);
    }
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    window.addEventListener('keydown', escape);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      window.removeEventListener('keydown', escape);
    };
  }, [anchor, text, geometryRevision, onDismiss]);

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={styles.contributionTooltip}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {text}
    </div>,
    document.body
  );
}
