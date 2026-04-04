import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { AppTitleStrategy } from './app-title.strategy';
import { appRoutes } from './app.routes';
import { generatedProviders } from './app.composition.generated';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    ...generatedProviders,
  ],
};
