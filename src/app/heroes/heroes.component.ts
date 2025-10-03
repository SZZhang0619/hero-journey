import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HeroService, Hero } from '../hero.service';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { LoadingSpinner } from '../ui/loading-spinner/loading-spinner';
import { HeroListItem } from '../ui/hero-list-item/hero-list-item';
import { MessageBanner } from '../ui/message-banner/message-banner';

type HeroRank = '' | 'S' | 'A' | 'B' | 'C';
type HeroFormGroup = FormGroup<{
  name: FormControl<string>;
  rank: FormControl<HeroRank>;
}>;

@Component({
  selector: 'app-heroes',
  imports: [
    ReactiveFormsModule,
    RouterModule,
    LoadingSpinner,
    MessageBanner,
    HeroListItem,
  ],
  templateUrl: './heroes.component.html',
  styleUrl: './heroes.component.scss',
})
export class HeroesComponent {
  private readonly heroService = inject(HeroService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  protected readonly heroes = this.heroService.heroesState;
  protected readonly heroesLoading = signal(true);
  protected readonly heroesError = signal<string | null>(null);

  protected readonly activeRank = signal<string>('ALL');
  protected readonly rankOptions = computed(() => {
    const ranks = new Set<string>();
    for (const hero of this.heroes()) {
      if (hero.rank) {
        ranks.add(hero.rank);
      }
    }
    return ['ALL', ...Array.from(ranks).sort()];
  });

  protected readonly filteredHeroes = computed(() => {
    const rank = this.activeRank();
    const list = this.heroes();
    if (rank === 'ALL') {
      return list;
    }
    return list.filter((hero) => hero.rank === rank);
  });

  protected readonly rawSearchResults = signal<Hero[]>([]);
  protected readonly filteredSearchResults = computed(() => {
    const rank = this.activeRank();
    const results = this.rawSearchResults();
    if (rank === 'ALL') {
      return results;
    }
    return results.filter((hero) => hero.rank === rank);
  });

  private readonly fallbackRanks: HeroRank[] = ['S', 'A', 'B', 'C'];
  protected readonly formRankOptions = computed<HeroRank[]>(() => {
    const derived = this.rankOptions().filter((option) => option !== 'ALL') as HeroRank[];
    return derived.length ? derived : this.fallbackRanks;
  });

  protected readonly createForm: HeroFormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    rank: this.fb.nonNullable.control<HeroRank>(''),
  });
  protected readonly editForm: HeroFormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    rank: this.fb.nonNullable.control<HeroRank>(''),
  });
  protected readonly editFormValue = signal<{name: string, rank: HeroRank}>({name: '', rank: ''});
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly selectedId = signal<number | null>(null);
  protected readonly selectedHero = computed(() => {
    const id = this.selectedId();
    if (id == null) {
      return null;
    }
    return this.heroes().find((hero) => hero.id === id) ?? null;
  });
  protected readonly dirtyCompared = computed(() => {
    const selected = this.selectedHero();
    if (!selected) {
      return false;
    }
    const value = this.editFormValue();
    const isDirty = (
      value.name.trim() !== selected.name ||
      value.rank !== ((selected.rank as HeroRank) ?? '')
    );

    return isDirty;
  });
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly deletingId = signal<number | null>(null);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly feedback = signal<string | null>(null);

  private readonly searchTerms = new Subject<string>();
  protected readonly searchKeyword = signal('');
  protected readonly searchMessage = signal<string | null>(null);
  protected readonly searchError = signal<string | null>(null);
  protected readonly searching = signal(false);

  constructor() {
    // 監聽編輯表單值變化
    this.editForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.editFormValue.set({
          name: value.name || '',
          rank: value.rank || ''
        });
      });

    this.heroService
      .loadAll()
      .pipe(
        finalize(() => this.heroesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.heroesError.set(null);
        },
        error: (err) => {
          this.heroesError.set(String(err ?? 'Unknown error'));
        },
      });

    effect(() => {
      const options = this.formRankOptions();
      const control = this.createForm.controls.rank;
      const current = control.value;
      if (!current) {
        return;
      }
      if (!options.includes(current)) {
        const fallback: HeroRank = options[0] ?? '';
        control.setValue(fallback, { emitEvent: false });
        control.markAsPristine();
        control.markAsUntouched();
      }
    });

    effect(() => {
      const selected = this.selectedHero();
      if (!selected) {
        this.editForm.reset({ name: '', rank: '' });
        this.editForm.markAsPristine();
        this.editForm.markAsUntouched();
        this.editFormValue.set({ name: '', rank: '' });
        this.saveError.set(null);
        return;
      }

      const formValue = {
        name: selected.name,
        rank: (selected.rank as HeroRank) ?? '',
      };
      this.editForm.reset(formValue);
      this.editForm.markAsPristine();
      this.editForm.markAsUntouched();
      this.editFormValue.set(formValue);
      this.saveError.set(null);
    });

    this.searchTerms
      .pipe(
        map((term) => term.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        filter((term) => term.length === 0 || term.length >= 2),
        tap((term) => {
          this.searchKeyword.set(term);
          this.searchError.set(null);
          this.searchMessage.set(term ? '搜尋中...' : null);
          this.feedback.set(null);
          if (!term) {
            this.rawSearchResults.set([]);
          }
          this.searching.set(term.length > 0);
        }),
        switchMap((term) => {
          if (!term) {
            return of<Hero[]>([]);
          }

          return this.heroService.search$(term).pipe(
            tap((heroes) => {
              if (heroes.length) {
                this.searchMessage.set(`命中 ${heroes.length} 位英雄`);
              } else {
                this.searchMessage.set('沒有符合條件的英雄，試著換個關鍵字。');
              }
            }),
            catchError((err) => {
              this.searchError.set(String(err ?? 'Unknown error'));
              this.searchMessage.set('查詢失敗，可稍後重試。');
              return of<Hero[]>([]);
            }),
            finalize(() => this.searching.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((heroes) => {
        this.rawSearchResults.set(heroes);
        this.searching.set(false);
      });
  }

  protected setRankFilter(option: string) {
    this.activeRank.set(option);
  }

  protected rankLabel(option: string) {
    return option === 'ALL' ? '全部' : option;
  }

  protected search(term: string) {
    this.searchTerms.next(term);
  }

  protected addHero() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { name, rank } = this.createForm.getRawValue();
    const payload: Pick<Hero, 'name' | 'rank'> = {
      name: name.trim(),
      rank: rank || undefined,
    };

    this.creating.set(true);
    this.createError.set(null);
    this.feedback.set(null);

    this.heroService
      .create(payload)
      .pipe(
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (created) => {
          this.feedback.set('新增英雄成功！');
          this.createForm.reset({ name: '', rank: '' });
          this.selectedId.set(created.id);
        },
        error: (err) => {
          this.createError.set(String(err ?? 'Unknown error'));
        },
      });
  }

  protected saveSelected() {
    const hero = this.selectedHero();
    if (!hero || this.editForm.invalid || !this.dirtyCompared()) {
      return;
    }

    const { name, rank } = this.editForm.getRawValue();

    this.saving.set(true);
    this.saveError.set(null);
    this.feedback.set(null);

    this.heroService
      .update(hero.id, { name: name.trim(), rank: rank || undefined })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (updated) => {
          this.feedback.set('更新英雄成功！');
          this.selectedId.set(updated.id);
        },
        error: (err) => {
          this.saveError.set(String(err ?? 'Unknown error'));
        },
      });
  }

  protected removeHero(hero: Hero) {
    const confirmed = confirm(`確定要刪除英雄「${hero.name}」嗎？`);
    if (!confirmed) {
      return;
    }

    this.deletingId.set(hero.id);
    this.deleteError.set(null);
    this.feedback.set(null);

    this.heroService
      .delete(hero.id)
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
        if (this.selectedId() === hero.id) {
          this.selectedId.set(null);
        }
        this.feedback.set(`已刪除英雄「${hero.name}」。`);
      });
  }

  protected onSelect(heroId: number) {
    const current = this.selectedId();
    this.selectedId.set(current === heroId ? null : heroId);
  }
}
