import type { ThoughtStatus, ThoughtType } from './types';

/** Extension contract only; the local MVP does not call any AI service. */
export interface ThoughtSuggestion {
  title: string;
  summary: string;
  content: string;
  type: ThoughtType;
  status: ThoughtStatus;
}
export interface ThoughtExtractionProvider {
  suggest(input: string): Promise<ThoughtSuggestion[]>;
}
