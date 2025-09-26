import { Route } from "@angular/router";
import { DashboardComponent } from "./dashboard/dashboard.component";
import { HeroesComponent } from "./heroes/heroes.component";
import { HeroDetail } from "./hero-detail/hero-detail";

export const routes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent, title: 'Dashboard' },
  { path: 'heroes', component: HeroesComponent, title: 'Heroes' },
  { path: 'detail/:id', component: HeroDetail, title: 'Hero Detail' },
];
