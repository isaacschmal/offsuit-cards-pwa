import React from 'react';

interface Avatar3DProps {
  avatarId: string;
  size?: number;
  className?: string;
}

interface AvatarPalette {
  skinTop: string;
  skinBottom: string;
  cheek: string;
  hairMain: string;
  hairShade: string;
  lipColor: string;
  hairStyle: 'wavy-ginger' | 'curly-brown' | 'short-auburn' | 'puffs-dark' | 'wavy-blonde' | 'short-dark';
}

const PALETTES: Record<string, AvatarPalette> = {
  emma: {
    skinTop: '#ffdfc4',
    skinBottom: '#e5b592',
    cheek: '#f29580',
    hairMain: '#d96b27',
    hairShade: '#a64812',
    lipColor: '#c85a68',
    hairStyle: 'wavy-ginger',
  },
  leo: {
    skinTop: '#b07b61',
    skinBottom: '#875740',
    cheek: '#9a5448',
    hairMain: '#4d3227',
    hairShade: '#331f17',
    lipColor: '#7a2e38',
    hairStyle: 'curly-brown',
  },
  akash: {
    skinTop: '#c48d6c',
    skinBottom: '#936246',
    cheek: '#a86454',
    hairMain: '#d86c29',
    hairShade: '#9e4612',
    lipColor: '#7f353d',
    hairStyle: 'short-auburn',
  },
  tori: {
    skinTop: '#7c4f3d',
    skinBottom: '#573324',
    cheek: '#753936',
    hairMain: '#281d1d',
    hairShade: '#140e0e',
    lipColor: '#9c3b58',
    hairStyle: 'puffs-dark',
  },
  evelyn: {
    skinTop: '#ffe3c8',
    skinBottom: '#e6b896',
    cheek: '#f39884',
    hairMain: '#f5d276',
    hairShade: '#d1a845',
    lipColor: '#cc6070',
    hairStyle: 'wavy-blonde',
  },
  hero: {
    skinTop: '#ffdfc7',
    skinBottom: '#e5b493',
    cheek: '#f09480',
    hairMain: '#262121',
    hairShade: '#120f0f',
    lipColor: '#c45864',
    hairStyle: 'short-dark',
  },
};

export const Avatar3D: React.FC<Avatar3DProps> = ({
  avatarId,
  size = 52,
  className = '',
}) => {
  const palette = PALETTES[avatarId] ?? PALETTES.hero;
  const uid = `av-${avatarId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`overflow-visible select-none ${className}`}
    >
      <defs>
        <radialGradient id={`${uid}-skin`} cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor={palette.skinTop} />
          <stop offset="100%" stopColor={palette.skinBottom} />
        </radialGradient>
        <linearGradient id={`${uid}-hair`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.hairMain} />
          <stop offset="100%" stopColor={palette.hairShade} />
        </linearGradient>
        <filter id={`${uid}-shadow`} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      <g filter={`url(#${uid}-shadow)`}>
        {/* Back hair for long/wavy styles */}
        {(palette.hairStyle === 'wavy-ginger' || palette.hairStyle === 'wavy-blonde') && (
          <path
            d="M16 55 C12 30, 26 12, 50 12 C74 12, 88 30, 84 55 C87 72, 83 84, 72 86 C60 88, 40 88, 28 86 C17 84, 13 72, 16 55 Z"
            fill={`url(#${uid}-hair)`}
          />
        )}

        {palette.hairStyle === 'puffs-dark' && (
          <>
            <circle cx="20" cy="64" r="14" fill={`url(#${uid}-hair)`} />
            <circle cx="80" cy="64" r="14" fill={`url(#${uid}-hair)`} />
          </>
        )}

        {/* Ears */}
        <circle cx="22" cy="56" r="7.5" fill={`url(#${uid}-skin)`} />
        <circle cx="78" cy="56" r="7.5" fill={`url(#${uid}-skin)`} />

        {/* Head / Face 3D Squircle */}
        <rect
          x="23"
          y="24"
          width="54"
          height="62"
          rx="26"
          fill={`url(#${uid}-skin)`}
        />

        {/* Soft Rosy Cheeks */}
        <ellipse cx="34" cy="61" rx="6.5" ry="4" fill={palette.cheek} opacity="0.45" />
        <ellipse cx="66" cy="61" rx="6.5" ry="4" fill={palette.cheek} opacity="0.45" />

        {/* Eyebrows */}
        <path
          d="M33 44 Q38 41.5 43 43.5"
          stroke={palette.hairShade}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M57 43.5 Q62 41.5 67 44"
          stroke={palette.hairShade}
          strokeWidth="2.8"
          strokeLinecap="round"
        />

        {/* Eyes with white sclera and catchlight */}
        <ellipse cx="38.5" cy="51.5" rx="5.2" ry="4.6" fill="#ffffff" />
        <circle cx="38.5" cy="51.5" r="3.1" fill="#2c1d16" />
        <circle cx="39.6" cy="50.3" r="1.1" fill="#ffffff" />

        <ellipse cx="61.5" cy="51.5" rx="5.2" ry="4.6" fill="#ffffff" />
        <circle cx="61.5" cy="51.5" r="3.1" fill="#2c1d16" />
        <circle cx="62.6" cy="50.3" r="1.1" fill="#ffffff" />

        {/* 3D Soft Nose */}
        <path
          d="M48 56 Q50 61.5 52 56"
          stroke={palette.skinBottom}
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="50" cy="59.5" rx="3.8" ry="2.2" fill={palette.skinBottom} opacity="0.45" />

        {/* Expressive Smile */}
        <path
          d="M41.5 68.5 Q50 74.5 58.5 68.5"
          stroke={palette.lipColor}
          strokeWidth="3.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Front Hair Styles */}
        {(palette.hairStyle === 'wavy-ginger' || palette.hairStyle === 'wavy-blonde') && (
          <path
            d="M21 48 C21 26, 36 14, 52 14 C68 14, 80 26, 79 48 C74 36, 63 29, 49 31 C36 33, 27 40, 21 48 Z"
            fill={`url(#${uid}-hair)`}
          />
        )}

        {palette.hairStyle === 'curly-brown' && (
          <path
            d="M22 44 C19 26, 32 14, 50 14 C68 14, 81 26, 78 44 C73 36, 65 34, 57 36 C49 38, 41 34, 33 37 C27 39, 24 41, 22 44 Z"
            fill={`url(#${uid}-hair)`}
          />
        )}

        {palette.hairStyle === 'short-auburn' && (
          <path
            d="M23 43 C21 25, 34 15, 50 15 C66 15, 79 25, 77 43 C73 31, 63 27, 50 27 C37 27, 27 31, 23 43 Z"
            fill={`url(#${uid}-hair)`}
          />
        )}

        {palette.hairStyle === 'puffs-dark' && (
          <path
            d="M22 46 C22 25, 35 15, 50 15 C65 15, 78 25, 78 46 C71 35, 59 29, 50 32 C41 29, 29 35, 22 46 Z"
            fill={`url(#${uid}-hair)`}
          />
        )}

        {palette.hairStyle === 'short-dark' && (
          <path
            d="M23 43 C21 24, 34 14, 50 14 C66 14, 79 24, 77 43 C73 31, 62 26, 50 27 C38 28, 28 32, 23 43 Z"
            fill={`url(#${uid}-hair)`}
          />
        )}
      </g>
    </svg>
  );
};
