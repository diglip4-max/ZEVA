'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
  selector?: string;
}

export const ModalPortal: React.FC<ModalPortalProps> = ({ 
  children, 
  selector = '#modal-root' 
}) => {
  const containerRef = useRef<Element | null>(null);

  useEffect(() => {
    // Find the modal root container
    const container = document.querySelector('#modal-root');
    if (container) {
      containerRef.current = container;
    } else {
      // Fallback: create container if it doesn't exist
      const newContainer = document.createElement('div');
      newContainer.id = 'modal-root';
      newContainer.className = 'modal-root-container';
      document.body.appendChild(newContainer);
      containerRef.current = newContainer;
    }

    return () => {
      // Clean up if needed
    };
  }, []);

  if (!containerRef.current) {
    return null;
  }

  return createPortal(children, containerRef.current);
};