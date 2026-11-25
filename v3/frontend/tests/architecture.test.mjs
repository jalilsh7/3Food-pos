import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(projectRoot, 'src');
const featuresRoot = join(sourceRoot, 'features');

function collectSourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? collectSourceFiles(path)
      : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function importsOf(source) {
  return [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

const featureNames = readdirSync(featuresRoot).filter((name) => statSync(join(featuresRoot, name)).isDirectory()).sort();

for (const featureName of featureNames) {
  test(`feature ${featureName} does not import another feature`, () => {
    const featureRoot = join(featuresRoot, featureName);
    for (const file of collectSourceFiles(featureRoot)) {
      for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
        if (specifier.startsWith('@/features/')) {
          const importedFeature = specifier.slice('@/features/'.length).split('/')[0];
          assert.equal(importedFeature, featureName, `${file} imports feature ${importedFeature}`);
        }
        if (specifier.startsWith('.')) {
          const target = resolve(dirname(file), specifier);
          const pathFromFeatures = relative(featuresRoot, target);
          const isInsideFeatures = pathFromFeatures !== '..' && !pathFromFeatures.startsWith(`..${sep}`);
          if (isInsideFeatures) {
            const importedFeature = pathFromFeatures.split(sep)[0];
            assert.equal(importedFeature, featureName, `${file} imports feature ${importedFeature}`);
          }
        }
      }
    }
  });
}

test('shared layer does not import feature modules', () => {
  const sharedRoot = join(sourceRoot, 'shared');
  for (const file of collectSourceFiles(sharedRoot)) {
    for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
      assert.equal(specifier.startsWith('@/features/'), false, `${file} imports ${specifier}`);
      if (specifier.startsWith('.')) {
        const target = resolve(dirname(file), specifier);
        const pathFromFeatures = relative(featuresRoot, target);
        assert.equal(pathFromFeatures === '..' || pathFromFeatures.startsWith(`..${sep}`), true, `${file} imports a feature source`);
      }
    }
  }
});

test('app composition imports all feature entrypoints', () => {
  const appFile = join(sourceRoot, 'app', 'App.tsx');
  const appSource = readFileSync(appFile, 'utf8');
  for (const featureName of featureNames) {
    assert.ok(
      appSource.includes(`features/${featureName}/`) || appSource.includes(`features\\\\${featureName}\\\\`),
      `App.tsx does not compose ${featureName}`,
    );
  }
});
