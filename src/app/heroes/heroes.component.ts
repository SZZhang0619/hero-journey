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
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
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
  timer,
} from 'rxjs';
import { LoadingSpinner } from '../ui/loading-spinner/loading-spinner';
import { HeroListItem } from '../ui/hero-list-item/hero-list-item';
import { MessageBanner } from '../ui/message-banner/message-banner';

type HeroRank = '' | 'S' | 'A' | 'B' | 'C';
type HeroFormGroup = FormGroup<{
  name: FormControl<string>;
  rank: FormControl<HeroRank>;
}>;

const HERO_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9\s'-]{2,23}$/;
const RESERVED_HERO_NAMES = ['admin', 'root', 'unknown'] as const;

function heroNameReservedValidator(names: readonly string[]): ValidatorFn {
  const normalized = names.map((name) => name.trim().toLowerCase());
  return (control) => {
    const value = (control.value ?? '').trim().toLowerCase();
    if (!value) {
      return null;
    }
    return normalized.includes(value) ? { reserved: true } : null;
  };
}

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
    name: this.fb.nonNullable.control('', {
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(24),
        Validators.pattern(HERO_NAME_PATTERN),
        heroNameReservedValidator(RESERVED_HERO_NAMES),
      ],
      updateOn: 'blur',
    }),
    rank: this.fb.nonNullable.control<HeroRank>(''),
  });
  protected readonly editForm: HeroFormGroup = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', {
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(24),
        Validators.pattern(HERO_NAME_PATTERN),
        heroNameReservedValidator(RESERVED_HERO_NAMES),
      ],
      updateOn: 'blur',
    }),
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

  private lastEditHeroId: number | null = null;

  private readonly validationMessages: Record<string, string> = {
    required: '名稱必填，不能空白。',
    minlength: '請至少輸入 3 個字。',
    maxlength: '名稱不可超過 24 個字。',
    pattern: '僅允許英文、數字、空白與 -′ 字元。',
    reserved: '這個名稱被列為保留字，請換一個。',
    duplicated: '已有英雄使用這個名稱。',
  };

  protected controlError(control: AbstractControl | null): string | null {
    if (!control || control.disabled || !control.invalid || !control.touched) {
      return null;
    }
    const errors = control.errors as ValidationErrors | null;
    if (!errors) {
      return null;
    }
    for (const key of Object.keys(errors)) {
      const message = this.validationMessages[key];
      if (message) {
        return message;
      }
    }
    return '輸入格式不正確，請再試一次。';
  }

  constructor() {
    for (const control of [this.createForm.controls.name, this.editForm.controls.name]) {
      control.addAsyncValidators(this.heroNameTakenValidator());
      control.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    }

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
        this.lastEditHeroId = null;
        this.editForm.reset({ name: '', rank: '' }, { emitEvent: false });
        this.editForm.markAsPristine();
        this.editForm.markAsUntouched();
        this.editFormValue.set({ name: '', rank: '' });
        this.saveError.set(null);
        return;
      }

      const desiredValue = {
        name: selected.name,
        rank: (selected.rank as HeroRank) ?? '',
      };
      const isNewSelection = this.lastEditHeroId !== selected.id;
      const currentValue = this.editForm.getRawValue();

      if (!isNewSelection && this.editForm.dirty) {
        return;
      }

      const alreadySynced =
        currentValue.name === desiredValue.name && currentValue.rank === desiredValue.rank;
      if (!isNewSelection && alreadySynced) {
        return;
      }

      this.lastEditHeroId = selected.id;
      const formValue = {
        name: desiredValue.name,
        rank: desiredValue.rank,
      };
      this.editForm.reset(formValue, { emitEvent: false });
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

  private heroNameTakenValidator(): AsyncValidatorFn {
    return (control) => {
      const raw = (control.value ?? '').trim();
      if (!raw) {
        return of(null);
      }

      const value = raw.toLowerCase();
      const currentId = this.selectedId();
      const selected = this.selectedHero();
      if (
        selected &&
        selected.id === currentId &&
        selected.name.trim().toLowerCase() === value
      ) {
        return of(null);
      }
      const existsLocally = this.heroes().some(
        (hero) => hero.name.toLowerCase() === value && hero.id !== currentId
      );
      if (existsLocally) {
        return of({ duplicated: true });
      }

      return timer(300).pipe(
        switchMap(() => this.heroService.search$(raw)),
        map((heroes) => {
          const taken = heroes.some(
            (hero) => hero.name.toLowerCase() === value && hero.id !== currentId
          );
          return taken ? { duplicated: true } : null;
        }),
        catchError(() => of(null))
      );
    };
  }
}
