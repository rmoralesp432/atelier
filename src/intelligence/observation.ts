import { z } from 'zod';
import { MAX_SCENE_OBJECTS } from '../limits';
export const observationSchema = z
  .object({
    status: z.enum(['ready', 'unavailable']),
    note: z.string().max(600),
    objectIds: z.array(z.string().max(100)).max(MAX_SCENE_OBJECTS),
    views: z
      .array(
        z
          .object({
            label: z.string().max(200),
            image: z
              .string()
              .max(800000)
              .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
          })
          .strict(),
      )
      .max(2),
  })
  .strict();
export type SceneObservation = z.infer<typeof observationSchema>;
