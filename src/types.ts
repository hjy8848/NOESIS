export type ThoughtType = 'proposition' | 'concept' | 'source';
export type ThoughtStatus = 'exploring' | 'formed' | 'supported' | 'challenged' | 'revised';

export interface Thought {
  id: string;
  title: string;
  summary: string;
  content: string;
  type: ThoughtType;
  status: ThoughtStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: 'pending' | 'synced';
}
