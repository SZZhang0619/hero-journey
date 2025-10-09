import { Component } from '@angular/core';
import { TopHeroesChart } from '../top-heroes-chart/top-heroes-chart';
import { LoadingSpinner } from '../ui/loading-spinner/loading-spinner';
import { MessageBanner } from '../ui/message-banner/message-banner';

@Component({
  selector: 'app-dashboard',
  imports: [TopHeroesChart, LoadingSpinner, MessageBanner],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {}
