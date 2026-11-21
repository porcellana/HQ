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
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';

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

// --- Pantalla de inicio oscura (en vez del logo de Capacitor) -------------
// Fondo #0b0a10 con el héroe centrado; en Android 12+ se usa el color de fondo.
for (const dir of readdirSync(resDir)) {
  if (dir.startsWith('drawable') && existsSync(`${resDir}/${dir}/splash.png`)) rmSync(`${resDir}/${dir}/splash.png`);
}
mkdirSync(`${resDir}/drawable-nodpi`, { recursive: true });
if (existsSync('resources/android/splash_icon.png')) copyFileSync('resources/android/splash_icon.png', `${resDir}/drawable-nodpi/splash_icon.png`);
writeFileSync(
  `${resDir}/drawable/splash.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><color android:color="#0b0a10" /></item>
    <item><bitmap android:gravity="center" android:src="@drawable/splash_icon" /></item>
</layer-list>
`,
);
const stylesPath = `${resDir}/values/styles.xml`;
let styles = readFileSync(stylesPath, 'utf8');
if (!styles.includes('windowSplashScreenBackground')) {
  styles = styles.replace(
    '<item name="android:background">@drawable/splash</item>',
    '<item name="android:background">@drawable/splash</item>\n        <item name="windowSplashScreenBackground">#0b0a10</item>\n        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>',
  );
  writeFileSync(stylesPath, styles);
}

run('npx cap sync android');
