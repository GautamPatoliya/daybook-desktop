/** Re-export shared recipient helpers for the renderer. */
export {
  filterEmailSuggestions,
  isPlausibleEmail,
  mergeSuggestionPool,
  normalizeEmailToken,
  normalizeRecipientHistory,
  parseEmailList,
  serializeEmailList,
  upsertEmailHistory,
} from '../../shared/emailRecipients';
