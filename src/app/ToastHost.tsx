import { useSyncExternalStore } from 'react';
import type { ToasterItem } from '@/components';
import { Toaster } from '@/components';
import { getToast, pressToastAction, subscribe } from '@/services/toast';

/**
 * Bridges the framework-free toast store into React. Mounted once at the app
 * root so every screen can `showToast()` without owning a container.
 */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, getToast, getToast);

  const items: ToasterItem[] =
    toast === null
      ? []
      : [
          {
            id: String(toast.id),
            text: toast.text,
            ...(toast.action !== undefined
              ? { action: { label: toast.action.label, onPress: pressToastAction } }
              : {}),
          },
        ];

  return <Toaster items={items} />;
}
