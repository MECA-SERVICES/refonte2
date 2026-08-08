# Migration & réorganisation du catalogue

> **Cahier des charges et mémoire de travail.**
> Ce fichier est la source de vérité du chantier « remise à plat du catalogue ».
> Toute décision prise, tout chiffre mesuré, tout écart constaté doit être consigné ici.
>
> Dernière mise à jour : 2026-08-08 — état : **arbre validé ; étapes 1, 3, 4 et 7 écrites — aucune n'a encore été exécutée contre les bases**
>
> **Révision du 2026-08-08 — les marques ne sont plus des catégories.** Le pipeline
> importait encore l'arbre PrestaShop *verbatim* (5 948 nœuds) **en plus** de l'arbre
> propre, puis rerattachait les produits aux anciens nœuds — annulant tout le nettoyage.
> `EGO POWER+`, `OUTILS WOLF`, `Pieces MAKITA`… seraient restés des catégories.
> Corrigé : voir §6.6.

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

> **Chiffres corrigés le 2026-08-07** par comptage récursif (nested set `nleft`/`nright`).
> La v1 de ce tableau ne comptait que les produits rattachés **directement** à chaque nœud,
> ce qui sous-estimait fortement KRAMP et Électroportatif.

| Branche (niveau 2)         | Catégories | Produits (récursif) | Rôle réel                                  |
| -------------------------- | ---------- | ------------------- | ------------------------------------------ |
| Pièces détachées           | 3 483      | **855 443**         | **Compatibilité** marque > modèle > année  |
| KRAMP                      | 481        | **169 006**         | **Catalogue fournisseur** importé tel quel |
| Électroportatif            | 136        | **21 731**          | Mixte — 92 % de pièces (voir ci-dessous)   |
| Consommables               | 55         | 4 550               | Navigation boutique                        |
| Motoculture                | 123        | 3 554               | **Vraies machines**                        |
| Jardins                    | 60         | 763                 | Navigation boutique                        |
| Équipement cheval          | 43         | 511                 | Navigation boutique                        |
| Vêtements et sécurité      | 31         | 383                 | Navigation boutique                        |
| Pièces chauffe-eau         | 3          | 140                 | Pièces                                     |
| Gamme hiver                | 7          | 47                  | Navigation boutique                        |
| Vues éclatées              | 1 513      | **3**               | **Documentation** (planches de schémas)    |
| Destockage, facebook, test | 11         | 11                  | Résidus à supprimer                        |

**La séparation pièces / produits n'est pas fiable à la source.** La branche
« Électroportatif » est présentée comme de la navigation boutique, mais 20 076 de ses
21 731 produits (92 %) sont en réalité des pièces :

```
Électroportatif > Pieces MAKITA - DOLMAR    14 214   ← pièces
Électroportatif > ACCESSOIRES MAKITA         5 862   ← pièces
Électroportatif > Perceuse / Visseuse          371   ← machines
Électroportatif > Scies                        279   ← machines
```

Seule « Motoculture » est une branche machines cohérente (tondeuses, tronçonneuses,
taille-haies…). Le catalogue réel est donc :

- **~1 046 000 pièces détachées** (99,7 %)
- **~3 200 machines et produits finis** (0,3 %)

KRAMP est bien un **silo parallèle** : seuls 965 de ses 169 006 produits apparaissent
aussi sous « Pièces détachées ». Ses 481 catégories dupliquent des notions existantes
sans jamais les rejoindre.

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

1. **L'arbre ne porte que le type de pièce ou de produit.** Si un nœud contient une marque,
   un modèle ou une année dans son nom, il n'a rien à faire dans l'arbre.
   _Révision du 2026-08-07 : la limite « 3 niveaux, ~150 catégories » est remplacée par
   **4 niveaux pour les pièces, 5 pour les produits, ~612 catégories**. Mesure à l'appui
   (§6.3), la profondeur source n'était pas du bruit — le bruit venait uniquement de l'axe
   compatibilité. Ce qui est interdit, c'est la compatibilité dans l'arbre, pas la profondeur._
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

### 5.4 Étape 1 exécutée — familles mesurées (2026-08-07)

Analyse de fréquence sur les 1 053 957 noms produits (lecture seule sur `prod5`).

**Résultat : 265 mots-clés répartis en 19 familles classent 717 323 produits — 68,1 % du
catalogue.** Le tri automatique est donc viable ; c'est la validation attendue de l'étape 1.

| Famille                       | Produits    | Part       |
| ----------------------------- | ----------- | ---------- |
| Visserie                      | 105 504     | 10,0 %     |
| Structure & fixation          | 84 459      | 8,0 %      |
| Carrosserie & protection      | 73 830      | 7,0 %      |
| Transmission                  | 61 357      | 5,8 %      |
| Hydraulique & pneumatique     | 48 994      | 4,6 %      |
| Roulements & paliers          | 47 574      | 4,5 %      |
| Outillage à main              | 41 109      | 3,9 %      |
| Électrique                    | 35 424      | 3,4 %      |
| Joints & étanchéité           | 35 387      | 3,4 %      |
| Coupe                         | 29 580      | 2,8 %      |
| Moteur                        | 29 268      | 2,8 %      |
| Commandes                     | 23 791      | 2,3 %      |
| Signalétique & adhésifs       | 19 215      | 1,8 %      |
| **Obsolètes** (`REMPLACÉ*`)   | 18 803      | 1,8 %      |
| Ressorts & amortisseurs       | 18 583      | 1,8 %      |
| Filtration                    | 16 149      | 1,5 %      |
| Réservoirs & bouchons         | 14 008      | 1,3 %      |
| Roues & pneus                 | 11 082      | 1,1 %      |
| Ventilation & refroidissement | 3 206       | 0,3 %      |
| **Total classé**              | **717 323** | **68,1 %** |

#### Ce que l'analyse a confirmé

- **Bilinguisme réel et massif.** `SCREW` 4 651 ≡ `VIS` 32 853 ; `SPRING` 2 256 ≡ `RESSORT` ;
  `BEARING` 1 447 ≡ `ROULEMENT` ; `TIMING`/`RIBBED`/`KRAFTBANDS` 12 442 ≡ `COURROIE`.
  Sans mapping FR+EN, ces familles se scinderaient en deux.
- **Normalisation de la ponctuation indispensable.** Les noms tronqués laissent des virgules
  finales (`HOSE,` 1 623, `PLATE,` 1 284, `DECAL,` 1 917). Retirer `,` et `.` en fin de premier
  mot fait gagner ~62 000 produits à lui seul.
- **Signal prix net pour les machines.** Mots machine : 200 à 2 900 € de moyenne
  (TONDEUSE 2 446 €, BROYEUR 2 601 €, MOTOCULTEUR 2 914 €) contre un catalogue dont
  **73 % des lignes sont sous 100 €**. Le couple mot + prix sépare proprement les deux axes.
- **Colonnes custom peu exploitables.** `article_de_remplacement` (1 892) et `article_remplace`
  (1 201) ne couvrent que 3 093 lignes, contre 18 803 produits `REMPLACÉ*` dans le nom.
  Le signal de remplacement reste donc le **nom**, avec les colonnes en appoint.

#### Reliquat

- 237 481 produits sur 1 184 mots ≥ 50 occurrences — encore réductible par ajouts ciblés
  (`HARNESS`, `PTO`, `FRAME`, `SHIELD`, `MAILLON`, `TAMBOUR`…).
- ~99 000 produits en longue traîne (< 50 occurrences) — **hors périmètre rentable**.

Bruit identifié à écarter des règles : `HIGH` (4 289), `PLUS` (1 602), `(C)` (1 798),
`CJ` (1 033), `MANUAL-KHI` — préfixes d'import, pas des types de pièce.

---

## 6. Plan d'exécution

Toutes les étapes d'écriture ci-dessous s'appliquent à **`DATABASE_URL` (sakura)**, jamais à
`prod5` (lecture seule) ni à `metro` (hors périmètre).

- [x] **Étape 0 — Sauvegarde.** ~~Dump de `DATABASE_URL` avant toute suppression.~~
      **Écartée** (décision client, 2026-08-07) : `metro` contient déjà les mêmes données
      en amont, et la source `prod5` reste intacte et en lecture seule. Rien d'irremplaçable
      n'est détruit par la purge.
- [x] **Étape 1 — Extraction des familles réelles.** ✅ Exécutée le 2026-08-07 (lecture seule).
      265 mots-clés FR+EN → 19 familles couvrant 68,1 % du catalogue. Voir §5.4.
- [ ] **Étape 2 — Arbre cible.** Figer la taxonomie à partir du §5.4 et du §6.2.
      **Décision métier — validation client requise.**
- [x] **Étape 3 — Schéma.** ✅ Écrite le 2026-08-07 — `drizzle/0007_marvelous_shotgun.sql`,
      **générée mais NON appliquée**. Voir §6.4.
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
- [ ] **Étape 6 — Import.** Marques → produits → médias → déclinaisons → **arbre propre**
      (`taxonomy` puis `product-taxonomy`) → liaisons N-N (`ps_category_product`, résolues
      vers les seuls nœuds retenus) → `reclassify`. L'arbre source n'est **pas** importé
      verbatim : voir §6.6.
- [x] **Étape 7 — Reclassification.** ✅ Écrite le 2026-08-07 — tâches `taxonomy` et
      `reclassify`, **non exécutées**. Le rapport par règle est produit en `--dry-run`.
      Voir §6.5.
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
    ├── taxonomy.ts               # LES RÈGLES pièces — données pures, éditables
    ├── taxonomy.spec.ts          # unicité, normalisation, mapping FR/EN
    ├── brand-nodes.ts            # nœuds-marques à écarter de l'arbre (EGO POWER+…)
    └── tasks/
        ├── 00-purge.ts           # étape 5 — destructive, jamais automatique
        ├── 01-brands.ts          # ps_manufacturer   → brand
        ├── 02-categories.ts      # ⚠️ import verbatim — HORS pipeline (§6.6), --only seul
        ├── 03-products.ts        # ps_product        → product
        ├── 04-product-categories.ts # ps_category_product → product_category (N-N)
        ├── 05-media.ts           # ps_image          → product_media
        ├── 06-variants.ts        # ps_product_attribute → product_variant
        ├── 07-verify.ts          # contrôles de recette §7
        ├── 08-taxonomy.ts        # crée l'arbre des pièces (source='rule')
        ├── 09-reclassify.ts      # range les pièces par règles
        └── 10-product-taxonomy.ts # arbre produits repris, SANS les nœuds-marques
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

### 6.2 Arborescence cible — première proposition (obsolète, conservée pour mémoire)

> ⚠️ **Écartée le 2026-08-07.** Cette version à 3 niveaux / 114 catégories aplatissait une
> taxonomie métier déjà correcte à la source : tondeuses, tronçonneuses et taille-haies s'y
> retrouvaient en vrac sous « Motoculture ».
> **La version à valider est au §6.3.**

Construite sur les volumes réels du §5.4. **2 racines**, qui matérialisent la séparation
pièces / produits demandée par le client, et **3 niveaux maximum**.

```
PIÈCES DÉTACHÉES                                        ~1 046 000
├── Visserie & fixation                                    105 504
│   ├── Vis & boulons · Écrous · Rondelles
│   └── Goupilles, circlips, rivets
├── Structure & supports                                    84 459
├── Carrosserie & protection                                73 830
│   ├── Carters & capots · Tôles & plaques · Boîtiers
├── Transmission                                            61 357
│   ├── Courroies · Chaînes · Poulies & pignons · Arbres · Embrayages
├── Hydraulique & pneumatique                               48 994
│   ├── Flexibles & durites · Raccords · Vérins · Pompes · Vannes
├── Roulements & paliers                                    47 574
├── Électrique                                              35 424
│   ├── Câbles & faisceaux · Interrupteurs · Éclairage · Batteries
├── Joints & étanchéité                                     35 387
├── Coupe                                                   29 580
│   ├── Lames & couteaux · Disques · Forets & fraises · Dents & socs
├── Moteur                                                  29 268
│   ├── Allumage · Carburation · Cylindrée · Démarrage · Échappement
├── Commandes                                               23 791
├── Ressorts & amortisseurs                                 18 583
├── Filtration                                              16 149
├── Réservoirs & bouchons                                   14 008
├── Roues & pneus                                           11 082
└── Ventilation & refroidissement                            3 206

PRODUITS                                                    ~11 000
├── Motoculture                                              3 554
│   ├── Tondeuses & tracteurs · Tronçonneuses · Débroussailleuses
│   ├── Taille-haies · Souffleurs · Robots de tonte · Motobineuses
├── Électroportatif                                          1 655
│   ├── Perçage & vissage · Sciage · Ponçage · Meulage
├── Consommables                                             4 550
├── Vêtements & sécurité (EPI)                                 383
├── Jardin & équipement                                      1 274
└── Outillage à main                                        41 109  ⚠️ à arbitrer

HORS NAVIGATION (importés, non visibles)
├── Obsolètes (REMPLACÉ*)          18 803   is_active = false + product_relation
└── Signalétique & adhésifs        19 215   décals, autocollants, étiquettes
```

**Environ 90 catégories** sur 3 niveaux, contre 5 948 sur 12 aujourd'hui.

#### Trois arbitrages nécessaires

1. **« Outillage à main » (41 109)** — la famille agrège `KIT`, `JEU`, `SET`, `ENSEMBLE`,
   qui sont des _conditionnements_, pas des types. Un « kit de joints » est une pièce, une
   « clé à molette » est un produit. À scinder : le mot seul ne suffit pas à trancher.
2. **KRAMP (169 006)** — ses 481 catégories sont supprimées comme convenu, ses produits
   repartent dans le tri commun. Ses libellés restent **exploitables comme signal**
   (`KRAMP > Hydraulique & Entraînement` → famille Hydraulique, plus fiable que le premier
   mot du nom). Conservables dans un champ fournisseur pour la traçabilité.
3. **Signalétique & adhésifs (19 215)** — décals et autocollants : catégorie visible ou
   hors boutique ? (point ouvert n°2 du §9)

### 6.3 Arborescence complète — 4 à 5 niveaux (à valider)

> **Révision du 2026-08-07.** Une première proposition à 3 niveaux (114 catégories) a été
> écartée : elle écrasait une taxonomie métier déjà correcte à la source. Les tondeuses,
> tronçonneuses et taille-haies s'y retrouvaient en vrac sous « Motoculture ».

#### Ce que l'analyse de la source a révélé

La base PrestaShop contient **deux arbres de nature différente**, mélangés :

|                                                                    | Rôle                                                                 | Profondeur utile                   | Décision                                                 |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------- |
| `Pièces détachées` (139) + `Vues éclatées` (3335)                  | **Compatibilité** machine (marque > modèle > année) et documentation | jusqu'à 11                         | **Sortis de l'arbre** → tables de compatibilité + médias |
| `Motoculture`, `Électroportatif`, `Consommables`, `Jardin`, `EPI`… | **Vraie taxonomie boutique**                                         | **5 niveaux, 648 nœuds non vides** | **Préservée telle quelle**                               |

Mesure décisive — catégories **non vides** par niveau, hors branches de compatibilité :

```
niveau 2 :   2      niveau 3 : 119      niveau 4 : 248      niveau 5 : 281
```

Autrement dit : la profondeur de l'arbre source n'était pas du bruit, c'était de
l'information métier. Le bruit venait **uniquement** de l'axe compatibilité (niveaux 6 à 11,
où le nombre de catégories non vides s'effondre : 146 → 153 → 46 → 3 → 0).

La règle n°1 du §4.1 (« 3 niveaux maximum ») est donc **révisée** : elle visait juste à
interdire la compatibilité dans l'arbre. C'est ce principe qui est conservé, pas le chiffre.

#### L'arbre cible

- **~578 catégories** — 238 pour les pièces (créées par règles), ~338 pour les produits
  (reprises de la source **hors nœuds-marques**), 2 techniques.
- **4 niveaux** pour les pièces, **jusqu'à 5** pour les produits.
- **752 049 produits classés, soit 71,4 %** du catalogue.
- À comparer aux 5 948 catégories sur 12 niveaux actuelles, dont 93 % vides.

> **Lecture — `⊘` = nœud écarté (révision du 2026-08-08).** Les lignes marquées `⊘` sont
> des **nœuds-marques** : ils existent à la source mais **ne sont pas repris** dans l'arbre
> cible (règle n°1 du §4.1 — une marque n'est pas une catégorie). Leurs produits ne sont
> pas perdus : ils remontent au premier ancêtre conservé, et la marque reste portée par
> `product.brand_id`, qui est l'axe de navigation par marque. La liste faisant foi est
> `scripts/migrations/prestashop/brand-nodes.ts` ; le mécanisme est décrit au §6.6.
>
> Les volumes entre parenthèses `(363)` sont donc **redistribués**, pas supprimés — c'est
> pourquoi ils ne sont plus additionnés dans les totaux de branche.

```
==========================================================================
PIÈCES DÉTACHÉES                                      682 492
==========================================================================
  Visserie & boulonnerie                              109 310
    Vis                                                38 264
      Vis à métaux                                     33 102
      Vis anglaises                                     5 162
    Rondelles & cales                                  20 400
      Rondelles                                        18 013
      Cales & shims                                     2 387
    Goupilles & circlips                               16 243
      Goupilles                                         8 845
      Circlips & anneaux                                5 815
      Clips & agrafes                                   1 583
    Boulons & goujons                                  13 527
      Boulons                                          11 675
      Goujons & tiges filetées                          1 852
    Écrous                                             11 910
      Écrous                                           11 910
    Rivets & colliers                                   6 915
      Colliers de serrage                               4 507
      Attaches                                          1 383
      Rivets                                            1 025
    Clavettes                                           2 051
      Clavettes                                         2 051
  Structure & fixation                                 83 758
    Supports                                           34 162
      Supports                                         28 202
      Brides                                            2 853
      Pattes & étriers                                  1 944
      Fixations                                         1 163
    Bras & tiges                                       13 020
      Tiges & barres                                    7 012
      Bras                                              6 008
    Axes & pivots                                      10 676
      Axes                                              9 040
      Pivots                                            1 636
    Adaptateurs                                        10 282
      Adaptateurs                                       3 737
      Embouts                                           3 319
      Crochets & blocs                                  3 226
    Tubes                                               9 477
      Tubes & profilés                                  9 477
    Entretoises                                         6 141
      Entretoises                                       6 141
  Carrosserie & protection                             76 501
    Carters & capots                                   26 497
      Couvercles                                       12 912
      Carters                                           8 639
      Capots                                            4 946
    Tôlerie                                            22 087
      Tôles & plaques                                  21 063
      Panneaux                                          1 024
    Protections                                        10 130
      Protections & carters de sécurité                 7 922
      Déflecteurs                                       1 179
      Grilles                                           1 029
    Boîtiers                                            8 748
      Boîtiers & logements                              5 124
      Boîtes & consoles                                 3 624
    Châssis                                             7 032
      Châssis & cadres                                  4 381
      Corps & bases                                     2 651
    Vitrage & portes                                    2 007
      Vitres                                            1 019
      Portes                                              988
  Transmission                                         62 274
    Courroies                                          24 228
      Courroies trapézoïdales                          11 786
      Courroies crantées                                8 263
      Courroies striées                                 4 179
    Poulies & pignons                                  16 589
      Pignons                                           7 867
      Poulies                                           6 752
      Engrenages                                        1 970
    Arbres & cardans                                   12 381
      Arbres                                            8 869
      Essieux                                           2 007
      Cardans & PDF                                     1 505
    Chaînes                                             5 583
      Chaînes                                           3 831
      Maillons                                          1 752
    Embrayages                                          2 478
      Embrayages                                        2 478
    Tendeurs                                            1 015
      Tendeurs                                          1 015
  Roulements & guidage                                 51 549
    Bagues & douilles                                  23 493
      Bagues                                           10 594
      Douilles                                         10 125
      Manchons                                          1 640
      Coussinets                                        1 134
    Roulements                                         15 797
      Roulements                                       15 797
    Moyeux & butées                                     4 769
      Butées & rotules                                  2 556
      Moyeux                                            2 213
    Paliers                                             4 527
      Paliers & flasques                                4 527
    Galets & rouleaux                                   2 963
      Galets                                            1 579
      Rouleaux                                          1 384
  Hydraulique & pneumatique                            47 027
    Flexibles & durites                                15 538
      Tuyaux                                            9 766
      Flexibles                                         4 703
      Durites                                           1 069
    Raccords                                           13 397
      Raccords                                         10 484
      Coudes                                            1 544
      Bouchons hydrauliques                             1 369
    Vannes & clapets                                    4 858
      Vannes                                            3 028
      Clapets                                           1 199
      Distributeurs                                       631
    Buses & gicleurs                                    4 337
      Buses                                             3 229
      Gicleurs                                          1 108
    Pompes                                              3 908
      Pompes                                            3 908
    Vérins                                              2 774
      Vérins                                            2 774
    Instruments                                         2 215
      Manomètres & jauges                               1 187
      Divers hydraulique                                1 028
  Électrique                                           38 660
    Câblage                                            17 690
      Câbles                                           12 540
      Faisceaux                                         3 321
      Fils                                              1 829
    Commande électrique                                 5 964
      Interrupteurs                                     4 493
      Contacteurs & relais                              1 471
    Connectique                                         4 286
      Connecteurs & fiches                              3 343
      Fusibles                                            943
    Éclairage                                           4 015
      Phares & feux                                     2 388
      Ampoules                                          1 627
    Électronique                                        2 516
      Capteurs & sondes                                 1 756
      Modules                                             760
    Moteurs électriques                                 2 245
      Rotors & stators                                  2 177
      Charbons                                             68
    Énergie                                             1 944
      Batteries                                         1 364
      Chargeurs                                           580
  Joints & étanchéité                                  35 387
    Joints                                             33 118
      Joints plats                                     31 574
      Joints spi                                        1 544
    Membranes                                           1 140
      Membranes & garnitures                            1 140
    Joints toriques                                     1 129
      Joints toriques                                   1 129
  Kits & ensembles                                     31 201
    Kits                                               15 732
      Kits de réparation                               15 732
    Jeux & ensembles                                   15 469
      Jeux & ensembles                                 15 469
  Coupe & usure                                        29 670
    Lames & couteaux                                   10 420
      Lames                                             9 038
      Couteaux                                          1 382
    Guides                                              5 158
      Guides & mâchoires                                5 158
    Disques                                             5 059
      Disques                                           5 059
    Dents & socs                                        4 335
      Dents                                             2 287
      Socs                                              2 048
    Perçage & fraisage                                  3 781
      Forets & mèches                                   2 049
      Fraises                                             925
      Pointes                                             807
    Brosses                                               917
      Brosses                                             917
  Moteur                                               27 804
    Bas moteur                                          9 062
      Pistons & segments                                3 748
      Cylindres                                         3 114
      Vilebrequins & bielles                            2 200
    Démarrage                                           4 045
      Alternateurs & volants                            1 839
      Démarreurs                                        1 261
      Lanceurs                                            945
    Moteurs complets                                    3 961
      Moteurs                                           3 961
    Distribution                                        3 294
      Culasses & soupapes                               3 294
    Allumage                                            2 833
      Bobines & magnétos                                1 797
      Bougies                                           1 036
    Carburation                                         2 635
      Carburateurs                                      2 635
    Échappement                                         1 974
      Silencieux & pots                                 1 974
  Commandes                                            25 570
    Leviers                                            10 452
      Leviers & manettes                               10 452
    Poignées                                            7 626
      Poignées                                          6 484
      Guidons                                           1 142
    Tringlerie                                          2 754
      Tringles & biellettes                             2 317
      Pédales                                             437
    Supports de commande                                2 519
      Têtes & porte-outils                              2 519
    Boutons                                             2 219
      Boutons                                           2 219
  Ressorts & suspension                                18 583
    Ressorts                                           16 990
      Ressorts                                         16 990
    Amortisseurs                                        1 593
      Amortisseurs                                      1 202
      Silentblocs & tampons                               391
  Filtration                                           16 149
    Filtres                                            13 759
      Filtres                                          13 759
    Cartouches                                          2 390
      Cartouches & éléments                             2 390
  Réservoirs & contenants                              14 494
    Bouchons                                            9 647
      Bouchons & capuchons                              9 647
    Réservoirs                                          3 240
      Réservoirs & cuves                                3 240
    Sacs & bacs                                         1 607
      Sacs & bacs                                       1 607
  Roues, pneus & freinage                              11 349
    Roues                                               7 947
      Roues & jantes                                    7 947
    Pneumatiques                                        1 751
      Pneus & chambres                                  1 751
    Freinage                                            1 651
      Tambours & freins                                 1 651
  Refroidissement                                       3 206
    Ventilation                                         2 834
      Ventilateurs & turbines                           2 834
    Radiateurs                                            372
      Radiateurs                                          372

==========================================================================
PRODUITS & MACHINES                                    11 463
   (31 539 sous l'arbre source, moins les 20 076 produits des nœuds-marques
    MAKITA ⊘ qui repartent au tri par règles, côté pièces)
==========================================================================
  Électroportatif                                       1 655
    ⊘ Pieces MAKITA - DOLMAR    (14 214)  → marque + pièces : tri par règles
    ⊘ ACCESSOIRES MAKITA         (5 862)  → marque + pièces : tri par règles
    Perceuse / Visseuse / Bouloneuse / Vibreur            371
      Perceuse & Visseuse                                 161
      Boulonneuse                                          91
      Perceuse                                             33
      Visseuse à choc                                      29
      Visseuse plaque de plâtre                            19
      Visseuse                                             13
      Malaxeur                                              8
      Vibreur à béton                                       7
      Visseuse bardage                                      5
      Visseuse d'angle                                      4
      Perceuse magnétique                                   1
    Scies                                                 279
      Scie circulaire                                     101
      Scie sauteuse                                        45
      Scie sabre                                           36
      Scie radiale                                         28
      Scie à onglets                                       13
      Coupe tiges & coupe tube                             11
      Scie à ruban                                         10
      Scie diamant                                         10
        Disques                                             4
      Scie plongeante                                       7
      Scie sur table                                        5
      Rainureuse                                            5
      Scie à plaque de plâtre                               3
      Tronçonneuse à disque                                 2
      Scie a carrelage / Matériaux                          1
      Accessoires                                           1
    Perforateur / Burineur / Carotteuse                   167
      Burineur                                             62
      Perforateur burineur                                 55
      Perforateur                                          36
      Marteau piqueur                                      11
      Carotteuse à diamant                                  3
    Meuleuse / Polisseuse / Cisaille                      165
      Meuleuse                                            148
        Disques                                             6
      Cisaille                                             13
      Grignoteuse                                           4
    Aspirateur - Ventilateur                              127
      Aspirateur                                          104
      Accessoires aspirateur                               15
      Ventilateur                                           8
    Ponceuse / Rabot / Polisseuse / Surfaceuse            114
      Ponceuse                                             60
        Ponceuses exentriques                              16
        Ponceuse à disque / Polisseuse                     16
        Ponceuse vibrante                                  12
        Ponceuse à bande                                   11
        ⊘ Ponceuse murale Giraphe       (4)  → nom de gamme → « Ponceuse »
      Découpeur / Ponceur                                  26
      Rabot                                                26
      Surfaceuse                                            2
    Cloueur - Agrafeuse                                    66
      Cloueur à batterie                                   27
      Agrafeuse à pile                                     16
      Cloueur Haute pression                               10
      Cloueur à gaz                                         6
      Cloueur Basse pression                                4
      Agrafeuse Haute pression                              1
      Agrafeuse Basse pression                              1
    ⊘ ONGLET IMPORT MACHINES        (63)  → résidu d'import → Électroportatif
    Ensemble d'outils                                      61
      Ensemble d'outils sans fil                           42
      Ensemble d'outils filaire                            13
      Ensemble d'outils mixte                               6
    Batterie / Chargeur                                    53
      Batteries                                            26
      Chargeurs                                            22
      Accesoires pour batteries                             3
      Accessoires de chargeurs                              2
    Défonceuse - Mortaiseuse - Lamelleuse - Affleureuse - Fraiseuse       32
      Défonceuse                                           16
      Affleureuse                                          12
      Lamelleuse                                            2
      Mortaiseuse                                           2
      Fraiseuse                                             1
    Radio de chantier                                      20
    Laser & télémètre                                      19
      Niveau laser                                         13
      Télémetre                                             2
    Clés à cliquet sur batterie                            17
    Pistolet à mastic / Décapeur                           16
      Décapeur thermique                                   10
      Pistoler à mastic                                     5
      Décapeur à rouleau                                    1
    Outils pneumatique                                     16
      Cloueur                                               8
      Compresseur                                           4
      Accessoires                                           3
      Agrafeuse                                             1
    Outils de jardin                                       16
      Taille-Haie                                           5
      Débrousailleuse                                       4
      Outils multi-fonctions de jardin                      2
      Vibreur à branches sur pile                           2
      Nettoyeur haute pression                              1
      Groupe électrogène                                    1
      Lampes                                                1
    Coffret d'outils                                       14
    Poste a souder                                         10
    Lampe / Eclairage                                       8
    Machine à café                                          7
    Tournevis à piles                                       5
      Tournevis à chocs                                     4
      tournevis                                             1
    Enceinte                                                4
    Gonfleur                                                3
    Découpeuse thermique à disque                           2
      Accessoires                                           2
    Fraise à neige                                          2
  Consommables                                          4 550
    Courroies                                           2 420
    Roulements                                          1 243
      ⊘ Roulement FAG            (1 032)  → marque → « Roulements »
      Roulements spécifiques motoculture                  198
      ⊘ Roulement SKF               (13)  → marque → « Roulements »
    Bougies                                               436
      Bougies allumage                                    387
      Bougies préchauffage                                 49
    Outillage & entretien                                 171
      Accessoires forestier                                52
      Outils                                               43
      Limes                                                29
      Sécateurs                                            23
      Jerrycan                                             13
      Accessoires tracteurs tondeuse                        6
      Housse & boite de rangement                           2
      Accessoires tondeuses                                 1
      Clé à bougie                                          1
    Huiles - Graisses - Dégripant - Lubrifiant  - Additifs      113
      Anti-crevaison                                        1
      Huile moteur 4 temps                                  1
      Huile transmission                                    1
    Fils nylon                                             89
      Bobines                                              67
      Brins                                                15
    Outils d'atelier                                       40
      Manches outils d'atelier                              2
    Tête nylon                                             23
    Batterie                                               17
    Semences et Engrais                                     9
    Affuteuse - disques - accessoires                       7
    Durite à carburant                                      5
    Lames débroussailleuses                                 3
    Foret                                                   3
  Motoculture                                           3 554
    Jouets                                                641
    ⊘ EGO POWER+              (363)  → MARQUE : nœud + 25 sous-nœuds écartés
      ↳ ses 25 sous-nœuds dupliquent des types déjà présents ci-dessous.
        Ses produits remontent au vrai nœud, la marque reste dans brand_id :
          EGO POWER+ > TONDEUSES        (17) → Tondeuses            (272)
          EGO POWER+ > TRONCONNEUSES    (21) → Tronçonneuses        (167)
          EGO POWER+ > TAILLE-HAIES     (16) → Taille-haies         (157)
          EGO POWER+ > TRACTEUR TONDEUSE(20) → Tracteurs tondeuse   (275)
          EGO POWER+ > ROBOT TONDEUSE   (13) → Robots de tonte      (115)
          EGO POWER+ > SOUFFLEURS       (19) → Souffleurs / Aspir.   (80)
          … idem DEBROUSSAILLEUSES, NETTOYEUR HAUTE PRESSION, TARIERE,
            BATTERIES & CHARGEURS, LAMES, CHAINES & GUIDES, etc.
    Tracteurs tondeuse                                    275
      Tracteurs tondeuses avec ramassage                  109
      Accessoires tracteurs tondeuse                       84
      Tracteur tondeuses à éjection latérale               42
      Tracteurs tondeuses à rayon de braquage zéro         35
      Tracteurs tondeuses mulching                          8
      Tracteurs tondeuses à coupe frontale                  1
    Tondeuses                                             272
      Tondeuses tractées                                  136
      Tondeuses à batterie                                 57
      Tondeuses pro                                        43
      Tondeuses électriques                                31
      Accessoires tondeuses                                26
      Tondeuses poussées                                   17
      Tondeuses mécaniques                                  9
    Outils de jardin                                      218
      Accessoires outils de jardin                        157
      Outils pour le potager                               28
      Scies                                                 3
      Rouleau à gazon                                       1
    Nettoyeurs haute pression                             199
      Machine                                              59
      Accessoires hautes pressions                         49
    Débroussailleuses à dos                               196
      Accessoires débroussailleuses                        15
      Accessoires tête fil                                 12
      Accessoires lames                                     8
      Accessoires anti-projection                           4
    Outils multi-fonctions                                179
      Outils pour moteurs                                  51
      Accessoires machines sans fil                         4
    Tronçonneuses                                         167
      Accessoires tronçonneuses                             7
    Taille-haies                                          157
      Accessoires taille haie / sécateur                   25
      Sur perche                                            8
    Robots de tonte                                       115
      Accessoires robots de tonte                          49
      Machine pose fil                                      1
    Motobineuses                                           95
      Accessoires motobineuses                             37
    Sécateurs / Élagueuse à main                           94
      Accessoires sécateurs                                24
      Accessoires élagueuses                                6
      Lieuse pour vigne à batterie                          2
    Débroussailleuses à roues / Chenilles                  93
      Débroussailleuses auto-tractées                      44
      Débroussailleuses auto-portées                       24
    Souffleurs / Aspirateur de feuilles                    80
      Accessoires souffleurs / aspirateurs                  6
    Chargeurs & Batteries                                  78
      Batteries                                            19
      Batterie dorsale                                     17
      Chargeurs                                            13
      Accessoires chargeurs & batteries                     9
    Pulvérisateurs - Atomiseurs                            66
    Coupes-bordures                                        54
    Broyeurs végétaux                                      53
    Pompes à eau                                           39
      Vide cave                                             8
    Scarificateurs                                         38
      Accessoires de scarificateurs                        10
    Motoculteurs                                           29
      Accessoires motoculteurs                             17
    Groupes électrogènes 4 temps                           27
    Véhicules de transport                                 20
    Tarrières                                              19
      Mèches                                               10
    Engazonneuse                                           16
      Accessoires engazonneuses et regarnisseurs           13
    Scies                                                  15
      Accessoires                                           1
    Fendeuses à buche                                      13
    Découpeuses thermiques                                 10
      Accessoires découpeuse thermique                      1
    Fraises à neige                                         9
    Mini pelle excavatrice                                  9
    Bancs de scies                                          8
      Lame                                                  8
    Robot a chenille débroussailleur radiocommandé          8
    Gyrobroyeur                                             7
    Bennette 3 points                                       4
    Ensembles machines de jardin                            3
    Épandeurs                                               2
    Motofaucheuses                                          2
    Fraise rotative 3 points                                2
    Micro-tracteurs                                         1
      Accessoires micro-tracteurs                           1
    Nos occasions                                           1
    Deplaqueuse                                             1
  Jardin & extérieur                                      763
    Outils de jardin et ferme                             494
      Outils de la terre                                  253
        Manches d'outils de la terre                       64
      Nettoyage                                           116
        Tête brosses/râteau                                66
        Manches                                            14
      Échelles et échafaudages                             58
        Accessoires                                         3
      Brouettes-chariots                                   31
        Accessoires                                         1
      Outils arboricoles                                   18
        Manches                                            13
      Outils à fumier                                      11
      Contenants                                            9
    ⊘ OUTILS WOLF            (150)  → MARQUE : nœud + 3 sous-nœuds écartés
      ↳ produits remontés sous « Outils de jardin et ferme »
        (OUTILS INTERCHANGEABLES 77 · TRADITIONNELS 46 · COUPANTS 29)
    Matériel d'arrosage et récupérateur d'eau              60
      Tuyaux d'arrosage & enrouleurs                       60
    Pot de fleur, jardinière et bac                        36
    Plante et soins végétaux                               29
      Semences                                             28
        Gazons                                             22
        Mélanges fleuris                                    6
      Terreaux/paillages                                    1
    Outils du bâtiment                                      9
    Décoration                                              6
      Graviers/gravillons                                   4
      Béton drainant                                        1
      Galets                                                1
    Elevage                                                 2
      Clôtures pour animaux                                 2
  Équipement cheval                                       511
    Abri et box                                            90
      Abri                                                 34
      Portes de box                                        21
      Façades de box                                       13
      Séparation de box                                    11
      Box                                                   7
      Mesures et seaux à aliments                           4
    La carrière et le manège                               70
      Saut d'obstacle                                      41
      Balisage                                             15
      Carrière, rond de longue et module résine            14
    Abreuvoirs, mangeoires, supports                       69
    Accessoires pour construction et aménagement de box       45
    Stockage et distribution                               32
      Citerne                                              32
    sellerie                                               30
      Malle de transport et chariot porte selle            10
      Porte selle et porte bride                            7
      Equipement de sellerie                                6
      Bac et malle de pansage                               4
      Armoire de sellerie                                   3
    Bac de pâturages                                       23
    Outils à manche                                        21
    Barrière                                               21
    Protections des bâtiments                              19
    Brouettes, chariots & diable                           16
    Lavage et entretien                                    14
      Brosses et balais brosses                             7
      Lavage                                                4
      Raclettes pour sol                                    3
    Râtelier                                               13
    Coffres et silos à aliments                            12
    Accessoires pour le stockage des aliments              11
    Bien être du cheval                                     9
      Soin                                                  3
      Alimentation                                          3
      Enrichissement                                        2
      Litière                                               1
    Nourrisseur à poulains                                  7
    Panels                                                  6
    Remorque                                                3
      Accessoires                                           1
  Vêtements & sécurité (EPI)                              383
    Blouson / Blouson chauffant                           145
    Gants de travail                                       45
    Veste / gilet de travail                               36
    Tablier                                                34
    Short de chantier                                      29
    Lunettes de protection                                 17
    Pantalon atelier / sécurité / forestier                15
    Harnais                                                14
    Sweatshirt / polo / chemise                            10
    Bottes forestiéres                                     10
    Casque de protection                                    9
    Bleu de travail                                         5
    Ceinture - sacoche                                      5
    Salopette forestier / de chantier                       3
    Chaussures de sécurité                                  3
    T-shirt                                                 3
    Bonnet / casquette                                      1
    Montre - stylo - parapluie - porte clé                  1
    Bretelles                                               1
    Combinaison de travail                                  1
  Gamme hiver                                              47
    Produits pour poêle                                    14
    Produits pour neige et dégivrage                       10
    Mèche pour poêles                                       8
    Joint d'étanchéité                                      6
    Parasol chauffant                                       5
    Transfert de carburant                                  4

==========================================================================
HORS NAVIGATION                                        38 018
==========================================================================
  Obsolètes (REMPLACÉ*) → is_active=false              18 803
  Signalétique & adhésifs                              19 215

==========================================================================
TOTAL CLASSÉ : 752 049  =  71.4 % de 1 053 957   (inchangé : les produits des
               nœuds-marques ⊘ sont redistribués, jamais supprimés)
CATÉGORIES   : 238 (pièces) + ~338 (produits, hors ⊘) + 2 = ~578
               — 14 nœuds-marques racines ⊘ écartés AVEC leur descendance
                 (dont EGO POWER+ 25 sous-nœuds, OUTILS WOLF 3).
                 Le compte exact est affiché par `product-taxonomy` à
                 l'exécution ; ~578 est une estimation à confirmer.
PROFONDEUR   : 4 niveaux (pièces) / jusqu'à 5 (produits)
```

#### Pourquoi cette forme

**Côté pièces — construit par règles, 4 niveaux.** Le catalogue compte ~1,05 M de
références sans taxonomie exploitable (838 987 produits n'ont que le fourre-tout). On la
crée donc : `Pièces > Famille > Sous-famille > Type`. Exemple :
`Pièces détachées > Transmission > Courroies > Courroies crantées` (8 263).
Descendre plus bas (dimension, référence) relève de la **facette**, pas de l'arbre.

**Côté produits — repris de la source, jusqu'à 5 niveaux.** La taxonomie existe déjà et
elle est bonne. Exemple réel conservé :
`Produits > Motoculture > Tracteurs tondeuse > Tracteurs tondeuses à rayon de braquage zéro`.
C'est précisément la granularité qui manquait dans la version à 3 niveaux.

#### Ce qui reste hors de l'arbre, volontairement

- **Compatibilité machine** → `machine_brand` / `machine_model` / `product_compatibility`.
  Le niveau 3 sous « Pièces détachées » est aujourd'hui constitué de marques de machines
  (BRIGGS STRATTON 13 189, ISEKI 520, HUSQVARNA 179) : de la compatibilité déguisée en
  rangement. C'est ce qui alimente le sélecteur « Ma machine ».
- **Facettes** → les `ps_feature` de la source (49 446 produits) sont trop peu couvrantes
  pour structurer l'arbre, mais parfaites en filtres : `Diam. Intérieur` (1 030 valeurs),
  `Diam. Extérieur` (1 151), `Épaisseur` (418), `Profil` (17).
- **Vues éclatées** (1 513 nœuds, 3 produits) → médias `pdf` rattachés aux produits.
- **~302 000 produits (28,6 %)** non couverts par les règles → importés, cherchables,
  rangés en `À classer` par famille et traités au fil de l'eau (palier 4, §5.3).

### 6.4 Étape 3 — Schéma de compatibilité (écrit, non appliqué)

Fichiers : `src/lib/server/db/compatibility.schema.ts` (nouveau),
`src/lib/server/db/catalog.schema.ts` (2 colonnes ajoutées),
migration générée `drizzle/0007_marvelous_shotgun.sql`.

#### Ce que la migration fait

| Objet                   | Nature  | Rôle                                                         |
| ----------------------- | ------- | ------------------------------------------------------------ |
| `machine_brand`         | table   | Constructeurs d'engins — ISEKI, HUSQVARNA, BRIGGS & STRATTON |
| `machine_model`         | table   | Modèles + années (`year_from` / `year_to`)                   |
| `product_compatibility` | table   | N-N pièce ↔ modèle, avec `source` et `rule`                  |
| `category.source`       | colonne | `rule` / `legacy` / `manual` / `supplier` (§4.1 règle n°7)   |
| `product.type`          | colonne | `part` / `machine` / `consumable` / `service`                |
| `product_type_idx`      | index   | Filtre pièces/machines sur 1,3 M de lignes                   |

**La migration est purement additive** : 3 `CREATE TABLE`, 2 `ADD COLUMN` avec valeur par
défaut, 7 index. **Aucun `DROP`, aucune suppression de données.** Les colonnes ajoutées ont
un défaut (`'legacy'`, `'part'`), donc les lignes existantes restent valides.

#### Deux choix de conception

**`machine_brand` est distincte de `brand`.** `brand` est la marque qui _fabrique la pièce_,
`machine_brand` celle de _l'engin sur lequel elle se monte_. Une pièce KRAMP peut équiper une
machine ISEKI ; les confondre rendrait le sélecteur « Ma machine » inexploitable.

**`product.type` est une colonne, pas une branche.** À la source, la séparation par l'arbre
n'est pas fiable — la branche « Électroportatif » contient 92 % de pièces (§3.4). Une colonne
ne peut pas dériver au fil des reclassements, et évite de parcourir l'arbre à chaque filtre.

#### ⚠️ Avant d'appliquer — point de vigilance production

`CREATE INDEX "product_type_idx" ON "product"` s'exécute sur **1,3 M de lignes** et **verrouille
la table en écriture** pendant sa construction (quelques dizaines de secondes à quelques minutes
selon la charge). Le site ne pourra plus écrire de commande pendant ce temps.

Deux options :

1. **Appliquer en heures creuses** — `bun run db:migrate`, simple, avec une courte coupure.
2. **Index concurrent** — remplacer la ligne 49 de la migration par
   `CREATE INDEX CONCURRENTLY "product_type_idx" ON "product" USING btree ("type");`
   exécutée **hors transaction**. Pas de verrou d'écriture, mais plus lent et à jouer à part.

Recommandation : option 1 en heures creuses. C'est la seule instruction coûteuse du lot ; tout
le reste est instantané (tables vides, `ADD COLUMN` avec défaut est un changement de métadonnées
en PostgreSQL 11+).

**Commande, quand vous déciderez de l'appliquer :**

```bash
bun run db:migrate        # applique 0007 sur DATABASE_URL
```

### 6.5 Étape 7 — Reclassification (écrite, non exécutée)

Trois fichiers :

| Fichier                  | Rôle                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `taxonomy.ts`            | **Les règles** — 284 mots-clés, 241 catégories. Données pures, éditables sans toucher au code |
| `tasks/08-taxonomy.ts`   | Crée l'arbre cible en base (`source = 'rule'`)                                                |
| `tasks/09-reclassify.ts` | Range les produits par règle sur le premier mot                                               |
| `taxonomy.spec.ts`       | 12 tests verrouillant unicité, normalisation et mapping FR/EN                                 |

#### Séparer les règles du moteur

`taxonomy.ts` ne contient **que des données**. Ajouter un mot-clé oublié au palier 4 =
une ligne à éditer, aucun code à relire. C'est ce qui rend le palier 4 (§5.3) tenable
dans la durée.

#### Les quatre paliers, dans cet ordre

```
1. Obsolètes   REMPLACÉ* → is_active = false, jamais rangés      ~18 800
2. Bruit       préfixes d'import (HIGH, PLUS, (C)…) → À classer
3. Règles      premier mot → feuille de l'arbre                  ~752 000
4. Reliquat    tout le reste → À classer                         ~302 000
```

L'ordre est ce qui fait la correction : sans le palier 1 d'abord, un produit
`REMPLACÉ PAR 703961` finirait rangé sur un mot de sa suite.

#### Le rapport avant écriture

`--dry-run` produit le compte-rendu exigé au §6 étape 7 — volume et échantillon par
feuille — **sans écrire une seule ligne** :

```bash
bun run migrate:ps -- --only=taxonomy,reclassify --dry-run
```

```
    51 791   6.9%  Pièces détachées > Visserie & boulonnerie > Vis > Vis à métaux
              ex. VIS M8X40 · VIS TETE HEX · VIS AUTOTARAUDEUSE
    33 118   4.4%  Pièces détachées > Joints & étanchéité > Joints > Joints plats
              ex. JOINT SPI · JOINT TORIQUE · JOINT DE CULASSE
```

C'est ce rapport qu'il faut valider avant de relancer sans `--dry-run`.

#### Trois garde-fous dans le code

1. **Unicité des mots-clés.** `assertNoDuplicateKeywords()` échoue au démarrage si deux
   feuilles réclament le même mot — sinon le rangement dépendrait de l'ordre de parcours,
   donc changerait d'une exécution à l'autre.
2. **Normalisation de la ponctuation.** `firstWord()` retire les `,` et `.` finaux laissés
   par la troncature à ~30 caractères (`HOSE,` → `HOSE`). ~62 000 produits en dépendent.
3. **Bruit et règles disjoints.** Un test vérifie qu'aucun mot de `NOISE_WORDS` n'est aussi
   un mot-clé. _Il a effectivement attrapé un conflit à l'écriture_ : `ENS` était dans les
   deux listes, la règle l'aurait emporté en silence et la liste de bruit aurait menti.

#### Écarts assumés par rapport au §5.3

- **`ELEC.` (3 163)** est rangé dans un nœud d'attente `Composants électriques divers` :
  l'abréviation dit que c'est électrique, pas quel composant. À affiner au palier 4.
- **`AIR` (1 223)** est classé comme bruit : filtre à air, vérin pneumatique ou
  refroidissement — le mot ne tranche pas.

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

### 6.6 Révision du 2026-08-08 — un seul arbre, propre, et zéro marque-catégorie

#### Le défaut trouvé

Les étapes 4 et 7 avaient été écrites séparément, et **coexistaient sans se connaître**.
Le pipeline complet enchaînait :

```
categories          →  importe les 5 948 nœuds source VERBATIM   (arbre sale)
products            →  category_id = un nœud de l'arbre sale
product-categories  →  1 062 387 liaisons N-N vers l'arbre sale
taxonomy            →  crée l'arbre propre des pièces            (arbre propre)
reclassify          →  range les pièces dans l'arbre propre
```

Résultat : **les deux arbres cohabitaient dans `category`**. Le nettoyage était bien
construit, puis contourné. Concrètement, `EGO POWER+` (363 produits, 25 sous-nœuds
dupliquant TONDEUSES / TRONCONNEUSES / TAILLE-HAIES), `OUTILS WOLF`, `Roulement FAG`,
`Pieces MAKITA - DOLMAR` étaient **réimportés comme catégories**, avec les 1 513 « Vues
éclatées » vides, les 481 nœuds KRAMP et les 93 % de catégories vides.

Trois défauts aggravants, tous silencieux :

| #   | Défaut                                                                                                                              | Conséquence                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | `10-product-taxonomy` n'était **jamais appelée** — absente d'`index.ts`                                                             | Le filtrage des nœuds-marques ne tournait pas du tout           |
| 2   | `09-reclassify` incrémentait `skipped`, **jamais déclaré**                                                                          | `ReferenceError` au premier produit — la tâche ne pouvait finir |
| 3   | `reclassify` lisait `category.source = 'legacy'` pour épargner les produits finis, mais c'est `02-categories` qui posait ce `source` | Une tondeuse serait partie dans « Coupe & usure »               |

#### Ce qui a été corrigé

**Un seul arbre.** `categories` (import verbatim) **sort de la migration complète**. Elle
reste jouable par `--only=categories` pour analyse, mais n'alimente plus la cible. L'arbre
cible est désormais construit exclusivement par `taxonomy` (pièces, par règles) et
`product-taxonomy` (produits, repris de la source **hors nœuds-marques**).

**Nouvel ordre d'exécution**, l'ordre étant ici ce qui fait la correction :

```
brands
products            →  category_id = NULL, on conserve legacy_category_ps_id
media, variants
taxonomy            →  arbre des pièces          (source='rule')
product-taxonomy    →  arbre produits SANS marques (source='legacy') + range les produits finis
product-categories  →  liaisons N-N, résolues UNIQUEMENT vers les nœuds retenus
reclassify          →  range les pièces par règles, en épargnant les produits déjà rangés
verify
```

**Nouvelle colonne `product.legacy_category_ps_id`** (migration `0008`, purement additive :
1 `ADD COLUMN` + 1 index). Les produits sont importés avant que l'arbre propre n'existe ;
cette colonne conserve l'`id_category_default` source pour que les tâches de taxonomie
attribuent `category_id` **sur l'arbre propre**, sans retourner interroger PrestaShop.

**Redirection des nœuds-marques.** Un produit rangé sous `EGO POWER+ > TONDEUSES` n'est pas
perdu : il remonte au premier ancêtre conservé, donc sous `Motoculture > Tondeuses` — le
vrai nœud, celui qui portait déjà 272 produits. La marque reste dans `product.brand_id`
(99,7 % de couverture), qui est l'axe de navigation par marque.

**Les liaisons N-N filtrent d'elles-mêmes.** `product-categories` joint sur `legacy_ps_id` ;
comme seuls les nœuds retenus existent désormais en cible, les liaisons vers un nœud écarté
(marque, KRAMP, Vues éclatées, branche « Pièces détachées ») ne se résolvent plus. L'écart
n'est plus un avertissement mais le nettoyage attendu — le message a été reformulé en
conséquence.

#### Reste à faire

- **Étape 5 (purge)** et **étape 6 (import)** : toujours non exécutées, comme demandé.
- La migration `0008` est **générée, non appliquée** (comme `0007`).
- Le point ouvert n°1 du §9 (KRAMP fondu ou catalogue séparé) reste ouvert ; le pipeline
  actuel le fond dans le tri commun, conformément à la décision du 2026-08-07.

---

## 7. Contrôles de recette

| #   | Contrôle                               | Seuil attendu                       |
| --- | -------------------------------------- | ----------------------------------- |
| 1   | Produits importés vs source            | ≥ 99,9 % de 1 053 957               |
| 2   | Produits sans catégorie                | **< 1 %** (vs 81 % aujourd'hui)     |
| 3   | Produits dans un fourre-tout           | **0**                               |
| 4   | Catégories vides visibles              | **0**                               |
| 5   | Profondeur de l'arbre                  | **≤ 5** (4 pièces / 5 produits)     |
| 6   | Nombre de catégories                   | ~578 (vs 5 940), hors nœuds-marques |
| 7   | Marques rattachées                     | ≥ 99 %                              |
| 8   | Liaisons N-N `product_category`        | > 1 M (vs 1)                        |
| 9   | Médias rattachés                       | cohérent avec 568 712 images source |
| 10  | Obsolètes `REMPLACÉ` désactivés + liés | ~18 750                             |
| 11  | **Aucune marque en catégorie**         | **0** nœud de `brand-nodes.ts` en base |

Le contrôle n°11 vérifie la règle n°1 du §4.1 directement en base — c'est le défaut
trouvé le 2026-08-08 (§6.6), où le code de filtrage était juste mais ne tournait pas :

```sql
-- doit renvoyer 0 ligne
SELECT id, name, legacy_ps_id FROM category
 WHERE legacy_ps_id IN (518,519,3833,3848,298,319,4127,520,3708,3719,3720,3721,3722,3723);
```

---

## 8. Journal des décisions et mesures

| Date       | Sujet                                | Décision / mesure                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-07 | Analyse source                       | Source = MariaDB `prod5` via tunnel SSH, en lecture seule stricte                                                                                                                                                                                                                                                                                        |
| 2026-08-07 | **Base cible**                       | **`DATABASE_URL` / sakura (base projet msshopv2)** — c'est là qu'on purge, qu'on ajoute les tables et qu'on importe. Migration **directe** `prod5` → `DATABASE_URL`, sans intermédiaire. _(Décision client, corrige une erreur de la v1 de ce document qui proposait d'abandonner la mauvaise base.)_                                                    |
| 2026-08-07 | `metro`                              | Hors périmètre : ni lue ni écrite par le nouveau service. Vérifié serveur distinct de sakura (`system_identifier` différents), 87 tables en français vs 21 en anglais. Scripts existants qui en dépendent → à remplacer                                                                                                                                  |
| 2026-08-07 | Cause des orphelins                  | Bug de migration (double mapping + N-N non migrée), pas un défaut de données source                                                                                                                                                                                                                                                                      |
| 2026-08-07 | Fourre-tout                          | 838 987 produits sans autre catégorie → reclassification par règles obligatoire                                                                                                                                                                                                                                                                          |
| 2026-08-07 | Stratégie                            | Repartir de la source + réorganiser pendant l'import (décision client)                                                                                                                                                                                                                                                                                   |
| 2026-08-07 | Sauvegarde (étape 0)                 | **Écartée** pour l'instant : `metro` constitue déjà une copie amont des mêmes données, et la source `prod5` reste intacte (décision client). L'étape 0 n'est donc plus bloquante pour l'étape 5                                                                                                                                                          |
| 2026-08-07 | **Étape 4 livrée**                   | Service `scripts/migrations/prestashop/` — 8 tâches, CLI, 34 tests. Écrit et vérifié statiquement, **jamais exécuté contre les bases** à ce stade                                                                                                                                                                                                        |
| 2026-08-07 | Garde-fou source                     | Renforcé : `SELECT … INTO OUTFILE/DUMPFILE` écrit un fichier sur le serveur source tout en passant les filtres « commence par SELECT » et « pas de mot-clé d'écriture ». Contrôle dédié ajouté + 15 tests                                                                                                                                                |
| 2026-08-07 | Bugs de curseur                      | Deux pertes silencieuses corrigées avant toute exécution : clé qualifiée illisible (boucle infinie sur `products`/`media`) et clé non unique (liaisons N-N perdues en bord de page). Couverts par `source-cursor.spec.ts`                                                                                                                                |
| 2026-08-07 | Images / R2                          | R2 pas encore en place : on importe les **URL reconstruites** de l'ancien site + l'`id_image` source dans `product_media.legacy_ps_id`. La reprise vers R2 se fera depuis la table cible, sans retour à PrestaShop (décision client)                                                                                                                     |
| 2026-08-07 | Purge                                | Retirée de la migration complète : jouable uniquement par `--only=purge`, pour qu'un lancement par défaut ne puisse jamais détruire le catalogue                                                                                                                                                                                                         |
| 2026-08-07 | **KRAMP**                            | **Ses 481 catégories ne sont pas importées** (décision client). Ses 169 006 produits repartent dans le tri commun. Silo confirmé : 965 produits seulement partagés avec « Pièces détachées ». Ses libellés restent exploités comme **signal** de reclassification                                                                                        |
| 2026-08-07 | Chiffres §3.4 corrigés               | Comptage récursif (nested set) : KRAMP 169 006 (et non 64 125), Électroportatif 21 731 (et non 3 639), Pièces détachées 855 443. La v1 ne comptait que les rattachements directs                                                                                                                                                                         |
| 2026-08-07 | Séparation pièces / produits         | **Non fiable à la source** : la branche « Électroportatif » contient 92 % de pièces (Pieces MAKITA 14 214 + Accessoires 5 862). Le catalogue réel est à **99,7 % des pièces** (~1 046 000) pour ~3 200 machines                                                                                                                                          |
| 2026-08-07 | **Étape 1 exécutée**                 | 265 mots-clés FR+EN → 19 familles → **68,1 % du catalogue classé** (717 323 produits). Tri automatique validé. Voir §5.4                                                                                                                                                                                                                                 |
| 2026-08-07 | Arbre cible ~~3 niveaux~~            | 2 racines (PIÈCES / PRODUITS), ~90 catégories, 3 niveaux — contre 5 948 sur 12. Voir §6.2. **En attente de validation client**                                                                                                                                                                                                                           |
| 2026-08-07 | `product_type`                       | Colonne à ajouter sur `product` (`part` / `machine` / `consumable`) pour que la séparation ne dépende plus du rangement dans l'arbre. À intégrer à l'étape 3                                                                                                                                                                                             |
| 2026-08-07 | **Profondeur de l'arbre révisée**    | La limite « 3 niveaux » est abandonnée au profit de **4 niveaux (pièces) / 5 (produits)**, ~612 catégories. Mesure : hors axe compatibilité, l'arbre source a 648 catégories non vides réparties sur 5 niveaux (119 / 248 / 281) — c'est de l'information métier, pas du bruit. Le bruit venait des niveaux 6-11, tous issus de la compatibilité machine |
| 2026-08-07 | Taxonomie produits                   | **Reprise telle quelle de la source** (372 catégories) : `Motoculture > Tondeuses > Tondeuses tractées`, `> Tracteurs tondeuse > … à rayon de braquage zéro`. La v1 à 3 niveaux l'écrasait et remettait tondeuses, tronçonneuses et taille-haies en vrac (constat client)                                                                                |
| 2026-08-07 | Taxonomie pièces                     | **Créée par règles** sur 4 niveaux (238 catégories) : `Pièces > Famille > Sous-famille > Type`. La source n'en a aucune d'exploitable — 838 987 produits n'ont que le fourre-tout                                                                                                                                                                        |
| 2026-08-07 | Features PrestaShop                  | 52 features / 49 446 produits — trop peu couvrantes pour l'arbre, mais **retenues comme facettes** : `Diam. Intérieur` (1 030 valeurs), `Diam. Extérieur` (1 151), `Épaisseur` (418), `Profil` (17)                                                                                                                                                      |
| 2026-08-07 | Compatibilité confirmée dans l'arbre | Le niveau 3 sous « Pièces détachées » est constitué de **marques de machines** (BRIGGS STRATTON 13 189, ISEKI 520, HUSQVARNA 179) : à extraire vers `machine_brand` / `machine_model`, pas à ranger                                                                                                                                                      |
| 2026-08-07 | **Arbre validé**                     | L'arborescence du §6.3 (612 catégories, 4-5 niveaux) est **validée par le client**. Les deux points ⚠️ (`Kits & ensembles`, `Outillage à main`) restent ouverts et n'ont pas bloqué la validation                                                                                                                                                        |
| 2026-08-07 | **Étape 3 écrite**                   | `compatibility.schema.ts` + 2 colonnes (`category.source`, `product.type`) → migration `0007_marvelous_shotgun.sql`. **Générée, non appliquée.** Purement additive : aucun DROP                                                                                                                                                                          |
| 2026-08-07 | **Étape 7 écrite**                   | `taxonomy.ts` (284 mots-clés, 241 catégories) + tâches `taxonomy` et `reclassify` + 12 tests. **Non exécutées.** Rapport par règle disponible en `--dry-run`                                                                                                                                                                                             |
| 2026-08-07 | `machine_brand` ≠ `brand`            | Deux tables distinctes : `brand` = fabricant de la pièce, `machine_brand` = marque de l'engin. Une pièce KRAMP équipe une machine ISEKI — les confondre casserait le sélecteur « Ma machine »                                                                                                                                                            |
| 2026-08-07 | Conflit bruit/règle                  | Le test « bruit et règles disjoints » a attrapé `ENS`, présent dans les deux listes. Tranché : `ENS.` et `ELEC.` sont des signaux métier (rangés), `AIR` reste du bruit (trop ambigu)                                                                                                                                                                    |
| 2026-08-08 | **Marques ≠ catégories**             | Constat client : `EGO POWER+` et consorts sont des **marques**, pas des catégories. Le pipeline les réimportait pourtant — `02-categories` chargeait les 5 948 nœuds source verbatim **en plus** de l'arbre propre, et `04-product-categories` y rerattachait les produits. Les deux arbres cohabitaient. Voir §6.6                                       |
| 2026-08-08 | **`categories` hors pipeline**       | L'import verbatim de l'arbre source sort de la migration complète (reste jouable en `--only=categories` pour analyse). L'arbre cible est construit **uniquement** par `taxonomy` (pièces) + `product-taxonomy` (produits, hors nœuds-marques) — un seul arbre en base                                                                                    |
| 2026-08-08 | 3 défauts bloquants corrigés         | (1) `10-product-taxonomy` n'était jamais appelée, absente d'`index.ts` — le filtrage des marques ne tournait pas ; (2) `09-reclassify` incrémentait `skipped` non déclaré → `ReferenceError` au 1er produit ; (3) `reclassify` s'appuyait sur `source='legacy'` que seule `02-categories` posait → les tondeuses seraient parties dans « Coupe & usure » |
| 2026-08-08 | Ordre d'exécution                    | `product-taxonomy` **avant** `product-categories` **avant** `reclassify`. C'est l'ordre qui fait la correction : `reclassify` épargne les produits déjà rangés côté machines, ce qui suppose qu'ils l'aient été                                                                                                                                          |
| 2026-08-08 | `product.legacy_category_ps_id`      | Nouvelle colonne (migration `0008`, additive) : les produits sont importés avant l'arbre propre, `category_id` reste NULL et l'`id_category_default` source est conservé pour que les tâches de taxonomie résolvent le rangement sans retourner sur PrestaShop                                                                                           |
| 2026-08-08 | Sort des produits sous une marque    | Remontés au premier ancêtre conservé : `EGO POWER+ > TONDEUSES` → `Motoculture > Tondeuses` (le vrai nœud, 272 produits). La marque reste dans `product.brand_id`, axe de navigation à part entière                                                                                                                                                     |
| 2026-08-07 | ⚠️ Index sur 1,3 M de lignes         | `CREATE INDEX product_type_idx` verrouille `product` en écriture pendant sa construction. À appliquer **en heures creuses**, ou en `CREATE INDEX CONCURRENTLY` hors transaction (§6.4)                                                                                                                                                                   |

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
