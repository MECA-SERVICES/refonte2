# Fichiers de Dolibarr dans MSShop

Dernière étape de la reprise de Dolibarr : ses fichiers. MSShop n'a pas encore de
stockage de fichiers ; ce document décrit ce qu'il faut reprendre, où le ranger et
dans quel ordre. Rien n'est encore fait.

## 1. Ce que contient Dolibarr

Relevé du 30/10/2026 dans `llx_ecm_files`, l'index des documents de Dolibarr. Les
fichiers eux-mêmes sont sur le serveur, dans le dossier `documents` de Dolibarr.

| Rattachés à                                                 | PDF générés par Dolibarr | Fichiers joints à la main |
| ----------------------------------------------------------- | ------------------------ | ------------------------- |
| Factures                                                    | 1 381                    | 209                       |
| Devis                                                       | 354                      | 162                       |
| Produits                                                    | —                        | 121                       |
| Tiers (clients, fournisseurs)                               | —                        | 24                        |
| Interventions                                               | 4                        | 5                         |
| Banque                                                      | —                        | 22                        |
| Autres (commandes, propositions fournisseurs, utilisateurs) | 7                        | 1                         |

- **PDF générés** : la facture ou le devis tel qu'il a été imprimé et envoyé. Une
  facture se conserve **10 ans** : c'est l'original à garder, même si MSShop sait
  refaire le PDF à partir des données reprises.
- **Fichiers joints** : bons de commande des clients, photos de machines, devis
  fournisseurs, pièces justificatives scannées. Ils n'existent nulle part ailleurs.

## 2. Où les ranger

Recommandé : **Cloudflare R2** (stockage objet compatible S3).

- Quelques centaines de Mo : dans la tranche gratuite de R2 (10 Go).
- Indépendant de l'hébergeur de l'application : on peut changer de serveur sans
  déplacer les fichiers.
- Servira aussi aux futurs fichiers de MSShop : pièces jointes du SAV, photos des
  ordres de réparation, justificatifs.

Autre possibilité : un volume Railway, plus simple, mais lié à Railway et sans
sauvegarde automatique.

**À fournir avant de commencer** (dans `.env`, jamais dans le code) :

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=msshop-documents
```

Le bucket reste **privé** : un fichier ne s'ouvre que depuis le back-office, par un
lien signé de quelques minutes. Rien n'est public.

## 3. Ce qu'on construira dans MSShop

1. **Module de stockage** (`$lib/server/files.ts`) : envoi, lecture par lien signé,
   suppression. Une table `document` : propriétaire (facture, devis, client,
   fournisseur, produit, ordre de réparation), nom, type, taille, origine
   (Dolibarr ou MSShop), date.
2. **Bloc « Fichiers joints »** sur les fiches facture, devis, client, fournisseur,
   produit et ordre de réparation : liste, ouverture, ajout et suppression d'un
   fichier joint à la main. Comme l'onglet « Fichiers joints » de Dolibarr.
3. **PDF d'origine** : sur une facture ou un devis repris, le PDF de Dolibarr
   s'ouvre à côté du PDF recalculé par MSShop.
4. **Tâche de reprise `documents`** (`migrate:doli -- --only=documents`) :
   - lit l'index `llx_ecm_files` (lecture seule, comme le reste de la reprise) ;
   - copie chaque fichier du serveur Dolibarr vers R2, par SSH en **lecture
     seule** ;
   - le rattache à la facture, au devis, au client, au fournisseur ou au produit
     repris (par `legacy_doli_id`) ;
   - se relance sans doublon ; un fichier introuvable sur le disque est listé.

## 4. Accès nécessaire

Lire le dossier `documents` de Dolibarr sur le serveur, par le même accès SSH que
la base, en **lecture seule** (copie, jamais de modification ni de suppression).
À autoriser au moment de lancer la tâche.

## 5. Ordre

1. Créer le bucket R2 et ajouter les clés dans `.env`.
2. Construire le stockage et le bloc « Fichiers joints ».
3. Lancer la reprise des fichiers, puis vérifier quelques factures et devis.
4. À la bascule finale, relancer la tâche pour les fichiers ajoutés entre-temps.
