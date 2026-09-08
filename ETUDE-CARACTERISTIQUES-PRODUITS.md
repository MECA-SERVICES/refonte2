# Étude — Exploitation des caractéristiques produits

> Objectif : rendre filtrable le maximum de produits du catalogue à partir des
> informations déjà présentes en base. Document vivant, mis à jour à chaque
> découverte.
>
> Dernière mise à jour : 8 septembre 2026

---

## 1. Situation de départ

Le catalogue compte **987 181 produits actifs**. Le script d'extraction
(`bun run specs:extract`) a produit **925 035 caractéristiques** pour
**202 979 produits**, soit **20,6 % du catalogue**.

Le constat initial était que les tondeuses et tracteurs n'apparaissaient pas
dans les filtres. La première analyse concluait à une absence de données
(« 655 955 produits sans description »). **Cette conclusion était fausse** :
elle ne portait que sur le champ `description`.

---

## 2. Découverte principale : le champ `short_description`

Le produit possède **deux champs textuels**. Le script n'en lisait qu'un.

| Champ | Produits renseignés |
|---|---:|
| `description` | 331 226 |
| **`short_description`** | **791 811** |
| Aucun des deux | 72 091 |

Le champ `short_description` (`catalog.schema.ts:154`) contient les mêmes
tableaux HTML de couples « libellé / valeur » que `description`.

| Mesure | Produits |
|---|---:|
| `short_description` contenant un `<table>` | 689 727 |
| dont **sans aucune caractéristique aujourd'hui** | **555 149** |

### Rendement mesuré

Test de `extractSpecs()` **sans aucune modification** sur un échantillon
aléatoire de 4 000 produits non couverts :

| Indicateur | Résultat |
|---|---:|
| Extraction techniquement réussie | 3 968 (**99,2 %**) |
| Avec au moins une caractéristique **utile** (hors bruit) | 2 056 (**51,4 %**) |
| Caractéristiques utiles par produit | 4,1 |

L'extracteur actuel est donc directement compatible : il suffit de lui donner
le second champ à lire.

### Impact projeté

| | Produits | Couverture |
|---|---:|---:|
| Aujourd'hui | 202 979 | 20,6 % |
| **Après reprise des deux champs** | **758 339** | **76,8 %** |
| Hors de portée (aucun tableau nulle part) | 228 842 | 23,2 % |

**Gain : ×3,7 sur le nombre de produits filtrables.**

---

## 3. Qualité : distinguer la donnée du bruit

Tous les libellés n'ont pas de valeur comme critère de filtrage. Deux dominent
largement le champ `short_description` sans rien apporter au client :

| Libellé | Fréquence | Verdict |
|---|---:|---|
| `Vendu à/au` | 83,9 % · 19 valeurs pour 202 447 produits | **À exclure** — ne discrimine rien |
| `Référence` | 83,4 % · quasi unique par produit | **À exclure** — déjà affichée sur la fiche |
| `Description de l'article` | 7,0 % | À exclure — texte libre |
| `Arrondir les quantités` | 3,0 % | À exclure — logistique interne |
| `Conditionnement`, `Quantité par emballage` | 3,3 % | À exclure — logistique |

C'est l'écart entre 99,2 % d'extraction et 51,4 % de rendement utile.

À l'inverse, les libellés à réelle valeur de navigation :

`Poids à vide` (14,2 %) · `Longueur` (8,2 %) · `Hauteur` (5,3 %) ·
`Largeur` (3,5 %) · `Type` (3,6 %) · `Matière` / `Matériau` (4,9 %) ·
`Diamètre intérieur` / `extérieur` (4,7 %) · `Norme DIN` (2,7 %) ·
`Température de service min./max.` (3,4 %)

Ces libellés sont **majoritairement numériques**, donc exploitables en filtres
par plage (« longueur entre 200 et 400 mm ») et non seulement en valeur exacte.

---

## 4. Le cas des machines : résolu

> **Correction du 8 septembre.** La section ci-dessous concluait à tort que les
> machines étaient hors de portée. L'examen du HTML brut d'une tondeuse a
> montré l'inverse.

### Le déclencheur

La tondeuse `ANO-CC256TV` affichait en description un texte apparemment illisible :

```
MOTEURMA173CYLINDRÉE173 CCPUISSANCE5 HP - 3,6 KWLARGEUR COUPE56 CM…
```

Ce n'était pas du texte libre, mais **un tableau parfaitement structuré**, rendu
sans ses balises. Le HTML réel :

```html
<table class="product-properties-table">
  <tr><td class="property-key">MOTEUR</td><td class="property-value">MA173</td></tr>
  <tr><td class="property-key">CYLINDRÉE</td><td class="property-value">173 CC</td></tr>
```

Il était dans `short_description` — le champ que le script ne lisait pas. Les
10 caractéristiques sortent aujourd'hui correctement, valeurs numériques et
unités isolées (`Largeur de coupe = 56 CM`, num=56).

### Les caractéristiques des machines

**232 produits** portent ce format `product-properties-table`, avec exactement
les critères d'achat d'une machine — et un taux numérique très élevé :

| Libellé | Produits | % numérique |
|---|---:|---:|
| Puissance | 158 | 97 % |
| Poids | 157 | 100 % |
| Cylindrée | 98 | 99 % |
| Tension | 54 | 100 % |
| Débit | 29 | 100 % |
| Réservoir | 27 | 100 % |
| Hauteur de coupe | 22 | 50 % |

### Deux corrections nécessaires

1. **Casse** — 441 des 446 libellés arrivent en `MAJUSCULES`, dont 23 déjà
   présents en base sous une autre casse : sans normalisation, chaque
   caractéristique se dédoublait en deux facettes. `fixCase()` rétablit une
   casse lisible en préservant les sigles courts (`RPM`, `CC`).
2. **Variantes** — `LARGEUR COUPE`, `LARGEUR DE COUPE` et `Ø COUPE` désignent la
   même grandeur. `NAME_ALIASES` les regroupe, sans quoi chaque variante restait
   sous le seuil d'affichage.

### Mesure d'origine (avant correction)

Mesure sur la catégorie 272 (*Tracteurs tondeuses avec ramassage*), celle du
produit `ANO-TC102HB` signalé :

| | Produits |
|---|---:|
| Total actifs | 67 |
| Avec caractéristiques | 7 |
| Tableau dans `description` | 7 |
| **Tableau dans `short_description`** | **1** |

Les machines complètes sont décrites en **texte rédigé**, pas en tableau —
contrairement aux pièces détachées, qui viennent de flux fournisseurs
structurés. Deux populations, deux traitements.

### Le 4e format

Format identifié : paragraphes Bootstrap avec couples séparés par `<br>`.

```html
<p class="card-text">Largeur de coupe : 112 cm à 2 lames<br /><br />
Hauteur de coupe : 7 de 30 à 100 mm<br />…</p>
```

**1 208 produits** sont concernés (mesure nette, hors produits déjà couverts
par un tableau). Volume faible, mais population à forte valeur : ce sont les
machines, sur lesquelles le client choisit précisément par largeur de coupe,
cylindrée ou puissance.

### Effet de seuil sur l'affichage

Les facettes n'apparaissent qu'à partir de **5 produits** partageant un libellé
(`shopSpecFacets`, `minProducts = 5`). Avec 7 produits documentés sur 67, aucun
critère n'atteint le seuil dans cette catégorie — d'où l'absence totale de
changement visible, même pour les produits correctement extraits.

---

## 4 bis. Focus tondeuses : le format texte

Après reprise des tableaux, 60 des 67 tracteurs tondeuses restaient sans
caractéristique. L'hypothèse « fiches vides » a été vérifiée — elle était fausse.

### Ces fiches sont richement documentées

Exemple, `TONDEUSE AUTOPORTÉE BALLIA MHHE2 | ETESIA` :

```html
<p>Moteur : HONDA GXV390<br />Cylindrée : 389 cc<br />
Réservoir carburant : 12 litres<br />Poids : 230 kg<br />
Largeur de coupe : 80 cm<br />Hauteur de coupe : de 44 à 102 mm</p>
```

Aucun tableau, mais **12 caractéristiques** parfaitement lisibles, séparées par
des `<br>`. Le format est propre : `Libellé : Valeur`, un couple par ligne.

### Portée mesurée

Sur les produits sans caractéristique disposant encore de texte :

| Mesure | Produits |
|---|---:|
| Sans spec mais avec du texte | 7 052 |
| Motif « Libellé : Valeur » présent | 2 610 |
| **≥ 3 couples (vraie fiche technique)** | **1 071 (15,2 %)** |
| ≥ 5 couples | 765 (10,8 %) |
| Couples par fiche | **8,2** |

Libellés dominants : `poids` (315), `cylindrée` (304), `moteur` (249),
`largeur de coupe` (235), `hauteur de coupe` (186), `puissance nette` (133).
Ce sont exactement les critères d'achat d'une machine.

### Garde-fous retenus

Le texte libre est moins fiable qu'un tableau ; trois règles évitent les faux
positifs :

1. **`MIN_TEXT_PAIRS = 3`** — une prose commerciale contient parfois un couple
   isolé (« Garantie : 3 ans »). En exiger trois écarte le texte rédigé.
2. **`MAX_NAME_WORDS = 5`** — un libellé de caractéristique est court ; au-delà,
   c'est une phrase terminée par deux-points.
3. **Dernier recours uniquement** — le repli ne s'active que si aucun tableau
   n'a rien donné.

Contrôle sur une fiche à dominante commerciale (`MKHP5 100% ÉLECTRIQUE`) :
7 caractéristiques réelles extraites, aucun faux positif.

### Format écarté : Iseki

```html
<strong>Cylindrée, cm3 656 / 2 cylindres</strong><br />
<strong>Capacité du réservoir, l 10</strong>
```

Aucun séparateur entre libellé et valeur — leur frontière n'est devinable qu'au
passage au chiffre. Trop ambigu pour être fiable, et bien plus rare que le
format à deux-points. Écarté volontairement.

---

## 4 ter. Normalisation des valeurs

Une fois les caractéristiques extraites, un défaut restait visible dans les
filtres : `51 cm` et `51 CM` apparaissaient comme deux valeurs distinctes,
chacune sous le seuil d'affichage.

**117 373 lignes** étaient concernées — bien au-delà des seules unités.

Trois familles ont été distinguées, une règle unique aurait dégradé les données :

| Famille | Traitement | Exemple |
|---|---|---|
| **Unités** | Minuscules, **sauf symbole normatif** | `51 CM` → `51 cm` · `20V` → `20 V` · `3,6 KW` → `3,6 kW` |
| **Mots isolés** | Capitale initiale | `ACIER` / `acier` → `Acier` |
| **Sigles** | Forme canonique imposée | `pvc` → `PVC` · `n/a` reste `n/a` |

Le volt s'écrit `V`, le kilowatt `kW` : les minusculiser aurait nui à la
lisibilité. `UNITS` est donc une table de correspondance, pas un simple
`toLowerCase()`.

Les valeurs où la casse porte du sens sont préservées : `SAE 30`, `M6`,
`V-Twin`, `12.9`, `AISI 316L`, `1/4 Inch`. Vérifié sur 16 cas de test.

### Limites assumées

- `166cm3` — unité collée au nombre, hors du motif reconnu.
- `25 - 75 MM (7 POSITIONS)` — la valeur contient du texte libre.
- `HONDA GCV160 4 temps OHC` vs `Honda GCV160…` — les expressions de plusieurs
  mots ne sont pas capitalisées : le risque d'abîmer une référence dépasse le
  gain.

---

## 5. Sources écartées

- **Tables PrestaShop `product_feature` / `product_attribute`** : absentes de la
  base. Les caractéristiques n'ont pas été reprises lors de la migration ; le
  HTML des descriptions est la seule source.
- **228 842 produits sans aucun tableau** : hors de portée d'un script. Relève
  d'une saisie ou d'une reprise de flux fournisseur.

---

## 6. Plan d'action

| # | Action | Gain | État |
|---|---|---:|---|
| **1** | Lire `short_description` en plus de `description` | **+555 149 produits** | ✅ Fait |
| **2** | Exclure les libellés de bruit | 204 528 lignes purgées | ✅ Fait |
| **3** | Normaliser la casse + regrouper les variantes | Machines filtrables | ✅ Fait |
| **4** | Seuil `minProducts` adaptatif | Visibilité tondeuses | ✅ Fait |
| **5** | Repli texte « Libellé : Valeur » | **+1 071 fiches machines** | ✅ Fait |
| **6** | Normalisation de la casse des valeurs | 117 373 lignes | ✅ Fait |

### Détail des modifications

- `scripts/lib/product-specs.ts` — `extractSpecs()` accepte plusieurs sources ;
  ajout de `fixCase()`, `NAME_ALIASES` et des libellés de bruit dans
  `IGNORED_NAMES`.
- `scripts/extract-product-specs.ts` — requêtes élargies aux deux champs.
- `src/lib/server/shop.ts` — `shopSpecFacets()` abaisse le seuil à 2 sous
  300 produits dans le périmètre (`smallCatalogScope()`), au lieu de 5 partout.

Le script reste rejouable (`ON CONFLICT … DO UPDATE`) : une nouvelle exécution
met à jour les lignes au lieu de les dupliquer.

### Résultat final mesuré

| | Produits | Couverture |
|---|---:|---:|
| Avant | 202 979 | 20,6 % |
| **Après** | **395 636** | **40,1 %** |

**1 857 491 caractéristiques**, 4,7 par produit, 11 087 libellés distincts.
764 302 produits examinés, aucun incident réseau.

L'écart avec la projection initiale de 76,8 % s'explique : celle-ci comptait
tout produit portant un tableau, y compris ceux dont le tableau ne contenait que
du bruit (`Vendu à/au`, `Référence`) désormais écarté. 40,1 % correspond aux
produits ayant au moins une caractéristique **réellement filtrable**.

---

## 7. Journal

**8 septembre 2026 — Analyse initiale (conclusion erronée)**
Diagnostic limité au champ `description` : « 655 955 produits sans description,
hors de portée ». Le second champ textuel n'avait pas été examiné.

**8 septembre 2026 — Découverte de `short_description`**
Le champ porte des tableaux exploitables pour 689 727 produits, dont 555 149
sans aucune caractéristique. Rendement utile mesuré à 51,4 % sur échantillon.
Couverture projetée : 20,6 % → 76,8 %.

**8 septembre 2026 — Séparation des deux problèmes**
Confirmation que le gisement `short_description` couvre les pièces détachées,
pas les machines (1 produit sur 67 en catégorie 272). Le cas des tondeuses
relève du 4e format et du seuil d'affichage.

**8 septembre 2026 — Le cas machines résolu (correction)**
L'examen du HTML brut de `ANO-CC256TV` a infirmé la conclusion précédente : les
machines ont bien un tableau structuré (`product-properties-table`), dans
`short_description`. Deux obstacles restaient, tous deux corrigés : la casse
tout en majuscules (441 libellés sur 446) qui dédoublait les facettes, et les
variantes de libellé (`LARGEUR COUPE` / `Ø COUPE`) qui les dispersaient sous le
seuil d'affichage.

**8 septembre 2026 — Application**
Purge de 204 528 lignes de bruit, seuil de facette rendu adaptatif, extraction
complète relancée sur les 758 339 produits atteignables.

**8 septembre 2026 — Résultat de l'extraction (tableaux)**
758 339 produits examinés, 120 067 exploitables, **720 502 caractéristiques**
écrites, 4 818 libellés distincts.

**8 septembre 2026 — Focus tondeuses : le repli texte**
Les fiches machines sans tableau ne sont pas vides : elles énumèrent leurs
caractéristiques en `<br>`. Ajout de `extractTextPairs()` avec trois garde-fous
contre les faux positifs. Gain : 1 071 fiches à 8,2 caractéristiques.
Format Iseki (sans séparateur) écarté comme trop ambigu.

**8 septembre 2026 — Extraction complète réussie**
764 302 produits examinés, 395 636 exploitables, **1 857 301 caractéristiques**,
11 087 libellés. Aucun incident. Couverture portée de 20,6 % à **40,1 %**.

**8 septembre 2026 — Deux défauts d'exécution corrigés**
La passe précédente avait fait chuter la couverture à 12,2 % : le `SELECT` ne
ramenait pas `short_description` (le second argument d'`extractSpecs` arrivait
vide), et la connexion tombait en `ETIMEDOUT` à mi-parcours sans que le code de
sortie du shell le signale. Ajout de `withRetry()` et d'une connexion sans
expiration d'inactivité.

**8 septembre 2026 — Cache trompeur sur les facettes**
Les filtres tondeuses restaient invisibles alors que la base contenait les
données : le cache mémoire (10 min) servait un résultat calculé avant
l'extraction. Vérifier une facette impose de contrôler la page servie, pas
seulement la base.

**8 septembre 2026 — Normalisation de la casse des valeurs**
117 373 lignes concernées. Trois familles traitées séparément (unités, mots
isolés, sigles), en préservant les symboles normatifs (`V`, `kW`, `Ah`, `dB`).

**8 septembre 2026 — Incident de normalisation de casse**
Un script de reprise de casse comportait un `DELETE` non conditionné au succès
du `UPDATE` : 19 102 lignes en majuscules supprimées au lieu d'être renommées.
Sans conséquence — le script d'extraction est rejouable et les régénère avec la
casse correcte. À retenir : conditionner toute suppression au résultat effectif
de la mise à jour.
