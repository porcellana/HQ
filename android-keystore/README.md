# Keystore de depuración

`debug.keystore` es una clave **de depuración** (contraseña `android`, alias
`androiddebugkey`). No es secreta: sólo sirve para que todos los APK que
compila GitHub Actions estén firmados con la misma clave y puedas instalar
cada versión nueva encima de la anterior sin perder tu partida.

Para publicar en Google Play necesitarás una clave de *release* propia que
NUNCA debe subirse al repositorio.
