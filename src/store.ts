import { create } from 'zustand';
import type { Card, CardLink, Chapter, ThoughtSystem } from './types';
import * as repo from './repository';

interface LibraryState {
  cards: Card[];
  cardLinks: CardLink[];
  systems: ThoughtSystem[];
  chapters: Chapter[];
  refresh: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>(set => ({
  cards: [],
  cardLinks: [],
  systems: [],
  chapters: [],
  async refresh() {
    const [cards, cardLinks, systems, chapters] = await Promise.all([
      repo.listCards(),
      repo.listCardLinks(),
      repo.listSystems(),
      repo.listChapters(),
    ]);
    set({ cards, cardLinks, systems, chapters });
  },
}));
