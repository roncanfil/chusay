import { savePhoto } from '@/server/photos';
import { BadRequest, handle } from '@/server/validate';

// POST a JPEG (shrunk in the browser) → { url } to keep as the idea's picture
export async function POST(req: Request) {
  return handle(async () => {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) throw new BadRequest('That picture is too big');
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new BadRequest('Only JPEG pictures');
    return { url: savePhoto(bytes) };
  });
}
