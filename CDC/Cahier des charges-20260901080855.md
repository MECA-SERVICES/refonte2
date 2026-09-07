# A verifier

# Audit du code source de la refonte

**Les chiffres bruts :**
\- ~200 000 lignes hors tests, **2 984 fichiers** TS, 1 227 fichiers de test (36% du codebase)
\- 317 use-cases, 77 interfaces/ports, 166 adapters, 59 DTOs, 15 containers DI — pour du CRUD e-commerce classique
\- Chaque port n'a qu'un seul adapter → l'architecture hexagonale est du boilerplate pur ici

**Exemple concret** — créer un produit traverse 6 fichiers intermédiaires inutiles :
actions.ts → modules/products/index.ts (façade) → use-case (6 lignes !) → repository adapter → product-queries.ts (le seul vrai code, 1 751 lignes). Le pattern est copié-collé à l'identique dans les 40 modules, même pour des trivialités (DeleteMarqueUseCase = 40 lignes pour un delete).

**Le périmètre fonctionnel :**
\- Checkout Monetico complet (HMAC, webhooks, diagnostic réparation), 172 routes API, 27 sections admin
\- Workflows complexes : réparations multi-étapes (devis → acceptation → paiement diagnostic), retours → avoirs, wallet client, proformas, support chat temps réel
(Redis + SSE), validation comptes pro (SIRET/TVA)

**Features simples** (~90% du périmètre)
Du CRUD pur, refaisable très vite avec server actions + queries directes :
\- Produits, pièces détachées, marques, catégories, fournisseurs, transporteurs
\- Blog, slides, newsletter
\- Clients, adresses, utilisateurs admin
\- Codes promo, statuts de commande
\- La quasi-totalité des 27 sections admin = des listes + formulaires

**Probleme :**
\- ❌ 6 couches pour un CRUD — corriger un bug simple = naviguer dans 6+ fichiers
\- ❌ 317 use-cases, 77 interfaces à 1 seule implémentation, 15 containers DI copiés-collés — chaque nouvelle feature coûte ~15 fichiers de cérémonie
\- ❌ Dual-stack legacy/moderne : un dev ne sait pas quel chemin est le "vrai"
\- ❌ 36% du codebase est des tests, dont beaucoup testent du boilerplate (un use-case de 6 lignes testé unitairement n'apporte rien)
\- ❌ Code mort (Svelte, CLI, src/) qui pollue la recherche et l'onboarding
\- ❌ Nommage BDD incohérent qui force à vérifier le schéma à chaque requête

65 Etats de commande trouver en base de donner

**Sur la refonte pour les migrations des client il ete fait :**
Migration d’un ancien compte
Le client ouvre Migration de compte.
Il saisit l’email utilisé sur l’ancienne plateforme.
Si une correspondance est trouvée, un lien de confirmation est envoyé à cette adresse.
Après confirmation, l’historique de commandes est rattaché à son compte actuel.

Alors que il devrai etre plus convenable que a la premier connexion, on retrouve l'email, et que les donné sois directement migré

# Desing et Charte graphique

Le design du back-office doit correspondre à l'**interface de PrestaShop** afin de faciliter la transition vers un nouvel outil.
Le front-office doit respecter la charte graphique du **site internet d'origine**.

Pour ne pas perturber les utilisateurs, la mise en page peut rester identique à l'existante. Dans le cas contraire, une refonte complète de la mise en page devra être envisagée.

![](https://t9014809028.p.clickup-attachments.com/t9014809028/f0089d69-fe01-4f73-9308-2b57977b873b/image.png)
![](https://t9014809028.p.clickup-attachments.com/t9014809028/e466af85-9710-42af-8ed3-d6f8ce3a5162/Capture%20d%E2%80%99e%CC%81cran%202026-07-23%20a%CC%80%2015.05.16.png)

# Fonctionnalité

# 01 — Authentification & gestion de session

## 1\. Objectif

Permettre à un visiteur de créer un compte, de s'authentifier, de récupérer son mot de passe et de gérer sa session, en distinguant les comptes clients des comptes internes (employé, admin, développeur).

## 2\. Périmètre fonctionnel

- Inscription par email / mot de passe
- Connexion par email / mot de passe
- Connexion via fournisseur externe (Google, Facebook, Apple), avec rattachement au compte existant si l'email correspond
- Vérification d'adresse email par lien à usage unique
- Renvoi du lien de vérification
- Mot de passe oublié / réinitialisation par lien à durée limitée
- Déconnexion (invalidation de session)
- Contrôle d'accès par rôle sur l'ensemble des pages

## 3\. Données manipulées

### Table `user`

| Champ                         | Description                                                        |
| ----------------------------- | ------------------------------------------------------------------ |
| `id`                          | Identifiant du compte                                              |
| `username`                    | Identifiant unique                                                 |
| `email`                       | Email unique, servant d'identifiant de connexion                   |
| `password_hash`               | Empreinte du mot de passe (absent si connexion externe uniquement) |
| `role`                        | `client`, `employe`, `admin`, `developer`                          |
| `email_verified`              | Email confirmé oui/non                                             |
| `client_id`                   | Rattachement à la fiche client commerciale                         |
| `avatar_url`, `name`, `image` | Éléments de profil                                                 |
| `is_active`                   | Compte actif / désactivé                                           |
| `created_at`, `updated_at`    | Horodatages                                                        |

### Table `account`

Comptes d'authentification rattachés à un `user` : identifie le fournisseur (mot de passe local, Google, Facebook) et l'identifiant externe correspondant. Un même utilisateur peut avoir plusieurs comptes liés.

### Table `session`

Sessions actives : utilisateur, date d'expiration, contexte de connexion.

### Table `verification`

Jetons à usage unique pour la vérification d'email et la réinitialisation de mot de passe. Chaque jeton porte une valeur, une cible (email) et une date d'expiration.

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | L'email est unique sur l'ensemble des comptes.                                                                                                                          |
| R2  | Tout compte nouvellement créé se voit attribuer le rôle `client` par défaut.                                                                                            |
| R3  | Un compte créé par email/mot de passe est en attente de vérification d'email.                                                                                           |
| R4  | Un compte créé via fournisseur externe est considéré comme ayant un email vérifié.                                                                                      |
| R5  | Si un utilisateur se connecte via un fournisseur externe avec un email déjà présent en base, le fournisseur est rattaché au compte existant — aucun doublon n'est créé. |
| R6  | Un jeton de vérification ou de réinitialisation est à usage unique et expire après un délai défini.                                                                     |
| R7  | La demande de réinitialisation ne révèle jamais si l'email existe en base (message identique dans les deux cas).                                                        |
| R8  | La déconnexion invalide la session côté serveur, et pas uniquement côté navigateur.                                                                                     |
| R9  | Les rôles internes (`employe`, `admin`, `developer`) ne peuvent pas être obtenus par inscription publique — ils sont attribués exclusivement depuis le back‑office.     |
| R10 | Un compte avec `is_active = 0` ne peut plus se connecter.                                                                                                               |

## 5\. Parcours utilisateur

### 5.1 Inscription

1. Le visiteur ouvre **Inscription**.
2. Il saisit son email, son mot de passe, son nom, son prénom, et choisit son **type de compte** (particulier / professionnel / collectivité).
3. Selon le type choisi, des champs complémentaires sont demandés (voir feature 02).
4. À la validation : le compte est créé, une fiche client lui est associée et un email de vérification est envoyé.
5. Le visiteur est redirigé vers un écran l'invitant à consulter sa boîte mail.
6. Il clique sur le lien reçu → son email est marqué comme vérifié → il est redirigé vers la page de connexion.

**Cas d'erreur** : email déjà utilisé → message explicite invitant à se connecter ou à réinitialiser le mot de passe.

### 5.2 Connexion

1. Le visiteur ouvre **Connexion**.
2. Il saisit son email et son mot de passe, ou choisit « Continuer avec Google / Facebook ».
3. En cas de succès, une session est ouverte et il est redirigé :
   - vers la page demandée initialement, le cas échéant,
   - vers son espace client sinon,
   - vers le back‑office si son rôle est interne.
4. Si son panier visiteur contient des articles, celui‑ci est fusionné avec son panier de compte (voir feature 12).

**Cas d'erreur** : identifiants invalides → message générique, sans préciser lequel des deux champs est incorrect.

### 5.3 Mot de passe oublié

1. Le visiteur ouvre **Mot de passe oublié** et saisit son email.
2. Un message de confirmation neutre s'affiche systématiquement.
3. Si un compte correspondant existe, un email contenant un lien de réinitialisation est envoyé.
4. Le lien ouvre **Réinitialiser mon mot de passe** ; le visiteur saisit le nouveau mot de passe deux fois.
5. Le mot de passe est mis à jour, le jeton est consommé et l'utilisateur est redirigé vers la page de connexion.

**Cas d'erreur** : jeton expiré ou déjà utilisé → message d'erreur avec possibilité de soumettre une nouvelle demande.

### 5.4 Renvoi de l'email de vérification

Depuis l'écran d'attente ou depuis son profil, un utilisateur non vérifié peut demander un nouvel envoi. Le jeton précédent est alors invalidé.

### 5.5 Accès refusé

Tout accès à une page ne correspondant pas au rôle de l'utilisateur entraîne une redirection vers une page **Accès non autorisé**, expliquant la situation et proposant un retour à l'accueil.

## 6\. Écrans

| Écran                                    | Public      |
| ---------------------------------------- | ----------- |
| Inscription                              | Visiteur    |
| Connexion                                | Visiteur    |
| Mot de passe oublié                      | Visiteur    |
| Réinitialiser le mot de passe (via lien) | Visiteur    |
| Vérification d'email (via lien)          | Visiteur    |
| Déconnexion                              | Authentifié |
| Accès non autorisé                       | Tous        |

## 7\. Notifications

| Événement                        | Destinataire | Contenu                          |
| -------------------------------- | ------------ | -------------------------------- |
| Inscription                      | Client       | Bienvenue + lien de vérification |
| Demande de vérification renvoyée | Client       | Nouveau lien de vérification     |
| Demande de réinitialisation      | Client       | Lien de réinitialisation         |
| Mot de passe modifié             | Client       | Confirmation de changement       |

## 8\. Liens avec les autres features

- **02 — Comptes clients** : la validation professionnelle conditionne l'accès à certaines fonctions après connexion.
- **12 — Panier** : fusion du panier visiteur à la connexion.

# 02 — Comptes clients & validation professionnelle

## 1\. Objectif

Gérer la fiche commerciale d'un client, distinguer les trois typologies (particulier, professionnel, collectivité) et encadrer le processus de validation manuelle des comptes non‑particuliers, qui conditionne l'accès aux conditions tarifaires et fiscales spécifiques.

## 2\. Périmètre fonctionnel

- Création d'une fiche client à l'inscription
- Choix du type de compte : particulier / professionnel / collectivité
- Contrôle automatique du numéro SIRET (existence, raison sociale, adresse) auprès du référentiel officiel
- Contrôle automatique du numéro de TVA intracommunautaire (validité européenne)
- Dépôt de justificatif (KBIS ou équivalent)
- File d'attente de validation côté back‑office : acceptation, refus motivé, demande de complément ( pour les compte les pro explicatif pour du volume )
- Suivi du statut de compte côté client
- Note privée interne sur chaque fiche client
- Origine du client (source d'acquisition)
- Ajouter des pieces jointe lié uniquement au clients

## 3\. Données manipulées

### Table `clients`

| Champ                                                           | Description                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `id`                                                            | Identifiant de la fiche client                                                      |
| `user_id`                                                       | Compte d'authentification associé (peut être vide pour un client créé manuellement) |
| `prenom`, `nom`, `email`, `telephone`                           | Identité de contact                                                                 |
| `type_client`                                                   | Typologie historique (`particulier`, `pro`)                                         |
| `account_type`                                                  | `particulier`, `pro`, `collectivite`                                                |
| `account_status`                                                | `pending`, `validated`, `rejected`                                                  |
| `account_status_updated_at`                                     | Date de la dernière décision                                                        |
| `account_rejection_reason`                                      | Motif de refus communiqué                                                           |
| `adresse`, `adresse_complement`, `code_postal`, `ville`, `pays` | Adresse principale                                                                  |
| `siret`                                                         | Numéro SIRET (14 caractères)                                                        |
| `company_name`                                                  | Raison sociale                                                                      |
| `vat_number`                                                    | Numéro de TVA intracommunautaire                                                    |
| `tax_exempt_status`                                             | `standard` ou `exempt_eu_b2b` (autoliquidation)                                     |
| `collectivity_type`, `collectivity_name`                        | Nature et nom de la collectivité                                                    |
| `kbis_document_id`                                              | Justificatif déposé                                                                 |
| `kbis_validated_at`                                             | Date de validation du justificatif                                                  |
| `invoice_format`                                                | `standard` ou `proforma`                                                            |
| `total_achats`                                                  | Cumul du chiffre d'affaires du client                                               |
| `source`                                                        | Origine d'acquisition                                                               |
| `private_note`                                                  | Note interne non visible du client                                                  |
| `date_creation`, `date_ajout`                                   | Horodatages                                                                         |

### Table `account_validation_requests`

| Champ                        | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| `id`                         | Identifiant de la demande                      |
| `client_id`                  | Client concerné                                |
| `request_type`               | `pro` ou `collectivite`                        |
| `status`                     | `pending`, `validated`, `rejected`             |
| `submitted_data`             | Informations déclarées au moment de la demande |
| `reviewed_by`, `reviewed_at` | Auteur et date du traitement                   |
| `review_notes`               | Commentaire interne                            |
| `rejection_reason`           | Motif communiqué au client                     |
| `created_at`, `updated_at`   | Horodatages                                    |

### Table `documents`

Justificatifs déposés, rattachés à une entité (`client`, `product`, `order`, `marque`) : nom d'origine, type, taille, description, déposant.

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Un compte particulier est validé automatiquement à l'inscription (`validated`).                                                                                         |
| R2  | Un compte professionnel ou collectivité est créé en statut `pending` et génère une demande de validation.                                                               |
| R3  | Le SIRET est obligatoire pour un compte professionnel ; il est vérifié auprès du référentiel officiel des entreprises.                                                  |
| R4  | Si le SIRET est reconnu, la raison sociale et l'adresse sont pré‑remplies automatiquement ; l'utilisateur peut les corriger.                                            |
| R5  | Un SIRET inexistant ou une entreprise cessée bloque la soumission avec un message explicite.                                                                            |
| R6  | Le numéro de TVA intracommunautaire, s'il est renseigné, est contrôlé auprès du service européen de validation.                                                         |
| R7  | Un client établi hors de France, dans l'Union européenne, disposant d'un numéro de TVA valide peut être basculé en `exempt_eu_b2b` (autoliquidation — voir feature 17). |
| R8  | Tant que le compte est `pending`, le client peut naviguer et passer commande, mais n'accède pas aux conditions réservées aux professionnels validés.                    |
| R9  | Un refus doit obligatoirement être motivé ; le motif est communiqué au client par email et affiché dans son profil.                                                     |
| R10 | Un compte refusé peut soumettre une nouvelle demande après correction du dossier.                                                                                       |
| R11 | Une collectivité peut être configurée en facturation `proforma` : la commande génère un document proforma avant l'émission de la facture définitive.                    |
| R12 | La `source` du client (origine d'acquisition) est enregistrée à la création et alimente les statistiques (feature 33).                                                  |
| R13 | La note privée n'est jamais exposée dans une interface client ni dans un document transmis.                                                                             |

## 5\. Parcours utilisateur

### 5.1 Inscription d'un professionnel

1. Le visiteur sélectionne **Professionnel** lors de l'inscription.
2. Il saisit son **SIRET**.
3. Le système interroge le référentiel officiel :
   - **Trouvé** → la raison sociale, l'adresse, le code postal et la ville sont pré‑remplis et modifiables.
   - **Non trouvé / cessé** → message d'erreur affiché, soumission bloquée.
4. Il renseigne éventuellement son numéro de TVA intracommunautaire, qui est contrôlé en temps réel.
5. Il dépose son justificatif (KBIS ou équivalent).
6. À la soumission, le compte est créé en statut **En attente de validation** et une demande est ouverte côté back‑office.
7. Il reçoit un email de confirmation de dépôt de dossier.

### 5.2 Inscription d'une collectivité

Identique au parcours professionnel, en remplaçant le SIRET par le type et le nom de la collectivité, accompagné du dépôt du justificatif correspondant.

### 5.3 Suivi côté client

Depuis son profil, le client consulte l'état de sa demande :

- **En attente** : bandeau explicatif indiquant le délai de traitement estimé.
- **Validée** : accès aux conditions professionnelles débloqué.
- **Refusée** : motif affiché et bouton « Soumettre à nouveau » permettant de corriger et de renvoyer le dossier.

### 5.4 Traitement côté back‑office

1. L'administrateur ouvre **Validations de comptes** : liste des demandes filtrable par statut et par type.
2. Il ouvre une demande et consulte : identité du client, informations déclarées, résultat du contrôle SIRET / TVA et justificatif.
3. Trois décisions sont possibles :
   - **Valider** → `account_status` passe à `validated`, la date de validation du justificatif est renseignée, un email de bienvenue professionnel est envoyé.
   - **Refuser** → saisie obligatoire du motif → statut `rejected`, email de refus motivé envoyé au client.
   - **Demander un complément** → la demande reste `pending`, un message précisant les éléments manquants est envoyé au client.
4. Chaque décision est horodatée, associée à son auteur et tracée dans le journal d'audit (feature 34).

## 6\. Écrans

| Écran                                               | Public                           |
| --------------------------------------------------- | -------------------------------- |
| Inscription — étape type de compte                  | Visiteur                         |
| Profil — bandeau de statut du compte                | Client                           |
| Profil — resoumission de dossier                    | Client pro / collectivité refusé |
| Back‑office — liste des validations de comptes      | Admin                            |
| Back‑office — détail d'une demande                  | Admin                            |
| Back‑office — fiche client (consultation / édition) | Admin, Employé                   |

## 7\. Notifications

| Événement                           | Destinataire   | Contenu                                  |
| ----------------------------------- | -------------- | ---------------------------------------- |
| Dépôt de dossier pro / collectivité | Client         | Accusé de réception et délai indicatif   |
| Nouvelle demande de validation      | Administrateur | Alerte de dossier à traiter              |
| Compte validé                       | Client         | Confirmation et accès aux conditions pro |
| Compte refusé                       | Client         | Motif de refus et marche à suivre        |
| Demande de complément               | Client         | Éléments manquants à fournir             |

## 8\. Liens avec les autres features

- **01 — Authentification** : la fiche client est créée simultanément au compte utilisateur.
- **17 — TVA & fiscalité** : le statut d'exonération conditionne le calcul de la TVA applicable.
- **18 — Facturation** : le format de facturation (standard / proforma) est déterminé par la fiche client.
  **33 — Statistiques** : la source d'acquisition alimente le tableau de bord des origines de trafic.

# 03 — Profil client & carnet d'adresses

## 1\. Objectif

Offrir au client un espace personnel centralisant ses informations, ses adresses, son historique d'achats et l'ensemble de ses dossiers en cours (commandes, devis, réparations, retours, cagnotte).

## 2\. Périmètre fonctionnel

- Consultation et modification des informations personnelles
- Changement de mot de passe
- Carnet d'adresses multiple (livraison et facturation)
- Définition d'une adresse par défaut
- Historique des commandes et accès aux documents associés
- Accès aux devis, réparations
- Parc machines personnel
- Gestion de l'abonnement à la newsletter ( historique )

## 3\. Données manipulées

### Table `clients`

Fiche commerciale (voir feature 02) : identité, coordonnées, type de compte, statut, cumul d'achats.

### Table `client_addresses`

| Champ                                                           | Description                                              |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| `id`                                                            | Identifiant de l'adresse                                 |
| `client_id`                                                     | Client propriétaire                                      |
| `label`                                                         | Libellé défini par le client (« Domicile », « Atelier ») |
| `type`                                                          | Livraison, facturation ou les deux                       |
| `prenom`, `nom`, `company_name`                                 | Destinataire                                             |
| `adresse`, `adresse_complement`, `code_postal`, `ville`, `pays` | Adresse postale complète                                 |
| `telephone`                                                     | Contact de livraison                                     |
| `is_default`                                                    | Indique l'adresse proposée par défaut                    |

### Tables consultées en lecture

`orders`, `quotes`, `quote_requests`, `repair_requests`, `repair_orders`, `return_requests`, `wallet_transactions`, `client_machines`, `newsletter_subscribers`.

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Un client ne peut accéder qu'à ses propres données ; toute tentative d'accès à un dossier tiers est refusée.                                                                     |
| R2  | Une seule adresse par défaut peut exister par type ; la désignation d'une nouvelle adresse par défaut retire automatiquement le statut de la précédente.                         |
| R3  | Une adresse associée à une commande passée ne peut pas être supprimée : la commande conserve une copie figée de l'adresse au moment de l'achat.                                  |
| R4  | Toute modification de l'adresse e-mail déclenche une nouvelle procédure de vérification.                                                                                         |
| R5  | Le changement de mot de passe requiert la saisie du mot de passe actuel.                                                                                                         |
| R6  | Le cumul d'achats est recalculé automatiquement à chaque commande payée.                                                                                                         |
| R7  | La migration de compte rapproche le client de l'ancienne plateforme via son adresse e-mail ; en cas de correspondance, l'historique de commandes est rattaché au nouveau compte. |

## 5\. Parcours utilisateur

### 5.1 Accès à l'espace client

1. Le client connecté ouvre **Mon profil**.
2. Il accède à un tableau de bord récapitulatif : informations principales, statut du compte, solde de cagnotte, dernières commandes et dossiers en cours.

### 5.2 Modification des informations personnelles

1. Le client ouvre l'onglet **Mes informations**.
2. Il modifie les champs souhaités : nom, prénom, téléphone, et le cas échéant raison sociale et SIRET selon son type de compte.
3. Il enregistre les modifications ; un message de confirmation s'affiche.
4. En cas de modification de l'adresse e-mail, un e-mail de vérification est envoyé à la nouvelle adresse ; l'ancienne reste active jusqu'à confirmation.

### 5.3 Gestion des adresses

1. Le client ouvre **Mes adresses**.
2. Il consulte la liste de ses adresses avec le libellé, le type et l'indicateur « par défaut ».
3. Il peut **ajouter**, **modifier** ou **supprimer** une adresse, ou la **définir comme adresse par défaut**.
4. Les adresses enregistrées sont proposées automatiquement lors du tunnel de commande.

### 5.4 Consultation de l'historique des commandes

1. Le client ouvre **Mes commandes**.
2. Il consulte la liste de ses commandes : référence, date, montant et statut courant.
3. En ouvrant une commande, il accède au détail des articles, à l'adresse de livraison, au suivi du colis et aux documents disponibles (facture, bon de livraison), selon les autorisations liées au statut.

### 5.5 Migration d'un ancien compte

1. Le client se connecte pour la première fois à la plateforme.
2. La plateforme lui envoie un e-mail de validation de migration.
3. Si une correspondance est trouvée, les données sont automatiquement rattachées à son compte actuel sans étape de confirmation supplémentaire.

## 6\. Écrans

| Écran                            | Public |
| -------------------------------- | ------ |
| Profil — tableau de bord         | Client |
| Profil — mes informations        | Client |
| Profil — mes adresses            | Client |
| Profil — sécurité / mot de passe | Client |
| Profil — migration de compte     | Client |
| Mes commandes (liste et détail)  | Client |
| Mes devis                        | Client |
| Mes réparations                  | Client |
| Mes retours                      | Client |
| Ma cagnotte                      | Client |
| Mon parc machines                | Client |

## 7\. Notifications

| Événement                   | Destinataire              | Contenu                      |
| --------------------------- | ------------------------- | ---------------------------- |
| Changement d'adresse e-mail | Client (nouvelle adresse) | Lien de vérification         |
| Changement de mot de passe  | Client                    | Confirmation de modification |
| Demande de migration        | Client (ancienne adresse) | Lien de confirmation         |

## 8\. Liens avec les autres features

- **02 — Comptes clients** : statut de validation affiché dans le profil.
- **14 — Tunnel de commande** : les adresses enregistrées y sont réutilisées.
- **20 — Cagnotte** : solde et historique consultables depuis le profil.
  **26 — Parc machines** : rattaché au profil.

# 04 — Catalogue produits & fiches produit

## 1\. Objectif

Présenter l'offre commerciale (machines, équipements, accessoires) sous forme de listes filtrables et de fiches détaillées, tout en permettant au back‑office de gérer intégralement ce catalogue.

## 2\. Périmètre fonctionnel

### Côté client

- Liste des produits avec filtres (catégorie, marque, prix, disponibilité) et options de tri
- Pagination des résultats
- Fiche produit détaillée : visuels, description, caractéristiques, prix, disponibilité
- Documents consultable associés au produit (notices, fiches techniques)
- Sélection d'une variante avant achat, les variant son des ref
- Ajout au panier
- Avis clients
- Produits associés / pièces détachées compatibles
- Pieces qui plusieurs fournisseur

### Côté back‑office

- Création, modification, duplication et désactivation d'un produit
- Gestion des visuels et des documents associés
- Prix de vente HT et prix d'achat
- Dimensions et poids (déterminants pour le calcul des frais de port)
- Rattachement à une catégorie, une marque et un fournisseur
- Contraintes de transport spécifiques (transporteur imposé, surcoût, seuil de poids)
- Référencement (slug, méta‑titre, méta‑description)
- Import en masse

## 3\. Données manipulées

### Table `products`

| Champ                                          | Description                                   |
| ---------------------------------------------- | --------------------------------------------- |
| `id`                                           | Identifiant du produit                        |
| `nom`                                          | Désignation commerciale                       |
| `description_courte`                           | Accroche affichée en liste                    |
| `description`                                  | Description longue de la fiche                |
| `prix_ht`                                      | Prix de vente hors taxes                      |
| `prix_achat`                                   | Prix d'achat (usage interne, calcul de marge) |
| `reference`                                    | Référence interne                             |
| `code_barre`                                   | Code‑barres                                   |
| `stock`                                        | Quantité disponible                           |
| `poids`                                        | Poids en kilogrammes                          |
| `longueur_cm`, `largeur_cm`, `hauteur_cm`      | Dimensions du colis                           |
| `actif`                                        | Produit publié ou masqué                      |
| `categorie`, `categorie_id`                    | Rattachement catégorie                        |
| `marque`, `marque_id`                          | Rattachement marque                           |
| `fournisseur`, `supplier_id`                   | Rattachement fournisseur                      |
| `image_url`                                    | Visuel principal                              |
| `shipping_extra_fee_eur`                       | Surcoût de transport spécifique au produit    |
| `forced_carrier_id`, `forced_carrier_offer_id` | Transporteur et offre imposés                 |
| `min_weight_kg_threshold`                      | Poids plancher facturé pour le transport      |
| `slug`, `meta_title`, `meta_description`       | Référencement naturel                         |
| `date_creation`, `date_maj`, `date_ajout`      | Horodatages                                   |

### Table `product_attachments`

Documents joints à un produit ou à une pièce détachée : libellé, nom de fichier, type, taille et ordre d'affichage.

### Table `product_category_assignments`

Rattachement d'un produit à plusieurs catégories simultanément.

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Un produit `actif = 0` n'apparaît ni en liste, ni en recherche, ni en accès direct côté client.                                                          |
| R2  | Les prix sont saisis hors taxes ; le prix TTC affiché est calculé selon le taux de TVA applicable au client (feature 17).                                |
| R3  | Le prix d'achat n'est jamais exposé côté client.                                                                                                         |
| R4  | Un produit sans poids ni dimensions ne peut pas être expédié : le calcul des frais de port échoue et le produit est signalé au back‑office.              |
| R5  | Si un transporteur est imposé sur un produit, il s'applique à toute commande contenant ce produit, quelles que soient les autres options disponibles.    |
| R6  | Le surcoût de transport du produit s'ajoute aux frais de port calculés.                                                                                  |
| R7  | Le seuil de poids plancher remplace le poids réel dans le calcul du transport lorsqu'il lui est supérieur.                                               |
| R8  | Le slug est unique et constitue l'adresse publique de la fiche produit.                                                                                  |
| R9  | Un produit associé à une commande passée ne peut pas être supprimé : la commande conserve une copie figée du nom, de la référence, du visuel et du prix. |
| R10 | Un produit en rupture de stock reste consultable, mais l'ajout au panier est bloqué (voir feature 10).                                                   |

## 5\. Parcours utilisateur

### 5.1 Navigation dans le catalogue (client)

1. Le visiteur ouvre **Produits** depuis le menu principal ou une page de catégorie.
2. La liste affiche les produits actifs : visuel, désignation, prix et disponibilité.
3. Il affine sa recherche avec les filtres : catégorie, marque, fourchette de prix, disponibilité.
4. Il trie les résultats : pertinence, prix croissant / décroissant, nouveautés.
5. Il navigue entre les pages de résultats.

### 5.2 Consultation d'une fiche produit

1. Le visiteur clique sur un produit.
2. La fiche présente : galerie de visuels, désignation, référence, prix TTC et HT, disponibilité, description longue et caractéristiques techniques.
3. Si le produit propose des variantes, il sélectionne la combinaison souhaitée ; le prix, le visuel et la disponibilité se mettent à jour en conséquence.
4. Il choisit une quantité et clique sur **Ajouter au panier**.
5. Une confirmation s'affiche avec un accès direct au panier.
6. Il peut consulter les documents associés (notice, vue éclatée, fiche technique), les avis clients et les pièces détachées compatibles.

**Cas particuliers** :

- Produit en rupture de stock → mention explicite, bouton d'ajout désactivé.
- Produit désactivé ou inexistant → page « Produit introuvable » avec renvoi vers le catalogue.

### 5.3 Création d'un produit (back‑office)

1. L'administrateur ouvre **Produits → Créer**.
2. Il renseigne : désignation, référence, descriptions, prix HT, prix d'achat et stock initial.
3. Il renseigne le poids et les dimensions du colis.
4. Il rattache le produit à une catégorie, une marque et un fournisseur.
5. Il dépose le visuel principal et les visuels secondaires.
6. Il configure, si nécessaire, les contraintes de transport (transporteur imposé, surcoût, poids plancher).
7. Il complète les champs de référencement.
8. Il enregistre : le produit est créé à l'état désactivé ou actif selon son choix.

### 5.4 Modification et retrait

- La modification utilise le même formulaire, pré‑rempli avec les données existantes.
- Le retrait de la vente s'effectue par désactivation, jamais par suppression, afin de préserver l'historique des commandes.

### 5.5 Import en masse

1. L'administrateur ouvre **Produits → Import**.
2. Il dépose un fichier structuré.
3. Un aperçu affiche les lignes reconnues, les créations, les mises à jour et les erreurs détectées.
4. Il confirme l'import ; un rapport est présenté (lignes créées / mises à jour / rejetées avec motif).

## 6\. Écrans

| Écran                                 | Accès          |
| ------------------------------------- | -------------- |
| Liste des produits                    | Public         |
| Fiche produit                         | Public         |
| Back‑office — liste des produits      | Admin, Employé |
| Back‑office — création de produit     | Admin          |
| Back‑office — édition de produit      | Admin          |
| Back‑office — import de produits      | Admin          |
| Back‑office — définitions d'attributs | Admin          |

## 7\. Liens avec les autres features

- **05 — Variantes & attributs** : gestion des déclinaisons d'un produit.
- **06 — Catégories & marques** : classement et navigation dans le catalogue.
- **10 — Stocks** : disponibilité affichée et blocage à l'ajout au panier.
- **15 — Livraison** : poids, dimensions et contraintes produit alimentent le calcul des frais de port.

# 05 — Variantes & attributs produit

Cette feature permet de relier plusieurs produits entre eux afin de représenter les déclinaisons d'un même article (taille, couleur, puissance, longueur de lame…). Chaque déclinaison est un **produit à part entière**, déjà défini avec sa propre référence, son propre prix, son propre poids et son propre stock via sa fiche produit standard. La feature gère uniquement le **lien de rattachement** entre un produit et ses variantes, ainsi que leur affichage et leur sélection sur la fiche.

### 2\. Périmètre fonctionnel

- Lier un ou plusieurs produits existants du catalogue à un produit donné, en tant que variantes de celui-ci.
- Affichage sur la fiche produit : lorsque le client sélectionne une variante, l'affichage bascule vers le produit lié correspondant (référence, prix, visuel, disponibilité).

### 3\. Données manipulées

- Table `product_attribute_definitions` — référentiel des attributs utilisés pour caractériser les variantes (taille, couleur, puissance…).
- Table `product_variant_links` _(remplace_ `product_variants`_)_ — table de liaison référençant deux produits existants (`product_id` et `variant_product_id`), avec la valeur d'attribut associée au lien (ex. « Couleur = Rouge »).

Aucune donnée de prix, de poids ou de stock n'est stockée dans cette table : ces informations restent portées par la fiche produit de chaque variante.

### 4\. Règles de gestion

- Un produit lié en tant que variante demeure un produit du catalogue à part entière, géré selon les règles standard (cf. feature 04 — Catalogue).
- Le lien de rattachement n'a d'impact que sur l'affichage et la navigation entre déclinaisons ; il ne modifie jamais la structure ni les données du produit lui-même.

### 5\. Parcours utilisateur

#### 5.1 Définition du référentiel d'attributs (back-office)

L'administrateur accède à **Produits → Attributs**.
Il crée un attribut en renseignant : libellé, type, liste de valeurs si applicable, caractère obligatoire et ordre d'affichage.
L'attribut devient immédiatement disponible pour l'ensemble des produits du catalogue.

#### 5.2 Rattachement de produits comme variantes (back-office)

L'administrateur ouvre la fiche d'un produit et accède à l'onglet **Variantes**.
Il recherche et sélectionne un ou plusieurs produits existants du catalogue à rattacher comme variantes.
Pour chaque produit rattaché, il renseigne la valeur d'attribut correspondante (ex. « Puissance = 1200W »).
Le prix, le poids et le stock de la variante restent ceux définis sur la fiche du produit rattaché — aucune saisie supplémentaire n'est requise.
Il désigne éventuellement une variante comme celle affichée par défaut.
Il enregistre ; les produits rattachés deviennent sélectionnables depuis la fiche.

#### 5.3 Sélection d'une variante (client)

Le client ouvre la fiche d'un produit disposant de variantes.
La variante par défaut est présélectionnée : le prix, le visuel, la référence et la disponibilité du produit correspondant s'affichent.
Le client ajuste sa sélection attribut par attribut.
À chaque modification, l'affichage bascule vers le produit rattaché correspondant : référence, prix, visuel et stock sont actualisés en conséquence.
Si le produit correspondant à la combinaison sélectionnée est indisponible, l'ajout au panier est bloqué et un message explicite est affiché.
Le client ajoute au panier ; la ligne de panier mémorise le produit précis retenu (sa référence propre).

### 6 Liens avec les autres features

- **04 — Catalogue** : chaque variante est un produit du catalogue à part entière, géré selon les règles standard ; seul le lien de rattachement est spécifique à cette feature.
- **10 — Stocks** : les mouvements de stock sont enregistrés directement au niveau du produit, et non d'une sous-entité variante.
  **12 — Panier et 16 — Commandes** : le produit précis sélectionné (avec sa référence propre) est conservé sur la ligne d'achat, comme pour tout produit standard.

# 06 — Catégories, marques & navigation

## 1\. Objectif

Structurer le catalogue en arborescence de catégories et en marques, afin d'offrir une navigation claire côté client et un classement maîtrisé côté back‑office.

## 2\. Périmètre fonctionnel

- Arborescence de catégories sur plusieurs niveaux
- Rattachement d'un produit à une ou plusieurs catégories
- Fiches marques avec logo et page dédiée
- Menu de navigation alimenté par l'arborescence
- Fil d'Ariane sur les pages catégorie et produit
- Détection et signalement des catégories vides , doublons, doublons images

## 3\. Données manipulées

### Table `categories`

| Champ         | Description                               |
| ------------- | ----------------------------------------- |
| `id`          | Identifiant interne                       |
| `id_category` | Identifiant métier unique de la catégorie |
| `id_parent`   | Catégorie parente (racine si absente)     |
| `nom`         | Libellé affiché                           |
| `level_depth` | Profondeur dans l'arborescence            |
| `actif`       | Catégorie publiée ou masquée              |
| `slug`        | Adresse publique                          |
| `date_ajout`  | Horodatage                                |

### Table `product_category_assignments`

Association produit ↔ catégorie, permettant le rattachement multiple.

### Table `marques`

| Champ                   | Description               |
| ----------------------- | ------------------------- |
| `id`                    | Identifiant de la marque  |
| `nom`                   | Nom de la marque          |
| `image_url`, `image_id` | Logo                      |
| `actif`                 | Marque publiée ou masquée |
| `date_ajout`            | Horodatage                |

### Table `categories_vides`

Suivi des catégories ne contenant aucun produit publié, à des fins de nettoyage du catalogue.

### Table `lm_categories`

Référentiel de catégories externe servant de cible à la classification automatique (feature 35).

## 4\. Règles de gestion

| #   | Règle                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Une catégorie masquée (`actif = 0`) et toute sa descendance sont exclues de la navigation publique.                                             |
| R2  | Une catégorie ne peut pas être son propre parent, ni générer de cycle dans l'arborescence.                                                      |
| R3  | Un produit peut appartenir à plusieurs catégories et apparaît dans chacune d'elles.                                                             |
| R4  | Une page catégorie liste les produits de la catégorie et de ses sous‑catégories.                                                                |
| R5  | Une catégorie contenant des produits ou des sous‑catégories ne peut pas être supprimée : ses éléments doivent d'abord être vidés ou réaffectés. |
| R6  | Une catégorie sans produit publié est signalée dans le back‑office comme catégorie vide.                                                        |
| R7  | Le slug d'une catégorie est unique et constitue son adresse publique.                                                                           |
| R8  | Masquer une marque retire sa page publique ; ses produits restent accessibles via les autres chemins de navigation.                             |
| R9  | Une marque ne peut pas être supprimée si des produits y sont rattachés.                                                                         |

## 5\. Parcours utilisateur

### 5.1 Navigation par catégorie (client)

1. Le visiteur ouvre le menu principal et parcourt l'arborescence.
2. Il sélectionne une catégorie ; la page affiche le libellé, le fil d'Ariane, les sous‑catégories et les produits associés.
3. Il affine sa recherche à l'aide des filtres disponibles (marque, prix, disponibilité).
4. Il clique sur un produit pour accéder à sa fiche.

### 5.2 Navigation par marque (client)

1. Le visiteur ouvre la page **Marques** ou clique sur le logo d'une marque depuis une fiche produit.
2. La page marque présente le logo, une description et les produits de la marque.

### 5.3 Gestion de l'arborescence (back‑office)

1. L'administrateur accède à **Catalogue → Catégories**.
2. Affiche les catégorie avec le nombre de produits par catégorie.
3. Il peut créer une catégorie (libellé, parent, slug, état de publication), la renommer, la déplacer ou la masquer.
4. Les catégories vides sont mises en évidence pour faciliter leur nettoyage.

### 5.4 Gestion des marques (back‑office)

1. L'administrateur accède à **Catalogue → Marques**.
2. Il consulte la liste, crée une marque (nom, logo, état de publication), la modifie ou la masque.
3. La fiche marque indique le nombre de produits rattachés.

## 6\. Écrans

| Écran                                         | Accès  |
| --------------------------------------------- | ------ |
| Page catégorie                                | Public |
| Page marque                                   | Public |
| Menu de navigation                            | Public |
| Back‑office — arborescence des catégories     | Admin  |
| Back‑office — liste des marques               | Admin  |
| Back‑office — création / édition d'une marque | Admin  |

## 7\. Liens avec les autres features

- **04 — Catalogue** : le rattachement des catégories se fait depuis la fiche produit.
- **08 — Recherche** : les catégories et marques servent de facettes de filtrage.
- **13 — Promotions** : une remise peut cibler une catégorie ou une marque spécifique.

# 07 — Pièces détachées & vue éclatée

## 1\. Objectif

Proposer un catalogue dédié de pièces détachées, distinct du catalogue machines, et permettre au client d'identifier visuellement la pièce dont il a besoin à partir d'une vue éclatée de sa machine.
Les documents auront une interface interactive grâce à un service Python connecté à l’application. Les fichiers PDF pourront être déposés et convertis en vues éclatées interactives.

## 2\. Périmètre fonctionnel

### Catalogue pièces détachées

- Liste des pièces avec filtres (catégorie, marque, compatibilité, disponibilité)
- Fiche pièce détaillée avec référence constructeur
- Arborescence de catégories propre aux pièces
- Ajout au panier
- Documents attachés (schémas, notices)

### Vue éclatée

- Consultation du schéma éclaté d'une machine
- Repérage des pièces par numéro sur le plan
- Correspondance numéro de plan ↔ référence de pièce
- Accès direct à la fiche pièce depuis le plan
- Gestion des plans et de leurs repères côté back‑office

## 3\. Données manipulées

### Table `spare_parts`

| Champ                                              | Description                              |
| -------------------------------------------------- | ---------------------------------------- |
| `id`                                               | Identifiant de la pièce                  |
| `nom`                                              | Désignation                              |
| `description_courte`, `description`                | Descriptions courte et longue            |
| `prix_ht`                                          | Prix de vente hors taxes                 |
| `prix_achat`                                       | Prix d'achat (usage interne)             |
| `reference`                                        | Référence constructeur ou interne        |
| `code_barre`                                       | Code‑barres                              |
| `stock`                                            | Quantité disponible                      |
| `poids`, `longueur_cm`, `largeur_cm`, `hauteur_cm` | Caractéristiques d'expédition            |
| `min_weight_kg_threshold`                          | Poids plancher facturé pour le transport |
| `shipping_extra_fee_eur`                           | Surcoût de transport spécifique          |
| `actif`                                            | Pièce publiée ou masquée                 |
| `categorie`, `categorie_id`                        | Catégorie de pièce                       |
| `marque`, `marque_id`                              | Marque                                   |
| `fournisseur`                                      | Fournisseur                              |
| `image_url`                                        | Visuel                                   |
| `date_creation`, `date_maj`, `date_ajout`          | Horodatages                              |

### Table `spare_part_categories`

Arborescence dédiée aux pièces : identifiant métier, parent, libellé, profondeur, état de publication, slug.

### Table `product_attachments`

Documents attachés à une pièce (schéma, plan éclaté, notice).

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Le catalogue des pièces détachées est indépendant du catalogue produits : arborescence, listes et fiches distinctes.                                     |
| R2  | Une pièce avec `actif = 0` est retirée de l'affichage public.                                                                                            |
| R3  | Les prix sont saisis hors taxes ; le prix TTC est calculé selon le taux applicable au client.                                                            |
| R4  | La référence constructeur est un critère de recherche prioritaire : une recherche par référence exacte doit faire remonter la pièce en premier résultat. |
| R5  | Une pièce sans poids ne peut pas faire l'objet d'un calcul de frais de port.                                                                             |
| R6  | Une pièce en rupture de stock reste consultable, mais l'ajout au panier est bloqué.                                                                      |
| R7  | Chaque repère de la vue éclatée doit pointer vers une pièce existante ; tout repère orphelin est signalé au back‑office.                                 |
| R8  | Une pièce peut être référencée par plusieurs vues éclatées (pièce commune à plusieurs machines).                                                         |
| R9  | Pièces détachées et produits partagent le même panier et le même tunnel de commande.                                                                     |

## 5\. Parcours utilisateur

### 5.1 Recherche d'une pièce par le catalogue

1. Le visiteur ouvre **Pièces détachées**.
2. Il parcourt l'arborescence des catégories ou saisit une référence dans la barre de recherche.
3. La liste affiche : visuel, désignation, référence, prix et disponibilité.
4. Il ouvre la fiche : description, référence, compatibilité et documents attachés.
5. Il choisit une quantité et ajoute la pièce au panier.

### 5.2 Recherche d'une pièce par la vue éclatée

1. Le visiteur ouvre **Vue éclatée**.
2. Il sélectionne la marque, puis le modèle de sa machine.
3. Le schéma éclaté s'affiche avec les repères numérotés.
4. Il clique sur un repère : la désignation, la référence, le prix et la disponibilité de la pièce correspondante s'affichent.
5. Il ajoute directement la pièce au panier depuis le plan, ou ouvre sa fiche complète.

**Cas particuliers** :

- Repère sans pièce associée → message « Pièce non référencée, contactez‑nous » avec accès au formulaire de contact.
- Pièce indisponible → mention explicite avec possibilité de demander un devis (feature 23).

### 5.3 Gestion des pièces (back‑office)

1. L'administrateur ouvre **Pièces détachées**.
2. Il crée ou modifie une pièce : désignation, référence, prix, stock, poids, dimensions, catégorie, marque, visuel, documents.
3. Il gère l'arborescence des catégories de pièces.

### 5.4 Gestion des vues éclatées (back‑office)

1. L'administrateur ouvre **Vue éclatée**.
2. Il crée un plan pour un modèle de machine et dépose le schéma correspondant.
3. Il publie le plan, qui devient consultable côté client.

## 6\. Écrans

| Écran                                              | Accès          |
| -------------------------------------------------- | -------------- |
| Liste des pièces détachées                         | Public         |
| Fiche pièce détachée                               | Public         |
| Vue éclatée — sélection machine et plan interactif | Public         |
| Back‑office — liste des pièces                     | Admin, Employé |
| Back‑office — création / édition d'une pièce       | Admin          |
| Back‑office — catégories de pièces                 | Admin          |
| Back‑office — gestion des vues éclatées            | Admin          |

## 7\. Liens avec les autres features

- **08 — Recherche** : les pièces sont indexées avec priorité sur la référence constructeur.
- **12 — Panier** : pièces détachées et produits partagent le même panier.
- **25 — Ordres de réparation** : les pièces consommées en atelier sont issues de ce catalogue.

# 08 — Recherche

## 1\. Objectif

Permettre à un visiteur de trouver rapidement un produit, une pièce détachée ou un contenu, à partir d'un mot‑clé, d'une référence ou d'un code‑barres.

## 2\. Périmètre fonctionnel

- Barre de recherche accessible depuis toutes les pages
- Suggestions au fil de la frappe
- Page de résultats unifiée (produits, pièces détachées, articles de blog,document )
- Filtrage des résultats par type, catégorie, marque, prix, disponibilité
- Tri des résultats
- Recherche par référence exacte et par code‑barres
- Gestion du cas « aucun résultat »

## 3\. Données interrogées

| Source                                 | Champs recherchés                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `products`                             | désignation, référence, code‑barres, description courte, description, marque, catégorie |
| `spare_parts`                          | désignation, référence, code‑barres, descriptions, marque, catégorie                    |
| `blog_articles`                        | titre, extrait, contenu                                                                 |
| `marques`                              | nom de la marque                                                                        |
| `categories` / `spare_part_categories` | libellé                                                                                 |

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Seuls les éléments publiés sont retournés : produits et pièces actifs, articles publiés.                                                                   |
| R2  | Une correspondance exacte sur une référence ou un code‑barres est classée en tête des résultats.                                                           |
| R3  | Une correspondance sur la désignation prime sur une correspondance dans la description.                                                                    |
| R4  | La recherche est insensible à la casse et aux accents.                                                                                                     |
| R5  | Les suggestions au fil de la frappe se déclenchent à partir d'un nombre minimal de caractères et sont limitées en nombre.                                  |
| R6  | Les résultats sont paginés.                                                                                                                                |
| R7  | En l'absence de résultat, la page propose des alternatives : suggestions de reformulation, catégories populaires, accès au formulaire de demande de devis. |
| R8  | Les termes recherchés sans résultat sont conservés pour analyse dans le back‑office.                                                                       |

## 5\. Parcours utilisateur

### 5.1 Recherche rapide

1. Le visiteur clique dans la barre de recherche présente dans l'en‑tête.
2. Il saisit un terme ; à partir de quelques caractères, une liste de suggestions apparaît (produits, pièces, catégories).
3. Il clique sur une suggestion → accès direct à la fiche correspondante.
4. Ou il valide sa saisie → ouverture de la page de résultats.

### 5.2 Page de résultats

1. La page affiche le terme recherché et le nombre de résultats.
2. Les résultats sont regroupés ou filtrables par type : produits, pièces détachées, articles.
3. Le visiteur affine avec les filtres (catégorie, marque, prix, disponibilité) et choisit un tri.
4. Il navigue entre les pages.
5. Il ouvre une fiche depuis les résultats.

### 5.3 Aucun résultat

1. Un message explicite indique qu'aucun élément ne correspond.
2. Des pistes sont proposées : vérifier l'orthographe, élargir la recherche, parcourir les catégories.
3. Un accès direct au formulaire de **demande de devis** est proposé pour les pièces introuvables.

## 6\. Écrans

| Écran                           | Public |
| ------------------------------- | ------ |
| Barre de recherche (en‑tête)    | Public |
| Suggestions au fil de la frappe | Public |
| Page de résultats               | Public |
| Page « aucun résultat »         | Public |

## 7\. Liens avec les autres features

- **04 — Catalogue** et **07 — Pièces détachées** : sources principales des résultats.
- **23 — Devis** : porte de sortie quand la pièce n'est pas trouvée.
- **33 — Statistiques** : analyse des recherches infructueuses.

# 09 — Avis produits

## 1\. Objectif

Recueillir les appréciations des clients sur les produits achetés et les publier après modération, afin d'aider les futurs acheteurs et de valoriser l'offre.

[

developers.google.com

https://developers.google.com/search/docs/appearance/structured-data/product-snippet?hl=fr

](https://developers.google.com/search/docs/appearance/structured-data/product-snippet?hl=fr)

## 2\. Périmètre fonctionnel

- Dépôt d'un avis par un client : note, titre, commentaire
- Modération obligatoire avant publication
- Affichage des avis publiés sur la fiche produit
- Note moyenne et répartition des notes par produit
- File de modération côté back‑office : validation, refus, suppression
- Tri et pagination des avis sur la fiche produit

## 3\. Données manipulées

### Table `product_reviews`

| Champ              | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| `id`               | Identifiant de l'avis                                       |
| `product_id`       | Produit concerné                                            |
| `client_id`        | Client auteur (peut être détaché si le compte est supprimé) |
| `client_name`      | Nom d'affichage conservé                                    |
| `title`            | Titre de l'avis                                             |
| `content`          | Corps du commentaire                                        |
| `rating`           | Note attribuée                                              |
| `validated`        | Avis publié ou en attente de modération                     |
| `date_publication` | Date de mise en ligne                                       |
| `date_ajout`       | Date de dépôt                                               |

## 4\. Règles de gestion

| #   | Règle                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------- |
| R1  | Seul un client authentifié peut déposer un avis.                                                              |
| R2  | La note est obligatoire ; le titre et le commentaire sont facultatifs.                                        |
| R3  | Un avis est créé en statut non validé et n'apparaît pas publiquement tant qu'il n'a pas été modéré.           |
| R4  | Un client ne peut déposer qu'un seul avis par produit ; il peut le modifier, ce qui le replace en modération. |
| R5  | Seuls les avis validés entrent dans le calcul de la note moyenne.                                             |
| R6  | La note moyenne et le nombre d'avis sont affichés sur la fiche produit et en liste.                           |
| R7  | Un avis refusé n'est pas publié ; son auteur en est informé.                                                  |
| R8  | Le nom affiché est conservé même si le compte client est ultérieurement dissocié.                             |
| R9  | Les avis sont triés par date de publication décroissante par défaut.                                          |

## 5\. Parcours utilisateur

### 5.1 Dépôt d'un avis (client)

1. Le client ouvre la fiche d'un produit, section **Avis**.
2. Il clique sur **Donner mon avis**. S'il n'est pas connecté, il est invité à se connecter.
3. Il attribue une note, saisit un titre et un commentaire.
4. Il valide ; un message confirme que l'avis sera publié après vérification.
5. L'avis apparaît dans son espace personnel avec la mention « En attente de modération ».

### 5.2 Consultation des avis (visiteur)

1. Sur la fiche produit, la note moyenne, le nombre d'avis et la répartition par note sont affichés.
2. La liste des avis publiés présente : nom de l'auteur, note, titre, commentaire, date.
3. Le visiteur peut trier et paginer.

### 5.3 Modération (back‑office)

1. L'administrateur ouvre **Catalogue → Avis**.
2. La liste affiche les avis, filtrables par statut (en attente / publiés) et par produit.
3. Il ouvre un avis : produit concerné, auteur, note, contenu, date de dépôt.
4. Trois actions : **Publier**, **Refuser**, **Supprimer**.
5. La publication met à jour immédiatement la note moyenne du produit.

## 6\. Écrans

| Écran                            | Public         |
| -------------------------------- | -------------- |
| Fiche produit — section avis     | Public         |
| Formulaire de dépôt d'avis       | Client         |
| Back‑office — file de modération | Admin, Employé |
| Back‑office — détail d'un avis   | Admin, Employé |

## 7\. Notifications

| Événement   | Destinataire   | Contenu                        |
| ----------- | -------------- | ------------------------------ |
| Avis déposé | Administrateur | Nouvel avis à modérer          |
| Avis publié | Client         | Confirmation de mise en ligne  |
| Avis refusé | Client         | Information de non‑publication |

## 8\. Liens avec les autres features

- **04 — Catalogue** : la note moyenne est affichée sur la fiche et en liste.
- **16 — Commandes** : une sollicitation d'avis peut être envoyée après livraison.

# 10 — Gestion des stocks

## 1\. Objectif

Maintenir un état de stock fiable pour chaque produit, pièce détachée et variante, tracer chaque mouvement, et piloter les réapprovisionnements.
Exporter les produits de Dolibar

 **Voir des base de donné de code barre** ⚠️

## 2\. Périmètre fonctionnel

- Stock disponible par produit, par pièce détachée et par variante
- Décrémentation automatique à l'expédition d'une commande
- Réintégration automatique lors d'un retour accepté
- Ajustement manuel avec justification obligatoire
- Journal complet et horodaté des mouvements
- Tableau de bord des stocks : ruptures, stocks faibles, valorisation
- Affichage de la disponibilité côté client
- Emplacement de stock

## 3\. Données manipulées

### Champs de stock

- `products.stock` — quantité disponible d'un produit sans variante
- `product_variants.stock` — quantité disponible d'une variante
- `spare_parts.stock` — quantité disponible d'une pièce détachée

### Table `stock_movements`

| Champ        | Description                                                                              |
| ------------ | ---------------------------------------------------------------------------------------- |
| `id`         | Identifiant du mouvement                                                                 |
| `product_id` | Produit concerné                                                                         |
| `variant_id` | Variante concernée le cas échéant                                                        |
| `quantity`   | Quantité du mouvement (positive ou négative selon le sens)                               |
| `type`       | `SHIPMENT` (expédition), `RETURN` (retour), `MANUAL` (ajustement), `CSV_IMPORT` (import) |
| `order_id`   | Commande à l'origine du mouvement, si applicable                                         |
| `return_id`  | Demande de retour à l'origine du mouvement, si applicable                                |
| `note`       | Justification, obligatoire pour un ajustement manuel                                     |
| `created_by` | Auteur du mouvement                                                                      |
| `created_at` | Horodatage                                                                               |

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Tout changement de stock donne lieu à un mouvement enregistré : aucune modification silencieuse.                                                             |
| R2  | Le stock est décrémenté au moment de l'expédition de la commande, et non à la commande ni au paiement.                                                       |
| R3  | Un retour dont les articles sont reçus et acceptés donne lieu à une réintégration en stock.                                                                  |
| R4  | Un ajustement manuel exige une note explicative ; il est associé à son auteur.                                                                               |
| R5  | Lorsqu'un produit possède des variantes, le stock est piloté au niveau de la variante.                                                                       |
| R6  | Un article dont le stock est nul est affiché comme indisponible et son ajout au panier est bloqué.                                                           |
| R7  | Si le stock devient insuffisant entre la mise au panier et la validation de la commande, la quantité est ajustée et le client en est informé avant paiement. |
| R8  | Le stock ne peut pas devenir négatif : une opération qui l'entraînerait est refusée.                                                                         |
| R9  | Un import en masse crée un mouvement par ligne modifiée et produit un rapport détaillé.                                                                      |
| R10 | Un seuil de stock faible déclenche une alerte dans le tableau de bord back‑office.                                                                           |
| R11 | Le journal des mouvements est consultable mais non modifiable.                                                                                               |

## 5\. Parcours utilisateur

### 5.1 Consultation de la disponibilité (client)

1. Sur la liste et sur la fiche, l'état de disponibilité est indiqué : disponible, stock limité, indisponible.
2. Pour un produit à variantes, la disponibilité s'actualise à la sélection de la combinaison.
3. Si l'article est indisponible, l'ajout au panier est désactivé, avec possibilité de demander un devis.

### 5.2 Décrémentation à l'expédition

1. L'opérateur passe une commande au statut « Expédiée » depuis le back‑office.
2. Le stock de chaque article de la commande est décrémenté de la quantité commandée.
3. Un mouvement de type expédition est enregistré pour chaque ligne, avec la référence de commande.

### 5.3 Réintégration sur retour

1. Le retour est marqué comme reçu et les articles sont acceptés.
2. Le stock des articles retournés est réintégré.
3. Un mouvement de type retour est enregistré avec la référence du dossier de retour.

### 5.4 Ajustement manuel (back‑office)

1. L'administrateur ouvre **Catalogue → Stock** et recherche l'article.
2. Il saisit la nouvelle quantité ou l'écart à appliquer.
3. Il renseigne obligatoirement une justification (casse, inventaire, erreur de saisie…).
4. Il valide : le stock est mis à jour et le mouvement est journalisé.

### 5.5 Import de stock

1. L'administrateur dépose un fichier contenant les références et les quantités.
2. Un aperçu affiche les lignes reconnues, les écarts et les erreurs.
3. Il confirme ; les stocks sont mis à jour et un mouvement par ligne est créé.
4. Un rapport détaille les lignes traitées et les rejets avec leur motif.

### 5.6 Pilotage (back‑office)

1. L'administrateur ouvre le tableau de bord des stocks.
2. Il visualise : articles en rupture, articles sous le seuil d'alerte, valorisation totale du stock, derniers mouvements.
3. Il filtre par catégorie, marque ou fournisseur pour préparer un réapprovisionnement.

## 6\. Écrans

| Écran                                       | Public         |
| ------------------------------------------- | -------------- |
| Fiche produit — indicateur de disponibilité | Public         |
| Back‑office — tableau de bord des stocks    | Admin, Employé |
| Back‑office — ajustement manuel             | Admin          |
| Back‑office — import de stock               | Admin          |
| Back‑office — journal des mouvements        | Admin          |

## 7\. Liens avec les autres features

- **05 — Variantes** : le stock est porté par la variante.
- **12 — Panier** : contrôle de disponibilité à l'ajout et à la validation.
- **16 — Cycle de vie des commandes** : le passage au statut expédié déclenche la décrémentation.
- **19 — Retours** : la réception d'un retour déclenche la réintégration.
- **11 — Fournisseurs** : les délais et minimums de commande guident le réapprovisionnement.

# 11 — Fournisseurs & sourcing

## 1\. Objectif

Référencer les fournisseurs, associer chaque produit à ses sources d'approvisionnement avec leurs conditions négociées, et disposer des informations nécessaires au réapprovisionnement.

## 2\. Périmètre fonctionnel

- Référentiel des fournisseurs (identité, coordonnées, SIRET)
- Association produit ↔ fournisseur, avec possibilité de sources multiples
- Conditions par fournisseur : référence fournisseur, prix d'achat négocié, délai de livraison, quantité minimale de commande
- Désignation d'un fournisseur principal par produit
- Activation / désactivation d'un fournisseur
- Consultation des produits d'un fournisseur
- Aide au réapprovisionnement à partir des ruptures constatées

## 3\. Données manipulées

### Table `suppliers`

| Champ                                     | Description                  |
| ----------------------------------------- | ---------------------------- |
| `id`                                      | Identifiant du fournisseur   |
| `nom`                                     | Raison sociale               |
| `email`, `telephone`                      | Contacts                     |
| `adresse`, `code_postal`, `ville`, `pays` | Adresse                      |
| `siret`                                   | Identifiant d'entreprise     |
| `notes`                                   | Commentaires internes        |
| `actif`                                   | Fournisseur actif ou archivé |
| `created_at`, `updated_at`                | Horodatages                  |

### Table `supplier_products`

| Champ                       | Description                              |
| --------------------------- | ---------------------------------------- |
| `id`                        | Identifiant de l'association             |
| `supplier_id`               | Fournisseur                              |
| `product_id`                | Produit approvisionné                    |
| `supplier_reference`        | Référence du produit chez le fournisseur |
| `prix_achat_negocie`        | Prix d'achat convenu                     |
| `delai_livraison_jours`     | Délai d'approvisionnement annoncé        |
| `quantite_min_commande`     | Quantité minimale par commande           |
| `est_fournisseur_principal` | Source privilégiée pour ce produit       |

### Champ lié

`products.supplier_id` — fournisseur de référence rattaché directement à la fiche produit.

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Un produit peut avoir plusieurs fournisseurs, chacun avec ses propres conditions.                                                                    |
| R2  | Un seul fournisseur peut être marqué comme principal pour un produit donné.                                                                          |
| R3  | Le prix d'achat négocié auprès du fournisseur principal alimente le calcul de marge du produit.                                                      |
| R4  | Un fournisseur archivé (`actif = 0`) n'est plus proposé lors du rattachement d'un nouveau produit, mais ses associations existantes sont conservées. |
| R5  | Un fournisseur ne peut pas être supprimé s'il est rattaché à des produits : il doit être archivé.                                                    |
| R6  | Les données fournisseur (prix d'achat, référence, délais) ne sont jamais exposées côté client.                                                       |
| R7  | La quantité minimale de commande est rappelée lors de la préparation d'un réapprovisionnement.                                                       |
| R8  | La même référence fournisseur peut désigner des produits différents chez deux fournisseurs distincts.                                                |

## 5\. Parcours utilisateur

### 5.1 Création d'un fournisseur (back‑office)

1. L'administrateur ouvre **Fournisseurs → Créer**.
2. Il renseigne la raison sociale, les coordonnées, l'adresse, le SIRET et d'éventuelles notes internes.
3. Il enregistre ; le fournisseur devient disponible pour rattachement.

### 5.2 Rattachement d'un produit à un fournisseur

1. L'administrateur ouvre la fiche d'un produit, section **Approvisionnement**.
2. Il ajoute un fournisseur et renseigne : référence fournisseur, prix d'achat négocié, délai de livraison, quantité minimale.
3. Il désigne éventuellement ce fournisseur comme principal.
4. Il peut répéter l'opération pour une source alternative.

### 5.3 Consultation d'un fournisseur

1. L'administrateur ouvre la fiche d'un fournisseur.
2. Il visualise ses coordonnées, ses notes internes et la liste des produits approvisionnés avec, pour chacun, la référence fournisseur, le prix négocié, le délai et la quantité minimale.

### 5.4 Préparation d'un réapprovisionnement

1. Depuis le tableau de bord des stocks, l'administrateur identifie les articles en rupture ou sous le seuil d'alerte.
2. Pour chaque article, le fournisseur principal, son délai et sa quantité minimale sont rappelés.
3. Il regroupe les besoins par fournisseur pour préparer sa commande d'achat.

## 6\. Écrans

| Écran                                                       | Public |
| ----------------------------------------------------------- | ------ |
| Back‑office — liste des fournisseurs                        | Admin  |
| Back‑office — création d'un fournisseur                     | Admin  |
| Back‑office — fiche fournisseur et produits associés        | Admin  |
| Back‑office — section approvisionnement d'une fiche produit | Admin  |

## 7\. Liens avec les autres features

- **04 — Catalogue** : le fournisseur est rattaché à la fiche produit.
- **10 — Stocks** : les ruptures déclenchent le besoin de réapprovisionnement.
- **33 — Statistiques** : le prix d'achat alimente le calcul des marges.

# 12 — Panier

# 12 — Panier

## 1\. Objectif

Permettre au client de constituer sa sélection d'articles, de la conserver entre deux visites, et de la préparer pour le passage en commande.

## 2\. Périmètre fonctionnel

- Ajout d'un produit, d'une variante ou d'une pièce détachée au panier
- Modification des quantités (avec toute la verifications de stock compris pour ne pas avoir de erreur )
- Suppression d'une ligne, vidage complet du panier
- Persistance du panier pour un client connecté
- Panier visiteur conservé le temps de la session, puis fusionné à la connexion
- Récapitulatif : sous‑total HT, TVA, remises, frais de port estimés, total TTC
- Application et retrait d'un code promo
- Application automatique des règles panier (avec alerte pour le clients si un produits du panier n'est plus disponible )
- Utilisation d'un bon d'achat
- Contrôle de disponibilité à chaque étape
- Suivi de la dernière activité, base des relances de panier abandonné
- Afficher la possibilité de faire une demande de pro forma pour les pro

## 3\. Données manipulées

### Table `carts`

| Champ                       | Description                                                |
| --------------------------- | ---------------------------------------------------------- |
| `id`                        | Identifiant du panier                                      |
| `user_id`                   | Propriétaire du panier                                     |
| `promo_code_id`             | Code promo actuellement appliqué                           |
| `wallet_transaction_id`     | Bon d'achat mobilisé sur ce panier                         |
| `date_creation`, `date_maj` | Horodatages                                                |
| `last_activity_at`          | Dernière interaction, utilisée pour la détection d'abandon |

### Table `cart_items`

| Champ                         | Description                       |
| ----------------------------- | --------------------------------- |
| `id`                          | Identifiant de la ligne           |
| `cart_id`                     | Panier auquel la ligne appartient |
| `product_id`                  | Article sélectionné               |
| `variant_id`                  | Variante retenue le cas échéant   |
| `quantity`                    | Quantité                          |
| `date_added`, `date_modified` | Horodatages                       |

## 4\. Règles de gestion

| #   | Règle                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Un client connecté possède un panier unique et persistant.                                                                                    |
| R2  | Un visiteur non connecté dispose d'un panier de session ; à la connexion, ses lignes sont fusionnées avec son panier de compte.               |
| R3  | En cas de fusion, une ligne portant le même article et la même variante voit ses quantités additionnées, dans la limite du stock disponible.  |
| R4  | Ajouter un article déjà présent (même variante) incrémente la quantité au lieu de créer une seconde ligne.                                    |
| R5  | La quantité doit être strictement positive ; passer une quantité à zéro supprime la ligne.                                                    |
| R6  | La quantité ne peut pas excéder le stock disponible ; le dépassement est plafonné avec un message explicite.                                  |
| R7  | Un article devenu indisponible ou désactivé est signalé dans le panier et bloque le passage en commande tant qu'il n'est pas retiré.          |
| R8  | Les prix affichés dans le panier sont les prix en vigueur au moment de la consultation, pas ceux de l'ajout.                                  |
| R9  | Un seul code promo saisi manuellement peut être actif à la fois ; en appliquer un nouveau remplace le précédent.                              |
| R10 | Les règles panier automatiques s'appliquent en complément du code promo, selon leur caractère cumulable (feature 13).                         |
| R11 | Les frais de port affichés dans le panier sont une estimation ; le montant définitif est arrêté au choix du mode de livraison dans le tunnel. |
| R12 | Toute action sur le panier met à jour la date de dernière activité.                                                                           |
| R13 | Le panier est vidé automatiquement après la validation d'une commande payée.                                                                  |

## 5\. Parcours utilisateur

### 5.1 Ajout au panier

1. Depuis une fiche produit ou une liste, le client choisit une variante si nécessaire et une quantité.
2. Il clique sur **Ajouter au panier**.
3. Le système vérifie la disponibilité :
   - **Disponible** → la ligne est créée ou incrémentée, une confirmation s'affiche avec le nombre d'articles et un accès au panier.
   - **Stock insuffisant** → la quantité est ajustée au maximum disponible avec un message.
   - **Indisponible** → l'ajout est refusé.

### 5.2 Consultation et modification du panier

1. Le client ouvre **Mon panier**.
2. Chaque ligne affiche : visuel, désignation, variante, prix unitaire, quantité, total de ligne.
3. Il modifie une quantité ; les totaux se recalculent immédiatement.
4. Il supprime une ligne, ou vide entièrement le panier après confirmation.
5. Le récapitulatif affiche : sous‑total HT, remises appliquées, TVA, frais de port estimés, total TTC.

### 5.3 Application d'un code promo

1. Le client saisit son code dans le champ dédié.
2. Le code est contrôlé : existence, période de validité, montant minimum, typologie de client, nombre d'utilisations restantes.
   - **Valide** → la remise est appliquée et détaillée dans le récapitulatif.
   - **Invalide** → message précisant la raison du refus.
3. Il peut retirer le code à tout moment ; les totaux sont recalculés.

### 5.4 Utilisation d'un bon d'achat

1. Il sélectionne un bon ; le montant mobilisé est déduit du total à payer, dans la limite du solde du bon et du montant du panier.
2. Il peut le retirer avant validation de la commande.

### 5.5 Panier visiteur et connexion

1. Un visiteur non connecté constitue son panier normalement.
2. Au moment de valider sa commande, il est invité à se connecter ou à créer un compte.
3. Après authentification, son panier visiteur est fusionné avec son panier de compte et il reprend le tunnel là où il s'était arrêté.

### 5.6 Panier vide

Un panier sans article affiche un message d'invitation avec un accès direct au catalogue et aux dernières nouveautés.

## 6\. Écrans

| Écran                                    | Public           |
| ---------------------------------------- | ---------------- |
| Panier                                   | Public et client |
| Confirmation d'ajout (fenêtre / bandeau) | Public et client |
| Indicateur de panier dans l'en‑tête      | Public et client |

## 7\. Liens avec les autres features

- **10 — Stocks** : contrôle de disponibilité à l'ajout et à la validation.
- **13 — Promotions** : codes promo et règles panier automatiques.
- **14 — Tunnel de commande** : le panier alimente la commande.
- **20 — Cagnotte** : mobilisation des bons d'achat.
- **29 — Panier abandonné** : la date de dernière activité déclenche les relances.

# 13 — Codes promo & règles panier

## 1\. Objectif

Proposer deux mécanismes de remise complémentaires : les **codes promo** saisis volontairement par le client, et les **règles panier** appliquées automatiquement lorsque les conditions du panier sont réunies.

## 2\. Périmètre fonctionnel

### Codes promo

- Remise en pourcentage ou en montant fixe
- Montant minimum de commande
- Période de validité
- Ciblage par typologie de client (professionnel / particulier)
- Restriction à certaines catégories ou marques
- Plafond d'utilisations et compteur d'usage
- Activation / désactivation
- TTC par default

### Règles panier

- Conditions combinables : montant minimum, quantité d'articles, catégorie, marque, type de client
- Actions : pourcentage de remise ou montant fixe
- Cible de la remise : panier entier, catégorie, marque
- Priorité d'application entre règles
- Cumul autorisé ou exclusif
- Limites d'usage globales ou par client
- Suivi de la consommation par client

## 3\. Données manipulées

### Table `promocodes`

| Champ                                | Description                                   |
| ------------------------------------ | --------------------------------------------- |
| `id`                                 | Identifiant                                   |
| `code`                               | Code saisi par le client, unique              |
| `type`                               | `percentage` ou `fixed`                       |
| `value`                              | Valeur de la remise                           |
| `min_amount`                         | Montant minimum du panier pour être éligible  |
| `description`                        | Libellé affiché                               |
| `active`                             | Code activé ou suspendu                       |
| `type_client`                        | Restriction à `pro`, `particulier`, ou aucune |
| `date_debut`, `date_fin`             | Période de validité                           |
| `usage_count`                        | Nombre d'utilisations déjà effectuées         |
| `max_usage`                          | Plafond d'utilisations                        |
| `date_creation`, `date_modification` | Horodatages                                   |

### Tables `promocode_categories` / `promocode_marques`

Restriction d'un code promo à un ensemble de catégories ou de marques.

### Table `cart_rules`

| Champ                    | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `id`                     | Identifiant de la règle                               |
| `name`                   | Nom interne                                           |
| `description`            | Libellé affiché au client lorsque la règle s'applique |
| `priority`               | Ordre d'évaluation                                    |
| `active`                 | Règle active ou suspendue                             |
| `stackable`              | Règle cumulable avec d'autres                         |
| `date_debut`, `date_fin` | Période de validité                                   |

### Table `cart_rule_conditions`

| Champ            | Description                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `rule_id`        | Règle concernée                                                        |
| `condition_type` | `min_cart_value`, `item_qty`, `category_id`, `brand_id`, `client_type` |
| `operator`       | `>=`, `<=`, `==`, `IN`                                                 |
| `value`          | Valeur de comparaison                                                  |

### Table `cart_rule_actions`

| Champ         | Description                        |
| ------------- | ---------------------------------- |
| `rule_id`     | Règle concernée                    |
| `action_type` | `percentage_off` ou `fixed_off`    |
| `target`      | `entire_cart`, `category`, `brand` |
| `target_id`   | Catégorie ou marque visée          |
| `value`       | Valeur de la remise                |

### Table `cart_rule_usage_limits`

| Champ         | Description                                  |
| ------------- | -------------------------------------------- |
| `rule_id`     | Règle concernée                              |
| `limit_type`  | `per_customer` ou `global`                   |
| `max_uses`    | Nombre maximal d'utilisations                |
| `period_days` | Fenêtre glissante d'application de la limite |

### Table `cart_rule_client_usage`

Compteur d'utilisations par client et par règle, avec date de dernier usage.

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Un code promo est saisi manuellement ; une règle panier s'applique automatiquement, sans action du client.                                                                                  |
| R2  | Un peu accumulé les codes promo                                                                                                                                                             |
| R3  | Un code est refusé si : il est inactif, hors période de validité, le montant minimum n'est pas atteint, la typologie du client ne correspond pas, ou le plafond d'utilisations est atteint. |
| R4  | Le compteur d'utilisations d'un code n'est incrémenté qu'à la validation effective de la commande, pas à l'application dans le panier.                                                      |
| R5  | Si un code est restreint à des catégories ou marques, la remise ne porte que sur les lignes éligibles.                                                                                      |
| R6  | Les règles panier sont évaluées par ordre de priorité décroissante.                                                                                                                         |
| R7  | Toutes les conditions d'une règle doivent être satisfaites pour qu'elle s'applique.                                                                                                         |
| R8  | Une règle non cumulable, dès qu'elle s'applique, interrompt l'évaluation des règles suivantes.                                                                                              |
| R9  | Les règles cumulables s'additionnent entre elles.                                                                                                                                           |
| R10 | Une remise ne peut jamais rendre le total négatif : elle est plafonnée au montant du panier.                                                                                                |
| R11 | Les remises portent sur le montant HT ; la TVA est recalculée sur le montant après remise.                                                                                                  |
| R12 | Les remises ne s'appliquent pas aux frais de port, sauf règle explicitement ciblée sur ceux‑ci.                                                                                             |
| R13 | Une limite d'usage par client bloque l'application au‑delà du quota, sur la fenêtre définie.                                                                                                |
| R14 | Le libellé de la règle appliquée est affiché au client dans le récapitulatif du panier.                                                                                                     |
| R15 | La suppression d'un code promo utilisé sur des commandes passées est interdite : il doit être désactivé.                                                                                    |

## 5\. Parcours utilisateur

### 5.1 Utilisation d'un code promo (client)

1. Dans le panier, le client saisit son code et valide.
2. Le système applique les contrôles d'éligibilité.
3. En cas de succès, la remise apparaît en ligne distincte du récapitulatif, avec sa description.
4. En cas d'échec, un message précise le motif : code inconnu, expiré, montant insuffisant, réservé à une autre typologie de client, ou épuisé.
5. Le client peut retirer le code ; les totaux sont recalculés.

### 5.2 Application automatique d'une règle panier (client)

1. Le client ajoute des articles à son panier.
2. Dès que les conditions d'une règle sont satisfaites, la remise apparaît automatiquement avec son libellé.
3. Si le panier est modifié et que les conditions ne sont plus remplies, la remise disparaît, avec une information claire.

### 5.3 Création d'un code promo (back‑office)

1. L'administrateur ouvre **Promotions → Codes promo → Créer**.
2. Il saisit : code, type de remise, valeur, montant minimum, description.
3. Il définit la période de validité et le plafond d'utilisations.
4. Il restreint éventuellement à une typologie de client, à des catégories ou à des marques.
5. Il active le code ; celui‑ci devient utilisable immédiatement ou à sa date de début.
6. La liste des codes affiche pour chacun le nombre d'utilisations consommées sur le plafond.

### 5.4 Création d'une règle panier (back‑office)

1. L'administrateur ouvre **Promotions → Règles panier → Créer**.
2. Il nomme la règle et rédige le libellé qui sera vu par le client.
3. Il ajoute une ou plusieurs **conditions** (montant minimum, quantité, catégorie, marque, type de client) avec leur opérateur.
4. Il définit l'**action** : type de remise, valeur, cible.
5. Il fixe la priorité et indique si la règle est cumulable.
6. Il ajoute éventuellement des limites d'usage globales ou par client.
7. Il définit la période de validité et active la règle.

## 6\. Écrans

| Écran                                                  | Public |
| ------------------------------------------------------ | ------ |
| Panier — champ code promo et récapitulatif des remises | Client |
| Back‑office — liste des codes promo                    | Admin  |
| Back‑office — création / édition d'un code promo       | Admin  |
| Back‑office — liste des règles panier                  | Admin  |
| Back‑office — création / édition d'une règle panier    | Admin  |

## 7\. Liens avec les autres features

- **12 — Panier** : lieu d'application des remises.
- **14 — Commande** : le montant de remise est figé sur la commande et le compteur d'usage est incrémenté.
- **06 — Catégories & marques** : cibles possibles des restrictions et des remises.

# 14 — Tunnel de commande & paiement

## 1\. Objectif

Transformer un panier en commande payée : collecte des adresses, choix du mode de livraison, sélection du moyen de paiement, encaissement sécurisé et confirmation.

## 2\. Périmètre fonctionnel

- Authentification ou création de compte préalable
- Choix de l'adresse de livraison et de l'adresse de facturation
- Choix du mode de livraison et du transporteur, ou sélection d'un point relais
- Récapitulatif complet avant paiement
- Moyens de paiement : carte bancaire (plateforme bancaire sécurisée) et virement + Sofinco
- Redirection vers la page de paiement de la banque et retour
- Traitement de la confirmation bancaire serveur à serveur
- Écrans de succès, d'échec et d'annulation
- Création de la commande et vidage du panier
- Traçabilité complète des échanges avec la plateforme bancaire
- Filtre avancer pour trouver les commandes coter ADMIN, ajouter ou supprimer des collum du tableau

## 3\. Données manipulées

### Table `orders` (champs du tunnel)

| Champ                                                       | Description                                            |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| `reference`                                                 | Référence unique de la commande, communiquée au client |
| `client_id`                                                 | Client acheteur                                        |
| `status_id`                                                 | Statut courant (feature 16)                            |
| `total_ht`, `total_tva`, `total_ttc`                        | Montants de la commande                                |
| `frais_port`                                                | Frais de livraison retenus                             |
| `additional_shipping_fee`, `additional_fee_reason`          | Supplément de transport et sa justification            |
| `discount_amount`, `promo_code_id`                          | Remise appliquée et code utilisé                       |
| `wallet_amount_used`                                        | Montant réglé par bon d'achat                          |
| `adresse_livraison`, `adresse_facturation`                  | Copies figées des adresses au moment de l'achat        |
| `carrier_id`, `carrier_offer_id`                            | Transporteur et offre retenus                          |
| `relay_point_id`, `relay_point_name`, `relay_point_address` | Point relais choisi                                    |
| `payment_provider`                                          | `monetico` (carte) ou `bank_transfer` (virement)       |
| `payment_reference`                                         | Référence de la transaction bancaire                   |
| `payment_auth_code`                                         | Code d'autorisation                                    |
| `payment_card_brand`, `payment_card_masked`                 | Réseau et numéro masqué de la carte                    |
| `payment_captured_at`                                       | Date d'encaissement                                    |
| `date_commande`                                             | Date de validation                                     |

### Table `order_items`

Lignes de commande avec copies figées : désignation, référence, visuel, prix unitaire HT et TTC, quantité, totaux, variante retenue.

### Table `order_payments`

| Champ                    | Description                         |
| ------------------------ | ----------------------------------- |
| `order_id`               | Commande réglée                     |
| `payment_method`         | Moyen de paiement de cette fraction |
| `amount`                 | Montant réglé par ce moyen          |
| `voucher_transaction_id` | Bon d'achat mobilisé le cas échéant |
| `label`                  | Libellé affiché                     |
| `created_at`             | Horodatage                          |

### Table `monetico_transactions`

| Champ                                                   | Description                              |
| ------------------------------------------------------- | ---------------------------------------- |
| `order_id`, `repair_request_id`, `tutorial_purchase_id` | Objet du paiement                        |
| `reference`                                             | Référence de la transaction              |
| `direction`                                             | Sens de l'échange (émission / réception) |
| `raw_payload`                                           | Contenu intégral de l'échange            |
| `mac_received`, `mac_expected`, `mac_valid`             | Contrôle d'intégrité du message bancaire |
| `code_retour`, `motif_refus`                            | Résultat renvoyé par la banque           |
| `http_status`, `remote_ip`                              | Contexte technique de l'appel            |
| `created_at`                                            | Horodatage                               |

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Le passage en commande exige un compte authentifié.                                                                                                                   |
| R2  | Le panier est revalidé intégralement avant paiement : disponibilité, prix, éligibilité des remises. Toute divergence est présentée au client avant de poursuivre.     |
| R3  | Une adresse de livraison est obligatoire, sauf en cas de retrait en point relais où le point choisi en tient lieu.                                                    |
| R4  | L'adresse de facturation est par défaut identique à l'adresse de livraison ; le client peut la dissocier.                                                             |
| R5  | Les adresses sont copiées sur la commande : une modification ultérieure du carnet d'adresses ne modifie pas les commandes passées.                                    |
| R6  | Le mode de livraison est obligatoire ; les frais de port définitifs en découlent (feature 15).                                                                        |
| R7  | Le taux de TVA appliqué dépend du pays de facturation et du statut d'exonération du client (feature 17).                                                              |
| R8  | Un bon d'achat peut couvrir tout ou partie du montant ; le solde restant est réglé par carte ou virement.                                                             |
| R9  |                                                                                                                                                                       |
| R10 | La référence de commande est unique et générée à la validation.                                                                                                       |
| R11 | La commande est créée avant la redirection bancaire, dans un statut en attente de paiement.                                                                           |
| R12 | Seule la confirmation serveur à serveur de la banque fait foi pour valider un paiement ; le retour du navigateur est purement informatif.                             |
| R13 | L'intégrité de chaque message bancaire est contrôlée ; un message dont le contrôle échoue est rejeté et journalisé comme suspect.                                     |
| R14 | Chaque échange avec la plateforme bancaire est journalisé intégralement, dans les deux sens.                                                                          |
| R15 | Un paiement confirmé fait passer la commande au statut « Payée », vide le panier, décrémente le solde du bon d'achat utilisé et incrémente le compteur du code promo. |
| R16 | Un paiement refusé laisse la commande en attente ; le client peut retenter le règlement depuis son espace.                                                            |
| R17 | Une même confirmation bancaire reçue plusieurs fois ne produit qu'un seul encaissement.                                                                               |
| R18 | Le paiement par virement crée la commande en attente de règlement ; la validation est effectuée manuellement par le back‑office à réception des fonds.                |
| R19 | Les données complètes de carte ne sont jamais reçues ni stockées par la plateforme ; seuls le réseau et un numéro masqué sont conservés.                              |
| R20 | La commande n'est jamais modifiable par le client après validation.                                                                                                   |

## 5\. Parcours utilisateur

### 5.1 Tunnel de commande — parcours nominal

1. Depuis le panier, le client clique sur **Commander**.
2. **Authentification** : s'il n'est pas connecté, il se connecte ou crée un compte ; son panier est fusionné.
3. **Adresse de livraison** : il choisit une adresse enregistrée ou en saisit une nouvelle, qu'il peut enregistrer dans son carnet.
4. **Adresse de facturation** : identique par défaut, dissociable.
5. **Mode de livraison** : les options disponibles sont calculées à partir du poids, des dimensions et de la destination. Il en sélectionne une. S'il choisit un mode point relais, il recherche et sélectionne un point à proximité.
6. **Récapitulatif** : articles, quantités, sous‑total HT, remises, TVA, frais de port, total TTC, adresses et mode de livraison retenus.
7. **Moyen de paiement** : il choisit carte bancaire ou virement, et mobilise éventuellement un bon d'achat.
8. Il accepte les conditions générales de vente.
9. Il clique sur **Payer** :
   - **Carte** → la commande est créée en attente et il est redirigé vers la page de paiement sécurisée de la banque.
   - **Virement** → la commande est créée en attente de règlement, les coordonnées bancaires et la référence à rappeler lui sont communiquées.

### 5.2 Paiement par carte

1. Sur la page de la banque, le client saisit ses coordonnées de carte et valide l'authentification forte.
2. La banque notifie la plateforme serveur à serveur ; l'intégrité du message est contrôlée et le résultat est journalisé.
3. Le client est renvoyé vers l'un des trois écrans :
   - **Succès** → référence de commande, récapitulatif, accès au suivi, email de confirmation.
   - **Échec** → motif du refus, possibilité de retenter avec un autre moyen ; le panier est conservé.
   - **Annulation** → retour au panier intact.
4. À réception de la confirmation positive, la commande passe au statut payé et l'email de confirmation est envoyé.

### 5.3 Paiement par virement

1. La commande est créée en attente de règlement.
2. Le client reçoit par email les coordonnées bancaires et la référence à mentionner.
3. À réception des fonds, un opérateur marque la commande comme payée depuis le back‑office.
4. Le client reçoit la confirmation de paiement et le traitement de la commande démarre.

### 5.4 Paiement intégralement couvert par un bon d'achat

1. Le client mobilise un bon dont le solde couvre le total.
2. Le montant à régler tombe à zéro ; aucune redirection bancaire n'a lieu.
3. La commande est confirmée immédiatement et le bon est débité du montant utilisé.

### 5.5 Cas d'erreur

| Situation                                              | Traitement                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| Article devenu indisponible pendant le tunnel          | Le client est ramené au panier avec la ligne concernée signalée |
| Prix modifié depuis la mise au panier                  | Nouveau prix affiché, confirmation demandée avant de poursuivre |
| Aucun mode de livraison disponible pour la destination | Message explicite et invitation à contacter le service client   |
| Confirmation bancaire dont l'intégrité est invalide    | Message rejeté, commande laissée en attente, alerte interne     |
| Confirmation bancaire reçue en double                  | Traitée une seule fois, sans second encaissement                |

## 6\. Écrans

| Écran                                                             | Public |
| ----------------------------------------------------------------- | ------ |
| Tunnel de commande (adresses, livraison, récapitulatif, paiement) | Client |
| Page de paiement bancaire (externe)                               | Client |
| Commande — succès                                                 | Client |
| Commande — échec                                                  | Client |
| Commande — annulation                                             | Client |

## 7\. Notifications

| Événement                       | Destinataire | Contenu                                                           |
| ------------------------------- | ------------ | ----------------------------------------------------------------- |
| Commande validée et payée       | Client       | Confirmation, référence, récapitulatif, facture selon paramétrage |
| Commande en attente de virement | Client       | Coordonnées bancaires et référence à rappeler                     |
| Nouvelle commande               | Back‑office  | Alerte de commande à traiter                                      |
| Paiement refusé                 | Client       | Information et invitation à retenter                              |

## 8\. Liens avec les autres features

- **12 — Panier** : source de la commande.
- **13 — Promotions** : remises figées sur la commande.
- **15 — Livraison** : calcul des options et des frais de port.
- **16 — Cycle de vie des commandes** : suite du traitement après paiement.
- **17 — TVA** : détermination du taux applicable.
- **18 — Facturation** : génération des documents.

# 15 — Livraison, transporteurs & points relais

## 1\. Objectif

Proposer au client les modes de livraison réellement applicables à son panier et à sa destination, calculer les frais de port correspondants, gérer les points relais, et assurer le suivi du colis jusqu'à la livraison.

## 2\. Périmètre fonctionnel

- Référentiel des transporteurs et de leurs offres de livraison
- Grille tarifaire par tranche de poids
- Calcul dynamique des options de livraison disponibles pour un panier et un code postal
- Contraintes métier : transporteur imposé par produit, blocage du point relais au‑delà d'un certain montant, seuil de poids
- Surcoût de transport spécifique à un produit
- Recherche et sélection d'un point relais à proximité
- Génération de l'étiquette d'expédition
- Numéro et lien de suivi du colis
- Actualisation du statut de livraison
- Changement de transporteur sur une commande en cours
- Statistiques transporteurs

## 3\. Données manipulées

### Table `carriers`

| Champ        | Description                      |
| ------------ | -------------------------------- |
| `id`         | Identifiant du transporteur      |
| `name`       | Nom commercial                   |
| `code`       | Code unique du transporteur      |
| `logo_url`   | Logo affiché au client           |
| `is_active`  | Transporteur proposé ou suspendu |
| `sort_order` | Ordre d'affichage                |

### Table `carrier_offers`

| Champ                            | Description                                      |
| -------------------------------- | ------------------------------------------------ |
| `id`                             | Identifiant de l'offre                           |
| `carrier_id`                     | Transporteur proposant l'offre                   |
| `name`, `code`                   | Libellé et code de l'offre                       |
| `description`                    | Détail affiché au client                         |
| `delivery_type`                  | Type de livraison : domicile, point relais, etc. |
| `min_weight_kg`, `max_weight_kg` | Tranche de poids couverte par l'offre            |
| `base_price`                     | Tarif de l'offre                                 |
| `is_active`                      | Offre proposée ou suspendue                      |
| `sort_order`                     | Ordre d'affichage                                |

### Champs de la commande

`carrier_id`, `carrier_offer_id`, `frais_port`, `additional_shipping_fee`, `additional_fee_reason`, `package_weight_kg`, `package_length_cm`, `package_width_cm`, `package_height_cm`, `tracking_number`, `tracking_url`, `label_url`, `last_tracking_update`, `relay_point_id`, `relay_point_name`, `relay_point_address`, `date_livraison`.

### Champs produit influençant le transport

`poids`, `longueur_cm`, `largeur_cm`, `hauteur_cm`, `shipping_extra_fee_eur`, `forced_carrier_id`, `forced_carrier_offer_id`, `min_weight_kg_threshold`.

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Le poids total du panier est la somme des poids unitaires multipliés par les quantités, arrondie au centième.                                                                          |
| R2  | Une offre n'est proposée que si le poids total du panier se situe dans sa tranche de poids.                                                                                            |
| R3  | Seuls les transporteurs actifs et les offres actives sont proposés.                                                                                                                    |
| R4  | Blocage du point relais : au‑delà de 250 € de commande, les offres de type point relais ne sont pas proposées.                                                                         |
| R5  | Transporteur imposé par produit : si un article du panier impose un transporteur, seules les offres de ce transporteur sont proposées. Cette contrainte prime sur toutes les autres.   |
| R6  | Seuil de poids : si le poids total atteint le seuil défini sur un article, le transporteur associé à cet article est imposé — sauf si un transporteur est déjà imposé par la règle R5. |
| R7  | Lorsqu'une offre est imposée, elle est signalée comme telle au client, sans alternative.                                                                                               |
| R8  | Les options sont présentées triées par prix croissant.                                                                                                                                 |
| R9  | Le surcoût de transport d'un produit est la somme, sur tout le panier, du surcoût unitaire multiplié par la quantité ; il s'ajoute au tarif de l'offre retenue.                        |
| R10 | Les dimensions du colis retenues sont les dimensions maximales constatées parmi les articles du panier.                                                                                |
| R11 | Si aucune offre ne correspond au panier et à la destination, le client est invité à contacter le service client.                                                                       |
| R12 | Le résultat du calcul est mis en cache par code postal, poids et transporteur, afin d'éviter des recalculs répétés.                                                                    |
| R13 | Le choix d'un point relais est obligatoire pour une offre de type point relais ; l'identifiant, le nom et l'adresse du point sont copiés sur la commande.                              |
| R14 | Un supplément de transport peut être ajouté manuellement par le back‑office sur une commande, avec justification obligatoire, et est communiqué au client.                             |
| R15 | Le numéro de suivi et le lien correspondant sont transmis au client dès l'expédition.                                                                                                  |
| R16 | Le changement de transporteur sur une commande non expédiée recalcule les frais de port et est tracé.                                                                                  |

## 5\. Parcours utilisateur

### 5.1 Choix du mode de livraison (client)

1. Dans le tunnel de commande, après saisie de l'adresse, le client accède à l'étape **Livraison**.
2. Les options applicables sont calculées à partir du poids, des dimensions, du montant et du code postal.
3. Chaque option affiche : logo du transporteur, libellé, type de livraison, délai indicatif, prix.
4. Il sélectionne une option ; le récapitulatif se met à jour.
5. Si une offre est imposée par un article, elle est présentée seule avec l'explication correspondante.

### 5.2 Sélection d'un point relais

1. Le client choisit une offre de type point relais.
2. Il saisit un code postal ou une ville ; la liste des points à proximité s'affiche avec adresse, distance et horaires d'ouverture.
3. Il sélectionne un point ; celui‑ci est rappelé dans le récapitulatif.
4. Le point retenu est enregistré sur la commande et rappelé dans l'email de confirmation.

### 5.3 Expédition (back‑office)

1. L'opérateur ouvre une commande payée.
2. Il vérifie ou renseigne le poids et les dimensions réels du colis.
3. Il génère l'étiquette d'expédition auprès du transporteur.
4. Le numéro de suivi et le lien de suivi sont enregistrés sur la commande.
5. Il passe la commande au statut « Expédiée » : le stock est décrémenté et le client reçoit un email contenant le numéro de suivi.

### 5.4 Suivi du colis

1. Le client consulte l'avancement depuis son espace ou depuis la page de suivi public.
2. Le statut de livraison est actualisé périodiquement auprès du transporteur.
3. À la livraison, la date de livraison est renseignée et le statut de la commande évolue.

### 5.5 Changement de transporteur (back‑office)

1. Sur une commande non expédiée, l'opérateur ouvre l'action **Changer le mode de livraison**.
2. Il sélectionne un autre transporteur ou une autre offre.
3. Les frais de port sont recalculés ; l'écart est signalé.
4. Il confirme ; le changement est tracé dans le journal d'audit.

### 5.6 Gestion du référentiel (back‑office)

1. L'administrateur ouvre **Paramètres → Transporteurs**.
2. Il crée un transporteur (nom, code, logo, ordre d'affichage) et l'active.
3. Pour chaque transporteur, il crée des offres : libellé, type de livraison, tranche de poids, tarif de base, ordre d'affichage.
4. Il peut suspendre une offre ou un transporteur sans le supprimer.

## 6\. Écrans

| Écran                                             | Public           |
| ------------------------------------------------- | ---------------- |
| Tunnel — étape livraison                          | Client           |
| Tunnel — recherche et sélection d'un point relais | Client           |
| Suivi de commande                                 | Client et public |
| Back‑office — commande : expédition et suivi      | Admin, Employé   |
| Back‑office — liste des transporteurs             | Admin            |
| Back‑office — offres d'un transporteur            | Admin            |
| Back‑office — statistiques transporteurs          | Admin            |

## 7\. Notifications

| Événement                        | Destinataire | Contenu                               |
| -------------------------------- | ------------ | ------------------------------------- |
| Commande expédiée                | Client       | Transporteur, numéro et lien de suivi |
| Colis disponible en point relais | Client       | Coordonnées et horaires du point      |
| Livraison effectuée              | Client       | Confirmation de livraison             |
| Supplément de transport appliqué | Client       | Montant et justification              |

## 8\. Liens avec les autres features

- **04 — Catalogue** : poids, dimensions et contraintes produit alimentent le calcul.
- **14 — Tunnel de commande** : le choix du mode de livraison y est réalisé.
- **16 — Cycle de vie des commandes** : l'expédition fait évoluer le statut.
- **22 — Suivi de commande** : consultation publique de l'avancement.
- **33 — Statistiques** : analyse des volumes et des délais par transporteur.

# 16 — Cycle de vie des commandes

## 1\. Objectif

Piloter une commande de sa création à sa clôture au travers de statuts entièrement paramétrables, chaque statut déterminant ce qui est visible par le client, quels documents sont accessibles et quelles notifications sont envoyées.

## 2\. Périmètre fonctionnel

- Référentiel de statuts de commande paramétrable
- Configuration par statut : couleur, ordre, caractère final, visibilité client
- Déclenchement d'un email au passage dans un statut, avec pièces jointes optionnelles
- Marqueurs métier par statut : payé, expédié, validé
- Autorisation de téléchargement de la facture et du bon de livraison par statut
- Changement de statut manuel depuis le back‑office
- Historique des changements de statut
- Notes publiques (visibles sur les documents) et notes privées (internes)
- Annulation de commande
- Liste des commandes filtrable et exportable

## 3\. Données manipulées

### Table `order_status`

| Champ                        | Description                                                      |
| ---------------------------- | ---------------------------------------------------------------- |
| `id`                         | Identifiant du statut                                            |
| `name`                       | Nom technique unique                                             |
| `display_name`               | Libellé affiché                                                  |
| `color`                      | Couleur d'affichage dans les listes                              |
| `description`                | Explication du statut                                            |
| `sort_order`                 | Position dans le cycle                                           |
| `is_final`                   | Statut terminal, sans suite                                      |
| `send_email_on_change`       | Un email est envoyé au client à l'entrée dans ce statut          |
| `attach_invoice_pdf`         | La facture est jointe à cet email                                |
| `attach_delivery_note_pdf`   | Le bon de livraison est joint à cet email                        |
| `is_paid`                    | Le statut signifie que la commande est réglée                    |
| `is_shipped`                 | Le statut signifie que la commande est expédiée                  |
| `is_validated`               | Le statut signifie que la commande est validée                   |
| `hide_from_client`           | Statut non affiché au client                                     |
| `allow_invoice_pdf_download` | La facture est téléchargeable par le client dans ce statut       |
| `show_delivery_note_pdf`     | Le bon de livraison est consultable par le client dans ce statut |

### Table `orders` (champs de pilotage)

`status_id`, `reference`, `date_commande`, `date_livraison`, `note_facture` (note publique portée sur les documents), `private_note` (note interne), `tracking_number`, `payment_captured_at`.

### Table `order_items`

Lignes figées de la commande.

### Table `admin_actions`

Journal des changements opérés depuis le back‑office (feature 34).

## 4\. Règles de gestion

| #   | Règle                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Toute commande possède à tout instant un et un seul statut.                                                                                        |
| R2  | Le référentiel de statuts est entièrement paramétrable : création, renommage, réordonnancement, suppression.                                       |
| R3  | Un statut utilisé par au moins une commande ne peut pas être supprimé.                                                                             |
| R4  | Un statut marqué final clôt la commande : aucun changement de statut ultérieur n'est proposé.                                                      |
| R5  | Un statut marqué `hide_from_client` n'apparaît pas dans l'espace client ni sur le suivi public ; le dernier statut visible est affiché à la place. |
| R6  | Le passage dans un statut marqué expédié déclenche la décrémentation du stock des articles de la commande.                                         |
| R7  | Le passage dans un statut marqué payé enregistre la date d'encaissement et met à jour le cumul d'achats du client.                                 |
| R8  | Le passage dans un statut configuré pour envoyer un email déclenche cet envoi, avec les pièces jointes configurées.                                |
| R9  | La facture n'est téléchargeable par le client que dans les statuts autorisant explicitement ce téléchargement.                                     |
| R10 | Le bon de livraison n'est consultable que dans les statuts l'autorisant explicitement.                                                             |
| R11 | Tout changement de statut est journalisé avec son auteur, la date, le statut d'origine et le statut de destination.                                |
| R12 | La note publique apparaît sur les documents envoyés au client ; la note privée n'est jamais exposée.                                               |
| R13 | Une commande annulée libère les éventuelles réservations et, si le stock avait déjà été décrémenté, il est réintégré.                              |
| R14 | Le contenu d'une commande validée (articles, quantités, prix) n'est plus modifiable.                                                               |
| R15 | Le client ne peut jamais modifier lui‑même le statut d'une commande.                                                                               |

## 5\. Cycle de vie type

Le référentiel étant paramétrable, l'enchaînement ci‑dessous constitue le parcours standard :

| Ordre | Statut                 | Signification                      | Effets                                                          |
| ----- | ---------------------- | ---------------------------------- | --------------------------------------------------------------- |
| 1     | En attente de paiement | Commande créée, règlement non reçu | Aucun                                                           |
| 2     | Paiement accepté       | Règlement encaissé                 | Marqueur payé, email de confirmation, cumul d'achats mis à jour |
| 3     | En préparation         | Commande en cours de préparation   | Email informatif                                                |
| 4     | Expédiée               | Colis remis au transporteur        | Marqueur expédié, décrémentation du stock, email avec suivi     |
| 5     | Livrée                 | Colis remis au destinataire        | Date de livraison renseignée, facture téléchargeable            |
| —     | Annulée                | Commande abandonnée                | Statut final, réintégration du stock si nécessaire              |
| —     | Remboursée             | Remboursement effectué             | Statut final                                                    |

## 6\. Parcours utilisateur

### 6.1 Traitement d'une commande (back‑office)

1. L'opérateur ouvre **Commandes** : la liste affiche référence, client, date, montant, statut coloré.
2. Il filtre par statut, période, client, ou recherche par référence.
3. Il ouvre une commande : coordonnées client, adresses, lignes de commande, montants, mode de livraison, informations de paiement, historique des statuts.
4. Il fait évoluer le statut via le sélecteur dédié.
5. Selon la configuration du statut retenu, un email est envoyé au client avec les documents joints.
6. L'opération est journalisée.

### 6.2 Suivi par le client

1. Le client ouvre **Mes commandes** et sélectionne une commande.
2. Il visualise le statut courant, la progression, les articles, les montants et l'adresse de livraison.
3. Si le statut l'autorise, il télécharge la facture et le bon de livraison.
4. Si un numéro de suivi est disponible, il accède au suivi du colis.

### 6.3 Annulation

1. L'opérateur ouvre la commande et sélectionne **Annuler**.
2. Il saisit le motif d'annulation.
3. La commande passe au statut annulé ; le stock est réintégré s'il avait été décrémenté ; le client est informé par email.
4. Le remboursement éventuel est traité séparément (feature 19).

### 6.4 Paramétrage des statuts (back‑office)

1. L'administrateur ouvre **Commandes → Statuts**.
2. Il consulte la liste ordonnée des statuts avec leur couleur et leurs marqueurs.
3. Il crée un statut : nom, libellé affiché, couleur, description.
4. Il configure les marqueurs métier (payé, expédié, validé, final) et la visibilité client.
5. Il configure l'envoi d'email et les pièces jointes associées.
6. Il configure les autorisations de téléchargement de documents.
7. Il réordonne les statuts par glisser‑déposer.

## 7\. Écrans

| Écran                                        | Public         |
| -------------------------------------------- | -------------- |
| Mes commandes — liste                        | Client         |
| Mes commandes — détail                       | Client         |
| Back‑office — liste des commandes            | Admin, Employé |
| Back‑office — détail d'une commande          | Admin, Employé |
| Back‑office — référentiel des statuts        | Admin          |
| Back‑office — création / édition d'un statut | Admin          |

## 8\. Notifications

Les notifications sont pilotées par le paramétrage des statuts : chaque statut peut déclencher un email au client, avec ou sans facture ni bon de livraison en pièce jointe.

## 9\. Liens avec les autres features

- **10 — Stocks** : décrémentation à l'expédition, réintégration à l'annulation.
- **14 — Commande & paiement** : point d'entrée du cycle.
- **15 — Livraison** : expédition et suivi.
- **18 — Facturation** : documents rattachés aux statuts.
- **19 — Retours** : dossier ouvert après livraison.
- **34 — Audit** : traçabilité des changements de statut.

# 17 — TVA & fiscalité

## 1\. Objectif

Appliquer automatiquement le régime de TVA correct selon le pays de facturation du client et son statut d'exonération, et faire figurer sur les documents commerciaux la mention légale correspondante.

## 2\. Périmètre fonctionnel

- Détermination automatique du taux de TVA applicable
- regimes de TVA différent gerer
- Vérification du numéro de TVA intracommunautaire auprès du service européen
- Affichage des prix HT et TTC adaptés au régime du client
- Mention légale portée sur les devis, factures, avoirs et proformas

## 3\. Données manipulées

### Champs de la table `clients`

| Champ                   | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `pays`                  | Pays de facturation, déterminant le régime applicable             |
| `vat_number`            | Numéro de TVA intracommunautaire                                  |
| `tax_exempt_status`     | `standard` (TVA normale) ou `exempt_eu_b2b` (autoliquidation)     |
| `account_type`          | Typologie de compte, `pro` étant un prérequis à l'autoliquidation |
| `siret`, `company_name` | Éléments d'identification de l'entreprise                         |

### Champs des documents commerciaux

`total_ht`, `total_tva`, `total_ttc` sur les commandes, devis, factures, avoirs et proformas ; `tva_rate` sur les devis et ordres de réparation.

## 4\. Règles de gestion

| #   | Règle                                                                                              | Taux | Mention portée sur le document                      |
| --- | -------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| R1  | Client facturé en France (ou pays non renseigné)                                                   | 20 % | « TVA 20 % »                                        |
| R2  | Client facturé dans un autre pays de l'Union européenne, avec statut d'exonération `exempt_eu_b2b` | 0 %  | « Autoliquidation de la TVA — Art. 283 bis du CGI » |
| R3  | Client facturé hors Union européenne, ou situation non couverte par R1 et R2                       | 0 %  | « Exonéré — Export hors UE »                        |

### Règles complémentaires

| #   | Règle                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4  | Le régime est déterminé à partir du pays de facturation, pas du pays de livraison.                                                                              |
| R5  | Le pays est interprété selon la codification internationale à deux lettres ; l'absence de valeur équivaut à la France.                                          |
| R6  | L'autoliquidation n'est accordée qu'à un client professionnel, situé dans l'Union européenne, dont le numéro de TVA intracommunautaire a été vérifié.           |
| R7  | La vérification du numéro de TVA est effectuée auprès du service officiel européen. Un numéro invalide interdit le basculement en autoliquidation.              |
| R8  | Le taux applicable est figé sur le document au moment de son émission : une modification ultérieure du statut du client ne modifie pas les documents déjà émis. |
| R9  | Les prix du catalogue sont saisis hors taxes ; l'affichage TTC est calculé selon le régime du client connecté.                                                  |
| R10 | Pour un visiteur non identifié, l'affichage est réalisé avec le régime français par défaut.                                                                     |
| R11 | La ventilation de la TVA figure obligatoirement sur tous les documents commerciaux : total HT, montant de TVA, total TTC.                                       |
| R12 | La mention légale correspondant au régime figure obligatoirement sur les documents en exonération.                                                              |
| R13 | En cas de remise, la TVA est calculée sur le montant HT après remise.                                                                                           |

## 5\. Parcours utilisateur

### 5.1 Client français

1. Le client consulte le catalogue : les prix TTC sont affichés avec une TVA de 20 %.
2. Dans le panier et au récapitulatif de commande, la ventilation HT / TVA / TTC est détaillée.
3. La facture porte la mention « TVA 20 % » et la ventilation correspondante.

### 5.2 Client professionnel européen en autoliquidation

1. À l'inscription en compte professionnel, le client renseigne son pays et son numéro de TVA intracommunautaire.
2. Le numéro est vérifié auprès du service européen :
   - **Valide** → la raison sociale renvoyée est comparée aux informations déclarées.
   - **Invalide** → message d'erreur, le client reste au régime standard.
3. Après validation du compte, l'administrateur bascule le client en régime d'autoliquidation.
4. Le client voit alors ses prix affichés hors taxes, avec un montant de TVA nul.
5. Ses factures portent la mention « Autoliquidation de la TVA — Art. 283 bis du CGI ».

### 5.3 Client hors Union européenne

1. Le client renseigne un pays de facturation hors Union européenne.
2. La TVA appliquée est nulle.
3. Ses documents portent la mention « Exonéré — Export hors UE ».

### 5.4 Gestion du statut fiscal (back‑office)

1. L'administrateur ouvre la fiche d'un client.
2. Il consulte le pays de facturation, le numéro de TVA et le résultat de sa vérification.
3. Il bascule le statut fiscal entre régime standard et autoliquidation.
4. Le changement est journalisé ; il ne s'applique qu'aux documents émis postérieurement.

## 6\. Écrans

| Écran                                                                 | Public           |
| --------------------------------------------------------------------- | ---------------- |
| Catalogue et fiche produit — affichage des prix selon le régime       | Public et client |
| Panier et tunnel — ventilation de la TVA                              | Client           |
| Inscription professionnelle — saisie et vérification du numéro de TVA | Visiteur         |
| Back‑office — fiche client, section fiscalité                         | Admin            |
| Documents commerciaux — ventilation et mention légale                 | Client           |

## 7\. Liens avec les autres features

- **02 — Comptes clients** : le statut fiscal est porté par la fiche client.
- **14 — Commande** : le taux est appliqué au moment de la validation.
- **18 — Facturation** : la mention légale figure sur tous les documents.
- **23 — Devis** et **25 — Ordres de réparation** : même régime appliqué.

# 18 — Facturation, proformas & documents

## 1\. Objectif

Produire l'ensemble des documents commerciaux (factures, bons de livraison, proformas, avoirs) selon une charte paramétrable, et gérer les pièces jointes rattachées aux clients, produits et commandes.

## 2\. Périmètre fonctionnel

- Génération de la facture d'une commande
- Génération du bon de livraison
- Numérotation automatique selon un format configurable
- Charte documentaire paramétrable : identité de l'entreprise, logo, couleurs, polices, libellés
- Mentions légales, conditions générales de vente, coordonnées bancaires
- Factures proforma pour les clients qui le requièrent (professionnels, collectivités)
- Demande le proforma au moment du paniers
- Conversion d'un proforma en commande
- Avoirs (voir feature 19)
- Bibliothèque documentaire : pièces jointes rattachées à un client, un produit, une commande ou une marque
- Téléchargement des documents par le client selon le statut de la commande
- Envoi des documents en pièce jointe des emails transactionnels

## 3\. Données manipulées

### Table `invoice_settings`

Paramétrage unique de la charte documentaire :

| Groupe                | Champs                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Identité              | `company_display_name`, `company_legal_name`, `company_status`, `company_service`, `company_logo_url`                            |
| Coordonnées           | `company_address`, `company_postal_code`, `company_city`, `company_country`, `company_phone`, `company_email`, `company_website` |
| Mentions légales      | `company_rcs`, `company_siren`, `company_vat`, `legal_mentions`                                                                  |
| Mise en forme         | `primary_color`, `secondary_color`, `primary_font`, `title_size`, `body_size`, `page_margin`                                     |
| Libellés              | `invoice_title`, `note_label`, `product_label`, `quantity_label`, `currency_symbol`                                              |
| Numérotation          | `invoice_number_format` (format type `F{YY}{MM}{NNNN}`)                                                                          |
| Valeurs par défaut    | `default_payment_method`, `default_carrier`, `default_vat_rate`, `preparation_delay`                                             |
| Conditions de vente   | `cgv_enabled`, `cgv_url`, `cgv_text`                                                                                             |
| Coordonnées bancaires | `bank_iban`, `bank_bic`                                                                                                          |
| Communication         | `contact_message`, `sender_email`, `email_signature`                                                                             |
| Commercial            | `free_shipping_threshold`                                                                                                        |

### Table `proformas`

| Champ                                      | Description                                     |
| ------------------------------------------ | ----------------------------------------------- |
| `id`                                       | Identifiant                                     |
| `client_id`                                | Client destinataire                             |
| `reference`                                | Référence unique du proforma                    |
| `status`                                   | `draft`, `sent`, `paid`, `cancelled`, `expired` |
| `total_ht`, `total_tva`, `total_ttc`       | Montants                                        |
| `frais_port`                               | Frais de livraison                              |
| `validity_days`, `valid_until`             | Durée et date limite de validité                |
| `adresse_livraison`, `adresse_facturation` | Adresses figées                                 |
| `order_id`                                 | Commande issue du proforma                      |
| `notes`                                    | Note visible sur le document                    |
| `private_note`                             | Note interne                                    |
| `pdf_path`                                 | Document généré                                 |
| `created_at`, `sent_at`, `paid_at`         | Horodatages                                     |

### Table `proforma_items`

Lignes du proforma : désignation, quantité, prix unitaire HT, totaux.

### Table `documents`

| Champ                       | Description                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| `entity_type`               | Nature de l'objet rattaché : `client`, `product`, `order`, `marque` |
| `entity_id`                 | Identifiant de l'objet rattaché                                     |
| `filename`, `original_name` | Nom de stockage et nom d'origine                                    |
| `file_type`, `file_size`    | Type et taille du fichier                                           |
| `description`               | Description du document                                             |
| `uploaded_by`               | Auteur du dépôt                                                     |
| `date_ajout`                | Horodatage                                                          |

### Champs liés

`orders.note_facture` (note publique portée sur la facture), `orders.private_note`, `clients.invoice_format`.

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | La numérotation des factures suit le format configuré et garantit une séquence continue et sans doublon.                                                                         |
| R2  | Un numéro de facture attribué n'est jamais réutilisé, même si la commande est annulée.                                                                                           |
| R3  | La facture reprend les informations figées de la commande : lignes, prix, adresses, taux de TVA. Une modification ultérieure du catalogue ou de la fiche client ne l'altère pas. |
| R4  | Toute facture porte la ventilation HT / TVA / TTC et la mention légale du régime fiscal applicable (feature 17).                                                                 |
| R5  | La facture n'est téléchargeable par le client que dans les statuts de commande l'autorisant (feature 16).                                                                        |
| R6  | Le bon de livraison reprend les articles et quantités expédiés, sans les montants.                                                                                               |
| R7  | La note publique de la commande apparaît sur la facture ; la note privée n'y figure jamais.                                                                                      |
| R8  | Un client dont le format de facturation est `proforma` reçoit un proforma avant l'émission de la facture définitive.                                                             |
| R9  | Un proforma a une durée de validité ; passé ce délai, il bascule automatiquement en `expired`.                                                                                   |
| R10 | Un proforma converti en commande porte le lien vers la commande créée ; il n'est plus modifiable.                                                                                |
| R11 | Les conditions générales de vente sont jointes ou référencées sur les documents lorsque l'option est activée.                                                                    |
| R12 | Les coordonnées bancaires figurent sur les documents lorsqu'un règlement par virement est attendu.                                                                               |
| R13 | Un document déposé dans la bibliothèque est rattaché à une entité unique ; sa suppression n'affecte pas l'entité.                                                                |
| R14 | Les justificatifs de compte (KBIS) sont consultables uniquement par le back‑office et par le client concerné.                                                                    |
| R15 | La modification de la charte documentaire n'affecte pas les documents déjà générés.                                                                                              |

## 5\. Parcours utilisateur

### 5.1 Réception d'une facture (client)

1. Le client passe commande et la règle.
2. Lorsque la commande atteint un statut configuré pour joindre la facture, celle‑ci lui est envoyée par email.
3. Depuis **Mes commandes**, il télécharge à tout moment la facture d'une commande dont le statut l'autorise.
4. Le bon de livraison est consultable dans les mêmes conditions.

### 5.2 Émission d'un proforma (back‑office)

1. L'administrateur ouvre **Commandes → Proformas → Créer**.
2. Il sélectionne le client ; ses coordonnées et adresses sont pré‑remplies.
3. Il ajoute les lignes : article, quantité, prix unitaire HT.
4. Il renseigne les frais de port, la durée de validité et une éventuelle note.
5. Il enregistre en brouillon, puis **Envoyer** : le document est généré et transmis au client, le statut passe à `sent`.
6. À réception du règlement, il marque le proforma comme `paid` et le convertit en commande.
7. La commande créée reprend l'ensemble des lignes et montants du proforma.

### 5.3 Parcours client avec proforma

1. Le client professionnel ou collectivité reçoit son proforma par email.
2. Il le transmet à son service comptable pour engagement de la dépense.
3. Il procède au règlement en rappelant la référence.
4. À réception, la commande est créée et suit le cycle standard.
5. La facture définitive lui est adressée selon le statut de la commande.

### 5.4 Paramétrage de la charte documentaire (back‑office)

1. L'administrateur ouvre **Paramètres → Facturation**.
2. Il renseigne l'identité de l'entreprise, ses coordonnées et ses mentions légales.
3. Il dépose le logo, choisit les couleurs, la police et les tailles de texte.
4. Il configure le format de numérotation, les libellés des colonnes et le symbole monétaire.
5. Il saisit les conditions générales de vente et les coordonnées bancaires.
6. Un aperçu permet de vérifier le rendu avant enregistrement.

### 5.5 Gestion documentaire

1. Depuis la fiche d'un client, d'un produit, d'une commande ou d'une marque, l'opérateur ouvre l'onglet **Documents**.
2. Il dépose un fichier avec une description.
3. Le document apparaît dans la liste avec son nom, sa taille, son type, son auteur et sa date de dépôt.
4. Il peut le consulter, le télécharger ou le supprimer.

## 6\. Écrans

| Écran                                          | Public         |
| ---------------------------------------------- | -------------- |
| Mes commandes — téléchargement des documents   | Client         |
| Back‑office — liste des factures               | Admin          |
| Back‑office — liste des proformas              | Admin          |
| Back‑office — création / édition d'un proforma | Admin          |
| Back‑office — paramètres de facturation        | Admin          |
| Back‑office — documents rattachés à une entité | Admin, Employé |

## 7\. Notifications

| Événement                                      | Destinataire | Contenu                                                          |
| ---------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| Statut de commande configuré avec pièce jointe | Client       | Email avec facture et/ou bon de livraison                        |
| Proforma envoyé                                | Client       | Document, montant, référence à rappeler, date limite de validité |
| Proforma proche de l'expiration                | Client       | Rappel avant échéance                                            |

## 8\. Liens avec les autres features

- **16 — Cycle de vie des commandes** : les statuts pilotent l'accès et l'envoi des documents.
- **17 — TVA** : la mention légale et la ventilation figurent sur les documents.
- **19 — Retours & avoirs** : l'avoir est un document commercial de même nature.
- **32 — Paramétrage entreprise** : identité et charte communes.
- **02 — Comptes clients** : le format de facturation découle de la fiche client.

# 19 — Retours produits & avoirs

## 1\. Objectif

Permettre à un client de demander le retour d'articles livrés, encadrer le traitement de cette demande jusqu'au remboursement, et matérialiser celui‑ci par un avoir, remboursé sur le moyen de paiement d'origine ou crédité en cagnotte.

## 2\. Périmètre fonctionnel

- Demande de retour à l'initiative du client depuis une commande livrée
- Sélection des articles et des quantités à retourner, avec motif
- Dépôt de photos justificatives
- Choix du mode de réexpédition : à la charge du client ou pris en charge par l'entreprise
- Instruction de la demande par le back‑office : acceptation ou refus motivé
- Suivi du colis retour
- Réception et contrôle des articles
- Choix du mode de remboursement : moyen de paiement d'origine ou avoir en bon d'achats
- Génération de l'avoir
- Réintégration des articles en stock
- Consultation des retours et des avoirs

## 3\. Données manipulées

### Table `return_requests`

| Champ                             | Description                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`                              | Identifiant du dossier                                                                                        |
| `order_id`                        | Commande concernée                                                                                            |
| `client_id`                       | Client demandeur                                                                                              |
| `status`                          | `pending`, `approved`, `rejected`, `return_shipped`, `return_received`, `processing`, `completed`, `refunded` |
| `reason`                          | Motif principal du retour                                                                                     |
| `client_comment`                  | Précisions apportées par le client                                                                            |
| `admin_comment`                   | Commentaire de l'instructeur                                                                                  |
| `shipping_method`                 | `self_ship` (retour à la charge du client) ou `meca_transport` (pris en charge)                               |
| `tracking_number`, `carrier_name` | Suivi du colis retour                                                                                         |
| `refund_method`                   | `original_payment` (moyen d'origine) ou `store_credit` (avoir en cagnotte)                                    |
| `refund_amount`                   | Montant remboursé                                                                                             |
| `credit_note_id`                  | Avoir associé                                                                                                 |
| `requested_at`                    | Date de la demande                                                                                            |
| `decided_at`, `decided_by`        | Date et auteur de la décision                                                                                 |
| `received_at`                     | Date de réception des articles                                                                                |
| `completed_at`                    | Date de clôture                                                                                               |

### Table `return_request_items`

| Champ               | Description                 |
| ------------------- | --------------------------- |
| `return_request_id` | Dossier de retour           |
| `order_item_id`     | Ligne de commande concernée |
| `quantity`          | Quantité retournée          |
| `reason`            | Motif propre à cette ligne  |

### Table `return_request_photos`

Photos justificatives : fichier, taille, type, description, date de dépôt.

### Table `credit_notes`

| Champ                                | Description                              |
| ------------------------------------ | ---------------------------------------- |
| `numero`                             | Numéro d'avoir unique                    |
| `order_id`                           | Commande d'origine                       |
| `return_request_id`                  | Dossier de retour à l'origine de l'avoir |
| `client_id`                          | Client bénéficiaire                      |
| `total_ht`, `total_tva`, `total_ttc` | Montants de l'avoir                      |
| `frais_port`                         | Frais de port remboursés                 |
| `status`                             | `draft`, `issued`, `refunded`            |
| `refund_method`                      | Modalité de remboursement retenue        |
| `public_note`                        | Note figurant sur le document            |
| `private_note`                       | Note interne                             |
| `pdf_url`                            | Document généré                          |
| `issued_at`                          | Date d'émission                          |

### Table `credit_note_items`

Lignes de l'avoir : désignation, référence, quantité, prix unitaire HT, total HT, taux de TVA.

### Table `cancel_requests`

Demandes d'annulation de commande formulées avant expédition.

## 4\. Règles de gestion

### Enchaînement des statuts

| Statut de départ  | Statuts atteignables    |
| ----------------- | ----------------------- |
| `pending`         | `approved`, `rejected`  |
| `approved`        | `return_shipped`        |
| `rejected`        | aucun — statut terminal |
| `return_shipped`  | `return_received`       |
| `return_received` | `processing`            |
| `processing`      | `completed`, `refunded` |
| `completed`       | `refunded`              |
| `refunded`        | aucun — statut terminal |

### Règles complémentaires

| #   | Règle                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Une demande de retour ne peut porter que sur une commande livrée, appartenant au client demandeur.                                                         |
| R2  | Toute transition non prévue par le tableau ci‑dessus est refusée.                                                                                          |
| R3  | La quantité retournée par ligne ne peut excéder la quantité commandée, diminuée des quantités déjà retournées.                                             |
| R4  | Le motif de retour est obligatoire.                                                                                                                        |
| R5  | Un refus doit être motivé ; le motif est communiqué au client.                                                                                             |
| R6  | Si le retour est pris en charge par l'entreprise, une étiquette de réexpédition est fournie au client.                                                     |
| R7  | Les articles ne sont réintégrés en stock qu'après réception et contrôle, jamais à la simple acceptation de la demande.                                     |
| R8  | Un article retourné en mauvais état peut être exclu de la réintégration, avec justification.                                                               |
| R9  | Le remboursement sur le moyen de paiement d'origine ne peut excéder le montant effectivement encaissé sur ce moyen.                                        |
| R10 | Le remboursement en avoir crédite la cagnotte du client d'un bon d'achat du même montant (feature 20).                                                     |
| R11 | Un avoir porte un numéro unique et non réutilisable, et reprend le régime de TVA de la commande d'origine.                                                 |
| R12 | Les frais de port initiaux sont remboursés uniquement lorsque le retour porte sur la totalité de la commande, ou en cas d'erreur imputable à l'entreprise. |
| R13 | Un avoir émis n'est plus modifiable ; toute correction passe par un nouvel avoir.                                                                          |
| R14 | Le client est informé par email à chaque changement de statut de son dossier.                                                                              |
| R15 | Un statut terminal (`rejected`, `refunded`) clôt définitivement le dossier.                                                                                |

## 5\. Parcours utilisateur

### 5.1 Demande de retour (client)

1. Le client ouvre **Mes commandes** et sélectionne une commande livrée.
2. Il clique sur **Demander un retour**.
3. Il coche les articles concernés et saisit, pour chacun, la quantité à retourner et le motif.
4. Il ajoute un commentaire et dépose des photos justificatives si nécessaire.
5. Il choisit le mode de réexpédition proposé.
6. Il valide ; le dossier est créé au statut **En attente** et il reçoit un accusé de réception.

### 5.2 Instruction de la demande (back‑office)

1. L'opérateur ouvre **Retours** : la liste est filtrable par statut, client et période.
2. Il ouvre un dossier : commande d'origine, articles concernés, motifs, commentaire, photos.
3. Il décide :
   - **Accepter** → statut `approved`. Si le retour est pris en charge, l'étiquette de réexpédition est transmise au client.
   - **Refuser** → saisie obligatoire du motif → statut `rejected`, dossier clos, client informé.

### 5.3 Réexpédition et réception

1. Le client renvoie le colis et communique, le cas échéant, le numéro de suivi.
2. L'opérateur passe le dossier au statut **Colis retourné**.
3. À réception, il passe au statut **Colis reçu** et contrôle les articles.
4. Les articles conformes sont réintégrés en stock ; les non‑conformes sont signalés avec justification.

### 5.4 Remboursement

1. L'opérateur passe le dossier au statut **En traitement**.
2. Il détermine le montant à rembourser et le mode :
   - **Moyen de paiement d'origine** → le remboursement est initié auprès de la banque.
   - **Avoir en cagnotte** → un bon d'achat du montant correspondant est crédité au client.
3. Un avoir est généré, numéroté et transmis au client.
4. Le dossier passe au statut **Remboursé** ; le client reçoit la confirmation et le document.

### 5.5 Consultation par le client

1. Depuis **Mes retours**, le client suit l'avancement de ses dossiers.
2. Chaque dossier affiche : commande d'origine, articles, statut courant, échanges et documents.
3. Il télécharge son avoir dès qu'il est émis.

### 5.6 Émission d'un avoir sans retour (back‑office)

1. L'administrateur ouvre **Retours → Avoirs → Créer**.
2. Il sélectionne la commande et les lignes concernées.
3. Il ajuste les montants, choisit le mode de remboursement et saisit une note.
4. Il émet l'avoir : le document est généré et transmis au client, la cagnotte est créditée le cas échéant.

## 6\. Écrans

| Écran                                           | Public         |
| ----------------------------------------------- | -------------- |
| Mes commandes — bouton demande de retour        | Client         |
| Formulaire de demande de retour                 | Client         |
| Mes retours — liste et détail                   | Client         |
| Back‑office — liste des retours                 | Admin, Employé |
| Back‑office — détail et instruction d'un retour | Admin, Employé |
| Back‑office — liste des avoirs                  | Admin          |
| Back‑office — création d'un avoir               | Admin          |
| Back‑office — crédits en cagnotte par client    | Admin          |

## 7\. Notifications

| Événement                  | Destinataire | Contenu                                                |
| -------------------------- | ------------ | ------------------------------------------------------ |
| Demande de retour créée    | Client       | Accusé de réception et référence du dossier            |
| Nouvelle demande de retour | Back‑office  | Alerte de dossier à instruire                          |
| Retour accepté             | Client       | Instructions de réexpédition, étiquette le cas échéant |
| Retour refusé              | Client       | Motif du refus                                         |
| Colis reçu                 | Client       | Confirmation de réception et délai de traitement       |
| Remboursement effectué     | Client       | Montant, mode de remboursement, avoir en pièce jointe  |

## 8\. Liens avec les autres features

- **16 — Cycle de vie des commandes** : le retour n'est ouvert qu'après livraison.
- **10 — Stocks** : réintégration après contrôle.
- **20 — Cagnotte** : le remboursement en avoir crédite la cagnotte.
- **18 — Facturation** : l'avoir est un document commercial numéroté.
- **21 — Service client** : un ticket peut accompagner le dossier de retour.

# 20 — Bon d'avoirCode de remboursmeent

Specialement pour les remboursement.

# 21 — Service client (SAV / tickets)

## 1\. Objectif

Offrir un canal de dialogue écrit entre les clients — y compris les visiteurs non authentifiés — et l'équipe interne, sous forme de conversations suivies, catégorisées, priorisées et assignables.

## 2\. Périmètre fonctionnel

- Ouverture d'une conversation par un client authentifié ou par un visiteur
- Rattachement facultatif d'une conversation à une commande
- Fil de messages entre le client et l'équipe
- Catégorisation et priorisation des conversations
- Assignation à un membre de l'équipe
- Indicateurs de messages non lus, de part et d'autre
- Clôture et réouverture d'une conversation
- Ouverture d'une conversation à l'initiative de l'équipe
- Liste des conversations filtrable côté back‑office
- Notifications par email des nouveaux messages
- Voir de chez qui la commande clients a été passé (fournisseurs)
- Note priveé dans la messagerie
- Sécurité Capchat avant de envoyer un message

## 3\. Données manipulées

### Table `support_sessions`

| Champ                               | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `id`                                | Identifiant de la conversation                      |
| `client_id`                         | Client concerné, si authentifié                     |
| `user_id`                           | Compte utilisateur à l'origine                      |
| `anonymous_email`, `anonymous_name` | Coordonnées d'un demandeur non authentifié          |
| `subject`                           | Objet de la demande                                 |
| `status`                            | `open`, `pending_client`, `pending_staff`, `closed` |
| `category`                          | Nature de la demande                                |
| `priority`                          | Niveau d'urgence                                    |
| `order_id`                          | Commande à laquelle la demande se rapporte          |
| `assigned_user_id`                  | Membre de l'équipe en charge                        |
| `unread_by_staff`                   | Présence de messages non lus côté équipe            |
| `unread_by_client`                  | Présence de messages non lus côté client            |
| `last_message_at`                   | Date du dernier message                             |
| `created_at`                        | Date d'ouverture                                    |
| `closed_at`                         | Date de clôture                                     |

### Table `support_messages`

| Champ         | Description                                   |
| ------------- | --------------------------------------------- |
| `session_id`  | Conversation à laquelle le message appartient |
| `sender_type` | Émetteur : client ou équipe                   |
| `content`     | Corps du message                              |
| `read_at`     | Date de lecture par le destinataire           |
| `created_at`  | Horodatage                                    |

## 4\. Règles de gestion

| #   | Règle                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Un visiteur non authentifié peut ouvrir une conversation en fournissant son nom et son adresse email.                                      |
| R2  | Un client authentifié voit sa conversation automatiquement rattachée à sa fiche client.                                                    |
| R3  | Une conversation ouverte par un visiteur dont l'email correspond à un client existant peut être rapprochée de cette fiche.                 |
| R4  | Une conversation peut être rattachée à une commande ; le contexte de celle‑ci est alors accessible directement depuis le fil.              |
| R5  | Un message émis par le client positionne l'indicateur de non‑lu côté équipe et fait passer la conversation en attente de traitement.       |
| R6  | Un message émis par l'équipe positionne l'indicateur de non‑lu côté client et fait passer la conversation en attente de réponse du client. |
| R7  | La date du dernier message est actualisée à chaque envoi et sert au tri par défaut.                                                        |
| R8  | Un message envoyé ne peut être ni modifié ni supprimé : le fil constitue une trace.                                                        |
| R9  | Une conversation close conserve l'intégralité de son historique ; un nouveau message la rouvre automatiquement.                            |
| R10 | Seul un membre de l'équipe peut clôturer une conversation.                                                                                 |
| R11 | L'assignation à un membre de l'équipe est facultative ; une conversation non assignée reste visible de toute l'équipe.                     |
| R12 | Le client ne voit jamais les informations d'assignation interne ni les notes internes.                                                     |
| R13 | Chaque nouveau message donne lieu à une notification email au destinataire.                                                                |

## 5\. Statuts

| Statut           | Signification                                 |
| ---------------- | --------------------------------------------- |
| `open`           | Conversation ouverte, sans attente identifiée |
| `pending_staff`  | Le client a écrit, l'équipe doit répondre     |
| `pending_client` | L'équipe a répondu, le client doit réagir     |
| `closed`         | Conversation clôturée                         |

## 6\. Parcours utilisateur

### 6.1 Ouverture par un client authentifié

1. Le client ouvre **Service client** depuis son espace ou depuis une commande.
2. Il saisit un objet, choisit une catégorie et rédige son message.
3. Il rattache éventuellement la demande à une commande.
4. Il envoie ; la conversation est créée et il reçoit un accusé de réception.
5. Il suit l'échange depuis son espace, avec un indicateur de nouveaux messages.

### 6.2 Ouverture par un visiteur

1. Le visiteur ouvre le formulaire de contact.
2. Il saisit son nom, son adresse email, l'objet et son message.
3. Il envoie ; une conversation est créée avec ses coordonnées de contact.
4. Il reçoit un accusé de réception par email, ainsi que chaque réponse de l'équipe.

### 6.3 Traitement (back‑office)

1. L'opérateur ouvre **Service client** : la liste affiche objet, demandeur, catégorie, priorité, statut, personne assignée et date du dernier message.
2. Il filtre par statut, catégorie, priorité, assignation, ou recherche par client.
3. Il ouvre une conversation : fil complet, contexte client, commande rattachée le cas échéant.
4. Il s'assigne la conversation ou l'attribue à un collègue.
5. Il ajuste la catégorie et la priorité.
6. Il rédige et envoie sa réponse ; le client est notifié et la conversation passe en attente de réponse du client.
7. Une fois la demande résolue, il clôture la conversation ; le client en est informé.

### 6.4 Ouverture à l'initiative de l'équipe

1. L'opérateur ouvre **Service client → Nouvelle conversation**.
2. Il sélectionne un client, saisit l'objet et le premier message.
3. Le client reçoit une notification et peut répondre depuis son espace.

## 7\. Écrans

| Écran                                              | Public         |
| -------------------------------------------------- | -------------- |
| Formulaire de contact                              | Public         |
| Service client — liste de mes conversations        | Client         |
| Service client — fil d'une conversation            | Client         |
| Back‑office — liste des conversations              | Admin, Employé |
| Back‑office — fil et traitement d'une conversation | Admin, Employé |
| Back‑office — nouvelle conversation                | Admin, Employé |

## 8\. Notifications

| Événement             | Destinataire      | Contenu                                          |
| --------------------- | ----------------- | ------------------------------------------------ |
| Conversation ouverte  | Client / visiteur | Accusé de réception et référence                 |
| Nouvelle conversation | Équipe            | Alerte de demande à traiter                      |
| Réponse de l'équipe   | Client            | Contenu du message et lien vers le fil           |
| Réponse du client     | Membre assigné    | Alerte de nouveau message                        |
| Conversation clôturée | Client            | Information de clôture et possibilité de rouvrir |

## 9\. Liens avec les autres features

- **16 — Commandes** : rattachement d'une conversation à une commande.
- **19 — Retours** : accompagnement d'un dossier de retour.
- **31 — Utilisateurs & permissions** : assignation aux membres de l'équipe.
- **30 — Notifications** : envoi des emails de conversation.

# 22 — Suivi de commande public

## 1\. Objectif

Permettre à un client de consulter l'avancement de sa commande sans avoir à se connecter, à partir de sa référence de commande, tout en préservant la confidentialité des informations sensibles.

## 2\. Périmètre fonctionnel

- Consultation de l'état d'une commande par sa référence
- Affichage de l'avancement : progression dans le cycle de statuts
- Informations de livraison : transporteur, numéro de suivi, lien vers le suivi du transporteur, point relais le cas échéant
- Récapitulatif restreint des articles commandés
- Accès direct au formulaire de contact
- Renvoi vers l'espace client pour l'accès complet

## 3\. Données consultées

| Source         | Éléments affichés                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `orders`       | Référence, date de commande, statut courant, montant total, transporteur, numéro et lien de suivi, point relais, date de livraison |
| `order_items`  | Désignation et quantité des articles                                                                                               |
| `order_status` | Libellé, couleur, position dans le cycle, visibilité client                                                                        |

## 4\. Règles de gestion

| #   | Règle                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R1  | L'accès se fait par la référence de commande seule, sans authentification.                                                          |
| R2  | La référence étant non devinable, elle constitue le secret d'accès ; aucune énumération n'est possible.                             |
| R3  | Les informations affichées sont volontairement limitées : ni adresse complète, ni coordonnées de paiement, ni note interne.         |
| R4  | Un statut marqué comme masqué au client n'est pas affiché ; le dernier statut visible est présenté à la place.                      |
| R5  | Aucun document (facture, bon de livraison) n'est téléchargeable depuis le suivi public ; l'accès complet passe par l'espace client. |
| R6  | Une référence inconnue affiche un message générique, sans révéler si la commande existe.                                            |
| R7  | Le lien de suivi du transporteur est proposé dès qu'un numéro de suivi est disponible.                                              |
| R8  | La page est accessible directement par le lien figurant dans les emails transactionnels.                                            |

## 5\. Parcours utilisateur

### 5.1 Suivi par saisie de la référence

1. Le visiteur ouvre **Suivre ma commande** depuis le pied de page ou le menu.
2. Il saisit sa référence de commande et valide.
3. La page de suivi s'affiche :
   - Référence et date de commande
   - Frise de progression indiquant l'étape atteinte
   - Statut courant avec sa description
   - Transporteur, numéro de suivi et lien vers le suivi du colis
   - Point relais retenu le cas échéant, avec son adresse
   - Liste restreinte des articles commandés avec leurs quantités
   - Montant total
4. Il clique sur le lien de suivi pour consulter la position du colis chez le transporteur.

### 5.2 Accès depuis un email

1. Le client reçoit un email de confirmation ou d'expédition.
2. L'email contient un lien direct vers la page de suivi de sa commande.
3. Il clique et accède directement au suivi, sans saisie ni connexion.

### 5.3 Référence introuvable

1. Le visiteur saisit une référence inconnue.
2. Un message générique l'invite à vérifier sa saisie et propose un accès au formulaire de contact.

### 5.4 Passage à l'espace client

La page de suivi rappelle qu'une connexion à l'espace client donne accès à l'historique complet, aux factures et aux demandes de retour.

## 6\. Écrans

| Écran                                       | Public |
| ------------------------------------------- | ------ |
| Suivre ma commande — saisie de la référence | Public |
| Suivi d'une commande — détail               | Public |
| Message « commande introuvable »            | Public |

## 7\. Liens avec les autres features

- **16 — Cycle de vie des commandes** : la progression affichée découle du référentiel de statuts et de leur visibilité.
- **15 — Livraison** : transporteur, numéro de suivi et point relais.
- **30 — Notifications** : les emails transactionnels contiennent le lien de suivi.
- **21 — Service client** : porte d'entrée en cas de question.

# 23 — Demandes de devis & devis

## 1\. Objectif

Permettre à un client de solliciter une proposition commerciale personnalisée — notamment pour des articles hors catalogue, des quantités importantes ou des pièces introuvables — et à l'équipe de produire, transmettre et convertir un devis en commande.

## 2\. Périmètre fonctionnel

### Demande de devis (à l'initiative du client)

- Formulaire de demande avec coordonnées et adresse de livraison
- Ajout d'articles du catalogue et de lignes libres
- Message libre décrivant le besoin
- Suivi de la demande par le client
- Valide 1 semaine
- Delai de livraison son taper a la mains dans la section Message libre

### Devis (à l'initiative de l'équipe)

- Création d'un devis à partir d'une demande, ou création directe pour un client
- Lignes de devis : désignation libre ou article du catalogue, quantité, prix unitaire HT, taux de TVA
- Réordonnancement des lignes
- Durée de validité et date limite
- Notes visibles par le client et notes internes
- Génération et envoi du devis
- Acceptation ou refus par le client
- Conversion du devis accepté en commande
- Expiration automatique passé la date limite

## 3\. Données manipulées

### Table `quote_requests`

| Champ                                                             | Description                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| `reference`                                                       | Référence unique de la demande                          |
| `status`                                                          | `pending`, `validated`, `sent`, `rejected`, `converted` |
| `client_id`                                                       | Client demandeur                                        |
| `company_name`                                                    | Raison sociale                                          |
| `phone`                                                           | Téléphone de contact                                    |
| `address`, `address_complement`, `postal_code`, `city`, `country` | Adresse de livraison souhaitée                          |
| `message`                                                         | Description du besoin                                   |
| `total_ht`, `total_tva`, `total_ttc`                              | Montants estimés                                        |
| `quote_id`                                                        | Devis produit à partir de la demande                    |
| `admin_notes`, `private_note`                                     | Notes internes                                          |
| `public_note`                                                     | Note visible du client                                  |
| `created_at`, `validated_at`, `sent_at`, `converted_at`           | Horodatages du cycle                                    |

### Table `quote_request_items`

Articles demandés : article du catalogue le cas échéant, désignation, référence, quantité.

### Table `quotes`

| Champ                                            | Description                                               |
| ------------------------------------------------ | --------------------------------------------------------- |
| `reference`                                      | Référence unique du devis                                 |
| `status`                                         | `draft`, `sent`, `accepted`, `rejected`, `expired`        |
| `client_id`                                      | Client destinataire                                       |
| `quote_request_id`                               | Demande à l'origine du devis                              |
| `repair_order_id`                                | Ordre de réparation à l'origine du devis                  |
| `source`                                         | Origine du devis (demande, création manuelle, réparation) |
| `created_by`                                     | Auteur du devis                                           |
| `total_ht`, `tva_rate`, `total_tva`, `total_ttc` | Montants et taux appliqué                                 |
| `validity_days`, `valid_until`                   | Durée et date limite de validité                          |
| `order_id`                                       | Commande issue du devis                                   |
| `notes`                                          | Note visible du client                                    |
| `private_note`                                   | Note interne                                              |
| `pdf_path`                                       | Document généré                                           |
| `created_at`, `sent_at`                          | Horodatages                                               |

### Table `quote_items`

| Champ                                | Description                         |
| ------------------------------------ | ----------------------------------- |
| `quote_id`                           | Devis concerné                      |
| `product_id`                         | Article du catalogue le cas échéant |
| `description`                        | Désignation de la ligne             |
| `quantity`                           | Quantité                            |
| `unit_price_ht`                      | Prix unitaire hors taxes            |
| `tva_rate`                           | Taux de TVA de la ligne             |
| `total_ht`, `total_tva`, `total_ttc` | Totaux de la ligne                  |
| `sort_order`                         | Position dans le devis              |

## 4\. Règles de gestion

### Cycle de la demande de devis

| Statut      | Signification                           | Suites possibles        |
| ----------- | --------------------------------------- | ----------------------- |
| `pending`   | Demande reçue, à instruire              | `validated`, `rejected` |
| `validated` | Demande retenue, devis en préparation   | `sent`                  |
| `sent`      | Devis transmis au client                | `converted`, `rejected` |
| `rejected`  | Demande écartée                         | terminal                |
| `converted` | Devis accepté et transformé en commande | terminal                |

### Cycle du devis

| Statut     | Signification                                      | Suites possibles                  |
| ---------- | -------------------------------------------------- | --------------------------------- |
| `draft`    | Devis en cours de rédaction, non visible du client | `sent`                            |
| `sent`     | Devis transmis, en attente de décision             | `accepted`, `rejected`, `expired` |
| `accepted` | Devis accepté par le client                        | conversion en commande            |
| `rejected` | Devis refusé                                       | terminal                          |
| `expired`  | Date limite de validité dépassée                   | terminal                          |

### Règles complémentaires

| #   | Règle                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Toute demande de devis et tout devis portent une référence unique communiquée au client.                                                               |
| R2  | Un devis en brouillon n'est jamais visible du client.                                                                                                  |
| R3  | La date limite de validité est calculée à partir de la date d'émission et de la durée de validité retenue.                                             |
| R4  | Un devis dont la date limite est dépassée passe automatiquement en `expired` et n'est plus acceptable.                                                 |
| R5  | Un devis envoyé n'est plus modifiable ; toute correction impose l'émission d'un nouveau devis.                                                         |
| R6  | Une ligne de devis peut être libre (désignation saisie) ou rattachée à un article du catalogue.                                                        |
| R7  | Le taux de TVA appliqué découle du régime fiscal du client (feature 17) ; il peut être ajusté ligne par ligne.                                         |
| R8  | Les totaux du devis sont la somme des totaux de ses lignes.                                                                                            |
| R9  | L'acceptation d'un devis peut être faite par le client depuis son espace, ou enregistrée par l'équipe.                                                 |
| R10 | La conversion d'un devis accepté crée une commande reprenant l'intégralité des lignes et des montants ; le devis porte alors le lien vers la commande. |
| R11 | Un devis converti ne peut plus être converti une seconde fois.                                                                                         |
| R12 | La disponibilité des articles est contrôlée au moment de la conversion, pas à l'émission du devis.                                                     |
| R13 | Les notes internes ne figurent jamais sur le document transmis au client.                                                                              |
| R14 | Un devis peut être issu d'une demande client, créé directement par l'équipe, ou produit à l'issue d'un diagnostic de réparation (feature 24).          |

## 5\. Parcours utilisateur

### 5.1 Demande de devis (client)

1. Le client ouvre **Demander un devis**, depuis le menu ou depuis une fiche produit indisponible.
2. Il renseigne ses coordonnées, sa raison sociale le cas échéant, et son adresse de livraison. S'il est connecté, ces champs sont pré‑remplis.
3. Il ajoute les articles souhaités : sélection dans le catalogue ou saisie libre avec quantité.
4. Il décrit son besoin dans le message.
5. Il valide ; la demande est créée au statut **En attente** et il reçoit un accusé de réception avec sa référence.

### 5.2 Instruction de la demande (back‑office)

1. L'opérateur ouvre **Commandes → Demandes de devis**.
2. Il consulte la liste, filtrable par statut et par client.
3. Il ouvre une demande : coordonnées, adresse, articles demandés, message.
4. Il décide :
   - **Retenir** → la demande passe en `validated` et il crée le devis correspondant.
   - **Écarter** → saisie du motif → `rejected`, le client est informé.

### 5.3 Rédaction et envoi d'un devis (back‑office)

1. Depuis une demande retenue ou depuis **Devis → Créer**, l'opérateur ouvre le formulaire.
2. Il sélectionne le client ; ses coordonnées sont pré‑remplies.
3. Il ajoute les lignes : désignation, quantité, prix unitaire HT, taux de TVA. Il peut piocher dans le catalogue ou saisir librement.
4. Il réordonne les lignes, ajuste les montants, ajoute une note visible du client et une note interne.
5. Il fixe la durée de validité.
6. Il enregistre en brouillon, puis **Envoyer** : le devis est généré, transmis par email et passe au statut `sent`.

### 5.4 Décision du client

1. Le client reçoit son devis par email et le retrouve dans **Mes devis**.
2. Il consulte le détail : lignes, montants, date limite de validité, notes.
3. Il **accepte** ou **refuse** le devis.
   - **Acceptation** → le devis passe en `accepted`, l'équipe est alertée.
   - **Refus** → le devis passe en `rejected`, avec possibilité de motiver.
4. S'il ne réagit pas avant la date limite, le devis expire automatiquement et il en est informé.

### 5.5 Conversion en commande

1. L'opérateur ouvre un devis accepté et clique sur **Convertir en commande**.
2. La disponibilité des articles est contrôlée ; toute indisponibilité est signalée.
3. La commande est créée avec les lignes et montants du devis, au statut initial du cycle.
4. Le devis et la demande d'origine passent au statut `converted`.
5. Le client est informé et peut procéder au règlement.

## 6\. Écrans

| Écran                                       | Public           |
| ------------------------------------------- | ---------------- |
| Demander un devis — formulaire              | Public et client |
| Mes devis — liste                           | Client           |
| Mes devis — détail, acceptation, refus      | Client           |
| Back‑office — liste des demandes de devis   | Admin, Employé   |
| Back‑office — détail d'une demande          | Admin, Employé   |
| Back‑office — liste des devis               | Admin, Employé   |
| Back‑office — création / édition d'un devis | Admin, Employé   |

## 7\. Notifications

| Événement                    | Destinataire | Contenu                                         |
| ---------------------------- | ------------ | ----------------------------------------------- |
| Demande de devis reçue       | Client       | Accusé de réception et référence                |
| Nouvelle demande             | Back‑office  | Alerte de demande à instruire                   |
| Demande écartée              | Client       | Motif                                           |
| Devis envoyé                 | Client       | Document, montants, date limite de validité     |
| Devis accepté                | Back‑office  | Alerte de devis à convertir                     |
| Devis refusé                 | Back‑office  | Information et motif éventuel                   |
| Devis proche de l'expiration | Client       | Rappel avant échéance                           |
| Devis converti               | Client       | Référence de commande et modalités de règlement |

## 8\. Liens avec les autres features

- **17 — TVA** : régime appliqué aux lignes du devis.
- **14 — Commande** : la conversion crée une commande.
- **18 — Facturation** : le devis suit la même charte documentaire.
- **24 — Demandes de réparation** : le diagnostic aboutit à un devis de réparation.
- **08 — Recherche** : porte de sortie quand un article est introuvable.

# 24 — Demandes de réparation

## 1\. Objectif

Prendre en charge la réparation d'une machine appartenant à un client, depuis la déclaration de la panne jusqu'à l'acceptation du devis de réparation, en encadrant la réception de la machine, le diagnostic, et le cas particulier du client qui renonce après diagnostic.

## 2\. Périmètre fonctionnel

- Formulaire de demande accessible sans compte
- Description de la machine et de la panne, avec photos
- Choix du mode d'acheminement de la machine : expédition ou dépôt sur place
- Instruction de la demande : acceptation, refus motivé, demande d'informations complémentaires
- Réception de la machine à l'atelier
- Réalisation du diagnostic
- Émission d'un devis de réparation
- Décision du client : acceptation, refus, demande de modification du devis
- Facturation de frais de diagnostic en cas de renoncement
- Choix du mode de restitution de la machine non réparée
- Conversion en ordre de réparation après acceptation
- Suivi du dossier par le client

## 3\. Données manipulées

### Table `repair_requests`

| Champ                                                                                                                        | Description                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `reference`                                                                                                                  | Référence unique du dossier                                 |
| `status`                                                                                                                     | Étape courante du dossier (voir cycle ci‑dessous)           |
| `order_type`                                                                                                                 | Nature de la prise en charge : payante ou sous garantie     |
| `warranty_reference`                                                                                                         | Référence de garantie le cas échéant                        |
| `contact_first_name`, `contact_last_name`, `contact_email`, `contact_phone`                                                  | Coordonnées du demandeur                                    |
| `client_id`                                                                                                                  | Fiche client rattachée, créée si nécessaire à l'acceptation |
| `machine_type`                                                                                                               | Type d'équipement                                           |
| `machine_brand`, `machine_model`, `serial_number`                                                                            | Identification de la machine                                |
| `machine_condition`                                                                                                          | État constaté déclaré                                       |
| `engine_model`, `engine_serial_number`                                                                                       | Identification du moteur                                    |
| `problem_description`                                                                                                        | Description de la panne                                     |
| `delivery_mode`                                                                                                              | Acheminement : expédition ou dépôt sur place                |
| `tracking_number`                                                                                                            | Suivi du colis d'acheminement                               |
| `quote_id`                                                                                                                   | Devis de réparation émis                                    |
| `client_message`                                                                                                             | Message du client accompagnant sa décision                  |
| `return_mode`                                                                                                                | Mode de restitution en cas de renoncement                   |
| `return_shipping_fee`                                                                                                        | Frais de réexpédition de la machine                         |
| `diagnostic_fee`                                                                                                             | Frais de diagnostic dus en cas de renoncement               |
| `diagnostic_payment_reference`, `diagnostic_payment_auth_code`                                                               | Règlement des frais de diagnostic                           |
| `admin_notes`                                                                                                                | Notes internes                                              |
| `requested_info_message`, `info_requested_at`                                                                                | Demande d'informations complémentaires                      |
| `client_info_response`                                                                                                       | Réponse du client à cette demande                           |
| `repair_order_id`                                                                                                            | Ordre de réparation issu du dossier                         |
| `created_at`, `validated_at`, `accepted_at`, `machine_received_at`, `diagnostic_started_at`, `quote_sent_at`, `converted_at` | Horodatages du cycle                                        |

### Table `repair_request_photos`

Photos de la machine et de la panne déposées par le client.

## 4\. Cycle de vie du dossier

| Statut                        | Signification                                         | Transitions autorisées                                               |
| ----------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `pending`                     | Demande reçue, à instruire                            | `accepted`, `rejected`, `awaiting_machine`, `info_requested`         |
| `info_requested`              | Informations complémentaires demandées au client      | `pending`, `rejected`                                                |
| `accepted`                    | Demande acceptée, mode d'acheminement à définir       | `awaiting_machine`                                                   |
| `rejected`                    | Demande refusée                                       | terminal                                                             |
| `awaiting_machine`            | En attente de réception de la machine                 | `machine_received`                                                   |
| `machine_received`            | Machine reçue à l'atelier                             | `in_diagnostic`                                                      |
| `in_diagnostic`               | Diagnostic en cours                                   | `quote_sent`                                                         |
| `quote_sent`                  | Devis de réparation transmis au client                | `converted`, `modification_requested`, `awaiting_diagnostic_payment` |
| `modification_requested`      | Le client demande une révision du devis               | `in_diagnostic`                                                      |
| `awaiting_diagnostic_payment` | Le client renonce, frais de diagnostic à régler       | `cancelled`                                                          |
| `converted`                   | Devis accepté, ordre de réparation créé               | terminal                                                             |
| `cancelled`                   | Dossier clos après renoncement et règlement des frais | terminal                                                             |

**Règle générale** : toute transition non figurant dans ce tableau est refusée, quel que soit le profil de l'utilisateur.

## 5\. Règles de gestion

| #   | Règle                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | La demande est ouverte à toute personne, sans compte préalable ; seules les coordonnées de contact sont exigées.                                                                                                  |
| R2  | Le type de machine et la description de la panne sont obligatoires.                                                                                                                                               |
| R3  | À l'acceptation d'une demande, si aucune fiche client n'est rattachée, le système en recherche une par l'adresse email ; à défaut, il en crée une avec les coordonnées fournies.                                  |
| R4  | À l'acceptation, si le mode d'acheminement a déjà été indiqué par le client, le dossier passe directement en attente de réception de la machine ; sinon il passe en `accepted` et le mode reste à définir.        |
| R5  | Un refus doit être motivé ; le motif est enregistré et communiqué au client.                                                                                                                                      |
| R6  | Une demande d'informations complémentaires exige un message non vide ; le dossier revient en `pending` dès que le client a répondu.                                                                               |
| R7  | La réception de la machine est enregistrée par l'atelier et déclenche un email de confirmation au client.                                                                                                         |
| R8  | Le diagnostic ne peut débuter qu'une fois la machine reçue.                                                                                                                                                       |
| R9  | Le devis de réparation est adressé au client avec le détail des travaux, les montants HT, TVA et TTC, la date limite de validité, et des liens permettant d'accepter, de refuser ou de demander une modification. |
| R10 | Une demande de modification renvoie le dossier en diagnostic ; le devis précédent est détaché et un nouveau devis sera émis.                                                                                      |
| R11 | Si le client refuse la réparation, des frais de diagnostic lui sont facturés, ainsi que les éventuels frais de réexpédition de sa machine.                                                                        |
| R12 | Le montant des frais de diagnostic est prédéfini et modifiable au cas par cas.                                                                                                                                    |
| R13 | Le client qui renonce choisit le mode de restitution : réexpédition à ses frais ou retrait sur place.                                                                                                             |
| R14 | Le dossier n'est clos qu'après règlement effectif des frais de diagnostic.                                                                                                                                        |
| R15 | L'acceptation du devis crée l'ordre de réparation et la commande correspondante (feature 25).                                                                                                                     |
| R16 | Un dossier peut être ouvert au titre de la garantie ; les frais de diagnostic ne s'appliquent alors pas.                                                                                                          |
| R17 | Un client ne peut consulter et agir que sur ses propres dossiers.                                                                                                                                                 |
| R18 | Les notes internes ne sont jamais visibles du client.                                                                                                                                                             |

## 6\. Parcours utilisateur

### 6.1 Dépôt d'une demande (client ou visiteur)

1. Le visiteur ouvre **Demande de réparation**.
2. Il renseigne ses coordonnées : nom, prénom, email, téléphone. Ces champs sont pré‑remplis s'il est connecté.
3. Il décrit sa machine : type, marque, modèle, numéro de série, état, modèle et numéro de série moteur.
4. Il décrit la panne constatée.
5. Il dépose des photos de la machine et du défaut.
6. Il indique le mode d'acheminement souhaité : expédition ou dépôt à l'atelier.
7. Il valide ; le dossier est créé au statut **En attente** et il reçoit un accusé de réception avec sa référence.

### 6.2 Instruction (back‑office)

1. L'opérateur ouvre **Commandes → Demandes de réparation**.
2. Il consulte la liste, filtrable par statut.
3. Il ouvre un dossier : coordonnées, description de la machine, panne, photos.
4. Trois décisions :
   - **Accepter** → une fiche client est rattachée ou créée ; le dossier passe en attente de réception si le mode d'acheminement est connu.
   - **Refuser** → saisie du motif → dossier clos, client informé.
   - **Demander des informations** → saisie du message → le client est sollicité et répond depuis son espace.

### 6.3 Réception et diagnostic

1. La machine arrive à l'atelier, par colis ou en dépôt direct.
2. L'opérateur passe le dossier en **Machine reçue** ; le client reçoit un email de confirmation avec la date de réception.
3. Le technicien démarre le diagnostic ; le dossier passe en **Diagnostic en cours**.
4. À l'issue du diagnostic, l'opérateur rédige le devis de réparation : lignes de travaux, pièces, main‑d'œuvre, montants, validité.
5. Il envoie le devis ; le dossier passe en **Devis transmis** et le client reçoit le détail par email avec les trois actions possibles.

### 6.4 Décision du client

Depuis **Mes réparations**, le client ouvre son dossier et choisit :

**a) Accepter le devis**

1. Il consulte le détail des travaux et des montants.
2. Il accepte ; un ordre de réparation et la commande correspondante sont créés.
3. Il procède au règlement selon les modalités indiquées.
4. Le dossier passe en **Converti** ; la réparation est planifiée (feature 25).

**b) Demander une modification**

1. Il saisit un message précisant ce qu'il souhaite voir revu.
2. Le dossier revient en diagnostic ; l'atelier réétudie et émet un nouveau devis.

**c) Refuser la réparation**

1. Il indique qu'il renonce.
2. Il choisit le mode de restitution de sa machine : réexpédition ou retrait sur place.
3. Le montant des frais de diagnostic, augmenté des frais de réexpédition le cas échéant, lui est présenté.
4. Il règle ces frais en ligne.
5. Le dossier passe en **Annulé** ; la machine lui est restituée selon le mode retenu.

### 6.5 Réponse à une demande d'informations

1. Le client est notifié qu'une information complémentaire est requise.
2. Depuis son dossier, il consulte le message et rédige sa réponse.
3. Le dossier revient en attente d'instruction.

### 6.6 Suivi

Depuis **Mes réparations**, le client visualise à tout moment l'étape courante de chacun de ses dossiers, les échanges, le devis et les documents associés.

## 7\. Écrans

| Écran                                             | Public           |
| ------------------------------------------------- | ---------------- |
| Demande de réparation — formulaire                | Public et client |
| Mes réparations — liste                           | Client           |
| Mes réparations — détail d'un dossier             | Client           |
| Accepter le devis                                 | Client           |
| Refuser le devis                                  | Client           |
| Demander la modification du devis                 | Client           |
| Répondre à une demande d'informations             | Client           |
| Paiement des frais de diagnostic                  | Client           |
| Back‑office — liste des demandes de réparation    | Admin, Employé   |
| Back‑office — détail et instruction d'une demande | Admin, Employé   |

## 8\. Notifications

| Événement                    | Destinataire | Contenu                                                     |
| ---------------------------- | ------------ | ----------------------------------------------------------- |
| Demande déposée              | Client       | Accusé de réception et référence                            |
| Nouvelle demande             | Back‑office  | Alerte de dossier à instruire                               |
| Demande acceptée             | Client       | Instructions d'acheminement de la machine                   |
| Demande refusée              | Client       | Motif                                                       |
| Informations demandées       | Client       | Message et lien de réponse                                  |
| Machine reçue                | Client       | Confirmation, date de réception, lien de suivi              |
| Devis de réparation transmis | Client       | Détail des travaux, montants, validité, liens d'action      |
| Devis accepté                | Back‑office  | Alerte de réparation à planifier                            |
| Modification demandée        | Back‑office  | Message du client                                           |
| Renoncement                  | Client       | Montant des frais de diagnostic et modalités de restitution |
| Frais de diagnostic réglés   | Client       | Confirmation et modalités de restitution                    |

## 9\. Liens avec les autres features

- **23 — Devis** : le devis de réparation suit le même modèle documentaire.
- **25 — Ordres de réparation** : suite du dossier après acceptation.
- **26 — Parc machines** : la machine réparée peut être ajoutée au parc du client.
- **14 — Paiement** : règlement des frais de diagnostic et de la réparation.
- **02 — Comptes clients** : création automatique d'une fiche client à l'acceptation.

# 25 — Ordres de réparation (atelier)

## 1\. Objectif

Piloter l'exécution des travaux en atelier : description des interventions, pièces consommées, main‑d'œuvre, frais de diagnostic, photos, et facturation de la réparation, qu'elle soit payante ou prise en charge au titre de la garantie.

## 2\. Périmètre fonctionnel

- Création d'un ordre de réparation, issu d'une demande acceptée ou saisi directement
- Identification de la machine et de son moteur
- Description des travaux réalisés
- Liste des pièces consommées, issues du catalogue ou saisies librement
- Montants : frais de diagnostic, main‑d'œuvre, pièces
- Calcul automatique des totaux HT, TVA et TTC
- Prise en charge sous garantie avec justificatif
- Photos avant / après intervention
- Suivi de l'avancement par statuts
- Édition d'un devis de réparation depuis l'ordre
- Facturation et encaissement
- Notes visibles du client et notes internes

## 3\. Données manipulées

### Table `repair_orders`

| Champ                                                             | Description                                                                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `reference`                                                       | Référence unique de l'ordre                                                                                            |
| `client_id`                                                       | Client propriétaire de la machine                                                                                      |
| `status`                                                          | `pending`, `quote_sent`, `accepted`, `refused`, `awaiting_diagnostic_payment`, `in_progress`, `completed`, `cancelled` |
| `order_type`                                                      | `payant` ou prise en charge sous garantie                                                                              |
| `warranty_reference`                                              | Référence du dossier de garantie                                                                                       |
| `warranty_document_id`                                            | Justificatif de garantie                                                                                               |
| `machine_type`, `machine_brand`, `machine_model`, `serial_number` | Identification de la machine                                                                                           |
| `machine_condition`                                               | État constaté à la prise en charge                                                                                     |
| `engine_model`, `engine_serial_number`                            | Identification du moteur                                                                                               |
| `work_description`                                                | Description des travaux réalisés                                                                                       |
| `diagnostic_fee`                                                  | Frais de diagnostic                                                                                                    |
| `labor_amount`                                                    | Montant de la main‑d'œuvre                                                                                             |
| `total_parts_ht`                                                  | Total des pièces hors taxes                                                                                            |
| `total_ht`, `tva_rate`, `total_tva`, `total_ttc`                  | Totaux de l'ordre                                                                                                      |
| `notes`                                                           | Note visible du client                                                                                                 |
| `private_note`                                                    | Note interne                                                                                                           |
| `created_at`, `updated_at`, `completed_at`, `paid_at`             | Horodatages                                                                                                            |

### Table `repair_order_parts`

| Champ                | Description                                 |
| -------------------- | ------------------------------------------- |
| `repair_order_id`    | Ordre concerné                              |
| `product_id`         | Article du catalogue le cas échéant         |
| `part_name`          | Désignation de la pièce                     |
| `part_reference`     | Référence de la pièce                       |
| Quantité et montants | Quantité consommée, prix unitaire HT, total |

### Table `repair_order_images`

Photos rattachées à l'ordre : fichier, libellé, ordre d'affichage, date de dépôt.

### Champs liés

`orders.repair_order_id` (commande générée par la réparation), `quotes.repair_order_id` (devis issu de l'ordre), `repair_requests.repair_order_id` (dossier d'origine).

## 4\. Cycle de vie

| Statut                        | Signification                                       |
| ----------------------------- | --------------------------------------------------- |
| `pending`                     | Ordre créé, travaux à chiffrer                      |
| `quote_sent`                  | Devis de réparation transmis au client              |
| `accepted`                    | Devis accepté, travaux à réaliser                   |
| `refused`                     | Devis refusé par le client                          |
| `awaiting_diagnostic_payment` | Renoncement du client, frais de diagnostic à régler |
| `in_progress`                 | Travaux en cours                                    |
| `completed`                   | Travaux achevés                                     |
| `cancelled`                   | Ordre annulé                                        |

## 5\. Règles de gestion

| #   | Règle                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Un ordre de réparation porte une référence unique communiquée au client.                                                                      |
| R2  | Un ordre peut être créé automatiquement à l'acceptation d'un devis de réparation, ou saisi directement par l'atelier pour un client existant. |
| R3  | Le total des pièces est la somme des lignes de pièces consommées.                                                                             |
| R4  | Le total hors taxes est la somme des frais de diagnostic, de la main‑d'œuvre et du total des pièces.                                          |
| R5  | Le taux de TVA appliqué découle du régime fiscal du client (feature 17).                                                                      |
| R6  | Les totaux sont recalculés automatiquement à chaque modification d'une ligne ou d'un montant.                                                 |
| R7  | Une pièce consommée peut être rattachée au catalogue — la désignation, la référence et le prix sont alors repris — ou saisie librement.       |
| R8  | La consommation d'une pièce du catalogue décrémente le stock correspondant.                                                                   |
| R9  | Un ordre pris en charge sous garantie n'est pas facturé au client ; un justificatif de garantie et une référence de dossier sont exigés.      |
| R10 | La description des travaux est obligatoire avant de marquer l'ordre comme achevé.                                                             |
| R11 | Un ordre achevé enregistre sa date d'achèvement ; le règlement enregistre la date de paiement.                                                |
| R12 | Un ordre achevé n'est plus modifiable ; une correction impose un nouvel ordre.                                                                |
| R13 | Les photos avant intervention documentent l'état à la prise en charge ; les photos après intervention documentent le travail réalisé.         |
| R14 | Les notes internes ne sont jamais visibles du client ni portées sur les documents.                                                            |
| R15 | À l'achèvement, la machine peut être ajoutée au parc machines du client (feature 26).                                                         |

## 6\. Parcours utilisateur

### 6.1 Création automatique depuis une demande acceptée

1. Le client accepte le devis de réparation issu du diagnostic (feature 24).
2. Un ordre de réparation est créé, reprenant l'identification de la machine, les travaux chiffrés et les montants.
3. La commande correspondante est générée pour le règlement.
4. L'ordre passe en **Accepté** et la réparation est planifiée.

### 6.2 Création directe (back‑office)

1. Le technicien ouvre **Commandes → Ordres de réparation → Créer**.
2. Il sélectionne le client.
3. Il renseigne l'identification de la machine et du moteur, ainsi que l'état constaté.
4. Il indique la nature de la prise en charge : payante ou sous garantie, avec dans ce dernier cas la référence et le justificatif.
5. Il enregistre ; l'ordre est créé au statut **En attente**.

### 6.3 Exécution des travaux

1. Le technicien ouvre l'ordre et passe le statut en **En cours**.
2. Il rédige la description des travaux réalisés.
3. Il ajoute les pièces consommées : sélection au catalogue ou saisie libre, avec quantité et prix.
4. Il saisit le montant de main‑d'œuvre et les frais de diagnostic.
5. Les totaux HT, TVA et TTC se recalculent automatiquement.
6. Il dépose les photos avant et après intervention.
7. Il passe l'ordre en **Achevé** ; le client est informé que sa machine est prête.

### 6.4 Chiffrage et devis

1. Depuis un ordre en attente, le technicien édite un devis de réparation reprenant travaux, pièces et main‑d'œuvre.
2. Le devis est transmis au client ; l'ordre passe en **Devis transmis**.
3. Selon la réponse du client, l'ordre passe en **Accepté**, en **Refusé**, ou en attente de règlement des frais de diagnostic.

### 6.5 Facturation et restitution

1. À l'achèvement, la facture est établie sur la base des totaux de l'ordre.
2. Le client règle en ligne ou sur place.
3. La date de règlement est enregistrée.
4. La machine est restituée ; l'ordre est clos.
5. Pour un ordre sous garantie, aucune facturation n'est adressée au client ; le dossier de garantie est conservé comme justificatif.

## 7\. Écrans

| Écran                                                                | Public         |
| -------------------------------------------------------------------- | -------------- |
| Mes réparations — détail de l'intervention                           | Client         |
| Back‑office — liste des ordres de réparation                         | Admin, Employé |
| Back‑office — création d'un ordre                                    | Admin, Employé |
| Back‑office — édition d'un ordre (travaux, pièces, montants, photos) | Admin, Employé |

## 8\. Notifications

| Événement                    | Destinataire | Contenu                                                   |
| ---------------------------- | ------------ | --------------------------------------------------------- |
| Ordre créé                   | Client       | Référence et récapitulatif de la prise en charge          |
| Devis de réparation transmis | Client       | Détail des travaux et montants                            |
| Travaux en cours             | Client       | Information d'avancement                                  |
| Travaux achevés              | Client       | Récapitulatif, montant à régler, modalités de restitution |
| Réparation réglée            | Client       | Confirmation et facture                                   |

## 9\. Liens avec les autres features

- **24 — Demandes de réparation** : origine principale des ordres.
- **23 — Devis** : chiffrage transmis au client.
- **07 — Pièces détachées** et **10 — Stocks** : pièces consommées et décrémentation.
- **17 — TVA** et **18 — Facturation** : régime fiscal et documents.
- **26 — Parc machines** : la machine réparée alimente le parc du client.

# 26 — Parc machines client

## 1\. Objectif

Permettre à un client de recenser les équipements qu'il possède, afin de faciliter la recherche de pièces compatibles, l'ouverture d'une demande de réparation et le suivi des garanties.

## 2\. Périmètre fonctionnel

- Ajout manuel d'une machine par le client
- Alimentation automatique du parc à partir des commandes de machines
- Alimentation automatique à partir des ordres de réparation
- Fiche machine : type, marque, modèle, numéros de série, moteur, garantie
- Photo de la machine et notes personnelles
- Modification et suppression d'une machine
- Recherche dans le parc
- Pré‑remplissage des formulaires de réparation et de devis à partir d'une machine du parc
- Consultation du parc d'un client depuis le back‑office

## 3\. Données manipulées

### Table `client_machines`

| Champ                                  | Description                                                     |
| -------------------------------------- | --------------------------------------------------------------- |
| `id`                                   | Identifiant de la machine                                       |
| `client_id`                            | Client propriétaire                                             |
| `nom`                                  | Nom donné par le client                                         |
| `type_equipement`                      | Type d'équipement                                               |
| `marque`, `modele`                     | Identification commerciale                                      |
| `numero_serie`                         | Numéro de série de la machine                                   |
| `modele_moteur`, `numero_serie_moteur` | Identification du moteur                                        |
| `garantie_fabricant`                   | Informations de garantie constructeur                           |
| `image_url`                            | Photo de la machine                                             |
| `notes`                                | Notes personnelles du client                                    |
| `source`                               | Origine de l'enregistrement : `manual`, `order`, `repair_order` |
| `product_id`                           | Article du catalogue correspondant, le cas échéant              |
| `order_id`                             | Commande d'achat à l'origine de l'enregistrement                |
| `repair_order_id`                      | Ordre de réparation à l'origine de l'enregistrement             |
| `created_at`, `updated_at`             | Horodatages                                                     |

## 4\. Règles de gestion

| #   | Règle                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Un client ne voit et ne gère que son propre parc.                                                                                      |
| R2  | Le type d'équipement et le nom de la machine sont obligatoires.                                                                        |
| R3  | Une machine achetée sur la plateforme peut être ajoutée automatiquement au parc à la livraison de la commande, avec l'origine `order`. |
| R4  | Une machine prise en charge en réparation peut être ajoutée automatiquement au parc, avec l'origine `repair_order`.                    |
| R5  | Un ajout automatique ne crée pas de doublon si une machine portant le même numéro de série existe déjà dans le parc du client.         |
| R6  | Une machine ajoutée automatiquement reste modifiable et supprimable par le client.                                                     |
| R7  | La suppression d'une machine du parc n'affecte ni les commandes, ni les ordres de réparation associés.                                 |
| R8  | Le numéro de série est facultatif mais fortement recommandé : il conditionne l'identification des pièces compatibles.                  |
| R9  | Une machine du parc peut être sélectionnée pour pré‑remplir une demande de réparation ou une demande de devis.                         |
| R10 | Le back‑office consulte le parc d'un client depuis sa fiche, en lecture et en écriture.                                                |

## 5\. Parcours utilisateur

### 5.1 Ajout manuel d'une machine

1. Le client ouvre **Mon parc machines** depuis son profil.
2. Il clique sur **Ajouter une machine**.
3. Il renseigne : nom d'usage, type d'équipement, marque, modèle, numéro de série, modèle et numéro de série du moteur.
4. Il indique les informations de garantie constructeur.
5. Il dépose une photo et ajoute ses notes personnelles.
6. Il enregistre ; la machine apparaît dans son parc.

### 5.2 Alimentation automatique par un achat

1. Le client commande une machine et la reçoit.
2. La machine est proposée à l'ajout dans son parc, pré‑remplie à partir de la fiche produit et de la commande.
3. Il complète le numéro de série et confirme.

### 5.3 Alimentation automatique par une réparation

1. Une machine du client est prise en charge en atelier.
2. À la clôture de l'ordre de réparation, la machine est proposée à l'ajout dans son parc, pré‑remplie à partir des informations relevées à la prise en charge.

### 5.4 Consultation et utilisation du parc

1. Le client ouvre **Mon parc machines** : chaque machine est présentée avec sa photo, son nom, sa marque, son modèle et son numéro de série.
2. Il recherche une machine par nom, marque ou numéro de série.
3. Depuis une machine, il peut :
   - ouvrir une **demande de réparation** pré‑remplie avec ses caractéristiques,
   - ouvrir une **demande de devis** de pièces,
   - accéder à la vue éclatée du modèle correspondant.

### 5.5 Modification et suppression

1. Le client ouvre une machine et modifie ses informations.
2. Il peut la supprimer de son parc ; ses commandes et ses dossiers de réparation ne sont pas affectés.

### 5.6 Consultation par le back‑office

1. L'opérateur ouvre la fiche d'un client, onglet **Parc machines**.
2. Il consulte les équipements recensés, ce qui facilite le diagnostic et le conseil.
3. Il peut ajouter ou corriger une machine, notamment lors d'une prise en charge en atelier.

## 6\. Écrans

| Écran                                     | Public         |
| ----------------------------------------- | -------------- |
| Mon parc machines — liste                 | Client         |
| Ajout / édition d'une machine             | Client         |
| Détail d'une machine et actions associées | Client         |
| Back‑office — parc machines d'un client   | Admin, Employé |

## 7\. Liens avec les autres features

- **24 — Demandes de réparation** : pré‑remplissage à partir d'une machine du parc.
- **25 — Ordres de réparation** : alimentation automatique du parc.
- **07 — Pièces détachées & vue éclatée** : identification des pièces compatibles.
- **16 — Commandes** : alimentation du parc à la livraison d'une machine.

# 27 — Blog & contenus

## 1\. Objectif

Publier des contenus éditoriaux (conseils, tutoriels, actualités) pour valoriser l'expertise de l'entreprise, améliorer la visibilité naturelle du site, et proposer certains contenus techniques à l'achat.

## 2\. Périmètre fonctionnel

- Articles de blog sous trois formes : contenu rédigé, vidéo, lien externe
- Catégories d'articles avec couleur et icône
- Cycle éditorial : brouillon, publication, archivage
- Aperçu d'un article en brouillon avant publication
- Référencement naturel : adresse, méta‑titre, méta‑description, extrait
- Compteur de consultations
- Bandeau d'accueil composé de diapositives

## 3\. Données manipulées

### Table `blog_articles`

| Champ                            | Description                                    |
| -------------------------------- | ---------------------------------------------- |
| `slug`                           | Adresse publique unique de l'article           |
| `titre`                          | Titre                                          |
| `type`                           | Forme du contenu : rédigé, vidéo, lien externe |
| `contenu`                        | Corps rédigé de l'article                      |
| `video_url`                      | Adresse de la vidéo                            |
| `external_url`                   | Adresse du contenu externe                     |
| `cover_image_url`                | Visuel de couverture                           |
| `extrait`                        | Résumé affiché en liste                        |
| `meta_title`, `meta_description` | Éléments de référencement                      |
| `categorie_id`                   | Catégorie de rattachement                      |
| `statut`                         | Brouillon ou publié                            |
| `date_publication`               | Date de mise en ligne                          |
| `date_creation`, `date_maj`      | Horodatages                                    |
| `vues`                           | Nombre de consultations                        |
| `price`                          | Prix de l'accès                                |

### Table `blog_categories`

| Champ              | Description                  |
| ------------------ | ---------------------------- |
| `nom`, `slug`      | Libellé et adresse publique  |
| `description`      | Présentation de la catégorie |
| `couleur`, `icone` | Éléments d'identité visuelle |
| `ordre`            | Position d'affichage         |
| `actif`            | Catégorie publiée ou masquée |

### Table `slides`

Diapositives du bandeau d'accueil : titre, sous‑titre, contenu enrichi, média (image ou vidéo), ordre d'affichage, état de publication.

## 4\. Règles de gestion

| #   | Règle                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Un article en brouillon n'est pas accessible publiquement ; un lien d'aperçu permet néanmoins de le prévisualiser avant publication. |
| R2  | L'adresse publique d'un article est unique et stable ; la modifier rompt les liens existants.                                        |
| R3  | La date de publication est enregistrée au passage en statut publié.                                                                  |
| R4  | Un article de type vidéo exige une adresse de vidéo ; un article de type lien externe exige une adresse de destination.              |
| R5  | Le compteur de consultations est incrémenté à chaque affichage public de l'article.                                                  |
| R6  | Une catégorie masquée retire ses articles de la navigation par catégorie ; ceux‑ci restent accessibles par leur adresse directe.     |
| R7  | Une catégorie contenant des articles ne peut pas être supprimée.                                                                     |

## 5\. Parcours utilisateur

### 5.1 Consultation du blog

1. Le visiteur ouvre **Blog** depuis le menu.
2. La liste présente les articles publiés : visuel de couverture, titre, extrait, catégorie, date.
3. Il filtre par catégorie.
4. Il ouvre un article :
   - **Article rédigé** → le contenu s'affiche avec sa mise en forme.
   - **Article vidéo** → le lecteur vidéo est intégré.
   - **Lien externe** → l'article renvoie vers la ressource externe.
5. Le compteur de consultations est incrémenté.

### 5.3 Rédaction et publication (back‑office)

1. L'administrateur ouvre **Blog → Nouvel article**.
2. Il saisit le titre ; l'adresse publique est proposée automatiquement.
3. Il choisit le type de contenu et renseigne le corps, l'adresse vidéo ou l'adresse externe selon le cas.
4. Il dépose le visuel de couverture et rédige l'extrait.
5. Il rattache une catégorie et complète les éléments de référencement.
6. Il configure éventuellement le caractère payant et le prix.
7. Il enregistre en brouillon et consulte l'aperçu.
8. Il publie ; l'article devient accessible et sa date de publication est enregistrée.

### 5.4 Gestion des catégories (back‑office)

1. L'administrateur ouvre **Blog → Catégories**.
2. Il crée une catégorie : nom, adresse publique, description, couleur, icône, ordre.
3. Il modifie, réordonne ou masque une catégorie.

## 6\. Écrans

| Écran                                          | Public |
| ---------------------------------------------- | ------ |
| Blog — liste des articles                      | Public |
| Blog — article                                 | Public |
| Blog — aperçu d'un brouillon                   | Admin  |
| Back‑office — liste des articles               | Admin  |
| Back‑office — rédaction / édition d'un article | Admin  |
| Back‑office — catégories du blog               | Admin  |

## 7\. Liens avec les autres features

- **08 — Recherche** : les articles publiés sont indexés.
- **14 — Paiement** : l'achat de tutoriel emprunte le même circuit de règlement sécurisé.
- **28 — Newsletter** : diffusion des nouveaux contenus.
- **31 — Utilisateurs** : les auteurs sont des comptes internes.

# 28 — Newsletter

## 1\. Objectif

Constituer et entretenir une liste de diffusion permettant d'informer les clients et prospects des nouveautés, promotions et contenus, dans le respect des règles de consentement.

## 2\. Périmètre fonctionnel

- Inscription depuis le site (pied de page, tunnel, profil)
- Inscription lors de la création de compte
- Désinscription en un clic depuis chaque email envoyé
- Suivi de l'origine de l'inscription
- Synchronisation avec la plateforme d'envoi d'emails
- Consultation et export de la liste des abonnés
- Statistiques d'inscription et de désinscription

## 3\. Données manipulées

### Table `newsletter_subscribers`

| Champ                      | Description                                                           |
| -------------------------- | --------------------------------------------------------------------- |
| `id`                       | Identifiant de l'abonné                                               |
| `email`                    | Adresse email, unique                                                 |
| `first_name`, `last_name`  | Identité, si connue                                                   |
| `status`                   | `active` (abonné) ou `unsubscribed` (désabonné)                       |
| `source`                   | Origine de l'inscription (site, création de compte, commande, import) |
| `resend_contact_id`        | Identifiant du contact chez la plateforme d'envoi                     |
| `subscribed_at`            | Date d'inscription                                                    |
| `unsubscribed_at`          | Date de désinscription                                                |
| `created_at`, `updated_at` | Horodatages                                                           |

## 4\. Règles de gestion

| #   | Règle                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | L'adresse email est unique dans la liste.                                                                                              |
| R2  | Une inscription requiert un consentement explicite : case à cocher non pré‑cochée, ou action volontaire de l'utilisateur.              |
| R3  | Une adresse déjà inscrite et active ne génère pas de doublon ; un message informe l'utilisateur qu'il est déjà abonné.                 |
| R4  | Une adresse précédemment désabonnée qui se réinscrit repasse en statut actif, avec une nouvelle date d'inscription.                    |
| R5  | Chaque email envoyé contient obligatoirement un lien de désinscription fonctionnant sans authentification.                             |
| R6  | La désinscription est immédiate et enregistre sa date ; l'adresse est conservée au statut désabonné afin de ne plus être sollicitée.   |
| R7  | Un abonné désabonné n'est jamais réinscrit automatiquement, y compris lors d'une nouvelle commande.                                    |
| R8  | L'origine de l'inscription est enregistrée à des fins d'analyse.                                                                       |
| R9  | La liste est synchronisée avec la plateforme d'envoi ; l'identifiant du contact distant est conservé pour maintenir la correspondance. |
| R10 | La liste des abonnés n'est consultable que par le back‑office.                                                                         |
| R11 | Un abonné peut demander la suppression définitive de ses données ; son enregistrement est alors retiré de la liste.                    |

## 5\. Parcours utilisateur

### 5.1 Inscription depuis le site

1. Le visiteur saisit son adresse email dans le bloc newsletter du pied de page.
2. Il valide :
   - **Nouvelle adresse** → inscription enregistrée au statut actif, message de confirmation, email de bienvenue.
   - **Déjà abonné** → message indiquant que l'adresse est déjà inscrite.
   - **Anciennement désabonné** → réinscription enregistrée.
3. L'origine de l'inscription est conservée.

### 5.2 Inscription à la création de compte

1. Lors de l'inscription, une case à cocher non pré‑cochée propose l'abonnement à la newsletter.
2. Si le visiteur la coche, son adresse est ajoutée à la liste avec l'origine correspondante.

### 5.3 Gestion depuis le profil

1. Le client ouvre son profil.
2. Il visualise son état d'abonnement et peut s'abonner ou se désabonner à tout moment.

### 5.4 Désinscription depuis un email

1. L'abonné clique sur le lien de désinscription figurant en bas de l'email.
2. Sa désinscription est enregistrée immédiatement, sans connexion ni formulaire.
3. Une page de confirmation lui propose de se réabonner s'il s'agissait d'une erreur.

### 5.5 Gestion de la liste (back‑office)

1. L'administrateur ouvre **Newsletter**.
2. La liste affiche : adresse, identité, statut, origine, date d'inscription.
3. Il filtre par statut et par origine, et recherche une adresse.
4. Il exporte la liste des abonnés actifs.
5. Il consulte les indicateurs : nombre d'abonnés actifs, inscriptions et désinscriptions sur la période, répartition par origine.

## 6\. Écrans

| Écran                                  | Public   |
| -------------------------------------- | -------- |
| Bloc d'inscription (pied de page)      | Public   |
| Inscription — case d'abonnement        | Visiteur |
| Profil — préférence d'abonnement       | Client   |
| Page de confirmation de désinscription | Public   |
| Back‑office — liste des abonnés        | Admin    |
| Back‑office — indicateurs newsletter   | Admin    |

## 7\. Notifications

| Événement      | Destinataire | Contenu                        |
| -------------- | ------------ | ------------------------------ |
| Inscription    | Abonné       | Confirmation d'abonnement      |
| Désinscription | Abonné       | Confirmation de désinscription |

## 8\. Liens avec les autres features

- **01 — Authentification** : proposition d'abonnement à l'inscription.
- **03 — Profil client** : gestion de la préférence.
- **27 — Blog** : diffusion des nouveaux contenus.
- **30 — Notifications** : la plateforme d'envoi est commune aux emails transactionnels.
- **33 — Statistiques** : suivi de la croissance de la liste.

# 29 — Relances de panier abandonné

## 1\. Objectif

Détecter les paniers constitués mais non validés, relancer leur propriétaire par email, et mesurer l'efficacité de ces relances jusqu'à la commande.

## 2\. Périmètre fonctionnel

- Détection automatique des paniers inactifs depuis un certain délai
- Envoi d'un email de relance rappelant le contenu du panier
- Lien de retour permettant de reprendre le panier en un clic
- Statistiques de performance des relances

Insertions dans la table panier directement pas besoin d'une table dédier.

# 30 — Notifications & emails transactionnels

## 1\. Objectif

Informer automatiquement les clients et l'équipe interne à chaque événement significatif du parcours, au moyen d'emails à la charte homogène, et permettre au back‑office de tester et de vérifier ces envois.

## 2\. Périmètre fonctionnel

- Catalogue d'emails transactionnels couvrant tous les domaines métier
- Charte graphique commune : en‑tête, pied de page, boutons d'action, encarts d'information, badges de statut
- Pièces jointes conditionnelles (facture, bon de livraison)
- Emails déclenchés par les changements de statut de commande, selon le paramétrage
- Alertes internes à destination de l'équipe
- Écran de test d'envoi côté back‑office
- Paramétrage de l'expéditeur et de la signature
- Journalisation des envois et gestion des échecs

## 3\. Catalogue des emails

### Compte et authentification

| Email                            | Destinataire | Déclencheur                                      |
| -------------------------------- | ------------ | ------------------------------------------------ |
| Vérification d'adresse email     | Client       | Inscription ou demande de renvoi                 |
| Réinitialisation de mot de passe | Client       | Demande de réinitialisation                      |
| Demande de validation de compte  | Équipe       | Dépôt d'un dossier professionnel ou collectivité |
| Compte validé                    | Client       | Décision favorable                               |
| Compte refusé                    | Client       | Décision défavorable avec motif                  |

### Commandes

| Email                           | Destinataire | Déclencheur                              |
| ------------------------------- | ------------ | ---------------------------------------- |
| Confirmation de commande        | Client       | Commande validée                         |
| Commande en attente de virement | Client       | Choix du règlement par virement          |
| Virement reçu                   | Client       | Encaissement constaté                    |
| Commande validée                | Client       | Passage au statut correspondant          |
| Commande en approvisionnement   | Client       | Commande passée auprès du fournisseur    |
| Commande expédiée               | Client       | Expédition, avec numéro et lien de suivi |
| Commande livrée                 | Client       | Livraison constatée                      |
| Changement de statut            | Client       | Tout statut configuré pour notifier      |
| Commande remboursée             | Client       | Remboursement effectué                   |
| Commande remboursée par avoir   | Client       | Remboursement sous forme d'avoir         |

### Retours

| Email                      | Destinataire | Déclencheur                                      |
| -------------------------- | ------------ | ------------------------------------------------ |
| Demande de retour créée    | Client       | Dépôt de la demande                              |
| Nouvelle demande de retour | Équipe       | Dépôt de la demande                              |
| Retour accepté             | Client       | Décision favorable, instructions de réexpédition |
| Retour refusé              | Client       | Décision défavorable avec motif                  |
| Colis retour reçu          | Client       | Réception à l'entrepôt                           |
| Retour remboursé           | Client       | Remboursement effectué                           |

### Devis

| Email                    | Destinataire | Déclencheur               |
| ------------------------ | ------------ | ------------------------- |
| Nouveau devis disponible | Client       | Émission d'un devis       |
| Devis accepté            | Équipe       | Acceptation par le client |

### Réparations

| Email                           | Destinataire | Déclencheur                   |
| ------------------------------- | ------------ | ----------------------------- |
| Demande de réparation créée     | Client       | Dépôt de la demande           |
| Machine reçue                   | Client       | Réception à l'atelier         |
| Devis de réparation transmis    | Client       | Fin du diagnostic             |
| Devis de réparation accepté     | Équipe       | Acceptation par le client     |
| Changement de statut du dossier | Client       | Évolution du dossier          |
| Ordre de réparation créé        | Client       | Ouverture de l'ordre          |
| Règlement reçu                  | Client       | Encaissement de la réparation |
| Réparation achevée              | Client       | Fin des travaux               |

### Service client et marketing

| Email                                | Destinataire | Déclencheur                    |
| ------------------------------------ | ------------ | ------------------------------ |
| Message de contact                   | Équipe       | Envoi du formulaire de contact |
| Réponse du service client            | Client       | Message de l'équipe            |
| Relance de panier abandonné          | Client       | Détection d'un panier inactif  |
| Confirmation d'abonnement newsletter | Abonné       | Inscription                    |

## 4\. Règles de gestion

| #   | Règle                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Tous les emails partagent la même charte : en‑tête avec logo, corps structuré, pied de page avec coordonnées et mentions légales.                                     |
| R2  | L'adresse d'expédition et la signature sont paramétrées de façon centralisée.                                                                                         |
| R3  | Chaque email comporte au moins un bouton d'action renvoyant vers la page concernée.                                                                                   |
| R4  | Les emails de statut de commande ne sont envoyés que si le statut est configuré pour cela (feature 16).                                                               |
| R5  | Les pièces jointes (facture, bon de livraison) sont attachées selon la configuration du statut.                                                                       |
| R6  | Un échec d'envoi ne bloque jamais l'opération métier sous‑jacente : le changement de statut, la commande ou la réparation aboutissent quand même.                     |
| R7  | Les échecs d'envoi sont journalisés pour permettre un renvoi manuel.                                                                                                  |
| R8  | Les emails commerciaux comportent un lien de désinscription ; les emails transactionnels n'en comportent pas, étant liés à l'exécution d'un contrat.                  |
| R9  | Les montants, dates et références figurant dans un email reflètent l'état au moment de l'envoi.                                                                       |
| R10 | Aucune donnée sensible (mot de passe, coordonnées de carte complètes) ne figure jamais dans un email.                                                                 |
| R11 | Les liens contenus dans les emails permettent l'accès sans authentification lorsque le contexte le justifie (suivi de commande, désinscription, action sur un devis). |
| R12 | Le back‑office peut déclencher un envoi de test de chaque modèle vers une adresse choisie.                                                                            |

## 5\. Parcours utilisateur

### 5.1 Réception d'un email (client)

1. Un événement se produit sur le parcours du client.
2. L'email correspondant lui est adressé, à la charte de l'entreprise.
3. Il y trouve un récapitulatif de l'événement et un bouton d'accès direct à la page concernée.
4. En cliquant, il accède au suivi, à son espace ou à l'action attendue de lui.

### 5.2 Test des emails (back‑office)

1. L'administrateur ouvre **Emails**.
2. La liste des modèles disponibles est présentée par domaine.
3. Il sélectionne un modèle, renseigne une adresse de destination et des valeurs d'exemple.
4. Il déclenche l'envoi de test et vérifie le rendu dans sa boîte de réception.

### 5.3 Paramétrage (back‑office)

1. L'administrateur ouvre **Paramètres → Email**.
2. Il renseigne l'adresse d'expédition, la signature et les coordonnées figurant en pied de page.
3. Il vérifie le résultat au moyen d'un envoi de test.

## 6\. Écrans

| Écran                                                          | Public |
| -------------------------------------------------------------- | ------ |
| Back‑office — catalogue des modèles d'emails et envois de test | Admin  |
| Back‑office — paramètres d'expédition et signature             | Admin  |

## 7\. Liens avec les autres features

- **16 — Cycle de vie des commandes** : les statuts pilotent les envois et les pièces jointes.
- **18 — Facturation** : les documents joints proviennent de cette feature.
- **21 — Service client** : notifications de nouveaux messages.
- **28 — Newsletter** : plateforme d'envoi commune.
- **32 — Paramétrage entreprise** : identité reprise dans la charte des emails.

# 31 — Administration des utilisateurs & permissions

## 1\. Objectif

Gérer les comptes internes (employés, administrateurs, développeurs) et les comptes clients depuis le back‑office, et encadrer l'accès aux fonctionnalités selon une hiérarchie de rôles.

## 2\. Périmètre fonctionnel

- Création, modification et désactivation de comptes internes
- Attribution et modification du rôle
- Hiérarchie de permissions à quatre niveaux
- Contrôle d'accès sur toutes les pages et actions du back‑office
- Consultation et édition des fiches clients
- Réinitialisation du mot de passe d'un compte interne
- Suivi de l'activité de chaque compte

## 3\. Données manipulées

### Table `user`

| Champ                      | Description                                 |
| -------------------------- | ------------------------------------------- |
| `id`                       | Identifiant du compte                       |
| `username`, `email`        | Identifiants de connexion                   |
| `name`, `avatar_url`       | Éléments d'identité                         |
| `role`                     | `admin`, `developer`, `employe`, `client`   |
| `is_active`                | Compte actif ou désactivé                   |
| `email_verified`           | Adresse confirmée                           |
| `client_id`                | Fiche client associée pour un compte client |
| `created_at`, `updated_at` | Horodatages                                 |

### Tables liées

`account` (moyens d'authentification), `session` (sessions ouvertes), `admin_actions` (journal des opérations), `impersonation_sessions` (prises de main).

## 4\. Hiérarchie des rôles

Les permissions sont **cumulatives** : un rôle donne accès à tout ce qu'autorisent les rôles de niveau inférieur.

| Niveau | Rôle           | Périmètre                                                                                |
| ------ | -------------- | ---------------------------------------------------------------------------------------- |
| 4      | Administrateur | Accès complet, y compris le paramétrage, la gestion des utilisateurs et les statistiques |
| 3      | Développeur    | Accès étendu, incluant les outils techniques et de diagnostic                            |
| 2      | Employé        | Traitement opérationnel : commandes, service client, réparations, retours                |
| 1      | Client         | Espace personnel uniquement                                                              |

## 5\. Règles de gestion

| #   | Règle                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Un compte possède exactement un rôle.                                                                                                               |
| R2  | Un utilisateur accède à une fonctionnalité si son niveau de rôle est supérieur ou égal au niveau requis.                                            |
| R3  | Un rôle interne ne peut être attribué que depuis le back‑office, par un administrateur.                                                             |
| R4  | Un compte ne peut pas modifier son propre rôle.                                                                                                     |
| R5  | Un compte désactivé ne peut plus se connecter ; ses sessions en cours sont invalidées.                                                              |
| R6  | Un compte n'est jamais supprimé lorsqu'il est rattaché à un historique : il est désactivé.                                                          |
| R7  | L'adresse email et l'identifiant de connexion sont uniques.                                                                                         |
| R8  | La création d'un compte interne déclenche l'envoi d'un lien d'initialisation de mot de passe ; aucun mot de passe n'est jamais communiqué en clair. |
| R9  | Toute création, modification de rôle ou désactivation est journalisée avec son auteur.                                                              |
| R10 | Un compte client est rattaché à une fiche client ; un compte interne ne l'est pas.                                                                  |
| R11 | Le dernier administrateur actif ne peut être ni désactivé ni rétrogradé, afin de préserver l'accès à la plateforme.                                 |
| R12 | Un accès refusé redirige vers une page dédiée, sans révéler l'existence de la ressource demandée.                                                   |

## 6\. Parcours utilisateur

### 6.1 Création d'un compte interne

1. L'administrateur ouvre **Paramètres → Utilisateurs → Créer**.
2. Il renseigne : identifiant, adresse email, nom, rôle.
3. Il enregistre ; le compte est créé au statut actif.
4. Le nouvel utilisateur reçoit un email lui permettant de définir son mot de passe.
5. À sa première connexion, il accède au back‑office selon les droits de son rôle.

### 6.2 Modification d'un compte

1. L'administrateur ouvre la fiche d'un utilisateur.
2. Il consulte : identité, rôle, état d'activation, date de création, dernière activité.
3. Il modifie l'identité, ajuste le rôle ou désactive le compte.
4. Le changement est journalisé.

### 6.3 Désactivation

1. L'administrateur bascule le compte à l'état inactif.
2. Les sessions ouvertes sont invalidées ; l'utilisateur ne peut plus se connecter.
3. L'historique de ses actions est conservé.

### 6.4 Gestion des fiches clients

1. L'opérateur ouvre **Clients** : liste filtrable par type de compte, statut de validation, origine, avec recherche par nom ou email.
2. Il ouvre une fiche client : identité, coordonnées, adresses, statut du compte, cumul d'achats, commandes, devis, réparations, retours, cagnotte, parc machines, documents, note interne.
3. Il modifie les informations, ajuste le statut fiscal ou le format de facturation selon ses droits.

### 6.5 Contrôle d'accès

1. Un utilisateur tente d'accéder à une page du back‑office.
2. Son niveau de rôle est comparé au niveau requis.
3. S'il est insuffisant, il est redirigé vers la page d'accès non autorisé.

## 7\. Écrans

| Écran                                         | Public         |
| --------------------------------------------- | -------------- |
| Back‑office — liste des utilisateurs internes | Admin          |
| Back‑office — création d'un utilisateur       | Admin          |
| Back‑office — édition d'un utilisateur        | Admin          |
| Back‑office — liste des clients               | Admin, Employé |
| Back‑office — fiche client                    | Admin, Employé |
| Page d'accès non autorisé                     | Tous           |

## 8\. Notifications

| Événement           | Destinataire | Contenu                               |
| ------------------- | ------------ | ------------------------------------- |
| Compte interne créé | Utilisateur  | Lien d'initialisation du mot de passe |
| Rôle modifié        | Utilisateur  | Information sur son nouveau périmètre |
| Compte désactivé    | Utilisateur  | Information de fin d'accès            |

## 9\. Liens avec les autres features

- **01 — Authentification** : les rôles sont portés par les comptes.
- **02 — Comptes clients** : la fiche client est distincte du compte d'authentification.
- **21 — Service client** : assignation des conversations aux membres de l'équipe.
- **34 — Audit & impersonation** : traçabilité des opérations internes.

# Terminé

# Tecnique

# Makita

voir pour une intégrations : [https://centre-aide.pepsup.com/knowledge-base/article/comment-int%C3%A9grer-un-iframe-contenus-dans-une-page\_1](https://centre-aide.pepsup.com/knowledge-base/article/comment-int%C3%A9grer-un-iframe-contenus-dans-une-page_1)

# En cour

# Migrations des data

Mettre en place directement un worker connecté à la base de données PrestaShop afin de mettre à jour les données de la refonte en temps réel.

Cela évite d'effectuer des extractions manuelles régulières, des injections de doublons et permet une meilleure maîtrise de la migration pour une mise en production sans incohérence de données.

Les mots de passe des utilisateurs n'utiliseront pas le même chiffrage de données.

**Solutions proposées pour les clients qui ont déjà un compte :**
Lors de leur première reconnexion, une interface les invite à entrer leur nouveau mot de passe.
Envoi d'un mail d'informations au client pour changer leur mot de passe.

Listes des table a migré :

- Clients
- Produits
- Message SAV
- Historique de commande
- Image produits
- Categorie

# Un produits Msshop

## Liste des caractéristique d'un produits de la boutique :

**Utils**
Un produit peut être activé ou désactivé
Un produit a une date de création
Un produit doit avoir une date de mise à jour
Un produit doit avoir une date de mise à jour du prix et par qui
Un produit peut avoir un psId (ID PrestaShop unique pour synchronisation)
Peu avoir une redirection (url)

**Identification**
Un produit doit avoir un nom
Un produit doit avoir une référence (SKU)
Un produit doit avoir une référence fournisseurs
Un produit peut avoir un code-barre (EAN13)
Un produits doit avoir un marque

**SEO**
Un produits peu avoir des image
Un produits peu avoir des videos
Un produit doit avoir un slug (URL SEO-friendly)
Un produit peut avoir une description courte
Un produit peut avoir une description (longue)

**Tarification**
Un produit doit avoir un prix HT (hors taxes)
Un produit doit avoir un prix d'achat
Peu avoir une eco participations

**Stock & Logistique**
Un produit peut avoir un stock
Un produit peut avoir un poids (en kg)
a une quantiter
peu avoir un emplacement (reprendre de dolibar)
Un produit peut avoir des dimensions (longueur, largeur, hauteur en cm)
Un produit peut avoir des frais de livraison supplémentaires
Un produit peut être lié à un transporteur forcé
Un produit peu etre remplacer par des références
Un produit peu avoir des produits alternatif
Peu avoir des fournisseurs alternatif
Doit avoir un fournisseurs par default
Dois avoir un delais de livraison
Peu etre exclu de l'ecommerce (uniquement boutique physique)
Peu avoir un etas de user (occasion)

**Catégorisation**
Un produit doit avoir des catégorie

**Vue éclater**
Un produits peu avoir des pdf
Un produits peu avoir une machine

Un peu avoir pack
Peu avoir une variante

# Contexte et objectifs

Le site internet rencontre des difficultés de maintenance et fait face à divers problèmes : les technologies sont vieillissantes et ne peuvent plus être mises à jour, plusieurs failles de sécurité critiques sont connues au cœur du système, et l'application actuelle ne répond plus aux besoins techniques de l'entreprise.

L'objectif de la migration est de permettre à l'entreprise de faire évoluer son outil de vente, afin d'assurer une meilleure stabilité, d'améliorer la rapidité des processus et le confort d'exécution des tâches.

# Vue eclater

Site d'inspirations :

[

www.motoruf.fr

https://www.motoruf.fr/mo/ersatzteillisten/xml/AS%20Motor/Auffangsack.1C67BB18140749BCB2D382477A358D3F.htm

](https://www.motoruf.fr/mo/ersatzteillisten/xml/AS%20Motor/Auffangsack.1C67BB18140749BCB2D382477A358D3F.htm)

# SEO

Les url des produits de la boutique son identifier comme cela :
[https://www.mecaservicesshop.fr/accessoires-tondeuses/349503-lame-a-portance-elevee-pour-lm2102e-et-2122e-sp-ego-power-3570523214828.html](https://www.mecaservicesshop.fr/accessoires-tondeuses/349503-lame-a-portance-elevee-pour-lm2102e-et-2122e-sp-ego-power-3570523214828.html)

Le hash et l'extension `.html` posent problème, car il s'agit d'un système que nous ne pouvons pas reproduire à l'identique pour conserver les mêmes URL sur les nouvelles pages produits.

**Solution retenue :**
Récupérer les URL Prestashop et les stocker dans une base de données statique (JSON), puis mettre en place sur la refonte un **service de redirection** vers les pages produits correspondantes, afin de préserver le référencement SEO.

le trafic et le positionnement se transfèrent progressivement sur 3 à 12 mois, on accélère ça avec un sitemap XML soumis dès le lancement et un monitoring des 404, les URL natives resteront affichées dans les résultats Google. Naturellement, les nouvelles pages produits obtiendront un meilleur positionnement que les anciennes URL, mais ces dernières resteront actives sur le long terme car elle reste indispensable pour **transférer le flux SEO vers les nouvelle url**.

L'identifiant (ID) du produit Prestashop est inclus dans l'URL, ce qui permet d'identifier à quel produit celle-ci appartient.

**Pour le référencement des vues éclatées :**
Les page des pdf : [https://www.mecaservicesshop.fr/content/4158-ph1400e](https://www.mecaservicesshop.fr/content/4158-ph1400e)
Page de navigations : [https://www.mecaservicesshop.fr/content/category/247-gamme-classique](https://www.mecaservicesshop.fr/content/category/247-gamme-classique)

Utilisation des ID de catégorie, stockés dans une base de données statique, pour rediriger vers les pages correspondantes.
![](https://t9014809028.p.clickup-attachments.com/t9014809028/2026f094-fd41-4bf3-bdc1-d022aa553532/Capture%20d%E2%80%99e%CC%81cran%202026-08-05%20a%CC%80%2009.41.21.png)

# note

SEO local pour l'installations de robot ect
suprimmer les produits mort
avoir la meme logic que chez Kramp dans l'arborescence
Bar de recheche, cherche les produits et vue eclater
Preciser sur HT ou TTC pourtout sur le site pour ne pas avoir de error.

Liste des foncitons a voir encore :

- facturations
- retour et avoir
- suivi de commande
- service clients
- demandes de reparations
- bons achats
- devis
- ordres de reparations
- parc machines
- blog de contenue
- newletters
- panier abondonner
- newletter
- notifications par email
- admin utilisateurs
- parametre de l'entreprise
- statistique - (reduire le perimetre )
- Journal d'actions admin - (reduire le perimetre)
- Classifications de categorie
- import et export de catalogue kramp mise a jour du catalogue.
- Bots de mise a jour

Kramp iseki, outils wolf etesia, sabre, SALN, Makita, anova

Prend les produits associée Kramp
