import * as fs from 'fs';
import {
  Project,
  VariableDeclarationKind,
  WriterFunction,
  Writers,
} from 'ts-morph';
import type {
  CollectedExtPoint,
  ComponentExtPoint,
  LazyComponentExtPoint,
  LifecycleHookExtPoint,
  ValueExtPoint,
  InitializerExtPoint,
  ResolvedPrimaryFeature,
} from './schemas';

/** Writes a bracketed array of object writers, one item per line. */
function writeObjectArray(items: WriterFunction[]): WriterFunction {
  return (writer) => {
    writer.write('[');
    writer.newLine();
    items.forEach((itemWriter, i) => {
      writer.write('  ');
      itemWriter(writer);
      if (i < items.length - 1) writer.write(',');
      writer.newLine();
    });
    writer.write(']');
  };
}

/** Writes a Route object with loadChildren and data. */
function routeWriter(
  path: string,
  loadFn: string,
  data: { title: string; icon: string },
): WriterFunction {
  return Writers.object({
    path: JSON.stringify(path),
    loadChildren: loadFn,
    data: Writers.object({
      title: JSON.stringify(data.title),
      icon: JSON.stringify(data.icon),
    }),
  });
}

export function emitComposition(
  resolvedPrimaryFeatures: ResolvedPrimaryFeature[],
  collectedExtPoints: CollectedExtPoint[],
  outputPath: string,
  defaultRoute?: string,
): void {
  const project = new Project({ useInMemoryFileSystem: true });
  const src = project.createSourceFile('composition.ts', '', {
    overwrite: true,
  });

  // Framework imports
  src.addImportDeclaration({
    moduleSpecifier: '@angular/router',
    namedImports: ['Routes'],
  });
  const hasInitializers = collectedExtPoints.some(
    (ext) => ext.kind === 'initializer' && ext.contributions.length > 0,
  );
  src.addImportDeclaration({
    moduleSpecifier: '@angular/core',
    namedImports: [
      { name: 'Provider', isTypeOnly: true },
      ...(hasInitializers
        ? [
            { name: 'EnvironmentProviders', isTypeOnly: true },
            { name: 'provideAppInitializer' },
          ]
        : []),
    ],
  });

  // Extension point imports — emitted in declaration order; no string.replace needed
  for (const ext of collectedExtPoints) {
    if (ext.kind === 'component') {
      src.addImportDeclaration({
        moduleSpecifier: ext.consumerImportPath,
        namedImports: [{ name: ext.descriptor.itemTypeName, isTypeOnly: true }],
      });
      src.addImportDeclaration({
        moduleSpecifier: ext.consumerImportPath,
        namedImports: [ext.descriptor.tokenExportName],
      });
      for (const { item, importPath } of ext.contributions) {
        src.addImportDeclaration({
          moduleSpecifier: importPath,
          namedImports: [item.exportName],
        });
      }
    } else if (ext.kind === 'lazy-component') {
      // Only import the token — no static component imports (dynamic import() handles them)
      src.addImportDeclaration({
        moduleSpecifier: ext.consumerImportPath,
        namedImports: [ext.descriptor.tokenExportName],
      });
    } else if (ext.kind === 'lifecycle-hook') {
      // Import the token from the consumer (e.g. @nacs/shell-lifecycle)
      src.addImportDeclaration({
        moduleSpecifier: ext.consumerImportPath,
        namedImports: [ext.descriptor.tokenExportName],
      });
      // Import each contributed handler function
      for (const { item, importPath } of ext.contributions) {
        src.addImportDeclaration({
          moduleSpecifier: importPath,
          namedImports: [item.exportName],
        });
      }
    } else if (ext.kind === 'value') {
      // Only import the token from the consumer — no feature imports (data is inlined)
      src.addImportDeclaration({
        moduleSpecifier: ext.consumerImportPath,
        namedImports: [ext.descriptor.tokenExportName],
      });
    } else if (ext.kind === 'initializer') {
      // Import each contributed factory function statically
      for (const { item, importPath } of ext.contributions) {
        src.addImportDeclaration({
          moduleSpecifier: importPath,
          namedImports: [item.exportName],
        });
      }
    }
  }

  // generatedRoutes
  const primaryRouteWriters = resolvedPrimaryFeatures.map(
    ({ importPath, primary }) =>
      routeWriter(
        primary.path,
        `() => import('${importPath}').then(m => m.${primary.exportName})`,
        { title: primary.title, icon: primary.icon },
      ),
  );
  const redirectTarget =
    defaultRoute ?? resolvedPrimaryFeatures[0].primary.path;
  const wildcardWriter = Writers.object({
    path: '"**"',
    redirectTo: JSON.stringify(redirectTarget),
    pathMatch: '"full"',
  });
  src.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'generatedRoutes',
        type: 'Routes',
        initializer: writeObjectArray([...primaryRouteWriters, wildcardWriter]),
      },
    ],
  });

  // Extension point variables
  for (const ext of collectedExtPoints) {
    if (ext.kind === 'route') {
      if (ext.contributions.length > 0) {
        console.log(
          `\n⚙️  Generating extension point "${ext.name}" contributions:`,
        );
        const entryWriters = ext.contributions.map(({ item, importPath }) => {
          console.log(`   → ${item.title} (${importPath})`);
          return routeWriter(
            item.path!,
            `() => import('${importPath}').then(m => m.${item.exportName})`,
            { title: item.title ?? '', icon: item.icon },
          );
        });
        src.addVariableStatement({
          isExported: true,
          declarationKind: VariableDeclarationKind.Const,
          declarations: [
            {
              name: ext.varName,
              type: 'Routes',
              initializer: writeObjectArray(entryWriters),
            },
          ],
        });
      } else {
        console.log(
          `\n⚙️  No contributions for extension point "${ext.name}" — generating empty array.`,
        );
        src.addVariableStatement({
          isExported: true,
          declarationKind: VariableDeclarationKind.Const,
          declarations: [
            { name: ext.varName, type: 'Routes', initializer: '[]' },
          ],
        });
      }
    } else if (ext.kind === 'component') {
      if (ext.contributions.length > 0) {
        console.log(
          `\n⚙️  Generating extension point "${ext.name}" contributions:`,
        );
        const entryWriters = ext.contributions.map(({ item }) => {
          console.log(`   → ${item.title}`);
          const props: Record<string, string | WriterFunction> = {
            component: item.exportName,
            title: JSON.stringify(item.title),
            icon: JSON.stringify(item.icon),
          };
          if (item.routePath)
            props['routePath'] = JSON.stringify(item.routePath);
          return Writers.object(props);
        });
        src.addVariableStatement({
          isExported: true,
          declarationKind: VariableDeclarationKind.Const,
          declarations: [
            {
              name: ext.varName,
              type: `${ext.descriptor.itemTypeName}[]`,
              initializer: writeObjectArray(entryWriters),
            },
          ],
        });
      } else {
        console.log(
          `\n⚙️  No contributions for extension point "${ext.name}" — generating empty array.`,
        );
        src.addVariableStatement({
          isExported: true,
          declarationKind: VariableDeclarationKind.Const,
          declarations: [
            {
              name: ext.varName,
              type: `${ext.descriptor.itemTypeName}[]`,
              initializer: '[]',
            },
          ],
        });
      }
    } else if (ext.kind === 'lazy-component') {
      if (ext.contributions.length > 0) {
        console.log(
          `\n⚙️  Generating lazy extension point "${ext.name}" contributions:`,
        );
        const objectWriters = ext.contributions.map(({ item, importPath }) => {
          console.log(`   → ${item.exportName} (${importPath}) [lazy]`);
          const props: Record<string, string> = {
            loadComponent: `() => import('${importPath}').then(m => m.${item.exportName})`,
          };
          if (item.routePath) {
            props['routePath'] = JSON.stringify(item.routePath);
          }
          return Writers.object(props);
        });
        src.addVariableStatement({
          isExported: true,
          declarationKind: VariableDeclarationKind.Const,
          declarations: [
            {
              name: ext.varName,
              initializer: (writer) => {
                writer.write('[');
                writer.newLine();
                objectWriters.forEach((objWriter, i) => {
                  writer.write('  ');
                  objWriter(writer);
                  if (i < objectWriters.length - 1) writer.write(',');
                  writer.newLine();
                });
                writer.write(']');
              },
            },
          ],
        });
      } else {
        console.log(
          `\n⚙️  No contributions for lazy extension point "${ext.name}" — generating empty array.`,
        );
        src.addVariableStatement({
          isExported: true,
          declarationKind: VariableDeclarationKind.Const,
          declarations: [{ name: ext.varName, initializer: '[]' }],
        });
      }
    } else if (ext.kind === 'value') {
      if (ext.contributions.length > 0) {
        console.log(
          `\n⚙️  Generating value extension point "${ext.name}" contributions:`,
        );
        const entryWriters: WriterFunction[] = ext.contributions.map(
          ({ item }) => {
            console.log(`   → value item [inline data]`);
            return (writer) => writer.write(JSON.stringify(item, null, 2));
          },
        );
        src.addVariableStatement({
          isExported: true,
          declarationKind: VariableDeclarationKind.Const,
          declarations: [
            {
              name: ext.varName,
              initializer: writeObjectArray(entryWriters),
            },
          ],
        });
      } else {
        console.log(
          `\n⚙️  No contributions for value extension point "${ext.name}" — generating empty array.`,
        );
        src.addVariableStatement({
          isExported: true,
          declarationKind: VariableDeclarationKind.Const,
          declarations: [{ name: ext.varName, initializer: '[]' }],
        });
      }
    }
  }

  // generatedProviders — always emitted so app.config.ts can spread it unconditionally
  const providerWriters = collectedExtPoints
    .filter(
      (ext): ext is ComponentExtPoint | LazyComponentExtPoint | ValueExtPoint =>
        ext.kind === 'component' ||
        ext.kind === 'lazy-component' ||
        ext.kind === 'value',
    )
    .map((ext) =>
      Writers.object({
        provide: ext.descriptor.tokenExportName,
        useValue: ext.varName,
      }),
    );

  // Lifecycle-hook providers use multi: true so Angular aggregates handlers into an array.
  // Each handler is registered as a separate provider entry.
  const lifecycleProviderWriters = collectedExtPoints
    .filter(
      (ext): ext is LifecycleHookExtPoint => ext.kind === 'lifecycle-hook',
    )
    .flatMap((ext) =>
      ext.contributions.map(({ item }) => {
        console.log(
          `   → lifecycle-hook "${ext.name}": ${item.exportName} [multi]`,
        );
        return Writers.object({
          provide: ext.descriptor.tokenExportName,
          useValue: item.exportName,
          multi: 'true',
        });
      }),
    );

  // Initializer providers use provideAppInitializer(fn) — the function runs in an
  // injection context so contributors can call inject() inside for dependencies.
  // Each contributor becomes a separate provideAppInitializer() call.
  const initializerProviderWriters: WriterFunction[] = collectedExtPoints
    .filter((ext): ext is InitializerExtPoint => ext.kind === 'initializer')
    .flatMap((ext) =>
      ext.contributions.map(({ item }) => {
        console.log(
          `   → initializer "${ext.name}": ${item.exportName} [provideAppInitializer]`,
        );
        return (writer: import('ts-morph').CodeBlockWriter) =>
          writer.write(`provideAppInitializer(${item.exportName})`);
      }),
    );

  src.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'generatedProviders',
        type: hasInitializers
          ? '(Provider | EnvironmentProviders)[]'
          : 'Provider[]',
        initializer: writeObjectArray([
          ...initializerProviderWriters,
          ...providerWriters,
          ...lifecycleProviderWriters,
        ]),
      },
    ],
  });

  // Write to disk with banner comment
  const fileContent = `// AUTO-GENERATED FILE - DO NOT EDIT\n${src.getFullText()}`;
  fs.writeFileSync(outputPath, fileContent);
  console.log(`\n✅ Composition generated at ${outputPath}\n`);
}
