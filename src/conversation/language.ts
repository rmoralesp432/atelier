/** Conversation preference, independent of browser locale or detected words. */
export const languages = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Chinese',
  ar: 'Arabic',
  ko: 'Korean',
  ru: 'Russian',
} as const;
export type ConversationLanguage = keyof typeof languages;
export function isLanguage(value: unknown): value is ConversationLanguage {
  return typeof value === 'string' && Object.hasOwn(languages, value);
}
export function readLanguage(): ConversationLanguage {
  try {
    const value = localStorage.getItem('atelier.conversation-language');
    return isLanguage(value) ? value : 'en';
  } catch {
    return 'en';
  }
}
export function saveLanguage(language: ConversationLanguage) {
  try {
    localStorage.setItem('atelier.conversation-language', language);
  } catch {
    /* Optional preference. */
  }
}
const names: Record<string, ConversationLanguage> = {
  english: 'en',
  ingles: 'en',
  spanish: 'es',
  espanol: 'es',
  french: 'fr',
  francais: 'fr',
  german: 'de',
  deutsch: 'de',
  italian: 'it',
  italiano: 'it',
  portuguese: 'pt',
  portugues: 'pt',
  japanese: 'ja',
  chinese: 'zh',
  arabic: 'ar',
  korean: 'ko',
  russian: 'ru',
};
export function requestedLanguage(
  text: string,
  current: ConversationLanguage,
): ConversationLanguage {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  // Deliberate preference clauses only. A place/name, borrowed term, translation
  // exercise, or mostly-Spanish recognition result is not a language switch.
  const pattern =
    /(?:^|[.!?;]\s*|\band\s+)(?:from now on[, ]*|ahora[, ]*)?(?:(?:can|could|would) you\s+)?(?:please\s+|por favor[, ]*)?(?:speak|respond|reply|answer|talk|continue|switch|use|habla|hablar|responde|responder|contesta|continua|cambia)(?:\s+to me)?\s+(?:(?:in|to|en|a|al)\s+)?([a-z]+)\b/g;
  for (const match of normalized.matchAll(pattern))
    if (names[match[1]]) current = names[match[1]];
  return current;
}
export function languagePolicy(language: ConversationLanguage = 'en') {
  return `Conversation language: ${languages[language]}. Default is English. Speak and write in the selected language consistently. Change it only when the user explicitly requests another conversation language; keep that preference for follow-up turns. Never switch because of a borrowed architectural word, proper noun, place name, browser locale, or recognition mistake. Expect speech primarily in ${languages[language]}, while retaining foreign names and architectural terminology. Internal measurements may remain in English; explain their result in the selected language.`;
}

// Host-owned completion claims stay evidence-based even when the selected
// language differs from the internal geometric receipts. No translation call.
export function localizedCompletion(
  language: ConversationLanguage,
  verified: boolean,
): string | undefined {
  const messages: Record<
    Exclude<ConversationLanguage, 'en'>,
    [string, string]
  > = {
    es: [
      'Completado; las comprobaciones geométricas disponibles se superaron. Puedes consultar las mediciones.',
      'Cambios aplicados con verificación incompleta. Todavía no puedo confirmar todos los requisitos. Consulta las limitaciones en las mediciones.',
    ],
    fr: [
      'Terminé ; les contrôles géométriques disponibles ont réussi. Consultez les mesures.',
      'Modifications appliquées avec une vérification incomplète. Tous les critères ne sont pas encore confirmés. Consultez les limites dans les mesures.',
    ],
    de: [
      'Abgeschlossen; die verfügbaren Geometrieprüfungen wurden bestanden. Siehe Messungen.',
      'Änderungen mit unvollständiger Prüfung angewendet. Noch sind nicht alle Anforderungen bestätigt. Siehe Einschränkungen in den Messungen.',
    ],
    it: [
      'Completato; i controlli geometrici disponibili sono superati. Consulta le misure.',
      'Modifiche applicate con verifica incompleta. Non tutti i requisiti sono confermati. Consulta i limiti nelle misure.',
    ],
    pt: [
      'Concluído; as verificações geométricas disponíveis passaram. Consulte as medições.',
      'Alterações aplicadas com verificação incompleta. Ainda não posso confirmar todos os requisitos. Consulte as limitações nas medições.',
    ],
    ja: [
      '完了しました。利用可能な形状検証に合格しました。計測結果を確認できます。',
      '変更を適用しましたが、検証は未完了です。すべての要件を確認できていません。計測結果の制限事項をご確認ください。',
    ],
    zh: [
      '已完成，现有几何检查已通过。请查看测量结果。',
      '已应用更改，但验证尚不完整。目前无法确认所有要求。请查看测量结果中的限制。',
    ],
    ar: [
      'اكتمل العمل واجتاز الفحوصات الهندسية المتاحة. راجع القياسات.',
      'طُبقت التغييرات مع تحقق غير مكتمل. لا يمكن تأكيد جميع المتطلبات بعد. راجع القيود في القياسات.',
    ],
    ko: [
      '완료했습니다. 사용 가능한 형상 검사를 통과했습니다. 측정 결과를 확인하세요.',
      '변경을 적용했지만 검증이 완료되지 않았습니다. 모든 요구 사항을 아직 확인할 수 없습니다. 측정 결과의 제한 사항을 확인하세요.',
    ],
    ru: [
      'Готово; доступные геометрические проверки пройдены. См. измерения.',
      'Изменения применены с неполной проверкой. Пока нельзя подтвердить все требования. См. ограничения в измерениях.',
    ],
  };
  return language === 'en' ? undefined : messages[language][verified ? 0 : 1];
}
