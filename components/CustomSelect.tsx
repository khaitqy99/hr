import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  listClassName?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Chọn',
  className = '',
  triggerClassName = '',
  listClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const isPlaceholder = !selectedOption && !value;

  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 6, // mt-1.5 equivalent (6px)
          left: rect.left,
          width: rect.width,
        });
      }
    };

    if (isOpen) {
      updatePosition();
      // Update position on window resize and scroll (capture to detect scroll in parents)
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Close only if click is outside both container and dropdown list
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-300 bg-white text-left text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 active:bg-slate-50 transition-colors ${triggerClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${isPlaceholder ? 'text-slate-400' : ''}`}>{displayLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && createPortal(
        <div
          ref={listRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 9999, // Ensure it sits on top of modals
          }}
          className={`max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1 ${listClassName}`}
          role="listbox"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2.5 text-left text-xs font-medium transition-colors ${opt.value === value
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSelect;
