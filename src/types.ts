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

export interface Card {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CardLink {
  id: string;
  sourceCardId: string;
  targetCardId: string;
}

export interface ThoughtSystem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  systemId: string;
  title: string;
  position: number;
  cardCount?: number;
}

export type ChapterCardEntry = Card & {
  chapterId: string;
  position: number;
};

export type SystemDocument = {
  system: ThoughtSystem;
  chapters: (Chapter & { cards: Card[] })[];
};
