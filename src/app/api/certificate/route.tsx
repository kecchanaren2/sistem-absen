import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nama = searchParams.get('nama_peserta');

    if (!nama) {
      return new Response('Name is required', { status: 400 });
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            // Basic fallback if no image template
            backgroundImage: 'linear-gradient(to right, #00c6ff, #0072ff)', 
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* Outer border for styling */}
          <div
            style={{
              position: 'absolute',
              top: '40px',
              left: '40px',
              right: '40px',
              bottom: '40px',
              border: '4px solid rgba(255, 255, 255, 0.5)',
              borderRadius: '20px',
            }}
          />
          
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '60px 100px',
              borderRadius: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h1
              style={{
                fontSize: 60,
                fontWeight: 'bold',
                color: '#333',
                marginBottom: 20,
              }}
            >
              CERTIFICATE OF ATTENDANCE
            </h1>
            <p
              style={{
                fontSize: 30,
                color: '#666',
                marginBottom: 40,
              }}
            >
              This is to certify that
            </p>
            <h2
              style={{
                fontSize: 80,
                fontWeight: 'bold',
                color: '#0072ff',
                margin: 0,
                textAlign: 'center',
                textTransform: 'capitalize',
              }}
            >
              {nama}
            </h2>
            <p
              style={{
                fontSize: 24,
                color: '#666',
                marginTop: 40,
                maxWidth: '800px',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              has successfully participated in the 2-day event and fully attended all the required sessions.
            </p>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
