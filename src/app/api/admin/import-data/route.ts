import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tempFilePath = '';

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (
      !file ||
      typeof file !== 'object' ||
      typeof (file as { name?: unknown }).name !== 'string' ||
      typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== 'function'
    ) {
      return NextResponse.json({ error: 'File JSON wajib diunggah' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      return NextResponse.json({ error: 'File harus berformat .json' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    tempFilePath = path.join(os.tmpdir(), `zaneva-import-${Date.now()}-${file.name}`);
    await fs.writeFile(tempFilePath, bytes);

    const scriptPath = path.join(process.cwd(), 'prisma', 'import-export.js');
    const { stdout } = await execFileAsync(process.execPath, [scriptPath, tempFilePath], {
      cwd: process.cwd(),
      maxBuffer: 8 * 1024 * 1024,
    });

    const summary = JSON.parse(stdout.trim());
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Import data error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Import gagal dijalankan';

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }
}
