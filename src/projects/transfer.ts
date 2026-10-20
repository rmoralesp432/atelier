import { z } from 'zod';
import { parseSession, serializeSession } from '../intelligence/engine';
import { parseBoard } from '../moodboard/data';
import { parsePanoramas } from '../panorama/data';
import type { SavedProject, WorkspaceSnapshot } from './library';

const messages = z
  .array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(100_000),
      summary: z.string().max(100_000).optional(),
      images: z
        .array(
          z
            .string()
            .max(8_000_000)
            .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
        )
        .max(8)
        .optional(),
    }),
  )
  .max(80);

/** A self-contained, backwards-compatible project backup; no credentials or device settings. */
export function projectFile(snapshot: WorkspaceSnapshot, name: string): File {
  const safeName =
    name
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
      .slice(0, 80)
      .trim() || 'Atelier project';
  const json = JSON.stringify({
    ...JSON.parse(snapshot.session),
    transferVersion: 1,
    name: name.slice(0, 80),
    messages: snapshot.messages.slice(-80),
    moodboard: snapshot.moodboard,
    panoramas: snapshot.panoramas,
  });
  return new File([json], `${safeName}.atelier.json`, {
    type: 'application/json',
  });
}

export function readProjectCopy(text: string): SavedProject {
  const raw = JSON.parse(text);
  if (raw.transferVersion !== undefined && raw.transferVersion !== 1)
    throw new Error('This project file needs a newer version of ATELIER.');
  const session = parseSession(text);
  return {
    id: crypto.randomUUID(), // A transfer never overwrites a local project.
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, 80)
        : 'Imported project',
    updatedAt: Date.now(),
    session: serializeSession(session),
    messages: messages.parse(raw.messages ?? []),
    moodboard: parseBoard(raw.moodboard),
    panoramas: parsePanoramas(raw.panoramas),
  };
}

export function downloadProject(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
