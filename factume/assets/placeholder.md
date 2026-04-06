# Assets requis

Place ici les images nécessaires à l'app :

- `icon.png` — Icône de l'app (1024×1024, fond vert #1D9E75, micro blanc)
- `splash-icon.png` — Image splash (transparent ou fond vert)
- `adaptive-icon.png` — Icône Android adaptive (1024×1024)
- `favicon.png` — Favicon web (32×32)

## Génération rapide (sans graphiste)

1. Utilise https://www.canva.com ou https://figma.com
2. Créer un carré 1024×1024, fond #1D9E75
3. Ajouter l'emoji 🎙️ centré en blanc
4. Exporter en PNG

## Ou avec l'outil Expo

```bash
npx expo install @expo/vector-icons
```

Les assets manquants utilisent des couleurs de fond définies dans app.json.
