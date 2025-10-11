import { Injectable } from '@angular/core';
import { InMemoryDbService } from 'angular-in-memory-web-api';

export type Hero = { id: number; name: string; rank?: string; skills?: string[] };

const DEFAULT_HEROES: Hero[] = [
  { id: 11, name: 'Dr Nice', rank: 'B', skills: ['Healing', 'Support'] },
  { id: 12, name: 'Narco', rank: 'A', skills: ['Stealth', 'Tactics'] },
  { id: 13, name: 'Bombasto', rank: 'S', skills: ['Explosives', 'Engineering'] },
  { id: 14, name: 'Celeritas', rank: 'A', skills: ['Speed', 'Evade'] },
  { id: 15, name: 'Magneta', rank: 'B', skills: ['Magnetism', 'Shielding'] },
];

@Injectable({
  providedIn: 'root',
})
export class InMemoryData implements InMemoryDbService {
  createDb() {
    return {
      heroes: DEFAULT_HEROES.map((hero) => ({ ...hero })),
    };
  }

  genId(collection: Hero[]): number {
    if (collection.length === 0) {
      return 11;
    }

    const maxId = collection.reduce(
      (max, hero) => (hero.id > max ? hero.id : max),
      0
    );

    return maxId + 1;
  }
}
