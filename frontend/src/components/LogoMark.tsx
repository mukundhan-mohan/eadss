type Props = {
  size?: number;
};

export default function LogoMark({ size = 30 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="EADSS logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="eadss-g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f6fa8" />
          <stop offset="100%" stopColor="#d05a1e" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#eadss-g1)" />
      <path
        d="M18 20h28v6H24v8h18v6H24v10h22v6H18V20z"
        fill="#ffffff"
      />
      <circle cx="49" cy="49" r="6" fill="#ffffff" fillOpacity="0.22" />
    </svg>
  );
}
