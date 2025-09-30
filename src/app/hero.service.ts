import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { delay, of, tap } from 'rxjs';

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
      delay(2000),
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

  create$(name: string) {
    const payload = { name: name.trim() };
    return this.http.post<Hero>(this.baseUrl, payload).pipe(
      tap((created) => {
        this.cache.set(created.id, created);
      })
    );
  }

  update$(id: number, changes: Partial<Hero>) {
    const cached = this.cache.get(id);
    const payload = { ...(cached ?? { id }), ...changes, id };

    return this.http.put<Hero>(`${this.baseUrl}/${id}`, payload).pipe(
      tap((updated) => {
        this.cache.set(updated.id, updated);
      })
    );
  }

  delete$(id: number) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.cache.delete(id);
      })
    );
  }

  search$(term: string) {
    const keyword = term.trim();
    if (!keyword) {
      return of<Hero[]>([]);
    }

    const params = new HttpParams().set('name', keyword);

    return this.http.get<Hero[]>(this.baseUrl, { params }).pipe(
      tap((heroes) => {
        for (const hero of heroes) {
          this.cache.set(hero.id, hero);
        }
      })
    );
  }
}
