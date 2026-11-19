# Dépendances embarquées

Ces fichiers sont servis depuis le dépôt (plus aucun script chargé depuis un CDN) : une compromission d'un CDN
ne peut plus injecter de code dans une application qui manipule des données financières et un jeton de session.

| Fichier | Paquet npm | Version | SHA-256 |
|---|---|---|---|
| `chart-4.4.1.umd.js` | `chart.js` | 4.4.1 | `74401d738dd3e03ee5dfb3b6841210fe2c4ead8a960c4011ca4ba0b78a9fd8f3` |
| `supabase-js-2.119.2.umd.js` | `@supabase/supabase-js` | 2.119.2 | `8816af04d9915dbba1882d6f84f0b402dc40268063a63d9c66d24f52f371c263` |

Licences : `LICENSE-chartjs.md`, `LICENSE-supabase-js` (MIT).

## Mettre à jour une dépendance

```bash
mkdir /tmp/vendor-update && cd /tmp/vendor-update && npm init -y
npm install --ignore-scripts chart.js@X.Y.Z @supabase/supabase-js@X.Y.Z
cp node_modules/chart.js/dist/chart.umd.js          <repo>/vendor/chart-X.Y.Z.umd.js
cp node_modules/@supabase/supabase-js/dist/umd/supabase.js <repo>/vendor/supabase-js-X.Y.Z.umd.js
sha256sum <repo>/vendor/*.js     # reporter les empreintes ci-dessus
```

Puis mettre à jour les balises `<script src="vendor/…">` d'`index.html` et supprimer l'ancien fichier.
