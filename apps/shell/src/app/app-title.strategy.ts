import { inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly titleService = inject(Title);

  /** Reactive title for use in templates */
  readonly currentTitle = signal('');

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const route = this.buildTitle(snapshot);
    const title = route ?? this.getDeepestTitle(snapshot);
    if (title) {
      this.titleService.setTitle(title);
      this.currentTitle.set(title);
    }
  }

  private getDeepestTitle(snapshot: RouterStateSnapshot): string | undefined {
    let route = snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.data?.['title'];
  }
}
