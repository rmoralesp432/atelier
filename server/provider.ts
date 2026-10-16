import OpenAI from 'openai';
import { z } from 'zod';
import { parsePlan, planJsonSchema, type Plan } from '../src/intelligence/plan';
import { SYSTEM_PROMPT } from '../src/intelligence/context';
const vec = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();
const refs = z.array(z.string().max(100)).max(200);
export const requestSchema = z
  .object({
    pendingReview: z
      .object({ message: z.string().max(4000) })
      .strict()
      .nullable()
      .optional(),
    message: z.string().min(1).max(4000),
    history: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            content: z.string().max(4000),
          })
          .strict(),
      )
      .max(20),
    scene: z
      .object({
        units: z.literal('meters'),
        north: z.literal('-Z'),
        selectedIds: refs,
        conversation: z
          .object({
            focusIds: refs,
            lastCreatedIds: refs,
            lastOperands: refs,
            lastOperation: z.string().max(100).nullable(),
          })
          .strict(),
        camera: z
          .object({
            right: vec,
            forward: vec,
            visible: z
              .array(
                z
                  .object({
                    id: z.string(),
                    x: z.number().finite(),
                    y: z.number().finite(),
                  })
                  .strict(),
              )
              .max(200),
          })
          .strict(),
        objects: z
          .array(
            z
              .object({
                id: z.string().max(100),
                ordinal: z.number().int(),
                name: z.string().max(80),
                dimensions: z
                  .object({
                    width: z.number().finite(),
                    depth: z.number().finite(),
                    height: z.number().finite(),
                  })
                  .strict(),
                position: vec,
                rotation: z.number().finite(),
                shape: z.string().max(40),
                opening: z.boolean(),
                architecture: z
                  .object({
                    floors: z.number(),
                    slabThickness: z.number(),
                    facade: z.boolean(),
                    panelWidth: z.number(),
                    mullionWidth: z.number(),
                  })
                  .nullable()
                  .optional(),
              })
              .strict(),
          )
          .max(200),
      })
      .strict(),
  })
  .strict();
export type ModelRequest = z.infer<typeof requestSchema>;
export interface Provider {
  plan: (input: ModelRequest) => Promise<Plan>;
  voice: (sdp: string) => Promise<string>;
}
export function createProvider(
  key: string,
  fetchOverride?: typeof fetch,
): Provider {
  const client = new OpenAI({
    apiKey: key,
    timeout: 45_000,
    maxRetries: 1,
    ...(fetchOverride ? { fetch: fetchOverride } : {}),
  });
  return {
    async plan(input) {
      const response = await client.responses.create({
        model: process.env.ATELIER_TEXT_MODEL || 'gpt-4.1',
        store: false,
        max_output_tokens: 3500,
        instructions: SYSTEM_PROMPT,
        input: [
          ...input.history,
          {
            role: 'user',
            content: JSON.stringify({
              instruction: input.message,
              scene: input.scene,
              pendingReview: input.pendingReview ?? null,
            }),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'atelier_plan',
            strict: true,
            schema: planJsonSchema,
          },
        },
      });
      if (response.status !== 'completed' || !response.output_text)
        throw new Error(
          'The model did not return a complete plan. No geometry was changed.',
        );
      return parsePlan(JSON.parse(response.output_text));
    },
    async voice(sdp) {
      const response = await client.realtime.calls.create({
        sdp,
        session: {
          type: 'realtime',
          model: process.env.ATELIER_VOICE_MODEL || 'gpt-realtime',
          instructions:
            'You are the voice of ATELIER, a conversational architectural assistant. Let the user describe ideas naturally; never require primitive selection or tool menus. Ask one useful design question at a time and listen for the answer. For EVERY modeling request, answer to a design question, or design discussion call design with the user’s natural instruction verbatim, including references, corrections, and explicit approvals or cancellations. The design tool has the current scene, pending review and conversation. Never invent geometry changes or say an edit succeeded until the tool returns success. If a review is pending, briefly describe it and ask for confirmation; send the user’s spoken answer to design so the same validated review is used for voice and text. Speak briefly in the user’s language, summarizing the actual result without reading out internal coordinates. You can have continuous spoken conversation. Never ask for API keys.',
          audio: {
            input: {
              turn_detection: {
                type: 'semantic_vad',
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice: 'marin' },
          },
          tools: [
            {
              type: 'function',
              name: 'design',
              description:
                'Interpret the user instruction against the current architectural model and execute validated geometry operations. Returns actual measurements or clarification.',
              parameters: {
                type: 'object',
                properties: { instruction: { type: 'string' } },
                required: ['instruction'],
                additionalProperties: false,
              },
            },
          ],
          tool_choice: 'auto',
          max_output_tokens: 1000,
        },
      });
      return response.text();
    },
  };
}
