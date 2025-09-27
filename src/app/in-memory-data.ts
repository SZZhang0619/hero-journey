import { Injectable } from '@angular/core';
import { InMemoryDbService } from 'angular-in-memory-web-api';

export type Hero = { id: number; name: string; rank?: string };

@Injectable({
  providedIn: 'root',
})
export class InMemoryData implements InMemoryDbService {
  createDb() {
    const heroes: Hero[] = [
      { id: 11, name: 'Dr Nice', rank: 'B' },
      { id: 12, name: 'Narco', rank: 'A' },
      { id: 13, name: 'Bombasto', rank: 'S' },
      { id: 14, name: 'Celeritas', rank: 'A' },
      { id: 15, name: 'Magneta', rank: 'B' },
    ];
    return { heroes };
  }
}
