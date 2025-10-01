import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

export type Hero = { id: number; name: string; rank?: string };

@Injectable({
  providedIn: 'root',
})
export class HeroService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'api/heroes';
  private readonly heroes = signal<Hero[]>([]);
  private readonly heroesById = computed(() => {
    const map = new Map<number, Hero>();
    for (const hero of this.heroes()) {
      map.set(hero.id, hero);
    }
    return map;
  });

  readonly heroesState = this.heroes.asReadonly();

  loadAll(): Observable<Hero[]> {
    return this.http.get<Hero[]>(this.baseUrl).pipe(
      tap((list) => this.heroes.set(list))
    );
  }

  getById(id: number): Observable<Hero> {
    const cached = this.heroesById().get(id);
    if (cached) {
      return of(cached);
    }

    return this.http.get<Hero>(`${this.baseUrl}/${id}`).pipe(
      tap((hero) => {
        this.heroes.update((current) => {
          const exists = current.some((item) => item.id === hero.id);
          return exists ? current : [...current, hero];
        });
      })
    );
  }

  create(hero: Pick<Hero, 'name' | 'rank'>): Observable<Hero> {
    const payload = {
      name: hero.name.trim(),
      ...(hero.rank ? { rank: hero.rank } : {}),
    } as Partial<Hero>;

    return this.http.post<Hero>(this.baseUrl, payload).pipe(
      tap((created) => {
        this.heroes.update((current) => [...current, created]);
      })
    );
  }

  update(id: number, changes: Partial<Hero>): Observable<Hero> {
    const cached = this.heroesById().get(id);
    const payload = { ...(cached ?? { id }), ...changes, id } as Partial<Hero> & {
      id: number;
    };
    if (payload.rank === '' || payload.rank == null) {
      delete payload.rank;
    }

    return this.http.put<Hero>(`${this.baseUrl}/${id}`, payload).pipe(
      tap((updated) => {
        this.heroes.update((current) =>
          current.map((hero) => (hero.id === updated.id ? updated : hero))
        );
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.heroes.update((current) => current.filter((hero) => hero.id !== id));
      })
    );
  }

  search$(term: string): Observable<Hero[]> {
    const keyword = term.trim();
    if (!keyword) {
      return of([]);
    }

    const params = new HttpParams().set('name', keyword);

    return this.http.get<Hero[]>(this.baseUrl, { params }).pipe(
      tap((heroes) => {
        if (!heroes.length) {
          return;
        }

        this.heroes.update((current) => {
          const map = new Map(current.map((hero) => [hero.id, hero] as const));
          for (const hero of heroes) {
            map.set(hero.id, hero);
          }
          return Array.from(map.values());
        });
      })
    );
  }
}
