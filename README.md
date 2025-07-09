uveau
+37
-0

# Tableau de bord Mobilité

Ce projet fournit une page web affichant des informations en temps réel pour l'Hippodrome de Vincennes.

## Prérequis

- **Node.js** (version 16 ou supérieure)
- **Python 3**
- Installer les dépendances Python :
  ```bash
  pip install -r requirements.txt
  ```
- Installer les dépendances Node :
  ```bash
  npm install
  ```

## Servir l'application

L'application est composée de fichiers HTML, CSS et JavaScript statiques. Pour les tester en local, lancez un petit serveur HTTP depuis la racine du projet :

```bash
python3 -m http.server 8000
```

Ouvrez ensuite votre navigateur à l'adresse `http://localhost:8000`.

## Mise à jour des données GTFS

Les horaires optimisés utilisés par l'application sont générés à partir des données officielles GTFS. Pour les actualiser :

```bash
python3 script/update-gtfs.py
```

Le script téléchargera les données les plus récentes et créera/mettre à jour `static/horaires_export.json`.
