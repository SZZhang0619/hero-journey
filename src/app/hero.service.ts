import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { tap } from 'rxjs';

export type Hero = { id: number; name: string; rank?: string };

@Injectable({
  providedIn: 'root',
})
export class HeroService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'api/heroes';
  private readonly cache = new Map<number, Hero>();

  getAll$() {
    return this.http.get<Hero[]>(this.baseUrl).pipe(
      tap((heroes) => {
        this.cache.clear();
        for (const hero of heroes) {
          this.cache.set(hero.id, hero);
        }
      })
    );
  }

  getById$(id: number) {
    return this.http.get<Hero>(`${this.baseUrl}/${id}`).pipe(
      tap((hero) => {
        if (!hero) {
          return;
        }
        this.cache.set(hero.id, hero);
      })
    );
  }

  updateName(id: number, name: string): Hero | undefined {
    const hero = this.cache.get(id);

    if (!hero) return undefined;

    const updated = { ...hero, name: name.trim() };
    this.cache.set(updated.id, updated);
    return updated;
  }
}
