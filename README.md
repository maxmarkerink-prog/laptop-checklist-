# Laptopcheck

Checklist-app om een laptop te testen voordat hij wordt uitgeleverd aan een medewerker.
De app draait lokaal op Node.js en heeft geen externe pakketten nodig.

## Starten

1. Installeer Node.js 18 of nieuwer (https://nodejs.org).
2. Open een terminal in deze map en voer uit:

   ```
   npm start
   ```

3. Open in Chrome of Edge: http://localhost:3000

Een andere poort gebruiken (bijvoorbeeld 3001):

- PowerShell: `$env:PORT=3001; npm start`
- Opdrachtprompt: `set PORT=3001 && npm start`
- macOS/Linux: `PORT=3001 npm start`

De server luistert alleen op deze laptop (127.0.0.1), dus niet op het netwerk.

## Wat er getest wordt

| Onderdeel | Hoe |
| --- | --- |
| Scherm | Volledig scherm in wit, zwart, rood, groen, blauw en grijsverloop |
| Toetsenbord | Elke toets licht groen op als hij reageert; ontbrekende toetsen markeer je als n.v.t. |
| Touchpad | Bewegen, links-, rechts- en dubbelklik, scrollen in beide richtingen |
| Camera | Live beeld, keuze uit meerdere camera's |
| Microfoon | Geluidsmeter |
| Speakers | Toon links, rechts, beide en een toonhoogtesweep |
| Accu en netwerk | Accuniveau, laden/ontladen, online-status, resolutie |
| Visuele inspectie | Handmatige punten: behuizing, scharnieren, poorten, oplader, wifi, bluetooth, inloggen |

Elk onderdeel krijgt een oordeel (werkt of defect) met optionele opmerking. De samenvatting geeft
de eindconclusie: goedgekeurd, afgekeurd of niet compleet.

## Rapporten

Bij **Rapport opslaan** schrijft de server een JSON-bestand naar de map `reports/`, met als naam
`datum_serienummer_id.json`. Onderaan de samenvatting staan de laatste 50 opgeslagen checks.
Met **Afdrukken** maak je een papieren of PDF-versie.

## Beperkingen

- Fn-combinaties, de aan/uit-knop en de Windows-toets kunnen niet altijd door de browser worden opgevangen. Test die met de hand.
- Het accuniveau is alleen zichtbaar in Chrome en Edge.
- Camera en microfoon vragen eenmalig om toestemming in de browser.
