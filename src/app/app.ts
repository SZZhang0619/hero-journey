import { Component, signal } from '@angular/core';
import { HeroBadge } from './hero-badge/hero-badge';

type Hero = { id: number; name: string; rank?: string };

@Component({
  selector: 'app-root',
  imports: [HeroBadge],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('hero-journey');

  // protected readonly hero = signal<Hero | null>({ id: 1, name: 'Narco', rank: 'A' });
  protected readonly hero = signal<Hero | null>(null);
}
