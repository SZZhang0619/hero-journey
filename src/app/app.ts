import { Component, signal } from '@angular/core';
import { HeroBadge } from './hero-badge/hero-badge';

@Component({
  selector: 'app-root',
  imports: [HeroBadge],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('hero-journey');
}
