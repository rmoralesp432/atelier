import { z } from 'zod';

export const decisionOriginSchema = z
  .object({
    id: z.string().min(1).max(100),
    text: z.string().min(1).max(4000),
  })
  .strict();
export type DecisionOrigin = z.infer<typeof decisionOriginSchema>;
export const designNoteSchema = z
  .object({
    topic: z.string().min(1).max(80),
    text: z.string().min(1).max(1500),
    source: z.enum(['user', 'drawing', 'assumption']),
    decision: z
      .object({
        id: z.string().min(1).max(100),
        revision: z.number().int().min(1).max(1000000),
        quote: z.string().min(1).max(1500),
        origin: decisionOriginSchema,
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (n) =>
      !n.decision ||
      (n.source === 'user' &&
        n.decision.origin.text.includes(n.decision.quote)),
    'A user decision must retain its exact original wording and source request.',
  );
export type DesignNote = z.infer<typeof designNoteSchema>;

/** The model supplies a quotation and the ID to revise, never provenance. */
export const decisionCaptureSchema = z
  .object({
    quote: z.string().min(1).max(1500),
    revises: z.string().min(1).max(100).nullable(),
  })
  .strict();

export function updateDesignNotes(
  notes: DesignNote[],
  update: Pick<DesignNote, 'topic' | 'text' | 'source'> & {
    capture?: z.infer<typeof decisionCaptureSchema> | null;
  },
  origin?: DecisionOrigin,
): DesignNote[] {
  const topic = (s: string) => s.trim().toLocaleLowerCase();
  const existing = notes.find((n) => topic(n.topic) === topic(update.topic));
  const capture = update.capture;
  const replaced = capture?.revises
    ? notes.find((n) => n.decision?.id === capture.revises)
    : undefined;
  if (capture?.revises && !replaced)
    throw new Error(
      'The decision to revise is not active in this project. Inspect the current notes.',
    );
  if (existing?.decision && existing !== replaced)
    throw new Error(
      'Revise the existing user decision by its ID and quote the new user instruction; do not overwrite it as an assumption.',
    );
  if (replaced && existing && existing !== replaced)
    throw new Error('The revised decision topic belongs to a different note.');
  let decision: DesignNote['decision'];
  if (capture) {
    if (
      update.source !== 'user' ||
      !origin ||
      !decisionOriginSchema.safeParse(origin).success ||
      !origin.text.includes(capture.quote)
    )
      throw new Error(
        'A recorded user decision needs an exact quotation from the current user instruction. Assumptions cannot become user decisions.',
      );
    // A retried stage must not manufacture another revision of the same turn.
    const same =
      replaced?.decision?.origin.id === origin.id &&
      replaced.decision.quote === capture.quote;
    decision = {
      id: replaced?.decision?.id ?? crypto.randomUUID(),
      revision: (replaced?.decision?.revision ?? 0) + (same ? 0 : 1),
      quote: capture.quote,
      origin: { ...origin },
    };
  }
  const note = designNoteSchema.parse({
    topic: update.topic,
    text: update.text,
    source: update.source,
    ...(decision ? { decision } : {}),
  });
  const result = [
    ...notes.filter((n) => n !== existing && n !== replaced),
    note,
  ];
  if (result.length > 40)
    throw new Error(
      'Design memory has 40 topics. Update an existing topic instead.',
    );
  return result;
}

/** Same active project decisions for both AI roles. Full source turns stay in
 * saved notes/history for audit, without duplicating them in every AI prompt. */
export function compactDesignNotes(notes: DesignNote[]) {
  return notes.map((n) => ({
    topic: n.topic,
    text: n.text,
    source: n.source,
    ...(n.decision
      ? {
          decision: {
            id: n.decision.id,
            revision: n.decision.revision,
            quote: n.decision.quote,
            sourceMessageId: n.decision.origin.id,
          },
        }
      : {}),
  }));
}

export function decisionCitation(notes: DesignNote[], excerpt: string) {
  const matches = notes.filter(
    (n) =>
      designNoteSchema.safeParse(n).success &&
      n.source === 'user' &&
      n.decision?.quote.includes(excerpt),
  );
  if (!excerpt.trim() || matches.length !== 1)
    throw new Error(
      'The criterion must cite an unambiguous active user decision, not an assumption, legacy note or superseded wording.',
    );
  return matches[0].decision!;
}

export const decisionPolicy = `Active project design notes may contain a decision with a stable ID, revision, exact user quote and source-message ID. These preserve user-stated intent after recent messages expire. Consult relevant active decisions during later edits and inspect the actual starting geometry to determine affected parts. The active project version governs after Undo/Redo; older or failed conversation is not a second active constraint. A new explicit user instruction can revise a decision. Capture important continuing user choices and their reasons in the existing design_note operation with capture.quote copied EXACTLY from the current user request, including the relevant condition/reason, and capture.revises=null for a new decision or the active decision ID for a revision (even when renaming its topic). Capture and geometry commit atomically. Never record inferred proximity, construction assumptions or assistant suggestions as user decisions. Notes without decision provenance remain ordinary context, not independently citable user evidence. Do not create permanent geometric constraints or automatic edit permission from a note; infer relevance and preserve unrelated work. Ask only when a consequential ambiguity cannot reasonably be resolved.`;
