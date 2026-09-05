import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #C9A84C 0%, #E8C76A 100%)',
          borderRadius: 8,
          color: '#0A0E1A',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: -0.5,
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        Z
      </div>
    ),
    { ...size }
  );
}
