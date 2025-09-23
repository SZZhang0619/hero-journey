import { Injectable } from '@angular/core';

export type Hero = { id: number; name: string; rank?: string };

@Injectable({
  providedIn: 'root',
})
export class HeroService {
  protected readonly data: Hero[] = [
    { id: 11, name: 'Dr Nice', rank: 'B' },
    { id: 12, name: 'Narco', rank: 'A' },
    { id: 13, name: 'Bombasto' },
    { id: 14, name: 'Celeritas', rank: 'S' },
  ];

  getAll(): Hero[] {
    return this.data;
  }

  getById(id: number): Hero | undefined {
    return this.data.find((hero) => hero.id === id);
  }

  updateName(id: number, name: string): Hero | undefined {
    const hero = this.getById(id);
    if (!hero) return undefined;
    hero.name = name.trim();
    return hero;
  }
}
