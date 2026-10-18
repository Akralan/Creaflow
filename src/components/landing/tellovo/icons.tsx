import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      {children}
    </svg>
  );
}

export const RepoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v16H7.5A2.5 2.5 0 0 0 5 20.5z" />
    <path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v4H7.5A2.5 2.5 0 0 1 5 20.5z" />
  </Svg>
);

export const GithubIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.82-.26.82-.57v-2.04c-3.34.72-4.04-1.61-4.04-1.61a3.18 3.18 0 0 0-1.34-1.76c-1.08-.74.09-.73.09-.73a2.52 2.52 0 0 1 1.84 1.24 2.56 2.56 0 0 0 3.5 1 2.56 2.56 0 0 1 .76-1.6c-2.67-.3-5.47-1.34-5.47-5.93a4.64 4.64 0 0 1 1.24-3.22 4.3 4.3 0 0 1 .1-3.18s1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23a4.3 4.3 0 0 1 .12 3.18 4.63 4.63 0 0 1 1.23 3.22c0 4.61-2.8 5.62-5.48 5.92a2.87 2.87 0 0 1 .82 2.22v3.29c0 .32.21.69.82.57A12 12 0 0 0 12 .3" />
  </Svg>
);

export const NotionIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <path d="M9 16.5v-9l6 9v-9" />
  </Svg>
);

export const LinearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M5.2 14.6 9.4 18.8M4 11l9 9M5.9 7.5l10.6 10.6M8.6 5.2l10.2 10.2" />
  </Svg>
);

export const NotesIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
    <path d="M6 15V9l2.5 3L11 9v6M16.5 9v6M14.5 13l2 2 2-2" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

export const TrendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Svg>
);

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z" />
  </Svg>
);

export const HeartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </Svg>
);

export const CommentIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 1 3.4 6.5L4 20l1.2-3.6A8 8 0 0 1 4 12z" />
  </Svg>
);

export const RepostIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 7h10v6M17 17H7v-6M14 10l3 3 3-3M10 14l-3-3-3 3" />
  </Svg>
);

export const ThumbIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 11v9H4v-9zM7 11l4-7a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7" />
  </Svg>
);
