import { Injectable } from '@angular/core';
import { delay, of, throwError } from 'rxjs';

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

  // 新增：以 Observable 回傳資料，加入 delay 模擬網路延遲
  getAll$() {
    // return of(this.getAll()).pipe(delay(2000));
    return throwError(() => new Error(`此為人工製造錯誤`));
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
