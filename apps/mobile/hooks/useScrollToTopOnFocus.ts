import { useCallback, type RefObject } from 'react';
import { useFocusEffect } from 'expo-router';

type ScrollableRef = {
  scrollTo?: (options: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
  scrollToLocation?: (options: {
    sectionIndex: number;
    itemIndex: number;
    animated?: boolean;
    viewOffset?: number;
  }) => void;
  getScrollResponder?: () =>
    | { scrollTo?: (options: { x?: number; y?: number; animated?: boolean }) => void }
    | null
    | undefined;
};

/**
 * 进入页面时统一回到顶部，避免保留上次滚动位置导致"中段打开"。
 * 接受任意 RN 可滚动组件 ref（ScrollView / FlatList / SectionList 等）。
 */
export function useScrollToTopOnFocus(ref: RefObject<any>) {
  useFocusEffect(
    useCallback(() => {
      const scrollTop = () => {
        const node = ref.current;
        if (!node) return;
        if (typeof node.scrollTo === 'function') {
          node.scrollTo({ x: 0, y: 0, animated: false });
          return;
        }
        if (typeof node.scrollToOffset === 'function') {
          node.scrollToOffset({ offset: 0, animated: false });
          return;
        }
        // SectionList 在 sections 为空时 scrollToLocation 会抛 invariant；用底层 ScrollView 安全
        const responder =
          typeof node.getScrollResponder === 'function' ? node.getScrollResponder() : null;
        if (responder && typeof responder.scrollTo === 'function') {
          responder.scrollTo({ x: 0, y: 0, animated: false });
          return;
        }
        if (typeof node.scrollToLocation === 'function') {
          try {
            node.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: false, viewOffset: 0 });
          } catch {
            /* empty list / no sections */
          }
        }
      };

      // 某些页面在进入后会异步恢复上次 offset，这里做多次兜底回顶。
      const ids = [0, 120, 320].map((ms) => setTimeout(scrollTop, ms));
      return () => ids.forEach((id) => clearTimeout(id));
    }, [ref]),
  );
}
