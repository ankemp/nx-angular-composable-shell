import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppTitleStrategy } from './app-title.strategy';
import { SidebarComponent } from '@nacs/shell-nav';

@Component({
  imports: [RouterModule, SidebarComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly titleStrategy = inject(AppTitleStrategy);

  readonly title = this.titleStrategy.currentTitle;
  sidebarExpanded = signal(true);

  toggleSidebar(): void {
    this.sidebarExpanded.update((v) => !v);
  }
}
