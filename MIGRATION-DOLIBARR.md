# Remplacement de Dolibarr par MSShop

**Objectif :** reprendre dans MSShop les fonctions de Dolibarr que Meca Services utilise, migrer leurs données, puis arrêter Dolibarr.

**État des lieux du 27/10/2026.** Il a été fait en lecture seule sur la base `doli_bdd1` (Dolibarr 13.0.5), via le tunnel de PrestaShop.

- La base `dolibarr_bdd1` (Dolibarr 12, « JEROME DAVY », 3 factures, dernière en 2023) est une ancienne instance. Elle est à archiver, pas à migrer.
- Le code du module sur mesure **UTILE** n'a pas encore été lu : son accès SSH n'est pas autorisé. Ses règles sont déduites des données et des menus.

---

## 0. Principe : un seul système

La refonte doit aboutir à **un système unifié**. Aucune fonction de Dolibarr ne doit être recopiée à côté, avec ses propres produits ou ses propres clients. Chaque fonction se branche sur les objets qui existent déjà dans MSShop :

| Dolibarr                                    | Devient dans MSShop                                                                 | Lien                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Produit (`llx_product`)                     | **`product`** existant                                                              | Rapprochement par référence, puis EAN, puis référence sans séparateurs. Les produits absents sont créés dans `product`, sans catalogue à part. |
| Service de main-d'œuvre (`MO-T1`, `MO-T3`…) | **`product`**, avec un nouveau type `service`                                       | Même fiche, même TVA, même code comptable (demandes 2.1 et 3.1)                                                                                |
| Stock par emplacement (UTILE)               | **Stock du produit**, réparti par emplacement                                       | `product.stock` = somme de ses emplacements. La boutique affiche ce stock.                                                                     |
| Bon d'entrée / bon de sortie                | **`stock_movement`** (nouveaux types : réception, déplacement)                      | Une seule source pour l'historique du stock : boutique, atelier et magasin                                                                     |
| Sortie pour une réparation                  | **Pièce d'un ordre de réparation**                                                  | Existe déjà : `repair` dans `stock_movement`                                                                                                   |
| Numéro de série                             | Lié au **produit**, puis à l'**ordre de réparation** et au **parc machines** (12.7) | Une machine vendue reste suivie jusqu'au SAV                                                                                                   |
| Tiers (`llx_societe`)                       | **`customer`** existant                                                             | Rapprochement par e-mail ou SIRET. Les clients du comptoir sans e-mail deviennent des clients sans compte web.                                 |
| Facture comptoir                            | **Facture MSShop** : même numérotation et même PDF que les factures boutique        | Liée au client, à l'ordre de réparation ou à la commande, et à ses règlements (`settlement`)                                                   |
| Paiement, remise en banque                  | **`settlement`, `remittance`**                                                      | Existent déjà                                                                                                                                  |
| Devis                                       | **Devis MSShop**, converti en commande, en ordre de réparation ou en facture        | Mêmes produits, mêmes clients                                                                                                                  |
| Inventaire                                  | **Campagne d'inventaire** sur les produits et les emplacements de MSShop            | L'écart validé crée des mouvements d'ajustement                                                                                                |
| Code comptable                              | Sur le **produit** ou sa **catégorie**, avec un code par défaut par taux de TVA     | Les exports pour le comptable lisent les factures de MSShop : boutique et comptoir ensemble                                                    |

### Raccordement mesuré le 27/10/2026

- **Produits.** 3 959 produits Dolibarr comptent vraiment (en stock, déjà facturés, ou entrés et sortis depuis 2025). Ils se rattachent ainsi à MSShop :
  - **3 241** par référence exacte ;
  - **66** par EAN ;
  - **58** par référence sans tirets ni espaces ;
  - **594 n'existent pas dans MSShop** : 444 sont en stock et 186 ont été facturés. Ce sont surtout des pièces créées dans Dolibarr et jamais publiées sur PrestaShop. Exemple : les références Oregon `ORE-111084E`, alors que MSShop compte 5 130 produits Oregon.

  Ces 594 seront **créés dans `product`**, avec une visibilité en boutique à décider.

- **Les 883 000 autres produits Dolibarr** sont des fiches du catalogue fournisseur, jamais utilisées. Ils ne sont pas repris.
- **Clients.** 423 tiers ont au moins une facture :
  - **19** seulement se retrouvent dans MSShop par e-mail ou SIRET ;
  - **183** n'ont ni e-mail ni SIRET : ce sont les clients du comptoir.
  - Or `customer.email` est obligatoire aujourd'hui. Il faut donc prévoir le **client sans compte web**, sans e-mail obligatoire et sans connexion possible.

---

## 1. Ce qui sert vraiment

Mesuré sur les données : volumes totaux, puis activité en 2026.

| Fonction Dolibarr                                                                                                                          | Volume                                                  | En 2026                             | Usage              |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------- | ------------------ |
| **Sorties de stock** (UTILE, « bons de sortie »)                                                                                           | 148 928 lignes                                          | 827, dernière le 23/10              | **Quotidien**      |
| **Entrées de stock** (UTILE, « bons de livraison » fournisseur)                                                                            | 15 794                                                  | 780, dernière le 23/10              | **Quotidien**      |
| **Stock par emplacement** : 375 emplacements (Magasin, Atelier, Grenier, magasin pièces détachées par partie et par étagère)               | 2 860 produits, 23 342 unités, 287 emplacements occupés | —                                   | **Quotidien**      |
| **Types de stock 1 / 2 / 3** (UTILE)                                                                                                       | 2 557 / 330 / 105 produits                              | —                                   | ⚠ Sens à confirmer |
| **Inventaire annuel** (UTILE) : campagnes 2021 à 2025, comptage par emplacement, prix d'achat, numéros de série, comparaison avec le stock | ~2 000 lignes par an, 721 numéros de série              | Inventaire 2025 : du 24/09 au 01/12 | **Annuel**         |
| **Factures comptoir** : main-d'œuvre (`MO-T1`, `MO-T3`, `MO-AFFUT-CHAINE`…) et pièces                                                      | 1 383 factures                                          | 217 (130 844 € TTC)                 | **Hebdomadaire**   |
| **Paiements et banque**                                                                                                                    | 1 293 paiements, 1 332 écritures                        | 203 / 209                           | Hebdomadaire       |
| **Bordereaux de remise** de chèques                                                                                                        | 90                                                      | 13                                  | Mensuel            |
| **Devis**                                                                                                                                  | 354                                                     | 23, dernier le 13/10                | Mensuel            |
| **Congés** des salariés                                                                                                                    | 167 demandes, 17 salariés                               | 34, dernier le 26/10                | Mensuel            |
| **Documents** (PDF des factures et devis)                                                                                                  | 2 341 fichiers, dont 1 600 factures et 531 devis        | 314                                 | Automatique        |
| **Codes comptables** sur les produits                                                                                                      | 887 004 produits sur 887 016 ont un code de vente       | —                                   | Demande 2.1        |
| **Immobilisations** (UTILE)                                                                                                                | 81                                                      | Dernière en 2023                    | Rare               |
| **Étiquettes** (UTILE)                                                                                                                     | —                                                       | ?                                   | À confirmer        |

**Utilisateurs actifs :** J.DAVY, ABEL.H, asnormandie, Sarah-asnormandie, CLARA2025, STOCK-PIECE.

**Inutilisé ou abandonné**, donc à ne pas reprendre :

- **interventions** : la dernière date de 11/2024, elles sont remplacées par les ordres de réparation de MSShop ;
- agenda (arrêté en 2022), tickets (vides) ;
- commandes et propositions fournisseurs (1 et 4 en 2021) ;
- écritures comptables (aucune) ;
- mouvements de stock natifs de Dolibarr (aucun : UTILE les remplace) ;
- **« MAJ BDD »** (la synchronisation des produits PrestaShop vers Dolibarr) : elle disparaît avec Dolibarr.

---

## 2. Ce que MSShop sait déjà faire

| Besoin                                     | MSShop aujourd'hui                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Stock d'un produit                         | `product.stock`, avec un historique `stock_movement` (types : entrée, sortie, ajustement, commande, retour, réparation) |
| Emplacement                                | Un champ `product.stock_location`, **vide sur tous les produits**                                                       |
| Règlements, remises en banque              | ✅ `settlement` et `remittance` (demandes 1.1 et 1.2), avec des références au format de Dolibarr (`CHK2610-0001`)       |
| Réparations                                | ✅ Ordres de réparation : ils remplacent les interventions                                                              |
| Factures                                   | Seulement pour les commandes de la boutique (`order_invoice`)                                                           |
| Devis, congés, inventaire, immobilisations | ❌                                                                                                                      |

**Écart de stock entre les deux outils**, mesuré le 27/10/2026 :

- **Dolibarr :** 2 860 produits en stock. **2 319** sont retrouvés dans MSShop par leur référence ; **541 ne le sont pas**.
- **Produits retrouvés :** 1 955 ont le même stock, **364 diffèrent**.
- **MSShop :** 4 621 produits en stock, repris de PrestaShop.

---

## 3. Plan proposé, par ordre de priorité

### Phase 0 — Fondations : `fait` le 27/10/2026, sur `dev`, sans commit

- **Migration `drizzle/0047_fondations_dolibarr.sql`**, appliquée en production. Elle est additive : aucune donnée existante n'est modifiée.
  - **Client sans compte web :** `customer.user_id` et `customer.email` deviennent facultatifs.
  - **Traçabilité :** colonnes `legacy_doli_id` sur `customer` et `product`, avec un index unique.
  - **Tables `stock_location` et `product_stock`.**
  - **Sur `stock_movement` :** l'emplacement (`location_id`) et la pièce justificative (`reference`), plus le type `transfer`.
- **Produit `service`** : le type existait déjà. Il est documenté pour la main-d'œuvre Dolibarr, qui sera créée inactive, donc absente de la boutique.
- **Client sans compte web** dans le back-office : case « Client sans compte web » sur la fiche « Nouveau client » et dans la création rapide d'un ordre de réparation. Un badge le signale sur la fiche client.
- **Emplacements :**
  - **375 emplacements importés** de Dolibarr par `bun run migrate:doli -- --only=locations`. L'import se relance sans créer de doublon.
  - Le parent est retrouvé par le chemin complet, car `fk_parent` est faux sur 233 emplacements. On obtient 10 racines, comme dans Dolibarr.
  - Écran **Catalogue › Emplacements de stock** (`/admin/stock-locations`) : arbre, ajout, renommage, activation.
- **Reste dans les fondations :**
  - le champ texte libre `product.stock_location` (vide partout) sera remplacé par le stock par emplacement en phase 1 ;
  - l'écran « Main d'œuvre » (3.1) viendra avec la facturation.

### Phase 1 — Stock physique (quotidien, bloquant pour arrêter Dolibarr)

- **Emplacements :** reprise de l'arborescence des 375 emplacements de Dolibarr (magasin › partie › étagère). Gestion dans Paramètres › Emplacements de stock (28/10/2026) : code d'étiquette unique (index `stock_location_code_idx`, migration 0048), suppression réservée aux emplacements vides, sans historique ni sous-emplacement et créés dans MSShop ; les autres se désactivent tant que Dolibarr sert.
- **Stock par emplacement**, avec le total du produit calculé à partir de ses emplacements. CDC 16, § 5.
- **Écrans :**
  - **Réception** : saisie rapide par référence ou EAN, quantité, emplacement et n° de BL fournisseur ; **fait le 28/10/2026** (`/admin/stock/vouchers/receipts` : bon d'entrée multi-lignes, état, numéros de série, pièces qui « repartent » aussitôt par un bon « Sortie-auto du BL » comme UTILE, étiquettes du bon, annulation par contrepassation). Historique repris : tâche `vouchers` (`utile_bon_livraison`, `utile_bon_sortie`, sans emplacement) ;
  - **Sortie** : motifs « normal », « consommable », « investissement » ; **fait le 28/10/2026** (`/admin/stock/vouchers/issues`, bon de sortie depuis l'emplacement et l'état choisis). Les immobilisations créées par une sortie « Investissement » dans UTILE ne sont pas reprises ;
  - **Déplacement** entre emplacements : **fait le 28/10/2026** (cases à cocher, sélection conservée pendant la navigation, relecture avant validation, quantité partielle ; deux mouvements `transfer` par ligne, `product.stock` inchangé). Un produit déplacé dans MSShop n'est plus écrasé par la reprise Dolibarr ;
  - **Consultation** du stock par emplacement : **fait le 28/10/2026** (`/admin/stock-locations` : arbre, contenu avec photos, « où est rangé ce produit ? », sélecteur d'emplacement `LocationPicker` réutilisable, bloc « Rangement » sur la fiche produit).
- **Un seul stock, celui de Dolibarr (décidé le 28/10/2026).** `product.stock` est la somme des emplacements et ne se saisit plus nulle part. L'alignement initial a mis 2 853 stocks boutique à la valeur Dolibarr, dont 2 434 produits sans emplacement passés à 0 (liste : `reports/stock/`). Tout mouvement passe par un emplacement (`recordStockMovement`).
- **Aucune sortie automatique (décidé le 28/10/2026).** Ni la commande ni l'ordre de réparation ne touchent le stock : le magasinier sort chaque article depuis la commande ou l'ordre (« Sortir du stock », emplacement au choix), comme les bons de sortie UTILE. Les mouvements portent le n° du document.
- **Repris du code UTILE** (lu en lecture seule le 28/10/2026) : description des emplacements (`llx_entrepot.lieu`, au survol du code), codes couleur des écrans de stock (`DOLIBARR_STOCK_COLORS`), étiquettes produit 62 × 32 mm (`/admin/products/labels`). Décidé le 28/10/2026 : logo MSShop, nom, référence et EAN-13, sans prix ; le prix TTC n'est imprimé que pour un produit rangé dans un emplacement de vente (`price_on_label`, le MAGASIN). Les modèles Occasion / Garantie d'UTILE ne sont pas repris. Types de stock UTILE : 1 Neuf, 2 Occasion, 3 Garantie.
- **États, numéros de série, inventaire (28/10/2026, code prêt, reprise à lancer).**
  - Le stock d'un emplacement se répartit par état (`product_stock.condition` : neuf / occasion / garantie, repris de `utile_type_stock`) ; entrées, sorties, déplacements et inventaires portent l'état (migration 0051).
  - Numéros de série en stock : `stock_serial` (repris de `llx_product_batch`) ; une ligne ne compte jamais plus de numéros que de pièces, une sortie de pièce numérotée demande son numéro.
  - Inventaire annuel : `/admin/inventories` — campagne, comptage par emplacement (EAN à la douchette, référence ou nom ; quantité, état, n° de série, note ; prix d'achat figé), écarts avec le stock, export CSV pour le comptable, validation par mouvements d'ajustement (portée : tout le stock comme UTILE, ou seulement les emplacements comptés). Les 5 campagnes UTILE (2021-2025) sont reprises en lecture seule.
  - Produits : tâche `products` — rattachement par référence, EAN, référence compacte, puis numéro de pièce sans préfixe de marque si les noms concordent (64) ; les produits n'existant que dans Dolibarr (475, créés dans Dolibarr ou importés du catalogue fournisseur, jamais sur le site) sont créés hors boutique dans « À classer », prix TTC de Dolibarr. Liste de contrôle : `reports/dolibarr/`.
- **Reprise des données :**
  - stock et emplacements de Dolibarr : **photo reprise le 28/10/2026** (`migrate:doli -- --only=stock`, rejouable) : 3 089 quantités sur 2 630 produits rattachés (référence 2 543, EAN 48, référence compacte 39) ; 455 lignes en stock sans produit MSShop. `product.stock` n'est pas encore modifié : 419 produits ont un stock boutique différent de leur rangement ;
  - rapprochement des 541 références absentes de MSShop ;
  - arbitrage des 364 écarts.

  À la bascule, **Dolibarr fait foi**.

### Phase 2 — Facturation au comptoir

**Fait le 29/10/2026 (code prêt, reprise à lancer).** `/admin/invoices` : facture comptoir et avoir (brouillon → validation → règlements → payée ; avoir pour corriger ; abandon motivé), lignes produit, prestation (`MO-T1`… en produits `service`) ou libre, prix saisis TTC, remise, TVA par ligne ; PDF ; règlements via `settlement` (bordereaux de remise compris) ; sortie de stock depuis la facture ; « Facturer » depuis un ordre de réparation. Numérotation : la série Dolibarr continue (`FA2611-1316`, `AV2611-0033`, séquences Postgres, migration 0054). Reprise : tâches `customers` (423 tiers facturés, 404 créés sans compte web) et `invoices` (1 385 factures, avoirs et acomptes, lignes, 1 355 règlements avec émetteur et banque du chèque), puis `remittances` (90 bordereaux de remise de chèques, 2021-2026, 810 règlements rangés dessus ; ils gardent leur numéro `CHK2610-0090` et la série continue à `…-0091` ; non supprimables). Correctif du 29/10/2026 : les dates DATE de Dolibarr (`datef`) étaient reprises la veille (`isoDay`). Codes comptables repris sur les produits ; l'export comptable (2.2) reste à faire. ⚠ Pas de facture comptoir dans MSShop avant la bascule : les deux logiciels prendraient les mêmes numéros.

- **Facture directe** (comptoir ou ordre de réparation) :
  - client ;
  - lignes de pièces et de main-d'œuvre (demande 3.1) ;
  - TVA ;
  - PDF ;
  - règlements (ceux de 1.1 sont réutilisés).
- **Codes comptables** sur les produits et les services (demande 2.1), repris de Dolibarr.
- **Numérotation :** continuer la série `FA` de Dolibarr, ou ouvrir une nouvelle série. La numérotation doit rester continue et chronologique : c'est une obligation légale.
- **Export** des ventes par code comptable et par taux de TVA (demande 2.2).

### Phase 3 — Devis

**Fait le 29/10/2026 (code prêt, reprise à lancer).** `/admin/quotes` (CDC 23, côté back-office) : brouillon → envoi (numéro `PR2611-0322` dans la série Dolibarr, date limite = date + validité, 15 jours par défaut ; figé, R5) → décision du client enregistrée par l'équipe (accepté, refusé ; « expiré » se déduit de la date limite, R4) → « Créer la facture » : brouillon de facture comptoir avec toutes les lignes (R10, une seule fois, R11). « Dupliquer » pour corriger un devis envoyé. PDF sur la charte des factures, avec cadre « Bon pour accord » ; note interne jamais imprimée (R13). Mêmes lignes, même éditeur et même PDF que les factures (`DocumentLines`, `document-pdf.ts`). Devis listés sur la fiche client. Migration 0056.

Reprise : tâche `quotes` (354 devis, 1 894 lignes ; 122 liés à leur facture, la première quand il y en a plusieurs). Les 115 tiers chiffrés jamais facturés sont créés par `customers` ; les produits des devis sont rattachés (68 de plus par référence), jamais créés : une ligne sans produit MSShop garde sa référence.

Reste du CDC 23, hors remplacement de Dolibarr : demande de devis par le client, « Mes devis » dans l'espace client, envoi par e-mail, conversion en commande boutique. La signature électronique (6.2) viendra plus tard.

### Fournisseurs (CDC 11)

**Fait le 29/10/2026 (code prêt, reprise à lancer).** Catalogue › Fournisseurs (`/admin/suppliers`) : fiche (coordonnées, SIRET, notes internes, archivage ; suppression seulement sans produit, R5) et produits approvisionnés, par pages. Onglet Prix de la fiche produit : « Approvisionnement », plusieurs fournisseurs par produit avec référence, prix d'achat HT, délai et quantité minimale (R1) ; le principal (`product.supplier_id`, R2) alimente le prix d'achat et la référence fournisseur de la fiche (R3). Réception : le fournisseur se choisit dans la liste. Migration 0057 (`supplier`, `supplier_product`, clé étrangère sur `product.supplier_id`, qui portait l'id PrestaShop brut, et sur `stock_voucher.supplier_id`).

Reprise, dans cet ordre :
1. `migrate:ps -- --only=suppliers` : 30 fournisseurs PrestaShop, 1 082 408 conditions (`ps_product_supplier`, prix d'achat sur 800 000), fournisseur principal des 1 053 954 produits (`ps_product.id_supplier`). PrestaShop fait foi jusqu'à la bascule : la tâche se rejoue.
2. `migrate:doli -- --only=suppliers` : les 51 tiers fournisseurs Dolibarr complètent les 15 fiches communes (table `SAME_AS_PS`) ou sont créés ; 69 prix d'achat ; le fournisseur des bons de réception UTILE d'après le texte saisi (`RECEIPT_SUPPLIERS`) ; un produit sans fournisseur principal prend celui de sa dernière réception.

Reste du CDC 11 : l'aide au réapprovisionnement (§ 5.4, ruptures regroupées par fournisseur).

### Phase 4 — Inventaire annuel

- **Campagne d'inventaire :** comptage par emplacement (à la douchette si possible), numéros de série, prix d'achat.
- **Écarts** avec le stock, puis validation, qui crée des mouvements d'ajustement.
- **Export comptable** valorisé, limité aux produits neufs et actifs (demande 2.4).
- ⚠ **Calendrier :** l'inventaire 2025 s'est fait de septembre à décembre. **Celui de 2026 tombe maintenant** : il sera sans doute fait dans Dolibarr, sauf si la phase 1 et cette phase sont prêtes à temps.

### Phase 5 — Archives et reprise historique

- **PDF de Dolibarr** (1 600 factures, 531 devis), sur le stockage R2.
  - **Pourquoi :** une facture se conserve **10 ans**.
  - **Où :** consultables depuis la fiche client.
- **Historique** des factures, paiements, devis et inventaires : en lecture seule.
- **Tiers : fait le 29/10/2026 (reprise à lancer).** La tâche `customers` couvre tous les tiers sauf les fournisseurs seuls (9 677) : 8 549 se rattachent par e-mail ou SIRET au client MSShop venu de PrestaShop, 559 sont créés sans compte web, 61 doublons Dolibarr sans activité sont ignorés.
- **Contacts : fait le 29/10/2026 (reprise à lancer).** `llx_socpeople` (147) → `contact`, rattaché au fournisseur (100) ou au client ; bloc « Contacts » sur les fiches client et fournisseur. Migration 0058.
- **Bascule finale :**
  1. geler Dolibarr ;
  2. faire la dernière reprise du stock ;
  3. archiver la base ;
  4. arrêter Dolibarr.

### En option, selon la réponse de Jérôme

- **Congés :** les intégrer à MSShop, ou passer à un outil RH dédié. Ce n'est pas du commerce.
- **Immobilisations** (81) : une simple liste, ou rien du tout. La saisie est arrêtée depuis 2023.
- **Étiquettes** de produits et d'emplacements, avec code-barres.

---

## 4. Questions à poser à Jérôme et Davy

1. **Types de stock 1, 2 et 3 :** que signifient-ils ? Neuf, occasion, SAV ou garantie ? C'est lié à l'inventaire « neufs uniquement » (2.4).
2. **Emplacements :** faut-il garder les 375 emplacements actuels ? Un produit peut-il être à plusieurs endroits ?
3. **Facturation :** continuer la série `FA2610-…`, ou démarrer une nouvelle série dans MSShop ?
4. **Comptable :** quel format d'export attend-il ? FEC, CSV par code, autre ?
5. **Inventaire 2026 :** le faire dans Dolibarr cette année, ou attendre l'outil de MSShop ?
6. **Congés, immobilisations, étiquettes :** à reprendre ou non ?
7. **Date d'arrêt de Dolibarr souhaitée :** avant ou après la mise en ligne de MSShop ?

---

## 5. Accès et règles

- **Base Dolibarr :** même tunnel SSH et même compte MySQL que PrestaShop (`scripts/migrations/prestashop/source-db.ts`). Préfixer les tables par la base `doli_bdd1`.
- **Lecture seule absolue :**
  - le compte MySQL a les droits d'écriture ; seul le garde-fou du code (`assertReadOnly`) l'empêche ;
  - même règle que pour PrestaShop : on n'écrit jamais dans Dolibarr.
- **Code du module UTILE** (`/utile/dep/stock/*.php`, `/utile/dep/inventaire/*.php`…) : le lire permettrait de reproduire ses règles exactes. Cela demande d'autoriser la lecture des fichiers du serveur par SSH.
