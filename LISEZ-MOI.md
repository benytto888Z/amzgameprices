# Catalogue AMZ — version Netlify

Cette version est basée sur le dépôt `benytto888Z/amzgameprices`, commit `1c6d19a` : 17 jeux, vos images locales et une majoration de 20 % au départ. Les prix affichés et le financement sont chargés par une Netlify Function. La sauvegarde des prix utilise Netlify Blobs. Le serveur Python de l’ancienne version n’est plus utilisé.

## 1. Mettre à jour GitHub

Décompresser l’archive et copier son contenu à la racine de votre dépôt Git local, en remplaçant les fichiers homonymes. Supprimer de votre dépôt l’ancien `serveur.py` : il ne convient pas à Netlify. Vérifier les modifications puis les publier sur votre branche :

```bash
git status
git add -A
git commit -m "Adaptation pour Netlify"
git push origin main
```

Ne pas committer `node_modules`, `public`, `.netlify`, les secrets ou les variables d’environnement. Le fichier `.gitignore` les exclut. Le projet n’a pas été publié automatiquement sur votre GitHub.

## 2. Créer le site sur Netlify

1. Dans Netlify, choisir **Add new site / Import an existing project**, puis connecter GitHub et sélectionner `benytto888Z/amzgameprices` et la branche `main`.
2. Le fichier `netlify.toml` fournit les réglages : commande `npm run build`, dossier publié `public`, dossier Functions `netlify/functions`, Node 22. Vérifier ces réglages si Netlify vous les demande.
3. Dans **Site configuration → Environment variables**, créer la variable **`AMZ_ADMIN_PASSWORD`** avec un mot de passe privé, long et unique (12 caractères minimum, 20 ou plus recommandés). Si les scopes sont proposés, inclure **Functions**. Ne jamais écrire cette valeur dans GitHub ou dans `netlify.toml`.
4. Lancer le déploiement, ou relancer un déploiement après ajout ou modification de la variable. Ouvrir l’URL HTTPS Netlify.
5. Vérifier les 17 jeux et les images, puis se connecter avec le mot de passe choisi, modifier un prix, enregistrer, recharger et vérifier la persistance. Remettre le prix souhaité à la fin du test.

Si le site s’affiche mais que l’API ne fonctionne pas, consulter **Functions → Logs**, les logs du build et la disponibilité/quota de Netlify Blobs. Le mot de passe absent ou trop court désactive l’administration, sans révéler un mot de passe par défaut. Un changement de mot de passe invalide les sessions précédentes après redéploiement.

## 3. Comment les données sont conservées

- **`catalogue.json` sur GitHub** est la source de base : liste des jeux, photos locales, prix initiaux et paramètres de financement. Modifier ce fichier puis envoyer le commit pour effectuer un nouveau déploiement.
- Les changements de prix effectués depuis l’interface administrateur sont enregistrés dans **Netlify Blobs**, et non dans `catalogue.json` ni dans GitHub. Ils persistent d’un déploiement à l’autre et sont partagés entre visiteurs.
- Un prix enregistré par l’administrateur **a priorité** sur le prix du JSON pour un jeu portant le même nom. Pour revenir au prix du JSON pour un jeu, saisir exactement ce prix en mode administrateur et enregistrer. Le nom sert d’identifiant : après renommage d’un jeu, sa précédente surcharge de prix ne lui sera plus associée. Ne pas utiliser deux noms identiques.
- Attention : les stores Blobs utilisés ici sont rattachés au site Netlify et partagés entre les contextes de déploiement, y compris les aperçus de branche. Évitez de tester des changements administrateur sur un aperçu du site de production ; utilisez plutôt un site Netlify séparé pour les tests. Prévoyez des sauvegardes des données.
- La sauvegarde refuse une version périmée pour éviter d’écraser simultanément les changements d’un autre administrateur. Recharger la page en cas de conflit.

## 4. Personnaliser le financement

Dans `catalogue.json`, modifier les valeurs de :

```json
"financement": {
  "majoration_pourcent": 20,
  "acompte": { "numerateur": 1, "denominateur": 3 },
  "nombre_mois": 12
}
```

Envoyer le JSON modifié sur GitHub pour redéployer. Le total est le prix local majoré, arrondi au FCFA le plus proche ; l’acompte est la fraction indiquée du total, lui aussi arrondi. Le reste est réparti en 12 échéances : 11 arrondies à l’entier inférieur et le solde exact au dernier mois. `majoration_pourcent` doit être entre 0 et 1000 ; les termes de la fraction sont des entiers avec `0 ≤ numerateur ≤ denominateur` et `1 ≤ denominateur ≤ 1 000 000`. La durée est fixée à 12 mois. Ce calcul reste indicatif et doit être confirmé auprès d’AMZ.

## 5. Entretien et sécurité

Les photos doivent être dans `images/` et référencées par un chemin relatif `images/nom.jpg`, `.jpeg`, `.png` ou `.webp`. Garder des noms de jeux uniques et un JSON valide. Les prix import non renseignés sont représentés par `null`.

La connexion est vérifiée côté Function ; le mot de passe n’est pas intégré au code du navigateur. Une session aléatoire est limitée à 8 heures et une limitation simple des tentatives est appliquée par IP. Utiliser HTTPS, un mot de passe fort, des restrictions d’accès et/ou un dispositif MFA/WAF adapté à vos besoins : il ne s’agit pas d’un système d’identités multi-utilisateurs ni d’une garantie contre toutes les attaques. Ne partagez pas le mot de passe dans le dépôt. Consulter les coûts et limites de votre offre Netlify, notamment Functions et Blobs.

Commandes de vérification locales (Node.js requis) : `npm ci`, `npm run build`, `npm test`. Les tests utilisent un stockage simulé ; ils ne remplacent pas un test réel sur Netlify. Pour tester les Functions et Blobs localement, utiliser l’environnement de développement Netlify configuré pour votre site, plutôt qu’un simple serveur statique.

## PDF

Utiliser « Exporter en PDF », puis choisir « Enregistrer en PDF » dans le navigateur. L’export en mode administrateur reflète les valeurs affichées, y compris celles non encore enregistrées.
