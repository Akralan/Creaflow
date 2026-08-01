"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { accent, color, fontHeading } from "@/lib/design/tokens";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: color.textSecondary,
  marginBottom: 7,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 11,
  padding: "12px 14px",
  fontSize: 15,
  fontFamily: "inherit",
  background: color.inputBg,
  color: color.text,
  outline: "none",
};

interface FieldWrapperProps {
  label?: string;
  required?: boolean;
  optional?: boolean;
  helper?: string;
}

export function TextField({
  label,
  required,
  optional,
  helper,
  style,
  ...props
}: FieldWrapperProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      {label && (
        <label style={labelStyle}>
          {label} {required && <span style={{ color: accent }}>*</span>}
          {optional && <span style={{ color: color.textFaint, fontWeight: 400 }}> — optionnel</span>}
        </label>
      )}
      <input {...props} style={{ ...fieldStyle, ...style }} />
      {helper && <p style={{ margin: "8px 2px 0", fontSize: 12, color: color.textFaint }}>{helper}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  required,
  optional,
  helper,
  style,
  ...props
}: FieldWrapperProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      {label && (
        <label style={labelStyle}>
          {label} {required && <span style={{ color: accent }}>*</span>}
          {optional && <span style={{ color: color.textFaint, fontWeight: 400 }}> — optionnel</span>}
        </label>
      )}
      <textarea
        {...props}
        style={{ ...fieldStyle, minHeight: 64, resize: "vertical", fontFamily: "inherit", ...style }}
      />
      {helper && <p style={{ margin: "8px 2px 0", fontSize: 12, color: color.textFaint }}>{helper}</p>}
    </div>
  );
}

export const heading2Style: React.CSSProperties = {
  fontFamily: fontHeading,
  fontWeight: 700,
  fontSize: 24,
  margin: "0 0 6px",
  letterSpacing: "-0.02em",
};

export const heading1Style: React.CSSProperties = {
  fontFamily: fontHeading,
  fontWeight: 700,
  fontSize: 30,
  margin: 0,
  letterSpacing: "-0.025em",
};
