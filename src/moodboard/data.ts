import { z } from 'zod';
import { parseProject, type Project } from '../model';
const finite = z.number().finite();
const position = z.object({
  x: finite.min(-100).max(100),
  y: finite.min(-100).max(100),
  z: finite.min(-100).max(100),
});
const common = {
  id: z.string().min(1).max(100),
  title: z.string().max(120),
  position,
  rotation: finite.min(-360).max(360),
  scale: finite.min(0.1).max(5),
};
const project = z.unknown().transform((value, ctx): Project => {
  try {
    return parseProject(JSON.stringify({ ...(value as object), version: 2 }));
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid model snapshot' });
    return z.NEVER;
  }
});
const itemSchema = z.discriminatedUnion('kind', [
  z.object({
    ...common,
    kind: z.literal('image'),
    image: z
      .string()
      .max(1_000_000)
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
  }),
  z.object({
    ...common,
    kind: z.literal('note'),
    text: z.string().max(1500),
    url: z
      .string()
      .max(2000)
      .refine(
        (v) =>
          !v ||
          (/^https?:\/\//i.test(v) &&
            (() => {
              try {
                return !!new URL(v).hostname;
              } catch {
                return false;
              }
            })()),
        'Use an https:// or http:// reference link',
      ),
  }),
  z.object({ ...common, kind: z.literal('model'), project }),
]);
const schema = z.object({
  version: z.literal(1),
  items: z.array(itemSchema).max(40),
});
export type Moodboard = z.infer<typeof schema>;
export type BoardItem = Moodboard['items'][number];
export const emptyBoard = (): Moodboard => ({ version: 1, items: [] });
export function parseBoard(value: unknown): Moodboard {
  if (value === undefined) return emptyBoard();
  if (JSON.stringify(value).length > 4_000_000)
    throw new Error(
      'This moodboard exceeds 4 MB. Use smaller images or fewer model snapshots.',
    );
  const board = schema.parse(value);
  if (new Set(board.items.map((i) => i.id)).size !== board.items.length)
    throw new Error('Moodboard item identities must be unique.');
  return board;
}
export function boardItemPosition(index: number) {
  return { x: ((index % 3) - 1) * 5, y: 3 - Math.floor(index / 3) * 4, z: 0 };
}
