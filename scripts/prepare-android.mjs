/**
 * Prepara el proyecto Android de Capacitor (se genera, no se versiona):
 *   1. `npx cap add android` si no existe la carpeta android/.
 *   2. Orientación vertical, versión (versionName = package.json,
 *      versionCode = número de build de CI o derivado de la versión).
 *   3. Copia los iconos de resources/android.
 *   4. `npx cap sync android`.
 * Uso: npm run android:prepare   (requiere haber hecho `npm run build`)
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

if (!existsSync('android')) run('npx cap add android');

// --- Orientación vertical -------------------------------------------------
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:screenOrientation')) {
  manifest = manifest.replace(/<activity\b/, '<activity\n            android:screenOrientation="portrait"');
}
writeFileSync(manifestPath, manifest);

// --- Versión ----------------------------------------------------------------
// versionCode debe crecer en cada APK para poder actualizar encima.
const [maj, min, pat] = pkg.version.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
const fromVersion = maj * 1_000_000 + min * 10_000 + pat * 100;
const buildNumber = parseInt(process.env.GITHUB_RUN_NUMBER ?? '0', 10);
const versionCode = Math.max(1, fromVersion * 100 + (buildNumber % 10_000)) % 2_100_000_000;
const gradlePath = 'android/app/build.gradle';
let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
writeFileSync(gradlePath, gradle);
console.log(`Android: versionName ${pkg.version}, versionCode ${versionCode}`);

// --- Iconos -----------------------------------------------------------------
const resDir = 'android/app/src/main/res';
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const src = `resources/android/ic_launcher-${d}.png`;
  const dir = `${resDir}/mipmap-${d}`;
  if (!existsSync(src) || !existsSync(dir)) continue;
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) copyFileSync(src, `${dir}/${name}`);
}
// Quitamos el icono adaptativo por defecto (logo de Capacitor) para que use nuestros PNG.
const anyDpi = `${resDir}/mipmap-anydpi-v26`;
if (existsSync(anyDpi)) for (const f of readdirSync(anyDpi)) rmSync(`${anyDpi}/${f}`);

run('npx cap sync android');
