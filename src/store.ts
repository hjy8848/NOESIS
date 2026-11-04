import { create } from 'zustand';
import { Thought } from './types';
import * as repo from './repository';

interface LibraryState {
  thoughts: Thought[];
  decks: repo.Deck[];
  relations: repo.Relation[];
  favorites: string[];
  sources: repo.Source[];
  refresh: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>(set => ({
  thoughts:[], decks:[], relations:[], favorites:[], sources:[],
  async refresh() {
    set(await repo.loadLibrary());
  },
}));
