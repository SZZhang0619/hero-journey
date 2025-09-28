import { Injectable } from '@angular/core';
import { InMemoryDbService } from 'angular-in-memory-web-api';

export type Hero = { id: number; name: string; rank?: string };

const DEFAULT_HEROES: Hero[] = [
  { id: 11, name: 'Dr Nice', rank: 'B' },
  { id: 12, name: 'Narco', rank: 'A' },
  { id: 13, name: 'Bombasto', rank: 'S' },
  { id: 14, name: 'Celeritas', rank: 'A' },
  { id: 15, name: 'Magneta', rank: 'B' },
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
