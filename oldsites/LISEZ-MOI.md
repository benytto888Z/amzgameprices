# Catalogue des équipements AMZ

## Contenu

- `index.html`, `style.css`, `app.js` : interface responsive (mobile, tablette, ordinateur) et impression.
- `catalogue.json` : équipements, prix, chemins des images et paramètres de financement.
- `images/` : photos locales des jeux retrouvés.
- `serveur.py` : serveur Python et API qui vérifie le mot de passe et enregistre les prix.

## Démarrage local et mot de passe administrateur

Installer Python 3. Ouvrir un terminal dans le dossier `catalogue-amz` et choisir un mot de passe privé d'au moins 12 caractères. À chaque démarrage, définir la variable d’environnement puis lancer le serveur :

**Windows PowerShell**

```powershell
$env:AMZ_ADMIN_PASSWORD = 'Choisissez-un-mot-de-passe-prive'
python serveur.py
```

Si nécessaire, remplacer `python` par `py`.

**macOS / Linux**

```bash
export AMZ_ADMIN_PASSWORD='Choisissez-un-mot-de-passe-prive'
python3 serveur.py
```

Ouvrir `http://127.0.0.1:8000/` dans le navigateur. Arrêter avec Ctrl+C. Le mot de passe n’est pas dans le HTML, le JavaScript ou le JSON ; il est vérifié côté serveur. Si la variable n’est pas définie ou contient moins de 12 caractères, la consultation fonctionne mais la connexion administrateur est désactivée. Ne communiquez pas votre vrai mot de passe.

Le bouton « Accès administrateur » active la modification des prix locaux. Cliquer sur « Enregistrer les prix » pour écrire dans `catalogue.json`. La session est gardée uniquement en mémoire dans l’onglet : une actualisation ou un redémarrage du serveur nécessite une reconnexion. Le bouton de déconnexion annule les changements non enregistrés. La détection de conflit évite d’écraser un JSON modifié depuis le chargement ; en cas de conflit, recharger la page.

**Important :** ne pas lancer avec `python -m http.server` ni ouvrir le HTML par double-clic : l’API d’authentification et d’enregistrement est nécessaire. Le processus Python doit avoir les droits d’écriture sur le dossier et sur `catalogue.json`. Cette application n'est pas synchronisée avec le business plan en ligne.

### Sécurité et hébergement

Par défaut, le serveur écoute uniquement sur `127.0.0.1` pour une utilisation sur l’ordinateur local. Le mot de passe est stocké dans une variable d’environnement du serveur, et non dans le catalogue ; les requêtes de sauvegarde sont authentifiées. Un utilisateur ayant accès au système de fichiers ou aux variables d’environnement peut néanmoins modifier les données ou accéder au mot de passe.

Le serveur Python utilise HTTP sans chiffrement et est destiné à un usage local. **Ne pas l’exposer directement sur Internet ou sur un réseau non fiable.** Pour une mise en production, utiliser un serveur/proxy HTTPS configuré de façon sécurisée, un hébergement avec backend Python et contrôle d’accès, et une gestion sécurisée des secrets ; prévoir aussi sauvegardes et protection contre les tentatives de connexion. Un hébergement purement statique ne peut pas garantir le verrouillage ni enregistrer les prix. L'utilisation d'un service comme `python -m http.server` désactive la protection et l'enregistrement.

## Modifier les paramètres de financement

Dans `catalogue.json`, modifier uniquement les valeurs de `financement` :

```json
"financement": {
  "majoration_pourcent": 10,
  "acompte": { "numerateur": 1, "denominateur": 3 },
  "nombre_mois": 12
}
```

Le prix total est le prix local majoré de `majoration_pourcent` pour cent, arrondi au FCFA le plus proche. L’acompte est la fraction `numerateur / denominateur` de ce total, arrondie au FCFA le plus proche. Le solde est réparti sur 12 mois. Les 11 premières mensualités sont arrondies à l’entier inférieur et le solde restant constitue la 12ᵉ mensualité. Ainsi acompte + 12 mensualités = prix total majoré exactement. Exemple : pour un prix local de 900 000 FCFA, majoration 10 % : total 990 000 FCFA, acompte 330 000 FCFA, puis 12 × 55 000 FCFA.

`majoration_pourcent` doit être un nombre entre 0 et 1000 ; numérateur et dénominateur sont des entiers, avec `0 ≤ numerateur ≤ denominateur` et un dénominateur entre 1 et 1 000 000. La durée est fixée à 12 mois dans cette version. Après modification, actualiser la page. Cette simulation n’est pas une offre de financement ; confirmer les conditions auprès d’AMZ.

## Modifier le catalogue et les images

Chaque objet de `equipements` comporte : `nom`, `prix_import_fcfa` (entier ou `null`), `prix_local_fcfa` (entier), `image` (chemin relatif tel que `images/mon-jeu.jpg`, ou `null`) et `source_image` (adresse documentaire seulement). Pour ajouter un jeu, ajouter un objet et placer l’image dans `images/`. Formats acceptés : JPG, JPEG, PNG et WebP. Veiller à conserver un JSON valide. Les prix locaux se modifient aussi depuis l’interface administrateur.

Quatre images manquent dans les sources consultées : Skyline Racer, Neurona Arena Portable, Reflex Arena Portable et VoltRush Portable. Ajouter les images correspondantes et renseigner leur chemin quand elles seront disponibles.

## PDF

Cliquer sur « Exporter en PDF », puis choisir « Enregistrer en PDF » dans le navigateur. Mise en page A4 paysage. En mode administrateur, l'export reflète les valeurs affichées, y compris les changements non enregistrés.
