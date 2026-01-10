import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  padding = "md",
  hover = false,
}) => {
  return (
    <div
      className={`
        bg-white rounded-2xl shadow-sm border border-slate-100
        ${paddingStyles[padding]}
        ${hover ? "hover:shadow-md hover:border-slate-200 transition-all duration-200 cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, action, icon }) => {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
};
