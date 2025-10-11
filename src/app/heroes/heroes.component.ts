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
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
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
  skills: FormArray<FormControl<string>>;
}>;

type SearchState =
  | { status: 'idle'; term: ''; heroes: Hero[]; message: string | null; error: null }
  | { status: 'loading'; term: string; heroes: Hero[]; message: string; error: null }
  | { status: 'success'; term: string; heroes: Hero[]; message: string; error: null }
  | { status: 'error'; term: string; heroes: Hero[]; message: string; error: string };

type FilterQueryState = { rank: string | null; search: string | null };

const HERO_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9\s'-]{2,23}$/;
const HERO_SKILL_PATTERN = /^[A-Za-z][A-Za-z0-9\s'-]{1,23}$/;
const RESERVED_HERO_NAMES = ['admin', 'root', 'unknown'] as const;
const VALID_RANK_QUERY_VALUES = new Set(['ALL', 'S', 'A', 'B', 'C']);

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

function skillsArrayValidator(): ValidatorFn {
  return (abstractControl) => {
    if (!(abstractControl instanceof FormArray)) {
      return null;
    }

    const values = abstractControl.controls
      .map((control) => (control.value ?? '').trim())
      .filter((skill) => skill.length > 0);

    if (!values.length) {
      return { skillRequired: true };
    }

    const seen = new Set<string>();
    for (const skill of values) {
      const normalized = skill.toLowerCase();
      if (seen.has(normalized)) {
        return { skillDuplicate: true };
      }
      seen.add(normalized);
    }

    return null;
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
  protected readonly showEmpty = computed(() => {
    const baseList = this.filteredHeroes();
    const search = this.searchState();
    if (search.status === 'success' && search.term) {
      return baseList.length === 0 && search.heroes.length === 0;
    }
    return baseList.length === 0;
  });

  protected readonly filteredSearchResults = computed(() => {
    const rank = this.activeRank();
    const results = this.searchState().heroes;
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
    skills: this.buildSkillsForm(),
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
    skills: this.buildSkillsForm(),
  });
  protected readonly createSkills = this.createForm.controls.skills;
  protected readonly editSkills = this.editForm.controls.skills;
  protected readonly editFormValue = signal<{ name: string; rank: HeroRank; skills: string[] }>({
    name: '',
    rank: '',
    skills: [],
  });

  protected addSkill(target: FormArray<FormControl<string>>) {
    target.push(this.createSkillControl());
    target.markAsDirty();
    target.markAsTouched();
    target.updateValueAndValidity();
  }

  protected removeSkill(target: FormArray<FormControl<string>>, index: number) {
    if (target.length <= 1) {
      target.at(0)?.setValue('', { emitEvent: true });
      target.at(0)?.markAsDirty();
      target.at(0)?.markAsTouched();
      target.markAsTouched();
      target.updateValueAndValidity();
      return;
    }
    target.removeAt(index);
    target.markAsDirty();
    target.markAsTouched();
    target.updateValueAndValidity();
  }

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
    const selectedSkills = this.normalizeSkills(selected.skills ?? []);
    const valueSkills = this.normalizeSkills(value.skills);
    const skillsChanged =
      selectedSkills.length !== valueSkills.length ||
      selectedSkills.some((skill, index) => skill !== valueSkills[index]);
    const isDirty = (
      value.name.trim() !== selected.name ||
      value.rank !== ((selected.rank as HeroRank) ?? '') ||
      skillsChanged
    );

    return isDirty;
  });
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly deletingId = signal<number | null>(null);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly feedback = signal<string | null>(null);

  private readonly searchTerms = new Subject<string>();
  private readonly searchTerm = signal<string>('');
  private readonly lastSuccessfulSearch = signal<{ term: string; heroes: Hero[] } | null>(null);

  protected readonly searchResource = rxResource<Hero[], string>({
    params: () => this.searchTerm(),
    stream: ({ params }) => {
      if (!params) {
        return of<Hero[]>([]);
      }
      return this.heroService.search$(params);
    },
    defaultValue: [],
  });

  protected readonly searchState = computed<SearchState>(() => {
    const term = this.searchTerm();
    if (!term) {
      return {
        status: 'idle',
        term: '',
        heroes: [],
        message: null,
        error: null,
      };
    }

    if (this.searchResource.isLoading()) {
      const cached = this.lastSuccessfulSearch();
      return {
        status: 'loading',
        term,
        heroes: cached && cached.term === term ? cached.heroes : [],
        message: '搜尋中...',
        error: null,
      };
    }

    const resourceError = this.searchResource.error();
    if (resourceError) {
      const cached = this.lastSuccessfulSearch();
      return {
        status: 'error',
        term,
        heroes: cached && cached.term === term ? cached.heroes : [],
        message: '查詢失敗，可稍後重試。',
        error:
          resourceError instanceof Error
            ? resourceError.message
            : String(resourceError ?? 'Unknown error'),
      };
    }

    const heroes = this.searchResource.value();
    return {
      status: 'success',
      term,
      heroes,
      message: heroes.length
        ? `命中 ${heroes.length} 位英雄`
        : '沒有符合條件的英雄，試著換個關鍵字。',
      error: null,
    };
  });

  protected readonly searchMessage = computed(() => this.searchState().message);
  protected readonly searchError = computed(() => this.searchState().error);
  protected readonly searching = computed(() => this.searchState().status === 'loading');
  protected readonly searchKeyword = computed(() => this.searchState().term);

  private lastEditHeroId: number | null = null;
  private lastSyncedQuery: FilterQueryState = { rank: null, search: null };
  private syncingFromQuery = false;

  private readonly validationMessages: Record<string, string> = {
    required: '此欄位必填，不能空白。',
    minlength: '請至少輸入 3 個字。',
    maxlength: '長度不可超過 24 個字。',
    pattern: '僅允許英文、數字、空白與 -′ 字元。',
    reserved: '這個名稱被列為保留字，請換一個。',
    duplicated: '已有英雄使用這個名稱。',
    skillRequired: '至少輸入一項技能。',
    skillDuplicate: '技能不可重複。',
  };

  protected controlError(control: AbstractControl | null): string | null {
    if (!control || control.disabled || !control.invalid) {
      return null;
    }
    if (control instanceof FormArray) {
      const touched = control.touched || control.controls.some((child) => child.touched);
      if (!touched) {
        return null;
      }
    } else if (!control.touched) {
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

    this.searchTerms
      .pipe(
        map((term) => term.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.feedback.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((term) => {
        if (term && term.length < 2) {
          this.searchTerm.set('');
          return;
        }
        this.searchTerm.set(term);
      });

    effect(() => {
      const term = this.searchTerm();
      if (!term) {
        return;
      }
      if (this.searchResource.isLoading() || this.searchResource.error()) {
        return;
      }
      const heroes = this.searchResource.value();
      this.lastSuccessfulSearch.set({ term, heroes: [...heroes] });
    });

    const initialParams = this.route.snapshot.queryParamMap;
    this.applyQueryParams(initialParams);

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyQueryParams(params));

    effect(() => {
      if (this.syncingFromQuery) {
        return;
      }
      const nextState = this.currentQueryState();
      if (this.queryStatesEqual(this.lastSyncedQuery, nextState)) {
        return;
      }
      this.lastSyncedQuery = nextState;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          rank: nextState.rank,
          search: nextState.search,
        },
        replaceUrl: true,
      });
    });

    // 監聽編輯表單值變化
    this.editForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.editFormValue.set({
          name: value.name || '',
          rank: value.rank || '',
          skills: this.collectSkills(this.editSkills),
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
        this.syncSkillsArray(this.editSkills, [], { emitEvent: false });
        this.editForm.markAsPristine();
        this.editForm.markAsUntouched();
        this.editFormValue.set({ name: '', rank: '', skills: [] });
        this.saveError.set(null);
        return;
      }

      const desiredValue = {
        name: selected.name,
        rank: (selected.rank as HeroRank) ?? '',
        skills: this.normalizeSkills(selected.skills ?? []),
      };
      const isNewSelection = this.lastEditHeroId !== selected.id;
      const currentValue = this.editForm.getRawValue();
      const currentSkills = this.normalizeSkills(currentValue.skills ?? []);

      if (!isNewSelection && this.editForm.dirty) {
        return;
      }

      const alreadySynced =
        currentValue.name === desiredValue.name &&
        currentValue.rank === desiredValue.rank &&
        currentSkills.length === desiredValue.skills.length &&
        currentSkills.every((skill, index) => skill === desiredValue.skills[index]);
      if (!isNewSelection && alreadySynced) {
        return;
      }

      this.lastEditHeroId = selected.id;
      const formValue = {
        name: desiredValue.name,
        rank: desiredValue.rank,
      };
      this.editForm.reset(formValue, { emitEvent: false });
      this.syncSkillsArray(this.editSkills, desiredValue.skills, { emitEvent: false });
      this.editForm.markAsPristine();
      this.editForm.markAsUntouched();
      this.editFormValue.set({
        ...formValue,
        skills: desiredValue.skills,
      });
      this.saveError.set(null);
    });

  }

  protected setRankFilter(option: string) {
    this.activeRank.set(option);
  }

  protected rankLabel(option: string) {
    return option === 'ALL' ? '全部' : option;
  }

  protected search(term: string) {
    const normalized = (term ?? '').trim();
    if (normalized && normalized.length >= 2 && normalized === this.searchTerm()) {
      this.searchResource.reload();
    }
    this.searchTerms.next(term);
  }

  protected reloadSearch() {
    if (!this.searchTerm()) {
      return;
    }
    this.searchResource.reload();
  }

  private applyQueryParams(params: ParamMap) {
    this.syncingFromQuery = true;
    try {
      const rankValue = this.normalizeRankFromQuery(params.get('rank'));
      const searchValue = this.normalizeSearchFromQuery(params.get('search'));

      if (this.activeRank() !== rankValue) {
        this.activeRank.set(rankValue);
      }
      if (this.searchTerm() !== searchValue) {
        this.searchTerm.set(searchValue);
      }

      this.lastSyncedQuery = {
        rank: this.formatRankForQuery(rankValue),
        search: this.formatSearchForQuery(searchValue),
      };
    } finally {
      this.syncingFromQuery = false;
    }
  }

  private currentQueryState(): FilterQueryState {
    return {
      rank: this.formatRankForQuery(this.activeRank()),
      search: this.formatSearchForQuery(this.searchTerm()),
    };
  }

  private normalizeRankFromQuery(raw: string | null): string {
    const normalized = (raw ?? '').trim().toUpperCase();
    if (!normalized) {
      return 'ALL';
    }
    return VALID_RANK_QUERY_VALUES.has(normalized) ? normalized : 'ALL';
  }

  private normalizeSearchFromQuery(raw: string | null): string {
    const normalized = (raw ?? '').trim();
    return normalized.length >= 2 ? normalized : '';
  }

  private formatRankForQuery(rank: string): string | null {
    return rank === 'ALL' ? null : rank;
  }

  private formatSearchForQuery(term: string): string | null {
    return term.length >= 2 ? term : null;
  }

  private queryStatesEqual(a: FilterQueryState, b: FilterQueryState): boolean {
    return a.rank === b.rank && a.search === b.search;
  }

  private buildSkillsForm(initialSkills: readonly string[] = ['']): FormArray<FormControl<string>> {
    const source = initialSkills.length ? initialSkills : [''];
    const controls = source.map((skill) => this.createSkillControl(skill));
    return this.fb.nonNullable.array(controls, {
      validators: [skillsArrayValidator()],
    });
  }

  private createSkillControl(initial = ''): FormControl<string> {
    return this.fb.nonNullable.control(initial, {
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(24),
        Validators.pattern(HERO_SKILL_PATTERN),
      ],
    });
  }

  private syncSkillsArray(
    target: FormArray<FormControl<string>>,
    skills: readonly string[],
    options?: { emitEvent?: boolean }
  ) {
    const emitEvent = options?.emitEvent ?? false;
    const list = (skills.length ? skills : ['']).map((skill) => (skill ?? '').trim());
    target.clear({ emitEvent });
    for (const skill of list) {
      const control = this.createSkillControl(skill);
      target.push(control, { emitEvent });
      control.markAsPristine();
      control.markAsUntouched();
    }
    if (target.length === 0) {
      const control = this.createSkillControl('');
      target.push(control, { emitEvent });
      control.markAsPristine();
      control.markAsUntouched();
    }
    target.markAsPristine();
    target.markAsUntouched();
    target.updateValueAndValidity({ emitEvent });
  }

  private collectSkills(target: FormArray<FormControl<string>>): string[] {
    return target.controls
      .map((control) => (control.value ?? '').trim())
      .filter((skill) => skill.length > 0);
  }

  private normalizeSkills(skills: readonly string[]): string[] {
    return skills
      .map((skill) => (skill ?? '').trim())
      .filter((skill) => skill.length > 0);
  }

  protected addHero() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { name, rank } = this.createForm.getRawValue();
    const skills = this.collectSkills(this.createSkills);
    const payload: Pick<Hero, 'name' | 'rank' | 'skills'> = {
      name: name.trim(),
      rank: rank || undefined,
      skills,
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
          this.createForm.reset({ name: '', rank: '' }, { emitEvent: false });
          this.syncSkillsArray(this.createSkills, [], { emitEvent: false });
          this.createForm.markAsPristine();
          this.createForm.markAsUntouched();
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
    const skills = this.collectSkills(this.editSkills);

    this.saving.set(true);
    this.saveError.set(null);
    this.feedback.set(null);

    this.heroService
      .update(hero.id, { name: name.trim(), rank: rank || undefined, skills })
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
