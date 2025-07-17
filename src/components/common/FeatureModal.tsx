import React, { useEffect } from 'react';
import './FeatureModal.css';

interface FeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
}

const FeatureModal: React.FC<FeatureModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium'
}) => {
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="feature-modal-overlay" onClick={onClose}>
      <div 
        className={`feature-modal feature-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feature-modal__header">
          <h2 className="feature-modal__title">{title}</h2>
          <button 
            className="feature-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        
        <div className="feature-modal__content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FeatureModal;