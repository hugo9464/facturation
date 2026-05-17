# Prompt de recréation - Todo

Ajoute une page `/todo` dans ce projet Next.js + Supabase, en t'adaptant à son architecture, son design system et ses conventions existantes.

La page doit permettre de gérer des projets et des tâches par projet, stockés dans Supabase. Chaque tâche appartient obligatoirement à un projet. Un projet a au minimum un nom, un ordre, des dates de création et modification. Une tâche a au minimum: titre, description optionnelle, statut, ordre, numéro lisible numérique, dates de création et modification.

Prévois les statuts `TODO`, `IN_PROGRESS`, `TO_TEST` et `DONE`, avec les libellés français À faire, En cours, À valider et Terminé. Centralise la configuration des statuts pour pouvoir les adapter plus tard.

Affiche une sidebar de projets à gauche. Elle doit permettre de créer, sélectionner, renommer et supprimer un projet. La suppression d'un projet contenant des tâches doit être refusée avec un message clair.

Affiche les tâches du projet sélectionné en vue liste par défaut dans l'ordre À faire, En cours, À valider, Terminé. La section Terminé doit être repliée par défaut. Mémorise aussi le dernier projet sélectionné avec un fallback si le projet n'existe plus. Permets de créer une tâche dans le projet actif depuis une colonne ou section, modifier titre, description et statut, supprimer une tâche, et avancer rapidement une tâche vers le statut logique suivant.

Permets le drag and drop pour réordonner les tâches et les déplacer entre statuts, en conservant l'ordre en base. Utilise les outils déjà présents si possible; sinon ajoute les dépendances nécessaires pour le drag and drop.

Ajoute le schéma et la migration Supabase nécessaires avec RLS adaptée aux pratiques du projet: chaque utilisateur ne peut accéder qu'à ses propres projets et tâches. Si des tâches existent déjà sans projet, migre-les dans un projet par défaut nommé `Général`.

Gère les états de chargement, erreur simple, mutation en cours et mise à jour optimiste quand c'est pertinent. L'UI doit être propre, responsive et cohérente avec le projet cible. Évite les refactors hors scope et garde l'implémentation maintenable.

Vérifie que `/todo` charge, que le CRUD projets et tâches fonctionne, que le changement de vue et le projet sélectionné persistent, que les tâches restent isolées par projet, et que le drag and drop conserve l'ordre.

Important: si tu modifies plus tard les fonctionnalités de cette todo, mets aussi à jour ce prompt de recréation.

Pour les implémentations lancées via Hermes, le payload doit demander explicitement à l'agent de préparer ou documenter le jeu de données adéquat, de renvoyer dans ses logs finaux une section « Instructions de test » avec les étapes et données à utiliser, et de fournir une URL Vercel directe vers la page à valider.
