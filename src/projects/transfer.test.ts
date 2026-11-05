import { describe, expect, it } from 'vitest';
import { projectFile, readProjectCopy } from './transfer';
import { initialProject } from '../model';
import {
  newSession,
  serializeSession,
  parseSession,
} from '../intelligence/engine';

describe('portable projects', () => {
  it('round trips history, name, conversation, model references and media with a fresh identity each time', async () => {
    const session = newSession(initialProject());
    session.past = [initialProject()];
    session.context.focusIds = [session.project.volumes[0].id];
    const snapshot = {
      session: serializeSession(session),
      messages: [{ role: 'user' as const, content: 'Keep this building' }],
      moodboard: {
        version: 1 as const,
        items: [
          {
            id: 'note',
            kind: 'note' as const,
            title: 'Reference',
            text: 'Courtyard',
            url: '',
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
            scale: 1,
          },
        ],
      },
      panoramas: {
        version: 1 as const,
        items: [
          {
            id: 'view',
            name: 'Site',
            image: 'data:image/jpeg;base64,AAAA',
            width: 2048,
            height: 1024,
            horizontalAngle: 360,
          },
        ],
      },
    };
    const file = projectFile(snapshot, 'House / study');
    expect(file.name).toBe('House - study.atelier.json');
    const text = await file.text();
    const received = readProjectCopy(text);
    expect(received.name).toBe('House / study');
    expect(parseSession(received.session)).toEqual(session);
    expect(received.messages).toEqual(snapshot.messages);
    expect(received.moodboard).toEqual(snapshot.moodboard);
    expect(received.panoramas).toEqual(snapshot.panoramas);
    expect(readProjectCopy(text).id).not.toBe(received.id);
  });
  it('accepts older project backups but rejects unsupported versions and invalid attachments before saving', () => {
    const old = serializeSession(newSession(initialProject()));
    expect(readProjectCopy(old).name).toBe('Imported project');
    expect(() =>
      readProjectCopy(
        JSON.stringify({ ...JSON.parse(old), transferVersion: 9 }),
      ),
    ).toThrow('newer');
    expect(() =>
      readProjectCopy(
        JSON.stringify({
          ...JSON.parse(old),
          messages: [{ role: 'system', content: 'bad' }],
        }),
      ),
    ).toThrow();
    expect(() =>
      readProjectCopy(
        JSON.stringify({
          ...JSON.parse(old),
          panoramas: { version: 1, items: [{ image: 'https://example.com' }] },
        }),
      ),
    ).toThrow();
  });
});
