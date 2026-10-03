# Budget & Patrimoine

Application web de suivi de budget et de patrimoine personnel : dépenses et revenus, comptes, épargne, immobilier, PEA/CTO, simulations et objectifs. Elle vise la **lisibilité des données** plutôt que la multiplication des fonctionnalités : pas de scores arbitraires, chaque écran sert à comprendre, suivre ou simuler une situation financière.

Tout le code est en HTML, CSS et JavaScript, sans étape de build ni framework. Les données de chaque utilisateur sont stockées dans Supabase.

## Fonctionnalités

| Page | Contenu |
|---|---|
| **Synthèse** | Patrimoine net, dettes, évolution dans le temps, « Où va mon argent ? » (mois, trimestre, année) |
| **Budget** | Revenus et dépenses par catégorie, récapitulatifs par période, évolution des dépenses par catégorie sur 12 mois, import CSV |
| **Liquidités** | Comptes bancaires et soldes à ce jour |
| **Patrimoine** | Actifs (livrets, assurance-vie, PEL, crypto…), passifs, allocation, variation mensuelle |
| **Immobilier** | Biens, crédits, loyers, locataires, charges |
| **Investissements** | PEA / PEA-PME / CTO : positions et achats, PRU, frais, fiscalité estimée, cours en ligne |
| **Simulations** | Projections et scénarios, sans jamais modifier vos données réelles |
| **Objectifs** | Suivi d'objectifs financiers |
| **Paramètres** | Opérations récurrentes, clé API de cours, export / import JSON, données de démonstration |

Points notables :

- **Opérations récurrentes** : plusieurs salaires, virements ou dépenses fixes, chacun ajouté au Budget le jour choisi du mois, jamais en avance.
- **Versements programmés** : un actif avec un versement mensuel (ex. PEL +50 €) voit sa valeur augmenter chaque mois au jour choisi, avec débit optionnel d'un compte.
- **PEA / CTO à deux niveaux** : une ligne par titre (quantité, PRU moyen, rendement), qui se déplie pour détailler les achats à prix et dates différents.
- **Import CSV** de relevés bancaires : aperçu obligatoire, détection des doublons, règles de catégorisation, annulation du dernier import. Le fichier est lu localement dans le navigateur.
- Menu latéral rétractable, thème clair et sombre.

## Prérequis

- Un navigateur récent.
- Un projet [Supabase](https://supabase.com) (l'offre gratuite suffit) pour la connexion et la sauvegarde.
- Optionnel : une clé gratuite [Alpha Vantage](https://www.alphavantage.co) pour récupérer les cours automatiquement. Sans clé, les cours se saisissent à la main.

## Installation

### 1. Créer la base Supabase

Dans l'éditeur SQL de votre projet, exécutez :

```sql
create table if not exists public.budget_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.budget_data enable row level security;

create policy "Lecture de ses propres données"
  on public.budget_data for select
  using (auth.uid() = user_id);

create policy "Création de ses propres données"
  on public.budget_data for insert
  with check (auth.uid() = user_id);

create policy "Modification de ses propres données"
  on public.budget_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Chaque utilisateur n'a ainsi accès qu'à sa propre ligne. Si vous aviez déjà créé la table, vérifiez que ces règles (RLS) sont bien actives.

### 2. Configurer l'application

Ouvrez `js/config.js` et renseignez l'URL du projet et la clé **anon public** (Supabase : *Project Settings → API*).

La clé *anon* est publique par conception : c'est la sécurité par ligne (RLS) qui protège les données, pas le secret de la clé. N'y mettez **jamais** la clé `service_role`.

### 3. Lancer l'application

Servez le dossier avec n'importe quel serveur de fichiers statiques :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Créez un compte depuis l'écran de connexion. Si Supabase demande une confirmation par e-mail, validez-la avant de vous connecter.

### Déploiement

Le projet est un site statique : GitHub Pages, Netlify, Vercel ou Cloudflare Pages conviennent. Publiez la racine du dépôt, sans commande de build.

## Structure

```
index.html            Page unique : structure, modales
css/style.css         Styles, thèmes clair et sombre
js/
  config.js           Connexion Supabase (seul fichier à adapter)
  state.js            Structure des données et état par défaut
  utils.js            Formats, dates, échappement HTML
  auth.js             Connexion et synchronisation cloud
  render.js           Affichage global et synchronisation des échéances
  budget.js           Budget et évolution des dépenses
  salaire.js          Opérations récurrentes
  comptes.js          Comptes et soldes
  actifs.js           Actifs et versements programmés
  passifs.js          Passifs
  patrimoine*.js      Patrimoine net, allocation, détail
  immobilier.js       Biens, crédits, loyers
  pea.js              PEA / CTO : positions et achats
  market-data.js      Cours en ligne (Alpha Vantage)
  simulations.js      Simulations
  objectifs.js        Objectifs
  import-csv.js       Import CSV de relevés
  import-export.js    Export et import JSON
  demo-data.js        Données de démonstration
  nav.js, theme.js    Navigation latérale, thème
  main.js             Initialisation
```

Les scripts sont chargés dans l'ordre de `index.html` et partagent un état global (`state`). L'état entier est enregistré dans une seule ligne JSON par utilisateur (`budget_data.data`).

## Données et confidentialité

- Les données sont enregistrées dans votre projet Supabase, sous votre compte.
- **Export / import JSON** (Paramètres) : pensez à sauvegarder régulièrement.
- Si le chargement cloud échoue, la synchronisation est suspendue pour ne pas écraser vos données par un état vide.
- L'import CSV est traité **dans le navigateur** : le fichier n'est envoyé à aucun service. Les libellés importés sont nettoyés et échappés à l'affichage.
- Les appels de cours ne transmettent que le symbole du titre et votre clé Alpha Vantage.

## Limites connues

- Les **ventes** de titres (PEA/CTO) ne sont pas gérées, seulement les achats.
- Le capital restant dû d'un crédit immobilier n'est pas décrémenté automatiquement et ne crée pas de passif correspondant.
- Les intérêts des livrets ne sont pas capitalisés automatiquement : seul le versement mensuel l'est.
- Les calculs fiscaux sont des **estimations indicatives**, pas un conseil fiscal ou financier.
- L'application est conçue pour un usage personnel, un utilisateur par compte.
