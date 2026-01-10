import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  className = "",
  id,
  ...props
}) => {
  const inputId = id || props.name || Math.random().toString(36).slice(2);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-slate-700 
            outline-none transition-all duration-200
            placeholder:text-slate-400
            focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100
            disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed
            ${leftIcon ? "pl-10" : ""}
            ${rightIcon ? "pr-10" : ""}
            ${error ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-slate-200"}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>
      )}
    </div>
  );
};
