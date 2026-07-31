'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
  selector?: string;
}

export const ModalPortal: React.FC<ModalPortalProps> = ({
  children,
  selector = '#modal-root',
}) => {
  const containerRef = useRef<Element | null>(null);

  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    // Find the modal root container
    const container = document.querySelector(selector);
    if (container) {
      containerRef.current = container;
    } else {
      // Fallback: create container if it doesn't exist
      const newContainer = document.createElement('div');
      // Derive id from selector if it is an ID selector
      const idFromSelector = selector.startsWith('#') ? selector.slice(1) : 'modal-root';
      newContainer.id = idFromSelector;
      newContainer.className = 'modal-root-container';
      document.body.appendChild(newContainer);
      containerRef.current = newContainer;
    }
    setReady(true);

    return () => {
      // Clean up if needed
    };
  }, [selector]);

  if (!ready || !containerRef.current) {
    return null;
  }

  return createPortal(children, containerRef.current);
};
