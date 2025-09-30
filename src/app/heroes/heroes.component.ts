import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { HeroService, Hero } from '../hero.service';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { HeroBadge } from '../hero-badge/hero-badge';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { LoadingSpinner } from '../ui/loading-spinner/loading-spinner';

@Component({
  selector: 'app-heroes',
  imports: [HeroBadge, FormsModule, RouterModule, LoadingSpinner],
  templateUrl: './heroes.component.html',
  styleUrl: './heroes.component.scss',
})
export class HeroesComponent {
  // 注入服務與 DestroyRef
  private readonly heroService = inject(HeroService);
  private readonly destroyRef = inject(DestroyRef);

  // 狀態：英雄清單、目前選中的英雄、載入、錯誤
  protected readonly heroes = signal<Hero[]>([]);
  protected readonly selectedHero = signal<Hero | null>(null);
  protected readonly heroesLoading = signal(true);
  protected readonly heroesError = signal<string | null>(null);

  // 新增：編輯與儲存狀態
  protected readonly editName = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  // 新增：建立英雄表單狀態
  protected readonly newHeroName = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly deletingId = signal<number | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  private readonly searchTerms = new Subject<string>();
  protected readonly searchKeyword = signal('');
  protected readonly searchResults = signal<Hero[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchError = signal<string | null>(null);

  constructor() {
    // 從 Observable 取得資料
    this.heroService
      .getAll$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.heroes.set(list);
          this.heroesLoading.set(false);
        },
        error: (err) => {
          this.heroesError.set(String(err ?? 'Unknown error'));
          this.heroesLoading.set(false);
        },
      });

    effect(() => {
      const current = this.selectedHero();
      this.editName.set(current?.name ?? '');
      this.saveError.set(null);
    });

    this.searchTerms
      .pipe(
        map((term) => term.trim()),
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) => {
          this.searchKeyword.set(term);
          this.searchError.set(null);
          this.searchResults.set([]);
        }),
        switchMap((term) => {
          if (!term) {
            this.searching.set(false);
            return of<Hero[]>([]);
          }

          this.searching.set(true);
          return this.heroService.search$(term).pipe(
            catchError((err) => {
              this.searchError.set(String(err ?? 'Unknown error'));
              return of<Hero[]>([]);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((heroes) => {
        this.searchResults.set(heroes);
        this.searching.set(false);
      });
  }

  // 點擊處理
  onSelect(hero: Hero) {
    const current = this.selectedHero();
    this.selectedHero.set(current?.id === hero.id ? null : hero);
  }

  saveSelected() {
    const current = this.selectedHero();
    if (!current) {
      return;
    }

    const name = this.editName().trim();
    if (name.length < 3 || name === current.name) {
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.feedback.set(null);

    this.heroService
      .update$(current.id, { name })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.heroes.update((list) =>
            list.map((hero) => (hero.id === updated.id ? updated : hero))
          );
          this.selectedHero.set(updated);
          this.editName.set(updated.name);
          this.saving.set(false);
        },
        error: (err) => {
          this.saveError.set(String(err ?? 'Unknown error'));
          this.saving.set(false);
        },
      });
  }

  addHero() {
    const name = this.newHeroName().trim();
    if (name.length < 3) {
      return;
    }

    this.creating.set(true);
    this.createError.set(null);
    this.feedback.set(null);

    this.heroService
      .create$(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.heroes.update((list) => [...list, created]);
          this.newHeroName.set('');
          this.selectedHero.set(created);
          this.editName.set(created.name);
          this.creating.set(false);
        },
        error: (err) => {
          this.createError.set(String(err ?? 'Unknown error'));
          this.creating.set(false);
        },
      });
  }

  removeHero(hero: Hero) {
    const confirmed = confirm(`確定要刪除英雄「${hero.name}」嗎？`);
    if (!confirmed) {
      return;
    }

    this.deletingId.set(hero.id);
    this.deleteError.set(null);
    this.feedback.set(null);

    this.heroService
      .delete$(hero.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.deleteError.set(String(err ?? 'Unknown error'));
          return EMPTY;
        }),
        finalize(() => {
          this.deletingId.set(null);
        })
      )
      .subscribe(() => {
        this.heroes.update((list) => list.filter((h) => h.id !== hero.id));
        if (this.selectedHero()?.id === hero.id) {
          this.selectedHero.set(null);
          this.editName.set('');
        }
        this.feedback.set(`已刪除英雄「${hero.name}」。`);
      });
  }

  search(term: string) {
    this.searchTerms.next(term);
  }
}
