import { expect, it } from 'vitest';
import {
  requestedLanguage,
  languagePolicy,
  localizedCompletion,
} from './language';
it('retains English across foreign architectural terminology, names, recognition mistakes and negation', () => {
  for (const text of [
    'Give the lobby doble altura.',
    'Create a Barcelona pavilion.',
    'Una columna en la entrada',
    'Do not switch to Spanish.',
    'Translate the word ceiling into Spanish.',
    'Model a Spanish courtyard.',
  ])
    expect(requestedLanguage(text, 'en')).toBe('en');
});
it('changes only intentional conversation language and retains it across follow-ups', () => {
  let language = requestedLanguage('Please respond in Spanish.', 'en');
  expect(language).toBe('es');
  language = requestedLanguage('Now make it taller.', language);
  expect(language).toBe('es');
  expect(requestedLanguage('Can you switch to English?', language)).toBe('en');
  expect(requestedLanguage('Por favor responde en inglés', 'es')).toBe('en');
  expect(requestedLanguage('Please answer in French', 'en')).toBe('fr');
  expect(languagePolicy()).toContain('Default is English');
});

it('localizes the host completion claim without turning unknown evidence into success', () => {
  expect(localizedCompletion('es', true)).toContain('Completado');
  expect(localizedCompletion('es', false)).toContain('verificación incompleta');
  expect(localizedCompletion('en', true)).toBeUndefined();
});
