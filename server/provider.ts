import { componentSchema, poseSchema } from '../src/design/schema';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  parsePlan,
  planJsonSchema,
  operationSchema,
  type Plan,
} from '../src/intelligence/plan';
import {
  SYSTEM_PROMPT,
  SPATIAL_PROMPT,
  FORM_PROMPT,
} from '../src/intelligence/context';
const vec = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();
const refs = z.array(z.string().max(100)).max(200);
const imageList = z
  .array(
    z
      .string()
      .max(1_000_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
  )
  .max(2);
export const requestSchema = z
  .object({
    images: imageList.optional(),
    validationFeedback: z
      .object({
        error: z.string().max(2000),
        operations: z.array(operationSchema).max(12),
      })
      .strict()
      .optional(),
    workspace: z
      .object({
        mapVisible: z.boolean(),
        arActive: z.boolean().optional(),
        mapConfigured: z.boolean(),
        view: z.enum(['perspective', 'orthographic', 'top']),
        theme: z.enum(['day', 'night']),
        renderMode: z.enum(['studio', 'wireframe', 'hidden-line']),
        section: z
          .object({
            enabled: z.boolean(),
            planeVisible: z.boolean().optional(),
            axis: z.enum(['x', 'y', 'z']),
            position: z.number().min(-1000).max(1000),
            flip: z.boolean(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    pendingReview: z
      .object({
        message: z.string().max(4000),
        operations: z.array(operationSchema).max(12).optional(),
        outcome: z.string().max(16000).optional(),
      })
      .strict()
      .nullable()
      .optional(),
    historyAvailability: z
      .object({
        undo: z.number().int().min(0).max(50),
        redo: z.number().int().min(0).max(50),
      })
      .strict()
      .optional(),
    message: z.string().min(1).max(4000),
    history: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            content: z.string().max(4000),
            images: imageList.optional(),
          })
          .strict(),
      )
      .max(20),
    scene: z
      .object({
        design: z
          .object({
            views: z
              .array(
                z.object({ name: z.string().max(80), targets: refs }).strict(),
              )
              .max(30),
            alternatives: z
              .array(
                z
                  .object({
                    name: z.string().max(80),
                    objects: z.number().int().min(0).max(200),
                  })
                  .strict(),
              )
              .max(6),
          })
          .strict()
          .optional(),
        units: z.literal('meters'),
        north: z.literal('-Z'),
        groups: z
          .array(
            z
              .object({
                id: z.string().max(100),
                name: z.string().max(80),
                visible: z.boolean(),
                locked: z.boolean(),
              })
              .strict(),
          )
          .max(50)
          .optional(),
        mapBearing: z.number().nullable().optional(),
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
            pose: poseSchema.optional(),
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
                component: componentSchema.optional(),
                ordinal: z.number().int(),
                groupId: z.string().nullable().optional(),
                visible: z.boolean().optional(),
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
                material: z
                  .enum(['solid', 'glass', 'frame'])
                  .nullable()
                  .optional(),
                color: z
                  .string()
                  .regex(/^#[0-9a-fA-F]{6}$/)
                  .optional(),
                opening: z.boolean(),
                spatial: z
                  .object({
                    envelopeBounds: z.object({ min: vec, max: vec }).strict(),
                    flat: z.boolean(),
                    reference: z.boolean().optional(),
                    footprint: z
                      .array(
                        z
                          .object({
                            x: z.number().finite(),
                            z: z.number().finite(),
                          })
                          .strict(),
                      )
                      .max(64)
                      .nullable(),
                    openingSize: z
                      .object({
                        width: z.number().finite(),
                        height: z.number().finite(),
                      })
                      .strict()
                      .nullable(),
                    operands: z
                      .array(
                        z
                          .object({
                            id: z.string().max(100),
                            name: z.string().max(80),
                          })
                          .strict(),
                      )
                      .max(2),
                  })
                  .strict()
                  .optional(),
                fixedWindowWidth: z.number().nullable().optional(),
                display: z
                  .object({
                    mode: z.enum(['architecture', 'volume']),
                    floors: z.boolean(),
                    glass: z.boolean(),
                  })
                  .strict()
                  .nullable()
                  .optional(),
                formDefinition: z.string().max(24000).nullable().optional(),
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
    maxRetries: 0,
    ...(fetchOverride ? { fetch: fetchOverride } : {}),
  });
  return {
    async plan(input) {
      const response = await client.responses.create({
        model: process.env.ATELIER_TEXT_MODEL || 'gpt-4.1',
        store: false,
        max_output_tokens: 6000,
        instructions: SYSTEM_PROMPT + SPATIAL_PROMPT + FORM_PROMPT,
        input: [
          ...input.history.map((m) => ({
            role: m.role,
            content:
              m.images?.length && m.role === 'user'
                ? [
                    { type: 'input_text' as const, text: m.content },
                    ...m.images.map((image_url) => ({
                      type: 'input_image' as const,
                      image_url,
                      detail: 'auto' as const,
                    })),
                  ]
                : m.content,
          })),
          {
            role: 'user',
            content: [
              {
                type: 'input_text' as const,
                text: JSON.stringify({
                  instruction: input.message,
                  validationFeedback: input.validationFeedback ?? null,
                  workspace: input.workspace ?? null,
                  scene: input.scene,
                  pendingReview: input.pendingReview ?? null,
                  historyAvailability: input.historyAvailability ?? null,
                }),
              },
              ...(input.images ?? []).map((image_url) => ({
                type: 'input_image' as const,
                image_url,
                detail: 'auto' as const,
              })),
            ],
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
            'You are the voice of ATELIER, a conversational architectural assistant. Let the user describe ideas naturally; never require primitive selection or tool menus. Ask one useful design question at a time and listen for the answer. For EVERY modeling request, workspace control request (map on/off, camera perspective/orthographic/top, theme, wireframe, panels), answer to a design question, or design discussion call design with the user’s natural instruction verbatim, including references, corrections, and explicit approvals or cancellations. The design tool has the current scene, pending review and conversation. Never invent geometry changes or say an edit succeeded until the tool returns success. If a review is pending, briefly describe it and ask for confirmation; send the user’s spoken answer to design so the same validated review is used for voice and text. Speak briefly in the user’s language, summarizing the actual result without reading out internal coordinates. You can have continuous spoken conversation. Never ask for API keys.',
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
                'Interpret the user instruction against the current architectural model and execute validated geometry operations or workspace controls. Returns actual measurements or clarification.',
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
