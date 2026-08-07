# Migration & réorganisation du catalogue

> **Cahier des charges et mémoire de travail.**
> Ce fichier est la source de vérité du chantier « remise à plat du catalogue ».
> Toute décision prise, tout chiffre mesuré, tout écart constaté doit être consigné ici.
>
> Dernière mise à jour : 2026-08-07 — état : **étape 4 (service de migration) livrée, non exécutée**

---

## 1. Objectif

Supprimer les produits de la base projet (`DATABASE_URL` / sakura) et rejouer une migration
**propre et directe** depuis la base PrestaShop d'origine (`prod5`), en reconstruisant au
passage une taxonomie exploitable pour les produits et les pièces détachées.

Le chantier ne consiste **pas** à rattraper les données dégradées de la base cible actuelle,
mais à reprendre la source et à appliquer une réorganisation pendant l'import.

En une phrase : **`prod5` (PrestaShop) → `DATABASE_URL` (sakura), en direct, sans passer par
`metro`** — avec purge préalable des produits et ajout des tables de compatibilité.

---

## 2. Connexions

### 2.1 Source — PrestaShop (LECTURE SEULE ABSOLUE)

| Paramètre         | Valeur                                              |
| ----------------- | --------------------------------------------------- |
| SGBD              | MariaDB 10.3.39                                     |
| Base              | `prod5`                                             |
| Accès             | **tunnel SSH obligatoire** (MySQL non exposé)       |
| Hôte SSH          | `137.74.206.97:22`, utilisateur `mecaservicesshop4` |
| Utilisateur MySQL | `api-user@%`                                        |
| Identifiants      | `.env` (`DB_*`, `SSH_SERVER_*`)                     |

> ⚠️ **Règle non négociable : aucune écriture sur la source.**
> Uniquement `SELECT` / `SHOW` / `DESCRIBE` / `EXPLAIN`.
> Aucun `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `SET`, `LOCK`.
> Le service de migration doit refuser ces mots-clés au niveau du code, pas seulement
> par convention, et se connecter avec `multipleStatements: false`.

Ouverture du tunnel :

```bash
set -a; . ./.env; set +a
sshpass -p "$SSH_SERVER_PASSWORD" ssh -f -N -o ExitOnForwardFailure=yes \
  -L 13306:"$DB_HOST":"$DB_PORT" -p "$DB_SERVER_PORT" "$SSH_SERVER_USER"@"$DB_SERVER"
```

**Piège client MySQL :** le serveur utilise `mysql_native_password`, supprimé du client
MySQL 9.x local — le binaire `mysql` échoue avec `ERROR 2059`. Passer par le driver Node
`mysql2` (installé), qui le supporte encore.

**Piège bun :** le cache bun a une résolution cassée sur `iconv-lite` → `safer-buffer`
(`ENOENT while resolving package 'safer-buffer'`). Exécuter les scripts d'accès source avec
`node` (import de `mysql2` par chemin absolu dans `node_modules`), pas avec `bun`.

### 2.2 Cible — base du projet `msshopv2` (LA SEULE CIBLE)

| Paramètre | Valeur                                                          |
| --------- | --------------------------------------------------------------- |
| SGBD      | PostgreSQL                                                      |
| Hôte      | `sakura.proxy.rlwy.net:22586`, base `railway`                   |
| Connexion | `DATABASE_URL` dans `.env`                                      |
| Schéma    | Drizzle — `src/lib/server/db/catalog.schema.ts`                 |
| Tables    | 21 (nommage anglais : `product`, `category`, `brand`, `order`…) |

**C'est la base que lit l'application SvelteKit.** C'est donc :

- celle où l'on **supprime les produits** (purge, étape 5) ;
- celle où l'on **ajoute les nouvelles tables** (compatibilité machines, étape 3) ;
- celle qui **reçoit la migration** depuis PrestaShop (étape 6).

### 2.3 Sens de la migration

```
PrestaShop prod5 (MariaDB, via SSH)  ──────►  DATABASE_URL / sakura (PostgreSQL)
        LECTURE SEULE                          purge + nouvelles tables + import
```

**Migration directe, sans intermédiaire.**

### 2.4 Base `metro` — hors périmètre

Les scripts existants de `scripts/migration/` lisent une **autre** base PostgreSQL
(`metro.proxy.rlwy.net:57921`, URL en dur dans `_shared.ts`), qui est le socle d'une
application antérieure : 87 tables, nommage français (`products`, `categories`, `marques`,
`orders`), plus des tables absentes du projet (`client_machines`, `lm_categories`,
`product_attribute_definitions`).

Vérifié : `metro` et `DATABASE_URL` sont bien deux serveurs distincts
(`system_identifier` différents) au contenu aujourd'hui identique (1 302 567 produits,
5 940 catégories, 27 403 commandes) — `metro` étant l'étape amont de la chaîne historique :

```
prod5  ──►  metro (refonte v1, 87 tables)  ──►  msshopv2 (21 tables, Drizzle)
```

**Décision (2026-08-07) : `metro` ne fait pas partie du nouveau chantier.** On ne l'écrit pas,
on ne la lit plus. Le nouveau service attaque `prod5` et écrit dans `DATABASE_URL`. Les
scripts existants qui dépendent de `metro` sont donc à remplacer, pas à adapter.

---

## 3. Diagnostic

### 3.1 État de la base cible (avant remise à plat)

| Indicateur                                        | Valeur               |
| ------------------------------------------------- | -------------------- |
| Produits                                          | 1 302 567            |
| **Produits sans catégorie**                       | **1 054 107 (81 %)** |
| Produits dans le fourre-tout « Pièces détachées » | 180 096              |
| Catégories                                        | 5 940                |
| **Catégories vides**                              | **5 523 (93 %)**     |
| Lignes dans `product_category` (N-N)              | **1**                |
| Profondeur de l'arbre                             | jusqu'à 12 niveaux   |

### 3.2 État de la source PrestaShop

| Indicateur                            | Valeur                                         |
| ------------------------------------- | ---------------------------------------------- |
| Produits (`ps_product`)               | 1 053 957 (1 005 429 actifs / 48 528 inactifs) |
| **Produits avec catégorie**           | **1 053 944 — 99,999 %**                       |
| Liaisons `ps_category_product`        | 1 062 387 (moy. 1,01 cat./produit)             |
| Catégories (`ps_category`)            | 5 948, profondeur max 11                       |
| Marques (`ps_manufacturer`)           | 1 117 — 1 051 039 produits rattachés (99,7 %)  |
| Produits sans marque                  | 2 917                                          |
| Fournisseurs                          | 26                                             |
| Images (`ps_image`)                   | 568 712                                        |
| Déclinaisons (`ps_product_attribute`) | 1 318                                          |

### 3.3 Les deux constats qui orientent tout le chantier

**Constat n°1 — le million de produits orphelins est un bug de migration, pas un problème de données.**
À la source, 99,999 % des produits ont une catégorie. En cible, 81 % n'en ont aucune.
Cause : `04-products.ts` fait un double mapping fragile
(`products.categorie_id` → `categories.id` → `id_category` → `category.legacy_ps_id`) via la
base `metro` intermédiaire ; tout maillon manquant produit un `category_id = null` silencieux.
De plus, la table N-N `ps_category_product` (1 062 387 liaisons) **n'a jamais été migrée** :
seule la catégorie par défaut était reprise.
→ **Une migration correcte depuis `prod5` restaure à elle seule la catégorisation.**

**Constat n°2 — le fourre-tout existe déjà à la source, et il est irrécupérable en l'état.**

- `id_category = 139` « Pièces détachées » contient **841 613 produits (80 %)**
- **838 987 produits n'ont QUE cette catégorie** — aucune catégorie plus précise à récupérer

→ **Aucune migration, si propre soit-elle, ne résoudra ce point.** La reclassification par
règles est donc **obligatoire**, et c'est le vrai cœur du chantier.

### 3.4 Nature réelle des 5 948 catégories

Un seul arbre porte trois rôles incompatibles, d'où la profondeur et les doublons :

| Branche                                     | Catégories   | Produits | Rôle réel                                  |
| ------------------------------------------- | ------------ | -------- | ------------------------------------------ |
| Pièces détachées                            | 3 483 (59 %) | 180 672  | **Compatibilité** marque > modèle > année  |
| Vues éclatées                               | 1 513 (25 %) | **0**    | **Documentation** (planches de schémas)    |
| KRAMP                                       | 481          | 64 125   | **Catalogue fournisseur** importé tel quel |
| Électroportatif, Motoculture, Consommables… | 463          | 3 639    | **Vraie navigation boutique**              |

Les « doublons » (`Plateau de coupe` ×34, `Options` ×30, `2000` ×15, `Chargeur` ×11) ne sont
pas des erreurs de saisie : ce sont des nœuds répétés sous chaque modèle de machine, faute
d'axe de compatibilité dédié. Exemple de chemin réel à 12 niveaux :

```
Racine > Accueil > Vues éclatées > OUTILS WOLF > TONDEUSES > 46CM > THERMIQUES >
POUSSÉES > PVP > 1 - GUIDON | PVP > 2 - MANETTE DE COMMANDE | PVP > 1
```

---

## 4. Cible : séparer les 4 axes

Le catalogue a **quatre dimensions orthogonales**. Les forcer dans un seul arbre est la cause
racine du problème.

| Le client sait… | Il cherche par    | Support cible                                    |
| --------------- | ----------------- | ------------------------------------------------ |
| sa machine      | ISEKI SF224, 2003 | tables de **compatibilité** (N-N)                |
| la pièce voulue | « une courroie »  | **arbre de navigation**, 3 niveaux max           |
| la référence    | `ISE-6202520`     | **recherche** (index trigram déjà en place)      |
| la marque       | HUSQVARNA         | **`brand`** (existe, non exploité en navigation) |

### 4.1 Règles de conception

1. **L'arbre ne porte que le type de pièce.** Si un nœud contient une marque, un modèle ou une
   année dans son nom, il n'a rien à faire dans l'arbre. 3 niveaux maximum, ~150 catégories.
2. **La compatibilité est une relation N-N**, jamais une catégorie. Nouvelles tables
   `machine_brand` / `machine_model` (avec années) + `product_compatibility`. Une pièce
   compatible avec 12 modèles = 1 fiche + 12 liaisons. C'est ce qui permet le sélecteur
   « Ma machine », principal levier de conversion du métier.
3. **Les vues éclatées sont un média, pas une catégorie.** 1 513 nœuds à 0 produit à sortir de
   l'arbre. `productMedia` gère déjà le type `pdf`.
4. **Rangement multiple.** `product_category` (N-N) devient le rangement réel ;
   `product.category_id` reste la catégorie **principale** (URL canonique, fil d'Ariane).
5. **Catalogue fournisseur ≠ catalogue boutique.** KRAMP garde sa taxonomie d'origine dans un
   champ dédié et est **mappé** vers l'arbre commun, jamais greffé dessus — sinon chaque
   nouveau fournisseur rajoute une branche parallèle et le problème se reproduit.
6. **Aucune catégorie vide en production.** Masquage automatique par comptage récursif, jamais
   à la main (sinon ça redérive en six mois).
7. **Traçabilité du classement.** Champ `category_source` (`rule` / `manual` / `legacy` /
   `supplier`) + règle appliquée. Sans ça : impossible de rejouer un classement, de corriger une
   règle en masse, ou de distinguer le validé humainement du deviné.

---

## 5. Stratégie de reclassification

### 5.1 Signal disponible

Le premier mot du nom produit est presque toujours le type de pièce, et la distribution est
très concentrée :

- **300 mots couvrent 69,5 %** des produits à reclasser
- 36 182 mots distincts au total, dont 22 313 en une seule occurrence (longue traîne marginale)

Top des premiers mots dans le fourre-tout (`id_category = 139`) :

```
VIS 26186 · SUPPORT 23009 · JOINT 19134 · REMPLACÉ 18753 · RESSORT 13147
RONDELLE 12795 · CABLE 10922 · FILTRE 10893 · KIT 10372 · PLAQUE 9928
AXE 8418 · TIMING 8262 · CARTER 7992 · COUVERCLE 7743 · ECROU 7667
COURROIE 7363 · TUBE 7255 · TUYAU 7250 · LEVIER 7009 · BAGUE 6838
```

Signaux complémentaires : `id_manufacturer` (99,7 % de couverture), fournisseur (26, dont
KRAMP 724 427 et ISEKI 126 082), `reference` structurée (`ISE-6202520`, `KUH-7S630666`).
Les `features` PrestaShop ne couvrent que ~2 % (« Type de pièce » : 19 423) — trop faibles
pour piloter le classement, mais utiles en appoint.

### 5.2 Pièges identifiés dans les données

1. **Bilinguisme.** Les fournisseurs étrangers (KRAMP, OPTIBELT, KUHN, B&S, KVERNELAND) livrent
   en anglais : `COURROIE` ≡ `Timing Belts` / `Ribbed Belts`, `VIS` ≡ `Screw`, `AXE` ≡ `Shaft`.
   **Les règles doivent mapper FR et EN vers la même famille**, sinon les familles se scindent.
2. **`REMPLACÉ` — 18 753 produits, et ce ne sont pas des pièces.**
   (`Remplacé Par 703961 | AL-KO`, `REMPLACE PAR 191G51-7`). Ce sont des produits obsolètes
   pointant vers leur remplaçant → `is_active = false` + liaison `product_relation` type
   `replacement` (la table existe déjà). À sortir de la navigation, pas à classer.
3. **Non-pièces à isoler** (~10 000) : `EMBALLAGE`, `BOÎTE EN CARTON`, `DECAL` (5 249),
   `AUTOCOLLANT`, `FRAIS EXPEDITION`. Consommables logistiques / adhésifs — catégorie dédiée ou
   hors boutique, à trancher, mais à ne pas laisser polluer les familles techniques.
4. **Noms tronqués à ~30 caractères** par l'import (`COUVERCLE BAS BOUTON DE BLOCAG`,
   `Screw With Cutting E`). Le premier mot survit → les règles tiennent, mais ne jamais se fier
   à la fin du nom.

### 5.3 Paliers

| #   | Palier                 | Volume estimé | Méthode                                    |
| --- | ---------------------- | ------------- | ------------------------------------------ |
| 1   | Sortir les obsolètes   | ~18 750       | `REMPLACÉ*` → inactif + `product_relation` |
| 2   | Sortir les non-pièces  | ~10 000       | emballages, décals, frais de port          |
| 3   | Règles top-300 (FR+EN) | ~732 000      | premier mot → famille                      |
| 4   | Longue traîne          | ~295 000      | itératif, par volume décroissant           |

Après le palier 3 : passage de ~19 % à **~75 % du catalogue navigable**. Le palier 4 se traite
au fil de l'eau, en attaquant toujours le plus gros reliquat — **ne pas viser 100 %**, non
rentable sur 22 313 termes uniques.

---

## 6. Plan d'exécution

Toutes les étapes d'écriture ci-dessous s'appliquent à **`DATABASE_URL` (sakura)**, jamais à
`prod5` (lecture seule) ni à `metro` (hors périmètre).

- [x] **Étape 0 — Sauvegarde.** ~~Dump de `DATABASE_URL` avant toute suppression.~~
      **Écartée** (décision client, 2026-08-07) : `metro` contient déjà les mêmes données
      en amont, et la source `prod5` reste intacte et en lecture seule. Rien d'irremplaçable
      n'est détruit par la purge.
- [ ] **Étape 1 — Extraction des familles réelles.** Analyse de fréquence sur les 1,05 M de noms
      source → liste des ~300 familles avec volumes et mapping FR/EN. Lecture seule.
- [ ] **Étape 2 — Arbre cible.** Figer la taxonomie (~150 catégories, 3 niveaux) à partir de
      l'étape 1. **Décision métier — validation client requise.**
- [ ] **Étape 3 — Schéma.** Ajout dans `DATABASE_URL` des tables `machine_brand`,
      `machine_model`, `product_compatibility` ; champs `category_source`, taxonomie
      fournisseur. Migration Drizzle (`catalog.schema.ts` + `bun db:generate` / `db:migrate`).
- [x] **Étape 4 — Service de migration.** ✅ Livré dans `scripts/migrations/prestashop/`
      (voir §6.1 ci-dessous). Lit `prod5` en lecture seule stricte via tunnel SSH,
      écrit dans `DATABASE_URL`, idempotent par `legacy_ps_id`, reprise sur erreur,
      exécution par lots. **Écrit et testé, mais pas encore exécuté contre les bases.**
      Les scripts `scripts/migration/` branchés sur `metro` restent en place le temps de
      la bascule ; ils sont à supprimer une fois la nouvelle migration validée.
- [ ] **Étape 5 — Purge.** Suppression des produits + catégories dans `DATABASE_URL`
      (`product`, `product_media`, `product_variant`, `product_category`, `category`…),
      dans l'ordre des dépendances FK. Commande : `bun run migrate:ps -- --only=purge`
      (jamais jouée par un lancement par défaut).
- [ ] **Étape 6 — Import.** Marques → catégories cibles → produits (avec `ps_category_product`
      N-N) → médias → déclinaisons.
- [ ] **Étape 7 — Reclassification.** Paliers 1 → 4, avec compte-rendu par règle
      (volume + échantillon de 10) **validé avant écriture en production**.
- [ ] **Étape 8 — Contrôles.** Voir §7.

### Garde-fous

- Appliquer les règles **en base de test d'abord**, jamais directement en production.
- `legacy_ps_id` renseigné partout → tout est réversible et rejouable.
- Chaque palier produit un rapport chiffré consigné en §8.

---

### 6.1 Le service de migration (étape 4, livré)

#### Arborescence

```
scripts/
├── lib/                          # socle réutilisable, non spécifique à PrestaShop
│   ├── env.ts                    # lecture .env hors SvelteKit
│   ├── logger.ts                 # sortie CLI, barre de progression
│   ├── runner.ts                 # orchestrateur : --only, --from, --dry-run, --limit
│   ├── target-db.ts              # connexion cible + insertion par lots
│   └── transform.ts              # slugify, money, bool, text, date, truncate
└── migrations/prestashop/
    ├── index.ts                  # point d'entrée CLI
    ├── source-db.ts              # tunnel SSH + connexion LECTURE SEULE + curseur
    ├── source-db.spec.ts         # tests du garde-fou lecture seule
    ├── source-cursor.spec.ts     # tests de pagination (perte / doublon)
    ├── media-url.ts              # reconstruction des URL d'images PrestaShop
    └── tasks/
        ├── 00-purge.ts           # étape 5 — destructive, jamais automatique
        ├── 01-brands.ts          # ps_manufacturer   → brand
        ├── 02-categories.ts      # ps_category       → category (+ parents)
        ├── 03-products.ts        # ps_product        → product
        ├── 04-product-categories.ts # ps_category_product → product_category (N-N)
        ├── 05-media.ts           # ps_image          → product_media
        ├── 06-variants.ts        # ps_product_attribute → product_variant
        └── 07-verify.ts          # contrôles de recette §7
```

#### Utilisation

```bash
bun run migrate:ps -- --list            # liste les tâches
bun run migrate:ps:dry                  # simulation, aucune écriture
bun run migrate:ps -- --only=products --limit=1000   # essai sur 1 000 produits
bun run migrate:ps -- --from=products   # reprise après interruption
bun run migrate:ps                      # migration complète
bun run migrate:ps:verify               # contrôles de recette seuls (lecture seule)
```

> Les scripts passent par `node --experimental-strip-types`, pas par `bun` :
> le cache bun a une résolution cassée sur `iconv-lite` → `safer-buffer` (§2.1).

#### Choix d'implémentation

| Sujet                 | Décision                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lecture seule**     | `assertReadOnly` rejette toute requête non-`SELECT` **avant le réseau**, y compris `SELECT … INTO OUTFILE` (qui écrit un fichier sur le serveur source tout en passant pour un `SELECT`). Verrouillé par 15 tests.                          |
| **Purge**             | Exclue de la migration complète. Jouable seulement par `--only=purge`, après la sauvegarde de l'étape 0.                                                                                                                                    |
| **Mapping catégorie** | **Direct** `ps_product.id_category_default` → `category.legacy_ps_id`. Un seul saut, contre trois dans l'ancienne chaîne — c'est la correction du constat n°1. Tout produit non résolu est **compté et rapporté**, jamais perdu en silence. |
| **Pagination**        | Par clé (`WHERE id > ?`), jamais `OFFSET` (quadratique sur 1 M de lignes). Sur clé non unique (`ps_category_product`), le dernier groupe de chaque page est reporté à la page suivante pour ne perdre aucune liaison.                       |
| **Volumes**           | Produits, N-N et images passent par une table temporaire côté Postgres : la résolution `legacy_ps_id → id` s'y fait par jointure indexée, plutôt qu'en tenant 1,05 M de couples en mémoire JS.                                              |
| **Idempotence**       | Par `legacy_ps_id` sur toutes les tâches. Une interruption se reprend sans doublon.                                                                                                                                                         |

#### Images et futur stockage R2

PrestaShop ne stocke **aucune URL** : il dérive un chemin éclaté depuis `id_image`
(`568712` → `/img/p/5/6/8/7/1/2/568712.jpg`). L'import reconstruit donc l'URL de
l'ancien site, et conserve l'`id_image` dans `product_media.legacy_ps_id`.

Le transfert vers R2 sera un simple parcours de la table cible, **sans retour à
PrestaShop** :

```sql
SELECT id, url FROM product_media WHERE url LIKE 'https://www.mecaservicesshop.fr/%';
-- télécharger, pousser sur R2, puis UPDATE product_media SET url = <url R2>
```

La base d'URL est surchargeable par `PS_IMAGE_BASE_URL` dans `.env` (changement de
domaine ou passage par un CDN).

#### Deux défauts corrigés pendant l'écriture

Le socle initial contenait deux bugs qui auraient produit des pertes **silencieuses** —
le mode de défaillance même qui a causé les 81 % d'orphelins :

1. **Clé de curseur qualifiée.** `sourceCursor` relisait la clé sous son nom qualifié
   (`p.id_product`), alors que MySQL renvoie `id_product`. La valeur était `undefined`,
   et le curseur rejouait indéfiniment la même page. Aurait bloqué `products` et `media`.
2. **Clé de curseur non unique.** Sur `ps_category_product` (plusieurs lignes par
   `id_product`), la reprise à `> lastKey` **sautait** les liaisons restantes du produit
   coupé en bord de page.

Les deux sont couverts par `source-cursor.spec.ts`.

---

## 7. Contrôles de recette

| #   | Contrôle                               | Seuil attendu                       |
| --- | -------------------------------------- | ----------------------------------- |
| 1   | Produits importés vs source            | ≥ 99,9 % de 1 053 957               |
| 2   | Produits sans catégorie                | **< 1 %** (vs 81 % aujourd'hui)     |
| 3   | Produits dans un fourre-tout           | **0**                               |
| 4   | Catégories vides visibles              | **0**                               |
| 5   | Profondeur de l'arbre                  | **≤ 3**                             |
| 6   | Nombre de catégories                   | ~150 (vs 5 940)                     |
| 7   | Marques rattachées                     | ≥ 99 %                              |
| 8   | Liaisons N-N `product_category`        | > 1 M (vs 1)                        |
| 9   | Médias rattachés                       | cohérent avec 568 712 images source |
| 10  | Obsolètes `REMPLACÉ` désactivés + liés | ~18 750                             |

---

## 8. Journal des décisions et mesures

| Date       | Sujet                | Décision / mesure                                                                                                                                                                                                                                                                                     |
| ---------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-07 | Analyse source       | Source = MariaDB `prod5` via tunnel SSH, en lecture seule stricte                                                                                                                                                                                                                                     |
| 2026-08-07 | **Base cible**       | **`DATABASE_URL` / sakura (base projet msshopv2)** — c'est là qu'on purge, qu'on ajoute les tables et qu'on importe. Migration **directe** `prod5` → `DATABASE_URL`, sans intermédiaire. _(Décision client, corrige une erreur de la v1 de ce document qui proposait d'abandonner la mauvaise base.)_ |
| 2026-08-07 | `metro`              | Hors périmètre : ni lue ni écrite par le nouveau service. Vérifié serveur distinct de sakura (`system_identifier` différents), 87 tables en français vs 21 en anglais. Scripts existants qui en dépendent → à remplacer                                                                               |
| 2026-08-07 | Cause des orphelins  | Bug de migration (double mapping + N-N non migrée), pas un défaut de données source                                                                                                                                                                                                                   |
| 2026-08-07 | Fourre-tout          | 838 987 produits sans autre catégorie → reclassification par règles obligatoire                                                                                                                                                                                                                       |
| 2026-08-07 | Stratégie            | Repartir de la source + réorganiser pendant l'import (décision client)                                                                                                                                                                                                                                |
| 2026-08-07 | Sauvegarde (étape 0) | **Écartée** pour l'instant : `metro` constitue déjà une copie amont des mêmes données, et la source `prod5` reste intacte (décision client). L'étape 0 n'est donc plus bloquante pour l'étape 5                                                                                                       |
| 2026-08-07 | **Étape 4 livrée**   | Service `scripts/migrations/prestashop/` — 8 tâches, CLI, 34 tests. Écrit et vérifié statiquement, **jamais exécuté contre les bases** à ce stade                                                                                                                                                     |
| 2026-08-07 | Garde-fou source     | Renforcé : `SELECT … INTO OUTFILE/DUMPFILE` écrit un fichier sur le serveur source tout en passant les filtres « commence par SELECT » et « pas de mot-clé d'écriture ». Contrôle dédié ajouté + 15 tests                                                                                             |
| 2026-08-07 | Bugs de curseur      | Deux pertes silencieuses corrigées avant toute exécution : clé qualifiée illisible (boucle infinie sur `products`/`media`) et clé non unique (liaisons N-N perdues en bord de page). Couverts par `source-cursor.spec.ts`                                                                             |
| 2026-08-07 | Images / R2          | R2 pas encore en place : on importe les **URL reconstruites** de l'ancien site + l'`id_image` source dans `product_media.legacy_ps_id`. La reprise vers R2 se fera depuis la table cible, sans retour à PrestaShop (décision client)                                                                  |
| 2026-08-07 | Purge                | Retirée de la migration complète : jouable uniquement par `--only=purge`, pour qu'un lancement par défaut ne puisse jamais détruire le catalogue                                                                                                                                                      |

---

## 9. Points ouverts (validation client)

1. **KRAMP** (724 427 produits, 481 catégories) — fondu dans l'arbre commun, ou catalogue
   fournisseur distinct ? Il duplique déjà des notions existantes (`Roulements`, `Filtres`,
   `Gants`). _Impact fort sur la taxonomie cible._
2. **Non-pièces** (emballages, décals, frais de port) — catégorie dédiée ou exclusion de la
   boutique ?
3. **Produits inactifs** (48 528 à la source) — migrés puis désactivés, ou non migrés ?
4. **Vues éclatées** — rattachées à quel niveau : modèle de machine, ou produit ?
5. **Arbre cible** — la liste des ~150 catégories devra être validée avant tout rangement
   (étape 2). C'est la décision structurante du chantier.
